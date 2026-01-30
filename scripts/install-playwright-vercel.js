// Скрипт для установки браузеров Playwright на Vercel
const { execSync } = require('child_process')
const path = require('path')

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined || process.env.VERCEL_URL !== undefined

if (isVercel) {
  console.log('🔧 Обнаружено окружение Vercel - устанавливаем браузеры Playwright...')
  console.log(`   VERCEL=${process.env.VERCEL}, VERCEL_ENV=${process.env.VERCEL_ENV}, VERCEL_URL=${process.env.VERCEL_URL}`)
  
  try {
    // Устанавливаем только chromium для уменьшения размера
    // Используем системные зависимости для Vercel
    console.log('📦 Устанавливаем Chromium для Playwright...')
    
    // Устанавливаем браузеры в директорию проекта, чтобы они были доступны в runtime
    const cwd = process.cwd()
    const playwrightCacheDir = path.join(cwd, '.playwright')
    
    // Устанавливаем переменную окружения для указания пути к кэшу браузеров
    process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightCacheDir
    
    execSync('npx playwright install chromium', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0',
        PLAYWRIGHT_BROWSERS_PATH: playwrightCacheDir,
      },
      cwd: cwd,
    })
    console.log('✅ Chromium для Playwright успешно установлен')
    console.log(`📁 Браузеры установлены в: ${playwrightCacheDir}`)
  } catch (e) {
    console.error('❌ Ошибка при установке браузеров Playwright:', e.message)
    console.log('   Это может быть нормально, если браузеры уже установлены')
    // Не прерываем установку, так как это может быть нормально
    process.exitCode = 0
  }
} else {
  console.log('ℹ️ Локальное окружение - пропускаем установку браузеров Playwright')
  console.log('   Для локальной установки выполните: npx playwright install chromium')
}

