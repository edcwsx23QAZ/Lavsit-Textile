const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) {
  console.error('DATABASE_URL не найден!');
  process.exit(1);
}

// Извлекаем компоненты
const urlMatch = originalUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)(.*)/);
if (!urlMatch) {
  console.error('Не удалось распарсить DATABASE_URL');
  process.exit(1);
}

const [, username, password, host, port, database, queryParams] = urlMatch;

console.log('=== Тестирование вариантов подключения ===\n');
console.log('Исходные данные:');
console.log('  Username:', username);
console.log('  Password:', password);
console.log('  Host:', host);
console.log('  Port:', port);
console.log('  Database:', database);
console.log('');

// Вариант 1: Без pgbouncer параметров
const url1 = `postgresql://${username}:${password}@${host}:${port}/${database}?schema=public&connect_timeout=30&sslmode=require`;

// Вариант 2: С URL-кодированием пароля
const encodedPassword = encodeURIComponent(password);
const url2 = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`;

// Вариант 3: Без pgbouncer и с кодированием
const url3 = `postgresql://${username}:${encodedPassword}@${host}:${port}/${database}?schema=public&connect_timeout=30&sslmode=require`;

// Вариант 4: Прямое подключение (если host содержит pooler)
let url4 = null;
if (host.includes('pooler')) {
  const directHost = host.replace('pooler.', '').replace('.supabase.com', '.supabase.co');
  url4 = `postgresql://${username}:${password}@${directHost}:5432/${database}?schema=public&connect_timeout=30&sslmode=require`;
}

const variants = [
  { name: 'Без pgbouncer параметров', url: url1 },
  { name: 'С URL-кодированием пароля', url: url2 },
  { name: 'Без pgbouncer + с кодированием', url: url3 },
];

if (url4) {
  variants.push({ name: 'Прямое подключение (5432)', url: url4 });
}

async function testVariant(name, url) {
  console.log(`\n🔍 Тест: ${name}`);
  console.log(`   URL (первые 80 символов): ${url.substring(0, 80)}...`);
  
  const prisma = new PrismaClient({
    datasources: {
      db: { url }
    },
    log: ['error'],
  });

  try {
    // Подключение
    await prisma.$connect();
    console.log('   ✅ Подключение установлено');
    
    // Простой запрос
    await new Promise(resolve => setTimeout(resolve, 500)); // Небольшая задержка
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('   ✅ Запрос выполнен:', result);
    
    // Проверка таблиц
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      LIMIT 1
    `;
    console.log('   ✅ Таблицы доступны');
    
    await prisma.$disconnect();
    console.log(`   ✅✅✅ ${name} РАБОТАЕТ! ✅✅✅\n`);
    
    return { success: true, url };
  } catch (error) {
    const errorMsg = error.message.substring(0, 150);
    console.log(`   ❌ Ошибка: ${errorMsg}`);
    
    if (error.message.includes('Circuit breaker')) {
      console.log('   ⚠️  Circuit breaker активен');
    } else if (error.message.includes('Authentication')) {
      console.log('   ⚠️  Проблема с аутентификацией');
    } else if (error.message.includes('closed the connection')) {
      console.log('   ⚠️  Сервер закрыл соединение (возможно, неправильный пароль)');
    }
    
    await prisma.$disconnect().catch(() => {});
    return { success: false, error: errorMsg };
  }
}

async function runTests() {
  console.log('⏳ Ожидание 3 секунды перед тестами...\n');
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const results = [];
  
  for (const variant of variants) {
    const result = await testVariant(variant.name, variant.url);
    results.push({ ...variant, ...result });
    
    // Если нашли рабочий вариант, останавливаемся
    if (result.success) {
      console.log('\n🎉 НАЙДЕН РАБОЧИЙ ВАРИАНТ!');
      console.log(`   Вариант: ${variant.name}`);
      console.log(`   URL: ${variant.url}`);
      
      // Обновляем .env.local
      const fs = require('fs');
      const path = require('path');
      const envLocalPath = path.join(__dirname, '..', '.env.local');
      const content = fs.readFileSync(envLocalPath, 'utf8');
      const newContent = content.replace(/DATABASE_URL=.+/, `DATABASE_URL=${variant.url}`);
      fs.writeFileSync(envLocalPath, newContent, 'utf8');
      console.log('   ✅ .env.local обновлен');
      
      return;
    }
    
    // Задержка между тестами
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  console.log('\n❌ Ни один вариант не сработал');
  console.log('\n💡 Рекомендации:');
  console.log('   1. Проверьте пароль в Supabase Dashboard');
  console.log('   2. Убедитесь, что проект не находится в режиме паузы');
  console.log('   3. Попробуйте сбросить пароль в Supabase');
  console.log('   4. Подождите еще 10-15 минут для сброса circuit breaker');
}

runTests().catch(console.error);

