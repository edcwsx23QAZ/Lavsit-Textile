import * as cheerio from 'cheerio'
import axios from 'axios'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testViptextilComplete() {
  const url = 'http://tgn1.viptextil.ru/vip/ostatki.html'
  
  try {
    console.log('=== ПОЛНОЕ ТЕСТИРОВАНИЕ VIPTEXTIL ===\n')
    
    // Шаг 1: Загружаем HTML
    console.log('Шаг 1: Загружаем HTML...')
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const $ = cheerio.load(response.data)
    console.log('✓ HTML загружен\n')
    
    // Шаг 2: Находим таблицу
    console.log('Шаг 2: Ищем таблицу...')
    const table = $('table').first()
    if (table.length === 0) {
      console.error('❌ Таблица не найдена')
      return
    }
    console.log('✓ Таблица найдена\n')
    
    // Шаг 3: Анализируем структуру
    console.log('Шаг 3: Анализ структуры таблицы...\n')
    
    let totalRows = 0
    let rowsWith2Cells = 0
    let rowsWithData = 0
    let validFabrics = 0
    const examples: any[] = []
    
    table.find('tr').each((index, row) => {
      const rowIndex = index + 1
      totalRows++
      
      const cells = $(row).find('td, th')
      
      if (cells.length < 2) {
        return
      }
      
      rowsWith2Cells++
      
      const col1 = $(cells[0]).text().trim()
      const col2 = $(cells[1]).text().trim()
      
      // Пропускаем пустые строки
      if (!col1 && !col2) {
        return
      }
      
      const col1Lower = col1.toLowerCase()
      const col2Lower = col2.toLowerCase()
      
      // Пропускаем заголовки
      if (col1Lower.includes('номенклатура') || 
          col1Lower.includes('итого') ||
          col1Lower.includes('остатки на:')) {
        return
      }
      
      // Пропускаем заголовки разделов
      if (col1Lower.includes('искусственная') ||
          col1Lower.includes('кожа иск') ||
          col1Lower === 'ткани' ||
          col1Lower === 'жакард' ||
          col1Lower === 'шенилл' ||
          col1Lower === 'остатки' ||
          col1Lower === 'итого' ||
          col1Lower === 'компаньон' ||
          col1Lower === 'основа') {
        return
      }
      
      // КЛЮЧЕВАЯ ПРОВЕРКА: Если вторая колонка пуста - пропускаем
      if (!col2 || col2.length === 0) {
        return
      }
      
      // Пропускаем пустую первую колонку
      if (!col1 || col1.length === 0) {
        return
      }
      
      rowsWithData++
      
      // Парсим коллекцию и цвет
      const parts = col1.split(/\s+/).filter(p => p.trim().length > 0)
      
      if (parts.length < 2) {
        return
      }
      
      const collection = parts[0].trim()
      const color = parts.slice(1).join(' ').trim()
      
      if (!collection || !color || collection.length === 0 || color.length === 0) {
        return
      }
      
      // Парсим наличие
      let inStock = false
      if (col2Lower.includes('есть в наличии')) {
        inStock = true
      }
      
      validFabrics++
      
      if (validFabrics <= 20) {
        examples.push({ rowIndex, collection, color, inStock, col2 })
        console.log(`  Строка ${rowIndex}: "${collection}" "${color}" - ${inStock ? 'В наличии' : 'Не в наличии'} (${col2})`)
      }
    })
    
    console.log(`\n=== СТАТИСТИКА ===`)
    console.log(`Всего строк: ${totalRows}`)
    console.log(`Строк с 2+ ячейками: ${rowsWith2Cells}`)
    console.log(`Строк с данными: ${rowsWithData}`)
    console.log(`Валидных тканей: ${validFabrics}\n`)
    
    if (validFabrics === 0) {
      console.log('❌ ПРОБЛЕМА: Не найдено ни одной валидной ткани!')
      console.log('\nДетальный анализ первых 50 строк:\n')
      table.find('tr').slice(0, 50).each((index, row) => {
        const cells = $(row).find('td, th')
        if (cells.length >= 2) {
          const col1 = $(cells[0]).text().trim()
          const col2 = $(cells[1]).text().trim()
          console.log(`Строка ${index + 1}: "${col1}" | "${col2}"`)
        }
      })
      return
    }
    
    // Шаг 4: Проверяем примеры Pegas
    console.log('\n=== ПРОВЕРКА ПРИМЕРОВ PEGAS ===\n')
    const pegasExamples = examples.filter(e => e.collection.toLowerCase() === 'pegas')
    if (pegasExamples.length > 0) {
      console.log(`Найдено примеров Pegas: ${pegasExamples.length}`)
      pegasExamples.forEach((ex, i) => {
        console.log(`  ${i + 1}. "${ex.collection}" "${ex.color}" - ${ex.inStock ? 'В наличии' : 'Не в наличии'} (${ex.col2})`)
      })
    } else {
      console.log('⚠️ Примеры Pegas не найдены в первых 20 тканях')
    }
    
    // Шаг 5: Тестируем сохранение в БД
    console.log('\n=== ТЕСТИРОВАНИЕ СОХРАНЕНИЯ В БД ===\n')
    
    // Находим поставщика Viptextil
    const supplier = await prisma.supplier.findFirst({
      where: { name: 'Viptextil' }
    })
    
    if (!supplier) {
      console.log('❌ Поставщик Viptextil не найден в БД')
      return
    }
    
    console.log(`✓ Поставщик найден: ${supplier.name} (ID: ${supplier.id})`)
    
    // Проверяем текущее количество тканей
    const currentCount = await prisma.fabric.count({
      where: { supplierId: supplier.id }
    })
    console.log(`Текущее количество тканей в БД: ${currentCount}`)
    
    // Пробуем создать тестовую ткань
    const testFabric = examples[0]
    if (testFabric) {
      console.log(`\nПробуем создать тестовую ткань: "${testFabric.collection}" "${testFabric.color}"`)
      
      try {
        const existing = await prisma.fabric.findFirst({
          where: {
            supplierId: supplier.id,
            collection: testFabric.collection,
            color: testFabric.color
          }
        })
        
        if (existing) {
          console.log(`✓ Ткань уже существует (ID: ${existing.id})`)
          console.log(`  Наличие: ${existing.isAvailable}`)
          console.log(`  Обновлена: ${existing.lastUpdatedAt}`)
        } else {
          console.log('Ткань не найдена, пробуем создать...')
          const newFabric = await prisma.fabric.create({
            data: {
              supplierId: supplier.id,
              collection: testFabric.collection,
              color: testFabric.color,
              isAvailable: testFabric.inStock,
              comment: testFabric.inStock === false ? testFabric.col2 : null,
            }
          })
          console.log(`✓ Ткань успешно создана (ID: ${newFabric.id})`)
          
          // Удаляем тестовую ткань
          await prisma.fabric.delete({ where: { id: newFabric.id } })
          console.log('✓ Тестовая ткань удалена')
        }
      } catch (error: any) {
        console.error('❌ Ошибка при создании/поиске ткани:', error.message)
        console.error('Stack:', error.stack)
      }
    }
    
    // Шаг 6: Тестируем через API парсер
    console.log('\n=== ТЕСТИРОВАНИЕ ЧЕРЕЗ ПАРСЕР ===\n')
    
    const { ViptextilParser } = await import('../lib/parsers/viptextil-parser')
    const parser = new ViptextilParser(supplier.id, supplier.name)
    
    console.log('Запускаем парсер...')
    const parsedFabrics = await parser.parse(url)
    
    console.log(`Парсер вернул ${parsedFabrics.length} тканей`)
    
    if (parsedFabrics.length > 0) {
      console.log('\nПримеры тканей из парсера:')
      parsedFabrics.slice(0, 10).forEach((f, i) => {
        console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
      })
      
      // Проверяем примеры Pegas
      const pegasFromParser = parsedFabrics.filter(f => f.collection.toLowerCase() === 'pegas')
      if (pegasFromParser.length > 0) {
        console.log(`\n✓ Найдено тканей Pegas в парсере: ${pegasFromParser.length}`)
        pegasFromParser.slice(0, 5).forEach((f, i) => {
          console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
        })
      } else {
        console.log('\n⚠️ Ткани Pegas не найдены в результатах парсера')
      }
    } else {
      console.log('❌ Парсер не вернул ни одной ткани!')
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testViptextilComplete()


