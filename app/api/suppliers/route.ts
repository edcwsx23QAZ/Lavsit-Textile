import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        _count: {
          select: { fabrics: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    const suppliersWithCount = suppliers.map(supplier => ({
      ...supplier,
      fabricsCount: supplier._count.fabrics,
    }))

    return NextResponse.json(suppliersWithCount)
  } catch (error) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, websiteUrl, parsingMethod, parsingUrl } = body

    const supplier = await prisma.supplier.create({
      data: {
        name,
        websiteUrl,
        parsingMethod,
        parsingUrl,
      },
    })

    return NextResponse.json(supplier)
  } catch (error) {
    console.error('Error creating supplier:', error)
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    )
  }
}


