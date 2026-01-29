/**
 * Supabase Client для работы с базой данных через API
 * Полная настройка с нуля через API
 */

import { createClient } from '@supabase/supabase-js'

// Project ID: hduadapicktrcrqjvzvd
const SUPABASE_URL = 'https://hduadapicktrcrqjvzvd.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq'
const SUPABASE_SERVICE_KEY = 'sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp'

// Получаем credentials из переменных окружения или используем значения по умолчанию
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || SUPABASE_SERVICE_KEY

/**
 * Supabase Client для клиентских запросов (с анонимным ключом)
 * Используется в компонентах и API routes для обычных запросов
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
})

/**
 * Supabase Admin Client для серверных операций (с service role key)
 * Имеет полный доступ к базе данных, обходит RLS (Row Level Security)
 * Используется только на сервере!
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  db: {
    schema: 'public',
  },
})

/**
 * Проверка подключения к Supabase
 */
export async function checkSupabaseConnection() {
  try {
    // Пробуем простой запрос к базе данных
    const { data, error } = await supabaseAdmin
      .from('_prisma_migrations')
      .select('id')
      .limit(1)
    
    if (error) {
      // Если таблицы нет, это нормально - миграции еще не применены
      if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        return {
          connected: true,
          error: null,
          message: 'Подключение работает, но таблицы еще не созданы',
        }
      }
      
      return {
        connected: false,
        error: error.message,
      }
    }
    
    return {
      connected: true,
      error: null,
    }
  } catch (error: any) {
    return {
      connected: false,
      error: error.message || 'Unknown error',
    }
  }
}

/**
 * Получить connection string для Connection Pooler
 * Для Vercel нужно использовать Connection Pooler (порт 6543)
 */
export function getConnectionPoolerUrl(): string {
  const password = process.env.DATABASE_PASSWORD || 'edcwsx123QA'
  // URL-encode пароль если содержит специальные символы
  const encodedPassword = encodeURIComponent(password)
  
  // Connection Pooler URL для Vercel
  // Формат: postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true
  return `postgresql://postgres.hduadapicktrcrqjvzvd:${encodedPassword}@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`
}

/**
 * Получить прямой connection string (для локальной разработки)
 * НЕ использовать на Vercel!
 */
export function getDirectConnectionUrl(): string {
  const password = process.env.DATABASE_PASSWORD || 'edcwsx123QA'
  const encodedPassword = encodeURIComponent(password)
  
  return `postgresql://postgres:${encodedPassword}@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public&sslmode=require`
}
