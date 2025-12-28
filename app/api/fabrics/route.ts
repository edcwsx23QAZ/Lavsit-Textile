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
    
    // Пробуем добавить фильтр excludedFromParsing
    // Если Prisma Client не знает о поле, это вызовет ошибку при выполнении запроса,
    // которую мы обработаем в catch блоке
    where.excludedFromParsing = false

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

    let fabrics: any[]
    
    // Пробуем сначала через Prisma ORM
    try {
      console.log('[GET /api/fabrics] Выполняем запрос через Prisma ORM с фильтром:', JSON.stringify(where, null, 2))
      fabrics = await prisma.fabric.findMany({
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
      console.log('[GET /api/fabrics] Успешно получено тканей через Prisma:', fabrics.length)
    } catch (prismaError: any) {
      console.error('[GET /api/fabrics] Ошибка Prisma:', prismaError.message)
      console.error('[GET /api/fabrics] Тип ошибки:', prismaError.constructor?.name)
      
      // Если Prisma не знает о поле excludedFromParsing, пробуем без этого фильтра
      if (prismaError.message?.includes('excludedFromParsing') || prismaError.message?.includes('Unknown argument')) {
        console.log('[GET /api/fabrics] Prisma не знает о поле excludedFromParsing, пробуем без фильтра...')
        
        // Убираем excludedFromParsing из where и пробуем снова
        const whereWithoutExclusion: any = { ...where }
        delete whereWithoutExclusion.excludedFromParsing
        
        try {
          fabrics = await prisma.fabric.findMany({
            where: whereWithoutExclusion,
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
          
          // Фильтруем исключенные ткани в памяти
          // Если поле excludedFromParsing отсутствует или равно false/null, ткань включается
          fabrics = fabrics.filter((f: any) => {
            const excluded = f.excludedFromParsing
            return excluded !== true && excluded !== 1
          })
          console.log('Получено тканей после фильтрации:', fabrics.length)
        } catch (secondError: any) {
          // Если и это не работает, используем raw SQL
          console.log('Используем raw SQL fallback для GET fabrics')
          let sqlQuery = `
            SELECT 
              f.*,
              s.id as supplier_id,
              s.name as supplier_name,
              s.websiteUrl as supplier_websiteUrl
            FROM Fabric f
            INNER JOIN Supplier s ON f.supplierId = s.id
            WHERE (f.excludedFromParsing = 0 OR f.excludedFromParsing IS NULL)
          `
          
          const conditions: string[] = []
          if (supplierId) {
            conditions.push(`f.supplierId = '${supplierId.replace(/'/g, "''")}'`)
          }
          if (collection) {
            conditions.push(`f.collection = '${collection.replace(/'/g, "''")}'`)
          }
          if (search) {
            const escapedSearch = search.replace(/'/g, "''")
            conditions.push(`(f.collection LIKE '%${escapedSearch}%' OR f.colorNumber LIKE '%${escapedSearch}%')`)
          }
          
          if (conditions.length > 0) {
            sqlQuery += ' AND ' + conditions.join(' AND ')
          }
          
          sqlQuery += ' ORDER BY s.name ASC, f.collection ASC, f.colorNumber ASC'
          
          const rawResults = await prisma.$queryRawUnsafe<any[]>(sqlQuery)
          
          // Преобразуем результаты в формат, совместимый с Prisma
          fabrics = rawResults.map((row: any) => ({
            id: row.id,
            supplierId: row.supplierId,
            collection: row.collection,
            colorNumber: row.colorNumber,
            inStock: row.inStock === 1 || row.inStock === true,
            meterage: row.meterage,
            price: row.price,
            pricePerMeter: row.pricePerMeter,
            category: row.category,
            imageUrl: row.imageUrl,
            colorHex: row.colorHex,
            fabricType: row.fabricType,
            description: row.description,
            lastUpdatedAt: row.lastUpdatedAt ? new Date(row.lastUpdatedAt) : null,
            nextArrivalDate: row.nextArrivalDate ? new Date(row.nextArrivalDate) : null,
            comment: row.comment,
            excludedFromParsing: row.excludedFromParsing === 1 || row.excludedFromParsing === true,
            createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
            supplier: {
              id: row.supplier_id,
              name: row.supplier_name,
              websiteUrl: row.supplier_websiteUrl,
            },
          }))
        }
      } else {
        throw prismaError
      }
    }

    // Вычисляем цену за мп и категорию для каждой ткани
    const fabricsWithCalculations = fabrics.map((fabric: any) => {
      // Вычисляем цену за метр погонный, если не задана
      // Используем безопасный доступ к полям, которые могут отсутствовать
      let pricePerMeter = fabric.pricePerMeter || null
      if (!pricePerMeter && fabric.price && fabric.meterage) {
        pricePerMeter = calculatePricePerMeter(fabric.price, fabric.meterage)
      }

      // Определяем категорию, если не задана
      // Если есть цена, но нет метража, используем саму цену для определения категории
      let category = fabric.category || null
      if (!category) {
        if (pricePerMeter) {
          category = getCategoryByPrice(pricePerMeter, categoryList)
        } else if (fabric.price) {
          // Если нет метража, но есть цена, используем цену напрямую для категории
          // (предполагаем, что цена указана за метр)
          category = getCategoryByPrice(fabric.price, categoryList)
        }
      }

      return {
        ...fabric,
        pricePerMeter,
        category,
      }
    })

    return NextResponse.json(fabricsWithCalculations)
  } catch (error: any) {
    console.error('[GET /api/fabrics] Error fetching fabrics:', error)
    console.error('[GET /api/fabrics] Error message:', error.message)
    console.error('[GET /api/fabrics] Error stack:', error.stack)
    
    // Если это ошибка подключения к БД, возвращаем более понятное сообщение
    if (error.message?.includes('SQLITE') || error.message?.includes('database') || error.message?.includes('connection')) {
      return NextResponse.json(
        { 
          error: 'Database connection error',
          details: 'Не удалось подключиться к базе данных. Убедитесь, что база данных доступна.'
        },
        { status: 500 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch fabrics',
        details: error.message || 'Unknown error',
        type: error.constructor?.name || 'Error'
      },
      { status: 500 }
    )
  }
}

