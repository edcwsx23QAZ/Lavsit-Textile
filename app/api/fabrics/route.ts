import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const collection = searchParams.get('collection')
    const search = searchParams.get('search')

    const where: any = {}

    if (supplierId) {
      where.supplierId = supplierId
    }

    if (collection) {
      where.collection = collection
    }

    if (search) {
      where.OR = [
        { collection: { contains: search, mode: 'insensitive' } },
        { colorNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Получаем категории из БД или используем значения по умолчанию
    let categories: any[] = []
    try {
      categories = await prisma.fabricCategory.findMany({
        orderBy: { price: 'asc' },
      })
    } catch (error) {
      // Если таблица категорий еще не создана, используем значения по умолчанию
      console.log('[fabrics] FabricCategory table not found, using defaults')
    }

    const categoryList = categories.length > 0
      ? categories.map(cat => ({ category: cat.category, price: cat.price }))
      : DEFAULT_CATEGORIES

    const fabrics = await prisma.fabric.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
          },
        },
      },
      orderBy: [
        { supplier: { name: 'asc' } },
        { collection: 'asc' },
        { colorNumber: 'asc' },
      ],
    })

    // Вычисляем цену за мп и категорию для каждой ткани
    const fabricsWithCalculations = fabrics.map((fabric: any) => {
      // Вычисляем цену за метр погонный, если не задана
      // Используем безопасный доступ к полям, которые могут отсутствовать
      let pricePerMeter = fabric.pricePerMeter || null
      if (!pricePerMeter && fabric.price && fabric.meterage) {
        pricePerMeter = calculatePricePerMeter(fabric.price, fabric.meterage)
      }

      // Определяем категорию, если не задана
      let category = fabric.category || null
      if (!category && pricePerMeter) {
        category = getCategoryByPrice(pricePerMeter, categoryList)
      }

      return {
        ...fabric,
        pricePerMeter,
        category,
      }
    })

    return NextResponse.json(fabricsWithCalculations)
  } catch (error: any) {
    console.error('Error fetching fabrics:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { 
        error: 'Failed to fetch fabrics',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}

