import { prisma } from '@/lib/db/prisma'
import { FabricsPageClient } from './FabricsPageClient'
import { calculatePricePerMeter, getCategoryByPrice, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

// Отключаем static generation - страница динамическая
export const dynamic = 'force-dynamic'

export default async function FabricsPage() {
  try {
    // Загружаем данные напрямую в Server Component
    const [fabricsRaw, categories, suppliers] = await Promise.all([
    prisma.fabric.findMany({
      where: { excludedFromParsing: false },
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
    }),
    prisma.fabricCategory.findMany({
      orderBy: { price: 'asc' },
    }),
    prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
      },
      // Сортировка будет выполнена в коде
    }),
  ])

  // Вычисляем pricePerMeter и category на сервере
  const categoryList = categories.length > 0
    ? categories.map(cat => ({ category: cat.category, price: cat.price }))
    : DEFAULT_CATEGORIES

  const fabrics = fabricsRaw.map((fabric: any) => {
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

  // Сортируем поставщиков: сначала русские (кириллица), затем латинские
  const sortedSuppliers = [...suppliers].sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    
    // Проверяем, начинается ли название с кириллицы
    const aIsCyrillic = /^[а-яё]/.test(aName)
    const bIsCyrillic = /^[а-яё]/.test(bName)
    
    // Если один кириллический, а другой нет - кириллический идет первым
    if (aIsCyrillic && !bIsCyrillic) return -1
    if (!aIsCyrillic && bIsCyrillic) return 1
    
    // Если оба одного типа - сортируем по алфавиту
    return aName.localeCompare(bName, 'ru')
  })

  // Сортируем ткани по поставщикам (с учетом новой сортировки поставщиков)
  const supplierOrder = new Map(sortedSuppliers.map((s, i) => [s.id, i]))
  const sortedFabrics = [...fabrics].sort((a, b) => {
    const aOrder = supplierOrder.get(a.supplier.id) ?? 999
    const bOrder = supplierOrder.get(b.supplier.id) ?? 999
    
    if (aOrder !== bOrder) return aOrder - bOrder
    
    // Если один поставщик - сортируем по коллекции и цвету
    if (a.collection !== b.collection) {
      return a.collection.localeCompare(b.collection, 'ru')
    }
    return a.colorNumber.localeCompare(b.colorNumber, 'ru')
  })

    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Ткани</h1>
          <p className="text-muted-foreground">
            Всего тканей: {sortedFabrics.length.toLocaleString('ru')}
          </p>
        </div>

        <FabricsPageClient 
          initialFabrics={sortedFabrics} 
          initialCategories={categories}
          initialSuppliers={sortedSuppliers}
        />
      </div>
    )
  } catch (error: any) {
    console.error('[FabricsPage] Error:', error)
    
    // Если база данных недоступна, показываем сообщение
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database')) {
      return (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Ткани</h1>
          </div>
          <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              База данных недоступна
            </h3>
            <p className="text-yellow-700 mb-4">
              Не удалось подключиться к базе данных. Пожалуйста, проверьте настройки подключения.
            </p>
            <p className="text-sm text-yellow-600">
              {process.env.NODE_ENV === 'development' && error.message}
            </p>
          </div>
        </div>
      )
    }
    
    // Для других ошибок пробрасываем дальше
    throw error
  }
}
