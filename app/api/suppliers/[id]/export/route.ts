import { NextResponse } from 'next/server'
import { exportSupplierFabricsToExcel } from '@/lib/excel-export'
import { getLastParsedDataFile } from '@/lib/parsers/save-parsed-data'
import { prisma } from '@/lib/prisma'
import * as fs from 'fs'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
      select: { name: true },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    const supplierName = supplier.name
    const fileName = `${supplierName}-${new Date().toISOString().split('T')[0]}.xlsx`

    // Сначала пытаемся получить сохраненный файл из парсинга
    const savedFile = getLastParsedDataFile(params.id)
    
    if (savedFile && fs.existsSync(savedFile)) {
      // Возвращаем сохраненный файл
      const buffer = fs.readFileSync(savedFile)
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${fileName}"`,
        },
      })
    }
    
    // Если сохраненного файла нет, экспортируем из базы данных
    const buffer = await exportSupplierFabricsToExcel(params.id)
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting supplier fabrics:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to export supplier fabrics' },
      { status: 500 }
    )
  }
}
