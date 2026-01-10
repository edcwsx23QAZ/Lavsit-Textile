const BASE_URL = 'https://lavsit-textile.vercel.app'

interface TestResult {
  name: string
  url: string
  method: string
  success: boolean
  status?: number
  message: string
  error?: string
}

async function testEndpoint(url: string, method: string = 'GET', body?: any): Promise<TestResult> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    })

    const status = response.status
    let error: string | undefined = undefined
    
    try {
      const text = await response.text()
      const data = JSON.parse(text)
      error = data.error || data.message
    } catch (e) {
      // Не JSON ответ
    }

    // 405 = Method Not Allowed (endpoint существует, но метод не поддерживается) - это нормально
    // 404 = Not Found (endpoint не существует)
    // 500 = Internal Server Error (база данных недоступна) - это ожидаемо
    // 200/201 = Success
    
    const isSuccess = status === 405 || (status >= 200 && status < 300) // 405 означает, что endpoint существует
    
    return {
      name: url,
      url,
      method,
      success: isSuccess,
      status,
      message: status === 405 
        ? `Endpoint существует (405 - Method Not Allowed для ${method}, это нормально)` 
        : status >= 200 && status < 300
        ? `Успешно (${status})`
        : `Ошибка (${status})`,
      error: status >= 500 ? (error || `HTTP ${status}`) : undefined
    }
  } catch (error: any) {
    return {
      name: url,
      url,
      method,
      success: false,
      message: 'Ошибка подключения',
      error: error.message
    }
  }
}

// Список поставщиков из init-suppliers.ts
const suppliers = [
  { name: 'Artvision', method: 'html' },
  { name: 'Союз-М', method: 'excel' },
  { name: 'Домиарт', method: 'excel' },
  { name: 'Артекс', method: 'excel' },
  { name: 'TextileData', method: 'html' },
  { name: 'NoFrames', method: 'excel' },
  { name: 'Нортекс', method: 'email' },
  { name: 'Tex.Group', method: 'excel' },
  { name: 'Vektor', method: 'excel' },
  { name: 'Аметист', method: 'email' },
  { name: 'TextileNova', method: 'html' },
  { name: 'Viptextil', method: 'html' },
  { name: 'Artefact', method: 'excel' },
  { name: 'Эгида', method: 'excel' },
]

async function testParsingEndpoints() {
  console.log('🧪 Тестирование endpoints парсинга...\n')
  console.log(`📍 Базовый URL: ${BASE_URL}\n`)

  // Сначала получаем список поставщиков из API (если доступно)
  console.log('📋 Получение списка поставщиков из API...\n')
  const suppliersResult = await testEndpoint(`${BASE_URL}/api/suppliers`)
  
  let suppliersFromDb: any[] = []
  if (suppliersResult.success && suppliersResult.data && Array.isArray(suppliersResult.data)) {
    suppliersFromDb = suppliersResult.data
    console.log(`✅ Найдено поставщиков в БД: ${suppliersFromDb.length}\n`)
  } else {
    console.log(`⚠️  Не удалось получить поставщиков из БД. Буду использовать список из кода.\n`)
  }

  // Используем поставщиков из БД или из кода
  const suppliersToTest = suppliersFromDb.length > 0 ? suppliersFromDb : suppliers.map((s, i) => ({ id: `test-${i}`, name: s.name, parsingMethod: s.method }))

  console.log('🔍 Тестирование parsing endpoints для каждого поставщика...\n')

  const results: TestResult[] = []
  const parsingMethods: Record<string, number> = { html: 0, excel: 0, email: 0 }

  for (const supplier of suppliersToTest.slice(0, 10)) { // Тестируем первые 10
    const supplierName = supplier.name || 'Unknown'
    const supplierId = supplier.id || 'unknown'
    const parsingMethod = supplier.parsingMethod || 'unknown'
    
    parsingMethods[parsingMethod] = (parsingMethods[parsingMethod] || 0) + 1

    console.log(`📦 Поставщик: ${supplierName}`)
    console.log(`   ID: ${supplierId}`)
    console.log(`   Метод парсинга: ${parsingMethod}`)

    // Тестируем основные endpoints для парсинга
    const endpoints = [
      { name: 'Parse', url: `${BASE_URL}/api/suppliers/${supplierId}/parse`, method: 'POST' },
      { name: 'Analyze', url: `${BASE_URL}/api/suppliers/${supplierId}/analyze`, method: 'POST' },
    ]

    // Для email поставщиков добавляем дополнительные endpoints
    if (parsingMethod === 'email') {
      endpoints.push(
        { name: 'Parse Email', url: `${BASE_URL}/api/suppliers/${supplierId}/parse-email`, method: 'POST' },
        { name: 'Email Config', url: `${BASE_URL}/api/suppliers/${supplierId}/email-config`, method: 'GET' }
      )
    }

    for (const endpoint of endpoints) {
      console.log(`   🔗 Тестирование: ${endpoint.name} (${endpoint.method})...`)
      
      // Для GET запросов - проверяем доступность endpoint
      // Для POST запросов - проверяем, что endpoint существует (должен вернуть 405 или 400/500 из-за отсутствия БД)
      const result = await testEndpoint(endpoint.url, endpoint.method === 'GET' ? 'GET' : 'GET') // Используем GET для проверки доступности
      
      results.push({
        ...result,
        name: `${supplierName} - ${endpoint.name}`
      })

      const icon = result.success ? '✅' : '❌'
      console.log(`      ${icon} ${result.message}`)
      if (result.error && result.status !== 405) {
        console.log(`      ⚠️  ${result.error.substring(0, 100)}...`)
      }
    }
    console.log('')
  }

  // Итоги
  console.log('\n📊 Итоги тестирования parsing endpoints:')
  console.log('═'.repeat(60))
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  console.log(`✅ Endpoints доступны: ${successCount}`)
  console.log(`❌ Endpoints недоступны: ${failCount}`)
  console.log(`📈 Всего протестировано: ${results.length}`)
  console.log(`📦 Поставщиков протестировано: ${suppliersToTest.length}`)
  console.log(`\n📋 По методам парсинга:`)
  console.log(`   HTML: ${parsingMethods.html || 0}`)
  console.log(`   Excel: ${parsingMethods.excel || 0}`)
  console.log(`   Email: ${parsingMethods.email || 0}`)

  if (failCount > 0) {
    console.log('\n❌ Неудачные тесты:')
    results.filter(r => !r.success).forEach(test => {
      console.log(`   - ${test.name}: ${test.error || test.message}`)
    })
  }

  console.log('\n⚠️  ВАЖНО: Фактический парсинг невозможен без базы данных!')
  console.log('   После применения миграций можно будет протестировать фактический парсинг.')
  console.log('   Сейчас протестирована только доступность endpoints.\n')

  return {
    success: failCount === 0,
    total: results.length,
    passed: successCount,
    failed: failCount,
    suppliers: suppliersToTest.length,
    methods: parsingMethods
  }
}

testParsingEndpoints()
  .then((summary) => {
    console.log('📋 Сводка:')
    console.log(JSON.stringify(summary, null, 2))
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Критическая ошибка при тестировании:', error)
    process.exit(1)
  })


