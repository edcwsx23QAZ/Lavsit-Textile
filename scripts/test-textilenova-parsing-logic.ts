import { TextileNovaParser } from '../lib/parsers/textilenova-parser'
import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'

const prisma = new PrismaClient()

// Тестовые данные на основе реальных данных из Google Sheets
const testData = [
  ['больше 300 м', 'Остатки на 29.01.2026', ''], // Заголовок - пропускаем
  ['Helena', '', ''], // Название коллекции - пропускаем (нет данных в B)
  ['Helena 01', '+', ''], // В наличии
  ['Helena 03', '+', ''], // В наличии
  ['Helena 04', '+', ''], // В наличии
  ['Helena 05', '+', ''], // В наличии
  ['Helena 06', '+', ''], // В наличии
  ['Helena 07', '+', ''], // В наличии
  ['Helena 10', '+', ''], // В наличии
  ['Helena 15', '+', ''], // В наличии
  ['Helena 16', '+', ''], // В наличии
  ['Helena 18', '+', ''], // В наличии
  ['Helena 19', '+', ''], // В наличии
  ['Helena 20', '+', ''], // В наличии
  ['Helena 21', '+', ''], // В наличии
  ['Helena 22', '+', ''], // В наличии
  ['Helena 23', '+', ''], // В наличии
  ['Helena 24', '+', ''], // В наличии
  ['Helena 28', '+', ''], // В наличии
  ['Helena 32', '+', ''], // В наличии
  ['Helena 33', '+', ''], // В наличии
  ['Helena 34', '+', ''], // В наличии
  ['Helena 37', '+', ''], // В наличии
  ['Fellini', '', ''], // Название коллекции - пропускаем
  ['Fellini 16', '+', ''], // В наличии
  ['Fellini 17', '+', ''], // В наличии
  ['Fellini 18', '+', ''], // В наличии
  ['Fellini 20', '+', ''], // В наличии
  ['Fellini 22', '+', ''], // В наличии
  ['Fellini 23', '+', ''], // В наличии
  ['Fellini 26', '+', ''], // В наличии
  ['Fellini 28', '+', ''], // В наличии
  ['Fellini 29', '+', ''], // В наличии
  ['Vintage Velvet', '', ''], // Название коллекции - пропускаем
  ['Vintage Velvet 01', '+', ''], // В наличии
  ['Vintage Velvet 02', '+', ''], // В наличии
  ['Vintage Velvet 03', '+', ''], // В наличии
  ['Vintage Velvet 29', '+', ''], // В наличии
  ['Vintage Velvet 14', '+', ''], // В наличии
  ['Vintage Velvet 23', '+', ''], // В наличии
  ['Vintage Velvet 13', '+', ''], // В наличии
  ['Vintage Velvet 12', '+', ''], // В наличии
  ['Vintage Velvet 36', '+', ''], // В наличии
  ['Vintage Velvet 15', '+', ''], // В наличии
  ['Vintage Velvet 16', '+', ''], // В наличии
  ['Mistral 21', 'НЕТ', '20/02/26'], // Нет в наличии, дата следующей поставки
  ['Mistral 22', 'Ограничено', ''], // В наличии, но мало
  ['Test Collection 01', '+', '15/03/26'], // В наличии, дата следующей поставки
]

