/**
 * Получение PostgreSQL connection string через Supabase Management API
 * Используется для автоматической настройки DATABASE_URL
 */

const SUPABASE_URL = 'https://hduadapicktrcrqjvzvd.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || 'sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp'

/**
 * Получение connection string через Supabase Management API
 * 
 * Примечание: Supabase Management API не предоставляет прямой способ получить connection string
 * Но можно использовать service role key для создания connection string вручную
 * 
 * Для получения connection string лучше использовать Supabase Dashboard:
 * Settings → Database → Connection string → Connection pooling
 */
export async function getConnectionStringFromSupabase(): Promise<string | null> {
  try {
    // Supabase Management API не предоставляет endpoint для получения connection string
    // Но мы можем использовать service role key для формирования connection string
    
    // Для pooler connection string нужны:
    // - Project ID: hduadapicktrcrqjvzvd
    // - Region: aws-0-us-east-1 (можно получить из URL)
    // - Password: нужно получить из Supabase Dashboard или использовать переменную окружения
    
    const projectId = 'hduadapicktrcrqjvzvd'
    const region = 'aws-0-us-east-1' // Из URL проекта
    const password = process.env.SUPABASE_DB_PASSWORD || process.env.DATABASE_PASSWORD
    
    if (!password) {
      console.warn('[Supabase] Пароль базы данных не найден в переменных окружения')
      console.warn('[Supabase] Используйте SUPABASE_DB_PASSWORD или DATABASE_PASSWORD')
      return null
    }
    
    // URL-encode пароль
    const encodedPassword = encodeURIComponent(password)
    
    // Формируем connection string для pooler
    const connectionString = `postgresql://postgres.${projectId}:${encodedPassword}@${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`
    
    return connectionString
  } catch (error: any) {
    console.error('[Supabase] Ошибка при получении connection string:', error.message)
    return null
  }
}

/**
 * Альтернативный способ: использование прямого подключения
 */
export function getDirectConnectionString(password: string): string {
  const projectId = 'hduadapicktrcrqjvzvd'
  const encodedPassword = encodeURIComponent(password)
  
  return `postgresql://postgres:${encodedPassword}@db.${projectId}.supabase.co:5432/postgres?schema=public&sslmode=require`
}

/**
 * Получение connection string для pooler
 */
export function getPoolerConnectionString(password: string): string {
  const projectId = 'hduadapicktrcrqjvzvd'
  const region = 'aws-0-us-east-1'
  const encodedPassword = encodeURIComponent(password)
  
  return `postgresql://postgres.${projectId}:${encodedPassword}@${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require`
}



