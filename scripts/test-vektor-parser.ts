import axios from 'axios'
import * as XLSX from 'xlsx'
import { VektorParser } from '../lib/parsers/vektor-parser'

async function testVektorParser() {
  console.log('=== Тестирование парсера Vektor ===\n')

  // Создаем парсер
  const supplierId = 'test-vektor'
  const supplierName = 'Vektor'
  const parser = new VektorParser(supplierId, supplierName)

  try {
    // Тестируем поиск актуального URL
    console.log('1. Поиск актуального URL...')
    const actualUrl = await (parser as any).findActualUrl()
    console.log(`   ✓ Найден URL: ${actualUrl}\n`)

    // Скачиваем файл
    console.log('2. Скачивание файла...')
    const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
    console.log(`   ✓ Файл скачан, размер: ${response.data.length} байт\n`)

    // Загружаем Excel
    console.log('3. Загрузка Excel...')
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    console.log(`   ✓ Excel загружен, вкладка: ${sheetName}`)
    console.log(`   ✓ Всего строк: ${data.length}\n`)

    // Анализируем первые 20 строк
    console.log('4. Анализ первых 20 строк:')
    console.log('   Колонки: A=0, B=1, C=2, D=3, E=4, F=5, G=6\n')
    
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i]
      const d = row[3]?.toString().trim() || ''
      const e = row[4]?.toString().trim() || ''
      const f = row[5]?.toString().trim() || ''
      
      console.log(`   Строка ${i + 1}:`)
      console.log(`     D (коллекция/цвет): "${d}"`)
      console.log(`     E (проверка): "${e}" ${e ? '✓' : '✗ ПУСТО - будет пропущено'}`)
      console.log(`     F (наличие): "${f}"`)
      
      // Проверяем парсинг коллекции и цвета
      if (d) {
        const { collection, color } = (parser as any).parseCollectionAndColor(d, { removeTkanPrefix: true, removeKozhZam: true })
        console.log(`     → Коллекция: "${collection}", Цвет: "${color}"`)
        
        if (!collection || !color) {
          console.log(`     ⚠️ ПРОБЛЕМА: Не удалось распарсить коллекцию или цвет!`)
        }
      }
      
      // Проверяем наличие
      if (f) {
        const fLower = f.toLowerCase()
        if (fLower.includes('по запросу')) {
          console.log(`     → Наличие: НЕТ (по запросу)`)
        } else {
          const num = parseFloat(f.replace(',', '.'))
          if (!isNaN(num) && num > 0) {
            console.log(`     → Наличие: ДА, Метраж: ${num}`)
          } else {
            console.log(`     → Наличие: не распознано`)
          }
        }
      }
      
      console.log('')
    }

    // Проверяем правила парсинга
    console.log('5. Проверка правил парсинга...')
    const rules = await parser.loadRules()
    if (rules) {
      console.log('   ✓ Правила найдены:')
      console.log(`     - Коллекция: колонка ${(rules.columnMappings.collection ?? 3) + 1} (индекс ${rules.columnMappings.collection ?? 3})`)
      console.log(`     - Наличие: колонка ${(rules.columnMappings.inStock ?? 5) + 1} (индекс ${rules.columnMappings.inStock ?? 5})`)
      console.log(`     - Пропуск строк: ${rules.skipRows?.join(', ') || 'нет'}`)
      console.log(`     - Паттерны пропуска: ${rules.skipPatterns?.join(', ') || 'нет'}`)
      console.log(`     - Специальные правила: ${JSON.stringify(rules.specialRules || {})}`)
    } else {
      console.log('   ✗ Правила не найдены! Нужно провести анализ.')
    }
    console.log('')

    // Пробуем парсить
    console.log('6. Тестовый парсинг...')
    try {
      const fabrics = await parser.parse(actualUrl)
      console.log(`   ✓ Найдено тканей: ${fabrics.length}\n`)
      
      if (fabrics.length > 0) {
        console.log('   Первые 5 тканей:')
        fabrics.slice(0, 5).forEach((fabric, idx) => {
          console.log(`   ${idx + 1}. ${fabric.collection} ${fabric.colorNumber} - ${fabric.inStock ? 'В наличии' : 'Нет'} ${fabric.meterage ? `(${fabric.meterage}м)` : ''}`)
        })
        console.log('')
      } else {
        console.log('   ⚠️ ПРОБЛЕМА: Не найдено ни одной ткани!')
        console.log('   Возможные причины:')
        console.log('   - Все строки пропущены из-за пустого столбца E')
        console.log('   - Не удается распарсить коллекцию/цвет')
        console.log('   - Слишком строгие фильтры')
        console.log('')
      }
    } catch (parseError: any) {
      console.error(`   ✗ Ошибка парсинга: ${parseError.message}`)
      console.error(`   Stack: ${parseError.stack}`)
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    console.error('Stack:', error.stack)
  }
}

testVektorParser()
  .then(() => {
    console.log('\n=== Тест завершен ===')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })


