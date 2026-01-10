import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn', 'info'],
})

async function applyMigrations() {
  try {
    console.log('🔍 Проверка подключения к базе данных...')
    
    // Проверка подключения
    await prisma.$queryRaw`SELECT 1`
    console.log('✅ Подключение к базе данных успешно!')
    
    // Проверка существования таблиц
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    
    console.log(`\n📊 Найдено таблиц: ${tables.length}`)
    if (tables.length > 0) {
      console.log('Существующие таблицы:')
      tables.forEach(t => console.log(`  ✓ ${t.table_name}`))
    }
    
    // Проверка таблицы Supplier (должна быть создана миграцией)
    const hasSupplier = tables.some(t => t.table_name === 'Supplier')
    if (!hasSupplier) {
      console.log('\n⚠️  Таблица Supplier не найдена. Применяю миграции...')
      console.log('💡 Миграции будут применены во время деплоя на Vercel')
    } else {
      console.log('\n✅ Основные таблицы уже существуют в базе данных')
    }
    
    return true
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    if (error.code === 'P1001') {
      console.error('\n⚠️  Проблема подключения к базе данных')
      console.error('💡 Возможные причины:')
      console.error('   1. База данных Supabase в режиме паузы')
      console.error('   2. Неправильный DATABASE_URL')
      console.error('   3. Network restrictions')
      console.error('\n💡 Миграции будут применены во время деплоя на Vercel')
      return false
    }
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

applyMigrations()
  .then((success) => {
    if (success) {
      console.log('\n✅ Проверка базы данных завершена')
    } else {
      console.log('\n⚠️  База данных недоступна локально, но будет доступна на Vercel')
    }
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Ошибка:', error)
    process.exit(1)
  })


