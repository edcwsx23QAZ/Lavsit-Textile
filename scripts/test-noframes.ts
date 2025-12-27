import axios from 'axios'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

async function testNoFramesParser() {
  const url = 'https://no-frames.ru/design/themes/abt__unitheme2/media/files/NALICHIE_NA_SKLADE_NOFRAMES.XLS?v=' + Date.now().toString()
  
  console.log('='.repeat(80))
  console.log('ТЕСТ ПАРСЕРА NOFRAMES')
  console.log('='.repeat(80))
  console.log(`URL: ${url}`)
  console.log('')
  
  // Шаг 1: Загрузка файла
  console.log('Шаг 1: Загрузка файла...')
  let response
  try {
    response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })
    console.log(`✓ Файл загружен успешно`)
    console.log(`  Размер: ${response.data.length} байт`)
    console.log(`  Content-Type: ${response.headers['content-type']}`)
    console.log('')
  } catch (error: any) {
    console.error(`✗ Ошибка загрузки: ${error.message}`)
    if (error.response) {
      console.error(`  Status: ${error.response.status}`)
      console.error(`  Headers:`, error.response.headers)
    }
    return
  }
  
  // Сохраняем файл для анализа
  const testDir = path.join(process.cwd(), 'test-files')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
  const filePath = path.join(testDir, 'noframes-test.xls')
  fs.writeFileSync(filePath, response.data)
  console.log(`✓ Файл сохранен: ${filePath}`)
  console.log('')
  
  // Шаг 2: Анализ формата файла
  console.log('Шаг 2: Анализ формата файла...')
  const buffer = Buffer.from(response.data)
  const header = buffer.slice(0, 8)
  console.log(`  Первые 8 байт (hex): ${header.toString('hex')}`)
  
  // Проверяем сигнатуру файла
  const xlsxSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04]) // ZIP signature (XLSX)
  const xlsSignature = Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]) // OLE signature (XLS)
  
  if (header.slice(0, 4).equals(xlsxSignature)) {
    console.log('  ✓ Определен формат: XLSX (новый формат Excel)')
  } else if (header.slice(0, 8).equals(xlsSignature)) {
    console.log('  ⚠ Определен формат: XLS (старый формат Excel)')
    console.log('  ⚠ ExcelJS может не поддерживать этот формат!')
  } else {
    console.log('  ? Неизвестный формат файла')
  }
  console.log('')
  
  // Шаг 3: Попытка загрузки через xlsx
  console.log('Шаг 3: Загрузка через xlsx...')
  let workbook: XLSX.WorkBook
  try {
    const buffer = Buffer.from(response.data)
    workbook = XLSX.read(buffer, { type: 'buffer' })
    console.log('✓ Файл успешно загружен через xlsx')
    console.log('')
  } catch (error: any) {
    console.error(`✗ Ошибка загрузки через xlsx: ${error.message}`)
    console.error(`  Stack: ${error.stack}`)
    return
  }
  
  // Шаг 4: Анализ вкладок
  console.log('Шаг 4: Анализ вкладок...')
  console.log(`  Всего вкладок: ${workbook.SheetNames.length}`)
  console.log('')
  
  workbook.SheetNames.forEach((sheetName, index) => {
    const sheet = workbook.Sheets[sheetName]
    const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null
    
    console.log(`  Вкладка ${index + 1}:`)
    console.log(`    Имя: "${sheetName}"`)
    console.log(`    Длина имени: ${sheetName.length} символов`)
    console.log(`    Имя (hex): ${Buffer.from(sheetName).toString('hex')}`)
    console.log(`    Имя (trim): "${sheetName.trim()}"`)
    if (range) {
      console.log(`    Строк: ${range.e.r + 1}`)
      console.log(`    Колонок: ${range.e.c + 1}`)
    } else {
      console.log(`    Строк: неизвестно`)
      console.log(`    Колонок: неизвестно`)
    }
    
    // Проверяем, является ли это нужной вкладкой
    const nameUpper = sheetName.trim().toUpperCase()
    const isMain = nameUpper === 'ОСНОВНЫЕ КОЛЛЕКЦИИ' || (nameUpper.includes('ОСНОВНЫЕ') && nameUpper.includes('КОЛЛЕКЦИИ'))
    const isSale = nameUpper === 'РАСПРОДАЖА' || nameUpper.includes('РАСПРОДАЖА')
    
    if (isMain) {
      console.log(`    ✓ Это вкладка "ОСНОВНЫЕ КОЛЛЕКЦИИ"`)
    } else if (isSale) {
      console.log(`    ✓ Это вкладка "РАСПРОДАЖА"`)
    } else {
      console.log(`    - Не является целевой вкладкой`)
    }
    console.log('')
  })
  
  // Шаг 5: Поиск целевых вкладок
  console.log('Шаг 5: Поиск целевых вкладок...')
  const targetNames = ['ОСНОВНЫЕ КОЛЛЕКЦИИ', 'РАСПРОДАЖА']
  
  targetNames.forEach(targetName => {
    const exactMatch = workbook.SheetNames.find(name => name === targetName)
    const trimMatch = workbook.SheetNames.find(name => name.trim() === targetName)
    const upperMatch = workbook.SheetNames.find(name => name.trim().toUpperCase() === targetName.toUpperCase())
    const includesMatch = workbook.SheetNames.find(name => {
      const n = name.trim().toUpperCase()
      return n.includes(targetName.toUpperCase())
    })
    
    console.log(`  Поиск: "${targetName}"`)
    if (exactMatch) {
      console.log(`    ✓ Точное совпадение: "${exactMatch}"`)
    } else if (trimMatch) {
      console.log(`    ✓ Совпадение после trim: "${trimMatch}"`)
    } else if (upperMatch) {
      console.log(`    ✓ Совпадение без учета регистра: "${upperMatch}"`)
    } else if (includesMatch) {
      console.log(`    ✓ Частичное совпадение: "${includesMatch}"`)
    } else {
      console.log(`    ✗ Не найдено`)
    }
    console.log('')
  })
  
  // Шаг 6: Анализ данных первой целевой вкладки
  console.log('Шаг 6: Анализ данных...')
  const mainSheetName = workbook.SheetNames.find(name => {
    const n = name.trim().toUpperCase()
    return n === 'ОСНОВНЫЕ КОЛЛЕКЦИИ' || (n.includes('ОСНОВНЫЕ') && n.includes('КОЛЛЕКЦИИ'))
  }) || workbook.SheetNames[0]
  
  if (mainSheetName) {
    const mainSheet = workbook.Sheets[mainSheetName]
    const jsonData = XLSX.utils.sheet_to_json(mainSheet, { header: 1, defval: '', raw: false }) as any[][]
    
    console.log(`  Анализ вкладки: "${mainSheetName}"`)
    console.log(`  Первые 5 строк:`)
    console.log('')
    
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
      const row = jsonData[i] || []
      const rowData: string[] = []
      for (let j = 0; j < Math.min(5, row.length); j++) {
        const value = String(row[j] || '').substring(0, 30)
        rowData.push(`${String.fromCharCode(65 + j)}: ${value}`)
      }
      console.log(`    Строка ${i + 1}: ${rowData.join(' | ')}`)
    }
    console.log('')
  }
  
  console.log('='.repeat(80))
  console.log('ТЕСТ ЗАВЕРШЕН')
  console.log('='.repeat(80))
}

testNoFramesParser().catch(console.error)

