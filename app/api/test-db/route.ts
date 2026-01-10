import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

// Отключаем static generation для API route
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    console.log('🔍 Проверка подключения к базе данных...')
    
    // Простой запрос для проверки подключения
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Подключение к базе данных успешно!', result)
    
    // Проверка существования таблиц
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    
    console.log(`✅ Найдено таблиц: ${tables.length}`)
    
    const tableNames = tables.map(t => t.table_name)
    
    return NextResponse.json({
      success: true,
      message: 'База данных доступна',
      tablesCount: tables.length,
      tables: tableNames,
      hasRequiredTables: {
        Supplier: tableNames.includes('Supplier'),
        Fabric: tableNames.includes('Fabric'),
        ParsingRule: tableNames.includes('ParsingRule'),
        DataStructure: tableNames.includes('DataStructure'),
        EmailAttachment: tableNames.includes('EmailAttachment'),
        FabricCategory: tableNames.includes('FabricCategory'),
        ManualUpload: tableNames.includes('ManualUpload'),
      }
    })
  } catch (error: any) {
    console.error('❌ Ошибка подключения к базе данных:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      message: error.message?.includes('Can\'t reach database') 
        ? 'База данных недоступна. Проверьте DATABASE_URL и настройки Supabase.'
        : error.message,
    }, { status: 500 })
  }
}


