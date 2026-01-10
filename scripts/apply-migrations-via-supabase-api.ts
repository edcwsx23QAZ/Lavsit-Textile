import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = 'https://hduadapicktrcrqjvzvd.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_Nmrfz9rwXqnrD8TEkQlA_5dm3YIkp'
const SUPABASE_PROJECT_ID = 'hduadapicktrcrqjvzvd'

// Правильный PostgreSQL connection string для Supabase
const DATABASE_URL = `postgresql://postgres.${SUPABASE_PROJECT_ID}:edcwsx123QAZ!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1`

async function applyMigrationsViaSupabaseAPI() {
  console.log('🔧 Применение миграций к базе данных Supabase...\n')
  console.log(`📍 Project URL: ${SUPABASE_URL}`)
  console.log(`📍 Project ID: ${SUPABASE_PROJECT_ID}\n`)

  try {
    // Читаем SQL миграцию
    const migrationPath = join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    console.log(`📄 SQL миграция загружена (${sql.length} символов)\n`)

    // Пробуем использовать Supabase PostgREST для выполнения SQL
    // Но PostgREST не поддерживает произвольный SQL
    // Нужно использовать прямой PostgreSQL подключение через connection pooler

    console.log('🌐 Использование Supabase Connection Pooler для применения миграций...\n')
    
    // Используем библиотеку pg для прямого подключения
    const { Client } = await import('pg')
    
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    console.log('🔗 Подключение к базе данных через Connection Pooler...')
    await client.connect()
    console.log('✅ Подключение успешно!\n')

    // Разбиваем SQL на отдельные команды
    const statements: string[] = []
    let currentStatement = ''
    let inQuotes = false
    let quoteChar = ''
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i]
      const prevChar = i > 0 ? sql[i - 1] : ''
      
      if ((char === '"' || char === "'") && prevChar !== '\\') {
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
      const statementType = statement.substring(0, 30).replace(/\s+/g, ' ').toUpperCase()
      
      try {
        console.log(`   [${i + 1}/${statements.length}] Выполняю: ${statementType}...`)
        await client.query(statement)
        successCount++
        results.push({
          index: i + 1,
          success: true,
          message: `Команда ${i + 1} выполнена успешно`
        })
        console.log(`      ✅ Успешно`)
      } catch (error: any) {
        // Игнорируем ошибки "already exists"
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            (error.message?.includes('relation') && error.message?.includes('already')) ||
            error.message?.includes('already exists')) {
          skipCount++
          results.push({
            index: i + 1,
            success: true,
            message: `Команда ${i + 1} пропущена (уже существует)`
          })
          console.log(`      ⚠️  Уже существует (пропускаем)`)
        } else {
          errorCount++
          results.push({
            index: i + 1,
            success: false,
            message: `Ошибка: ${error.message?.substring(0, 100)}`
          })
          console.error(`      ❌ Ошибка: ${error.message?.substring(0, 100)}`)
          // Не прерываем выполнение, продолжаем
        }
      }
    }

    console.log(`\n📊 Итоги выполнения:`)
    console.log(`   ✅ Успешно: ${successCount}`)
    console.log(`   ⚠️  Пропущено (уже существует): ${skipCount}`)
    console.log(`   ❌ Ошибок: ${errorCount}`)

    // Проверяем таблицы
    console.log('\n🔍 Проверка созданных таблиц...')
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((r: any) => r.table_name)
    console.log(`✅ Найдено таблиц: ${tables.length}\n`)

    const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
    
    const missingTables: string[] = []
    const existingTables: string[] = []

    requiredTables.forEach(tableName => {
      const exists = tables.includes(tableName)
      if (exists) {
        existingTables.push(tableName)
        console.log(`   ✅ ${tableName}`)
      } else {
        missingTables.push(tableName)
        console.log(`   ❌ ${tableName}`)
      }
    })

    await client.end()

    if (missingTables.length === 0) {
      console.log('\n✅ Все требуемые таблицы созданы!')
      return true
    } else {
      console.log(`\n⚠️  Отсутствуют таблицы: ${missingTables.join(', ')}`)
      return false
    }

  } catch (error: any) {
    console.error('\n❌ Ошибка:', error.message)
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT') || error.message?.includes('ENOTFOUND')) {
      console.error('\n💡 Возможные причины:')
      console.error('   1. База данных в режиме паузы (Free tier)')
      console.error('   2. Неправильный connection string')
      console.error('   3. Connection Pooler недоступен')
      console.error('\n💡 Попробуйте прямой connection string:')
      console.error(`   postgresql://postgres:edcwsx123QAZ!@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres?schema=public`)
    }
    
    // Пробуем прямой connection
    console.log('\n🔄 Пробую прямое подключение без pooler...\n')
    const migrationPath = join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
    const sqlContent = readFileSync(migrationPath, 'utf-8')
    return await tryDirectConnection(sqlContent)
  }
}

async function tryDirectConnection(sqlContent: string) {
  try {
    // Правильный формат connection string для Supabase direct connection
    // Используем URL-encoded пароль (! -> %21)
    const directUrl = `postgresql://postgres:edcwsx123QAZ%21@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres?schema=public&sslmode=require`
    
    const { Client } = await import('pg')
    const client = new Client({
      connectionString: directUrl,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    console.log('🔗 Прямое подключение к базе данных...')
    await client.connect()
    console.log('✅ Подключение успешно!\n')

    // Выполняем SQL аналогично предыдущему способу
    const statements = sqlContent
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📋 Выполняю ${statements.length} SQL команд...\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      try {
        await client.query(statement)
        console.log(`   ✅ [${i + 1}/${statements.length}] Выполнено`)
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`   ⚠️  [${i + 1}/${statements.length}] Уже существует`)
        } else {
          console.error(`   ❌ [${i + 1}/${statements.length}] Ошибка: ${error.message?.substring(0, 80)}`)
        }
      }
    }

    // Проверяем таблицы
    const tablesResult = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((r: any) => r.table_name)
    const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
    const missingTables = requiredTables.filter(name => !tables.includes(name))

    await client.end()

    if (missingTables.length === 0) {
      console.log(`\n✅ Все таблицы созданы! Найдено: ${tables.length}`)
      return true
    } else {
      console.log(`\n⚠️  Отсутствуют: ${missingTables.join(', ')}`)
      return false
    }

  } catch (error: any) {
    console.error('❌ Прямое подключение также не удалось:', error.message)
    return false
  }
}

applyMigrationsViaSupabaseAPI()
  .then((success) => {
    if (success) {
      console.log('\n✅ Миграции успешно применены!')
      console.log('💡 Теперь можно проверить подключение:')
      console.log('   https://lavsit-textile.vercel.app/api/test-db')
      process.exit(0)
    } else {
      console.log('\n❌ Миграции применены частично или не применены')
      console.log('\n💡 Альтернативное решение:')
      console.log('   Примените миграции вручную через Supabase SQL Editor')
      console.log('   https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd/sql')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })

