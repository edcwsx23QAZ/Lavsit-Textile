import * as cheerio from 'cheerio'
import axios from 'axios'

async function testDetailed() {
  const url = 'http://tgn1.viptextil.ru/vip/ostatki.html'
  
  try {
    console.log('=== Детальное тестирование парсера Viptextil ===\n')
    
    console.log('Шаг 1: Загружаем HTML...')
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const $ = cheerio.load(response.data)
    console.log('✓ HTML загружен\n')
    
    console.log('Шаг 2: Ищем таблицу...')
    const table = $('table').first()
    if (table.length === 0) {
      console.error('❌ Таблица не найдена')
      return
    }
    console.log('✓ Таблица найдена\n')
    
    console.log('Шаг 3: Анализируем строки...\n')
    
    let totalRows = 0
    let rowsWith2Cells = 0
    let rowsWithData = 0
    let skippedByEmpty = 0
    let skippedByHeader = 0
    let skippedByEmptyCol2 = 0
    let skippedBySectionHeader = 0
    let skippedBySingleWord = 0
    let validFabrics = 0
    
    const examples: any[] = []
    
    table.find('tr').each((index, row) => {
      const rowIndex = index + 1
      totalRows++
      
      const cells = $(row).find('td, th')
      
      if (cells.length < 2) {
        return
      }
      
      rowsWith2Cells++
      
      const col1 = $(cells[0]).text().trim()
      const col2 = $(cells[1]).text().trim()
      
      // Пропускаем полностью пустые строки
      if (!col1 && !col2) {
        skippedByEmpty++
        return
      }
      
      // Пропускаем заголовки таблицы
      const col1Lower = col1.toLowerCase()
      const col2Lower = col2.toLowerCase()
      
      if (col1Lower.includes('номенклатура') || 
          col1Lower.includes('итого') ||
          col1Lower.includes('остатки на:') ||
          col2Lower.includes('номенклатура') ||
          col2Lower.includes('итого')) {
        skippedByHeader++
        if (rowIndex <= 5) {
          console.log(`  Строка ${rowIndex}: ПРОПУЩЕНА (заголовок): "${col1}" | "${col2}"`)
        }
        return
      }
      
      rowsWithData++
      
      // Пропускаем заголовки разделов (если вторая колонка пуста)
      if (!col2 || col2.length === 0) {
        skippedByEmptyCol2++
        if (rowIndex <= 20) {
          console.log(`  Строка ${rowIndex}: ПРОПУЩЕНА (пустая col2): "${col1}" | "${col2}"`)
        }
        return
      }
      
      // Пропускаем строки с заголовками разделов в первой колонке
      if (col1Lower.includes('искусственная') ||
          col1Lower === 'ткани' ||
          col1Lower === 'жакард' ||
          col1Lower === 'шенилл' ||
          col1Lower === 'остатки' ||
          col1Lower === 'итого') {
        skippedBySectionHeader++
        if (rowIndex <= 20) {
          console.log(`  Строка ${rowIndex}: ПРОПУЩЕНА (заголовок раздела): "${col1}" | "${col2}"`)
        }
        return
      }
      
      // Пропускаем строки где первая колонка пуста
      if (!col1 || col1.length === 0) {
        return
      }
      
      // Парсим коллекцию и цвет
      const parts = col1.split(/\s+/).filter(p => p.trim().length > 0)
      
      if (parts.length < 2) {
        skippedBySingleWord++
        if (rowIndex <= 20) {
          console.log(`  Строка ${rowIndex}: ПРОПУЩЕНА (одно слово): "${col1}" | "${col2}"`)
        }
        return
      }
      
      const collection = parts[0].trim()
      const color = parts.slice(1).join(' ').trim()
      
      // Проверяем, что есть и коллекция, и цвет
      if (!collection || !color || collection.length === 0 || color.length === 0) {
        return
      }
      
      // Парсим наличие
      let inStock = false
      if (col2Lower.includes('есть в наличии')) {
        inStock = true
      }
      
      validFabrics++
      
      if (validFabrics <= 10) {
        console.log(`  Строка ${rowIndex}: ✓ ТКАНЬ: "${collection}" "${color}" - ${inStock ? 'В наличии' : 'Не в наличии'} (${col2})`)
        examples.push({ rowIndex, collection, color, inStock, col2 })
      }
    })
    
    console.log('\n=== ИТОГОВАЯ СТАТИСТИКА ===\n')
    console.log(`Всего строк в таблице: ${totalRows}`)
    console.log(`Строк с 2+ ячейками: ${rowsWith2Cells}`)
    console.log(`Строк с данными (не пустые): ${rowsWithData}`)
    console.log(`Пропущено (пустые): ${skippedByEmpty}`)
    console.log(`Пропущено (заголовки): ${skippedByHeader}`)
    console.log(`Пропущено (пустая col2): ${skippedByEmptyCol2}`)
    console.log(`Пропущено (заголовки разделов): ${skippedBySectionHeader}`)
    console.log(`Пропущено (одно слово): ${skippedBySingleWord}`)
    console.log(`\n✓ ВАЛИДНЫХ ТКАНЕЙ: ${validFabrics}\n`)
    
    if (validFabrics === 0) {
      console.log('❌ ПРОБЛЕМА: Не найдено ни одной валидной ткани!')
      console.log('\nПроверяем первые 30 строк детально...\n')
      
      table.find('tr').slice(0, 30).each((index, row) => {
        const rowIndex = index + 1
        const cells = $(row).find('td, th')
        const col1 = $(cells[0]).text().trim()
        const col2 = $(cells[1]).text().trim()
        
        console.log(`Строка ${rowIndex}: "${col1}" | "${col2}"`)
      })
    } else {
      console.log('Примеры найденных тканей:')
      examples.forEach((ex, i) => {
        console.log(`  ${i + 1}. ${ex.collection} ${ex.color} - ${ex.inStock ? 'В наличии' : 'Не в наличии'}`)
      })
    }
    
  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
  }
}

testDetailed()


