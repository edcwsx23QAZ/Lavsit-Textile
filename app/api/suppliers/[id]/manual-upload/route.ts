import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'
import * as XLSX from 'xlsx'
import { EmailExcelParser } from '@/lib/parsers/email-excel-parser'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      )
    }

    if (type !== 'stock' && type !== 'price') {
      return NextResponse.json(
        { error: 'Type must be "stock" or "price"' },
        { status: 400 }
      )
    }

    // Сохраняем файл во временную директорию
    const uploadsDir = path.join(process.cwd(), 'data', 'manual-uploads', supplier.id)
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `${type}_${timestamp}.${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)

    // Сохраняем файл
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    fs.writeFileSync(filePath, buffer)

    console.log(`[manual-upload] Saved file: ${filePath}, type: ${type}`)

    // Получаем или создаем категории
    const categories = await prisma.fabricCategory.findMany({
      orderBy: { price: 'asc' },
    })
    const categoryList = categories.length > 0
      ? categories.map(cat => ({ category: cat.category, price: cat.price }))
      : DEFAULT_CATEGORIES

    if (type === 'stock') {
      // Обработка наличия
      return await handleStockUpload(supplier.id, supplier.name, filePath, categoryList)
    } else {
      // Обработка прайс-листа
      return await handlePriceUpload(supplier.id, supplier.name, filePath, categoryList)
    }
  } catch (error: any) {
    console.error('[manual-upload] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process upload' },
      { status: 500 }
    )
  }
}

async function handleStockUpload(
  supplierId: string,
  supplierName: string,
  filePath: string,
  categories: Array<{ category: number; price: number }>
) {
  try {
    // Деактивируем предыдущие ручные загрузки наличия
    await prisma.manualUpload.updateMany({
      where: {
        supplierId,
        type: 'stock',
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    // Создаем запись о ручной загрузке
    const manualUpload = await prisma.manualUpload.create({
      data: {
        supplierId,
        type: 'stock',
        filePath,
        isActive: true,
      },
    })

    // Парсим файл
    const parser = new EmailExcelParser(supplierId, supplierName)
    
    // Загружаем правила или создаем автоматически
    let rules = await parser.loadRules()
    if (!rules) {
      console.log('[manual-upload] Rules not found, analyzing file...')
      const analysis = await parser.analyze(filePath)
      const { createAutoRules } = await import('@/lib/parsers/auto-rules')
      const autoRules = createAutoRules(supplierName, analysis)
      await parser.saveRules(autoRules)
      rules = autoRules
    }

    // Парсим ткани
    const fabrics = await parser.parse(filePath)

    // Обновляем базу данных
    let processed = 0
    for (const fabric of fabrics) {
      // Вычисляем цену за мп и категорию
      const pricePerMeter = calculatePricePerMeter(fabric.price, fabric.meterage)
      const category = getCategoryByPrice(pricePerMeter, categories)

      // Используем findFirst + create/update вместо upsert с unique constraint
      const existing = await prisma.fabric.findFirst({
        where: {
          supplierId,
          collection: fabric.collection,
          colorNumber: fabric.colorNumber,
        },
      })

      if (existing) {
        await prisma.fabric.update({
          where: { id: existing.id },
          data: {
            inStock: fabric.inStock,
            meterage: fabric.meterage,
            price: fabric.price,
            pricePerMeter,
            category,
            nextArrivalDate: fabric.nextArrivalDate,
            comment: fabric.comment,
            lastUpdatedAt: new Date(),
          },
        })
      } else {
        await prisma.fabric.create({
          data: {
            supplierId,
            collection: fabric.collection,
            colorNumber: fabric.colorNumber,
            inStock: fabric.inStock,
            meterage: fabric.meterage,
            price: fabric.price,
            pricePerMeter,
            category,
            nextArrivalDate: fabric.nextArrivalDate,
            comment: fabric.comment,
          },
        })
      }
        create: {
          supplierId,
          collection: fabric.collection,
          colorNumber: fabric.colorNumber,
          inStock: fabric.inStock,
          meterage: fabric.meterage,
          price: fabric.price,
          pricePerMeter,
          category,
          nextArrivalDate: fabric.nextArrivalDate,
          comment: fabric.comment,
        },
        update: {
          inStock: fabric.inStock,
          meterage: fabric.meterage,
          price: fabric.price,
          pricePerMeter,
          category,
          nextArrivalDate: fabric.nextArrivalDate,
          comment: fabric.comment,
          lastUpdatedAt: new Date(),
        },
      })
      processed++
    }

    // Обновляем счетчик тканей
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        fabricsCount: processed,
        lastUpdatedAt: new Date(),
        status: 'active',
      },
    })

    // Обновляем запись о загрузке
    await prisma.manualUpload.update({
      where: { id: manualUpload.id },
      data: {
        processedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      processed,
      message: `Обработано ${processed} записей`,
    })
  } catch (error: any) {
    console.error('[manual-upload] Stock upload error:', error)
    throw error
  }
}

async function handlePriceUpload(
  supplierId: string,
  supplierName: string,
  filePath: string,
  categories: Array<{ category: number; price: number }>
) {
  try {
    // Деактивируем предыдущие ручные загрузки прайсов
    await prisma.manualUpload.updateMany({
      where: {
        supplierId,
        type: 'price',
        isActive: true,
      },
      data: {
        isActive: false,
      },
    })

    // Создаем запись о ручной загрузке
    const manualUpload = await prisma.manualUpload.create({
      data: {
        supplierId,
        type: 'price',
        filePath,
        isActive: true,
      },
    })

    // Загружаем Excel файл
    const buffer = fs.readFileSync(filePath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: false,
    }) as any[][]

    // Пытаемся найти колонки с коллекцией, цветом и ценой
    // Анализируем первые строки для определения структуры
    let collectionCol = -1
    let colorCol = -1
    let priceCol = -1

    // Ищем заголовки
    for (let i = 0; i < Math.min(10, jsonData.length); i++) {
      const row = jsonData[i] || []
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j]).toLowerCase()
        if (cell.includes('коллекция') && collectionCol === -1) {
          collectionCol = j
        }
        if ((cell.includes('цвет') || cell.includes('номер')) && colorCol === -1) {
          colorCol = j
        }
        if (cell.includes('цена') && priceCol === -1) {
          priceCol = j
        }
      }
    }

    if (collectionCol === -1 || colorCol === -1 || priceCol === -1) {
      // Если не нашли заголовки, используем первые 3 колонки
      collectionCol = 0
      colorCol = 1
      priceCol = 2
    }

    let updated = 0
    const startRow = collectionCol === 0 && colorCol === 1 && priceCol === 2 ? 0 : 1

    // Обновляем цены
    for (let i = startRow; i < jsonData.length; i++) {
      const row = jsonData[i] || []
      const collection = String(row[collectionCol] || '').trim()
      const colorNumber = String(row[colorCol] || '').trim()
      const priceStr = String(row[priceCol] || '').trim()

      if (!collection || !colorNumber) continue

      // Парсим цену
      const priceMatch = priceStr.match(/(\d+[\.,]?\d*)/)
      if (!priceMatch) continue

      const price = parseFloat(priceMatch[1].replace(',', '.'))

      // Находим ткань по коллекции и цвету
      const fabric = await prisma.fabric.findFirst({
        where: {
          supplierId,
          collection: { contains: collection, mode: 'insensitive' },
          colorNumber: { contains: colorNumber, mode: 'insensitive' },
        },
      })

      if (fabric) {
        // Вычисляем цену за мп и категорию
        const pricePerMeter = calculatePricePerMeter(price, fabric.meterage)
        const category = getCategoryByPrice(pricePerMeter, categories)

        await prisma.fabric.update({
          where: { id: fabric.id },
          data: {
            price,
            pricePerMeter,
            category,
            lastUpdatedAt: new Date(),
          },
        })
        updated++
      }
    }

    // Обновляем запись о загрузке
    await prisma.manualUpload.update({
      where: { id: manualUpload.id },
      data: {
        processedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      updated,
      message: `Обновлено цен: ${updated}`,
    })
  } catch (error: any) {
    console.error('[manual-upload] Price upload error:', error)
    throw error
  }
}

