// Скрипт для установки браузеров Playwright на Vercel
const { execSync } = require('child_process')

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined || process.env.VERCEL_URL !== undefined

if (isVercel) {
  console.log('🔧 Обнаружено окружение Vercel - устанавливаем браузеры Playwright...')
  console.log(`   VERCEL=${process.env.VERCEL}, VERCEL_ENV=${process.env.VERCEL_ENV}, VERCEL_URL=${process.env.VERCEL_URL}`)
  
  try {
    // Устанавливаем только chromium для уменьшения размера
    console.log('📦 Устанавливаем Chromium для Playwright...')
    execSync('npx playwright install chromium --with-deps', {
      stdio: 'inherit',
      env: {
        ...process.env,
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0',
      }
    })
    console.log('✅ Chromium для Playwright успешно установлен')
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

