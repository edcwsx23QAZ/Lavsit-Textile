import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'
import { PrismaClient } from '@prisma/client'

// Отключаем static generation для API route
export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    console.log('🔧 Применение миграций к базе данных Supabase...')
    
    // Проверка авторизации (можно добавить секретный ключ)
    // Для безопасности можно требовать специальный ключ
    
    // Используем Prisma с DATABASE_URL из переменных окружения Vercel
    const prisma = new PrismaClient({
      log: ['error', 'warn'],
    })

    // Проверяем подключение
    console.log('🔗 Проверка подключения к базе данных...')
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Подключение успешно!\n')

    // Читаем SQL миграцию
    console.log('📄 Читаю SQL миграцию...')
    const migrationPath = join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    console.log(`📏 Размер SQL: ${sql.length} символов\n`)

    // Разбиваем SQL на отдельные команды
    const statements: string[] = []
    let currentStatement = ''
    let inQuotes = false
    let quoteChar = ''
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]
      
      if ((char === '"' || char === "'") && sql[i - 1] !== '\\') {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
          quoteChar = ''
        }
      }
      
      currentStatement += char
      
      if (!inQuotes && char === ';') {
        const trimmed = currentStatement.trim()
        if (trimmed && !trimmed.startsWith('--')) {
          statements.push(trimmed)
        }
        currentStatement = ''
      }
    }

    if (currentStatement.trim() && !currentStatement.trim().startsWith('--')) {
      statements.push(currentStatement.trim())
    }

    console.log(`📋 Найдено ${statements.length} SQL команд\n`)

    const results: Array<{ index: number; success: boolean; message: string }> = []
    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      const statementType = statement.substring(0, 30).toUpperCase().replace(/\s+/g, ' ')
      
      try {
        await prisma.$executeRawUnsafe(statement)
        successCount++
        results.push({
          index: i + 1,
          success: true,
          message: `Команда ${i + 1} выполнена: ${statementType}...`
        })
      } catch (error: any) {
        // Игнорируем ошибки "already exists"
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            (error.message?.includes('relation') && error.message?.includes('already'))) {
          skipCount++
          results.push({
            index: i + 1,
            success: true,
            message: `Команда ${i + 1} пропущена (уже существует): ${statementType}...`
          })
        } else {
          errorCount++
          results.push({
            index: i + 1,
            success: false,
            message: `Ошибка: ${error.message?.substring(0, 100)}`
          })
        }
      }
    }

    // Проверяем таблицы
    console.log('🔍 Проверка созданных таблиц...')
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    const tableNames = tables.map(t => t.table_name)
    const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
    
    const missingTables = requiredTables.filter(name => !tableNames.includes(name))
    const existingTables = requiredTables.filter(name => tableNames.includes(name))

    await prisma.$disconnect()

    return NextResponse.json({
      success: missingTables.length === 0,
      message: missingTables.length === 0 
        ? 'Миграции применены успешно! Все таблицы созданы.'
        : `Миграции применены частично. Отсутствуют таблицы: ${missingTables.join(', ')}`,
      statistics: {
        totalStatements: statements.length,
        successful: successCount,
        skipped: skipCount,
        errors: errorCount,
      },
      tables: {
        total: tables.length,
        existing: existingTables,
        missing: missingTables,
        all: tableNames,
      },
      results: results.slice(0, 20), // Первые 20 результатов
    })

  } catch (error: any) {
    console.error('❌ Ошибка при применении миграций:', error)
    
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

