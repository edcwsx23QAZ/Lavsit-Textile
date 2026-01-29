/**
 * Комплексная проверка настройки проекта на Vercel
 * Проверяет переменные окружения, подключение к БД, и готовность к деплою
 */

import { PrismaClient } from '@prisma/client'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

interface CheckResult {
  name: string
  status: 'success' | 'warning' | 'error'
  message: string
  details?: string
}

async function checkVercelEnvironment(): Promise<CheckResult> {
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_ENV
  
  if (!isVercel) {
    return {
      name: 'Vercel Environment',
      status: 'warning',
      message: 'Не обнаружена среда Vercel (локальная разработка)',
    }
  }

  return {
    name: 'Vercel Environment',
    status: 'success',
    message: `Окружение: ${process.env.VERCEL_ENV || 'production'}`,
  }
}

async function checkDatabaseUrl(): Promise<CheckResult> {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    return {
      name: 'DATABASE_URL',
      status: 'error',
      message: 'Переменная DATABASE_URL не настроена',
    }
  }

  try {
    const url = new URL(databaseUrl)
    const isPooler = url.hostname.includes('pooler.supabase.com')
    const port = url.port || '5432'
    const hasPgbouncer = url.searchParams.get('pgbouncer') === 'true'

    if (isPooler && port === '6543' && hasPgbouncer) {
      return {
        name: 'DATABASE_URL',
        status: 'success',
        message: 'Правильный формат Connection Pooler для Vercel',
        details: `Host: ${url.hostname}, Port: ${port}`,
      }
    } else if (!isPooler && port === '5432') {
      return {
        name: 'DATABASE_URL',
        status: 'warning',
        message: 'Используется прямое подключение (для локальной разработки)',
        details: 'На Vercel рекомендуется использовать Connection Pooler (порт 6543)',
      }
    } else {
      return {
        name: 'DATABASE_URL',
        status: 'error',
        message: 'Неверный формат DATABASE_URL',
        details: `Ожидается pooler.supabase.com:6543 с pgbouncer=true, получено: ${url.hostname}:${port}`,
      }
    }
  } catch (error: any) {
    return {
      name: 'DATABASE_URL',
      status: 'error',
      message: 'Ошибка парсинга DATABASE_URL',
      details: error.message,
    }
  }
}

async function checkDatabaseConnection(): Promise<CheckResult> {
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1 as test`
    await prisma.$disconnect()
    
    return {
      name: 'Database Connection',
      status: 'success',
      message: 'Подключение к базе данных успешно',
    }
  } catch (error: any) {
    await prisma.$disconnect().catch(() => {})
    
    const errorMessage = error.message || String(error)
    let status: 'success' | 'warning' | 'error' = 'error'
    let message = 'Ошибка подключения к базе данных'

    // Проверяем тип ошибки
    if (error.code === 'P1001') {
      message = 'Не удается достичь сервера базы данных'
      status = 'error'
    } else if (error.code === 'P1000') {
      message = 'Ошибка аутентификации'
      status = 'error'
    } else if (error.code === 'P1003') {
      message = 'База данных не существует'
      status = 'error'
    }

    return {
      name: 'Database Connection',
      status,
      message,
      details: errorMessage,
    }
  }
}

async function checkPrismaClient(): Promise<CheckResult> {
  try {
    // Проверяем, что Prisma Client сгенерирован
    const prismaClientPath = require.resolve('@prisma/client')
    return {
      name: 'Prisma Client',
      status: 'success',
      message: 'Prisma Client сгенерирован',
      details: `Path: ${prismaClientPath}`,
    }
  } catch (error: any) {
    return {
      name: 'Prisma Client',
      status: 'error',
      message: 'Prisma Client не сгенерирован',
      details: 'Выполните: npx prisma generate',
    }
  }
}

async function checkSupabaseVariables(): Promise<CheckResult[]> {
  const results: CheckResult[] = []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  results.push({
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    status: supabaseUrl ? 'success' : 'warning',
    message: supabaseUrl 
      ? 'Настроена' 
      : 'Отсутствует (используется fallback значение)',
  })

  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  results.push({
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    status: supabaseKey ? 'success' : 'warning',
    message: supabaseKey 
      ? 'Настроена' 
      : 'Отсутствует (используется fallback значение)',
  })

  return results
}

async function checkBuildReadiness(): Promise<CheckResult> {
  try {
    // Проверяем, что можно выполнить prisma generate
    execSync('npx prisma generate', { 
      stdio: 'pipe',
      timeout: 30000,
    })
    
    return {
      name: 'Build Readiness',
      status: 'success',
      message: 'Проект готов к сборке',
    }
  } catch (error: any) {
    return {
      name: 'Build Readiness',
      status: 'error',
      message: 'Ошибка при генерации Prisma Client',
      details: error.message,
    }
  }
}

async function main() {
  console.log('🔍 Комплексная проверка настройки проекта на Vercel\n')
  console.log('─'.repeat(80))

  const checks: CheckResult[] = []

  // Проверка окружения Vercel
  checks.push(await checkVercelEnvironment())

  // Проверка DATABASE_URL
  checks.push(await checkDatabaseUrl())

  // Проверка подключения к БД
  checks.push(await checkDatabaseConnection())

  // Проверка Prisma Client
  checks.push(await checkPrismaClient())

  // Проверка Supabase переменных
  checks.push(...(await checkSupabaseVariables()))

  // Проверка готовности к сборке
  checks.push(await checkBuildReadiness())

  // Выводим результаты
  console.log('\n📋 Результаты проверки:\n')

  let hasErrors = false
  let hasWarnings = false

  for (const check of checks) {
    const icon = check.status === 'success' ? '✅' : check.status === 'warning' ? '⚠️' : '❌'
    console.log(`${icon} ${check.name}`)
    console.log(`   ${check.message}`)
    if (check.details) {
      console.log(`   Детали: ${check.details}`)
    }
    console.log()

    if (check.status === 'error') hasErrors = true
    if (check.status === 'warning') hasWarnings = true
  }

  console.log('─'.repeat(80))

  // Итоговый результат
  if (hasErrors) {
    console.log('\n❌ Обнаружены критические ошибки!')
    console.log('   Проект не готов к деплою. Исправьте ошибки и повторите проверку.\n')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('\n⚠️ Обнаружены предупреждения')
    console.log('   Проект готов к деплою, но рекомендуется исправить предупреждения.\n')
    process.exit(0)
  } else {
    console.log('\n✅ Все проверки пройдены успешно!')
    console.log('   Проект готов к деплою на Vercel.\n')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('❌ Ошибка при выполнении проверки:', error)
  process.exit(1)
})

