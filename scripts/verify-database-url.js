/**
 * Скрипт для проверки правильности DATABASE_URL
 */

const databaseUrl = process.env.DATABASE_URL || process.argv[2]

if (!databaseUrl) {
  console.error('❌ DATABASE_URL не указан')
  console.error('Использование: node scripts/verify-database-url.js [DATABASE_URL]')
  console.error('Или установите переменную окружения: DATABASE_URL=...')
  process.exit(1)
}

console.log('🔍 Проверка DATABASE_URL...\n')
console.log('Connection string (первые 50 символов):', databaseUrl.substring(0, 50) + '...\n')

// Проверка 1: Формат
if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
  console.error('❌ Ошибка: Connection string должен начинаться с postgresql:// или postgres://')
  process.exit(1)
}
console.log('✅ Формат правильный (начинается с postgresql://)')

// Проверка 2: Парсинг URL
let parsed
try {
  parsed = new URL(databaseUrl)
} catch (error) {
  console.error('❌ Ошибка парсинга URL:', error.message)
  process.exit(1)
}
console.log('✅ URL парсится корректно')

// Проверка 3: Компоненты
console.log('\n📋 Компоненты connection string:')
console.log('   Protocol:', parsed.protocol)
console.log('   Username:', parsed.username)
console.log('   Password:', parsed.password ? parsed.password.substring(0, 5) + '...' : 'не указан')
console.log('   Hostname:', parsed.hostname)
console.log('   Port:', parsed.port || 'не указан')
console.log('   Pathname:', parsed.pathname)
console.log('   Search params:', parsed.search)

// Проверка 4: Формат для Supabase Pooler
const isPooler = parsed.hostname.includes('.pooler.supabase.com')
const isDirect = parsed.hostname.includes('.supabase.co') && !parsed.hostname.includes('pooler')

if (isPooler) {
  console.log('\n✅ Используется Connection Pooler (pooler.supabase.com)')
  
  // Проверка порта
  if (parsed.port === '6543') {
    console.log('✅ Порт правильный (6543 для pooler)')
  } else {
    console.warn('⚠️  Порт:', parsed.port, '(ожидается 6543 для pooler)')
  }
  
  // Проверка pgbouncer
  if (parsed.searchParams.get('pgbouncer') === 'true') {
    console.log('✅ Параметр pgbouncer=true присутствует')
  } else {
    console.warn('⚠️  Параметр pgbouncer=true отсутствует (рекомендуется для Vercel)')
  }
  
  // Проверка формата username
  if (parsed.username.startsWith('postgres.')) {
    console.log('✅ Username в правильном формате (postgres.[PROJECT_ID])')
    const projectId = parsed.username.replace('postgres.', '')
    console.log('   Project ID:', projectId)
  } else {
    console.warn('⚠️  Username не в формате postgres.[PROJECT_ID]')
  }
} else if (isDirect) {
  console.log('\n⚠️  Используется прямое подключение (не pooler)')
  console.warn('⚠️  Для Vercel рекомендуется использовать Connection Pooler')
} else {
  console.log('\n⚠️  Неизвестный формат hostname')
}

// Проверка 5: Пароль
if (parsed.password) {
  // Проверяем, есть ли специальные символы, которые должны быть URL-encoded
  const hasSpecialChars = /[!@#$%^&*()+\-=\[\]{};':"\\|,.<>\/?]/.test(parsed.password)
  if (hasSpecialChars) {
    console.log('\n⚠️  Пароль содержит специальные символы')
    console.log('   Убедитесь, что они URL-encoded:')
    console.log('   ! → %21')
    console.log('   @ → %40')
    console.log('   # → %23')
    console.log('   $ → %24')
    console.log('   и т.д.')
  } else {
    console.log('\n✅ Пароль не содержит специальных символов, требующих кодирования')
  }
} else {
  console.error('\n❌ Пароль не указан в connection string')
}

// Проверка 6: SSL
if (parsed.searchParams.get('sslmode') === 'require') {
  console.log('✅ SSL mode установлен (sslmode=require)')
} else {
  console.warn('⚠️  SSL mode не установлен (рекомендуется sslmode=require)')
}

// Проверка 7: Schema
if (parsed.searchParams.get('schema') === 'public') {
  console.log('✅ Schema установлен (schema=public)')
} else {
  console.warn('⚠️  Schema не установлен (рекомендуется schema=public)')
}

console.log('\n✅ Проверка завершена')
console.log('\n💡 Если есть предупреждения, исправьте их для лучшей совместимости с Vercel')



