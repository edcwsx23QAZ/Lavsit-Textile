import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'

const filePath = 'C:\\Users\\user\\Downloads\\Нортекс. Складские остатки 19.12.xls'

console.log('Анализ файла Нортекса:', filePath)

if (!fs.existsSync(filePath)) {
  console.error('Файл не найден!')
  process.exit(1)
}

// Загружаем файл
const buffer = fs.readFileSync(filePath)
const workbook = XLSX.read(buffer, { type: 'buffer' })

console.log(`\nВкладки: ${workbook.SheetNames.join(', ')}`)

// Используем первую вкладку
const sheetName = workbook.SheetNames[0]
const worksheet = workbook.Sheets[sheetName]

// Конвертируем в JSON
const jsonData = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  defval: '',
  raw: false,
}) as any[][]

console.log(`\nВсего строк: ${jsonData.length}`)
console.log(`\nПервые 20 строк:`)

// Ищем строки с данными (где в столбце C есть "Ткань")
// Ищем примеры с заполненным G или F с необычными данными
let dataRowsFound = 0
let specialRowsFound = 0
for (let i = 0; i < jsonData.length; i++) {
  const row = jsonData[i] || []
  const cValue = row[2] ? String(row[2]).trim() : ''
  
  // Пропускаем строки без "Ткань" в столбце C
  if (!cValue.toLowerCase().includes('ткань')) {
    continue
  }
  
  dataRowsFound++
  console.log(`\nСтрока ${i + 1} (строка с данными #${dataRowsFound}):`)
  console.log(`  A (0): ${row[0] || '(пусто)'}`)
  console.log(`  B (1): ${row[1] || '(пусто)'}`)
  console.log(`  C (2): ${row[2] || '(пусто)'} <- коллекция и цвет`)
  console.log(`  D (3): ${row[3] || '(пусто)'}`)
  console.log(`  E (4): ${row[4] || '(пусто)'}`)
  console.log(`  F (5): ${row[5] || '(пусто)'} <- наличие/метраж/комментарий`)
  console.log(`  G (6): ${row[6] || '(пусто)'} <- наличие 100+м`)
  
  // Парсим коллекцию и цвет из столбца C (или D, если пользователь прав)
  // Проверяем оба столбца
  const cText = cValue
  const dText = row[3] ? String(row[3]).trim() : ''
  
  // Пробуем столбец C
  if (cText.toLowerCase().includes('ткань')) {
    console.log(`    Парсинг из C: "${cText}":`)
    
    // Игнорируем слово "ткань"
    let text = cText.replace(/^ткань\s+/i, '').trim()
    
    // Первое слово - коллекция, остальное - цвет
    const parts = text.split(/\s+/)
    if (parts.length > 0) {
      const collection = parts[0]
      const color = parts.slice(1).join(' ')
      console.log(`      Коллекция: "${collection}"`)
      console.log(`      Цвет: "${color}"`)
    }
  }
  
  // Пробуем столбец D
  if (dText && dText.toLowerCase().includes('ткань')) {
    console.log(`    Парсинг из D: "${dText}":`)
    
    let text = dText.replace(/^ткань\s+/i, '').trim()
    const parts = text.split(/\s+/)
    if (parts.length > 0) {
      const collection = parts[0]
      const color = parts.slice(1).join(' ')
      console.log(`      Коллекция: "${collection}"`)
      console.log(`      Цвет: "${color}"`)
    }
  }
  
  // Анализируем столбцы F и G
  const fValue = row[5] ? String(row[5]).trim() : ''
  const gValue = row[6] ? String(row[6]).trim() : ''
  
  console.log(`    Анализ наличия:`)
  console.log(`      E (4): "${row[4] || '(пусто)'}"`)
  console.log(`      F (5): "${fValue}"`)
  console.log(`      G (6): "${gValue}"`)
  
  if (gValue) {
    console.log(`      -> В наличии, метраж 100+м`)
  } else if (fValue) {
    // Проверяем на галочку (обычно это TRUE или специальный символ)
    if (fValue === 'TRUE' || fValue === '✓' || fValue === '✔' || fValue === 'V' || fValue === 'v' || fValue.toLowerCase() === 'true') {
      console.log(`      -> В наличии, метраж < 100м (галочка)`)
    } else if (/^\d+[\.,]?\d*/.test(fValue)) {
      // Цифры - метраж
      const match = fValue.match(/^(\d+[\.,]?\d*)/)
      if (match) {
        console.log(`      -> Метраж: ${match[1]}`)
      }
    } else if (/приход|поступление|декабрь|январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь/i.test(fValue)) {
      // Текст с датой прихода
      console.log(`      -> Нет в наличии, дата прихода: "${fValue}"`)
    } else {
      // Другой текст - комментарий
      console.log(`      -> Комментарий: "${fValue}"`)
    }
  } else {
    // Проверяем столбец E на галочку
    const eValue = row[4] ? String(row[4]).trim() : ''
    if (eValue === 'V' || eValue === 'v' || eValue === 'TRUE' || eValue.toLowerCase() === 'true') {
      console.log(`      -> В наличии, метраж < 100м (галочка в E)`)
    } else {
      console.log(`      -> Нет в наличии (оба столбца пустые)`)
    }
  }
}

