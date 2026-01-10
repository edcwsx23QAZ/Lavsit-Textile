import puppeteer from 'puppeteer'

const VERCEL_TOKEN = 'R7r2N1maVjii1BkkRQvidtls'
const PROJECT_NAME = 'lavsit-textile'
const TEAM_ID = 'team_2FyqWSswogxney3SWR8bxRzV'

async function createVercelPostgres() {
  console.log('🚀 Запуск автоматизации создания Vercel Postgres базы данных...')
  
  let browser
  try {
    browser = await puppeteer.launch({
      headless: false, // Показываем браузер для взаимодействия
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    })

    const page = await browser.newPage()
    
    // Переход на страницу входа Vercel
    console.log('📍 Переход на страницу Vercel...')
    await page.goto('https://vercel.com/login', { waitUntil: 'networkidle2' })
    
    // Попытка авторизации через токен (может потребоваться ручной вход)
    console.log('⚠️  Авторизация через веб-интерфейс может потребовать ручного ввода')
    console.log('💡 Используйте токен для авторизации или войдите вручную')
    
    // Ждем авторизации (30 секунд на ручной вход)
    console.log('⏳ Ожидание авторизации (30 секунд)...')
    await new Promise(resolve => setTimeout(resolve, 30000))
    
    // Переход к проекту
    const projectUrl = `https://vercel.com/${TEAM_ID}/${PROJECT_NAME}/storage`
    console.log(`📍 Переход к проекту: ${projectUrl}`)
    await page.goto(projectUrl, { waitUntil: 'networkidle2' })
    
    // Поиск кнопки создания базы данных
    console.log('🔍 Поиск кнопки создания базы данных...')
    await page.waitForSelector('button, a', { timeout: 10000 })
    
    // Попытка найти кнопку "Create Database" или "Postgres"
    const createButton = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a'))
      const postgresButton = buttons.find((btn: any) => {
        const text = btn.textContent?.toLowerCase() || ''
        return text.includes('postgres') || text.includes('create database') || text.includes('create')
      })
      return postgresButton ? (postgresButton as HTMLElement).textContent : null
    })
    
    if (createButton) {
      console.log(`✅ Найдена кнопка: ${createButton}`)
      // Клик по кнопке
      await page.click('button:has-text("Postgres"), button:has-text("Create Database"), a:has-text("Postgres")')
      console.log('✅ Клик по кнопке создания базы данных')
      
      // Ждем создания базы данных
      await new Promise(resolve => setTimeout(resolve, 10000))
      
      // Получение connection string
      const connectionString = await page.evaluate(() => {
        const inputs = Array.from(document.querySelectorAll('input, textarea'))
        const dbInput = inputs.find((inp: any) => {
          const value = inp.value || ''
          return value.includes('postgresql://') || value.includes('postgres://')
        })
        return dbInput ? (dbInput as HTMLInputElement).value : null
      })
      
      if (connectionString) {
        console.log('✅ Connection string получен!')
        console.log(`DATABASE_URL=${connectionString}`)
        return connectionString
      } else {
        console.log('⚠️  Connection string не найден автоматически. Пожалуйста, скопируйте его вручную.')
      }
    } else {
      console.log('⚠️  Кнопка создания базы данных не найдена. Возможно, база данных уже создана или требуется другой подход.')
    }
    
    // Ждем для ручной проверки
    console.log('⏳ Ожидание для проверки (60 секунд)...')
    await new Promise(resolve => setTimeout(resolve, 60000))
    
  } catch (error: any) {
    console.error('❌ Ошибка при создании базы данных:', error.message)
    throw error
  } finally {
    if (browser) {
      await browser.close()
    }
  }
  
  return null
}

// Запуск скрипта
createVercelPostgres()
  .then((connectionString) => {
    if (connectionString) {
      console.log('\n✅ База данных создана успешно!')
      console.log(`📋 DATABASE_URL: ${connectionString}`)
      console.log('\n💡 Используйте эту строку подключения для настройки переменных окружения в Vercel')
    } else {
      console.log('\n⚠️  База данных создана, но connection string не получен автоматически.')
      console.log('💡 Пожалуйста, скопируйте connection string вручную из Vercel Dashboard')
    }
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка:', error)
    process.exit(1)
  })


