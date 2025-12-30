import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { rules } = body

    await prisma.parsingRule.upsert({
      where: { supplierId: params.id },
      create: {
        supplierId: params.id,
        rules: JSON.stringify(rules),
      },
      update: {
        rules: JSON.stringify(rules),
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving rules:', error)
    return NextResponse.json(
      { error: 'Failed to save rules' },
      { status: 500 }
    )
  }
}




