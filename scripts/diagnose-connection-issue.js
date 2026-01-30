const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

console.log('=== Детальная диагностика подключения ===\n');

// Проверяем, что видит dotenv
console.log('1. Переменные окружения:');
console.log('   DATABASE_URL присутствует:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  const url = process.env.DATABASE_URL;
  const match = url.match(/:\/\/([^:]+):([^@]+)@/);
  if (match) {
    console.log('   Username:', match[1]);
    console.log('   Password (первые 5 символов):', match[2].substring(0, 5) + '...');
    console.log('   Host:', url.match(/@([^:]+)/)?.[1]);
    console.log('   Port:', url.match(/:(\d+)\//)?.[1]);
  }
}
console.log('');

// Тестируем подключение с детальным логированием
async function testConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('2. Попытка подключения...');
    
    // Пробуем подключиться с таймаутом
    const connectPromise = prisma.$connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout')), 10000)
    );
    
    await Promise.race([connectPromise, timeoutPromise]);
    console.log('   ✅ Подключение установлено');
    
    console.log('\n3. Выполнение тестового запроса...');
    const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as current_time`;
    console.log('   ✅ Запрос выполнен:', result);
    
    console.log('\n4. Проверка таблиц...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      LIMIT 5
    `;
    console.log('   ✅ Таблицы найдены:', tables.length);
    
    await prisma.$disconnect();
    console.log('\n✅ Все тесты пройдены успешно!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Ошибка:', error.message);
    console.error('   Код:', error.code);
    console.error('   Детали:', error);
    
    // Анализ ошибки
    if (error.message.includes('Circuit breaker')) {
      console.log('\n🔍 Анализ: Circuit breaker активен');
      console.log('   Это означает, что было слишком много неудачных попыток аутентификации.');
      console.log('   Возможные причины:');
      console.log('   1. Пароль неправильный');
      console.log('   2. Username неправильный');
      console.log('   3. Нужно подождать дольше (до 30 минут)');
      console.log('   4. Нужно сбросить пароль в Supabase Dashboard');
    } else if (error.message.includes('Authentication failed')) {
      console.log('\n🔍 Анализ: Ошибка аутентификации');
      console.log('   Пароль или username неправильные.');
    } else if (error.message.includes('Can\'t reach')) {
      console.log('\n🔍 Анализ: Не удается достичь сервера');
      console.log('   Проверьте hostname и порт в connection string.');
    }
    
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

// Тестируем также прямое подключение (без pooler)
async function testDirectConnection() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  
  // Заменяем pooler на прямое подключение
  const directUrl = url
    .replace('pooler.supabase.com:6543', 'supabase.co:5432')
    .replace('?pgbouncer=true&', '?')
    .replace('&pgbouncer=true', '');
  
  console.log('\n5. Тестирование прямого подключения (без pooler)...');
  console.log('   URL (первые 80 символов):', directUrl.substring(0, 80) + '...');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: directUrl
      }
    },
    log: ['error'],
  });

  try {
    await prisma.$connect();
    console.log('   ✅ Прямое подключение установлено');
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('   ✅ Запрос выполнен');
    
    await prisma.$disconnect();
    console.log('   ✅ Прямое подключение работает!');
    console.log('\n💡 Рекомендация: Используйте прямое подключение временно');
    return true;
  } catch (error) {
    console.log('   ❌ Прямое подключение не работает:', error.message.substring(0, 100));
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

async function runDiagnostics() {
  const result1 = await testConnection();
  
  if (!result1) {
    await testDirectConnection();
  }
  
  console.log('\n=== Диагностика завершена ===');
}

runDiagnostics().catch(console.error);

