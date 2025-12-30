import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

export async function GET() {
  try {
    // Прямая загрузка категорий из БД
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
            console.error('[GET /api/categories] Error creating category:', error)
          }
        }
      }
      categories = await prisma.fabricCategory.findMany({
        orderBy: { price: 'asc' },
      })
    }

    return NextResponse.json(categories)
  } catch (error: any) {
    console.error('[GET /api/categories] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}




