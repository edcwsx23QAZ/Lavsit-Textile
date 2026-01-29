/**
 * Тест парсинга значений "> 100" в Аметисте
 */
import { prisma } from '../lib/db/prisma'
import { AmetistParser } from '../lib/parsers/ametist-parser'
import * as XLSX from 'xlsx'
import AdmZip from 'adm-zip'

async function testAmetist100Parsing() {
  try {
    console.log('🔍 Тест парсинга значений "> 100"...\n')

    const ametist = await prisma.supplier.findFirst({
      where: { name: 'Аметист' },
    })

    if (!ametist) {
      console.log('❌ Поставщик Аметист не найден')
      return
    }

    const parser = new AmetistParser(ametist.id, ametist.name)
    
    // Получаем файл
    const attachment = await (parser as any).fetchLatestEmailAttachment()
    if (!attachment) {
      console.log('❌ Файл не найден')
      return
    }
    
    // Распаковываем
    let excelBuffer: Buffer
    if (attachment.filename.endsWith('.zip')) {
      const zip = new AdmZip(attachment.content)
      const zipEntries = zip.getEntries()
      const excelEntry = zipEntries.find(entry => 
        entry.entryName.endsWith('.xlsx') || entry.entryName.endsWith('.xls')
      )
      if (!excelEntry) {
        console.log('❌ Excel файл не найден в ZIP')
        return
      }
      excelBuffer = excelEntry.getData()
    } else {
      excelBuffer = attachment.content
    }
    
    // Загружаем Excel
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '', 
      raw: true,
    }) as any[][]
    
    // Анализируем значения метража
    const rules = await parser.loadRules()
    const meterageCol = rules?.columnMappings?.meterage ?? 6
    const startRow = rules?.headerRow ? rules.headerRow + 1 : 1
    
    let totalRows = 0
    let rowsWithGreaterThan100 = 0
    let rowsWithNumbers = 0
    let rowsWithEmpty = 0
    let rowsWithOther = 0
    
    const examples: Array<{row: number, value: any, parsed: any}> = []
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1
      
      if (rules?.skipRows?.includes(rowNumber)) continue
      
      const collectionCol = rules?.columnMappings?.collection ?? 2
      const collection = row[collectionCol]?.toString().trim() || ''
      if (!collection) continue
      
      const colorCol = rules?.columnMappings?.color ?? 4
      const color = row[colorCol]?.toString().trim() || ''
      if (!color) continue
      
      totalRows++
      
      // Получаем значение метража
      const colLetter = String.fromCharCode(65 + meterageCol)
      const cellAddress = `${colLetter}${rowNumber}`
      const cell = worksheet[cellAddress]
      
      let meterageValue: any = undefined
      
      if (cell) {
        if (cell.w !== undefined && typeof cell.w === 'string') {
          meterageValue = cell.w.trim()
        } else if (cell.v !== undefined) {
          meterageValue = cell.v
        }
      }
      
      if (meterageValue === undefined || meterageValue === null) {
        meterageValue = row[meterageCol]
      }
      
      const valueStr = String(meterageValue || '').trim()
      
      if (valueStr.includes('> 100') || valueStr.includes('>100') || valueStr.startsWith('>')) {
        rowsWithGreaterThan100++
        if (examples.length < 5) {
          examples.push({ row: rowNumber, value: meterageValue, parsed: null })
        }
      } else if (valueStr === '' || valueStr === null || valueStr === undefined) {
        rowsWithEmpty++
      } else if (!isNaN(parseFloat(valueStr.replace(/,/g, '.')))) {
        rowsWithNumbers++
      } else {
        rowsWithOther++
        if (examples.length < 10) {
          examples.push({ row: rowNumber, value: meterageValue, parsed: null })
        }
      }
    }
    
    console.log(`\n📊 Статистика значений метража:`)
    console.log(`   Всего валидных строк: ${totalRows}`)
    console.log(`   С "> 100": ${rowsWithGreaterThan100}`)
    console.log(`   С числами: ${rowsWithNumbers}`)
    console.log(`   Пустые: ${rowsWithEmpty}`)
    console.log(`   Другие: ${rowsWithOther}`)
    
    console.log(`\n📋 Примеры значений:`)
    examples.forEach(ex => {
      console.log(`   Строка ${ex.row}: "${ex.value}" (тип: ${typeof ex.value})`)
    })
    
    // Тестируем парсинг "> 100"
    console.log(`\n🧪 Тест парсинга "> 100":`)
    const testValues = ['> 100', '>100', '> 100 м', '>100м', '> 100.0', '>100.5']
    testValues.forEach(testVal => {
      let valueStr = testVal.trim()
      if (valueStr.toLowerCase().endsWith('м')) {
        valueStr = valueStr.replace(/м\s*$/i, '').trim()
      }
      const cleanedStr = valueStr.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()
      const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
      let numValue: number | null = null
      
      if (decimalMatch) {
        const wholePart = decimalMatch[1]
        const decimalPart = decimalMatch[2]
        const extractedStr = `${wholePart}.${decimalPart}`
        numValue = parseFloat(extractedStr)
      } else {
        let normalizedStr = cleanedStr.replace(/\s+/g, '').replace(/,/g, '.')
        numValue = parseFloat(normalizedStr)
        if (isNaN(numValue) || numValue === 0) {
          const integerMatch = cleanedStr.match(/(\d+)/)
          if (integerMatch) {
            numValue = parseFloat(integerMatch[1])
          }
        }
      }
      
      console.log(`   "${testVal}" -> ${numValue !== null && !isNaN(numValue) ? numValue : 'НЕ РАСПАРСЕНО'}`)
    })
    
    // Запускаем реальный парсинг и проверяем, сколько тканей с "> 100" было обработано
    console.log(`\n🚀 Запуск реального парсинга...`)
    const fabrics = await parser.parse('')
    
    const fabricsWithGreaterThan100 = fabrics.filter(f => f.meterage !== null && f.meterage >= 100)
    const fabricsWithMeterage = fabrics.filter(f => f.meterage !== null && f.meterage > 0)
    const fabricsWithoutMeterage = fabrics.filter(f => !f.meterage || f.meterage === 0)
    
    console.log(`\n✅ Результат парсинга:`)
    console.log(`   Всего тканей: ${fabrics.length}`)
    console.log(`   С метражом >= 100: ${fabricsWithGreaterThan100.length}`)
    console.log(`   С метражом > 0: ${fabricsWithMeterage.length}`)
    console.log(`   Без метража: ${fabricsWithoutMeterage.length}`)
    
    if (fabrics.length < totalRows) {
      console.log(`\n⚠️ РАСХОЖДЕНИЕ: Найдено ${fabrics.length} тканей, но ожидалось ${totalRows}`)
      console.log(`   Разница: ${totalRows - fabrics.length} тканей не обработано`)
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAmetist100Parsing()

