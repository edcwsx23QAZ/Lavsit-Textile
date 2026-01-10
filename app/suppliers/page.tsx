import { prisma } from '@/lib/db/prisma'
import { SuppliersPageClient } from './SuppliersPageClient'
import { SuppliersExclusionsClient } from './SuppliersExclusionsClient'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Отключаем static generation - страница динамическая
export const dynamic = 'force-dynamic'

export default async function SuppliersPage() {
  try {
    // Загружаем поставщиков напрямую в Server Component
    const suppliers = await prisma.supplier.findMany({
    select: {
      id: true,
      name: true,
      websiteUrl: true,
      parsingMethod: true,
      parsingUrl: true,
      emailConfig: true,
      lastUpdatedAt: true,
      status: true,
      errorMessage: true,
      _count: {
        select: { fabrics: true },
      },
    },
    // Сортировка будет выполнена в коде
  })

  // Убеждаемся, что Viptextil существует
  const viptextilExists = suppliers.find(s => s.name === 'Viptextil')
  if (!viptextilExists) {
    try {
      await prisma.supplier.create({
        data: {
          name: 'Viptextil',
          websiteUrl: 'http://tgn1.viptextil.ru',
          parsingMethod: 'html',
          parsingUrl: 'http://tgn1.viptextil.ru/vip/ostatki.html',
          status: 'active',
        },
      })
    } catch (error) {
      // Игнорируем ошибки
    }
  }

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

  const suppliersWithCount = sortedSuppliers.map(supplier => ({
    id: supplier.id,
    name: supplier.name,
    websiteUrl: supplier.websiteUrl,
    parsingMethod: supplier.parsingMethod,
    parsingUrl: supplier.parsingUrl,
    emailConfig: supplier.emailConfig,
    lastUpdatedAt: supplier.lastUpdatedAt,
    status: supplier.status,
    errorMessage: supplier.errorMessage,
    fabricsCount: supplier._count.fabrics, // Временно используем общее количество, после перегенерации Prisma Client будет доступен lastParsedCount
  }))

    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Поставщики</h1>
          <p className="text-muted-foreground">
            Всего поставщиков: {suppliers.length}
          </p>
        </div>

        <Tabs defaultValue="suppliers" className="w-full">
          <TabsList>
            <TabsTrigger value="suppliers">Поставщики</TabsTrigger>
            <TabsTrigger value="exclusions">Исключения</TabsTrigger>
          </TabsList>
          <TabsContent value="suppliers">
            <SuppliersPageClient suppliers={suppliersWithCount} />
          </TabsContent>
          <TabsContent value="exclusions">
            <SuppliersExclusionsTab />
          </TabsContent>
        </Tabs>
      </div>
    )
  } catch (error: any) {
    console.error('[SuppliersPage] Error:', error)
    
    // Если база данных недоступна, показываем сообщение
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database')) {
      return (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Поставщики</h1>
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

// Компонент для вкладки исключений (Server Component)
async function SuppliersExclusionsTab() {
  try {
    // Загружаем исключенные ткани
    const excludedFabrics = await prisma.fabric.findMany({
    where: { excludedFromParsing: true },
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

    return <SuppliersExclusionsClient grouped={grouped} />
  } catch (error: any) {
    console.error('[SuppliersExclusionsTab] Error:', error)
    return (
      <div className="border border-red-300 bg-red-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-red-800 mb-2">
          Ошибка загрузки исключений
        </h3>
        <p className="text-red-700">
          Не удалось загрузить исключенные ткани: {error.message || 'Неизвестная ошибка'}
        </p>
      </div>
    )
  }
}
