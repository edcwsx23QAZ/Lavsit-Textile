/**
 * Утилиты для безопасного выполнения запросов к базе данных
 * Всегда возвращают результат, даже при ошибках подключения
 */

import { prisma } from './prisma'

// Динамический импорт Supabase для fallback
let supabaseAdmin: any = null
try {
  const supabaseModule = require('@/lib/supabase/client')
  supabaseAdmin = supabaseModule.supabaseAdmin
} catch (error) {
  // Supabase не доступен
  supabaseAdmin = null
}

export interface SafeQueryResult<T> {
  data: T | null
  error: string | null
  isConnectionError: boolean
}

/**
 * Безопасное выполнение запроса к базе данных с fallback через Supabase API
 */
export async function safeQuery<T>(
  query: () => Promise<T>,
  options?: {
    useSupabaseFallback?: boolean
    supabaseTable?: string
    supabaseSelect?: string
  }
): Promise<SafeQueryResult<T>> {
  try {
    const data = await query()
    return {
      data,
      error: null,
      isConnectionError: false,
    }
  } catch (error: any) {
    console.error('[safeQuery] Error:', error)
    
    // Если включен fallback и Supabase доступен, пробуем через Supabase API
    if (options?.useSupabaseFallback && supabaseAdmin && options.supabaseTable) {
      const isConnectionError = 
        error.code === 'P1001' || 
        error.code === 'P1000' || 
        error.message?.includes("Can't reach database") ||
        error.message?.includes('Connection')
      
      if (isConnectionError) {
        console.log('[safeQuery] Пробую fallback через Supabase API...')
        try {
          const { data: supabaseData, error: supabaseError } = await supabaseAdmin
            .from(options.supabaseTable)
            .select(options.supabaseSelect || '*')
            .limit(1000)
          
          if (!supabaseError && supabaseData) {
            console.log('[safeQuery] ✅ Fallback через Supabase API успешен')
            return {
              data: supabaseData as T,
              error: null,
              isConnectionError: false,
            }
          }
        } catch (supabaseError: any) {
          console.error('[safeQuery] Supabase fallback failed:', supabaseError)
        }
      }
    }
    
    // Проверяем, является ли это ошибкой подключения
    const isConnectionError = 
      error.code === 'P1001' || // Can't reach database server
      error.code === 'P1000' || // Authentication failed
      error.code === 'P1017' || // Server has closed the connection
      error.code === 'P1003' || // Database does not exist
      error.code === 'P1011' || // TLS connection error
      error.code === 'P1002' || // Database server closed the connection
      error.code === 'P1008' || // Operations timed out
      error.code === 'P1009' || // Database already exists
      error.code === 'P1010' || // User was denied access
      error.code === 'P1012' || // Native query returned an error
      error.code === 'P1013' || // Invalid database string
      error.code === 'P1014' || // The underlying model for this query does not exist
      error.code === 'P1015' || // Unsupported feature
      error.code === 'P1016' || // Incorrect number of parameters
      error.code === 'P1018' || // Value out of range
      error.code === 'P1019' || // Value too long
      error.code === 'P1020' || // Record not found
      error.code === 'P1021' || // Table does not exist
      error.code === 'P1022' || // Unique constraint failed
      error.code === 'P1023' || // Foreign key constraint failed
      error.code === 'P1024' || // Invalid connection string
      error.code === 'P1025' || // Index does not exist
      error.code === 'P1026' || // Invalid value for field
      error.code === 'P1027' || // Invalid value for field type
      error.code === 'P1028' || // Invalid value for field format
      error.code === 'P1029' || // Invalid value for field length
      error.message?.includes('Can\'t reach database') ||
      error.message?.includes('Connection') ||
      error.message?.includes('timeout') ||
      error.message?.includes('ECONNREFUSED') ||
      error.message?.includes('ENOTFOUND') ||
      error.message?.includes('ETIMEDOUT') ||
      error.message?.includes('EHOSTUNREACH') ||
      error.message?.includes('ENETUNREACH') ||
      error.message?.includes('ECONNRESET') ||
      error.message?.includes('EPIPE') ||
      error.message?.includes('SSL') ||
      error.message?.includes('TLS') ||
      error.message?.includes('certificate') ||
      error.message?.includes('Tenant or user not found') ||
      error.message?.includes('database string is invalid') ||
      error.message?.includes('P1001') ||
      error.message?.includes('P1000') ||
      error.message?.includes('P1013') ||
      error.message?.includes('P1024')

    return {
      data: null,
      error: error.message || 'Unknown error',
      isConnectionError,
    }
  }
}

