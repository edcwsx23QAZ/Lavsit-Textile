/**
 * Скрипт для проверки подключения к базе данных на Vercel
 * Выполняет детальную диагностику и выдает рекомендации
 */

import { PrismaClient } from '@prisma/client'
import { checkMigrations } from '../lib/db/safe-query'

async function verifyConnection() {
  console.log('🔍 Проверка подключения к базе данных на Vercel\n')
  console.log('=' .repeat(60))
  
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  const databaseUrl = process.env.DATABASE_URL
  
  // Шаг 1: Проверка переменных окружения
  console.log('\n📋 Шаг 1: Проверка переменных окружения')
  console.log('-'.repeat(60))
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL не найден в переменных окружения!')
    console.error('\n🔧 ИСПРАВЛЕНИЕ:')
    console.error('   1. Откройте Vercel Dashboard → Settings → Environment Variables')
    console.error('   2. Добавьте DATABASE_URL с PostgreSQL connection string')
    console.error('   3. Используйте Connection Pooler (порт 6543)')
    process.exit(1)
  }
  
  console.log('✅ DATABASE_URL найден')
  
  // Шаг 2: Анализ формата DATABASE_URL
  console.log('\n📋 Шаг 2: Анализ формата DATABASE_URL')
  console.log('-'.repeat(60))
  
  try {
    const url = new URL(databaseUrl)
    const hostname = url.hostname
    const port = url.port || '5432'
    const username = url.username
    const hasPgbouncer = url.searchParams.get('pgbouncer') === 'true'
    const hasSchema = url.searchParams.get('schema') === 'public'
    const isPooler = hostname.includes('pooler.supabase.com')
    const isDirect = hostname.includes('.supabase.co') && !hostname.includes('pooler')
    
    console.log(`   Hostname: ${hostname}`)
    console.log(`   Port: ${port} ${port === '6543' ? '✅ (pooler)' : port === '5432' ? '❌ (direct)' : '⚠️'}`)
    console.log(`   Username: ${username.substring(0, 30)}...`)
    console.log(`   pgbouncer=true: ${hasPgbouncer ? '✅' : '❌'}`)
    console.log(`   schema=public: ${hasSchema ? '✅' : '⚠️'}`)
    console.log(`   Использует pooler: ${isPooler ? '✅' : '❌'}`)
    console.log(`   Прямое подключение: ${isDirect ? '❌' : '✅'}`)
    
    if (isDirect || port === '5432') {
      console.error('\n❌ ОБНАРУЖЕНО ПРЯМОЕ ПОДКЛЮЧЕНИЕ!')
      console.error('❌ Это НЕ РАБОТАЕТ на Vercel!\n')
      console.error('🔧 ИСПРАВЛЕНИЕ:')
      console.error('   1. Откройте Supabase Dashboard → Settings → Database')
      console.error('   2. Найдите "Connection string" → "Connection pooling" (НЕ "URI"!)')
      console.error('   3. Выберите "Session mode" или "Transaction mode"')
      console.error('   4. Скопируйте connection string (должен содержать pooler.supabase.com:6543)')
      console.error('   5. Вставьте в Vercel → Settings → Environment Variables → DATABASE_URL')
      console.error('\n📋 Правильный формат:')
      console.error('   postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true')
      process.exit(1)
    }
    
    if (!hasPgbouncer) {
      console.warn('\n⚠️  Рекомендуется добавить параметр pgbouncer=true')
    }
    
    if (!isPooler) {
      console.warn('\n⚠️  Рекомендуется использовать Connection Pooler')
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка парсинга DATABASE_URL:', error.message)
    process.exit(1)
  }
  
  // Шаг 3: Проверка подключения
  console.log('\n📋 Шаг 3: Проверка подключения к базе данных')
  console.log('-'.repeat(60))
  
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    })
    
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Подключение к базе данных успешно')
    
    // Шаг 4: Проверка миграций
    console.log('\n📋 Шаг 4: Проверка миграций')
    console.log('-'.repeat(60))
    
    const migrationsCheck = await checkMigrations()
    
    if (migrationsCheck.migrationsApplied) {
      console.log('✅ Миграции применены')
      console.log(`   Таблиц в базе: ${migrationsCheck.details?.tableCount || 0}`)
      if (migrationsCheck.details?.sampleTables && migrationsCheck.details.sampleTables.length > 0) {
        console.log(`   Примеры таблиц: ${migrationsCheck.details.sampleTables.slice(0, 5).join(', ')}`)
      }
    } else {
      console.error('❌ Миграции не применены!')
      console.error('\n🔧 ИСПРАВЛЕНИЕ:')
      console.error('   1. Откройте Supabase Dashboard → SQL Editor')
      console.error('   2. Выполните SQL из файла: prisma/migrations/init_postgresql/migration-fixed.sql')
      console.error('   3. Или используйте Prisma Migrate: npx prisma migrate deploy')
    }
    
    if (!migrationsCheck.tablesExist) {
      console.warn('⚠️  Таблицы не найдены в базе данных')
      console.warn('   Это может означать, что миграции не применены')
    }
    
    await prisma.$disconnect()
    
    // Итоговый результат
    console.log('\n' + '='.repeat(60))
    if (migrationsCheck.migrationsApplied && migrationsCheck.tablesExist) {
      console.log('✅ ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ УСПЕШНО!')
      console.log('✅ База данных готова к использованию')
    } else {
      console.log('⚠️  ПОДКЛЮЧЕНИЕ РАБОТАЕТ, НО ЕСТЬ ПРОБЛЕМЫ')
      if (!migrationsCheck.migrationsApplied) {
        console.log('   - Примените миграции в Supabase')
      }
      if (!migrationsCheck.tablesExist) {
        console.log('   - Таблицы отсутствуют в базе данных')
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка подключения:', error.message)
    console.error(`   Код ошибки: ${error.code || 'N/A'}`)
    
    console.error('\n🔧 ВОЗМОЖНЫЕ ПРИЧИНЫ:')
    console.error('   1. Неправильный connection string')
    console.error('   2. База данных в режиме паузы')
    console.error('   3. Проблемы с сетью или DNS')
    console.error('   4. Неправильный пароль или project ID')
    console.error('   5. Connection Pooler не включен в Supabase')
    
    console.error('\n📋 РЕКОМЕНДАЦИИ:')
    console.error('   1. Проверьте health endpoint: /api/health')
    console.error('   2. Убедитесь, что используется Connection Pooler (порт 6543)')
    console.error('   3. Проверьте, что база данных не в режиме паузы')
    console.error('   4. Проверьте правильность пароля и project ID')
    
    process.exit(1)
  }
}

// Запускаем проверку
verifyConnection().catch((error) => {
  console.error('❌ Критическая ошибка:', error)
  process.exit(1)
})

