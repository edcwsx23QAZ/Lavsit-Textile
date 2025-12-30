import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { price } = await request.json()

    if (typeof price !== 'number' || price <= 0) {
      return NextResponse.json(
        { error: 'Invalid price' },
        { status: 400 }
      )
    }

    const category = await prisma.fabricCategory.update({
      where: { id: params.id },
      data: { price },
    })

    return NextResponse.json(category)
  } catch (error: any) {
    console.error('[PATCH /api/categories/[id]] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update category' },
      { status: 500 }
    )
  }
}