/**
 * Проверка наличия миграций в базе данных
 */
export async function checkMigrations(): Promise<{
  migrationsApplied: boolean
  tablesExist: boolean
  error: string | null
  details: {
    hasMigrationsTable: boolean
    tableCount: number
    sampleTables: string[]
  } | null
}> {
  try {
    const databaseUrl = process.env.DATABASE_URL || ''
    const isSqlite = databaseUrl.includes('sqlite://') || databaseUrl.includes('file:')
    
    if (isSqlite) {
      // Для SQLite используем другой подход
      try {
        // Пробуем получить список таблиц через PRAGMA
        const tables = await prisma.$queryRaw<Array<{ name: string }>>`
          SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
        `
        
        const tableNames = tables.map(t => t.name)
        const hasMigrationsTable = tableNames.includes('_prisma_migrations')
        const tablesExist = tableNames.length > 0
        
        return {
          migrationsApplied: hasMigrationsTable,
          tablesExist,
          error: null,
          details: {
            hasMigrationsTable,
            tableCount: tableNames.length,
            sampleTables: tableNames.slice(0, 10),
          },
        }
      } catch (error: any) {
        return {
          migrationsApplied: false,
          tablesExist: false,
          error: error.message || 'Unknown error',
          details: null,
        }
      }
    } else {
      // Для PostgreSQL используем information_schema
      // Проверяем наличие таблицы _prisma_migrations
      const migrationsTable = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        ) as exists
      `.catch(() => null)
      
      const hasMigrationsTable = migrationsTable?.[0]?.exists || false
      
      // Проверяем наличие основных таблиц
      const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
        LIMIT 10
      `.catch(() => [])
      
      const tableNames = tables.map(t => t.table_name)
      const tablesExist = tableNames.length > 0
      
      return {
        migrationsApplied: hasMigrationsTable,
        tablesExist,
        error: null,
        details: {
          hasMigrationsTable,
          tableCount: tableNames.length,
          sampleTables: tableNames,
        },
      }
    }
  } catch (error: any) {
    return {
      migrationsApplied: false,
      tablesExist: false,
      error: error.message || 'Unknown error',
      details: null,
    }
  }
}

