/**
 * Отладка парсинга Аметиста - сравнение локального и продакшн результатов
 */
import { prisma } from '../lib/db/prisma'
import { AmetistParser } from '../lib/parsers/ametist-parser'
import * as XLSX from 'xlsx'
import AdmZip from 'adm-zip'

async function debugAmetistParsing() {
  try {
    console.log('🔍 Отладка парсинга Аметиста...\n')

    const ametist = await prisma.supplier.findFirst({
      where: { name: 'Аметист' },
    })

    if (!ametist) {
      console.log('❌ Поставщик Аметист не найден')
      return
    }

    const parser = new AmetistParser(ametist.id, ametist.name)
    
    // Получаем правила
    const rules = await parser.loadRules()
    console.log('\n📋 Правила парсинга:')
    console.log(JSON.stringify(rules, null, 2))
    
    // Получаем файл
    console.log('\n📧 Получение файла из почты...')
    const attachment = await (parser as any).fetchLatestEmailAttachment()
    
    if (!attachment) {
      console.log('❌ Файл не найден')
      return
    }
    
    console.log(`✅ Файл получен: ${attachment.filename} (${attachment.content.length} bytes)`)
    
    // Распаковываем и анализируем структуру
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
      console.log(`✅ Excel файл извлечен: ${excelEntry.entryName}`)
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
    
    console.log(`\n📊 Структура файла:`)
    console.log(`   Всего строк: ${data.length}`)
    console.log(`   Максимум колонок: ${Math.max(...data.map(row => row.length), 0)}`)
    
    // Показываем первые 10 строк
    console.log(`\n📋 Первые 10 строк файла:`)
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i]
      const rowPreview = row.slice(0, 11).map((cell: any) => {
        const str = String(cell || '').substring(0, 20)
        return str || '(пусто)'
      }).join(' | ')
      console.log(`   Строка ${i + 1}: ${rowPreview}...`)
    }
    
    // Применяем правила парсинга
    const startRow = rules?.headerRow !== undefined ? rules.headerRow + 1 : 1
    console.log(`\n🔧 Применение правил:`)
    console.log(`   headerRow: ${rules?.headerRow}`)
    console.log(`   skipRows: ${rules?.skipRows}`)
    console.log(`   startRow (для парсинга): ${startRow}`)
    
    // Подсчитываем, сколько строк будет обработано
    let processedRows = 0
    let skippedRows = 0
    let emptyRows = 0
    let validRows = 0
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1
      
      // Пропускаем строки согласно правилам
      if (rules?.skipRows?.includes(rowNumber)) {
        skippedRows++
        continue
      }
      
      processedRows++
      
      // Проверяем, есть ли коллекция (колонка C, индекс 2)
      const collectionCol = rules?.columnMappings?.collection ?? 2
      const collection = row[collectionCol]?.toString().trim() || ''
      
      if (!collection) {
        emptyRows++
        continue
      }
      
      // Проверяем, есть ли цвет (колонка E, индекс 4)
      const colorCol = rules?.columnMappings?.color ?? 4
      const color = row[colorCol]?.toString().trim() || ''
      
      if (!color) {
        emptyRows++
        continue
      }
      
      validRows++
    }
    
    console.log(`\n📊 Статистика обработки:`)
    console.log(`   Всего строк в файле: ${data.length}`)
    console.log(`   Начало парсинга со строки: ${startRow + 1}`)
    console.log(`   Строк для обработки: ${data.length - startRow}`)
    console.log(`   Пропущено по skipRows: ${skippedRows}`)
    console.log(`   Обработано строк: ${processedRows}`)
    console.log(`   Пустых строк (без коллекции/цвета): ${emptyRows}`)
    console.log(`   Валидных строк (с коллекцией и цветом): ${validRows}`)
    
    // Теперь запускаем реальный парсинг
    console.log(`\n🚀 Запуск реального парсинга...`)
    const fabrics = await parser.parse('')
    console.log(`\n✅ Результат парсинга:`)
    console.log(`   Найдено тканей: ${fabrics.length}`)
    console.log(`   Ожидалось (по статистике): ~${validRows}`)
    
    if (fabrics.length !== validRows) {
      console.log(`\n⚠️ РАСХОЖДЕНИЕ: Найдено ${fabrics.length} тканей, но ожидалось ~${validRows}`)
      console.log(`   Возможные причины:`)
      console.log(`   - Дополнительная фильтрация в парсере`)
      console.log(`   - Проблемы с парсингом метража/наличия`)
      console.log(`   - Ошибки при обработке некоторых строк`)
    }
    
    // Показываем примеры тканей с метражом и без
    const withMeterage = fabrics.filter(f => f.meterage !== null && f.meterage > 0)
    const withoutMeterage = fabrics.filter(f => !f.meterage || f.meterage === 0)
    
    console.log(`\n📊 Детализация:`)
    console.log(`   Тканей с метражом: ${withMeterage.length}`)
    console.log(`   Тканей без метража: ${withoutMeterage.length}`)
    console.log(`   В наличии: ${fabrics.filter(f => f.inStock === true).length}`)
    console.log(`   Не в наличии: ${fabrics.filter(f => f.inStock === false).length}`)
    console.log(`   Статус неизвестен: ${fabrics.filter(f => f.inStock === null).length}`)
    
  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugAmetistParsing()

