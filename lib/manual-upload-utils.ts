import { prisma } from '@/lib/db/prisma'
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

    // Детальное сравнение метража с логированием для RETRO organza
    // ВАЖНО: Сравниваем с учетом возможных различий в типах (null vs undefined) и округления
    const existingMeterage = existing.meterage ?? null
    const parsedMeterage = parsed.meterage ?? null
    
    // Сравниваем с учетом небольшой погрешности для чисел с плавающей точкой
    let meterageChanged = false
    if (existingMeterage === null && parsedMeterage === null) {
      meterageChanged = false
    } else if (existingMeterage === null || parsedMeterage === null) {
      meterageChanged = true
    } else {
      // Сравниваем числа с учетом небольшой погрешности (0.01)
      meterageChanged = Math.abs(existingMeterage - parsedMeterage) > 0.01
    }
    
    if (parsed.collection.toLowerCase().includes('retro') || parsed.colorNumber.toLowerCase().includes('organza') || parsed.colorNumber.toLowerCase().includes('retro')) {
      console.log(`[shouldUpdateFromParser] ===== СРАВНЕНИЕ МЕТРАЖА для "${parsed.collection}" - "${parsed.colorNumber}" =====`)
      console.log(`[shouldUpdateFromParser] Текущее значение в БД: ${existingMeterage} (тип: ${typeof existingMeterage})`)
      console.log(`[shouldUpdateFromParser] Значение из парсера: ${parsedMeterage} (тип: ${typeof parsedMeterage})`)
      console.log(`[shouldUpdateFromParser] Разница: ${existingMeterage !== null && parsedMeterage !== null ? Math.abs(existingMeterage - parsedMeterage) : 'N/A'}`)
      console.log(`[shouldUpdateFromParser] Значения равны? ${!meterageChanged}`)
      console.log(`[shouldUpdateFromParser] ==========================================`)
    }
    
    if (meterageChanged) {
      console.log(`[shouldUpdateFromParser] Изменился метраж для ${parsed.collection}|${parsed.colorNumber}: было ${existingMeterage}, стало ${parsedMeterage}`)
      return true
    }
  }

  // Данные не изменились - не обновляем
  console.log(`[shouldUpdateFromParser] Данные не изменились, пропускаем обновление`)
  return false
}

/**
 * Проверяет, были ли данные (meterage или inStock) вписаны вручную
 * Возвращает true, если есть активная ручная загрузка типа "stock"
 */
async function hasManualStockData(supplierId: string): Promise<boolean> {
  const activeStockUpload = await prisma.manualUpload.findFirst({
    where: {
      supplierId,
      type: 'stock',
      isActive: true,
    },
  })
  return !!activeStockUpload
}

/**
 * Проверяет, нужно ли обновлять ручные данные
 * Обновляем только если парсер нашел новое значение (не null/undefined)
 * Отсутствие данных в парсере (null/undefined) не является новым значением
 */
function shouldUpdateManualData(
  parsedFabric: ParsedFabric,
  existingFabric: { meterage: number | null; inStock: boolean | null }
): boolean {
  // Если парсер нашел новое значение наличия (не null/undefined)
  if (parsedFabric.inStock !== null && parsedFabric.inStock !== undefined) {
    // Обновляем, если значение изменилось
    if (existingFabric.inStock !== parsedFabric.inStock) {
      return true
    }
  }
  
  // Если парсер нашел новое значение метража (не null/undefined)
  if (parsedFabric.meterage !== null && parsedFabric.meterage !== undefined) {
    // Обновляем, если значение изменилось (с учетом погрешности)
    const existingMeterage = existingFabric.meterage ?? null
    if (existingMeterage === null) {
      return true // Было null, стало число - обновляем
    }
    // Сравниваем с учетом погрешности
    if (Math.abs(existingMeterage - parsedFabric.meterage) > 0.01) {
      return true
    }
  }
  
  return false
}

/**
 * Обновляет ткани из парсера, учитывая ручные загрузки
 * 
 * Логика обновления:
 * 1. При новом парсинге старые данные удаляются или обновляются
 * 2. Исключение - ткани с ручными данными (если есть активная ManualUpload)
 * 3. Ручные данные обновляются только если парсер нашел новое значение
 *    (отсутствие данных в парсере не является новым значением)
 */
export async function updateFabricsFromParser(
  supplierId: string,
  parsedFabrics: ParsedFabric[]
): Promise<number> {
  console.log(`[updateFabricsFromParser] Начало обновления для supplierId: ${supplierId}, тканей: ${parsedFabrics.length}`)
  
  if (parsedFabrics.length === 0) {
    console.log(`[updateFabricsFromParser] ⚠️ ВНИМАНИЕ: Парсер вернул 0 тканей!`)
    // Если парсер вернул 0 тканей, удаляем все старые данные (кроме ручных)
    const hasManual = await hasManualStockData(supplierId)
    if (!hasManual) {
      console.log(`[updateFabricsFromParser] Нет ручных данных, удаляем все ткани поставщика`)
      const deletedCount = await prisma.fabric.deleteMany({
        where: {
          supplierId,
          excludedFromParsing: false,
        },
      })
      console.log(`[updateFabricsFromParser] Удалено тканей: ${deletedCount.count}`)
      return 0
    } else {
      console.log(`[updateFabricsFromParser] Есть ручные данные, не удаляем ткани`)
      return 0
    }
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

  // Функция нормализации ключа (определяем один раз)
  const normalizeKey = (collection: string, color: string) => {
    return `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
  }

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
  const excludedKeys = new Set(
    excludedFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
  )

  // Проверяем, есть ли ручные данные
  const hasManual = await hasManualStockData(supplierId)
  console.log(`[updateFabricsFromParser] Есть ручные данные: ${hasManual}`)
  
  // Получаем все существующие ткани поставщика (для удаления тех, которых нет в парсинге)
  const allExistingFabrics = await prisma.fabric.findMany({
    where: { 
      supplierId,
      excludedFromParsing: false,
    },
    select: {
      id: true,
      collection: true,
      colorNumber: true,
      meterage: true,
      inStock: true,
      price: true,
      pricePerMeter: true,
      category: true,
      fabricType: true,
      description: true,
    },
  })
  
  // Создаем Set ключей из парсера для быстрой проверки
  const parsedKeys = new Set(
    parsedFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
  )
  
  // Удаляем ткани, которых нет в новом парсинге
  // ВАЖНО: удаляем всегда, независимо от наличия ручных данных (как указано в требованиях)
  const fabricsToDelete = allExistingFabrics.filter(f => {
    const key = normalizeKey(f.collection, f.colorNumber)
    return !parsedKeys.has(key) && !excludedKeys.has(key)
  })
  
  if (fabricsToDelete.length > 0) {
    console.log(`[updateFabricsFromParser] Удаляем ${fabricsToDelete.length} тканей, которых нет в новом парсинге`)
    const deletedIds = fabricsToDelete.map(f => f.id)
    await prisma.fabric.deleteMany({
      where: {
        id: { in: deletedIds },
      },
    })
    console.log(`[updateFabricsFromParser] Удалено тканей: ${deletedIds.length}`)
  }
  
  // Обновляем ткани
  let updated = 0
  let created = 0
  let updatedExisting = 0
  let errors = 0
  let skipped = 0
  let skippedManual = 0
  
  console.log(`[updateFabricsFromParser] Начинаем обработку ${parsedFabrics.length} тканей...`)
  console.log(`[updateFabricsFromParser] Исключено из парсинга: ${excludedKeys.size} тканей`)
  
  // Логируем все ткани с RETRO или organza из парсера
  const retroFabrics = parsedFabrics.filter(f => 
    f.collection.toLowerCase().includes('retro') || 
    f.colorNumber.toLowerCase().includes('organza') || 
    f.colorNumber.toLowerCase().includes('retro')
  )
  if (retroFabrics.length > 0) {
    console.log(`[updateFabricsFromParser] ===== НАЙДЕНЫ ТКАНИ С RETRO/ORGANZA В ПАРСЕРЕ =====`)
    retroFabrics.forEach(f => {
      console.log(`[updateFabricsFromParser] "${f.collection}" - "${f.colorNumber}": метраж = ${f.meterage}, в наличии = ${f.inStock}`)
    })
    console.log(`[updateFabricsFromParser] ==========================================`)
  }
  
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

    // Ищем существующую ткань
    const normalizedCollection = fabric.collection.trim().toLowerCase()
    const normalizedColor = fabric.colorNumber.trim().toLowerCase()
    
    const existing = allExistingFabrics.find(f => 
      f.collection.trim().toLowerCase() === normalizedCollection &&
      f.colorNumber.trim().toLowerCase() === normalizedColor
    )
    
    // Детальное логирование для RETRO organza blue при поиске
    if (fabric.collection.toLowerCase().includes('retro') || fabric.colorNumber.toLowerCase().includes('organza') || fabric.colorNumber.toLowerCase().includes('retro')) {
      console.log(`[updateFabricsFromParser] ===== ПОИСК "${fabric.collection}" - "${fabric.colorNumber}" =====`)
      console.log(`[updateFabricsFromParser] Нормализованные значения: коллекция="${normalizedCollection}", цвет="${normalizedColor}"`)
      console.log(`[updateFabricsFromParser] Всего тканей в БД для этого поставщика: ${allExistingFabrics.length}`)
      if (existing) {
        console.log(`[updateFabricsFromParser] ✅ Ткань найдена в БД: id=${existing.id}, коллекция="${existing.collection}", цвет="${existing.colorNumber}"`)
      } else {
        console.log(`[updateFabricsFromParser] ⚠️ Ткань НЕ найдена в БД, будет создана новая`)
        // Показываем похожие ткани для отладки
        const similar = allExistingFabrics.filter(f => 
          f.colorNumber.trim().toLowerCase().includes('organza') || 
          f.colorNumber.trim().toLowerCase().includes('retro')
        )
        if (similar.length > 0) {
          console.log(`[updateFabricsFromParser] Похожие ткани в БД:`)
          similar.slice(0, 5).forEach(f => {
            console.log(`  - "${f.collection}" - "${f.colorNumber}"`)
          })
        }
      }
      console.log(`[updateFabricsFromParser] ==========================================`)
    }

    // Валидируем дату перед сохранением
    const validNextArrivalDate = validateDate(fabric.nextArrivalDate)

    if (existing) {
      try {
        // Детальное логирование для RETRO organza blue
        if (fabric.collection.toLowerCase().includes('retro') || fabric.colorNumber.toLowerCase().includes('organza') || fabric.colorNumber.toLowerCase().includes('retro')) {
          console.log(`[updateFabricsFromParser] ===== ОБНОВЛЕНИЕ "${fabric.collection}" - "${fabric.colorNumber}" =====`)
          console.log(`[updateFabricsFromParser] Значение метража из парсера: ${fabric.meterage} (тип: ${typeof fabric.meterage})`)
          console.log(`[updateFabricsFromParser] Текущее значение в БД: метраж=${existing.meterage}, в наличии=${existing.inStock}`)
          console.log(`[updateFabricsFromParser] Новое значение метража из парсера: ${fabric.meterage}`)
          console.log(`[updateFabricsFromParser] ==========================================`)
        }
        
        // Обновляем данные согласно требованиям:
        // 1. Данные перезаписываются при каждом новом парсинге
        // 2. Если при парсинге были пустые ячейки (цена, категория, тип, описание), а в базе была ручная запись - сохраняется ручная запись
        // 3. Если ячейки не пустые и влекут изменение - записываются данные парсинга
        
        // Метраж: определяем финальное значение метража (из парсера или из базы)
        let finalMeterage: number | null = null
        if (fabric.meterage !== null && fabric.meterage !== undefined) {
          finalMeterage = fabric.meterage
        } else if (hasManual) {
          finalMeterage = existing.meterage
        }
        
        // Детальное логирование для Viptextil
        if (fabric.collection && fabric.collection.length > 0) {
          console.log(`[updateFabricsFromParser] Обновление ткани: "${fabric.collection}" - "${fabric.colorNumber}"`)
          console.log(`[updateFabricsFromParser]   - inStock: парсер=${fabric.inStock}, финальное=${updateData.inStock}`)
          console.log(`[updateFabricsFromParser]   - метраж: парсер=${fabric.meterage}, финальное=${finalMeterage}`)
        }
        
        // Автоматически добавляем комментарий для тканей с метражом < 10
        let finalComment = fabric.comment || null
        if (finalMeterage !== null && finalMeterage < 10) {
          const warningComment = 'ВНИМАНИЕ, МАЛО!'
          if (finalComment) {
            // Если уже есть комментарий, добавляем предупреждение в начало, если его там нет
            if (!finalComment.includes(warningComment)) {
              finalComment = `${warningComment} ${finalComment}`
            }
          } else {
            finalComment = warningComment
          }
        }
        
        const updateData: any = {
          nextArrivalDate: validNextArrivalDate,
          comment: finalComment,
          lastUpdatedAt: new Date(),
        }
        
        // Цена: если парсер вернул значение - используем его (перезаписываем), иначе сохраняем существующее (ручное)
        if (normalizedPrice !== null && normalizedPrice !== undefined) {
          updateData.price = normalizedPrice
          updateData.pricePerMeter = pricePerMeter
          updateData.category = category
        } else {
          // Если цена пустая в парсинге, сохраняем существующие значения (ручные данные)
          updateData.price = existing.price ?? null
          updateData.pricePerMeter = existing.pricePerMeter ?? null
          updateData.category = existing.category ?? null
        }
        
        // Тип ткани и описание: парсер не возвращает эти поля (устанавливаются только вручную через UI)
        // Поэтому всегда сохраняем существующие значения
        updateData.fabricType = existing.fabricType ?? null
        updateData.description = existing.description ?? null
        
        // Наличие: если парсер вернул значение - используем его, иначе сохраняем существующее (если есть ручные данные)
        if (fabric.inStock !== null && fabric.inStock !== undefined) {
          updateData.inStock = fabric.inStock
        } else if (hasManual) {
          // Если есть ручные данные и парсер не вернул значение - сохраняем существующее
          updateData.inStock = existing.inStock
        } else {
          // Если нет ручных данных и парсер не вернул значение - оставляем null
          updateData.inStock = null
        }
        
        // Метраж: используем финальное значение
        updateData.meterage = finalMeterage
        
        await prisma.fabric.update({
          where: { id: existing.id },
          data: updateData,
        })
        updated++
        updatedExisting++
        if (updatedExisting <= 5) {
          console.log(`[updateFabricsFromParser] Обновлена ткань: ${fabric.collection} ${fabric.colorNumber} (${fabric.inStock ? 'в наличии' : 'не в наличии'}), метраж: ${fabric.meterage}`)
        }
      } catch (error: any) {
        errors++
        console.error(`[updateFabricsFromParser] Ошибка обновления ткани ${fabric.collection} ${fabric.colorNumber}:`, error.message)
      }
    } else {
      try {
        // Автоматически добавляем комментарий для тканей с метражом < 10
        let finalComment = fabric.comment || null
        if (fabric.meterage !== null && fabric.meterage !== undefined && fabric.meterage < 10) {
          const warningComment = 'ВНИМАНИЕ, МАЛО!'
          if (finalComment) {
            finalComment = finalComment.includes(warningComment) 
              ? finalComment 
              : `${warningComment} ${finalComment}`
          } else {
            finalComment = warningComment
          }
        }
        
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
            comment: finalComment,
          },
        })
        updated++
        created++
        if (created <= 5) {
          console.log(`[updateFabricsFromParser] Создана ткань: ${fabric.collection} ${fabric.colorNumber} (${fabric.inStock ? 'в наличии' : 'не в наличии'}), метраж: ${fabric.meterage}`)
        }
        
        // Детальное логирование для RETRO organza blue при создании
        if (fabric.collection.toLowerCase().includes('retro') || fabric.colorNumber.toLowerCase().includes('organza') || fabric.colorNumber.toLowerCase().includes('retro')) {
          console.log(`[updateFabricsFromParser] ===== СОЗДАНИЕ "${fabric.collection}" - "${fabric.colorNumber}" =====`)
          console.log(`[updateFabricsFromParser] Значение метража из парсера: ${fabric.meterage} (тип: ${typeof fabric.meterage})`)
          console.log(`[updateFabricsFromParser] ==========================================`)
        }
      } catch (error: any) {
        errors++
        console.error(`[updateFabricsFromParser] Ошибка создания ткани ${fabric.collection} ${fabric.colorNumber}:`, error.message)
        console.error(`[updateFabricsFromParser] Stack:`, error.stack)
      }
    }
  }
  
  console.log(`[updateFabricsFromParser] ════════════════════════════════════════════════════════`)
  console.log(`[updateFabricsFromParser] ИТОГО РЕЗУЛЬТАТЫ ОБРАБОТКИ:`)
  console.log(`[updateFabricsFromParser]   - Всего обработано: ${parsedFabrics.length}`)
  console.log(`[updateFabricsFromParser]   - Создано новых: ${created}`)
  console.log(`[updateFabricsFromParser]   - Обновлено существующих: ${updatedExisting}`)
  console.log(`[updateFabricsFromParser]   - Пропущено (исключено): ${skipped}`)
  console.log(`[updateFabricsFromParser]   - Пропущено (ручные данные): ${skippedManual}`)
  console.log(`[updateFabricsFromParser]   - Ошибок: ${errors}`)
  console.log(`[updateFabricsFromParser]   - Итого обновлено/создано: ${updated}`)
  
  // Проверяем итоговое количество тканей в базе
  const finalCount = await prisma.fabric.count({ where: { supplierId } })
  console.log(`[updateFabricsFromParser] Итоговое количество тканей в базе: ${finalCount}`)
  console.log(`[updateFabricsFromParser] ════════════════════════════════════════════════════════`)

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


