import axios from 'axios'
import * as XLSX from 'xlsx'

async function testNoFramesData() {
  const url = 'https://no-frames.ru/design/themes/abt__unitheme2/media/files/NALICHIE_NA_SKLADE_NOFRAMES.XLS?v=' + Date.now().toString()
  
  console.log('='.repeat(80))
  console.log('ТЕСТ ДАННЫХ NOFRAMES')
  console.log('='.repeat(80))
  
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
  })
  
  const buffer = Buffer.from(response.data)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  
  const targetSheets = ['ОСНОВНЫЕ КОЛЛЕКЦИИ', 'РАСПРОДАЖА']
  
  for (const sheetName of targetSheets) {
    const worksheet = workbook.Sheets[sheetName]
    if (!worksheet) {
      console.log(`\nВкладка "${sheetName}" не найдена`)
      continue
    }
    
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '',
      raw: false 
    }) as any[][]
    
    console.log(`\n${'='.repeat(80)}`)
    console.log(`ВКЛАДКА: "${sheetName}"`)
    console.log(`Всего строк: ${jsonData.length}`)
    console.log('='.repeat(80))
    
    // Показываем первые 30 строк полностью
    console.log(`\nПервые 30 строк (все колонки):`)
    for (let i = 0; i < Math.min(30, jsonData.length); i++) {
      const row = jsonData[i] || []
      const cols = []
      for (let j = 0; j < Math.min(10, row.length); j++) {
        const val = String(row[j] || '').trim()
        cols.push(`${String.fromCharCode(65 + j)}: "${val.substring(0, 40)}"`)
      }
      if (cols.length > 0) {
        console.log(`Строка ${i + 1}: ${cols.join(' | ')}`)
      }
    }
    
    // Ищем строки с данными (не пустые, не служебные)
    console.log(`\nПоиск строк с данными о тканях:`)
    let dataRowsFound = 0
    for (let i = 0; i < jsonData.length && dataRowsFound < 20; i++) {
      const row = jsonData[i] || []
      
      // Проверяем все колонки на наличие текста, похожего на название ткани
      let foundData = false
      let dataCol = -1
      let dataText = ''
      
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] || '').trim()
        // Ищем текст, который содержит буквы и цифры (название коллекции)
        if (val.length > 3 && /[A-Za-zА-Яа-яЁё]/.test(val) && /\d/.test(val)) {
          // Пропускаем служебные строки
          if (!val.includes('Информация') && 
              !val.includes('NOFRAMES') && 
              !val.includes('Дата актуальности') &&
              !val.includes('будние дни') &&
              !val.includes('выходные дни')) {
            foundData = true
            dataCol = j
            dataText = val
            break
          }
        }
      }
      
      if (foundData) {
        dataRowsFound++
        const colA = String(row[0] || '').trim()
        const colB = String(row[1] || '').trim()
        const colC = String(row[2] || '').trim()
        const colD = String(row[3] || '').trim()
        const colE = String(row[4] || '').trim()
        
        console.log(`\nСтрока ${i + 1}:`)
        console.log(`  A: "${colA}"`)
        console.log(`  B: "${colB}"`)
        console.log(`  C: "${colC}"`)
        console.log(`  D: "${colD}"`)
        console.log(`  E: "${colE}"`)
        console.log(`  → Данные найдены в колонке ${String.fromCharCode(65 + dataCol)}: "${dataText}"`)
        
        // Пробуем распарсить
        let testText = dataText
        testText = testText.replace(/мебельная\s+ткань\s*/gi, '').trim()
        testText = testText.replace(/ткань\s+мебельная\s*/gi, '').trim()
        testText = testText.replace(/["'"]/g, '').trim()
        
        const match = testText.match(/^([A-Za-zА-Яа-яЁё\s]+?)\s*(\d+.*)$/)
        if (match) {
          console.log(`  → Коллекция: "${match[1].trim()}"`)
          console.log(`  → Цвет: "${match[2].trim()}"`)
        } else {
          console.log(`  → Не распознано, весь текст: "${testText}"`)
        }
      }
    }
    
    console.log(`\nНайдено строк с данными: ${dataRowsFound}`)
  }
  
  console.log('\n' + '='.repeat(80))
  console.log('ТЕСТ ЗАВЕРШЕН')
  console.log('='.repeat(80))
}

testNoFramesData().catch(console.error)

