/**
 * Скрипт для автоматической настройки переменных окружения на Vercel
 * Использует Vercel CLI для добавления/обновления переменных
 * 
 * Требования:
 * 1. Установлен Vercel CLI: npm i -g vercel
 * 2. Авторизован в Vercel: vercel login
 * 3. Проект связан с Vercel: vercel link
 */

import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

interface EnvVariable {
  name: string
  value: string
  environments: ('production' | 'preview' | 'development')[]
  required: boolean
}

// Получаем значения из .env.vercel или используем значения по умолчанию
function getEnvVariables(): EnvVariable[] {
  const envVars: EnvVariable[] = []

  // Читаем .env.vercel если существует
  let envFileContent = ''
  try {
    const envFilePath = join(process.cwd(), '.env.vercel')
    envFileContent = readFileSync(envFilePath, 'utf-8')
  } catch {
    console.log('⚠️ Файл .env.vercel не найден, используем значения по умолчанию')
  }

  // Парсим DATABASE_URL
  const databaseUrlMatch = envFileContent.match(/^DATABASE_URL=(.+)$/m)
  const databaseUrl = databaseUrlMatch 
    ? databaseUrlMatch[1].replace(/^["']|["']$/g, '')
    : process.env.DATABASE_URL

  if (databaseUrl) {
    envVars.push({
      name: 'DATABASE_URL',
      value: databaseUrl,
      environments: ['production', 'preview', 'development'],
      required: true,
    })
  }

  // Парсим NEXT_PUBLIC_SUPABASE_URL
  const supabaseUrlMatch = envFileContent.match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m)
  const supabaseUrl = supabaseUrlMatch 
    ? supabaseUrlMatch[1].replace(/^["']|["']$/g, '')
    : process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hduadapicktrcrqjvzvd.supabase.co'

  envVars.push({
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    value: supabaseUrl,
    environments: ['production', 'preview', 'development'],
    required: false,
  })

  // Парсим NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseKeyMatch = envFileContent.match(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$/m)
  const supabaseKey = supabaseKeyMatch 
    ? supabaseKeyMatch[1].replace(/^["']|["']$/g, '')
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq'

  envVars.push({
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    value: supabaseKey,
    environments: ['production', 'preview', 'development'],
    required: false,
  })

  return envVars
}

function checkVercelCLI(): boolean {
  try {
    execSync('vercel --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function checkVercelAuth(): boolean {
  try {
    execSync('vercel whoami', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function checkVercelLink(): boolean {
  try {
    execSync('vercel link --yes', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

async function addEnvVariable(
  name: string,
  value: string,
  environment: 'production' | 'preview' | 'development'
): Promise<boolean> {
  try {
    // Экранируем значение для shell
    const escapedValue = value.replace(/'/g, "'\\''")
    const command = `vercel env add ${name} ${environment} <<< '${escapedValue}'`
    
    execSync(command, {
      stdio: 'pipe',
      shell: '/bin/bash',
    })
    return true
  } catch (error: any) {
    // Если переменная уже существует, пробуем обновить
    try {
      const escapedValue = value.replace(/'/g, "'\\''")
      const command = `vercel env rm ${name} ${environment} --yes && vercel env add ${name} ${environment} <<< '${escapedValue}'`
      execSync(command, {
        stdio: 'pipe',
        shell: '/bin/bash',
      })
      return true
    } catch {
      return false
    }
  }
}

async function main() {
  console.log('🚀 Настройка переменных окружения на Vercel\n')

  // Проверяем Vercel CLI
  if (!checkVercelCLI()) {
    console.log('❌ Vercel CLI не установлен!')
    console.log('   Установите: npm i -g vercel')
    process.exit(1)
  }
  console.log('✅ Vercel CLI установлен\n')

  // Проверяем авторизацию
  if (!checkVercelAuth()) {
    console.log('❌ Не авторизован в Vercel!')
    console.log('   Выполните: vercel login')
    process.exit(1)
  }
  console.log('✅ Авторизован в Vercel\n')

  // Проверяем связь проекта
  if (!checkVercelLink()) {
    console.log('⚠️ Проект не связан с Vercel')
    console.log('   Пытаемся связать...')
    try {
      execSync('vercel link', { stdio: 'inherit' })
    } catch {
      console.log('❌ Не удалось связать проект. Выполните вручную: vercel link')
      process.exit(1)
    }
  }
  console.log('✅ Проект связан с Vercel\n')

  // Получаем переменные окружения
  const envVars = getEnvVariables()
  console.log(`📋 Найдено переменных: ${envVars.length}\n`)

  // Добавляем переменные
  for (const envVar of envVars) {
    console.log(`📝 Настройка ${envVar.name}...`)
    
    for (const env of envVar.environments) {
      const success = await addEnvVariable(envVar.name, envVar.value, env)
      if (success) {
        console.log(`   ✅ ${env}: добавлено`)
      } else {
        console.log(`   ❌ ${env}: ошибка`)
      }
    }
    console.log()
  }

  console.log('✅ Настройка завершена!')
  console.log('\n📌 Следующие шаги:')
  console.log('   1. Проверьте переменные на Vercel Dashboard')
  console.log('   2. Пересоберите проект: vercel --prod')
}

main().catch((error) => {
  console.error('❌ Ошибка:', error)
  process.exit(1)
})

