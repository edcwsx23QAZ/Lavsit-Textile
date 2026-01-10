import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Отключаем static generation для API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Убеждаемся, что Viptextil существует
    try {
      const viptextilExists = await prisma.supplier.findUnique({
        where: { name: 'Viptextil' },
        select: { id: true },
      })

      if (!viptextilExists) {
        await prisma.supplier.create({
          data: {
            name: 'Viptextil',
            websiteUrl: 'http://tgn1.viptextil.ru',
            parsingMethod: 'html',
            parsingUrl: 'http://tgn1.viptextil.ru/vip/ostatki.html',
            status: 'active',
          },
        })
      }
    } catch (error: any) {
      // Игнорируем ошибки при проверке/создании Viptextil
      console.warn('[GET /api/suppliers] Error checking Viptextil:', error.message)
    }

    // Прямая загрузка поставщиков из БД
    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        websiteUrl: true,
        parsingMethod: true,
        parsingUrl: true,
        emailConfig: true,
        lastUpdatedAt: true,
        status: true,
        errorMessage: true,
        _count: {
          select: { fabrics: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    })

    const suppliersWithCount = suppliers.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      websiteUrl: supplier.websiteUrl,
      parsingMethod: supplier.parsingMethod,
      parsingUrl: supplier.parsingUrl,
      emailConfig: supplier.emailConfig,
      lastUpdatedAt: supplier.lastUpdatedAt,
      status: supplier.status,
      errorMessage: supplier.errorMessage,
      fabricsCount: supplier._count.fabrics,
    }))

    return NextResponse.json(suppliersWithCount)
  } catch (error: any) {
    console.error('[GET /api/suppliers] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch suppliers' },
      { status: 500 }
    )
  }
}





