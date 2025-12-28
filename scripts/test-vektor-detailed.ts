import axios from 'axios'
import * as XLSX from 'xlsx'

async function testVektorDetailed() {
  console.log('=== Детальный анализ файла Vektor ===\n')

  // Находим файл
  const today = new Date()
  let actualUrl = ''
  for (let daysBack = 0; daysBack <= 30; daysBack++) {
    const checkDate = new Date(today)
    checkDate.setDate(today.getDate() - daysBack)
    const d = String(checkDate.getDate()).padStart(2, '0')
    const m = String(checkDate.getMonth() + 1).padStart(2, '0')
    const y = String(checkDate.getFullYear()).slice(-2)
    const url = `https://api.vektor.club/static/remainders_files/${d}${m}${y}_MSK.xlsx`
    
    try {
      const response = await axios.head(url, { timeout: 5000 })
      if (response.status === 200) {
        actualUrl = url
        break
      }
    } catch (e: any) {
      if (e.response?.status !== 404) continue
    }
  }

  if (!actualUrl) {
    console.error('Файл не найден!')
    return
  }

  console.log(`Файл: ${actualUrl}\n`)

  // Скачиваем
  const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
  const workbook = XLSX.read(response.data, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

  console.log(`Всего строк: ${data.length}\n`)

  // Ищем строки с "ФУРНИТУРА"
  console.log('Поиск строки "ФУРНИТУРА":')
  let furnitureRow = -1
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || '').toUpperCase()
      if (cell.includes('ФУРНИТУРА')) {
        furnitureRow = i
        console.log(`  Найдено в строке ${i + 1}, колонка ${j + 1}\n`)
        break
      }
    }
    if (furnitureRow >= 0) break
  }

  // Показываем строки вокруг "ФУРНИТУРА"
  if (furnitureRow >= 0) {
    console.log(`Строки вокруг "ФУРНИТУРА" (строка ${furnitureRow + 1}):\n`)
    for (let i = Math.max(0, furnitureRow - 5); i < Math.min(data.length, furnitureRow + 10); i++) {
      const row = data[i]
      const d = row[3]?.toString().trim() || ''
      const e = row[4]?.toString().trim() || ''
      const f = row[5]?.toString().trim() || ''
      
      const marker = i === furnitureRow ? ' <-- ФУРНИТУРА' : ''
      console.log(`Строка ${i + 1}: D="${d.substring(0, 40)}" E="${e}" F="${f}"${marker}`)
    }
    console.log('')
  }

  // Ищем строки с реальными данными (проверяем разные паттерны)
  console.log('Поиск строк с данными о тканях:\n')
  
  let sampleCount = 0
  for (let i = 0; i < data.length && sampleCount < 20; i++) {
    const row = data[i]
    
    // Проверяем все колонки на наличие текста, похожего на название ткани
    for (let col = 0; col < Math.min(10, row.length); col++) {
      const cell = String(row[col] || '').trim()
      
      // Ищем паттерны: текст + цифры (название коллекции и цвета)
      if (cell.length > 5 && /[A-Za-zА-Яа-яЁё]/.test(cell) && /\d/.test(cell)) {
        // Проверяем, что это не служебная информация
        if (!cell.includes('Область') && 
            !cell.includes('Номенклатура') && 
            !cell.includes('ЛАБОРАТОРИЯ') &&
            !cell.includes('ОБОРУДОВАНИЕ') &&
            cell.length < 100) {
          
          sampleCount++
          console.log(`Строка ${i + 1}, Колонка ${String.fromCharCode(65 + col)} (${col}):`)
          console.log(`  Значение: "${cell.substring(0, 80)}${cell.length > 80 ? '...' : ''}"`)
          
          // Показываем соседние колонки
          const prevCol = col > 0 ? String(row[col - 1] || '').trim() : ''
          const nextCol = col < row.length - 1 ? String(row[col + 1] || '').trim() : ''
          const next2Col = col < row.length - 2 ? String(row[col + 2] || '').trim() : ''
          
          if (prevCol) console.log(`  ${String.fromCharCode(64 + col)}: "${prevCol.substring(0, 40)}"`)
          if (nextCol) console.log(`  ${String.fromCharCode(66 + col)}: "${nextCol.substring(0, 40)}"`)
          if (next2Col) console.log(`  ${String.fromCharCode(67 + col)}: "${next2Col.substring(0, 40)}"`)
          console.log('')
          
          if (sampleCount >= 20) break
        }
      }
    }
  }

  if (sampleCount === 0) {
    console.log('⚠️ Не найдено строк с данными!')
    console.log('\nПоказываем первые 30 строк полностью:\n')
    for (let i = 0; i < Math.min(30, data.length); i++) {
      const row = data[i]
      const rowStr = row.slice(0, 8).map((cell, idx) => {
        const val = String(cell || '').trim()
        return `${String.fromCharCode(65 + idx)}:${val.substring(0, 20)}`
      }).join(' | ')
      console.log(`Строка ${i + 1}: ${rowStr}`)
    }
  }
}

testVektorDetailed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Ошибка:', error)
    process.exit(1)
  })


