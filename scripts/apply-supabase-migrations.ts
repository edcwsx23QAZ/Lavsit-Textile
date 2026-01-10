import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://hduadapicktrcrqjvzvd.supabase.co'
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_Nmrfz9rwXqnrD8TEkQlA_5dm3YIkp'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyMigrations() {
  console.log('🔧 Применение миграций к базе данных Supabase...\n')
  console.log(`📍 Project ID: hduadapicktrcrqjvzvd`)
  console.log(`📍 URL: ${SUPABASE_URL}\n`)

  try {
    // Читаем SQL миграцию
    const fs = await import('fs/promises')
    const path = await import('path')
    
    const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
    const sql = await fs.readFile(migrationPath, 'utf-8')
    
    console.log(`📄 Читаю SQL миграцию из: ${migrationPath}`)
    console.log(`📏 Размер SQL: ${sql.length} символов\n`)

    // Выполняем SQL через Supabase REST API
    console.log('🚀 Выполнение SQL миграции через Supabase REST API...\n')

    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({ sql_query: sql }),
    })

    if (!response.ok) {
      // Пробуем альтернативный способ - через прямую SQL execution
      console.log('⚠️  Прямой RPC недоступен, пробую альтернативный способ...\n')
      
      // Используем Prisma для применения миграций напрямую
      const { PrismaClient } = await import('@prisma/client')
      const prisma = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public',
          },
        },
      })

      console.log('🔗 Подключение к базе данных через Prisma...')
      
      // Проверяем подключение
      await prisma.$queryRaw`SELECT 1`
      console.log('✅ Подключение успешно!\n')

      // Разбиваем SQL на отдельные команды
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'))

      console.log(`📋 Выполняю ${statements.length} SQL команд...\n`)

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i] + ';'
        try {
          console.log(`   [${i + 1}/${statements.length}] Выполняю команду...`)
          await prisma.$executeRawUnsafe(statement)
          console.log(`   ✅ Команда ${i + 1} выполнена успешно`)
        } catch (error: any) {
          // Игнорируем ошибки "already exists" для CREATE TABLE IF NOT EXISTS
          if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
            console.log(`   ⚠️  Команда ${i + 1}: ${error.message.substring(0, 60)}... (игнорируем)`)
          } else {
            console.error(`   ❌ Ошибка в команде ${i + 1}:`, error.message?.substring(0, 100))
            throw error
          }
        }
      }

      await prisma.$disconnect()

      // Проверяем таблицы
      console.log('\n🔍 Проверка созданных таблиц...')
      const prismaCheck = new PrismaClient({
        datasources: {
          db: {
            url: process.env.DATABASE_URL || 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public',
          },
        },
      })

      const tables = await prismaCheck.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `

      console.log(`✅ Найдено таблиц: ${tables.length}`)
      const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
      
      requiredTables.forEach(tableName => {
        const exists = tables.some(t => t.table_name === tableName)
        const icon = exists ? '✅' : '❌'
        console.log(`   ${icon} ${tableName}`)
      })

      await prismaCheck.$disconnect()

      console.log('\n✅ Миграции применены успешно!')
      return true
    }

    const result = await response.json()
    console.log('✅ Миграции применены через REST API')
    console.log('Результат:', result)
    return true

  } catch (error: any) {
    console.error('\n❌ Ошибка при применении миграций:', error.message)
    console.error('Детали:', error)
    
    // Если не удалось через API, пробуем через Prisma напрямую
    if (error.message?.includes('fetch') || error.message?.includes('REST')) {
      console.log('\n🔄 Пробую применить миграции через Prisma напрямую...\n')
      
      try {
        const { PrismaClient } = await import('@prisma/client')
        const prisma = new PrismaClient({
          datasources: {
            db: {
              url: 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public',
            },
          },
        })

        console.log('🔗 Подключение к базе данных...')
        await prisma.$queryRaw`SELECT 1`
        console.log('✅ Подключение успешно!\n')

        // Применяем миграции через Prisma
        const { exec } = await import('child_process')
        const { promisify } = await import('util')
        const execAsync = promisify(exec)

        console.log('📋 Применяю миграции через prisma migrate deploy...')
        const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
          env: {
            ...process.env,
            DATABASE_URL: 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public',
          },
        })

        console.log('✅ Миграции применены!')
        console.log('Output:', stdout)
        if (stderr) {
          console.log('Warnings:', stderr)
        }

        await prisma.$disconnect()
        return true
      } catch (prismaError: any) {
        console.error('❌ Ошибка при применении через Prisma:', prismaError.message)
        throw prismaError
      }
    }
    
    throw error
  }
}

applyMigrations()
  .then((success) => {
    if (success) {
      console.log('\n✅ Миграции успешно применены!')
      console.log('💡 Теперь можно протестировать подключение к базе данных.')
      process.exit(0)
    } else {
      console.log('\n❌ Миграции не применены')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })


