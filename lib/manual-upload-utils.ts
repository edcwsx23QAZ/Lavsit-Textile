import { prisma } from '@/lib/prisma'
import { ParsedFabric } from './parsers/base-parser'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from './fabric-categories'

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

  // Создаем ключи для сравнения
  const existingKeys = new Set(
    existingFabrics.map(f => `${f.collection}|${f.colorNumber}`)
  )
  const parsedKeys = new Set(
    parsedFabrics.map(f => `${f.collection}|${f.colorNumber}`)
  )

  // Если количество изменилось, обновляем
  if (existingKeys.size !== parsedKeys.size) {
    return true
  }

  // Проверяем, изменились ли данные по наличию или метражу
  for (const parsed of parsedFabrics) {
    const key = `${parsed.collection}|${parsed.colorNumber}`
    const existing = existingFabrics.find(
      f => `${f.collection}|${f.colorNumber}` === key
    )

    if (!existing) {
      // Новая ткань - обновляем
      return true
    }

    // Сравниваем наличие и метраж
    if (existing.inStock !== parsed.inStock) {
      return true
    }

    if (existing.meterage !== parsed.meterage) {
      return true
    }
  }

  // Данные не изменились - не обновляем
  return false
}

/**
 * Обновляет ткани из парсера, учитывая ручные загрузки
 */
export async function updateFabricsFromParser(
  supplierId: string,
  parsedFabrics: ParsedFabric[]
): Promise<number> {
  // Получаем категории
  const categories = await prisma.fabricCategory.findMany({
    orderBy: { price: 'asc' },
  })
  const categoryList = categories.length > 0
    ? categories.map(cat => ({ category: cat.category, price: cat.price }))
    : DEFAULT_CATEGORIES

  // Проверяем, нужно ли обновлять
  const shouldUpdate = await shouldUpdateFromParser(supplierId, parsedFabrics)

  if (!shouldUpdate) {
    console.log(`[manual-upload] Данные не изменились, пропускаем обновление из парсера`)
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

  // Обновляем ткани
  let updated = 0
  for (const fabric of parsedFabrics) {
    // Вычисляем цену за мп и категорию
    const pricePerMeter = calculatePricePerMeter(fabric.price, fabric.meterage)
    const category = getCategoryByPrice(pricePerMeter, categoryList)

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
    updated++
  }

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


