import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'
import { normalizePrice } from '@/lib/price-normalization'

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { supplierId, collection, data, applyToAll } = body

    if (!supplierId || !collection) {
      return NextResponse.json(
        { error: 'supplierId and collection are required' },
        { status: 400 }
      )
    }

    // Получаем категории для определения категории при обновлении цены
    const categories = await prisma.fabricCategory.findMany({
      orderBy: { price: 'asc' },
    })
    const categoryList = categories.length > 0
      ? categories.map(cat => ({ category: cat.category, price: cat.price }))
      : DEFAULT_CATEGORIES

    // Подготавливаем данные для обновления
    const updateData: any = {
      lastUpdatedAt: new Date(),
    }

    if (applyToAll) {
      // Применяем все изменения ко всем цветам
      if (data.fabricType !== undefined) {
        updateData.fabricType = data.fabricType
      }
      if (data.description !== undefined) {
        updateData.description = data.description
      }
      // Цена и категория будут обработаны индивидуально для каждой ткани ниже
    } else {
      // Применяем только описание
      if (data.description !== undefined) {
        updateData.description = data.description
      }
    }

    // Находим все ткани этой коллекции (без учета регистра)
    // Получаем все ткани поставщика и фильтруем в памяти
    const allFabrics = await prisma.fabric.findMany({
      where: { supplierId },
    })
    
    const fabrics = allFabrics.filter(f => 
      f.collection.trim().toLowerCase() === collection.trim().toLowerCase()
    )

    if (fabrics.length === 0) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Обновляем ткани
    let updated = 0
    for (const fabric of fabrics) {
      const fabricUpdateData: any = { ...updateData }

      // Если применяем все изменения и указана цена, пересчитываем pricePerMeter и category
      if (applyToAll && data.price !== undefined && data.price !== null && data.price !== '') {
        const normalizedPrice = normalizePrice(data.price)
        if (normalizedPrice) {
          fabricUpdateData.price = normalizedPrice
          
          // Пересчитываем pricePerMeter, если есть метраж
          if (fabric.meterage) {
            fabricUpdateData.pricePerMeter = calculatePricePerMeter(normalizedPrice, fabric.meterage)
            
            // Если категория не указана напрямую, определяем её по цене за метр
            if (data.category === undefined || data.category === null || data.category === '') {
              fabricUpdateData.category = getCategoryByPrice(fabricUpdateData.pricePerMeter, categoryList)
            } else {
              fabricUpdateData.category = parseInt(String(data.category))
            }
          } else {
            // Если метража нет, используем категорию напрямую (если указана)
            if (data.category !== undefined && data.category !== null && data.category !== '') {
              fabricUpdateData.category = parseInt(String(data.category))
            }
          }
        }
      } else if (applyToAll && data.category !== undefined && data.category !== null && data.category !== '') {
        // Если указана категория без цены, просто обновляем категорию
        fabricUpdateData.category = parseInt(String(data.category))
      }

      await prisma.fabric.update({
        where: { id: fabric.id },
        data: fabricUpdateData,
      })
      updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      message: `Обновлено тканей: ${updated}`,
    })
  } catch (error: any) {
    console.error('Error updating collection:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update collection' },
      { status: 500 }
    )
  }
}






