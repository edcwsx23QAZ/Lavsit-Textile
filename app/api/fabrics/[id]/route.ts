import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'
import { normalizePrice } from '@/lib/price-normalization'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const fabricId = params.id
    const body = await request.json()
    
    const { price, fabricType, description, category, inStock, pricePerMeter } = body

    // Получаем текущую ткань
    const existingFabric = await prisma.fabric.findUnique({
      where: { id: fabricId },
    })

    if (!existingFabric) {
      return NextResponse.json(
        { error: 'Fabric not found' },
        { status: 404 }
      )
    }

    // Подготавливаем данные для обновления
    const updateData: any = {}

    // Обновляем цену, если указана
    if (price !== undefined) {
      // Нормализуем цену
      const normalizedPrice = price !== null && price !== '' ? normalizePrice(price) : null
      
      // Получаем категории для определения категории
      const categories = await prisma.fabricCategory.findMany({
        orderBy: { price: 'asc' },
      })
      const categoryList = categories.length > 0
        ? categories.map(cat => ({ category: cat.category, price: cat.price }))
        : DEFAULT_CATEGORIES
      
      // Вычисляем цену за метр погонный, если есть метраж
      const pricePerMeter = calculatePricePerMeter(normalizedPrice, existingFabric.meterage)
      
      // Определяем категорию
      // Если есть pricePerMeter, используем его, иначе используем саму цену (предполагаем, что цена за метр)
      let category = null
      if (pricePerMeter) {
        category = getCategoryByPrice(pricePerMeter, categoryList)
      } else if (normalizedPrice) {
        category = getCategoryByPrice(normalizedPrice, categoryList)
      }

      updateData.price = normalizedPrice
      updateData.pricePerMeter = pricePerMeter
      updateData.category = category
    }

    // Обновляем тип ткани, если указан
    if (fabricType !== undefined) {
      updateData.fabricType = fabricType === '' ? null : fabricType
    }

    // Обновляем описание, если указано
    if (description !== undefined) {
      updateData.description = description === '' ? null : description
    }

    // Обновляем дату последнего изменения
    updateData.lastUpdatedAt = new Date()

    // Обновляем ткань
    const updatedFabric = await prisma.fabric.update({
      where: { id: fabricId },
      data: updateData,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
          },
        },
      },
    })

    return NextResponse.json(updatedFabric)
  } catch (error: any) {
    console.error('Error updating fabric:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update fabric' },
      { status: 500 }
    )
  }
}

