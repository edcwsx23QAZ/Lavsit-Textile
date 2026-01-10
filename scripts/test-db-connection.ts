import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

async function testConnection() {
  try {
    console.log('Проверка подключения к базе данных Supabase...')
    
    // Простой запрос для проверки подключения
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Подключение к базе данных успешно!', result)
    
    // Проверка существования таблиц
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
    
    console.log(`✅ Найдено таблиц: ${tables.length}`)
    if (tables.length > 0) {
      console.log('Таблицы в базе данных:')
      tables.forEach(t => console.log(`  - ${t.table_name}`))
    } else {
      console.log('⚠️  Таблицы не найдены. Необходимо применить миграции.')
    }
    
    return true
  } catch (error: any) {
    console.error('❌ Ошибка подключения к базе данных:', error.message)
    if (error.code === 'P1001') {
      console.error('⚠️  Не удалось подключиться к серверу базы данных')
      console.error('💡 Проверьте:')
      console.error('   1. База данных Supabase создана и запущена')
      console.error('   2. DATABASE_URL правильный')
      console.error('   3. Network access настроен в Supabase Dashboard')
    }
    return false
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
  .then((success) => {
    if (success) {
      console.log('\n✅ Тест подключения завершен успешно')
      process.exit(0)
    } else {
      console.log('\n❌ Тест подключения завершен с ошибками')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })

