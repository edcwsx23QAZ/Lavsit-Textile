import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = 'https://hduadapicktrcrqjvzvd.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_Nmrfz9rwXqnrD8TEkQlA_5dm3YIkp'

// PostgreSQL connection через connection pooler
const DATABASE_URL = 'postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true'

async function applyMigrationsViaPooler() {
  console.log('🔧 Применение миграций через connection pooler...\n')
  console.log(`📍 Project ID: hduadapicktrcrqjvzvd`)
  console.log(`📍 URL: ${SUPABASE_URL}\n`)

  try {
    // Используем Prisma с connection pooler
    const { PrismaClient } = await import('@prisma/client')
    
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL,
        },
      },
    })

    console.log('🔗 Подключение к базе данных через connection pooler...')
    
    // Проверяем подключение
    try {
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Подключение успешно!\n')
    } catch (error: any) {
      // Если pooler не работает, пробуем прямой connection
      console.log('⚠️  Connection pooler недоступен, пробую прямой connection...\n')
      
      await prisma.$disconnect()
      
      // Пробуем прямой connection
      const directUrl = 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public'
      const prismaDirect = new PrismaClient({
        datasources: {
          db: {
            url: directUrl,
          },
        },
      })

      await prismaDirect.$queryRaw`SELECT 1`
      console.log('✅ Прямое подключение успешно!\n')
      
      await prismaDirect.$disconnect()
      
      // Используем прямой connection для миграций
      return await executeMigrations(directUrl)
    }

    // Если pooler работает, используем его
    return await executeMigrations(DATABASE_URL)

  } catch (error: any) {
    console.error('❌ Ошибка подключения:', error.message)
    
    // Пробуем использовать Supabase Management API
    console.log('\n🔄 Пробую применить миграции через Supabase Management API...\n')
    return await applyMigrationsViaManagementAPI()
  }
}

async function executeMigrations(databaseUrl: string) {
  console.log('📄 Читаю SQL миграцию...')
  const migrationPath = join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
  const sql = readFileSync(migrationPath, 'utf-8')
  
  console.log(`📏 Размер SQL: ${sql.length} символов\n`)

  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })

  try {
    // Разбиваем SQL на отдельные команды (учитывая многострочные CREATE TABLE)
    const statements: string[] = []
    let currentStatement = ''
    let inQuotes = false
    let quoteChar = ''
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]
      const nextChar = sql[i + 1]
      
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

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      const statementType = statement.substring(0, 20).toUpperCase()
      
      try {
        console.log(`   [${i + 1}/${statements.length}] Выполняю: ${statementType}...`)
        await prisma.$executeRawUnsafe(statement)
        successCount++
        console.log(`      ✅ Успешно`)
      } catch (error: any) {
        // Игнорируем ошибки "already exists" для CREATE TABLE IF NOT EXISTS и CREATE INDEX IF NOT EXISTS
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            error.message?.includes('relation') && error.message?.includes('already')) {
          skipCount++
          console.log(`      ⚠️  Уже существует (пропускаем)`)
        } else {
          errorCount++
          console.error(`      ❌ Ошибка: ${error.message?.substring(0, 100)}`)
          // Не бросаем ошибку, продолжаем выполнение
        }
      }
    }

    console.log(`\n📊 Итоги выполнения:`)
    console.log(`   ✅ Успешно: ${successCount}`)
    console.log(`   ⚠️  Пропущено (уже существует): ${skipCount}`)
    console.log(`   ❌ Ошибок: ${errorCount}`)

    // Проверяем таблицы
    console.log('\n🔍 Проверка созданных таблиц...')
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    console.log(`✅ Найдено таблиц: ${tables.length}\n`)
    const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
    
    const missingTables: string[] = []
    requiredTables.forEach(tableName => {
      const exists = tables.some(t => t.table_name === tableName)
      const icon = exists ? '✅' : '❌'
      console.log(`   ${icon} ${tableName}`)
      if (!exists) {
        missingTables.push(tableName)
      }
    })

    if (missingTables.length > 0) {
      console.log(`\n⚠️  Отсутствуют таблицы: ${missingTables.join(', ')}`)
    } else {
      console.log(`\n✅ Все требуемые таблицы созданы!`)
    }

    await prisma.$disconnect()
    return missingTables.length === 0
  } catch (error: any) {
    await prisma.$disconnect()
    throw error
  }
}

async function applyMigrationsViaManagementAPI() {
  console.log('🌐 Использование Supabase Management API...\n')

  // Читаем SQL
  const migrationPath = join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
  const sql = readFileSync(migrationPath, 'utf-8')

  // Supabase Management API требует создание Edge Function или использование их SQL API
  // Попробуем использовать Supabase REST API с SQL execution
  
  // Вариант 1: Использовать Supabase REST API для выполнения SQL
  // Но стандартный REST API не поддерживает произвольный SQL
  // Нужно использовать Supabase Management API или Edge Function

  console.log('⚠️  Supabase Management API не поддерживает прямой SQL execution через REST API')
  console.log('💡 Рекомендуется применить миграции вручную через Supabase SQL Editor')
  console.log('   Или использовать Supabase CLI: supabase db push\n')
  
  return false
}

// Основная функция
async function main() {
  try {
    const success = await applyMigrationsViaPooler()
    
    if (success) {
      console.log('\n✅ Миграции успешно применены!')
      console.log('💡 Теперь можно протестировать подключение к базе данных.')
      console.log('   Проверьте: https://lavsit-textile.vercel.app/api/test-db')
      process.exit(0)
    } else {
      console.log('\n⚠️  Миграции применены частично или через альтернативный метод')
      process.exit(1)
    }
  } catch (error: any) {
    console.error('\n❌ Критическая ошибка:', error.message)
    console.error('\n💡 Альтернативное решение:')
    console.error('   1. Откройте Supabase SQL Editor: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd/sql')
    console.error('   2. Скопируйте SQL из: prisma/migrations/init_postgresql/migration.sql')
    console.error('   3. Выполните SQL в редакторе')
    process.exit(1)
  }
}

main()

