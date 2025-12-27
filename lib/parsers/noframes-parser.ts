import axios from 'axios'
import * as XLSX from 'xlsx'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class NoFramesParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    // Добавляем timestamp к URL
    const urlWithTimestamp = url.replace('{timestamp}', Date.now().toString())
    console.log(`[NoFrames] Загрузка файла: ${urlWithTimestamp}`)
    
    let response
    try {
      response = await axios.get(urlWithTimestamp, { 
        responseType: 'arraybuffer',
        timeout: 30000,
      })
    } catch (error: any) {
      console.error(`[NoFrames] Ошибка загрузки файла:`, error.message)
      throw new Error(`Не удалось загрузить файл: ${error.message}`)
    }
    
    // Используем xlsx для поддержки старых .xls файлов
    let workbook: XLSX.WorkBook
    try {
      const buffer = Buffer.from(response.data)
      workbook = XLSX.read(buffer, { type: 'buffer' })
      console.log(`[NoFrames] Файл загружен через xlsx. Всего вкладок: ${workbook.SheetNames.length}`)
      workbook.SheetNames.forEach((name, idx) => {
        const sheet = workbook.Sheets[name]
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
        const rowCount = range.e.r + 1
        console.log(`[NoFrames]   Вкладка ${idx + 1}: "${name}" (${name.length} символов, ~${rowCount} строк)`)
      })
    } catch (error: any) {
      console.error(`[NoFrames] Ошибка загрузки Excel файла:`, error.message)
      throw new Error(`Не удалось загрузить Excel файл: ${error.message}`)
    }
    
    const fabrics: ParsedFabric[] = []

    // Парсим вкладки "ОСНОВНЫЕ КОЛЛЕКЦИИ" и "РАСПРОДАЖА"
    const targetSheets: string[] = []
    
    // Ищем целевые вкладки
    workbook.SheetNames.forEach(sheetName => {
      const wsName = sheetName.trim().toUpperCase()
      
      // Ищем "ОСНОВНЫЕ КОЛЛЕКЦИИ"
      if (wsName === 'ОСНОВНЫЕ КОЛЛЕКЦИИ' || 
          (wsName.includes('ОСНОВНЫЕ') && wsName.includes('КОЛЛЕКЦИИ'))) {
        if (!targetSheets.includes(sheetName)) {
          targetSheets.push(sheetName)
          console.log(`[NoFrames] Найдена вкладка "ОСНОВНЫЕ КОЛЛЕКЦИИ": "${sheetName}"`)
        }
      }
      
      // Ищем "РАСПРОДАЖА"
      if (wsName === 'РАСПРОДАЖА' || wsName.includes('РАСПРОДАЖА')) {
        if (!targetSheets.includes(sheetName)) {
          targetSheets.push(sheetName)
          console.log(`[NoFrames] Найдена вкладка "РАСПРОДАЖА": "${sheetName}"`)
        }
      }
    })
    
    // Если не нашли целевые вкладки, выводим предупреждение
    if (targetSheets.length === 0) {
      console.error(`[NoFrames] ОШИБКА: Не найдены целевые вкладки "ОСНОВНЫЕ КОЛЛЕКЦИИ" и "РАСПРОДАЖА"`)
      console.error(`[NoFrames] Доступные вкладки: ${workbook.SheetNames.map(name => `"${name}"`).join(', ')}`)
      throw new Error(`Не найдены целевые вкладки "ОСНОВНЫЕ КОЛЛЕКЦИИ" и "РАСПРОДАЖА". Доступные вкладки: ${workbook.SheetNames.join(', ')}`)
    }
    
    console.log(`[NoFrames] Найдено вкладок для парсинга: ${targetSheets.length} (${targetSheets.join(', ')})`)
    
    for (const sheetName of targetSheets) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) {
        console.log(`[NoFrames] Вкладка "${sheetName}" не найдена`)
        continue
      }
      
      // Конвертируем в JSON для удобной обработки
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1, 
        defval: '',
        raw: false 
      }) as any[][]
      
      console.log(`[NoFrames] Парсинг вкладки "${sheetName}" (${jsonData.length} строк)`)

      const isSale = sheetName.trim().toUpperCase().includes('РАСПРОДАЖА')

      // Excel использует 1-based номера колонок, но мы храним 0-based индексы
      const collectionCol = rules.columnMappings.collection ?? 1 // B = индекс 1 (исправлено: было 0)
      const inStockCol = rules.columnMappings.inStock ?? 3 // D = индекс 3
      const arrivalCol = rules.columnMappings.nextArrivalDate ?? 4 // E = индекс 4

      let rowCount = 0
      let skippedByRules = 0
      let skippedByPatterns = 0
      let skippedEmpty = 0
      let skippedNoCollection = 0
      let processed = 0
      
      console.log(`[NoFrames] Правила парсинга:`, {
        collectionCol,
        inStockCol,
        arrivalCol,
        skipRows: rules.skipRows,
        skipPatterns: rules.skipPatterns,
      })
      
      // Показываем первые несколько строк для отладки
      console.log(`[NoFrames] Первые 10 строк данных:`)
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] || []
        console.log(`[NoFrames]   Строка ${i + 1}:`, {
          A: row[0] || '(пусто)',
          B: row[1] || '(пусто)',
          C: row[2] || '(пусто)',
          D: row[3] || '(пусто)',
          E: row[4] || '(пусто)',
        })
      }
      
      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const rowNumber = rowIndex + 1 // 1-based для правил
        
        try {
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
          
          // Читаем значения из массива (0-based индексы)
          if (row[collectionCol] !== undefined && row[collectionCol] !== null) {
            collectionColor = String(row[collectionCol]).trim()
          }
          if (row[inStockCol] !== undefined && row[inStockCol] !== null) {
            inStockText = String(row[inStockCol]).trim()
          }
          if (row[arrivalCol] !== undefined && row[arrivalCol] !== null) {
            arrivalText = String(row[arrivalCol]).trim()
          }

          // Пропускаем заголовки и технические строки
          if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
            skippedByPatterns++
            continue
          }

          if (!collectionColor) {
            skippedNoCollection++
            continue
          }

          // Пропускаем строки, которые являются только названием коллекции (без номера цвета)
          // Это строки типа "AKCENT", "AURORA" и т.д.
          // Если в тексте нет цифр, это скорее всего название коллекции, а не ткань
          if (!/\d/.test(collectionColor)) {
            skippedNoCollection++
            continue
          }

          // Применяем специальные правила (убираем "ткань мебельная" и кавычки)
          const specialRules = {
            ...rules.specialRules,
            removeFurnitureText: true,
            removeQuotes: true,
          }
          const { collection, color } = this.parseCollectionAndColor(collectionColor, specialRules)

          // Детальное логирование для первых нескольких обработанных строк
          if (processed < 5) {
            console.log(`[NoFrames] Обработка строки ${rowNumber}:`, {
              collectionColor,
              collection,
              color,
              inStockText,
              arrivalText,
            })
          }

          const fabric: ParsedFabric = {
            collection,
            colorNumber: color,
            inStock: this.parseBoolean(inStockText),
            meterage: null,
            price: null,
            nextArrivalDate: this.parseDate(arrivalText),
            comment: isSale ? 'Распродажа' : null,
          }

          if (fabric.collection || fabric.colorNumber) {
            fabrics.push(fabric)
            rowCount++
          } else {
            if (processed < 5) {
              console.log(`[NoFrames] Строка ${rowNumber} пропущена: нет коллекции и цвета`, {
                original: collectionColor,
                parsed: { collection, color },
              })
            }
          }
          processed++
        } catch (rowError: any) {
          console.error(`[NoFrames] Ошибка обработки строки ${rowNumber}:`, rowError.message)
          // Продолжаем обработку следующих строк
        }
      }
      
      console.log(`[NoFrames] Статистика обработки вкладки "${sheetName}":`)
      console.log(`[NoFrames]   Всего строк: ${jsonData.length}`)
      console.log(`[NoFrames]   Пропущено по правилам skipRows: ${skippedByRules}`)
      console.log(`[NoFrames]   Пропущено по skipPatterns: ${skippedByPatterns}`)
      console.log(`[NoFrames]   Пропущено пустых строк: ${skippedEmpty}`)
      console.log(`[NoFrames]   Пропущено без коллекции: ${skippedNoCollection}`)
      console.log(`[NoFrames]   Обработано строк: ${processed}`)
      console.log(`[NoFrames]   Добавлено тканей: ${rowCount}`)
    }

    // Сохраняем структуру для сравнения
    if (workbook.SheetNames.length > 0) {
      const firstSheetName = workbook.SheetNames[0]
      const firstSheet = workbook.Sheets[firstSheetName]
      if (firstSheet && firstSheet['!ref']) {
        const range = XLSX.utils.decode_range(firstSheet['!ref'])
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][]
        const firstRow = jsonData[0] || []
        
        const structure = {
          rowCount: range.e.r + 1,
          columnCount: range.e.c + 1,
          firstRow: firstRow,
          sheetNames: workbook.SheetNames,
        }
        
        const structureChanged = !(await this.compareStructure(structure))
        if (structureChanged) {
          await this.saveDataStructure(structure)
        } else {
          await this.saveDataStructure(structure)
        }
      }
    }

    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    // Добавляем timestamp к URL
    const urlWithTimestamp = url.replace('{timestamp}', Date.now().toString())
    console.log(`[NoFrames] Анализ: загрузка файла ${urlWithTimestamp}`)
    
    let response
    try {
      response = await axios.get(urlWithTimestamp, { 
        responseType: 'arraybuffer',
        timeout: 30000,
      })
    } catch (error: any) {
      console.error(`[NoFrames] Ошибка загрузки файла для анализа:`, error.message)
      throw new Error(`Не удалось загрузить файл: ${error.message}`)
    }
    
    // Используем xlsx для поддержки старых .xls файлов
    let workbook: XLSX.WorkBook
    try {
      const buffer = Buffer.from(response.data)
      workbook = XLSX.read(buffer, { type: 'buffer' })
      console.log(`[NoFrames] Файл загружен. Доступные вкладки: ${workbook.SheetNames.join(', ')}`)
    } catch (error: any) {
      console.error(`[NoFrames] Ошибка загрузки Excel файла:`, error.message)
      throw new Error(`Не удалось загрузить Excel файл: ${error.message}`)
    }
    
    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    // Используем первую доступную вкладку для анализа
    let worksheetName = workbook.SheetNames.find(name => {
      const n = name.trim().toUpperCase()
      return n.includes('ОСНОВНЫЕ') && n.includes('КОЛЛЕКЦИИ')
    })
    
    if (!worksheetName) {
      worksheetName = workbook.SheetNames.find(name => {
        const n = name.trim().toUpperCase()
        return n.includes('РАСПРОДАЖА')
      })
    }
    
    if (!worksheetName) {
      worksheetName = workbook.SheetNames[0]
    }

    if (!worksheetName) {
      throw new Error('Не найдено ни одной вкладки в файле')
    }
    
    const worksheet = workbook.Sheets[worksheetName]
    console.log(`[NoFrames] Используется вкладка "${worksheetName}" для анализа`)

    // Конвертируем в JSON для анализа
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '',
      raw: false 
    }) as any[][]
    
    // Собираем первые 15 строк для анализа
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = jsonData[i] || []
      const rowData = row.map(cell => String(cell || ''))
      if (rowData.length > 0) {
        sampleData.push(rowData)
      }
    }

    const maxColumns = Math.max(...sampleData.map(row => row.length))

    // Определяем заголовки
    const firstRow = sampleData[0] || []
    const hasHeaders = firstRow.some(cell => 
      ['коллекция', 'цвет', 'наличие', 'дата'].some(keyword => 
        String(cell).toLowerCase().includes(keyword)
      )
    )

    if (hasHeaders) {
      questions.push({
        id: 'header-row',
        question: 'Это строка заголовков?',
        type: 'header',
        options: ['Да', 'Нет'],
        default: 'Да',
      })
    }

    // Вопросы о колонках
    questions.push({
      id: 'collection-column',
      question: 'В какой колонке находится коллекция и цвет? (A = 1, B = 2, и т.д.)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 1 (A)',
    })

    questions.push({
      id: 'stock-column',
      question: 'В какой колонке находится наличие?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 4 (D)',
    })

    questions.push({
      id: 'arrival-column',
      question: 'В какой колонке находится дата следующего поступления?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 5 (E)',
    })

    // Вопросы о строках для пропуска
    if (sampleData.length > 1) {
      questions.push({
        id: 'skip-rows',
        question: 'Какие строки нужно пропустить? (например, заголовки, подзаголовки)',
        type: 'row',
        options: sampleData.map((_, i) => `Строка ${i + 1}`),
      })
    }

    return {
      questions,
      sampleData,
      structure: {
        columns: maxColumns,
        rows: sampleData.length,
        headers: hasHeaders ? firstRow.map(String) : undefined,
      },
    }
  }
}

