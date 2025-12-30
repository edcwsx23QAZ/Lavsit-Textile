import * as cheerio from 'cheerio'
import axios from 'axios'

async function analyzeHTML() {
  const url = 'http://tgn1.viptextil.ru/vip/ostatki.html'
  
  try {
    console.log('=== Анализ HTML структуры Viptextil ===\n')
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const $ = cheerio.load(response.data)
    
    console.log('HTML загружен\n')
    
    const table = $('table').first()
    if (table.length === 0) {
      console.error('❌ Таблица не найдена')
      return
    }
    
    console.log('Таблица найдена\n')
    console.log('=== Первые 50 строк таблицы ===\n')
    
    let rowNum = 0
    table.find('tr').each((index, row) => {
      if (rowNum >= 50) return false
      
      const cells = $(row).find('td, th')
      if (cells.length === 0) return
      
      const col1 = $(cells[0]).text().trim()
      const col2 = $(cells[1]).text().trim()
      const col3 = cells.length > 2 ? $(cells[2]).text().trim() : ''
      
      rowNum++
      console.log(`Строка ${rowNum}: [${cells.length} ячеек]`)
      console.log(`  Колонка 1: "${col1}"`)
      console.log(`  Колонка 2: "${col2}"`)
      if (col3) console.log(`  Колонка 3: "${col3}"`)
      
      // Ищем примеры с "Pegas"
      if (col1.toLowerCase().includes('pegas')) {
        console.log(`  ⭐ НАЙДЕН PEGAS: "${col1}" | "${col2}"`)
      }
      
      console.log('')
    })
    
    console.log('\n=== Поиск всех строк с "Pegas" ===\n')
    let pegasCount = 0
    table.find('tr').each((index, row) => {
      const cells = $(row).find('td, th')
      if (cells.length < 2) return
      
      const col1 = $(cells[0]).text().trim()
      const col2 = $(cells[1]).text().trim()
      
      if (col1.toLowerCase().includes('pegas')) {
        pegasCount++
        console.log(`Pegas ${pegasCount}: "${col1}" | "${col2}"`)
      }
    })
    
    console.log(`\nВсего найдено строк с "Pegas": ${pegasCount}\n`)
    
  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
  }
}

analyzeHTML()


