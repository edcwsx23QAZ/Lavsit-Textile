import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// GET - получить все исключения
export async function GET() {
  try {
    console.log('[GET /api/exclusions] Загрузка исключений...')
    let excludedFabrics: any[]
    
    // Пробуем сначала через Prisma ORM
    try {
      excludedFabrics = await prisma.fabric.findMany({
        where: {
          excludedFromParsing: true,
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [
          { supplier: { name: 'asc' } },
          { collection: 'asc' },
          { colorNumber: 'asc' },
        ],
      })
    } catch (prismaError: any) {
      // Если Prisma не знает о поле, используем raw SQL
      if (prismaError.message?.includes('excludedFromParsing') || prismaError.message?.includes('Unknown argument')) {
        console.log('Using raw SQL fallback for GET exclusions')
        // Для SQLite используем правильный синтаксис
        const rawResults = await prisma.$queryRaw<Array<{
          id: string
          collection: string
          colorNumber: string
          excludedFromParsing: number
          supplierId: string
          supplierName: string
        }>>`
          SELECT 
            f.id,
            f.collection,
            f.colorNumber,
            f.excludedFromParsing,
            s.id as supplierId,
            s.name as supplierName
          FROM Fabric f
          INNER JOIN Supplier s ON f.supplierId = s.id
          WHERE f.excludedFromParsing = 1
          ORDER BY s.name ASC, f.collection ASC, f.colorNumber ASC
        `
        
        excludedFabrics = rawResults.map(row => ({
          id: row.id,
          collection: row.collection,
          colorNumber: row.colorNumber,
          excludedFromParsing: row.excludedFromParsing === 1,
          supplier: {
            id: row.supplierId,
            name: row.supplierName,
          },
        }))
      } else {
        throw prismaError
      }
    }

    // Группируем по поставщику -> коллекции -> цвету
    const grouped: Record<string, Record<string, Array<{
      id: string
      colorNumber: string
      excludedFromParsing: boolean
    }>>> = {}

    excludedFabrics.forEach(fabric => {
      const supplierKey = `${fabric.supplier.id}|${fabric.supplier.name}`
      if (!grouped[supplierKey]) {
        grouped[supplierKey] = {}
      }
      if (!grouped[supplierKey][fabric.collection]) {
        grouped[supplierKey][fabric.collection] = []
      }
      grouped[supplierKey][fabric.collection].push({
        id: fabric.id,
        colorNumber: fabric.colorNumber,
        excludedFromParsing: fabric.excludedFromParsing ?? true,
      })
    })

    return NextResponse.json({ exclusions: grouped })
  } catch (error: any) {
    console.error('[GET /api/exclusions] Error fetching exclusions:', error)
    console.error('[GET /api/exclusions] Error name:', error?.name)
    console.error('[GET /api/exclusions] Error message:', error?.message)
    console.error('[GET /api/exclusions] Error stack:', error?.stack)
    
    const errorMessage = error?.message || 'Unknown error'
    let errorDetails = errorMessage
    
    if (errorMessage.includes('SQLITE_BUSY') || errorMessage.includes('database is locked')) {
      errorDetails = 'База данных заблокирована. Попробуйте еще раз.'
    } else if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
      errorDetails = 'Превышено время ожидания ответа от базы данных.'
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch exclusions',
        details: errorDetails
      },
      { status: 500 }
    )
  }
}

// POST - создать исключение (для цвета или коллекции)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { supplierId, collection, colorNumber, excludeCollection } = body

    if (!supplierId || !collection) {
      return NextResponse.json(
        { error: 'supplierId and collection are required' },
        { status: 400 }
      )
    }

    if (excludeCollection) {
      // Исключаем всю коллекцию
      // Получаем все ткани поставщика и фильтруем в памяти для точного совпадения
      const allFabrics = await prisma.fabric.findMany({
        where: { supplierId },
        select: { id: true, collection: true },
      })
      
      const normalizedCollection = collection.trim().toLowerCase()
      const matchingFabrics = allFabrics.filter(f => 
        f.collection.trim().toLowerCase() === normalizedCollection
      )
      
      if (matchingFabrics.length === 0) {
        return NextResponse.json({ 
          message: `Collection "${collection}" not found`,
          count: 0 
        })
      }
      
      // Обновляем каждую ткань отдельно, чтобы избежать проблем с Prisma Client
      // Используем raw SQL как запасной вариант, если Prisma Client не знает о поле
      let updatedCount = 0
      for (const fabric of matchingFabrics) {
        try {
          // Пробуем сначала через Prisma ORM
          try {
            await prisma.fabric.update({
              where: { id: fabric.id },
              data: {
                excludedFromParsing: true,
              },
            })
            updatedCount++
          } catch (prismaError: any) {
            // Если Prisma не знает о поле, используем raw SQL
            if (prismaError.message?.includes('excludedFromParsing') || prismaError.message?.includes('Unknown argument')) {
              await prisma.$executeRaw`
                UPDATE Fabric SET excludedFromParsing = 1 WHERE id = ${fabric.id}
              `
              updatedCount++
            } else {
              throw prismaError
            }
          }
        } catch (error: any) {
          console.error(`Error updating fabric ${fabric.id}:`, error)
        }
      }
      
      const result = { count: updatedCount }
      
      return NextResponse.json({ 
        message: `Excluded collection "${collection}" (${result.count} fabrics)`,
        count: result.count 
      })
    } else {
      // Исключаем конкретный цвет
      if (!colorNumber) {
        return NextResponse.json(
          { error: 'colorNumber is required when excluding a color' },
          { status: 400 }
        )
      }
      
      // Получаем все ткани поставщика и фильтруем в памяти для точного совпадения
      const allFabrics = await prisma.fabric.findMany({
        where: { supplierId },
        select: { id: true, collection: true, colorNumber: true },
      })
      
      const normalizedCollection = collection.trim().toLowerCase()
      const normalizedColor = colorNumber.trim().toLowerCase()
      
      const matchingFabrics = allFabrics.filter(f => 
        f.collection.trim().toLowerCase() === normalizedCollection &&
        f.colorNumber.trim().toLowerCase() === normalizedColor
      )
      
      if (matchingFabrics.length === 0) {
        return NextResponse.json({ 
          message: `Color "${colorNumber}" in collection "${collection}" not found`,
          count: 0 
        })
      }
      
      // Обновляем каждую ткань отдельно, чтобы избежать проблем с Prisma Client
      // Используем raw SQL как запасной вариант, если Prisma Client не знает о поле
      let updatedCount = 0
      for (const fabric of matchingFabrics) {
        try {
          // Пробуем сначала через Prisma ORM
          try {
            await prisma.fabric.update({
              where: { id: fabric.id },
              data: {
                excludedFromParsing: true,
              },
            })
            updatedCount++
          } catch (prismaError: any) {
            // Если Prisma не знает о поле, используем raw SQL
            if (prismaError.message?.includes('excludedFromParsing') || prismaError.message?.includes('Unknown argument')) {
              await prisma.$executeRaw`
                UPDATE Fabric SET excludedFromParsing = 1 WHERE id = ${fabric.id}
              `
              updatedCount++
            } else {
              throw prismaError
            }
          }
        } catch (error: any) {
          console.error(`Error updating fabric ${fabric.id}:`, error)
        }
      }
      
      const result = { count: updatedCount }
      
      return NextResponse.json({ 
        message: `Excluded color "${colorNumber}" from collection "${collection}"`,
        count: result.count 
      })
    }
  } catch (error: any) {
    console.error('Error creating exclusion:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create exclusion' },
      { status: 500 }
    )
  }
}

// PATCH - обновить статус исключения (снять или установить)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { fabricIds, excludedFromParsing } = body

    if (!Array.isArray(fabricIds) || fabricIds.length === 0) {
      return NextResponse.json(
        { error: 'fabricIds array is required' },
        { status: 400 }
      )
    }

    if (typeof excludedFromParsing !== 'boolean') {
      return NextResponse.json(
        { error: 'excludedFromParsing boolean is required' },
        { status: 400 }
      )
    }

    // Обновляем каждую ткань отдельно, чтобы избежать проблем с Prisma Client
    // Используем raw SQL как запасной вариант, если Prisma Client не знает о поле
    let updatedCount = 0
    for (const fabricId of fabricIds) {
      try {
        // Пробуем сначала через Prisma ORM
        try {
          await prisma.fabric.update({
            where: { id: fabricId },
            data: {
              excludedFromParsing,
            },
          })
          updatedCount++
        } catch (prismaError: any) {
          // Если Prisma не знает о поле, используем raw SQL
          if (prismaError.message?.includes('excludedFromParsing') || prismaError.message?.includes('Unknown argument')) {
            const value = excludedFromParsing ? 1 : 0
            await prisma.$executeRaw`
              UPDATE Fabric SET excludedFromParsing = ${value} WHERE id = ${fabricId}
            `
            updatedCount++
          } else {
            throw prismaError
          }
        }
      } catch (error: any) {
        console.error(`Error updating fabric ${fabricId}:`, error)
      }
    }

    return NextResponse.json({ 
      message: `Updated ${updatedCount} fabrics`,
      count: updatedCount 
    })
  } catch (error: any) {
    console.error('Error updating exclusions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update exclusions' },
      { status: 500 }
    )
  }
}






