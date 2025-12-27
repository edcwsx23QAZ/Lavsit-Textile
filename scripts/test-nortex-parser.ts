import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { EmailExcelParser } from '../lib/parsers/email-excel-parser'
import { createAutoRules } from '../lib/parsers/auto-rules'

const filePath = 'C:\\Users\\user\\Downloads\\Нортекс. Складские остатки 19.12.xls'
const supplierId = 'test-nortex'
const supplierName = 'Нортекс'

console.log('Тестирование парсера Нортекса')
console.log('Файл:', filePath)

if (!fs.existsSync(filePath)) {
  console.error('Файл не найден!')
  process.exit(1)
}

async function test() {
  try {
    // Создаем парсер
    const parser = new EmailExcelParser(supplierId, supplierName)
    
    // Анализируем файл
    console.log('\n=== Анализ файла ===')
    const analysis = await parser.analyze(filePath)
    console.log('Вопросов:', analysis.questions.length)
    console.log('Структура:', JSON.stringify(analysis.structure, null, 2))
    
    // Создаем правила
    console.log('\n=== Создание правил ===')
    const rules = createAutoRules(supplierName, analysis)
    console.log('Правила:', JSON.stringify(rules, null, 2))
    
    // Парсим файл (используем временные правила)
    console.log('\n=== Парсинг файла ===')
    
    // Временно переопределяем loadRules для использования созданных правил
    const originalLoadRules = (parser as any).loadRules
    ;(parser as any).loadRules = async () => rules
    
    let fabrics
    try {
      fabrics = await parser.parse(filePath)
    } finally {
      // Восстанавливаем оригинальный метод
      ;(parser as any).loadRules = originalLoadRules
    }
    
    console.log(`\nНайдено тканей: ${fabrics.length}`)
    
    // Показываем первые 20 результатов
    console.log('\n=== Первые 20 результатов ===')
    fabrics.slice(0, 20).forEach((fabric, idx) => {
      console.log(`\n${idx + 1}. ${fabric.collection} ${fabric.colorNumber}`)
      console.log(`   В наличии: ${fabric.inStock}`)
      console.log(`   Метраж: ${fabric.meterage}`)
      console.log(`   Дата прихода: ${fabric.nextArrivalDate}`)
      console.log(`   Комментарий: ${fabric.comment}`)
    })
    
    // Статистика
    console.log('\n=== Статистика ===')
    const inStock = fabrics.filter(f => f.inStock === true).length
    const notInStock = fabrics.filter(f => f.inStock === false).length
    const unknownStock = fabrics.filter(f => f.inStock === null).length
    const withMeterage = fabrics.filter(f => f.meterage !== null).length
    const withArrivalDate = fabrics.filter(f => f.nextArrivalDate !== null).length
    
    console.log(`В наличии: ${inStock}`)
    console.log(`Нет в наличии: ${notInStock}`)
    console.log(`Неизвестно: ${unknownStock}`)
    console.log(`С метражем: ${withMeterage}`)
    console.log(`С датой прихода: ${withArrivalDate}`)
    
  } catch (error: any) {
    console.error('Ошибка:', error)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

test()
