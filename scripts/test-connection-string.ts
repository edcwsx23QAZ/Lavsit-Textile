/**
 * Тест connection string с паролем
 */

const password = 'увсцыч123ЙФЯ'
const connectionString = `postgresql://postgres.hduadapicktrcrqjvzvd:${password}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`

console.log('🔍 Проверка connection string с паролем\n')
console.log('─'.repeat(80))

console.log('\n❌ НЕПРАВИЛЬНО (с квадратными скобками):')
console.log('postgresql://postgres.hduadapicktrcrqjvzvd:[увсцыч123ЙФЯ]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres')

console.log('\n✅ ПРАВИЛЬНО (без квадратных скобок):')
console.log(`postgresql://postgres.hduadapicktrcrqjvzvd:${password}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`)

console.log('\n📝 Важно:')
console.log('1. Квадратные скобки [ ] - это placeholder из документации')
console.log('2. В реальном connection string их НЕ должно быть!')
console.log('3. Пароль должен быть без скобок')

// Проверяем, нужно ли URL-encode
const urlEncodedPassword = encodeURIComponent(password)
console.log('\n🔐 URL-encoded пароль (если нужен):')
console.log(`Оригинал: ${password}`)
console.log(`URL-encoded: ${urlEncodedPassword}`)

if (password !== urlEncodedPassword) {
  console.log('\n⚠️ Пароль содержит символы, которые нужно URL-encode!')
  console.log('Используйте URL-encoded версию в connection string.')
  
  const encodedConnectionString = `postgresql://postgres.hduadapicktrcrqjvzvd:${urlEncodedPassword}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`
  console.log('\n✅ Правильный connection string с URL-encoded паролем:')
  console.log(encodedConnectionString)
} else {
  console.log('\n✅ Пароль не требует URL-encoding')
  console.log('Можно использовать как есть (без скобок)')
}

console.log('\n─'.repeat(80))
console.log('\n📋 Итоговые рекомендации:')
console.log('1. Уберите квадратные скобки [ ] из пароля')
console.log('2. Если пароль содержит специальные символы или кириллицу - используйте URL-encoded версию')
console.log('3. Добавьте параметры в конец: ?pgbouncer=true&schema=public&...')
console.log('4. Вставьте в Vercel → DATABASE_URL')
console.log('5. Пересоберите проект')

