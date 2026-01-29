/**
 * Скрипт для проверки настройки Vercel
 * Проверяет наличие DATABASE_URL и правильность конфигурации
 */

console.log('🔍 Проверка настройки Vercel...\n');

// Проверяем переменные окружения
const databaseUrl = process.env.DATABASE_URL;
const vercelEnv = process.env.VERCEL;
const vercelEnvName = process.env.VERCEL_ENV;

console.log('📋 Переменные окружения:');
console.log(`   VERCEL: ${vercelEnv || 'не установлена'}`);
console.log(`   VERCEL_ENV: ${vercelEnvName || 'не установлена'}`);
console.log(`   DATABASE_URL: ${databaseUrl ? '✅ установлена' : '❌ не установлена'}`);

if (databaseUrl) {
  console.log('\n📊 Анализ DATABASE_URL:');
  
  // Проверяем тип базы данных
  if (databaseUrl.includes('postgresql://') || databaseUrl.includes('postgres://')) {
    console.log('   ✅ Тип: PostgreSQL');
  } else if (databaseUrl.includes('sqlite://') || databaseUrl.includes('file:')) {
    console.log('   ⚠️  Тип: SQLite (не работает на Vercel!)');
    console.log('   💡 Нужно использовать PostgreSQL для Vercel');
  } else {
    console.log('   ⚠️  Неизвестный тип базы данных');
  }
  
  // Проверяем наличие pgbouncer (для Supabase)
  if (databaseUrl.includes('pgbouncer=true')) {
    console.log('   ✅ Используется Connection Pooler (pgbouncer)');
  } else {
    console.log('   ⚠️  Connection Pooler не обнаружен');
    console.log('   💡 Для Supabase рекомендуется использовать pgbouncer=true');
  }
  
  // Проверяем URL-encoding пароля
  if (databaseUrl.includes('%21') || databaseUrl.includes('%40')) {
    console.log('   ✅ Пароль URL-encoded');
  } else if (databaseUrl.includes('!') || databaseUrl.includes('@')) {
    console.log('   ⚠️  Пароль может требовать URL-encoding');
  }
} else {
  console.log('\n❌ DATABASE_URL не установлена!');
  console.log('\n💡 Инструкция:');
  console.log('   1. Откройте Vercel Dashboard');
  console.log('   2. Перейдите в Settings → Environment Variables');
  console.log('   3. Добавьте DATABASE_URL с PostgreSQL connection string');
  console.log('   4. Пример: postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true');
}

console.log('\n📋 Проверка схемы Prisma:');
const fs = require('fs');
const path = require('path');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

if (fs.existsSync(schemaPath)) {
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  
  if (schemaContent.includes('provider = "postgresql"')) {
    console.log('   ✅ Схема настроена на PostgreSQL');
  } else if (schemaContent.includes('provider = "sqlite"')) {
    console.log('   ⚠️  Схема настроена на SQLite');
    if (vercelEnv || vercelEnvName) {
      console.log('   💡 Скрипт prepare-vercel-schema.js должен переключить на PostgreSQL');
    }
  }
  
  // Проверяем наличие поля lastParsedCount
  if (schemaContent.includes('lastParsedCount')) {
    console.log('   ✅ Поле lastParsedCount присутствует в схеме');
  } else {
    console.log('   ⚠️  Поле lastParsedCount отсутствует в схеме');
  }
} else {
  console.log('   ❌ Файл schema.prisma не найден');
}

console.log('\n✅ Проверка завершена');



