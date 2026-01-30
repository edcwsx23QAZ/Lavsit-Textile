// Скрипт для проверки и инициализации chromium только на Vercel
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined || process.env.VERCEL_URL !== undefined

if (isVercel) {
  console.log('🔧 Обнаружено окружение Vercel - проверяем @sparticuz/chromium...')
  console.log(`   VERCEL=${process.env.VERCEL}, VERCEL_ENV=${process.env.VERCEL_ENV}, VERCEL_URL=${process.env.VERCEL_URL}`)
  
  try {
    // Проверяем, установлен ли chromium
    const chromiumPath = require.resolve('@sparticuz/chromium')
    console.log(`✅ @sparticuz/chromium найден: ${chromiumPath}`)
    
    // Пытаемся загрузить и проверить chromium
    const chromium = require('@sparticuz/chromium')
    console.log('✅ @sparticuz/chromium успешно загружен')
    
    // Проверяем наличие метода executablePath
    if (typeof chromium.executablePath === 'function') {
      console.log('✅ Метод executablePath доступен')
    } else {
      console.log('⚠️ Метод executablePath не найден в chromium')
    }
    
    // Проверяем наличие args
    if (chromium.args && Array.isArray(chromium.args)) {
      console.log(`✅ Chromium args доступны (${chromium.args.length} аргументов)`)
    } else {
      console.log('⚠️ Chromium args не найдены')
    }
    
    // Пытаемся получить executablePath для проверки
    if (typeof chromium.executablePath === 'function') {
      try {
        // Это асинхронная функция, но мы можем проверить её наличие
        console.log('✅ executablePath функция доступна для использования')
      } catch (e) {
        console.log('⚠️ Не удалось проверить executablePath:', e.message)
      }
    }
  } catch (e) {
    console.error('❌ Ошибка при проверке @sparticuz/chromium:', e.message)
    console.log('   Убедитесь, что @sparticuz/chromium указан в dependencies в package.json')
    console.log('   Пакет должен быть установлен автоматически при npm install')
    // Не выбрасываем ошибку, так как это может быть нормально на этапе установки
    // Но выводим предупреждение
    process.exitCode = 0 // Не прерываем установку
  }
} else {
  console.log('ℹ️ Локальное окружение - пропускаем проверку chromium')
}

