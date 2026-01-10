const BASE_URL = 'https://lavsit-textile.vercel.app'

interface TestResult {
  name: string
  url: string
  success: boolean
  status?: number
  message: string
  error?: string
  data?: any
}

async function testEndpoint(url: string, method: string = 'GET', body?: any): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })

    const status = response.status
    let data: any = null
    
    try {
      const text = await response.text()
      if (text) {
        data = JSON.parse(text)
      }
    } catch (e) {
      // Не JSON ответ
    }

    if (status >= 200 && status < 300) {
      return {
        name: url,
        url,
        success: true,
        status,
        message: `Успешно (${status})`,
        data: data || { html: 'HTML ответ' }
      }
    } else {
      return {
        name: url,
        url,
        success: false,
        status,
        message: `Ошибка (${status})`,
        error: data?.error || data?.message || `HTTP ${status}`,
        data
      }
    }
  } catch (error: any) {
    return {
      name: url,
      url,
      success: false,
      message: 'Ошибка подключения',
      error: error.message
    }
  }
}

async function testAllPages() {
  console.log('🧪 Тестирование всех страниц после деплоя на Vercel...\n')
  console.log(`📍 Базовый URL: ${BASE_URL}\n`)

  const tests: Array<{ name: string; url: string; method?: string }> = [
    // Основные страницы
    { name: 'Главная страница', url: `${BASE_URL}/` },
    { name: 'Категории', url: `${BASE_URL}/categories` },
    { name: 'Ткани', url: `${BASE_URL}/fabrics` },
    { name: 'Поставщики', url: `${BASE_URL}/suppliers` },
    { name: 'Палитра', url: `${BASE_URL}/palette` },
    { name: 'Исключения', url: `${BASE_URL}/exclusions` },
    
    // API endpoints
    { name: 'API: Проверка БД', url: `${BASE_URL}/api/test-db` },
    { name: 'API: Категории', url: `${BASE_URL}/api/categories` },
    { name: 'API: Ткани', url: `${BASE_URL}/api/fabrics` },
    { name: 'API: Поставщики', url: `${BASE_URL}/api/suppliers` },
    { name: 'API: Исключения', url: `${BASE_URL}/api/exclusions` },
  ]

  const results: TestResult[] = []

  for (const test of tests) {
    console.log(`🔍 Тестирование: ${test.name}...`)
    const result = await testEndpoint(test.url, test.method || 'GET')
    results.push(result)
    
    const icon = result.success ? '✅' : '❌'
    console.log(`   ${icon} ${result.message}`)
    if (result.error) {
      console.log(`   ⚠️  Ошибка: ${result.error}`)
    }
    if (result.data && result.data.success !== undefined) {
      console.log(`   📊 Данные: ${JSON.stringify(result.data).substring(0, 100)}...`)
    }
    console.log('')
  }

  // Получаем список поставщиков для тестирования парсинга
  console.log('📋 Получение списка поставщиков для тестирования парсинга...\n')
  const suppliersResult = await testEndpoint(`${BASE_URL}/api/suppliers`)
  
  let suppliers: any[] = []
  if (suppliersResult.success && suppliersResult.data && Array.isArray(suppliersResult.data)) {
    suppliers = suppliersResult.data
    console.log(`✅ Найдено поставщиков: ${suppliers.length}\n`)
  } else {
    console.log(`❌ Не удалось получить список поставщиков\n`)
  }

  // Тестирование парсинга для каждого поставщика (без фактического запуска)
  console.log('🔍 Анализ поставщиков для парсинга...\n')
  
  for (const supplier of suppliers.slice(0, 5)) { // Тестируем первые 5 поставщиков
    const supplierName = supplier.name || 'Unknown'
    const parsingMethod = supplier.parsingMethod || 'unknown'
    const supplierId = supplier.id

    console.log(`📦 Поставщик: ${supplierName}`)
    console.log(`   ID: ${supplierId}`)
    console.log(`   Метод парсинга: ${parsingMethod}`)
    console.log(`   Статус: ${supplier.status || 'unknown'}`)
    console.log(`   Тканей: ${supplier.fabricsCount || 0}`)

    // Тестируем endpoint парсинга (только проверка доступности, не запускаем фактический парсинг)
    const parseUrl = `${BASE_URL}/api/suppliers/${supplierId}/parse`
    console.log(`   🔗 Проверка endpoint: ${parseUrl}`)
    
    // Не запускаем фактический парсинг, так как это может быть долго
    // Просто проверяем, что endpoint доступен (должен вернуть метод не разрешен для GET или подобное)
    const parseTest = await testEndpoint(parseUrl, 'GET')
    if (parseTest.status === 405) {
      console.log(`   ✅ Endpoint доступен (405 - Method Not Allowed для GET, это нормально для POST endpoint)`)
    } else if (parseTest.status === 404) {
      console.log(`   ⚠️  Endpoint не найден`)
    } else {
      console.log(`   ${parseTest.success ? '✅' : '❌'} ${parseTest.message}`)
    }
    console.log('')
  }

  // Итоги
  console.log('\n📊 Итоги тестирования:')
  console.log('═'.repeat(50))
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  console.log(`✅ Успешно: ${successCount}`)
  console.log(`❌ Ошибок: ${failCount}`)
  console.log(`📈 Всего страниц/API: ${results.length}`)
  console.log(`📦 Поставщиков найдено: ${suppliers.length}`)

  if (failCount > 0) {
    console.log('\n❌ Неудачные тесты:')
    results.filter(r => !r.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.error || test.message}`)
    })
  }

  console.log('\n✅ Тестирование завершено!')
  
  return {
    success: failCount === 0,
    total: results.length,
    passed: successCount,
    failed: failCount,
    suppliers: suppliers.length
  }
}

testAllPages()
  .then((summary) => {
    console.log('\n📋 Сводка:')
    console.log(JSON.stringify(summary, null, 2))
    process.exit(summary.failed > 0 ? 1 : 0)
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка при тестировании:', error)
    process.exit(1)
  })

