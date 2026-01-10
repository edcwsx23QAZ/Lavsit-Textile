import { Client } from 'pg'

// Прямое подключение к PostgreSQL через библиотеку pg
const DATABASE_URL = 'postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public'

async function applyMigrationsViaPostgres() {
  console.log('🔧 Применение миграций через прямое PostgreSQL подключение...\n')
  console.log(`📍 Project ID: hduadapicktrcrqjvzvd\n`)

  try {
    // Импортируем библиотеку pg для прямого подключения
    const { Client } = await import('pg')
    
    const client = new Client({
      connectionString: DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Для Supabase требуется SSL
      }
    })

    console.log('🔗 Подключение к базе данных...')
    await client.connect()
    console.log('✅ Подключение успешно!\n')

    // Читаем SQL миграцию
    const fs = await import('fs')
    const path = await import('path')
    const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', 'init_postgresql', 'migration.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    
    console.log(`📄 SQL миграция загружена (${sql.length} символов)\n`)

    // Разбиваем SQL на отдельные команды
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    console.log(`📋 Выполняю ${statements.length} SQL команд...\n`)

    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';'
      const statementType = statement.substring(0, 30).toUpperCase()
      
      try {
        console.log(`   [${i + 1}/${statements.length}] Выполняю: ${statementType}...`)
        await client.query(statement)
        successCount++
        console.log(`      ✅ Успешно`)
      } catch (error: any) {
        // Игнорируем ошибки "already exists"
        if (error.message?.includes('already exists') || 
            error.message?.includes('duplicate') ||
            (error.message?.includes('relation') && error.message?.includes('already'))) {
          skipCount++
          console.log(`      ⚠️  Уже существует (пропускаем)`)
        } else {
          errorCount++
          console.error(`      ❌ Ошибка: ${error.message?.substring(0, 100)}`)
        }
      }
    }

    console.log(`\n📊 Итоги выполнения:`)
    console.log(`   ✅ Успешно: ${successCount}`)
    console.log(`   ⚠️  Пропущено: ${skipCount}`)
    console.log(`   ❌ Ошибок: ${errorCount}`)

    // Проверяем таблицы
    console.log('\n🔍 Проверка созданных таблиц...')
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `)

    const tables = tablesResult.rows.map((r: any) => r.table_name)
    console.log(`✅ Найдено таблиц: ${tables.length}\n`)

    const requiredTables = ['Supplier', 'Fabric', 'ParsingRule', 'DataStructure', 'EmailAttachment', 'FabricCategory', 'ManualUpload']
    
    requiredTables.forEach(tableName => {
      const exists = tables.includes(tableName)
      const icon = exists ? '✅' : '❌'
      console.log(`   ${icon} ${tableName}`)
    })

    const missingTables = requiredTables.filter(name => !tables.includes(name))

    await client.end()

    if (missingTables.length === 0) {
      console.log('\n✅ Все требуемые таблицы созданы!')
      return true
    } else {
      console.log(`\n⚠️  Отсутствуют таблицы: ${missingTables.join(', ')}`)
      return false
    }

  } catch (error: any) {
    console.error('\n❌ Ошибка подключения:', error.message)
    
    if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ETIMEDOUT')) {
      console.error('\n💡 Возможные причины:')
      console.error('   1. База данных в режиме паузы')
      console.error('   2. Network restrictions (IP whitelist)')
      console.error('   3. Неправильный connection string')
      console.error('   4. Проблемы с firewall')
    }
    
    return false
  }
}

applyMigrationsViaPostgres()
  .then((success) => {
    if (success) {
      console.log('\n✅ Миграции успешно применены!')
      console.log('💡 Теперь можно протестировать подключение к базе данных.')
      console.log('   Проверьте: https://lavsit-textile.vercel.app/api/test-db')
      process.exit(0)
    } else {
      console.log('\n❌ Миграции применены частично')
      process.exit(1)
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })

