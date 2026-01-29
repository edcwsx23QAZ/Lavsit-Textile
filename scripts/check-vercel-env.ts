/**
 * Скрипт для проверки переменных окружения на Vercel
 * Проверяет наличие и правильность всех необходимых переменных
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface EnvCheck {
  name: string
  required: boolean
  present: boolean
  valid: boolean
  message: string
  value?: string
}

async function checkEnvironmentVariables(): Promise<EnvCheck[]> {
  const checks: EnvCheck[] = []

  // 1. DATABASE_URL - критически важно
  const databaseUrl = process.env.DATABASE_URL
  checks.push({
    name: 'DATABASE_URL',
    required: true,
    present: !!databaseUrl,
    valid: false,
    message: '',
    value: databaseUrl ? maskPassword(databaseUrl) : undefined,
  })

  if (databaseUrl) {
    const isValidFormat = checkDatabaseUrlFormat(databaseUrl)
    checks[checks.length - 1].valid = isValidFormat.valid
    checks[checks.length - 1].message = isValidFormat.message
  } else {
    checks[checks.length - 1].message = 'Переменная отсутствует'
  }

  // 2. NEXT_PUBLIC_SUPABASE_URL - не критично, есть fallback
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  checks.push({
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: false,
    present: !!supabaseUrl,
    valid: supabaseUrl ? supabaseUrl.startsWith('https://') : true,
    message: supabaseUrl 
      ? 'Настроена' 
      : 'Отсутствует, но есть fallback значение в коде',
    value: supabaseUrl,
  })

  // 3. NEXT_PUBLIC_SUPABASE_ANON_KEY - не критично, есть fallback
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  checks.push({
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: false,
    present: !!supabaseKey,
    valid: supabaseKey ? supabaseKey.length > 20 : true,
    message: supabaseKey 
      ? 'Настроена' 
      : 'Отсутствует, но есть fallback значение в коде',
    value: supabaseKey ? maskKey(supabaseKey) : undefined,
  })

  // 4. VERCEL - автоматически устанавливается Vercel
  checks.push({
    name: 'VERCEL',
    required: false,
    present: !!process.env.VERCEL,
    valid: true,
    message: process.env.VERCEL 
      ? 'Обнаружена среда Vercel' 
      : 'Не обнаружена (локальная разработка)',
  })

  // 5. VERCEL_ENV - автоматически устанавливается Vercel
  checks.push({
    name: 'VERCEL_ENV',
    required: false,
    present: !!process.env.VERCEL_ENV,
    valid: true,
    message: process.env.VERCEL_ENV 
      ? `Окружение: ${process.env.VERCEL_ENV}` 
      : 'Не обнаружено',
  })

  return checks
}

function checkDatabaseUrlFormat(url: string): { valid: boolean; message: string } {
  try {
    const urlObj = new URL(url)
    
    // Проверяем, что это PostgreSQL
    if (!url.startsWith('postgresql://') && !url.startsWith('postgres://')) {
      return {
        valid: false,
        message: '❌ Неверный протокол. Должен быть postgresql:// или postgres://',
      }
    }

    // Проверяем формат для Connection Pooler (Vercel)
    const isPooler = urlObj.hostname.includes('pooler.supabase.com')
    const port = urlObj.port || '5432'
    const hasPgbouncer = urlObj.searchParams.get('pgbouncer') === 'true'
    const username = urlObj.username

    if (isPooler) {
      // Проверяем формат username для pooler: postgres.PROJECT_ID
      if (!username.includes('.')) {
        return {
          valid: false,
          message: '❌ Неверный формат username для pooler. Должен быть: postgres.PROJECT_ID',
        }
      }

      if (port !== '6543') {
        return {
          valid: false,
          message: '❌ Неверный порт для pooler. Должен быть 6543',
        }
      }

      if (!hasPgbouncer) {
        return {
          valid: false,
          message: '❌ Отсутствует параметр pgbouncer=true',
        }
      }

      return {
        valid: true,
        message: '✅ Правильный формат Connection Pooler для Vercel',
      }
    } else {
      // Прямое подключение (для локальной разработки)
      if (port === '5432' && urlObj.hostname.includes('.supabase.co')) {
        return {
          valid: true,
          message: '⚠️ Прямое подключение (для локальной разработки). На Vercel используйте pooler!',
        }
      }

      return {
        valid: true,
        message: '✅ Формат подключения',
      }
    }
  } catch (error: any) {
    return {
      valid: false,
      message: `❌ Ошибка парсинга URL: ${error.message}`,
    }
  }
}

async function checkDatabaseConnection(): Promise<{ connected: boolean; error: string | null }> {
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    await prisma.$disconnect()
    return { connected: true, error: null }
  } catch (error: any) {
    await prisma.$disconnect().catch(() => {})
    return {
      connected: false,
      error: error.message || String(error),
    }
  }
}

function maskPassword(url: string): string {
  try {
    const urlObj = new URL(url)
    if (urlObj.password) {
      urlObj.password = '****'
    }
    return urlObj.toString()
  } catch {
    return url.replace(/:[^:@]+@/, ':****@')
  }
}

function maskKey(key: string): string {
  if (key.length <= 20) return '****'
  return `${key.substring(0, 10)}...${key.substring(key.length - 10)}`
}

async function main() {
  console.log('🔍 Проверка переменных окружения...\n')

  const envChecks = await checkEnvironmentVariables()
  
  console.log('📋 Результаты проверки переменных окружения:\n')
  console.log('─'.repeat(80))
  
  let hasErrors = false
  let hasWarnings = false

  for (const check of envChecks) {
    const status = check.valid 
      ? (check.required ? '✅' : 'ℹ️') 
      : (check.required ? '❌' : '⚠️')
    
    const required = check.required ? '[ОБЯЗАТЕЛЬНО]' : '[ОПЦИОНАЛЬНО]'
    
    console.log(`${status} ${check.name} ${required}`)
    console.log(`   ${check.message}`)
    if (check.value) {
      console.log(`   Значение: ${check.value}`)
    }
    console.log()

    if (!check.valid && check.required) {
      hasErrors = true
    } else if (!check.valid) {
      hasWarnings = true
    }
  }

  console.log('─'.repeat(80))
  console.log()

  // Проверка подключения к базе данных
  if (process.env.DATABASE_URL) {
    console.log('🔌 Проверка подключения к базе данных...\n')
    const connectionCheck = await checkDatabaseConnection()
    
    if (connectionCheck.connected) {
      console.log('✅ Подключение к базе данных успешно!\n')
    } else {
      console.log('❌ Ошибка подключения к базе данных:')
      console.log(`   ${connectionCheck.error}\n`)
      hasErrors = true
    }
  } else {
    console.log('⚠️ DATABASE_URL не настроен, пропускаем проверку подключения\n')
    hasErrors = true
  }

  // Итоговый результат
  console.log('─'.repeat(80))
  if (hasErrors) {
    console.log('❌ Обнаружены критические ошибки!')
    console.log('   Необходимо исправить перед деплоем.\n')
    process.exit(1)
  } else if (hasWarnings) {
    console.log('⚠️ Обнаружены предупреждения, но они не критичны.\n')
    process.exit(0)
  } else {
    console.log('✅ Все проверки пройдены успешно!\n')
    process.exit(0)
  }
}

main().catch((error) => {
  console.error('❌ Ошибка при выполнении проверки:', error)
  process.exit(1)
})

