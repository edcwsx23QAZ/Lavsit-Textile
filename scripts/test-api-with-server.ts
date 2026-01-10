/**
 * Автоматический тест всех API endpoints с автоматическим запуском сервера
 * Запуск: tsx scripts/test-api-with-server.ts
 */

import { spawn } from 'child_process'
import * as http from 'http'

const BASE_URL = 'http://localhost:4001'
const TIMEOUT = 60000 // 60 секунд
const SERVER_START_TIMEOUT = 30000 // 30 секунд на запуск сервера

interface TestResult {
  endpoint: string
  success: boolean
  duration: number
  statusCode?: number
  dataSize?: number
  itemCount?: number | string
  error?: string
}

const results: TestResult[] = []
let serverProcess: any = null

function checkServerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(BASE_URL, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 404)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function startServer(): Promise<void> {
  console.log('Запуск сервера Next.js...')
  
  return new Promise((resolve, reject) => {
    serverProcess = spawn('npm', ['run', 'dev'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'pipe',
    })
    
    let serverReady = false
    const startTime = Date.now()
    
    serverProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString()
      if (output.includes('Ready') || output.includes('started server')) {
        if (!serverReady) {
          serverReady = true
          console.log('✅ Сервер запущен')
          resolve()
        }
      }
    })
    
    serverProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString()
      // Игнорируем предупреждения
      if (!output.includes('Warning') && !output.includes('warn')) {
        process.stderr.write(data)
      }
    })
    
    serverProcess.on('error', (error: Error) => {
      reject(error)
    })
    
    // Проверяем готовность сервера периодически
    const checkInterval = setInterval(async () => {
      if (Date.now() - startTime > SERVER_START_TIMEOUT) {
        clearInterval(checkInterval)
        if (!serverReady) {
          reject(new Error('Таймаут запуска сервера'))
        }
      } else if (await checkServerRunning()) {
        if (!serverReady) {
          serverReady = true
          clearInterval(checkInterval)
          console.log('✅ Сервер готов')
          resolve()
        }
      }
    }, 1000)
    
    // Даем серверу время на запуск
    setTimeout(async () => {
      if (await checkServerRunning()) {
        if (!serverReady) {
          serverReady = true
          clearInterval(checkInterval)
          console.log('✅ Сервер готов (проверка соединения)')
          resolve()
        }
      }
    }, 5000)
  })
}

function stopServer(): void {
  if (serverProcess) {
    console.log('\nОстановка сервера...')
    serverProcess.kill('SIGTERM')
    serverProcess = null
  }
}

async function testEndpoint(name: string, url: string): Promise<TestResult> {
  console.log(`\n[Тест] ${name}`)
  console.log(`  URL: ${url}`)
  
  const startTime = Date.now()
  const result: TestResult = {
    endpoint: name,
    success: false,
    duration: 0,
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    clearTimeout(timeoutId)
    const duration = Date.now() - startTime
    result.duration = duration
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Failed to read error text')
      result.error = `HTTP ${response.status} ${response.statusText}: ${errorText.substring(0, 200)}`
      console.log(`  ❌ ОШИБКА: ${response.status} ${response.statusText}`)
      console.log(`  Ответ: ${errorText.substring(0, 200)}`)
      console.log(`  Время: ${duration}ms`)
      return result
    }
    
    const data = await response.json()
    const dataSize = JSON.stringify(data).length
    const itemCount = Array.isArray(data) 
      ? data.length 
      : (data.count !== undefined 
          ? data.count 
          : (data.exclusions !== undefined 
              ? 'object' 
              : 1))
    
    result.success = true
    result.statusCode = response.status
    result.dataSize = dataSize
    result.itemCount = itemCount
    
    console.log(`  ✅ УСПЕХ`)
    console.log(`  Время: ${duration}ms`)
    console.log(`  Размер данных: ${(dataSize / 1024).toFixed(2)} KB`)
    console.log(`  Элементов: ${itemCount}`)
    
    return result
  } catch (error: any) {
    const duration = Date.now() - startTime
    result.duration = duration
    
    if (error.name === 'AbortError') {
      result.error = `Timeout after ${TIMEOUT}ms`
      console.log(`  ❌ ТАЙМАУТ: Запрос был прерван после ${TIMEOUT}ms`)
    } else {
      result.error = error.message || 'Unknown error'
      console.log(`  ❌ ОШИБКА: ${error.message}`)
    }
    console.log(`  Время: ${duration}ms`)
    return result
  }
}

