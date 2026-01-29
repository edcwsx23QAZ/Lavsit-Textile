import { NextResponse } from 'next/server'
import { checkDatabaseConnection } from '@/lib/db/safe-query'
import { checkSupabaseConnection, getConnectionPoolerUrl } from '@/lib/supabase/client'
import { checkDatabaseConnection as checkSupabaseDbConnection } from '@/lib/db/supabase-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV
  const databaseUrl = process.env.DATABASE_URL
  
  // Определяем тип DATABASE_URL
  let databaseUrlType = 'not_set'
  let databaseUrlPreview = null
  let databaseUrlValid = false
  
  // Детальная диагностика DATABASE_URL
  let databaseUrlDetails: any = null
  
  if (databaseUrl) {
    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      databaseUrlType = 'postgresql'
      databaseUrlValid = true
      
      try {
        const url = new URL(databaseUrl)
        databaseUrlPreview = `${url.protocol}//${url.hostname}:${url.port || '5432'}${url.pathname}`
        
        // Детальная информация о connection string
        databaseUrlDetails = {
          hostname: url.hostname,
          port: url.port || '5432',
          username: url.username,
          database: url.pathname.replace('/', ''),
          hasPgbouncer: url.searchParams.get('pgbouncer') === 'true',
          hasSchema: url.searchParams.get('schema') === 'public',
          isPooler: url.hostname.includes('pooler.supabase.com'),
          isDirect: url.hostname.includes('.supabase.co') && !url.hostname.includes('pooler'),
          isValidForVercel: url.hostname.includes('pooler.supabase.com') && url.port === '6543' && url.searchParams.get('pgbouncer') === 'true',
        }
      } catch {
        databaseUrlPreview = databaseUrl.substring(0, 50) + '...'
      }
    } else if (databaseUrl.includes('sqlite://') || databaseUrl.includes('file:')) {
      databaseUrlType = 'sqlite'
      databaseUrlPreview = 'file:...'
    } else {
      databaseUrlType = 'invalid'
      databaseUrlPreview = databaseUrl.substring(0, 50) + '...'
    }
  }
  
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      vercel: !!isVercel,
      nodeEnv: process.env.NODE_ENV || 'unknown',
      hasDatabaseUrl: !!databaseUrl,
      databaseUrlType,
      databaseUrlValid,
      databaseUrlPreview,
      databaseUrlDetails,
      hasSupabaseUrl: !!(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
      hasSupabaseKey: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY),
    },
    database: {
      connected: false,
      error: null as string | null,
      migrations: null as {
        migrationsApplied: boolean
        tablesExist: boolean
        error: string | null
      } | null,
    },
    supabase: {
      connected: false,
      error: null as string | null,
    },
    connectionPoolerUrl: null as string | null,
  }

  // Проверяем подключение к базе данных через Prisma
  try {
    const connectionCheck = await checkDatabaseConnection()
    health.database.connected = connectionCheck.connected
    health.database.error = connectionCheck.error
    health.database.migrations = connectionCheck.migrations
    
    if (!connectionCheck.connected) {
      health.status = 'error'
    } else if (connectionCheck.migrations && !connectionCheck.migrations.migrationsApplied) {
      health.status = 'warning'
      health.message = 'База данных подключена, но миграции не применены. Примените миграции в Supabase.'
    }
  } catch (error: any) {
    health.status = 'error'
    health.database.error = error?.message || String(error) || 'Unknown error'
  }

  // Проверяем подключение к Supabase через API
  try {
    const supabaseCheck = await checkSupabaseConnection()
    health.supabase.connected = supabaseCheck.connected
    health.supabase.error = supabaseCheck.error || null
    
    // Также проверяем через новый модуль supabase-db
    try {
      const supabaseDbCheck = await checkSupabaseDbConnection()
      if (supabaseDbCheck.connected) {
        health.supabase.connected = true
        if (supabaseDbCheck.error) {
          health.supabase.error = supabaseDbCheck.error
        }
      }
    } catch (error: any) {
      // Игнорируем ошибки проверки через supabase-db
    }
    
    // Если Prisma не подключен, но Supabase работает - это нормально
    if (!health.database.connected && health.supabase.connected) {
      health.status = 'warning'
      health.message = 'Database connection через Prisma не работает, но Supabase API доступен'
    }
  } catch (error: any) {
    // Supabase проверка не критична, только логируем
    health.supabase.error = error?.message || String(error) || 'Unknown error'
  }
  
  // Добавляем информацию о Connection Pooler URL
  health.connectionPoolerUrl = getConnectionPoolerUrl().replace(/:[^:@]+@/, ':****@')

  return NextResponse.json(health, {
    status: health.status === 'ok' ? 200 : 500,
  })
}

