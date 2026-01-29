import { prisma } from '@/lib/db/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/fabric-categories'
import { CategoriesPageClient } from './CategoriesPageClient'

// Отключаем static generation - страница динамическая
export const dynamic = 'force-dynamic'

export default async function CategoriesPage() {
  try {
    // Загружаем категории напрямую в Server Component
    let categories = await prisma.fabricCategory.findMany({
      orderBy: { price: 'asc' },
    })

    // Если категорий нет, создаем из DEFAULT_CATEGORIES
    if (categories.length === 0) {
      for (const cat of DEFAULT_CATEGORIES) {
        try {
          await prisma.fabricCategory.create({
            data: {
              category: cat.category,
              price: cat.price,
            },
          })
        } catch (error: any) {
          // Игнорируем ошибки дублирования
          if (!error.message?.includes('Unique constraint') && !error.message?.includes('P2002')) {
            console.error('Error creating category:', error)
          }
        }
      }
      categories = await prisma.fabricCategory.findMany({
        orderBy: { price: 'asc' },
      })
    }

    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Категории тканей</h1>
          <p className="text-muted-foreground">
            Всего категорий: {categories.length}
          </p>
        </div>

        <div className="flex justify-start">
          <CategoriesPageClient initialCategories={categories} />
        </div>
      </div>
    )
  } catch (error: any) {
    console.error('[CategoriesPage] Error:', error)
    
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
          <h1 className="text-3xl font-bold mb-2">Категории тканей</h1>
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
