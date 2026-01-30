const fs = require('fs');
const path = require('path');

// Пароль с кириллицей
const password = 'увсцыч123ЙФЯ';

// Правильное URL-кодирование
const encodedPassword = encodeURIComponent(password);

// Создаем DATABASE_URL с закодированным паролем
const dbUrl = `postgresql://postgres.hduadapicktrcrqjvzvd:${encodedPassword}@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`;

// Содержимое файла .env.local
const content = `DATABASE_URL=${dbUrl}
LOCAL_PARSER_PORT=4003
`;

// Записываем файл
const envLocalPath = path.join(__dirname, '..', '.env.local');
fs.writeFileSync(envLocalPath, content, 'utf8');

console.log('✓ Файл .env.local обновлен с правильно закодированным паролем');
console.log(`\nЗакодированный пароль: ${encodedPassword}`);
console.log(`\nDATABASE_URL (первые 80 символов): ${dbUrl.substring(0, 80)}...`);

