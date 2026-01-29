import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Отключаем static generation для API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Инициализируем всех поставщиков, если их меньше 10 (должно быть 14)
    const suppliersCount = await prisma.supplier.count()
    
    if (suppliersCount < 10) {
      // Если поставщиков нет или только один - инициализируем всех
      const SUPPLIERS = [
        {
          name: 'Artvision',
          websiteUrl: 'https://artvision-home.ru',
          parsingMethod: 'html',
          parsingUrl: 'https://artvision-home.ru/leftovers/',
        },
        {
          name: 'Союз-М',
          websiteUrl: 'https://www.souz-m.ru',
          parsingMethod: 'excel',
          parsingUrl: 'https://www.souz-m.ru/leftovers/?is_load_excel=1',
        },
        {
          name: 'Домиарт',
          websiteUrl: 'https://k-domiart.ru',
          parsingMethod: 'excel',
          parsingUrl: 'https://k-domiart.ru/assets/files/instock_moscow.xlsx',
        },
        {
          name: 'Артекс',
          websiteUrl: 'https://artextkani.ru',
          parsingMethod: 'excel',
          parsingUrl: 'https://artextkani.ru/wp-content/uploads/25.12.2025-2.xlsx',
        },
        {
          name: 'TextileData',
          websiteUrl: 'https://textiledata.ru',
          parsingMethod: 'html',
          parsingUrl: 'https://textiledata.ru/ostatki-tkaney/',
        },
        {
          name: 'NoFrames',
          websiteUrl: 'https://no-frames.ru',
          parsingMethod: 'excel',
          parsingUrl: 'https://no-frames.ru/design/themes/abt__unitheme2/media/files/NALICHIE_NA_SKLADE_NOFRAMES.XLS?v={timestamp}',
        },
        {
          name: 'Нортекс',
          websiteUrl: 'https://nortex.ru',
          parsingMethod: 'email',
          parsingUrl: '',
        },
        {
          name: 'Tex.Group',
          websiteUrl: 'https://tex.group',
          parsingMethod: 'excel',
          parsingUrl: 'https://tex.group/ostatki/OstatkiMSK.xls',
        },
        {
          name: 'Vektor',
          websiteUrl: 'https://vektor.club',
          parsingMethod: 'excel',
          parsingUrl: 'https://api.vektor.club/static/remainders_files/{DDMMYY}_MSK.xlsx',
        },
        {
          name: 'Аметист',
          websiteUrl: 'https://ametist.ru',
          parsingMethod: 'email',
          parsingUrl: '',
        },
        {
          name: 'TextileNova',
          websiteUrl: 'https://textilnova.ru',
          parsingMethod: 'html',
          parsingUrl: 'https://textilnova.ru//',
        },
        {
          name: 'Viptextil',
          websiteUrl: 'http://tgn1.viptextil.ru',
          parsingMethod: 'html',
          parsingUrl: 'http://tgn1.viptextil.ru/vip/ostatki.html',
        },
        {
          name: 'Artefact',
          websiteUrl: 'https://artefakt-msk.com',
          parsingMethod: 'excel',
          parsingUrl: 'https://artefakt-msk.com/%D0%BD%D0%B0%D0%BB%D0%B8%D1%87%D0%B8%D0%B5',
        },
        {
          name: 'Эгида',
          websiteUrl: 'https://exch.tendence.ru',
          parsingMethod: 'excel',
          parsingUrl: 'https://exch.tendence.ru/download.php?file={DD.MM.YY}_ostatki_tkani_ooo_egida.xls',
        },
      ]

      for (const supplier of SUPPLIERS) {
        try {
          await prisma.supplier.upsert({
            where: { name: supplier.name },
            update: {
              websiteUrl: supplier.websiteUrl,
              parsingMethod: supplier.parsingMethod,
              parsingUrl: supplier.parsingUrl,
              status: 'active',
            },
            create: {
              ...supplier,
              status: 'active',
            },
          })
        } catch (error: any) {
          // Игнорируем ошибки при создании отдельных поставщиков
          console.warn(`[GET /api/suppliers] Error initializing ${supplier.name}:`, error.message)
        }
      }
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





