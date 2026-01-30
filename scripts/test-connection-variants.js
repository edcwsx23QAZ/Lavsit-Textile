const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

// Вариант 1: Текущий URL с pooler (порт 6543)
const url1 = process.env.DATABASE_URL;

// Вариант 2: Прямое подключение (порт 5432) - может обойти circuit breaker
const url2 = url1?.replace(':6543', ':5432').replace('pooler.', '').replace('?pgbouncer=true&', '?');

// Вариант 3: URL без pgbouncer параметров
const url3 = url1?.replace('&pgbouncer=true', '');

console.log('=== Тестирование вариантов подключения ===\n');
console.log('Вариант 1 (Pooler, порт 6543):');
console.log(url1?.substring(0, 80) + '...\n');

console.log('Вариант 2 (Прямое подключение, порт 5432):');
console.log(url2?.substring(0, 80) + '...\n');

async function testConnection(url, name) {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    },
    log: ['error'],
  });

  try {
    console.log(`\n🔍 Тестирование: ${name}`);
    await prisma.$connect();
    console.log(`✅ ${name}: Подключение успешно!`);
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log(`✅ ${name}: Запрос выполнен успешно`);
    
    await prisma.$disconnect();
    return true;
  } catch (error) {
    console.log(`❌ ${name}: ${error.message}`);
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

async function runTests() {
  // Ждем немного перед тестами
  console.log('⏳ Ожидание 5 секунд перед тестами...\n');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Тестируем варианты
  const results = [];
  
  if (url2) {
    results.push(await testConnection(url2, 'Прямое подключение (5432)'));
  }
  
  if (url3) {
    results.push(await testConnection(url3, 'Pooler без pgbouncer параметра'));
  }
  
  if (url1) {
    results.push(await testConnection(url1, 'Текущий URL (Pooler 6543)'));
  }

  console.log('\n=== Результаты ===');
  const success = results.find(r => r === true);
  if (success) {
    console.log('✅ Найден рабочий вариант подключения!');
  } else {
    console.log('❌ Все варианты не сработали. Возможно, circuit breaker все еще активен.');
    console.log('💡 Рекомендация: Подождите 5-10 минут и попробуйте снова.');
  }
}

runTests().catch(console.error);

