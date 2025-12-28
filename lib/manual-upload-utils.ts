import { prisma } from '@/lib/prisma'
import { ParsedFabric } from './parsers/base-parser'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from './fabric-categories'
import { validateDate } from './date-validation'

/**
 * Проверяет, нужно ли обновлять данные из парсера, учитывая активные ручные загрузки
 */
export async function shouldUpdateFromParser(
  supplierId: string,
  parsedFabrics: ParsedFabric[]
): Promise<boolean> {
  // Проверяем наличие активной ручной загрузки наличия
  const activeStockUpload = await prisma.manualUpload.findFirst({
    where: {
      supplierId,
      type: 'stock',
      isActive: true,
    },
  })

  if (!activeStockUpload) {
    // Нет активной ручной загрузки - обновляем
    console.log(`[shouldUpdateFromParser] Нет активной ручной загрузки, обновляем`)
    return true
  }
  
  console.log(`[shouldUpdateFromParser] Найдена активная ручная загрузка, проверяем изменения`)
  
  // ВАЖНО: Если это первый парсинг (в базе нет тканей), всегда обновляем
  const existingCount = await prisma.fabric.count({ where: { supplierId } })
  if (existingCount === 0 && parsedFabrics.length > 0) {
    console.log(`[shouldUpdateFromParser] В базе нет тканей (${existingCount}), но парсер вернул ${parsedFabrics.length} - обновляем`)
    return true
  }

  // Если есть активная ручная загрузка, проверяем, изменились ли данные
  // Сравниваем количество и основные поля тканей
  const existingFabrics = await prisma.fabric.findMany({
    where: { supplierId },
    select: {
      collection: true,
      colorNumber: true,
      inStock: true,
      meterage: true,
    },
  })

  // Создаем ключи для сравнения (нормализуем для сравнения)
  const normalizeKey = (collection: string, color: string) => {
    return `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
  }
  
  const existingKeys = new Set(
    existingFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
  )
  const parsedKeys = new Set(
    parsedFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
  )

  console.log(`[shouldUpdateFromParser] Сравнение: в базе ${existingKeys.size}, в парсинге ${parsedKeys.size}`)
  
  // Если тканей нет в базе, но есть в парсинге - обновляем
  if (existingKeys.size === 0 && parsedKeys.size > 0) {
    console.log(`[shouldUpdateFromParser] Тканей нет в базе, но есть в парсинге - обновляем`)
    return true
  }
  
  // Если количество изменилось, обновляем
  if (existingKeys.size !== parsedKeys.size) {
    console.log(`[shouldUpdateFromParser] Количество изменилось: было ${existingKeys.size}, стало ${parsedKeys.size}`)
    return true
  }

  // Проверяем, изменились ли данные по наличию или метражу
  for (const parsed of parsedFabrics) {
    const key = normalizeKey(parsed.collection, parsed.colorNumber)
    const existing = existingFabrics.find(
      f => normalizeKey(f.collection, f.colorNumber) === key
    )

    if (!existing) {
      // Новая ткань - обновляем
      console.log(`[shouldUpdateFromParser] Найдена новая ткань: ${parsed.collection}|${parsed.colorNumber}`)
      return true
    }

    // Сравниваем наличие и метраж
    if (existing.inStock !== parsed.inStock) {
      console.log(`[shouldUpdateFromParser] Изменилось наличие для ${parsed.collection}|${parsed.colorNumber}: было ${existing.inStock}, стало ${parsed.inStock}`)
      return true
    }

    if (existing.meterage !== parsed.meterage) {
      console.log(`[shouldUpdateFromParser] Изменился метраж для ${parsed.collection}|${parsed.colorNumber}: было ${existing.meterage}, стало ${parsed.meterage}`)
      return true
    }
  }

  // Данные не изменились - не обновляем
  console.log(`[shouldUpdateFromParser] Данные не изменились, пропускаем обновление`)
  return false
}

/**
 * Обновляет ткани из парсера, учитывая ручные загрузки
 */
export async function updateFabricsFromParser(
  supplierId: string,
  parsedFabrics: ParsedFabric[]
): Promise<number> {
  console.log(`[updateFabricsFromParser] Начало обновления для supplierId: ${supplierId}, тканей: ${parsedFabrics.length}`)
  
  if (parsedFabrics.length === 0) {
    console.log(`[updateFabricsFromParser] ⚠️ ВНИМАНИЕ: Парсер вернул 0 тканей!`)
    return 0
  }
  
  // Получаем категории
  const categories = await prisma.fabricCategory.findMany({
    orderBy: { price: 'asc' },
  })
  const categoryList = categories.length > 0
    ? categories.map(cat => ({ category: cat.category, price: cat.price }))
    : DEFAULT_CATEGORIES

  // Проверяем, нужно ли обновлять
  const shouldUpdate = await shouldUpdateFromParser(supplierId, parsedFabrics)
  console.log(`[updateFabricsFromParser] shouldUpdate: ${shouldUpdate}`)
  
  if (!shouldUpdate) {
    console.log(`[updateFabricsFromParser] ⚠️ Данные не изменились, но парсер вернул ${parsedFabrics.length} тканей. Проверяем детали...`)
    // Показываем примеры для диагностики
    if (parsedFabrics.length > 0) {
      console.log(`[updateFabricsFromParser] Примеры тканей из парсера:`, parsedFabrics.slice(0, 5).map(f => `${f.collection}|${f.colorNumber}|${f.inStock}`))
    }
    
    // Проверяем, действительно ли все ткани уже есть в базе
    const existingCount = await prisma.fabric.count({ where: { supplierId } })
    console.log(`[updateFabricsFromParser] Тканей в базе: ${existingCount}, в парсинге: ${parsedFabrics.length}`)
    
    // Если в базе меньше тканей, чем в парсинге - принудительно обновляем
    if (existingCount < parsedFabrics.length) {
      console.log(`[updateFabricsFromParser] ⚠️ В базе меньше тканей (${existingCount}) чем в парсинге (${parsedFabrics.length}), принудительно обновляем`)
      // Продолжаем обновление, не возвращаемся
    } else {
      console.log(`[updateFabricsFromParser] Данные не изменились, пропускаем обновление из парсера`)
      // Обновляем только lastParserUpdate для активных ручных загрузок
      await prisma.manualUpload.updateMany({
        where: {
          supplierId,
          type: 'stock',
          isActive: true,
        },
        data: {
          lastParserUpdate: new Date(),
        },
      })
      return 0
    }
  }

  // Импортируем утилиту нормализации цен один раз
  const { normalizePrice } = await import('@/lib/price-normalization')

  // Получаем список исключенных тканей для этого поставщика
  const excludedFabrics = await prisma.fabric.findMany({
    where: {
      supplierId,
      excludedFromParsing: true,
    },
    select: {
      collection: true,
      colorNumber: true,
    },
  })

  // Создаем Set для быстрой проверки исключений
  const normalizeKey = (collection: string, color: string) => {
    return `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
  }
  
  const excludedKeys = new Set(
    excludedFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
  )

  // Обновляем ткани
  let updated = 0
  let created = 0
  let updatedExisting = 0
  let errors = 0
  let skipped = 0
  
  console.log(`[updateFabricsFromParser] Начинаем обработку ${parsedFabrics.length} тканей...`)
  console.log(`[updateFabricsFromParser] Исключено из парсинга: ${excludedKeys.size} тканей`)
  
  for (const fabric of parsedFabrics) {
    // Проверяем, не исключена ли ткань из парсинга
    const fabricKey = normalizeKey(fabric.collection, fabric.colorNumber)
    if (excludedKeys.has(fabricKey)) {
      skipped++
      if (skipped <= 5) {
        console.log(`[updateFabricsFromParser] Пропущена исключенная ткань: ${fabric.collection} ${fabric.colorNumber}`)
      }
      continue
    }
    // Нормализуем цену к единому формату (рубли)
    const normalizedPrice = fabric.price !== null ? normalizePrice(fabric.price) : null
    
    // Вычисляем цену за мп и категорию
    const pricePerMeter = calculatePricePerMeter(normalizedPrice, fabric.meterage)
    const category = getCategoryByPrice(pricePerMeter, categoryList)

    // Ищем существующую ткань (без учета регистра и пробелов)
    // Получаем все ткани поставщика (кроме исключенных) и фильтруем в памяти для точного совпадения
    const allFabrics = await prisma.fabric.findMany({
      where: { 
        supplierId,
        excludedFromParsing: false, // Исключаем уже исключенные ткани из поиска
      },
      select: {
        id: true,
        collection: true,
        colorNumber: true,
      },
    })
    
    const normalizedCollection = fabric.collection.trim().toLowerCase()
    const normalizedColor = fabric.colorNumber.trim().toLowerCase()
    
    const existing = allFabrics.find(f => 
      f.collection.trim().toLowerCase() === normalizedCollection &&
      f.colorNumber.trim().toLowerCase() === normalizedColor
    )

    // Валидируем дату перед сохранением
    const validNextArrivalDate = validateDate(fabric.nextArrivalDate)

    if (existing) {
      try {
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
        updated++
        updatedExisting++
        if (updatedExisting <= 5) {
          console.log(`[updateFabricsFromParser] Обновлена ткань: ${fabric.collection} ${fabric.colorNumber} (${fabric.inStock ? 'в наличии' : 'не в наличии'})`)
        }
      } catch (error: any) {
        errors++
        console.error(`[updateFabricsFromParser] Ошибка обновления ткани ${fabric.collection} ${fabric.colorNumber}:`, error.message)
      }
    } else {
      try {
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
        updated++
        created++
        if (created <= 5) {
          console.log(`[updateFabricsFromParser] Создана ткань: ${fabric.collection} ${fabric.colorNumber} (${fabric.inStock ? 'в наличии' : 'не в наличии'})`)
        }
      } catch (error: any) {
        errors++
        console.error(`[updateFabricsFromParser] Ошибка создания ткани ${fabric.collection} ${fabric.colorNumber}:`, error.message)
        console.error(`[updateFabricsFromParser] Stack:`, error.stack)
      }
    }
  }
  
  console.log(`[updateFabricsFromParser] ИТОГО: обновлено/создано: ${updated} (создано: ${created}, обновлено: ${updatedExisting}, пропущено (исключено): ${skipped}, ошибок: ${errors})`)

  // Проверяем итоговое количество тканей в базе
  const finalCount = await prisma.fabric.count({ where: { supplierId } })
  console.log(`[updateFabricsFromParser] Итоговое количество тканей в базе: ${finalCount}`)

  // Обновляем lastParserUpdate для активных ручных загрузок
  await prisma.manualUpload.updateMany({
    where: {
      supplierId,
      type: 'stock',
      isActive: true,
    },
    data: {
      lastParserUpdate: new Date(),
    },
  })

  return updated
}


