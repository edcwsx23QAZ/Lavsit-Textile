import { prisma } from '@/lib/db/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/fabric-categories'
import { CategoriesPageClient } from './CategoriesPageClient'

export default async function CategoriesPage() {
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
        if (!error.message?.includes('Unique constraint')) {
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
}
