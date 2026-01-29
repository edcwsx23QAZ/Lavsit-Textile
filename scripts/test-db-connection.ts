/**
 * Скрипт для проверки подключения к базе данных
 * Можно использовать для диагностики проблем на Vercel
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info'],
})

async function testConnection() {
  console.log('🔍 Проверка подключения к базе данных...\n')

  // Проверяем DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.log('❌ DATABASE_URL не настроен!')
    console.log('   Установите переменную окружения DATABASE_URL')
    process.exit(1)
  }

  console.log('✅ DATABASE_URL найден')
  
  // Парсим URL для диагностики
  try {
    const url = new URL(databaseUrl)
    console.log(`   Hostname: ${url.hostname}`)
    console.log(`   Port: ${url.port || '5432'}`)
    console.log(`   Database: ${url.pathname.replace('/', '')}`)
    console.log(`   Username: ${url.username}`)
    
    const isPooler = url.hostname.includes('pooler.supabase.com')
    const port = url.port || '5432'
    const hasPgbouncer = url.searchParams.get('pgbouncer') === 'true'
    
    console.log(`\n📊 Анализ connection string:`)
    console.log(`   Connection Pooler: ${isPooler ? '✅ Да' : '❌ Нет'}`)
    console.log(`   Port: ${port} ${port === '6543' ? '✅ (правильный для pooler)' : port === '5432' ? '⚠️ (прямое подключение)' : '❌ (неправильный)'}`)
    console.log(`   pgbouncer=true: ${hasPgbouncer ? '✅' : '❌'}`)
    
    if (isPooler && port === '6543' && hasPgbouncer) {
      console.log('\n✅ Формат connection string правильный для Vercel!')
    } else if (!isPooler && port === '5432') {
      console.log('\n⚠️ Используется прямое подключение (для локальной разработки)')
      console.log('   На Vercel рекомендуется использовать Connection Pooler (порт 6543)')
    } else {
      console.log('\n❌ Неправильный формат connection string!')
      console.log('   Для Vercel используйте: postgresql://postgres.PROJECT_ID:[PASSWORD]@REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public')
    }
  } catch (error: any) {
    console.log(`\n❌ Ошибка парсинга DATABASE_URL: ${error.message}`)
  }

  // Пробуем подключиться
  console.log('\n🔌 Попытка подключения к базе данных...\n')
  
  try {
    await prisma.$connect()
    console.log('✅ Подключение установлено!')
    
    // Пробуем простой запрос
    try {
      const result = await prisma.$queryRaw`SELECT 1 as test`
      console.log('✅ Тестовый запрос выполнен успешно')
      console.log(`   Результат: ${JSON.stringify(result)}`)
    } catch (queryError: any) {
      console.log('⚠️ Подключение есть, но запрос не выполнен:')
      console.log(`   ${queryError.message}`)
    }
    
    // Проверяем наличие таблиц
    try {
      const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        LIMIT 5
      `
      console.log(`\n📋 Найдено таблиц в схеме public: ${tables.length}`)
      if (tables.length > 0) {
        console.log('   Примеры:')
        tables.slice(0, 5).forEach(table => {
          console.log(`   - ${table.tablename}`)
        })
      }
    } catch (tableError: any) {
      console.log(`\n⚠️ Не удалось получить список таблиц: ${tableError.message}`)
    }
    
    await prisma.$disconnect()
    console.log('\n✅ Проверка завершена успешно!')
    process.exit(0)
    
  } catch (error: any) {
    await prisma.$disconnect().catch(() => {})
    
    console.log('❌ Ошибка подключения к базе данных!')
    console.log(`\nДетали ошибки:`)
    console.log(`   Код: ${error.code || 'N/A'}`)
    console.log(`   Сообщение: ${error.message || String(error)}`)
    
    // Анализ ошибки
    if (error.code === 'P1001') {
      console.log('\n🔍 Анализ:')
      console.log('   Код P1001 означает "Can\'t reach database server"')
      console.log('   Возможные причины:')
      console.log('   1. База данных Supabase находится в режиме паузы')
      console.log('   2. Неправильный hostname или порт в DATABASE_URL')
      console.log('   3. Проблемы с сетью или firewall')
      console.log('   4. Используется прямое подключение вместо Connection Pooler на Vercel')
    } else if (error.code === 'P1000') {
      console.log('\n🔍 Анализ:')
      console.log('   Код P1000 означает "Authentication failed"')
      console.log('   Возможные причины:')
      console.log('   1. Неправильный пароль в DATABASE_URL')
      console.log('   2. Неправильный username (для pooler должен быть postgres.PROJECT_ID)')
      console.log('   3. Пароль содержит специальные символы и не URL-encoded')
    } else if (error.code === 'P1003') {
      console.log('\n🔍 Анализ:')
      console.log('   Код P1003 означает "Database does not exist"')
      console.log('   Возможные причины:')
      console.log('   1. Неправильное имя базы данных в connection string')
      console.log('   2. База данных была удалена')
    }
    
    process.exit(1)
  }
}

testConnection().catch((error) => {
  console.error('❌ Неожиданная ошибка:', error)
  process.exit(1)
})
