import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import * as XLSX from 'xlsx'
import { normalizePrice } from '@/lib/price-normalization'

// Увеличиваем таймаут для обработки больших прайс-листов
export const maxDuration = 300 // 5 минут (по умолчанию 10 секунд)

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

    // Получаем информацию о поставщике для специальной обработки
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    // Специальная обработка для Аметиста
    if (supplier?.name === 'Аметист') {
      return await handleAmetistPriceListUpload(supplierId, data)
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

    // Импортируем normalizePrice для основной функции
    const { normalizePrice: normalizePriceMain } = await import('@/lib/price-normalization')

    // Анализируем тип прайс-листа
    const priceListType = await analyzePriceListType(data, collectionCol, colorCol, priceCol, headerRow)

    // Обрабатываем данные
    let updated = 0
    let notFound = 0
    const collectionPriceMap = new Map<string, number>() // Для типа 'per-collection'

    // Сначала, если тип 'per-collection', собираем цены для коллекций
    if (priceListType === 'per-collection') {
      for (let i = headerRow + 1; i < data.length; i++) {
        const row = data[i]
        const collection = String(row[collectionCol] || '').trim()
        const price = normalizePriceMain(row[priceCol])

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
        price = normalizePriceMain(row[priceCol])
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

/**
 * Специальная обработка прайс-листа для Аметиста
 * Правила:
 * - Изображение в столбце A (индекс 0) - заголовок "Фото"
 * - Коллекция и цвет в столбце C (индекс 2) - заголовок "Наименование"
 * - Цена в столбце D (индекс 3) - заголовок "Цена"
 */
async function handleAmetistPriceListUpload(
  supplierId: string,
  data: any[][]
): Promise<NextResponse> {
  // Ищем заголовки для Аметиста: "Фото", "Наименование", "Цена"
  let imageCol = -1
  let nameCol = -1
  let priceCol = -1
  let headerRow = 0

  // Ищем строку с заголовками
  for (let i = 0; i < Math.min(10, data.length); i++) {
    const row = data[i].map((cell: any) => String(cell).toLowerCase().trim())
    const imageIdx = row.findIndex((cell: string) => 
      cell.includes('фото') || cell.includes('photo') || cell.includes('изображение')
    )
    const nameIdx = row.findIndex((cell: string) => 
      cell.includes('наименование') || cell.includes('название') || cell.includes('name') || cell.includes('товар')
    )
    const priceIdx = row.findIndex((cell: string) => 
      cell.includes('цена') || cell.includes('стоимость') || cell.includes('price') || cell.includes('cost')
    )

    if (imageIdx !== -1 && nameIdx !== -1 && priceIdx !== -1) {
      imageCol = imageIdx
      nameCol = nameIdx
      priceCol = priceIdx
      headerRow = i
      break
    }
  }

  // Если не нашли по заголовкам, используем фиксированные индексы для Аметиста
  if (imageCol === -1 || nameCol === -1 || priceCol === -1) {
    imageCol = 0 // Столбец A - Фото
    nameCol = 2  // Столбец C - Наименование
    priceCol = 3 // Столбец D - Цена
    headerRow = 0 // Предполагаем, что заголовки в первой строке
  }

  // Импортируем необходимые утилиты
  const { normalizePrice } = await import('@/lib/price-normalization')
  const { calculatePricePerMeter, getCategoryByPrice } = await import('@/lib/fabric-categories')
  const { EmailExcelParser } = await import('@/lib/parsers/email-excel-parser')

  // Создаем парсер для использования метода parseCollectionAndColor
  const parser = new EmailExcelParser(supplierId, 'Аметист')

  // Получаем категории
  const categories = await prisma.fabricCategory.findMany({
    orderBy: { price: 'asc' },
  })
  const categoryList = categories.length > 0
    ? categories.map(cat => ({ category: cat.category, price: cat.price }))
    : []

  // ОПТИМИЗАЦИЯ: Загружаем все ткани поставщика один раз в начале (избегаем N+1 проблему)
  console.log(`[Ametist PriceList] Загрузка всех тканей поставщика...`)
  const allFabrics = await prisma.fabric.findMany({
    where: { supplierId },
    select: {
      id: true,
      collection: true,
      colorNumber: true,
      meterage: true,
    },
  })

  // Создаем Map для быстрого поиска: ключ = "collection|color" (lowercase), значение = fabric
  const fabricMap = new Map<string, typeof allFabrics[0]>()
  for (const fabric of allFabrics) {
    const key = `${fabric.collection.trim().toLowerCase()}|${fabric.colorNumber.trim().toLowerCase()}`
    fabricMap.set(key, fabric)
  }

  console.log(`[Ametist PriceList] Загружено ${allFabrics.length} тканей. Начало обработки ${data.length - headerRow - 1} строк прайс-листа`)
  console.log(`[Ametist PriceList] Столбцы: изображение=${imageCol}, наименование=${nameCol}, цена=${priceCol}`)
  
  // Показываем примеры существующих тканей для отладки
  if (allFabrics.length > 0) {
    console.log(`[Ametist PriceList] Примеры существующих тканей (первые 10):`, 
      allFabrics.slice(0, 10).map(f => `${f.collection} - ${f.colorNumber}`))
    console.log(`[Ametist PriceList] Примеры ключей в Map (первые 10):`, 
      Array.from(fabricMap.keys()).slice(0, 10))
  }
  
  // Показываем первые несколько строк прайс-листа для отладки
  console.log(`[Ametist PriceList] Первые 5 строк прайс-листа (после заголовка):`)
  for (let i = headerRow + 1; i < Math.min(headerRow + 6, data.length); i++) {
    const row = data[i] || []
    console.log(`[Ametist PriceList]   Строка ${i + 1}:`, {
      image: row[imageCol],
      name: row[nameCol],
      price: row[priceCol],
    })
  }

  let updated = 0
  let notFound = 0
  const updates: Array<{
    id: string
    imageUrl: string | null
    price: number
    pricePerMeter: number | null
    category: number | null
  }> = []

  // Обрабатываем каждую строку прайс-листа
  for (let i = headerRow + 1; i < data.length; i++) {
    const row = data[i] || []
    
    // Столбец A (индекс 0) - изображение
    // В Excel изображения могут быть встроенными объектами, поэтому проверяем разные варианты
    let imageUrl: string | null = null
    const imageCell = row[imageCol]
    
    // Детальное логирование для первых строк
    if (i <= headerRow + 10) {
      console.log(`[Ametist PriceList] Строка ${i + 1}: тип imageCell = ${typeof imageCell}, значение =`, imageCell)
    }
    
    if (imageCell) {
      if (typeof imageCell === 'string') {
        imageUrl = imageCell.trim() || null
        if (i <= headerRow + 10) {
          console.log(`[Ametist PriceList] Строка ${i + 1}: изображение (строка) = "${imageUrl}"`)
        }
      } else if (typeof imageCell === 'object' && imageCell !== null) {
        // Если это объект (встроенное изображение), пропускаем
        // В Excel изображения хранятся как встроенные объекты, их нельзя извлечь напрямую через XLSX
        imageUrl = null
        if (i <= headerRow + 10) {
          console.log(`[Ametist PriceList] Строка ${i + 1}: изображение - встроенный объект (нельзя извлечь через XLSX)`)
        }
      } else if (typeof imageCell === 'number') {
        // Иногда изображения могут быть представлены как числа (индексы)
        imageUrl = null
        if (i <= headerRow + 10) {
          console.log(`[Ametist PriceList] Строка ${i + 1}: изображение - число (${imageCell}), пропускаем`)
        }
      }
    } else {
      if (i <= headerRow + 10) {
        console.log(`[Ametist PriceList] Строка ${i + 1}: изображение - пусто`)
      }
    }
    
    // Столбец C (индекс 2) - коллекция и цвет (Наименование)
    const collectionColor = String(row[nameCol] || '').trim()
    if (!collectionColor) {
      if (i <= headerRow + 5) {
        console.log(`[Ametist PriceList] Строка ${i + 1}: пустое наименование, пропускаем`)
      }
      continue
    }

    // Парсим коллекцию и цвет из столбца "Наименование"
    // Для Аметиста формат: "ALASKA beige" -> коллекция: "ALASKA", цвет: "beige"
    const { collection, color } = (parser as any).parseCollectionAndColor(collectionColor, {
      ametistColorPattern: true, // Используем специальное правило для Аметиста
    })

    if (!collection || !color) {
      if (i <= headerRow + 10) {
        console.log(`[Ametist PriceList] Строка ${i + 1}: не удалось распарсить коллекцию и цвет из "${collectionColor}" -> collection="${collection}", color="${color}"`)
      }
      continue
    }
    
    // Детальное логирование для первых строк
    if (i <= headerRow + 10) {
      console.log(`[Ametist PriceList] Строка ${i + 1}: "${collectionColor}" -> коллекция="${collection}", цвет="${color}"`)
    }

    // Столбец D (индекс 3) - цена
    const rawPrice = row[priceCol]
    
    // Детальное логирование для первых строк
    if (i <= headerRow + 10) {
      console.log(`[Ametist PriceList] Строка ${i + 1}: rawPrice =`, rawPrice, `(тип: ${typeof rawPrice})`)
    }
    
    const priceValue = normalizePrice(rawPrice)
    
    if (!priceValue) {
      if (i <= headerRow + 10) {
        console.log(`[Ametist PriceList] Строка ${i + 1}: коллекция="${collection}", цвет="${color}" - цена не найдена (rawPrice="${rawPrice}", тип: ${typeof rawPrice})`)
      }
      continue
    }
    
    if (i <= headerRow + 10) {
      console.log(`[Ametist PriceList] Строка ${i + 1}: цена распарсена: "${rawPrice}" (тип: ${typeof rawPrice}) -> ${priceValue} (тип: ${typeof priceValue})`)
    }
    
    // Контрольная точка для ALASKA beige
    if (collection.toLowerCase() === 'alaska' && color.toLowerCase() === 'beige') {
      console.log(`[Ametist PriceList] 🔍 КОНТРОЛЬНАЯ ТОЧКА ALASKA beige:`)
      console.log(`[Ametist PriceList]   - Строка: ${i + 1}`)
      console.log(`[Ametist PriceList]   - Исходный текст: "${collectionColor}"`)
      console.log(`[Ametist PriceList]   - Распарсено: коллекция="${collection}", цвет="${color}"`)
      console.log(`[Ametist PriceList]   - Исходная цена: "${rawPrice}" (тип: ${typeof rawPrice})`)
      console.log(`[Ametist PriceList]   - Распарсенная цена: ${priceValue}`)
      console.log(`[Ametist PriceList]   - Столбцы: imageCol=${imageCol}, nameCol=${nameCol}, priceCol=${priceCol}`)
    }

    // Ищем ткань в Map (быстрый поиск без запросов к БД)
    const searchKey = `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
    const fabric = fabricMap.get(searchKey)

    // Детальное логирование для первых строк
    if (i <= headerRow + 10) {
      console.log(`[Ametist PriceList] Строка ${i + 1}: поиск по ключу "${searchKey}"`)
      if (fabric) {
        console.log(`[Ametist PriceList]   ✅ Найдено: id=${fabric.id}, коллекция="${fabric.collection}", цвет="${fabric.colorNumber}"`)
      } else {
        console.log(`[Ametist PriceList]   ❌ Не найдено. Поиск похожих ключей...`)
        // Показываем похожие ключи для отладки
        const similarKeys = Array.from(fabricMap.keys()).filter(key => 
          key.includes(collection.trim().toLowerCase()) || key.includes(color.trim().toLowerCase())
        ).slice(0, 5)
        if (similarKeys.length > 0) {
          console.log(`[Ametist PriceList]   Похожие ключи:`, similarKeys)
        }
      }
    }

    if (fabric) {
      // Вычисляем цену за мп и категорию
      const pricePerMeter = calculatePricePerMeter(priceValue, fabric.meterage)
      const category = getCategoryByPrice(pricePerMeter, categoryList)

      // Добавляем в список обновлений (batch update)
      updates.push({
        id: fabric.id,
        imageUrl: imageUrl || null,
        price: priceValue,
        pricePerMeter,
        category,
      })
      
      updated++
      if (updated <= 10) {
        console.log(`[Ametist PriceList] ✅ Добавлено в обновления: коллекция="${collection}", цвет="${color}", цена=${priceValue}, fabricId=${fabric.id}, imageUrl=${imageUrl || 'null'}`)
      }
    } else {
      notFound++
      if (notFound <= 10) {
        console.log(`[Ametist PriceList] ❌ Не найдено: коллекция="${collection}", цвет="${color}" (из "${collectionColor}"), ключ="${searchKey}"`)
      }
    }
  }

  // ОПТИМИЗАЦИЯ: Выполняем batch обновления с ограничением параллелизма
  console.log(`[Ametist PriceList] ===== ИТОГИ ПАРСИНГА =====`)
  console.log(`[Ametist PriceList] Всего обработано строк: ${data.length - headerRow - 1}`)
  console.log(`[Ametist PriceList] Найдено соответствий: ${updates.length}`)
  console.log(`[Ametist PriceList] Не найдено: ${notFound}`)
  console.log(`[Ametist PriceList] Выполнение batch обновлений для ${updates.length} тканей...`)
  
  if (updates.length === 0) {
    console.log(`[Ametist PriceList] ⚠️ ВНИМАНИЕ: Нет обновлений для выполнения!`)
    console.log(`[Ametist PriceList] Возможные причины:`)
    console.log(`[Ametist PriceList]   1. Не найдены соответствия между прайс-листом и базой данных`)
    console.log(`[Ametist PriceList]   2. Проблема с парсингом коллекции и цвета`)
    console.log(`[Ametist PriceList]   3. Проблема с парсингом цены`)
  }
  
  // Обновляем батчами по 50 записей для баланса между скоростью и нагрузкой на БД
  const batchSize = 50
  let totalUpdated = 0
  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize)
    try {
      const updateResults = await Promise.all(
        batch.map(async (update) => {
          try {
            const result = await prisma.fabric.update({
              where: { id: update.id },
              data: {
                imageUrl: update.imageUrl,
                price: update.price,
                pricePerMeter: update.pricePerMeter,
                category: update.category,
                lastUpdatedAt: new Date(),
              },
            })
            return { success: true, id: update.id, result }
          } catch (error: any) {
            console.error(`[Ametist PriceList] Ошибка обновления ткани ${update.id}:`, error.message)
            return { success: false, id: update.id, error: error.message }
          }
        })
      )
      
      const successCount = updateResults.filter(r => r.success).length
      totalUpdated += successCount
      
      if (i === 0 && successCount > 0) {
        // Показываем пример первого успешного обновления
        const firstSuccess = updateResults.find(r => r.success)
        if (firstSuccess && firstSuccess.result) {
          console.log(`[Ametist PriceList] Пример обновленной ткани:`, {
            id: firstSuccess.result.id,
            collection: firstSuccess.result.collection,
            color: firstSuccess.result.colorNumber,
            price: firstSuccess.result.price,
            pricePerMeter: firstSuccess.result.pricePerMeter,
            imageUrl: firstSuccess.result.imageUrl,
          })
        }
      }
      
      console.log(`[Ametist PriceList] Батч ${Math.floor(i / batchSize) + 1}: обновлено ${successCount}/${batch.length} тканей (всего ${totalUpdated}/${updates.length})`)
    } catch (error: any) {
      console.error(`[Ametist PriceList] Критическая ошибка при обновлении батча ${Math.floor(i / batchSize) + 1}:`, error.message)
      console.error(`[Ametist PriceList] Stack:`, error.stack)
      // Продолжаем с следующим батчем
    }
  }
  
  console.log(`[Ametist PriceList] ===== ОБНОВЛЕНИЯ ЗАВЕРШЕНЫ =====`)
  console.log(`[Ametist PriceList] Успешно обновлено: ${totalUpdated} тканей`)

  // Показываем примеры существующих тканей только один раз в конце
  if (notFound > 0 && allFabrics.length > 0) {
    console.log(`[Ametist PriceList] Примеры существующих тканей (первые 10):`, 
      allFabrics.slice(0, 10).map(f => `${f.collection} - ${f.colorNumber}`))
  }

  console.log(`[Ametist PriceList] ===== ФИНАЛЬНЫЙ РЕЗУЛЬТАТ =====`)
  console.log(`[Ametist PriceList] Обновлено тканей: ${totalUpdated}`)
  console.log(`[Ametist PriceList] Не найдено соответствий: ${notFound}`)
  
  // Финальная проверка: загружаем несколько обновленных тканей для проверки
  if (totalUpdated > 0 && updates.length > 0) {
    const sampleIds = updates.slice(0, 3).map(u => u.id)
    const sampleFabrics = await prisma.fabric.findMany({
      where: { id: { in: sampleIds } },
      select: {
        id: true,
        collection: true,
        colorNumber: true,
        price: true,
        pricePerMeter: true,
        imageUrl: true,
        category: true,
      },
    })
    console.log(`[Ametist PriceList] Проверка сохраненных данных (первые 3):`)
    sampleFabrics.forEach(f => {
      console.log(`[Ametist PriceList]   - ${f.collection} ${f.colorNumber}: цена=${f.price}, цена/м=${f.pricePerMeter}, категория=${f.category}, изображение=${f.imageUrl ? 'есть' : 'нет'}`)
    })
  }
  
  console.log(`[Ametist PriceList] ===============================`)

  return NextResponse.json({
    success: true,
    updated: totalUpdated,
    notFound,
    message: `Обновлено: ${totalUpdated}, не найдено: ${notFound}`,
  })
}

