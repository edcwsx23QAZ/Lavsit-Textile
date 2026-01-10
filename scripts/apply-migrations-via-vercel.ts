const VERCEL_APP_URL = 'https://lavsit-textile.vercel.app'

async function applyMigrationsViaVercel() {
  console.log('🔧 Применение миграций через Vercel API endpoint...\n')
  console.log(`📍 URL: ${VERCEL_APP_URL}/api/apply-migrations\n`)

  try {
    console.log('🚀 Отправка запроса на применение миграций...\n')
    
    const response = await fetch(`${VERCEL_APP_URL}/api/apply-migrations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (response.ok && data.success) {
      console.log('✅ Миграции применены успешно!\n')
      console.log('📊 Статистика:')
      console.log(`   Всего команд: ${data.statistics?.totalStatements || 0}`)
      console.log(`   ✅ Успешно: ${data.statistics?.successful || 0}`)
      console.log(`   ⚠️  Пропущено: ${data.statistics?.skipped || 0}`)
      console.log(`   ❌ Ошибок: ${data.statistics?.errors || 0}\n`)
      
      console.log('📋 Таблицы:')
      console.log(`   Всего: ${data.tables?.total || 0}`)
      console.log(`   ✅ Существуют: ${data.tables?.existing?.length || 0}`)
      
      if (data.tables?.existing) {
        data.tables.existing.forEach((table: string) => {
          console.log(`      ✅ ${table}`)
        })
      }
      
      if (data.tables?.missing && data.tables.missing.length > 0) {
        console.log(`   ❌ Отсутствуют: ${data.tables.missing.length}`)
        data.tables.missing.forEach((table: string) => {
          console.log(`      ❌ ${table}`)
        })
      } else {
        console.log(`   ✅ Все таблицы созданы!`)
      }

      return true
    } else {
      console.error('❌ Ошибка при применении миграций')
      console.error('Сообщение:', data.message || data.error)
      console.error('Код:', data.code)
      return false
    }
  } catch (error: any) {
    console.error('❌ Ошибка подключения:', error.message)
    return false
  }
}

applyMigrationsViaVercel()
  .then((success) => {
    if (success) {
      console.log('\n✅ Миграции успешно применены!')
      console.log('💡 Теперь можно протестировать подключение к базе данных.')
      console.log('   Проверьте: https://lavsit-textile.vercel.app/api/test-db')
      process.exit(0)
    } else {
      console.log('\n❌ Миграции не применены')
      console.log('\n💡 Альтернативное решение:')
      console.log('   1. Откройте Supabase SQL Editor: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd')
      console.log('   2. Скопируйте SQL из: prisma/migrations/init_postgresql/migration.sql')
      console.log('   3. Выполните SQL в редакторе')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })

