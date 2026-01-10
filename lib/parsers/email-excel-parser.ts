import * as XLSX from 'xlsx'
import * as fs from 'fs'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class EmailExcelParser extends BaseParser {
  /**
   * Проверяет, что Excel файл валиден и содержит нужные данные
   * @param filePath Путь к файлу
   * @returns true если файл валиден и содержит данные
   */
  async validateFile(filePath: string): Promise<boolean> {
    try {
      console.log(`[EmailExcelParser] Валидация файла: ${filePath}`)

      if (!fs.existsSync(filePath)) {
        console.log(`[EmailExcelParser] Файл не существует: ${filePath}`)
        return false
      }

      // Проверяем размер файла (должен быть больше 0)
      const stats = fs.statSync(filePath)
      if (stats.size === 0) {
        console.log(`[EmailExcelParser] Файл пустой: ${filePath}`)
        return false
      }

      // Пытаемся загрузить Excel файл
      let workbook: XLSX.WorkBook
      try {
        const buffer = fs.readFileSync(filePath)
        workbook = XLSX.read(buffer, { type: 'buffer' })
      } catch (error: any) {
        console.log(`[EmailExcelParser] Не удалось загрузить Excel файл: ${error.message}`)
        return false
      }

      // Проверяем, что есть хотя бы одна вкладка
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.log(`[EmailExcelParser] Файл не содержит вкладок`)
        return false
      }

      // Проверяем, что хотя бы одна вкладка содержит данные
      let hasData = false
      let totalRows = 0
      let dataRows = 0
      
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) continue

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: '',
          raw: false,
        }) as any[][]

        totalRows += jsonData.length
        
        // Проверяем, что есть хотя бы несколько строк
        if (jsonData.length >= 1) {
          // Проверяем, что есть хотя бы одна строка с непустыми данными
          // Для файлов Нортекса могут быть пустые строки в начале, поэтому проверяем все строки
          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i]
            if (row && Array.isArray(row)) {
              // Считаем количество непустых ячеек в строке
              const nonEmptyCells = row.filter((cell) => {
                const cellStr = String(cell || '').trim()
                return cellStr.length > 0 && 
                       !cellStr.toLowerCase().includes('отчет создан') &&
                       !cellStr.toLowerCase().includes('ед.изм.') &&
                       cellStr !== 'пог. м'
              })
              
              // Если в строке есть хотя бы 2 непустые ячейки, считаем её данными
              if (nonEmptyCells.length >= 2) {
                dataRows++
                hasData = true
              }
            }
          }
        }

        if (hasData) break
      }

      console.log(`[EmailExcelParser] Validation: total rows=${totalRows}, data rows=${dataRows}, hasData=${hasData}`)

      if (!hasData) {
        console.log(`[EmailExcelParser] Файл не содержит данных (только заголовки или пустые строки)`)
        return false
      }

      console.log(`[EmailExcelParser] Файл валиден и содержит данные`)
      return true
    } catch (error: any) {
      console.error(`[EmailExcelParser] Ошибка при валидации файла:`, error.message)
      return false
    }
  }

  async parse(filePath: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    console.log(`[EmailExcelParser] Парсинг файла: ${filePath}`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не найден: ${filePath}`)
    }

    // Загружаем Excel файл
    let workbook: XLSX.WorkBook
    try {
      const buffer = fs.readFileSync(filePath)
      workbook = XLSX.read(buffer, { type: 'buffer' })
      console.log(`[EmailExcelParser] Файл загружен. Вкладок: ${workbook.SheetNames.length}`)
      workbook.SheetNames.forEach((name, idx) => {
        const sheet = workbook.Sheets[name]
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1')
        const rowCount = range.e.r + 1
        console.log(`[EmailExcelParser]   Вкладка ${idx + 1}: "${name}" (~${rowCount} строк)`)
      })
    } catch (error: any) {
      console.error(`[EmailExcelParser] Ошибка загрузки Excel файла:`, error.message)
      throw new Error(`Не удалось загрузить Excel файл: ${error.message}`)
    }

    const fabrics: ParsedFabric[] = []

    // Используем первую вкладку или все вкладки в зависимости от правил
    const targetSheets = workbook.SheetNames.length > 0 ? [workbook.SheetNames[0]] : []

    // Если в правилах указаны конкретные вкладки, используем их
    if (rules.specialRules?.sheetNames && Array.isArray(rules.specialRules.sheetNames)) {
      const specifiedSheets = rules.specialRules.sheetNames as string[]
      const foundSheets = workbook.SheetNames.filter((name) =>
        specifiedSheets.some((spec) => name.includes(spec) || spec.includes(name))
      )
      if (foundSheets.length > 0) {
        targetSheets.length = 0
        targetSheets.push(...foundSheets)
      }
    }

    console.log(`[EmailExcelParser] Парсинг вкладок: ${targetSheets.join(', ')}`)

    for (const sheetName of targetSheets) {
      const worksheet = workbook.Sheets[sheetName]
      if (!worksheet) {
        console.log(`[EmailExcelParser] Вкладка "${sheetName}" не найдена`)
        continue
      }

      // Конвертируем в JSON для удобной обработки
      // Используем raw: true для получения точных значений ячеек (включая строки с запятыми)
      // Это позволяет корректно обрабатывать числа с запятыми как десятичными разделителями
      const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        defval: '',
        raw: true,
      }) as any[][]

      console.log(`[EmailExcelParser] Парсинг вкладки "${sheetName}" (${jsonData.length} строк)`)

      // Excel использует 1-based номера колонок, но мы храним 0-based индексы
      const collectionCol = rules.columnMappings.collection ?? 0
      const inStockCol = rules.columnMappings.inStock
      const meterageCol = rules.columnMappings.meterage
      const priceCol = rules.columnMappings.price
      const arrivalCol = rules.columnMappings.nextArrivalDate
      const commentCol = rules.columnMappings.comment

      // Для Нортекса: находим столбец с "пог.м" в заголовках и берем следующий столбец (F)
      let nortexStockColIndex: number | null = null
      if (rules.specialRules?.nortexPattern) {
        // Ищем столбец с "пог.м" в первых 10 строках (заголовки)
        for (let headerRowIndex = 0; headerRowIndex < Math.min(10, jsonData.length); headerRowIndex++) {
          const headerRow = jsonData[headerRowIndex]
          if (!headerRow) continue
          
          for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
            const cellValue = String(headerRow[colIndex] || '').trim().toLowerCase()
            if (cellValue.includes('пог.м') || cellValue.includes('пог м')) {
              // Найден столбец с "пог.м", берем следующий столбец (F)
              nortexStockColIndex = colIndex + 1
              console.log(`[EmailExcelParser] Нортекс: найден столбец "пог.м" в индексе ${colIndex}, столбец наличия (F) = индекс ${nortexStockColIndex}`)
              break
            }
          }
          if (nortexStockColIndex !== null) break
        }
        
        // Если не нашли, используем индекс 5 (F) по умолчанию
        if (nortexStockColIndex === null) {
          nortexStockColIndex = 5
          console.log(`[EmailExcelParser] Нортекс: столбец "пог.м" не найден, используем индекс 5 (F) по умолчанию`)
        }
      }

      let rowCount = 0
      for (let rowIndex = 0; rowIndex < jsonData.length; rowIndex++) {
        const rowNumber = rowIndex + 1 // 1-based для правил

        try {
          // Пропускаем строки согласно правилам
          if (rules.skipRows?.includes(rowNumber)) {
            continue
          }

          const row = jsonData[rowIndex]
          if (!row || row.length === 0) continue

          let collectionColor = ''
          let inStockText = ''
          let meterageText = ''
          let priceText = ''
          let arrivalText = ''
          let commentText = ''

          // Читаем значения из массива (0-based индексы)
          if (row[collectionCol] !== undefined && row[collectionCol] !== null) {
            collectionColor = String(row[collectionCol]).trim()
          }
          if (inStockCol !== undefined && row[inStockCol] !== undefined && row[inStockCol] !== null) {
            inStockText = String(row[inStockCol]).trim()
          }
          if (meterageCol !== undefined && row[meterageCol] !== undefined && row[meterageCol] !== null) {
            meterageText = String(row[meterageCol]).trim()
          }
          if (priceCol !== undefined && row[priceCol] !== undefined && row[priceCol] !== null) {
            priceText = String(row[priceCol]).trim()
          }
          if (arrivalCol !== undefined && row[arrivalCol] !== undefined && row[arrivalCol] !== null) {
            arrivalText = String(row[arrivalCol]).trim()
          }
          if (commentCol !== undefined && row[commentCol] !== undefined && row[commentCol] !== null) {
            commentText = String(row[commentCol]).trim()
          }

          // Применяем специальные правила (объявляем до использования)
          const specialRules = rules.specialRules || {}
          
          // Пропускаем заголовки и технические строки
          if (rules.skipPatterns?.some((pattern) => collectionColor.includes(pattern))) {
            continue
          }

          // Для Нортекса пропускаем строки, которые не содержат "Ткань" в столбце коллекции
          if (specialRules.nortexPattern && collectionColor && !collectionColor.toLowerCase().includes('ткань')) {
            continue
          }

          if (!collectionColor) continue

          const { collection, color } = this.parseCollectionAndColor(collectionColor, specialRules)

          // Специальная обработка для Нортекса
          let finalInStock: boolean | null = null
          let finalMeterage: number | null = null
          let finalArrivalDate: Date | null = null
          let finalComment: string | null = null

          if (specialRules.nortexPattern) {
            // Нортекс: столбец F - это столбец, который следует за столбцом где написано "пог.м"
            // Если в столбце F стоит значение отличное от "V", то пишем "Нет в наличии"
            
            // Используем найденный индекс столбца F (или индекс 5 по умолчанию)
            const stockColIndex = nortexStockColIndex ?? 5
            
            // Получаем значение из столбца F
            let fValue = ''
            if (row[stockColIndex] !== undefined && row[stockColIndex] !== null) {
              fValue = String(row[stockColIndex]).trim()
            } else {
              // Пробуем получить из ячейки напрямую
              const colLetter = String.fromCharCode(65 + stockColIndex)
              const cell = worksheet[`${colLetter}${rowNumber}`]
              if (cell) {
                fValue = (cell.w !== undefined && typeof cell.w === 'string') 
                  ? cell.w.trim() 
                  : String(cell.v || '').trim()
              }
            }
            
            // Проверяем значение в столбце F
            if (fValue === 'V' || fValue === 'v') {
              // "V" = в наличии
              finalInStock = true
            } else if (fValue) {
              // Любое другое значение (не пустое) = нет в наличии
              finalInStock = false
              // Сохраняем значение в комментарий, если это не просто пустое
              if (fValue && fValue.length > 0) {
                finalComment = fValue
              }
            } else {
              // Пустое значение = нет в наличии
              finalInStock = false
            }
            
            // Логирование для отладки
            if (rowCount < 5) {
              console.log(`[EmailExcelParser] Нортекс строка ${rowNumber}: столбец F (индекс ${stockColIndex}) = "${fValue}", inStock = ${finalInStock}`)
            }
          } else {
            // Стандартная обработка для других поставщиков
            finalInStock = inStockText ? this.parseBoolean(inStockText) : null
            finalMeterage = meterageText ? this.parseMeterage(meterageText) : null
            finalArrivalDate = arrivalText ? this.parseDate(arrivalText) : null
            finalComment = commentText || null
          }

          const fabric: ParsedFabric = {
            collection,
            colorNumber: color,
            inStock: finalInStock,
            meterage: finalMeterage,
            price: priceText ? this.parsePrice(priceText) : null,
            nextArrivalDate: finalArrivalDate,
            comment: finalComment,
          }

          if (fabric.collection || fabric.colorNumber) {
            fabrics.push(fabric)
            rowCount++
          }
        } catch (rowError: any) {
          console.error(`[EmailExcelParser] Ошибка обработки строки ${rowNumber}:`, rowError.message)
          // Продолжаем обработку следующих строк
        }
      }

      console.log(`[EmailExcelParser] Обработано ${rowCount} тканей из вкладки "${sheetName}"`)
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

  async analyze(filePath: string): Promise<ParsingAnalysis> {
    console.log(`[EmailExcelParser] Анализ файла: ${filePath}`)

    if (!fs.existsSync(filePath)) {
      throw new Error(`Файл не найден: ${filePath}`)
    }

    // Используем xlsx для поддержки старых .xls файлов
    let workbook: XLSX.WorkBook
    try {
      const buffer = fs.readFileSync(filePath)
      workbook = XLSX.read(buffer, { type: 'buffer' })
      console.log(`[EmailExcelParser] Файл загружен. Доступные вкладки: ${workbook.SheetNames.join(', ')}`)
    } catch (error: any) {
      console.error(`[EmailExcelParser] Ошибка загрузки Excel файла:`, error.message)
      throw new Error(`Не удалось загрузить Excel файл: ${error.message}`)
    }

    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    // Используем первую доступную вкладку для анализа
    const worksheetName = workbook.SheetNames[0]

    if (!worksheetName) {
      throw new Error('Не найдено ни одной вкладки в файле')
    }

    const worksheet = workbook.Sheets[worksheetName]
    console.log(`[EmailExcelParser] Используется вкладка "${worksheetName}" для анализа`)

    // Конвертируем в JSON для анализа
    // Используем raw: true для консистентности с методом parse
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      raw: true,
    }) as any[][]

    // Собираем первые 15 строк для анализа
    for (let i = 0; i < Math.min(15, jsonData.length); i++) {
      const row = jsonData[i] || []
      const rowData = row.map((cell) => String(cell || ''))
      if (rowData.length > 0) {
        sampleData.push(rowData)
      }
    }

    const maxColumns = Math.max(...sampleData.map((row) => row.length))

    // Определяем заголовки
    const firstRow = sampleData[0] || []
    const hasHeaders = firstRow.some((cell) =>
      ['коллекция', 'цвет', 'наличие', 'дата', 'метраж', 'цена'].some((keyword) =>
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
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 1 (A)',
    })

    if (maxColumns > 1) {
      questions.push({
        id: 'stock-column',
        question: 'В какой колонке находится наличие? (оставьте пустым, если нет)',
        type: 'column',
        options: ['Нет колонки', ...Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`)],
        default: 'Нет колонки',
      })
    }

    if (maxColumns > 2) {
      questions.push({
        id: 'meterage-column',
        question: 'В какой колонке находится метраж? (оставьте пустым, если нет)',
        type: 'column',
        options: ['Нет колонки', ...Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`)],
        default: 'Нет колонки',
      })
    }

    if (maxColumns > 3) {
      questions.push({
        id: 'price-column',
        question: 'В какой колонке находится цена? (оставьте пустым, если нет)',
        type: 'column',
        options: ['Нет колонки', ...Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`)],
        default: 'Нет колонки',
      })
    }

    if (maxColumns > 4) {
      questions.push({
        id: 'arrival-column',
        question: 'В какой колонке находится дата следующего поступления? (оставьте пустым, если нет)',
        type: 'column',
        options: ['Нет колонки', ...Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`)],
        default: 'Нет колонки',
      })
    }

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

  protected parseMeterage(text: string): number | null {
    if (!text) return null
    const str = String(text).trim()
    if (!str || str === '-' || str.toLowerCase() === 'нет') return null

    // Улучшенный парсинг метража по примеру AmetistParser
    // Убираем знаки > и < для извлечения числа
    const cleanedStr = str.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()
    
    // КРИТИЧНО: Сначала ищем число с десятичной частью (85,6 или 85.6)
    // Это важно для правильного парсинга значений типа "85,6" из Excel
    const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
    if (decimalMatch) {
      const wholePart = decimalMatch[1]
      const decimalPart = decimalMatch[2]
      const extractedStr = `${wholePart}.${decimalPart}`
      return parseFloat(extractedStr)
    }
    
    // Если нет десятичной части, пробуем распарсить всю строку как число
    // Убираем пробелы, заменяем запятую на точку
    let normalizedStr = cleanedStr.replace(/\s+/g, '').replace(/,/g, '.')
    const numValue = parseFloat(normalizedStr)
    
    // Если не удалось, ищем первое целое число в строке
    if (isNaN(numValue) || numValue === 0) {
      const integerMatch = cleanedStr.match(/(\d+)/)
      if (integerMatch) {
        return parseFloat(integerMatch[1])
      }
      return null
    }
    
    return numValue
  }

  protected parsePrice(text: string): number | null {
    if (!text) return null
    const str = String(text).trim()
    if (!str || str === '-' || str.toLowerCase() === 'нет') return null

    // Извлекаем число из текста (может быть "1000 ₽", "1000руб", "1000" и т.д.)
    const match = str.match(/(\d+[\.,]?\d*)/)
    if (match) {
      return parseFloat(match[1].replace(',', '.'))
    }

    return null
  }
}