/**
 * Проверка подключения к базе данных
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean
  error: string | null
  migrations?: {
    migrationsApplied: boolean
    tablesExist: boolean
    error: string | null
  }
}> {
  // Сначала проверяем DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  
  if (!databaseUrl) {
    if (isVercel) {
      return {
        connected: false,
        error: 'DATABASE_URL не настроен в Vercel Environment Variables. Настройте DATABASE_URL в Vercel Dashboard → Settings → Environment Variables',
      }
    }
    return {
      connected: false,
      error: 'DATABASE_URL не найден в переменных окружения',
    }
  }
  
  // Проверяем формат
  const isValidPostgres = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')
  const isSqlite = databaseUrl.includes('sqlite://') || databaseUrl.includes('file:')
  
  if (isVercel && !isValidPostgres) {
    if (isSqlite) {
      return {
        connected: false,
        error: 'SQLite не работает на Vercel. Используйте PostgreSQL connection string с параметром pgbouncer=true',
      }
    }
    return {
      connected: false,
      error: `DATABASE_URL имеет неправильный формат. URL должен начинаться с postgresql:// или postgres://. Текущий формат: ${databaseUrl.substring(0, 30)}...`,
    }
  }
  
  try {
    // Используем простой запрос для проверки подключения
    await prisma.$queryRaw`SELECT 1`
    
    // Если подключение успешно, проверяем миграции
    const migrationsCheck = await checkMigrations()
    
    return { 
      connected: true, 
      error: null,
      migrations: {
        migrationsApplied: migrationsCheck.migrationsApplied,
        tablesExist: migrationsCheck.tablesExist,
        error: migrationsCheck.error,
      },
    }
  } catch (error: any) {
    console.error('[checkDatabaseConnection] Error:', {
      code: error.code,
      message: error.message,
      name: error.name,
    })
    
    // Проверяем, является ли это ошибкой валидации DATABASE_URL
    if (error.message?.includes('the URL must start with the protocol') || 
        error.message?.includes('Error validating datasource')) {
      return {
        connected: false,
        error: `DATABASE_URL имеет неправильный формат. URL должен начинаться с postgresql:// или postgres://. Проверьте настройки в Vercel Environment Variables.`,
      }
    }
    
    // Проверяем ошибку "Can't reach database server" - прямое подключение вместо pooler
    if (error.message?.includes("Can't reach database server") || 
        error.message?.includes('db.hduadapicktrcrqjvzvd.supabase.co:5432') ||
        error.code === 'P1001') {
      const databaseUrl = process.env.DATABASE_URL || ''
      const isDirectConnection = databaseUrl.includes(':5432') || databaseUrl.includes('db.hduadapicktrcrqjvzvd.supabase.co')
      
      let errorMessage = 'Ошибка подключения к базе данных.\n\n'
      
      if (isDirectConnection) {
        errorMessage += '❌ Обнаружено прямое подключение (порт 5432) вместо Connection Pooler.\n'
        errorMessage += 'Прямое подключение НЕ РАБОТАЕТ на Vercel из-за ограничений соединений.\n\n'
        errorMessage += '🔧 ИСПРАВЛЕНИЕ:\n'
        errorMessage += '1. Откройте Supabase Dashboard → Settings → Database\n'
        errorMessage += '2. Найдите "Connection string" → "Connection pooling" (НЕ "URI"!)\n'
        errorMessage += '3. Выберите "Session mode" или "Transaction mode"\n'
        errorMessage += '4. Скопируйте connection string (должен содержать pooler.supabase.com:6543)\n'
        errorMessage += '5. Вставьте в Vercel → Settings → Environment Variables → DATABASE_URL\n\n'
        errorMessage += '📋 Правильный формат:\n'
        errorMessage += 'postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true'
      } else {
        errorMessage += 'Возможные причины:\n'
        errorMessage += '1. База данных Supabase в режиме паузы\n'
        errorMessage += '2. Проблемы с сетью или DNS\n'
        errorMessage += '3. Неправильный connection string\n'
        errorMessage += '4. Миграции не применены\n\n'
        errorMessage += 'Проверьте health endpoint: /api/health для детальной диагностики.'
      }
      
      return {
        connected: false,
        error: errorMessage,
      }
    }
    
    // Проверяем ошибку "Tenant or user not found" - неправильный connection string
    if (error.message?.includes('Tenant or user not found') || 
        error.message?.includes('FATAL: Tenant or user not found')) {
      return {
        connected: false,
        error: `Ошибка аутентификации: "Tenant or user not found". Это означает, что DATABASE_URL содержит неправильный пароль, project ID или формат connection string. Проверьте: 1) Пароль должен быть URL-encoded (например, ! → %21), 2) Project ID правильный, 3) Используется формат для Connection Pooler: postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true`,
      }
    }
    
    // Детальная информация об ошибке
    let errorMessage = error.message || 'Connection failed'
    
    // Добавляем код ошибки, если есть
    if (error.code) {
      errorMessage = `[${error.code}] ${errorMessage}`
    }
    
    return {
      connected: false,
      error: errorMessage,
    }
  }
}

