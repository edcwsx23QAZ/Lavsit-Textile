import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import * as XLSX from 'xlsx'

/**
 * Нормализует цену к формату 1000,00р
 */
function normalizePrice(price: any): number | null {
  if (price === null || price === undefined || price === '') return null

  // Преобразуем в строку и удаляем все кроме цифр, точки и запятой
  let priceStr = String(price).trim()
  
  // Удаляем символы валюты (₽, руб, р, $, € и т.д.)
  priceStr = priceStr.replace(/[₽руб$€£¥\s]/gi, '')
  
  // Заменяем запятую на точку
  priceStr = priceStr.replace(',', '.')
  
  // Удаляем все кроме цифр и точки
  priceStr = priceStr.replace(/[^\d.]/g, '')
  
  // Удаляем лишние точки (оставляем только первую)
  const parts = priceStr.split('.')
  if (parts.length > 2) {
    priceStr = parts[0] + '.' + parts.slice(1).join('')
  }

  const parsed = parseFloat(priceStr)
  return isNaN(parsed) || parsed <= 0 ? null : parsed
}

/**
 * Анализирует структуру прайс-листа
 * Возвращает тип: 'per-color' (цена на каждый цвет) или 'per-collection' (цена на коллекцию)
 */
function analyzePriceListType(data: any[][], collectionCol: number, colorCol: number, priceCol: number, headerRow: number): 'per-color' | 'per-collection' {
  const priceMap = new Map<string, Set<number>>() // коллекция -> множество цен
  
  // Собираем все цены для каждой коллекции
  for (let i = headerRow + 1; i < Math.min(headerRow + 100, data.length); i++) {
    const row = data[i]
    const collection = String(row[collectionCol] || '').trim()
    const price = normalizePrice(row[priceCol])

    if (!collection || !price) continue

    if (!priceMap.has(collection)) {
      priceMap.set(collection, new Set())
    }
    priceMap.get(collection)!.add(price)
  }

  // Если для большинства коллекций есть только одна цена - значит цена на коллекцию
  let collectionsWithSinglePrice = 0
  let totalCollections = 0

  for (const prices of priceMap.values()) {
    if (prices.size > 0) {
      totalCollections++
      if (prices.size === 1) {
        collectionsWithSinglePrice++
      }
    }
  }

  // Если более 70% коллекций имеют одну цену - считаем что цена на коллекцию
  return collectionsWithSinglePrice / totalCollections > 0.7 ? 'per-collection' : 'per-color'
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Файл не предоставлен' }, { status: 400 })
    }

    // Проверяем расширение файла
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Поддерживаются только Excel файлы (.xlsx, .xls)' }, { status: 400 })
    }

    // Читаем файл
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Берем первый лист
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

    if (data.length === 0) {
      return NextResponse.json({ error: 'Файл пустой' }, { status: 400 })
    }

    // Ищем заголовки (коллекция, цвет, цена)
    let collectionCol = -1
    let colorCol = -1
    let priceCol = -1
    let headerRow = 0

    // Ищем строку с заголовками
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i].map((cell: any) => String(cell).toLowerCase().trim())
      const collectionIdx = row.findIndex((cell: string) => 
        cell.includes('коллекция') || cell.includes('collection')
      )
      const colorIdx = row.findIndex((cell: string) => 
        cell.includes('цвет') || cell.includes('номер') || cell.includes('color')
      )
      const priceIdx = row.findIndex((cell: string) => 
        cell.includes('цена') || cell.includes('стоимость') || cell.includes('price') || cell.includes('cost')
      )

      if (collectionIdx !== -1 && colorIdx !== -1 && priceIdx !== -1) {
        collectionCol = collectionIdx
        colorCol = colorIdx
        priceCol = priceIdx
        headerRow = i
        break
      }
    }

    if (collectionCol === -1 || colorCol === -1 || priceCol === -1) {
      return NextResponse.json({ error: 'Не найдены столбцы "Коллекция", "Цвет" и "Цена" в файле' }, { status: 400 })
    }

    // Анализируем тип прайс-листа
    const priceListType = analyzePriceListType(data, collectionCol, colorCol, priceCol, headerRow)

    // Обрабатываем данные
    let updated = 0
    let notFound = 0
    const collectionPriceMap = new Map<string, number>() // Для типа 'per-collection'

    // Сначала, если тип 'per-collection', собираем цены для коллекций
    if (priceListType === 'per-collection') {
      for (let i = headerRow + 1; i < data.length; i++) {
        const row = data[i]
        const collection = String(row[collectionCol] || '').trim()
        const price = normalizePrice(row[priceCol])

        if (!collection || !price) continue

        // Берем первую найденную цену для коллекции
        if (!collectionPriceMap.has(collection)) {
          collectionPriceMap.set(collection, price)
        }
      }
    }

    // Обновляем цены
    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i]
      const collection = String(row[collectionCol] || '').trim()
      const colorNumber = String(row[colorCol] || '').trim()

      if (!collection || !colorNumber) continue

      // Определяем цену в зависимости от типа прайс-листа
      let price: number | null = null
      if (priceListType === 'per-color') {
        price = normalizePrice(row[priceCol])
      } else {
        price = collectionPriceMap.get(collection) || null
      }

      if (!price) continue

      // Ищем ткань в базе
      const fabric = await prisma.fabric.findFirst({
        where: {
          supplierId,
          collection: collection,
          colorNumber: colorNumber,
        },
      })

      if (!fabric) {
        notFound++
        continue
      }

      // Обновляем цену и пересчитываем цену за метр
      let pricePerMeter = fabric.pricePerMeter
      if (fabric.meterage && fabric.meterage > 0) {
        pricePerMeter = price / fabric.meterage
      }

      // Получаем категории для определения категории ткани
      const categories = await prisma.fabricCategory.findMany({
        orderBy: { price: 'asc' },
      })

      let category: number | null = null
      if (pricePerMeter) {
        for (const cat of categories) {
          if (pricePerMeter <= cat.price) {
            category = cat.category
            break
          }
        }
        // Если цена больше всех категорий, присваиваем последнюю
        if (!category && categories.length > 0) {
          category = categories[categories.length - 1].category
        }
      }

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

    return NextResponse.json({
      success: true,
      updated,
      notFound,
      priceListType,
      message: `Обновлено: ${updated}, не найдено: ${notFound}. Тип прайс-листа: ${priceListType === 'per-collection' ? 'цена на коллекцию' : 'цена на каждый цвет'}`,
    })
  } catch (error: any) {
    console.error('Error uploading pricelist:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка загрузки прайс-листа' },
      { status: 500 }
    )
  }
}

