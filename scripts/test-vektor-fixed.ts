import axios from 'axios'
import * as XLSX from 'xlsx'
import { VektorParser } from '../lib/parsers/vektor-parser'
import { createAutoRules } from '../lib/parsers/auto-rules'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testVektorFixed() {
  console.log('=== Тестирование исправленного парсера Vektor ===\n')

  // Получаем реальный ID поставщика Vektor
  const supplier = await prisma.supplier.findUnique({
    where: { name: 'Vektor' }
  })

  if (!supplier) {
    console.error('Поставщик Vektor не найден в базе данных!')
    await prisma.$disconnect()
    return
  }

  const supplierId = supplier.id
  const supplierName = 'Vektor'
  const parser = new VektorParser(supplierId, supplierName)

  try {
    // Находим URL
    const actualUrl = await (parser as any).findActualUrl()
    console.log(`Файл: ${actualUrl}\n`)

    // Скачиваем
    const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    // Создаем правила автоматически
    const analysis = await parser.analyze(actualUrl)
    const rules = createAutoRules(supplierName, analysis)
    await parser.saveRules(rules)
    console.log('Правила созданы автоматически\n')

    // Тестируем парсинг нескольких строк
    console.log('Тестирование парсинга строк:\n')
    
    const startRow = rules.headerRow ? rules.headerRow + 1 : 1
    let processed = 0
    let skipped = 0

    for (let i = startRow; i < Math.min(startRow + 50, data.length); i++) {
      const row = data[i]
      const collectionCol = rules.columnMappings.collection ?? 0
      const collectionColor = row[collectionCol]?.toString().trim() || ''

      if (!collectionColor) {
        skipped++
        continue
      }

      // Пропускаем по паттернам
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        skipped++
        continue
      }

      // Проверяем колонку E
      const eValue = row[4]?.toString().trim() || ''
      if (!eValue || (eValue !== 'пог.м' && eValue !== 'шт')) {
        skipped++
        continue
      }

      // Парсим коллекцию и цвет
      const { collection, color } = (parser as any).parseCollectionAndColor(collectionColor, rules.specialRules)

      if (!collection || !color) {
        skipped++
        continue
      }

      // Парсим наличие
      const fValue = row[5]
      let meterage: number | null = null
      let inStock: boolean | null = null

      if (fValue !== undefined && fValue !== null && fValue !== '') {
        const fStr = String(fValue).trim().toLowerCase()
        
        if (fStr.includes('по запросу')) {
          inStock = false
        } else if (fStr.startsWith('>')) {
          const numMatch = fStr.match(/>\s*(\d+(?:[.,]\d+)?)/)
          if (numMatch) {
            const numValue = parseFloat(numMatch[1].replace(',', '.'))
            if (!isNaN(numValue) && numValue > 0) {
              meterage = numValue
              inStock = true
            }
          }
        } else {
          const numValue = parseFloat(String(fValue).replace(',', '.'))
          if (!isNaN(numValue) && numValue > 0) {
            meterage = numValue
            inStock = true
          }
        }
      }

      processed++
      console.log(`Строка ${i + 1}:`)
      console.log(`  Исходный текст: "${collectionColor.substring(0, 60)}"`)
      console.log(`  → Коллекция: "${collection}", Цвет: "${color}"`)
      console.log(`  E (единица): "${eValue}"`)
      console.log(`  F (наличие): "${fValue}" → ${inStock ? `В наличии, ${meterage}м` : 'Нет в наличии'}`)
      console.log('')

      if (processed >= 10) break
    }

    console.log(`\nОбработано: ${processed}, Пропущено: ${skipped}`)

    // Полный парсинг
    console.log('\n=== Полный парсинг ===\n')
    const fabrics = await parser.parse(actualUrl)
    console.log(`Найдено тканей: ${fabrics.length}\n`)

    if (fabrics.length > 0) {
      console.log('Первые 10 тканей:')
      fabrics.slice(0, 10).forEach((f, idx) => {
        console.log(`  ${idx + 1}. ${f.collection} ${f.colorNumber} - ${f.inStock ? `В наличии${f.meterage ? ` (${f.meterage}м)` : ''}` : 'Нет в наличии'}`)
      })
    } else {
      console.log('⚠️ Ткани не найдены!')
    }

  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
  }
}

testVektorFixed()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (error) => {
    console.error('Критическая ошибка:', error)
    await prisma.$disconnect()
    process.exit(1)
  })

