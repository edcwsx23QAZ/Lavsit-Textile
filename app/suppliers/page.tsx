import { prisma } from '@/lib/db/prisma'
import { SuppliersPageClient } from './SuppliersPageClient'
import { SuppliersExclusionsClient } from './SuppliersExclusionsClient'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Suspense } from 'react'

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

  // Инициализируем всех поставщиков, если их меньше 10 (должно быть 14)
  if (suppliers.length < 10) {
    const SUPPLIERS = [
      {
        name: 'Artvision',
        websiteUrl: 'https://artvision-home.ru',
        parsingMethod: 'html',
        parsingUrl: 'https://artvision-home.ru/leftovers/',
      },
      {
        name: 'Союз-М',
        websiteUrl: 'https://www.souz-m.ru',
        parsingMethod: 'excel',
        parsingUrl: 'https://www.souz-m.ru/leftovers/?is_load_excel=1',
      },
      {
        name: 'Домиарт',
        websiteUrl: 'https://k-domiart.ru',
        parsingMethod: 'excel',
        parsingUrl: 'https://k-domiart.ru/assets/files/instock_moscow.xlsx',
      },
        {
          name: 'Артекс',
          websiteUrl: 'https://artextkani.ru',
          parsingMethod: 'excel',
          parsingUrl: 'https://artextkani.ru/wp-content/uploads/YYYY/MM/DD.MM.YYYY-1.xlsx', // Парсер сам найдет актуальную дату. Формат: /2026/01/28.01.2026-1.xlsx
        },
      {
        name: 'TextileData',
        websiteUrl: 'https://textiledata.ru',
        parsingMethod: 'html',
        parsingUrl: 'https://textiledata.ru/ostatki-tkaney/',
      },
      {
        name: 'NoFrames',
        websiteUrl: 'https://no-frames.ru',
        parsingMethod: 'excel',
        parsingUrl: 'https://no-frames.ru/design/themes/abt__unitheme2/media/files/NALICHIE_NA_SKLADE_NOFRAMES.XLS?v={timestamp}',
      },
      {
        name: 'Нортекс',
        websiteUrl: 'https://nortex.ru',
        parsingMethod: 'email',
        parsingUrl: '',
      },
      {
        name: 'Tex.Group',
        websiteUrl: 'https://tex.group',
        parsingMethod: 'excel',
        parsingUrl: 'https://tex.group/ostatki/OstatkiMSK.xls',
      },
      {
        name: 'Vektor',
        websiteUrl: 'https://vektor.club',
        parsingMethod: 'excel',
        parsingUrl: 'https://api.vektor.club/static/remainders_files/{DDMMYY}_MSK.xlsx',
      },
      {
        name: 'Аметист',
        websiteUrl: 'https://ametist.ru',
        parsingMethod: 'email',
        parsingUrl: '',
      },
      {
        name: 'TextileNova',
        websiteUrl: 'https://textilnova.ru',
        parsingMethod: 'html',
        parsingUrl: 'https://textilnova.ru//',
      },
      {
        name: 'Viptextil',
        websiteUrl: 'http://tgn1.viptextil.ru',
        parsingMethod: 'html',
        parsingUrl: 'http://tgn1.viptextil.ru/vip/ostatki.html',
      },
      {
        name: 'Artefact',
        websiteUrl: 'https://artefakt-msk.com',
        parsingMethod: 'excel',
        parsingUrl: 'https://artefakt-msk.com/%D0%BD%D0%B0%D0%BB%D0%B8%D1%87%D0%B8%D0%B5',
      },
      {
        name: 'Эгида',
        websiteUrl: 'https://exch.tendence.ru',
        parsingMethod: 'excel',
        parsingUrl: 'https://exch.tendence.ru/download.php?file={DD.MM.YY}_ostatki_tkani_ooo_egida.xls',
      },
    ]

    for (const supplier of SUPPLIERS) {
      try {
        await prisma.supplier.upsert({
          where: { name: supplier.name },
          update: {
            websiteUrl: supplier.websiteUrl,
            parsingMethod: supplier.parsingMethod,
            parsingUrl: supplier.parsingUrl,
            status: 'active',
          },
          create: {
            ...supplier,
            status: 'active',
          },
        })
      } catch (error: any) {
        // Игнорируем ошибки при создании отдельных поставщиков
        console.warn(`[SuppliersPage] Error initializing ${supplier.name}:`, error.message)
      }
    }

    // Перезагружаем поставщиков после инициализации
    const updatedSuppliers = await prisma.supplier.findMany({
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
    })
    suppliers.splice(0, suppliers.length, ...updatedSuppliers)
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
            <Suspense fallback={
              <div className="border border-gray-200 bg-gray-50 rounded-lg p-4">
                <p className="text-gray-600">Загрузка исключений...</p>
              </div>
            }>
              <SuppliersExclusionsTab />
            </Suspense>
          </TabsContent>
        </Tabs>
      </div>
    )
  } catch (error: any) {
    console.error('[SuppliersPage] Error:', error)
    
    // Проверяем различные коды ошибок Prisma
    const errorCode = error?.code || error?.meta?.code
    const isDatabaseError = 
      errorCode === 'P1001' || // Can't reach database server
      errorCode === 'P1000' || // Authentication failed
      errorCode === 'P1003' || // Database does not exist
      errorCode === 'P1011' || // TLS connection error
      errorCode === 'P1017' || // Server has closed the connection
      error?.message?.includes('Can\'t reach database') ||
      error?.message?.includes('P1001') ||
      error?.message?.includes('P1000') ||
      error?.message?.includes('database') ||
      error?.message?.includes('Connection') ||
      error?.message?.includes('PrismaClient') ||
      error?.message?.includes('Invalid `prisma') ||
      error?.message?.includes('Unknown database')
    
    // Всегда показываем fallback UI вместо проброса ошибки
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Поставщики</h1>
        </div>
        <div className={`border rounded-lg p-4 ${isDatabaseError ? 'border-yellow-300 bg-yellow-50' : 'border-red-300 bg-red-50'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isDatabaseError ? 'text-yellow-800' : 'text-red-800'}`}>
            {isDatabaseError ? 'База данных недоступна' : 'Ошибка загрузки данных'}
          </h3>
          <p className={`mb-4 ${isDatabaseError ? 'text-yellow-700' : 'text-red-700'}`}>
            {isDatabaseError 
              ? 'Не удалось подключиться к базе данных. Пожалуйста, проверьте настройки подключения.'
              : 'Произошла ошибка при загрузке данных. Пожалуйста, попробуйте обновить страницу.'}
          </p>
          {(process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development') && (
            <p className={`text-sm ${isDatabaseError ? 'text-yellow-600' : 'text-red-600'}`}>
              {error?.message || 'Неизвестная ошибка'}
              {errorCode && ` (Код: ${errorCode})`}
            </p>
          )}
        </div>
      </div>
    )
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
