const BASE_URL = 'https://lavsit-textile.vercel.app'

async function checkDatabaseViaVercel() {
  console.log('🔍 Проверка подключения к базе данных через Vercel API...\n')
  console.log(`📍 URL: ${BASE_URL}/api/test-db\n`)

  try {
    const response = await fetch(`${BASE_URL}/api/test-db`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    console.log(`📊 HTTP Status: ${response.status}`)
    console.log(`📊 Success: ${data.success}\n`)

    if (response.ok && data.success) {
      console.log('✅ База данных доступна!\n')
      console.log(`📋 Найдено таблиц: ${data.tablesCount || 0}`)
      
      if (data.tables && data.tables.length > 0) {
        console.log('\n✅ Таблицы:')
        data.tables.forEach((table: string) => {
          console.log(`   ✅ ${table}`)
        })
      }

      if (data.hasRequiredTables) {
        console.log('\n📊 Проверка требуемых таблиц:')
        const required = data.hasRequiredTables
        Object.keys(required).forEach(table => {
          const icon = required[table] ? '✅' : '❌'
          console.log(`   ${icon} ${table}`)
        })
      }

      if (data.tablesCount === 0) {
        console.log('\n⚠️  ВНИМАНИЕ: Таблицы не найдены!')
        console.log('💡 Необходимо применить миграции через Supabase SQL Editor')
        console.log('   См. инструкцию: APPLY_MIGRATIONS_INSTRUCTIONS.md')
      }

      return true
    } else {
      console.log('❌ База данных недоступна\n')
      console.log(`⚠️  Ошибка: ${data.error || data.message || 'Unknown error'}`)
      
      if (data.message) {
        console.log(`\n💡 Сообщение: ${data.message}`)
      }

      if (data.code) {
        console.log(`\n📋 Код ошибки: ${data.code}`)
      }

      return false
    }
  } catch (error: any) {
    console.error('❌ Ошибка подключения:', error.message)
    return false
  }
}

checkDatabaseViaVercel()
  .then((success) => {
    if (success) {
      console.log('\n✅ Проверка завершена успешно!')
      process.exit(0)
    } else {
      console.log('\n❌ Проверка завершена с ошибками')
      console.log('\n💡 Рекомендации:')
      console.log('   1. Проверьте статус базы данных в Supabase Dashboard')
      console.log('   2. Убедитесь, что база данных не в режиме паузы')
      console.log('   3. Проверьте DATABASE_URL в Vercel Environment Variables')
      console.log('   4. Если миграции не применены, примените их через SQL Editor')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })


