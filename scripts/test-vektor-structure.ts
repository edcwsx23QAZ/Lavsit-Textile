import axios from 'axios'
import * as XLSX from 'xlsx'

async function testVektorStructure() {
  console.log('=== Анализ структуры файла Vektor ===\n')

  // Форматируем дату
  const today = new Date()
  const day = String(today.getDate()).padStart(2, '0')
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const year = String(today.getFullYear()).slice(-2)
  const dateStr = `${day}${month}${year}`
  
  // Пробуем найти файл
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
        console.log(`✓ Найден файл: ${url}\n`)
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

  // Скачиваем и анализируем
  const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
  const workbook = XLSX.read(response.data, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

  console.log(`Всего строк: ${data.length}\n`)
  console.log('Поиск строк с данными (D заполнен, E заполнен, F заполнен):\n')

  let foundRows = 0
  for (let i = 0; i < Math.min(100, data.length); i++) {
    const row = data[i]
    const a = row[0]?.toString().trim() || ''
    const b = row[1]?.toString().trim() || ''
    const c = row[2]?.toString().trim() || ''
    const d = row[3]?.toString().trim() || ''
    const e = row[4]?.toString().trim() || ''
    const f = row[5]?.toString().trim() || ''
    const g = row[6]?.toString().trim() || ''

    // Ищем строки, где D заполнен и содержит текст (не служебную информацию)
    if (d && d.length > 3 && !d.includes('Область учета') && !d.includes('Номенклатура')) {
      // Проверяем, что это похоже на название ткани (есть буквы и возможно цифры)
      if (/[A-Za-zА-Яа-я]/.test(d)) {
        foundRows++
        console.log(`Строка ${i + 1}:`)
        console.log(`  A: "${a}"`)
        console.log(`  B: "${b}"`)
        console.log(`  C: "${c}"`)
        console.log(`  D: "${d.substring(0, 50)}${d.length > 50 ? '...' : ''}"`)
        console.log(`  E: "${e}"`)
        console.log(`  F: "${f}"`)
        console.log(`  G: "${g}"`)
        console.log('')
        
        if (foundRows >= 10) break
      }
    }
  }

  if (foundRows === 0) {
    console.log('⚠️ Не найдено строк с данными в первых 100 строках!')
    console.log('Проверяем дальше...\n')
    
    for (let i = 100; i < Math.min(500, data.length); i++) {
      const row = data[i]
      const d = row[3]?.toString().trim() || ''
      const e = row[4]?.toString().trim() || ''
      const f = row[5]?.toString().trim() || ''
      
      if (d && d.length > 3 && /[A-Za-zА-Яа-я]/.test(d) && !d.includes('Область') && !d.includes('Номенклатура')) {
        foundRows++
        console.log(`Строка ${i + 1}:`)
        console.log(`  D: "${d.substring(0, 60)}${d.length > 60 ? '...' : ''}"`)
        console.log(`  E: "${e}"`)
        console.log(`  F: "${f}"`)
        console.log('')
        
        if (foundRows >= 5) break
      }
    }
  }
}

testVektorStructure()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Ошибка:', error)
    process.exit(1)
  })