async function runTests() {
  console.log('='.repeat(60))
  console.log('АВТОМАТИЧЕСКОЕ ТЕСТИРОВАНИЕ API ENDPOINTS')
  console.log('='.repeat(60))
  console.log(`Базовый URL: ${BASE_URL}`)
  console.log(`Таймаут: ${TIMEOUT / 1000} секунд`)
  
  try {
    // Проверяем, запущен ли сервер
    const serverRunning = await checkServerRunning()
    if (!serverRunning) {
      console.log('\n⚠️  Сервер не запущен, запускаем автоматически...')
      await startServer()
      // Даем серверу время на полную инициализацию
      console.log('Ожидание инициализации сервера (5 секунд)...')
      await new Promise(resolve => setTimeout(resolve, 5000))
    } else {
      console.log('\n✅ Сервер уже запущен')
    }
    
    // Тест 1: Поставщики
    results.push(await testEndpoint(
      'GET /api/suppliers',
      `${BASE_URL}/api/suppliers`
    ))
    
    // Тест 2: Категории
    results.push(await testEndpoint(
      'GET /api/categories',
      `${BASE_URL}/api/categories`
    ))
    
    // Тест 3: Ткани (самый тяжелый)
    results.push(await testEndpoint(
      'GET /api/fabrics',
      `${BASE_URL}/api/fabrics`
    ))
    
    // Тест 4: Исключения
    results.push(await testEndpoint(
      'GET /api/exclusions',
      `${BASE_URL}/api/exclusions`
    ))
    
    // Итоги
    console.log('\n' + '='.repeat(60))
    console.log('ИТОГИ ТЕСТИРОВАНИЯ')
    console.log('='.repeat(60))
    
    const passed = results.filter(r => r.success).length
    const total = results.length
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / total
    
    console.log(`Успешно: ${passed}/${total}`)
    console.log(`Среднее время: ${avgDuration.toFixed(0)}ms`)
    console.log(`\nДетали:`)
    
    results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      const durationStatus = result.duration > TIMEOUT ? '⚠️  ТАЙМАУТ' : result.duration > 30000 ? '⚠️  МЕДЛЕННО' : ''
      console.log(`  ${status} ${result.endpoint}: ${result.duration}ms ${durationStatus}`)
      if (result.success) {
        console.log(`     - Статус: ${result.statusCode}`)
        console.log(`     - Размер: ${result.dataSize ? (result.dataSize / 1024).toFixed(2) + ' KB' : 'N/A'}`)
        console.log(`     - Элементов: ${result.itemCount}`)
      } else {
        console.log(`     - Ошибка: ${result.error}`)
      }
    })
    
    if (passed === total) {
      console.log('\n✅ Все тесты пройдены!')
      process.exit(0)
    } else {
      console.log('\n❌ Некоторые тесты не прошли')
      process.exit(1)
    }
  } catch (error: any) {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  } finally {
    stopServer()
  }
}

// Обработка сигналов для корректного завершения
process.on('SIGINT', () => {
  stopServer()
  process.exit(0)
})

process.on('SIGTERM', () => {
  stopServer()
  process.exit(0)
})

// Запуск тестов
runTests().catch(error => {
  console.error('Критическая ошибка:', error)
  stopServer()
  process.exit(1)
})




