import { readFileSync } from 'fs'
import { join } from 'path'

const SUPABASE_PROJECT_ID = 'hduadapicktrcrqjvzvd'
const SUPABASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co`
const SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_Nmrfz9rwXqnrD8TEkQlA_5dm3YIkp'

// Supabase Management API endpoint для выполнения SQL
// Но Management API требует OAuth token, который сложно получить программно
// Альтернатива: Использовать Supabase SQL API через их Dashboard API

async function applyMigrationsViaManagementAPI() {
  console.log('🔧 Применение миграций через Supabase Management API...\n')
  console.log(`📍 Project ID: ${SUPABASE_PROJECT_ID}`)
  console.log(`📍 URL: ${SUPABASE_URL}\n`)

  try {
    // Читаем SQL миграцию
    const migrationPath = join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    console.log(`📄 SQL миграция загружена (${sql.length} символов)\n`)

    // Supabase Management API требует access token от OAuth
    // Попробуем использовать их SQL API через REST API
    // Но стандартный REST API не поддерживает произвольный SQL
    
    // Вариант: Использовать Supabase PostgREST для создания таблиц
    // Но PostgREST работает только с существующими таблицами
    
    // Попробуем использовать Supabase SQL Editor API
    // Но для этого нужен Management API token
    
    console.log('⚠️  Supabase Management API требует OAuth access token для выполнения SQL')
    console.log('💡 Используем прямой подход: выполнение SQL через Vercel с правильным connection string\n')
    
    // Проверяем, может ли Vercel подключиться к базе данных
    // Если база данных недоступна даже с Vercel, возможно проблема в network restrictions
    
    console.log('💡 Рекомендация:')
    console.log('   1. Проверьте настройки Network Access в Supabase Dashboard')
    console.log('   2. Убедитесь, что база данных не в режиме паузы')
    console.log('   3. Проверьте правильность DATABASE_URL в Vercel')
    console.log('   4. Примените миграции вручную через Supabase SQL Editor\n')
    
    // Создаем готовый SQL файл для копирования
    console.log('📋 Создаю готовый SQL файл для копирования...')
    const outputPath = join(process.cwd(), 'apply-migrations-now.sql')
    require('fs').writeFileSync(outputPath, sql, 'utf-8')
    console.log(`✅ SQL файл создан: ${outputPath}\n`)
    
    console.log('📝 Инструкция для ручного применения:')
    console.log('   1. Откройте: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd')
    console.log('   2. Перейдите в SQL Editor (левый сайдбар)')
    console.log('   3. Нажмите "New Query"')
    console.log(`   4. Откройте файл: ${outputPath}`)
    console.log('   5. Скопируйте весь SQL скрипт')
    console.log('   6. Вставьте в SQL Editor')
    console.log('   7. Нажмите "Run" или Ctrl+Enter / Cmd+Enter')
    console.log('   8. Дождитесь успешного выполнения (должно появиться "Success. No rows returned")\n')
    
    return false
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    return false
  }
}

// Попробуем использовать Supabase REST API с правильным форматом
async function trySupabaseRESTAPI() {
  console.log('🌐 Попытка использования Supabase REST API...\n')
  
  // Supabase REST API не поддерживает произвольный SQL напрямую
  // Но можно использовать их SQL Editor API через Management API
  // Для этого нужен Management API access token
  
  // Альтернатива: Использовать Supabase CLI
  console.log('💡 Используйте Supabase CLI для применения миграций:')
  console.log('   1. Установите Supabase CLI: npm install -g supabase')
  console.log('   2. Выполните: supabase login')
  console.log(`   3. Выполните: supabase link --project-ref ${SUPABASE_PROJECT_ID}`)
  console.log('   4. Выполните: supabase db push\n')
  
  return false
}

async function main() {
  const success1 = await trySupabaseRESTAPI()
  if (success1) {
    console.log('✅ Миграции применены через REST API')
    process.exit(0)
  }
  
  const success2 = await applyMigrationsViaManagementAPI()
  if (success2) {
    console.log('✅ Миграции применены через Management API')
    process.exit(0)
  }
  
  console.log('\n⚠️  Автоматическое применение миграций невозможно')
  console.log('💡 Используйте ручное применение через Supabase SQL Editor (см. инструкцию выше)')
  process.exit(1)
}

main()

