const fs = require('fs');
const path = require('path');

/**
 * Скрипт для подготовки Prisma schema для деплоя на Vercel
 * Автоматически переключает provider с SQLite на PostgreSQL при деплое на Vercel
 */

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

if (!fs.existsSync(schemaPath)) {
  console.error('❌ Файл schema.prisma не найден:', schemaPath);
  process.exit(1);
}

let schemaContent = fs.readFileSync(schemaPath, 'utf-8');

// Проверяем текущий provider
const currentProvider = schemaContent.match(/provider\s*=\s*"(\w+)"/)?.[1];

if (isVercel) {
  // На Vercel используем PostgreSQL
  if (currentProvider !== 'postgresql') {
    console.log('🔄 Переключение provider на PostgreSQL для Vercel...');
    
    // Заменяем provider
    schemaContent = schemaContent.replace(
      /provider\s*=\s*"sqlite"/g,
      'provider = "postgresql"'
    );
    
    // Заменяем url на использование переменной окружения
    schemaContent = schemaContent.replace(
      /url\s*=\s*"file:.*?"/g,
      'url      = env("DATABASE_URL")'
    );
    
    fs.writeFileSync(schemaPath, schemaContent, 'utf-8');
    console.log('✅ Schema обновлен для PostgreSQL');
  } else {
    console.log('✅ Schema уже настроен для PostgreSQL');
  }
} else {
  // Локальная разработка - используем SQLite
  if (currentProvider !== 'sqlite') {
    console.log('🔄 Переключение provider на SQLite для локальной разработки...');
    
    schemaContent = schemaContent.replace(
      /provider\s*=\s*"postgresql"/g,
      'provider = "sqlite"'
    );
    
    // Восстанавливаем SQLite URL если его нет
    if (!schemaContent.includes('file:./dev.db')) {
      schemaContent = schemaContent.replace(
        /url\s*=\s*env\("DATABASE_URL"\)/g,
        'url      = "file:./dev.db?journal_mode=WAL&busy_timeout=5000&synchronous=NORMAL&cache_size=-2000"'
      );
    }
    
    fs.writeFileSync(schemaPath, schemaContent, 'utf-8');
    console.log('✅ Schema обновлен для SQLite');
  } else {
    console.log('✅ Schema уже настроен для SQLite');
  }
}

console.log('📋 Текущий provider:', currentProvider || 'не определен');
