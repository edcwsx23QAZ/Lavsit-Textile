import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id

    // Проверяем существование поставщика
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Поставщик не найден' },
        { status: 404 }
      )
    }

    // Подсчитываем количество тканей перед удалением
    const fabricsCount = await prisma.fabric.count({
      where: { supplierId },
    })

    // Удаляем все ткани поставщика
    const deleteResult = await prisma.fabric.deleteMany({
      where: { supplierId },
    })

    // Обновляем информацию о поставщике
    await prisma.supplier.update({
      where: { id: supplierId },
      data: {
        fabricsCount: 0,
        lastUpdatedAt: new Date(),
        status: 'active',
        errorMessage: null,
      },
    })

    console.log(`[DELETE /api/suppliers/${supplierId}/fabrics] Удалено ${deleteResult.count} тканей для поставщика "${supplier.name}"`)

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.count,
      message: `Удалено ${deleteResult.count} тканей поставщика "${supplier.name}"`,
    })
  } catch (error: any) {
    console.error('Error deleting fabrics:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка при удалении тканей' },
      { status: 500 }
    )
  }
}




