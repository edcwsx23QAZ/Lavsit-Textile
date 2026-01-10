import { PrismaClient } from '@prisma/client'

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public'

async function checkDatabaseConnection() {
  console.log('🔍 Проверка подключения к базе данных Supabase...\n')
  console.log(`📍 Project ID: hduadapicktrcrqjvzvd`)
  console.log(`📍 URL: https://hduadapicktrcrqjvzvd.supabase.co\n`)

  try {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: DATABASE_URL,
        },
      },
      log: ['error', 'warn'],
    })

    console.log('🔗 Попытка подключения...')
    
    // Простая проверка подключения
    const testQuery = await prisma.$queryRaw`SELECT 1 as test`
    console.log('✅ Подключение успешно!\n')

    // Проверка существования таблиц
    console.log('📋 Проверка существования таблиц...')
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `

    const tableNames = tables.map(t => t.table_name)
    console.log(`\n📊 Найдено таблиц: ${tables.length}\n`)

    if (tables.length === 0) {
      console.log('⚠️  Таблицы не найдены - миграции не применены\n')
      console.log('💡 Нужно применить миграции через Supabase SQL Editor')
    } else {
      console.log('✅ Таблицы найдены:')
      tableNames.forEach(table => {
        console.log(`   ✅ ${table}`)
      })
      console.log('')

      // Проверка требуемых таблиц
      const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
      const missingTables = requiredTables.filter(name => !tableNames.includes(name))
      const existingTables = requiredTables.filter(name => tableNames.includes(name))

      if (missingTables.length > 0) {
        console.log('⚠️  Отсутствуют требуемые таблицы:')
        missingTables.forEach(table => {
          console.log(`   ❌ ${table}`)
        })
        console.log('')
      }

      if (existingTables.length === requiredTables.length) {
        console.log('✅ Все требуемые таблицы присутствуют!\n')
      }

      // Проверка данных
      console.log('📊 Проверка данных в таблицах...')
      try {
        const suppliersCount = await prisma.supplier.count()
        const fabricsCount = await prisma.fabric.count()
        const categoriesCount = await prisma.fabricCategory.count()

        console.log(`   Поставщиков: ${suppliersCount}`)
        console.log(`   Тканей: ${fabricsCount}`)
        console.log(`   Категорий: ${categoriesCount}\n`)
      } catch (error: any) {
        console.log('   ⚠️  Не удалось получить данные (возможно, таблицы пустые)\n')
      }
    }

    await prisma.$disconnect()

    console.log('✅ Проверка завершена успешно!')
    return {
      success: true,
      tablesCount: tables.length,
      tables: tableNames,
    }

  } catch (error: any) {
    console.error('\n❌ Ошибка подключения:', error.message)
    
    if (error.message?.includes('Can\'t reach database server')) {
      console.error('\n💡 Возможные причины:')
      console.error('   1. База данных в режиме паузы (Free tier)')
      console.error('   2. Network restrictions (IP whitelist)')
      console.error('   3. Неправильный DATABASE_URL')
      console.error('   4. Проблемы с DNS')
    } else if (error.message?.includes('authentication') || error.message?.includes('password')) {
      console.error('\n💡 Возможные причины:')
      console.error('   1. Неправильный пароль')
      console.error('   2. Неправильный формат connection string')
    } else if (error.message?.includes('ENOTFOUND')) {
      console.error('\n💡 Возможные причины:')
      console.error('   1. DNS не может разрешить имя хоста')
      console.error('   2. База данных недоступна')
      console.error('   3. Неправильный hostname')
    }

    return {
      success: false,
      error: error.message,
    }
  }
}

checkDatabaseConnection()
  .then((result) => {
    if (result.success) {
      console.log('\n📋 Результат:')
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    } else {
      console.log('\n❌ Подключение не удалось')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })


