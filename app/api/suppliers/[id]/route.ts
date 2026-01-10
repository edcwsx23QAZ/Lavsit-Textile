import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id
    const body = await request.json()
    
    const { parsingMethod, parsingUrl, websiteUrl, emailConfig } = body

    const updateData: any = {}

    if (parsingMethod !== undefined) {
      updateData.parsingMethod = parsingMethod
    }

    if (parsingUrl !== undefined) {
      updateData.parsingUrl = parsingUrl
    }

    if (websiteUrl !== undefined) {
      updateData.websiteUrl = websiteUrl
    }

    if (emailConfig !== undefined) {
      updateData.emailConfig = emailConfig
    }

    const updatedSupplier = await prisma.supplier.update({
      where: { id: supplierId },
      data: updateData,
    })

    return NextResponse.json(updatedSupplier)
  } catch (error: any) {
    console.error('Error updating supplier:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update supplier' },
      { status: 500 }
    )
  }
}





