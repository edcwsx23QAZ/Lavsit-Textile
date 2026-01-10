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
    
    // Если база данных недоступна, показываем сообщение
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database')) {
      return (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Категории тканей</h1>
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
