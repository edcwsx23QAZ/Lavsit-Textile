/**
 * Скрипт для обновления DATABASE_URL на Vercel с правильным форматом
 * Удаляет параметр pgbouncer=true из connection string
 * 
 * Использование:
 *   npm run vercel:update-db-url
 *   или
 *   tsx scripts/update-vercel-database-url.ts
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

// Правильный формат DATABASE_URL (без pgbouncer=true)
const CORRECT_DATABASE_URL = 'postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=public&connect_timeout=30&sslmode=require'

function checkVercelCLI(): boolean {
  try {
    execSync('vercel --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function updateDatabaseUrl(environment: 'production' | 'preview' | 'development' = 'production') {
  try {
    console.log(`\n🔄 Обновление DATABASE_URL для окружения: ${environment}`)
    
    // Удаляем старую переменную
    try {
      execSync(`vercel env rm DATABASE_URL ${environment} --yes`, { 
        stdio: 'pipe',
        encoding: 'utf-8'
      })
      console.log(`   ✓ Старая переменная удалена`)
    } catch (error: any) {
      if (!error.message.includes('not found')) {
        console.log(`   ⚠️  Не удалось удалить старую переменную (возможно, её нет)`)
      }
    }
    
    // Добавляем новую переменную
    // Используем echo для передачи значения через stdin
    const command = `echo "${CORRECT_DATABASE_URL}" | vercel env add DATABASE_URL ${environment}`
    execSync(command, { 
      stdio: 'inherit',
      encoding: 'utf-8',
      shell: true
    })
    
    console.log(`   ✅ DATABASE_URL обновлен для ${environment}`)
    return true
  } catch (error: any) {
    console.error(`   ❌ Ошибка при обновлении: ${error.message}`)
    return false
  }
}

async function main() {
  console.log('=== Обновление DATABASE_URL на Vercel ===\n')
  
  // Проверяем наличие Vercel CLI
  if (!checkVercelCLI()) {
    console.error('❌ Vercel CLI не установлен!')
    console.log('\nУстановите Vercel CLI:')
    console.log('  npm i -g vercel')
    console.log('\nИли обновите вручную через Vercel Dashboard:')
    console.log('  https://vercel.com/dashboard')
    console.log('  Settings → Environment Variables')
    process.exit(1)
  }
  
  // Проверяем авторизацию
  try {
    execSync('vercel whoami', { stdio: 'ignore' })
  } catch {
    console.error('❌ Не авторизованы в Vercel!')
    console.log('\nВыполните:')
    console.log('  vercel login')
    process.exit(1)
  }
  
  console.log('✅ Vercel CLI готов\n')
  console.log('📝 Новый формат DATABASE_URL (без pgbouncer=true):')
  console.log(`   ${CORRECT_DATABASE_URL.substring(0, 80)}...\n`)
  
  // Обновляем для всех окружений
  const environments: Array<'production' | 'preview' | 'development'> = ['production', 'preview', 'development']
  const results: boolean[] = []
  
  for (const env of environments) {
    const result = updateDatabaseUrl(env)
    results.push(result)
    // Небольшая задержка между обновлениями
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log('\n=== Результаты ===')
  const allSuccess = results.every(r => r)
  
  if (allSuccess) {
    console.log('✅ Все переменные окружения обновлены успешно!')
    console.log('\n📋 Следующие шаги:')
    console.log('   1. Перезапустите деплоймент на Vercel (Redeploy)')
    console.log('   2. Проверьте логи деплоя')
    console.log('   3. Проверьте работу приложения: https://lavsit-textile.vercel.app/suppliers')
  } else {
    console.log('⚠️  Некоторые переменные не удалось обновить')
    console.log('\n💡 Попробуйте обновить вручную через Vercel Dashboard:')
    console.log('   https://vercel.com/dashboard')
    console.log('   Settings → Environment Variables')
  }
}

main().catch(console.error)

