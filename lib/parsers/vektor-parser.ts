import axios from 'axios'
import * as XLSX from 'xlsx'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class VektorParser extends BaseParser {
  /**
   * Форматирует дату в формат DDMMYY для URL Vektor
   */
  private formatDateForUrl(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}${month}${year}`
  }

  /**
   * Генерирует URL для Vektor с указанной датой
   */
  private generateUrlForDate(date: Date): string {
    const dateStr = this.formatDateForUrl(date)
    return `https://api.vektor.club/static/remainders_files/${dateStr}_MSK.xlsx`
  }

  /**
   * Находит актуальный URL файла, проверяя даты от текущей до 30 дней назад
   */
  private async findActualUrl(): Promise<string> {
    const today = new Date()
    const maxDaysBack = 30

    for (let daysBack = 0; daysBack <= maxDaysBack; daysBack++) {
      const checkDate = new Date(today)
      checkDate.setDate(today.getDate() - daysBack)
      
      const url = this.generateUrlForDate(checkDate)
      
      try {
        // Пытаемся сделать HEAD запрос для проверки существования файла
        const response = await axios.head(url, { timeout: 5000, validateStatus: (status) => status < 500 })
        if (response.status === 200) {
          console.log(`[VektorParser] Найден актуальный файл: ${url} (дата: ${checkDate.toLocaleDateString('ru-RU')})`)
          return url
        }
      } catch (error: any) {
        // Если файл не найден (404) или другая ошибка, пробуем следующую дату
        if (error.response?.status === 404) {
          continue
        }
        // Для сетевых ошибок или таймаутов пробуем следующую дату
        if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
          continue
        }
        // Для других ошибок тоже пробуем следующую дату
        continue
      }
    }

    // Если не нашли файл за последние 30 дней, выбрасываем ошибку
    throw new Error(`Не удалось найти актуальный файл Vektor за последние ${maxDaysBack} дней. Проверьте доступность файлов на сервере.`)
  }

  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    // Для Vektor находим актуальный URL с датой
    const actualUrl = await this.findActualUrl()
    
    const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    
    // Используем первую вкладку
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    const fabrics: ParsedFabric[] = []

    // Сохраняем структуру для сравнения
    const structure = {
      rowCount: data.length,
      columnCount: data.length > 0 ? Math.max(...data.map(row => row.length)) : 0,
      firstRow: data[0] || [],
    }
    
    const structureChanged = !(await this.compareStructure(structure))
    if (structureChanged) {
      await this.saveDataStructure(structure)
    } else {
      await this.saveDataStructure(structure)
    }

    // Пропускаем строки согласно правилам
    const startRow = rules.headerRow ? rules.headerRow + 1 : 1

    // Флаг для остановки парсинга после строки с "ФУРНИТУРА"
    let stopParsing = false

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1 // Excel использует 1-based нумерацию

      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        continue
      }

      // Если уже встретили "ФУРНИТУРА", прекращаем парсинг
      if (stopParsing) {
        break
      }

      // Колонка A (индекс 0) - коллекция и цвет
      const collectionCol = rules.columnMappings.collection ?? 0
      const collectionColor = row[collectionCol]?.toString().trim() || ''

      // Проверяем, не является ли это строкой "ФУРНИТУРА"
      if (collectionColor.toUpperCase().includes('ФУРНИТУРА')) {
        stopParsing = true
        continue
      }

      // Пропускаем пустые строки
      if (!collectionColor) continue

      // Пропускаем строки по паттернам (например, "Сетка", служебная информация)
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        continue
      }

      // Колонка E (индекс 4) - единица измерения, должна быть заполнена (пог.м или шт), иначе пропускаем строку
      const eCol = 4
      const eValue = row[eCol]?.toString().trim() || ''
      if (!eValue || (eValue !== 'пог.м' && eValue !== 'шт')) {
        continue
      }

      // Парсим коллекцию и цвет
      const { collection, color } = this.parseCollectionAndColor(collectionColor, rules.specialRules)

      if (!collection || !color) {
        continue
      }

      // Колонка F (индекс 5) - наличие/метраж
      const inStockCol = rules.columnMappings.inStock ?? 5
      const inStockValue = row[inStockCol]

      let meterage: number | null = null
      let inStock: boolean | null = null

      if (inStockValue !== undefined && inStockValue !== null && inStockValue !== '') {
        const inStockStr = String(inStockValue).trim().toLowerCase()
        
        // Проверяем "по запросу"
        if (inStockStr.includes('по запросу')) {
          inStock = false
        } else if (inStockStr.startsWith('>')) {
          // Обработка ">300" - в наличии, метраж 300+
          const numMatch = inStockStr.match(/>\s*(\d+(?:[.,]\d+)?)/)
          if (numMatch) {
            const numValue = parseFloat(numMatch[1].replace(',', '.'))
            if (!isNaN(numValue) && numValue > 0) {
              meterage = numValue
              inStock = true
            }
          } else {
            // Если не удалось распарсить, считаем что в наличии
            inStock = true
            meterage = 300 // Минимум для ">300"
          }
        } else {
          // Пытаемся распарсить число
          const numValue = parseFloat(String(inStockValue).replace(',', '.'))
          if (!isNaN(numValue) && numValue > 0) {
            meterage = numValue
            inStock = true // Если есть метраж, значит в наличии
          }
        }
      }

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock,
        meterage,
        price: null,
        nextArrivalDate: null,
        comment: null,
      }

      fabrics.push(fabric)
    }

    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    // Для Vektor находим актуальный URL с датой
    const actualUrl = await this.findActualUrl()
    
    const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    // Собираем первые 15 строк для анализа
    for (let i = 0; i < Math.min(15, data.length); i++) {
      sampleData.push(data[i] || [])
    }

    const maxColumns = Math.max(...sampleData.map(row => row.length), 0)

    // Определяем заголовки
    const firstRow = sampleData[0] || []
    const hasHeaders = firstRow.some((cell: any) => 
      ['коллекция', 'цвет', 'наличие', 'метраж', 'дата'].some(keyword => 
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
      question: 'В какой колонке находится название коллекции и цвета? (D = 4, E = 5, и т.д.)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 4 (D)',
    })

    questions.push({
      id: 'meterage-column',
      question: 'В какой колонке находится метраж?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 6 (F)',
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

