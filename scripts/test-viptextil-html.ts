import * as cheerio from 'cheerio'
import axios from 'axios'

async function analyzeViptextil() {
  const url = 'http://tgn1.viptextil.ru/vip/ostatki.html'
  
  try {
    console.log('Загружаем страницу...')
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    
    const $ = cheerio.load(response.data)
    console.log('Страница загружена\n')
    
    // Ищем все таблицы
    const tables = $('table')
    console.log(`Найдено таблиц: ${tables.length}\n`)
    
    // Анализируем первую таблицу
    const table = tables.first()
    if (table.length === 0) {
      console.log('Таблица не найдена!')
      return
    }
    
    console.log('=== Анализ структуры таблицы ===\n')
    
    // Собираем первые 30 строк
    const rows: any[] = []
    table.find('tr').slice(0, 30).each((index, row) => {
      const cells: string[] = []
      $(row).find('td, th').each((_, cell) => {
        const text = $(cell).text().trim()
        cells.push(text)
      })
      
      if (cells.length > 0) {
        rows.push({
          index: index + 1,
          cells,
          cellCount: cells.length,
        })
      }
    })
    
    console.log(`Найдено строк: ${rows.length}\n`)
    console.log('Первые 20 строк:')
    rows.slice(0, 20).forEach((row, i) => {
      console.log(`\nСтрока ${row.index} (${row.cellCount} ячеек):`)
      row.cells.forEach((cell: string, j: number) => {
        console.log(`  [${j}]: "${cell}"`)
      })
    })
    
    // Ищем строки с данными о тканях
    console.log('\n\n=== Поиск строк с данными о тканях ===\n')
    const fabricRows = rows.filter(row => {
      if (row.cells.length < 2) return false
      const col1 = row.cells[0]?.toLowerCase() || ''
      const col2 = row.cells[1]?.toLowerCase() || ''
      
      // Пропускаем заголовки
      if (col1.includes('номенклатура') || col1.includes('итого') || 
          col2.includes('номенклатура') || col2.includes('итого') ||
          col1.includes('остатки на:')) {
        return false
      }
      
      // Пропускаем пустые строки
      if (!col1 && !col2) return false
      
      // Пропускаем заголовки разделов
      if (col2 === '' && (col1.includes('искусственная') || col1.includes('ткани') || 
          col1.includes('жакард') || col1.includes('шенилл'))) {
        return false
      }
      
      // Ищем строки с наличием
      if (col2 && (col2.includes('есть в наличии') || col2.includes('уточнять'))) {
        return true
      }
      
      return false
    })
    
    console.log(`Найдено строк с данными: ${fabricRows.length}\n`)
    console.log('Примеры строк с данными:')
    fabricRows.slice(0, 10).forEach((row, i) => {
      console.log(`\n${i + 1}. Строка ${row.index}:`)
      console.log(`   Коллекция/Цвет: "${row.cells[0]}"`)
      console.log(`   Наличие: "${row.cells[1]}"`)
    })
    
    // Парсим коллекцию и цвет
    console.log('\n\n=== Парсинг коллекции и цвета ===\n')
    fabricRows.slice(0, 10).forEach((row, i) => {
      const collectionColor = row.cells[0] || ''
      const parts = collectionColor.split(/\s+/)
      if (parts.length >= 2) {
        const collection = parts[0]
        const color = parts.slice(1).join(' ')
        console.log(`${i + 1}. "${collectionColor}"`)
        console.log(`   Коллекция: "${collection}"`)
        console.log(`   Цвет: "${color}"`)
      }
    })
    
  } catch (error: any) {
    console.error('Ошибка:', error.message)
    if (error.response) {
      console.error('Status:', error.response.status)
      console.error('Headers:', error.response.headers)
    }
  }
}

analyzeViptextil()



