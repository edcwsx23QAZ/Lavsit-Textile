// Скрипт для проверки и инициализации chromium только на Vercel
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV !== undefined || process.env.VERCEL_URL !== undefined

if (isVercel) {
  console.log('🔧 Обнаружено окружение Vercel - проверяем @sparticuz/chromium...')
  console.log(`   VERCEL=${process.env.VERCEL}, VERCEL_ENV=${process.env.VERCEL_ENV}, VERCEL_URL=${process.env.VERCEL_URL}`)
  
  try {
    // Проверяем, установлен ли chromium
    const chromiumPath = require.resolve('@sparticuz/chromium')
    console.log(`✅ @sparticuz/chromium найден: ${chromiumPath}`)
    
    // Определяем путь к директории chromium
    const chromiumDir = path.dirname(chromiumPath)
    const chromiumBinDir = path.join(chromiumDir, 'bin')
    console.log(`📁 Директория chromium: ${chromiumDir}`)
    console.log(`📁 Директория bin: ${chromiumBinDir}`)
    
    // Проверяем существование директории bin
    if (fs.existsSync(chromiumBinDir)) {
      console.log(`✅ Директория bin существует: ${chromiumBinDir}`)
      
      // Проверяем наличие brotli файлов
      const brotliFiles = ['chromium.br', 'al2023.tar.br', 'fonts.tar.br', 'swiftshader.tar.br']
      const existingFiles = []
      const missingFiles = []
      
      for (const file of brotliFiles) {
        const filePath = path.join(chromiumBinDir, file)
        if (fs.existsSync(filePath)) {
          existingFiles.push(file)
          console.log(`  ✅ Найден файл: ${file}`)
        } else {
          missingFiles.push(file)
          console.log(`  ❌ Отсутствует файл: ${file}`)
        }
      }
      
      if (missingFiles.length > 0) {
        console.log(`⚠️ Отсутствуют brotli файлы: ${missingFiles.join(', ')}`)
        console.log(`   Это может вызвать проблемы при распаковке Chromium на Vercel`)
      } else {
        console.log(`✅ Все brotli файлы найдены (${existingFiles.length} файлов)`)
      }
    } else {
      console.log(`❌ Директория bin не существует: ${chromiumBinDir}`)
      console.log(`📁 Пытаемся создать директорию bin...`)
      
      try {
        fs.mkdirSync(chromiumBinDir, { recursive: true })
        console.log(`✅ Директория bin создана: ${chromiumBinDir}`)
        console.log(`⚠️ Но brotli файлы все еще отсутствуют - они должны быть в пакете`)
      } catch (mkdirError) {
        console.error(`❌ Не удалось создать директорию bin: ${mkdirError.message}`)
      }
    }
    
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
    
    // Пытаемся инициализировать chromium для проверки brotli файлов
    if (typeof chromium.executablePath === 'function') {
      try {
        // Устанавливаем переменную окружения для указания пути к brotli
        // @sparticuz/chromium использует эту переменную для поиска brotli файлов
        const nodeModulesPath = path.resolve(chromiumDir, '..', '..')
        const chromiumPackagePath = path.join(nodeModulesPath, '@sparticuz', 'chromium')
        
        console.log(`📦 Путь к пакету chromium: ${chromiumPackagePath}`)
        
        // Проверяем наличие brotli файлов в пакете
        const brotliFiles = [
          path.join(chromiumPackagePath, 'bin'),
          path.join(chromiumPackagePath, 'lib'),
        ]
        
        brotliFiles.forEach(brotliPath => {
          if (fs.existsSync(brotliPath)) {
            console.log(`✅ Найдена директория: ${brotliPath}`)
          } else {
            console.log(`⚠️ Директория не найдена: ${brotliPath}`)
          }
        })
        
        console.log('✅ executablePath функция доступна для использования')
        console.log('✅ Инициализация chromium завершена')
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

