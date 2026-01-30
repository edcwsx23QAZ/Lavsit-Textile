const fs = require('fs');
const path = require('path');

console.log('=== Исправление подключения к базе данных ===\n');

// Исходный пароль от пользователя
const password = 'увсцыч123ЙФЯ';

// Вариант 1: Без URL-кодирования (PostgreSQL может принимать UTF-8 напрямую)
const url1 = `postgresql://postgres.hduadapicktrcrqjvzvd:${password}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`;

// Вариант 2: С URL-кодированием
const encodedPassword = encodeURIComponent(password);
const url2 = `postgresql://postgres.hduadapicktrcrqjvzvd:${encodedPassword}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`;

console.log('Вариант 1 (без кодирования):');
console.log(url1.substring(0, 80) + '...\n');

console.log('Вариант 2 (с URL-кодированием):');
console.log(url2.substring(0, 80) + '...\n');

// Используем вариант без кодирования (PostgreSQL connection strings обычно принимают UTF-8)
const envLocalPath = path.join(__dirname, '..', '.env.local');
const content = `DATABASE_URL=${url1}
LOCAL_PARSER_PORT=4003
`;

fs.writeFileSync(envLocalPath, content, 'utf8');

console.log('✅ Файл .env.local обновлен с паролем без URL-кодирования');
console.log('   PostgreSQL connection strings обычно принимают UTF-8 напрямую\n');

console.log('📝 Следующие шаги:');
console.log('   1. Подождите 5-10 минут для сброса circuit breaker в Supabase');
console.log('   2. Полностью перезапустите dev сервер');
console.log('   3. Проверьте подключение\n');

