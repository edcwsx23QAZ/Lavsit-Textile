import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

export async function GET() {
  try {
    let categories = await prisma.fabricCategory.findMany({
      orderBy: { price: 'asc' },
    })

    // Если категорий нет в БД, инициализируем значениями по умолчанию
    if (categories.length === 0) {
      // Создаем категории по умолчанию
      await prisma.fabricCategory.createMany({
        data: DEFAULT_CATEGORIES,
        skipDuplicates: true,
      })
      categories = await prisma.fabricCategory.findMany({
        orderBy: { price: 'asc' },
      })
    }

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { category, price } = body

    if (!category || !price) {
      return NextResponse.json(
        { error: 'Category and price are required' },
        { status: 400 }
      )
    }

    const result = await prisma.fabricCategory.upsert({
      where: { category },
      create: {
        category,
        price,
      },
      update: {
        price,
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error saving category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save category' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Category ID is required' },
        { status: 400 }
      )
    }

    await prisma.fabricCategory.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting category:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete category' },
      { status: 500 }
    )
  }
}


