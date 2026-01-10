import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
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

    // Импортируем утилиту нормализации цен
    const { normalizePrice } = await import('@/lib/price-normalization')

    // Обновляем базу данных
    let processed = 0
    for (const fabric of fabrics) {
      // Нормализуем цену к единому формату (рубли)
      const normalizedPrice = fabric.price !== null ? normalizePrice(fabric.price) : null
      
      // Вычисляем цену за мп и категорию
      const pricePerMeter = calculatePricePerMeter(normalizedPrice, fabric.meterage)
      const category = getCategoryByPrice(pricePerMeter, categories)

      // Используем findFirst + create/update вместо upsert с unique constraint
      const existing = await prisma.fabric.findFirst({
        where: {
          supplierId,
          collection: fabric.collection,
          colorNumber: fabric.colorNumber,
        },
      })

      // Валидируем дату перед сохранением
      const { validateDate } = await import('@/lib/date-validation')
      const validNextArrivalDate = validateDate(fabric.nextArrivalDate)

      if (existing) {
        await prisma.fabric.update({
          where: { id: existing.id },
          data: {
            inStock: fabric.inStock,
            meterage: fabric.meterage,
            price: normalizedPrice,
            pricePerMeter,
            category,
            nextArrivalDate: validNextArrivalDate,
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
            price: normalizedPrice,
            pricePerMeter,
            category,
            nextArrivalDate: validNextArrivalDate,
            comment: fabric.comment,
          },
        })
      }
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
    // Используем raw: true для получения исходных значений (не форматированных)
    // Это важно для правильного чтения цен с пробелами и запятыми
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: true, // Получаем исходные значения, не форматированные
    }) as any[][]

    // Специальная обработка для NoFrames
    if (supplierName === 'NoFrames') {
      return await handleNoFramesPriceUpload(supplierId, jsonData, categories, manualUpload.id)
    }

    // Специальная обработка для Аметиста
    if (supplierName === 'Аметист') {
      return await handleAmetistPriceUpload(supplierId, jsonData, categories, manualUpload.id)
    }

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

    // Импортируем утилиту нормализации цен
    const { normalizePrice } = await import('@/lib/price-normalization')

    // Обновляем цены
    for (let i = startRow; i < jsonData.length; i++) {
      const row = jsonData[i] || []
      const collection = String(row[collectionCol] || '').trim()
      const colorNumber = String(row[colorCol] || '').trim()
      const priceStr = String(row[priceCol] || '').trim()

      if (!collection || !colorNumber) continue

      // Нормализуем цену
      const price = normalizePrice(priceStr)
      if (!price) continue

      // Находим ткань по коллекции и цвету
      const fabric = await prisma.fabric.findFirst({
        where: {
          supplierId,
          collection: { contains: collection },
          colorNumber: { contains: colorNumber },
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

/**
 * Специальная обработка прайса для NoFrames
 * Правила:
 * - Название коллекции в столбце B (индекс 1)
 * - Цена в столбце E (индекс 4)
 * - Тип ткани в столбце G (индекс 6)
 * - Страна в столбце F (индекс 5)
 * - Состав в столбце H (индекс 7)
 * - Тест Мартиндейла в столбце I (индекс 8)
 * - У всех тканей в рамках одной коллекции одна цена
 */
async function handleNoFramesPriceUpload(
  supplierId: string,
  jsonData: any[][],
  categories: Array<{ category: number; price: number }>,
  manualUploadId: string
) {
  const { normalizePrice } = await import('@/lib/price-normalization')
  const { calculatePricePerMeter, getCategoryByPrice } = await import('@/lib/fabric-categories')

  // Маппинг: коллекция -> { цена, тип ткани, описание }
  const collectionData = new Map<string, {
    price: number
    fabricType: string | null
    description: string | null
  }>()

  // Собираем данные по коллекциям
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i] || []
    
    // Столбец B (индекс 1) - коллекция
    const collection = String(row[1] || '').trim()
    if (!collection) continue

    // Столбец E (индекс 4) - цена
    const rawPrice = row[4]
    const priceValue = normalizePrice(rawPrice)
    
    // Логирование для отладки
    if (collection && rawPrice) {
      console.log(`[NoFrames Price] Коллекция "${collection}": исходная цена = "${rawPrice}", нормализованная = ${priceValue}`)
    }
    
    if (!priceValue) continue

    // Столбец G (индекс 6) - тип ткани
    const fabricType = String(row[6] || '').trim() || null

    // Столбец F (индекс 5) - страна
    const country = String(row[5] || '').trim()
    
    // Столбец H (индекс 7) - состав
    const composition = String(row[7] || '').trim()
    
    // Столбец I (индекс 8) - тест Мартиндейла
    const martindale = String(row[8] || '').trim()

    // Формируем описание
    const descriptionParts: string[] = []
    if (country) {
      descriptionParts.push(`Страна: ${country}`)
    }
    if (composition) {
      descriptionParts.push(`Состав: ${composition}`)
    }
    if (martindale) {
      descriptionParts.push(`тест Мартиндейла: ${martindale}`)
    }
    const description = descriptionParts.length > 0 ? descriptionParts.join(', ') : null

    // Сохраняем данные коллекции (если цена уже есть, не перезаписываем)
    if (!collectionData.has(collection)) {
      collectionData.set(collection, {
        price: priceValue,
        fabricType,
        description,
      })
    }
  }

  console.log(`[NoFrames Price] Найдено коллекций с ценами: ${collectionData.size}`)

  // Обновляем все ткани по коллекциям
  let updated = 0
  for (const [collection, data] of collectionData.entries()) {
    // Находим все ткани этой коллекции (без учета регистра)
    // Получаем все ткани поставщика и фильтруем в памяти для точного совпадения без учета регистра
    const allFabrics = await prisma.fabric.findMany({
      where: { supplierId },
    })
    
    const fabrics = allFabrics.filter(f => 
      f.collection.trim().toLowerCase() === collection.trim().toLowerCase()
    )

    console.log(`[NoFrames Price] Коллекция "${collection}": найдено ${fabrics.length} тканей, цена: ${data.price}`)

    for (const fabric of fabrics) {
      // Вычисляем цену за мп и категорию
      const pricePerMeter = calculatePricePerMeter(data.price, fabric.meterage)
      const category = getCategoryByPrice(pricePerMeter, categories)

      await prisma.fabric.update({
        where: { id: fabric.id },
        data: {
          price: data.price,
          pricePerMeter,
          category,
          fabricType: data.fabricType,
          description: data.description,
          lastUpdatedAt: new Date(),
        },
      })
      updated++
    }
  }

  // Обновляем запись о загрузке
  await prisma.manualUpload.update({
    where: { id: manualUploadId },
    data: {
      processedAt: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    updated,
    message: `Обновлено цен для ${collectionData.size} коллекций, всего тканей: ${updated}`,
  })
}

/**
 * Специальная обработка прайса для Аметиста
 * Правила:
 * - Изображение ткани в столбце A (индекс 0)
 * - Коллекция и цвет в столбце C (индекс 2) - полное соответствие
 * - Цена в столбце D (индекс 3)
 * - Сохраняем только изображение и цену
 */
async function handleAmetistPriceUpload(
  supplierId: string,
  jsonData: any[][],
  categories: Array<{ category: number; price: number }>,
  manualUploadId: string
) {
  const { normalizePrice } = await import('@/lib/price-normalization')
  const { calculatePricePerMeter, getCategoryByPrice } = await import('@/lib/fabric-categories')

  // Создаем парсер для использования метода parseCollectionAndColor
  const parser = new EmailExcelParser(supplierId, 'Аметист')

  let updated = 0
  let notFound = 0

  // Обрабатываем каждую строку прайс-листа
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i] || []
    
    // Столбец A (индекс 0) - изображение
    const imageUrl = String(row[0] || '').trim()
    
    // Столбец C (индекс 2) - коллекция и цвет
    const collectionColor = String(row[2] || '').trim()
    if (!collectionColor) continue

    // Парсим коллекцию и цвет из третьего столбца
    // Используем специальное правило для Аметиста
    const { collection, color } = (parser as any).parseCollectionAndColor(collectionColor, {
      ametistColorPattern: true, // Используем специальное правило для Аметиста
    })

    if (!collection || !color) {
      console.log(`[Ametist Price] Строка ${i + 1}: не удалось распарсить коллекцию и цвет из "${collectionColor}"`)
      continue
    }

    // Столбец D (индекс 3) - цена
    const rawPrice = row[3]
    const priceValue = normalizePrice(rawPrice)
    
    if (!priceValue) {
      console.log(`[Ametist Price] Строка ${i + 1}: коллекция="${collection}", цвет="${color}" - цена не найдена`)
      continue
    }

    // Ищем ткань по полному соответствию коллекции и цвета
    const fabric = await prisma.fabric.findFirst({
      where: {
        supplierId,
        collection: collection.trim(),
        colorNumber: color.trim(),
      },
    })

    if (fabric) {
      // Вычисляем цену за мп и категорию
      const pricePerMeter = calculatePricePerMeter(priceValue, fabric.meterage)
      const category = getCategoryByPrice(pricePerMeter, categories)

      // Обновляем только изображение и цену
      await prisma.fabric.update({
        where: { id: fabric.id },
        data: {
          imageUrl: imageUrl || null, // Сохраняем изображение, если есть
          price: priceValue,
          pricePerMeter,
          category,
          lastUpdatedAt: new Date(),
        },
      })
      updated++
      
      if (updated <= 5) {
        console.log(`[Ametist Price] Обновлено: коллекция="${collection}", цвет="${color}", цена=${priceValue}, изображение="${imageUrl || 'нет'}"`)
      }
    } else {
      notFound++
      if (notFound <= 5) {
        console.log(`[Ametist Price] Не найдено: коллекция="${collection}", цвет="${color}"`)
      }
    }
  }

  // Обновляем запись о загрузке
  await prisma.manualUpload.update({
    where: { id: manualUploadId },
    data: {
      processedAt: new Date(),
    },
  })

  return NextResponse.json({
    success: true,
    updated,
    notFound,
    message: `Обновлено: ${updated}, не найдено: ${notFound}`,
  })
}

