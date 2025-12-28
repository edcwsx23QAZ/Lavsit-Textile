import { NextResponse } from 'next/server'
import { exportAllFabricsToExcel } from '@/lib/excel-export'

export async function GET() {
  try {
    const buffer = await exportAllFabricsToExcel()
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="all-fabrics-${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting fabrics:', error)
    return NextResponse.json(
      { error: 'Failed to export fabrics' },
      { status: 500 }
    )
  }
}



