/**
 * Скрипт для тестирования различных форматов connection string
 */

const { PrismaClient } = require('@prisma/client')

// Варианты connection string для тестирования
const connectionStrings = [
  // Вариант 1: С URL-encoded паролем (текущий)
  {
    name: 'Pooler с URL-encoded паролем',
    url: 'postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require'
  },
  // Вариант 2: Без URL-encoding пароля
  {
    name: 'Pooler без URL-encoding пароля',
    url: 'postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require'
  },
  // Вариант 3: Прямое подключение (для проверки)
  {
    name: 'Прямое подключение (не pooler)',
    url: 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public&sslmode=require'
  },
  // Вариант 4: Pooler с другим форматом username
  {
    name: 'Pooler с простым username',
    url: 'postgresql://postgres:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require'
  }
]

async function testConnection(name, url) {
  console.log(`\n🧪 Тестирование: ${name}`)
  console.log(`   URL: ${url.substring(0, 80)}...`)
  
  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: url
        }
      }
    })
    
    await prisma.$queryRaw`SELECT 1`
    console.log(`   ✅ Успешно подключено!`)
    await prisma.$disconnect()
    return true
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message}`)
    if (error.message.includes('Tenant or user not found')) {
      console.log(`   ⚠️  Это ошибка аутентификации - неправильный пароль или project ID`)
    }
    return false
  }
}

async function main() {
  console.log('🔍 Тестирование различных форматов connection string для Supabase\n')
  
  for (const conn of connectionStrings) {
    const success = await testConnection(conn.name, conn.url)
    if (success) {
      console.log(`\n✅ РАБОТАЮЩИЙ ФОРМАТ НАЙДЕН: ${conn.name}`)
      console.log(`\n📋 Используйте этот connection string в Vercel:`)
      console.log(conn.url)
      break
    }
  }
  
  console.log('\n💡 Если ни один формат не работает, проверьте:')
  console.log('   1. Правильность пароля в Supabase Dashboard')
  console.log('   2. Правильность Project ID')
  console.log('   3. Что база данных не в режиме паузы')
  console.log('   4. Что Connection Pooler включен в Supabase')
}

main().catch(console.error)



