import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { calculatePricePerMeter, getCategoryByPrice, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

// Отключаем static generation для API route
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const collection = searchParams.get('collection')
    const search = searchParams.get('search')

    const where: any = {
      excludedFromParsing: false,
    }

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

    // Прямая загрузка данных из БД - никакого кэширования
    const fabrics = await prisma.fabric.findMany({
      where,
      select: {
        id: true,
        supplierId: true,
        collection: true,
        colorNumber: true,
        inStock: true,
        meterage: true,
        price: true,
        pricePerMeter: true,
        category: true,
        imageUrl: true,
        fabricType: true,
        description: true,
        lastUpdatedAt: true,
        nextArrivalDate: true,
        comment: true,
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

    // Вычисляем pricePerMeter и category на сервере
    const categoryList = DEFAULT_CATEGORIES
    const fabricsWithCalculations = fabrics.map((fabric: any) => {
      let pricePerMeter = fabric.pricePerMeter
      if (!pricePerMeter && fabric.price && fabric.meterage && fabric.meterage > 0) {
        pricePerMeter = calculatePricePerMeter(fabric.price, fabric.meterage)
      }

      let category = fabric.category
      if (!category && pricePerMeter) {
        category = getCategoryByPrice(pricePerMeter, categoryList) || null
      }

      return {
        ...fabric,
        pricePerMeter: pricePerMeter || null,
        category: category || null,
      }
    })

    return NextResponse.json(fabricsWithCalculations)
  } catch (error: any) {
    console.error('[GET /api/fabrics] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch fabrics' },
      { status: 500 }
    )
  }
}





