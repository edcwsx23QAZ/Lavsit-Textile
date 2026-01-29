/**
 * Скрипт для проверки статуса деплоя и health endpoint
 */

import https from 'https'

const VERCEL_URL = 'https://lavsit-textile.vercel.app'

interface HealthStatus {
  status: string
  database: {
    connected: boolean
    error: string | null
  }
  environment: {
    hasDatabaseUrl: boolean
    isValidForVercel: boolean
    databaseUrlPreview: string
  }
  message?: string
}

function checkHealth(): Promise<HealthStatus> {
  return new Promise((resolve, reject) => {
    const url = `${VERCEL_URL}/api/health`
    
    https.get(url, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        try {
          const health = JSON.parse(data) as HealthStatus
          resolve(health)
        } catch (error) {
          reject(new Error(`Failed to parse health response: ${error}`))
        }
      })
    }).on('error', (error) => {
      reject(error)
    })
  })
}

async function main() {
  console.log('🔍 Проверка статуса деплоя на Vercel...\n')
  console.log(`URL: ${VERCEL_URL}\n`)
  console.log('─'.repeat(80))

  try {
    const health = await checkHealth()
    
    console.log('\n📊 Результаты проверки:\n')
    
    // Общий статус
    const statusIcon = health.status === 'ok' ? '✅' : health.status === 'warning' ? '⚠️' : '❌'
    console.log(`${statusIcon} Общий статус: ${health.status.toUpperCase()}`)
    
    if (health.message) {
      console.log(`   ${health.message}`)
    }
    
    // Переменные окружения
    console.log('\n📋 Переменные окружения:')
    console.log(`   DATABASE_URL: ${health.environment.hasDatabaseUrl ? '✅ Настроен' : '❌ Отсутствует'}`)
    console.log(`   Формат для Vercel: ${health.environment.isValidForVercel ? '✅ Правильный' : '❌ Неправильный'}`)
    if (health.environment.databaseUrlPreview) {
      console.log(`   Preview: ${health.environment.databaseUrlPreview}`)
    }
    
    // Подключение к базе данных
    console.log('\n🔌 Подключение к базе данных:')
    if (health.database.connected) {
      console.log('   ✅ Подключение успешно!')
    } else {
      console.log('   ❌ Ошибка подключения')
      if (health.database.error) {
        console.log(`   Ошибка: ${health.database.error}`)
      }
    }
    
    // Проверка страниц
    console.log('\n📄 Проверка страниц:')
    const pages = [
      { name: 'Главная', path: '/' },
      { name: 'Ткани', path: '/fabrics' },
      { name: 'Поставщики', path: '/suppliers' },
      { name: 'Категории', path: '/categories' },
      { name: 'Палитра', path: '/palette' },
    ]
    
    for (const page of pages) {
      const url = `${VERCEL_URL}${page.path}`
      console.log(`   ${page.name}: ${url}`)
    }
    
    // Итоговый результат
    console.log('\n─'.repeat(80))
    
    if (health.database.connected && health.environment.isValidForVercel) {
      console.log('\n✅ Все проверки пройдены! Проект работает корректно.')
      process.exit(0)
    } else if (health.environment.hasDatabaseUrl && !health.database.connected) {
      console.log('\n⚠️ DATABASE_URL настроен, но подключение не работает.')
      console.log('   Возможные причины:')
      console.log('   1. Неправильный пароль в DATABASE_URL')
      console.log('   2. База данных Supabase в режиме паузы')
      console.log('   3. Проблемы с сетью')
      console.log('\n   См. URGENT_FIX_PASSWORD.md для инструкций по исправлению.')
      process.exit(1)
    } else if (!health.environment.hasDatabaseUrl) {
      console.log('\n❌ DATABASE_URL не настроен на Vercel!')
      console.log('   Добавьте переменную окружения DATABASE_URL на Vercel.')
      process.exit(1)
    } else {
      console.log('\n❌ Обнаружены проблемы. Проверьте логи выше.')
      process.exit(1)
    }
    
  } catch (error: any) {
    console.error('\n❌ Ошибка при проверке статуса:')
    console.error(`   ${error.message}`)
    console.error('\nВозможные причины:')
    console.error('   1. Проект еще не задеплоен на Vercel')
    console.error('   2. Домен не доступен')
    console.error('   3. Проблемы с сетью')
    process.exit(1)
  }
}

main()

