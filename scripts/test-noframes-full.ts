import axios from 'axios'
import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testNoFramesFull() {
  console.log('='.repeat(80))
  console.log('ПОЛНЫЙ ТЕСТ ПАРСЕРА NOFRAMES')
  console.log('='.repeat(80))
  
  // Шаг 1: Загружаем правила из базы данных
  console.log('\nШаг 1: Загрузка правил из базы данных...')
  const supplier = await prisma.supplier.findFirst({
    where: { name: 'NoFrames' },
  })
  
  if (!supplier) {
    console.error('Поставщик NoFrames не найден в базе данных!')
    await prisma.$disconnect()
    return
  }
  
  console.log(`Найден поставщик: ${supplier.name} (ID: ${supplier.id})`)
  console.log(`URL парсинга: ${supplier.parsingUrl}`)
  
  const rulesRecord = await prisma.parsingRule.findUnique({
    where: { supplierId: supplier.id },
  })
  
  if (!rulesRecord) {
    console.error('Правила парсинга не найдены в базе данных!')
    await prisma.$disconnect()
    return
  }
  
  const rules = JSON.parse(rulesRecord.rules)
  console.log('Правила парсинга:')
  console.log(JSON.stringify(rules, null, 2))
  
  // Шаг 2: Загружаем файл
  console.log('\nШаг 2: Загрузка файла...')
  const url = supplier.parsingUrl.replace('{timestamp}', Date.now().toString())
  console.log(`URL: ${url}`)
  
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  })
  
  const buffer = Buffer.from(response.data)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  
  console.log(`Файл загружен. Вкладок: ${workbook.SheetNames.length}`)
  workbook.SheetNames.forEach((name, idx) => {
    console.log(`  ${idx + 1}. "${name}"`)
  })
  
  // Шаг 3: Анализ целевых вкладок
  console.log('\nШаг 3: Анализ целевых вкладок...')
  const targetSheets = ['ОСНОВНЫЕ КОЛЛЕКЦИИ', 'РАСПРОДАЖА']
  const collectionCol = rules.columnMappings.collection ?? 1
  const inStockCol = rules.columnMappings.inStock ?? 3
  const arrivalCol = rules.columnMappings.nextArrivalDate ?? 4
  
  console.log(`Колонки для парсинга:`)
  console.log(`  Коллекция+цвет: колонка ${String.fromCharCode(65 + collectionCol)} (индекс ${collectionCol})`)
  console.log(`  Наличие: колонка ${String.fromCharCode(65 + inStockCol)} (индекс ${inStockCol})`)
  console.log(`  Дата: колонка ${String.fromCharCode(65 + arrivalCol)} (индекс ${arrivalCol})`)
  console.log(`Пропускать строки: ${rules.skipRows?.join(', ') || 'нет'}`)
  console.log(`Пропускать паттерны: ${rules.skipPatterns?.join(', ') || 'нет'}`)
  
  let totalFabrics = 0
  
  for (const sheetName of targetSheets) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) {
      console.log(`\nВкладка "${sheetName}" не найдена`)
      continue
    }
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`ВКЛАДКА: "${sheetName}"`)
    console.log('='.repeat(80))
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '',
      raw: false 
    }) as any[][]
    
    console.log(`Всего строк в файле: ${jsonData.length}`)
    
    let fabricsFound = 0
    let skippedByRules = 0
    let skippedByPatterns = 0
    let skippedEmpty = 0
    let skippedNoCollection = 0
    let skippedNoDigits = 0
    let processed = 0
    
    // Показываем первые 15 строк для анализа
    console.log(`\nПервые 15 строк:`)
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = jsonData[i] || []
      const rowNumber = i + 1
      const collectionColor = String(row[collectionCol] || '').trim()
      const inStock = String(row[inStockCol] || '').trim()
      const arrival = String(row[arrivalCol] || '').trim()
      
      const shouldSkip = rules.skipRows?.includes(rowNumber)
      const hasPattern = rules.skipPatterns?.some(p => collectionColor.includes(p))
      const hasNoDigits = collectionColor && !/\d/.test(collectionColor)
      
      console.log(`Строка ${rowNumber}:`)
      console.log(`  ${String.fromCharCode(65 + collectionCol)}: "${collectionColor.substring(0, 50)}"`)
      console.log(`  ${String.fromCharCode(65 + inStockCol)}: "${inStock}"`)
      console.log(`  ${String.fromCharCode(65 + arrivalCol)}: "${arrival}"`)
      console.log(`  → Пропуск по skipRows: ${shouldSkip ? 'ДА' : 'нет'}`)
      console.log(`  → Пропуск по skipPatterns: ${hasPattern ? 'ДА' : 'нет'}`)
      console.log(`  → Нет цифр: ${hasNoDigits ? 'ДА (название коллекции)' : 'нет'}`)
    }
    
    // Обрабатываем все строки
    console.log(`\nОбработка всех строк...`)
    for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
      const rowNumber = rowIndex + 1
      
      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        skippedByRules++
        continue
      }
      
      const row = jsonData[rowIndex]
      if (!row || row.length === 0) {
        skippedEmpty++
        continue
      }
      
      let collectionColor = ''
      let inStockText = ''
      let arrivalText = ''
      
      // Читаем значения
      if (row[collectionCol] !== undefined && row[collectionCol] !== null) {
        collectionColor = String(row[collectionCol]).trim()
      }
      if (row[inStockCol] !== undefined && row[inStockCol] !== null) {
        inStockText = String(row[inStockCol]).trim()
      }
      if (row[arrivalCol] !== undefined && row[arrivalCol] !== null) {
        arrivalText = String(row[arrivalCol]).trim()
      }
      
      // Пропускаем по паттернам
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        skippedByPatterns++
        continue
      }
      
      if (!collectionColor) {
        skippedNoCollection++
        continue
      }
      
      // Пропускаем строки без цифр (названия коллекций)
      if (!/\d/.test(collectionColor)) {
        skippedNoDigits++
        continue
      }
      
      // Применяем специальные правила
      let testText = collectionColor
      if (rules.specialRules?.removeFurnitureText) {
        testText = testText.replace(/мебельная\s+ткань\s*/gi, '').trim()
        testText = testText.replace(/ткань\s+мебельная\s*/gi, '').trim()
      }
      if (rules.specialRules?.removeQuotes) {
        testText = testText.replace(/["'"]/g, '').trim()
      }
      
      // Парсим коллекцию и цвет
      const match = testText.match(/^([A-Za-zА-Яа-яЁё\s]+?)\s*(\d+.*)$/)
      let collection = ''
      let color = ''
      
      if (match) {
        collection = match[1].trim()
        color = match[2].trim()
      } else {
        collection = testText
        color = ''
      }
      
      // Проверяем, что есть коллекция или цвет
      if (collection || color) {
        fabricsFound++
        processed++
        
        // Показываем первые 5 найденных тканей
        if (fabricsFound <= 5) {
          console.log(`\n✓ Ткань ${fabricsFound}:`)
          console.log(`  Оригинал: "${collectionColor}"`)
          console.log(`  После обработки: "${testText}"`)
          console.log(`  Коллекция: "${collection}"`)
          console.log(`  Цвет: "${color}"`)
          console.log(`  Наличие: "${inStockText}"`)
          console.log(`  Дата: "${arrivalText}"`)
        }
      } else {
        processed++
        if (processed <= 10) {
          console.log(`\n✗ Строка ${rowNumber} не распознана:`)
          console.log(`  Оригинал: "${collectionColor}"`)
          console.log(`  После обработки: "${testText}"`)
          console.log(`  Коллекция: "${collection}"`)
          console.log(`  Цвет: "${color}"`)
        }
      }
    }
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`СТАТИСТИКА для "${sheetName}":`)
    console.log(`  Всего строк: ${jsonData.length}`)
    console.log(`  Пропущено по skipRows: ${skippedByRules}`)
    console.log(`  Пропущено по skipPatterns: ${skippedByPatterns}`)
    console.log(`  Пропущено пустых: ${skippedEmpty}`)
    console.log(`  Пропущено без коллекции: ${skippedNoCollection}`)
    console.log(`  Пропущено без цифр (названия коллекций): ${skippedNoDigits}`)
    console.log(`  Обработано: ${processed}`)
    console.log(`  Найдено тканей: ${fabricsFound}`)
    
    totalFabrics += fabricsFound
  }
  
  console.log(`\n${'='.repeat(80)}`)
  console.log(`ИТОГО: Найдено тканей: ${totalFabrics}`)
  console.log('='.repeat(80))
  
  await prisma.$disconnect()
}

testNoFramesFull().catch(console.error)


