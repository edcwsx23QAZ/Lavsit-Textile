import { NextRequest, NextResponse } from 'next/server'
import { exportAllFabricsToExcel, exportFabricsListToExcel } from '@/lib/excel-export'

export async function GET() {
  try {
    const buffer = await exportAllFabricsToExcel()
    
    return new NextResponse(buffer as any, {
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { fabrics } = body

    if (!fabrics || !Array.isArray(fabrics)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected fabrics array.' },
        { status: 400 }
      )
    }

    const buffer = await exportFabricsListToExcel(fabrics)
    
    return new NextResponse(buffer as any, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="fabrics-${new Date().toISOString().split('T')[0]}.xlsx"`,
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