async function testParsingLogic() {
  console.log('=== Тест логики парсинга TextileNova ===\n')

  // Получаем ID поставщика
  const supplier = await prisma.supplier.findUnique({
    where: { name: 'TextileNova' }
  })

  if (!supplier) {
    console.error('Поставщик TextileNova не найден в базе данных!')
    await prisma.$disconnect()
    return
  }

  const supplierId = supplier.id
  const parser = new TextileNovaParser(supplierId, 'TextileNova')

  try {
    // Загружаем правила (если есть)
    const rules = await parser.loadRules()
    if (!rules) {
      console.log('⚠️ Правила парсинга не найдены. Создаем базовые правила...')
      // Создаем базовые правила для теста
      const basicRules = {
        columnMappings: {
          collection: 0, // Столбец A
          inStock: 1, // Столбец B
          nextArrivalDate: 2, // Столбец C
        },
        specialRules: {
          textilenovaPattern: true,
        },
        skipRows: [],
        skipPatterns: ['больше', 'метров'],
      }
      await parser.saveRules(basicRules)
      console.log('✓ Базовые правила созданы\n')
    }

    // Симулируем парсинг данных
    console.log('Парсинг тестовых данных...\n')
    
    const rawFabrics: any[] = []
    let currentCollection = ''
    
    for (let i = 0; i < testData.length; i++) {
      const row = testData[i]
      if (row.length < 2) continue

      // Столбец A (индекс 0) - коллекция и цвет
      const collectionColor = row[0]?.toString().trim() || ''
      
      if (!collectionColor) continue

      // Пропускаем служебные строки
      if (collectionColor.toLowerCase().includes('больше') || 
          collectionColor.toLowerCase().includes('метров') ||
          collectionColor.toLowerCase().includes('м')) {
        continue
      }

      // Столбец B (индекс 1) - остатки
      const stockText = row[1]?.toString().trim() || ''
      
      // Если столбец B пуст, пропускаем строку
      if (!stockText) {
        // Если в столбце A только название коллекции (без цифр), сохраняем как текущую коллекцию
        if (!/\d/.test(collectionColor)) {
          currentCollection = collectionColor
        }
        continue
      }

      // Пропускаем служебные строки в столбце B
      if (stockText.toLowerCase().includes('больше') || 
          stockText.toLowerCase().includes('метров') ||
          (stockText.toLowerCase().includes('м') && !stockText.includes('+'))) {
        continue
      }

      // Парсим наличие
      let inStock: boolean | null = null
      let comment: string | null = null
      const stockLower = stockText.toLowerCase().trim()
      const stockUpper = stockText.toUpperCase().trim()

      if (stockText.includes('+')) {
        inStock = true
      } else if (stockLower.includes('ограничено') || stockLower.includes('ограниченно')) {
        inStock = true
        comment = 'ВНИМАНИЕ, МАЛО!'
      } else if (stockUpper === 'НЕТ' || stockLower === 'нет') {
        inStock = false
      } else {
        // Если не распознано, пропускаем строку
        continue
      }

      // Столбец C (индекс 2) - дата следующего поступления
      const arrivalValue = row[2]
      let nextArrivalDateStr: string | null = null

      if (arrivalValue !== undefined && arrivalValue !== null && arrivalValue !== '') {
        const str = String(arrivalValue).trim()
        if (str && str !== '-' && str.toLowerCase() !== 'нет') {
          nextArrivalDateStr = str
        }
      }

      // Формируем полное название: если collectionColor уже содержит название коллекции, используем его как есть
      // Иначе добавляем currentCollection только если collectionColor не является полным названием (не содержит пробел и цифру)
      let fullCollectionColor = collectionColor
      // Проверяем, является ли collectionColor полным названием (содержит пробел и цифру, например "Helena 07")
      const isFullName = /\s+\d/.test(collectionColor)
      if (currentCollection && !isFullName && !collectionColor.toLowerCase().startsWith(currentCollection.toLowerCase())) {
        fullCollectionColor = `${currentCollection} ${collectionColor}`.trim()
      }

      // Сохраняем данные для парсинга
      rawFabrics.push({
        collectionColor: fullCollectionColor,
        inStock,
        meterage: null,
        price: null,
        nextArrivalDateStr,
        comment,
      })
    }

    // Применяем парсинг коллекции и цвета
    const loadedRules = await parser.loadRules()
    const parsedFabrics = rawFabrics
      .map(fabric => {
        const { collection, color } = parser['parseCollectionAndColor'](fabric.collectionColor, loadedRules?.specialRules)
        
        // Парсим дату
        let nextArrivalDate: Date | null = null
        if (fabric.nextArrivalDateStr) {
          const dateMatch = fabric.nextArrivalDateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/)
          if (dateMatch) {
            const day = parseInt(dateMatch[1])
            const month = parseInt(dateMatch[2]) - 1
            let year = parseInt(dateMatch[3])
            
            if (year < 100) {
              const currentYear = new Date().getFullYear()
              if (year <= 30) {
                year = 2000 + year
              } else {
                year = 1900 + year
              }
              if (year > currentYear + 1) {
                year = year - 100
              }
            }
            
            if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
              const date = new Date(year, month, day)
              if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                nextArrivalDate = date
              }
            }
          }
        }
        
        return {
          collection,
          colorNumber: color,
          inStock: fabric.inStock,
          meterage: fabric.meterage,
          price: fabric.price,
          nextArrivalDate,
          comment: fabric.comment,
        }
      })
      .filter(fabric => fabric.collection || fabric.colorNumber)

    console.log(`✓ Найдено тканей: ${parsedFabrics.length}\n`)

    // Проверяем результаты
    console.log('Результаты парсинга:\n')
    parsedFabrics.forEach((fabric, idx) => {
      const status = fabric.inStock === true 
        ? `В наличии${fabric.comment ? ` (${fabric.comment})` : ''}` 
        : fabric.inStock === false 
        ? 'Нет в наличии' 
        : 'Неизвестно'
      const dateStr = fabric.nextArrivalDate 
        ? ` (приход: ${fabric.nextArrivalDate.toLocaleDateString('ru-RU')})` 
        : ''
      console.log(`  ${idx + 1}. ${fabric.collection} ${fabric.colorNumber} - ${status}${dateStr}`)
    })

    // Проверяем конкретные случаи
    console.log('\n=== Проверка конкретных случаев ===\n')
    
    const mistral21 = parsedFabrics.find(f => f.collection === 'Mistral' && f.colorNumber === '21')
    if (mistral21) {
      console.log(`✓ Mistral 21: ${mistral21.inStock === false ? 'Нет в наличии' : 'ОШИБКА!'}`)
      if (mistral21.nextArrivalDate) {
        console.log(`  Дата следующей поставки: ${mistral21.nextArrivalDate.toLocaleDateString('ru-RU')}`)
      }
    } else {
      console.log('❌ Mistral 21 не найден!')
    }

    const mistral22 = parsedFabrics.find(f => f.collection === 'Mistral' && f.colorNumber === '22')
    if (mistral22) {
      console.log(`✓ Mistral 22: ${mistral22.inStock === true ? 'В наличии' : 'ОШИБКА!'}`)
      console.log(`  Комментарий: ${mistral22.comment === 'ВНИМАНИЕ, МАЛО!' ? '✓ Правильно' : '❌ ОШИБКА!'}`)
    } else {
      console.log('❌ Mistral 22 не найден!')
    }

    const helena07 = parsedFabrics.find(f => f.collection === 'Helena' && f.colorNumber === '07')
    if (helena07) {
      console.log(`✓ Helena 07: ${helena07.inStock === true ? 'В наличии' : 'ОШИБКА!'}`)
    } else {
      console.log('❌ Helena 07 не найден!')
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testParsingLogic()
  .then(() => {
    console.log('\n=== Тест завершен ===')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })

