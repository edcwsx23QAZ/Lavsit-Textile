/**
 * Скрипт для настройки переменных окружения Supabase
 * Использует предоставленные credentials для автоматической настройки
 */

// Функция для формирования connection string
function getPoolerConnectionString(password: string): string {
  const projectId = 'hduadapicktrcrqjvzvd'
  const region = 'aws-0-us-east-1'
  const encodedPassword = encodeURIComponent(password)
  
  return `postgresql://postgres.${projectId}:${encodedPassword}@${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`
}

const SUPABASE_URL = 'https://hduadapicktrcrqjvzvd.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq'
const SUPABASE_SERVICE_KEY = 'sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp'

// Пароль базы данных - нужно получить из Supabase Dashboard
// Или использовать переменную окружения SUPABASE_DB_PASSWORD
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD

console.log('🔧 Настройка переменных окружения для Supabase\n')

console.log('📋 Переменные окружения для Vercel:\n')

console.log('1. NEXT_PUBLIC_SUPABASE_URL')
console.log(`   ${SUPABASE_URL}\n`)

console.log('2. NEXT_PUBLIC_SUPABASE_ANON_KEY')
console.log(`   ${SUPABASE_ANON_KEY}\n`)

console.log('3. SUPABASE_SERVICE_ROLE_KEY')
console.log(`   ${SUPABASE_SERVICE_KEY}\n`)

if (DB_PASSWORD) {
  const connectionString = getPoolerConnectionString(DB_PASSWORD)
  console.log('4. DATABASE_URL (сформирован автоматически)')
  console.log(`   ${connectionString}\n`)
  console.log('✅ Connection string сформирован автоматически!')
} else {
  console.log('4. DATABASE_URL')
  console.log('   ⚠️  Пароль базы данных не найден!')
  console.log('   Установите SUPABASE_DB_PASSWORD или DATABASE_PASSWORD')
  console.log('   Или получите connection string из Supabase Dashboard:\n')
  console.log('   Settings → Database → Connection string → Connection pooling → Session mode\n')
}

console.log('\n📝 Инструкция для Vercel:')
console.log('1. Откройте https://vercel.com/dashboard')
console.log('2. Выберите проект lavsit-textile')
console.log('3. Перейдите в Settings → Environment Variables')
console.log('4. Добавьте переменные выше')
console.log('5. Для DATABASE_URL:')
if (DB_PASSWORD) {
  console.log('   - Используйте сформированный connection string выше')
} else {
  console.log('   - Получите из Supabase Dashboard (Connection pooling → Session mode)')
}
console.log('6. Сохраните и перезапустите деплой\n')

console.log('💡 Примечание:')
console.log('   - NEXT_PUBLIC_* переменные доступны в браузере')
console.log('   - SUPABASE_SERVICE_ROLE_KEY используется только на сервере')
console.log('   - DATABASE_URL используется Prisma для подключения к PostgreSQL\n')

