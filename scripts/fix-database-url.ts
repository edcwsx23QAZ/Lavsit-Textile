/**
 * Скрипт для проверки и исправления DATABASE_URL
 * Использует Connection Pooler вместо прямого подключения
 */

const SUPABASE_PROJECT_ID = 'hduadapicktrcrqjvzvd'
const SUPABASE_PASSWORD = 'edcwsx123QAZ!'

// Правильный формат Connection Pooler URL для Supabase
// Формат: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
// Регионы: us-east-1, eu-central-1, ap-southeast-1, и т.д.

// Попробуем разные варианты pooler URL для разных регионов
const poolerUrls = [
  // US East (Virginia)
  `postgresql://postgres.${SUPABASE_PROJECT_ID}:${encodeURIComponent(SUPABASE_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  // EU Central (Frankfurt)
  `postgresql://postgres.${SUPABASE_PROJECT_ID}:${encodeURIComponent(SUPABASE_PASSWORD)}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  // EU West (Ireland)
  `postgresql://postgres.${SUPABASE_PROJECT_ID}:${encodeURIComponent(SUPABASE_PASSWORD)}@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`,
  // AP Southeast (Singapore)
  `postgresql://postgres.${SUPABASE_PROJECT_ID}:${encodeURIComponent(SUPABASE_PASSWORD)}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require`,
]

// Текущий (неправильный) формат
const currentUrl = `postgresql://postgres:${encodeURIComponent(SUPABASE_PASSWORD)}@db.${SUPABASE_PROJECT_ID}.supabase.co:5432/postgres?schema=public`

console.log('🔍 Проверка формата DATABASE_URL...\n')
console.log('❌ Текущий формат (прямое подключение):')
console.log(`   ${currentUrl}\n`)

console.log('✅ Рекомендуемый формат (Connection Pooler):')
poolerUrls.forEach((url, index) => {
  const region = ['US East', 'EU Central', 'EU West', 'AP Southeast'][index]
  console.log(`   ${region}: ${url}\n`)
})

console.log('💡 Инструкция:')
console.log('   1. Определите регион вашего Supabase проекта:')
console.log('      - Откройте: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd')
console.log('      - Перейдите в Settings → General')
console.log('      - Посмотрите "Region"')
console.log('   2. Используйте соответствующий pooler URL из списка выше')
console.log('   3. Обновите DATABASE_URL в Vercel Environment Variables\n')

// Пробуем подключиться через каждый pooler URL
async function testConnection(url: string, name: string) {
  try {
    const { Client } = await import('pg')
    const client = new Client({
      connectionString: url,
      ssl: {
        rejectUnauthorized: false,
      },
    })

    await client.connect()
    const result = await client.query('SELECT 1 as test')
    await client.end()

    return { success: true, name, url }
  } catch (error: any) {
    return { success: false, name, url, error: error.message }
  }
}

async function testAllConnections() {
  console.log('🧪 Тестирование Connection Pooler URLs...\n')

  for (const url of poolerUrls) {
    const region = poolerUrls.indexOf(url)
    const regionName = ['US East', 'EU Central', 'EU West', 'AP Southeast'][region]
    console.log(`   Тестирование ${regionName}...`)
    
    const result = await testConnection(url, regionName)
    if (result.success) {
      console.log(`   ✅ ${regionName}: Подключение успешно!\n`)
      console.log(`   💡 Используйте этот URL для DATABASE_URL:`)
      console.log(`   ${result.url}\n`)
      return result.url
    } else {
      console.log(`   ❌ ${regionName}: ${result.error?.substring(0, 60)}...\n`)
    }
  }

  return null
}

// Если запущен напрямую
if (require.main === module) {
  testAllConnections()
    .then((workingUrl) => {
      if (workingUrl) {
        console.log('✅ Найден рабочий Connection Pooler URL!')
        console.log(`\n📋 Следующие шаги:`)
        console.log(`   1. Обновите DATABASE_URL в Vercel:`)
        console.log(`      vercel env rm DATABASE_URL production --token R7r2N1maVjii1BkkRQvidtls`)
        console.log(`      vercel env add DATABASE_URL production --token R7r2N1maVjii1BkkRQvidtls`)
        console.log(`   2. Вставьте URL при запросе:`)
        console.log(`      ${workingUrl}`)
        console.log(`   3. Повторите для preview и development окружений`)
        console.log(`   4. Выполните redeploy:`)
        console.log(`      vercel --prod --token R7r2N1maVjii1BkkRQvidtls`)
      } else {
        console.log('❌ Не удалось найти рабочий Connection Pooler URL')
        console.log('💡 Попробуйте определить регион вручную через Supabase Dashboard')
      }
      process.exit(workingUrl ? 0 : 1)
    })
    .catch((error) => {
      console.error('❌ Ошибка:', error.message)
      process.exit(1)
    })
}

export { poolerUrls, currentUrl, testConnection }


