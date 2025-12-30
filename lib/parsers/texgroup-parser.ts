import axios from 'axios'
import * as XLSX from 'xlsx'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class TexGroupParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    const response = await axios.get(url, { responseType: 'arraybuffer' })
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

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1 // Excel использует 1-based нумерацию

      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        continue
      }

      // Колонка B (индекс 1) - коллекция и цвет
      const collectionCol = rules.columnMappings.collection ?? 1
      const collectionColor = row[collectionCol]?.toString().trim() || ''

      // Пропускаем пустые строки
      if (!collectionColor) continue

      // Пропускаем строки, которые не соответствуют паттерну (только цифры или только текст)
      // Нужна комбинация: текст + цифры
      const hasText = /[A-Za-zА-Яа-яЁё]/.test(collectionColor)
      const hasNumbers = /\d/.test(collectionColor)
      
      if (!hasText || !hasNumbers) {
        // Игнорируем строки, где только цифры или только текст
        continue
      }

      // Пропускаем строки по паттернам
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        continue
      }

      // Парсим коллекцию и цвет
      const { collection, color } = this.parseCollectionAndColor(collectionColor, rules.specialRules)

      if (!collection || !color) {
        continue
      }

      // Колонка D (индекс 3) - наличие
      const inStockCol = rules.columnMappings.inStock ?? 3
      const inStockValue = row[inStockCol]?.toString().trim() || ''

      let inStock: boolean | null = null
      let meterage: number | null = null
      let comment: string | null = null

      if (inStockValue) {
        const lowerValue = inStockValue.toLowerCase()
        
        if (lowerValue === 'есть') {
          inStock = true
          comment = 'мало'
        } else {
          // Пытаемся распарсить число
          const numberMatch = inStockValue.match(/(\d+(?:[.,]\d+)?)/)
          if (numberMatch) {
            const numValue = parseFloat(numberMatch[1].replace(',', '.'))
            if (!isNaN(numValue) && numValue > 0) {
              inStock = true
              meterage = numValue
            }
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
        comment,
      }

      fabrics.push(fabric)
    }

    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
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
      ['коллекция', 'цвет', 'наличие', 'дата', 'комментарий'].some(keyword => 
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
      question: 'В какой колонке находится название коллекции и цвета? (B = 2, C = 3, и т.д.)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 2 (B)',
    })

    questions.push({
      id: 'stock-column',
      question: 'В какой колонке находится наличие?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 4 (D)',
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



