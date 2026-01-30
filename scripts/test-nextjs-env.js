// Проверка, как Next.js читает переменные окружения
const fs = require('fs');
const path = require('path');

console.log('=== Проверка переменных окружения ===\n');

// Читаем .env.local
const envLocalPath = path.join(__dirname, '..', '.env.local');
const envLocalContent = fs.readFileSync(envLocalPath, 'utf8');

console.log('1. Содержимое .env.local:');
console.log(envLocalContent);
console.log('');

// Парсим DATABASE_URL
const match = envLocalContent.match(/DATABASE_URL=(.+)/);
if (match) {
  const url = match[1];
  const pwdMatch = url.match(/:\/\/([^:]+):([^@]+)@/);
  
  if (pwdMatch) {
    const username = pwdMatch[1];
    const password = pwdMatch[2];
    
    console.log('2. Извлеченные данные:');
    console.log('   Username:', username);
    console.log('   Password:', password);
    console.log('   Password length:', password.length);
    console.log('   Password bytes (hex):', Buffer.from(password, 'utf8').toString('hex'));
    console.log('');
    
    // Проверяем, нужно ли URL-кодирование
    const needsEncoding = /[^a-zA-Z0-9\-._~!*'();:@&=+$,?#\[\]]/.test(password);
    console.log('3. Нужно ли URL-кодирование:', needsEncoding);
    
    if (needsEncoding) {
      const encodedPassword = encodeURIComponent(password);
      const encodedUrl = url.replace(`:${password}@`, `:${encodedPassword}@`);
      
      console.log('   Закодированный пароль:', encodedPassword);
      console.log('   Новый URL (первые 100 символов):', encodedUrl.substring(0, 100) + '...');
      console.log('');
      
      // Сохраняем вариант с кодированием
      const newContent = envLocalContent.replace(/DATABASE_URL=.+/, `DATABASE_URL=${encodedUrl}`);
      const backupPath = envLocalPath + '.backup';
      fs.writeFileSync(backupPath, envLocalContent, 'utf8');
      console.log('   ✓ Создан backup:', backupPath);
      
      // Пробуем подключение с обоими вариантами
      console.log('\n4. Тестирование подключений...\n');
      
      testConnection(url, 'Без кодирования');
      setTimeout(() => {
        testConnection(encodedUrl, 'С URL-кодированием');
      }, 2000);
    }
  }
}

async function testConnection(url, name) {
  const { PrismaClient } = require('@prisma/client');
  
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: url
      }
    },
    log: ['error'],
  });

  try {
    console.log(`🔍 Тест: ${name}`);
    await prisma.$connect();
    console.log(`   ✅ Подключение установлено`);
    
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log(`   ✅ Запрос выполнен успешно`);
    console.log(`   ✅ ${name} РАБОТАЕТ!\n`);
    
    await prisma.$disconnect();
    
    // Если это работает, обновляем .env.local
    if (name.includes('кодированием')) {
      const envLocalPath = path.join(__dirname, '..', '.env.local');
      const content = fs.readFileSync(envLocalPath, 'utf8');
      const newContent = content.replace(/DATABASE_URL=.+/, `DATABASE_URL=${url}`);
      fs.writeFileSync(envLocalPath, newContent, 'utf8');
      console.log('   ✓ .env.local обновлен с рабочим вариантом\n');
    }
    
    return true;
  } catch (error) {
    console.log(`   ❌ Ошибка: ${error.message.substring(0, 100)}`);
    await prisma.$disconnect().catch(() => {});
    return false;
  }
}

