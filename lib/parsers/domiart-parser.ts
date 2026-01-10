import axios from 'axios'
import ExcelJS from 'exceljs'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class DomiartParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    const response = await axios.get(url, { responseType: 'arraybuffer' })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(response.data)
    
    const worksheet = workbook.worksheets[0]
    const fabrics: ParsedFabric[] = []

    // Сохраняем структуру для сравнения
    const structure = {
      rowCount: worksheet.rowCount,
      columnCount: worksheet.columnCount,
      firstRow: worksheet.getRow(1).values as any[],
    }
    
    const structureChanged = !(await this.compareStructure(structure))
    if (structureChanged) {
      await this.saveDataStructure(structure)
      // Предупреждение будет показано на фронтенде
    } else {
      await this.saveDataStructure(structure)
    }

    // Специальное правило для Alfa 2303
    const specialRules = {
      alfa2303Pattern: true,
    }

    worksheet.eachRow((row, rowNumber) => {
      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        return
      }

      // Excel использует 1-based номера колонок, но мы храним 0-based индексы
      // Конвертируем: индекс 0 = колонка 1 (A), индекс 1 = колонка 2 (B), и т.д.
      const collectionCol = (rules.columnMappings.collection ?? 0) + 1 // A = индекс 0 -> номер 1
      const inStockCol = (rules.columnMappings.inStock ?? 1) + 1 // B = индекс 1 -> номер 2
      const arrivalCol = (rules.columnMappings.nextArrivalDate ?? 2) + 1 // C = индекс 2 -> номер 3
      
      const collectionColor = row.getCell(collectionCol).value?.toString().trim() || ''
      const inStockText = row.getCell(inStockCol).value?.toString().trim() || ''
      const arrivalText = row.getCell(arrivalCol).value?.toString().trim() || ''

      // Пропускаем заголовки и технические строки
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        return
      }

      if (!collectionColor) return

      const { collection, color } = this.parseCollectionAndColor(collectionColor, specialRules)

      // Парсинг наличия для Домиарт: + "в наличии", - "нет в наличии", +/- "нет в наличии"
      let inStock: boolean | null = null
      if (inStockText === '+' || inStockText.toLowerCase() === 'много') {
        inStock = true // "+" = в наличии
      } else if (inStockText === '-' || inStockText.toLowerCase() === 'нет') {
        inStock = false // "-" = нет в наличии
      } else if (inStockText === '+/-' || inStockText.toLowerCase() === 'мало') {
        inStock = false // "+/-" = нет в наличии
      }

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock,
        meterage: null,
        price: null,
        nextArrivalDate: this.parseDate(arrivalText),
        comment: null,
      }

      if (fabric.collection || fabric.colorNumber) {
        fabrics.push(fabric)
      }
    })

    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    const response = await axios.get(url, { responseType: 'arraybuffer' })
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(response.data)
    
    const worksheet = workbook.worksheets[0]
    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    // Собираем первые 15 строк для анализа
    for (let i = 1; i <= Math.min(15, worksheet.rowCount); i++) {
      const row = worksheet.getRow(i)
      const rowData: any[] = []
      row.eachCell({ includeEmpty: true }, (cell) => {
        rowData.push(cell.value?.toString() || '')
      })
      if (rowData.length > 0) {
        sampleData.push(rowData)
      }
    }

    const maxColumns = Math.max(...sampleData.map(row => row.length))

    // Определяем заголовки
    const firstRow = sampleData[0] || []
    const hasHeaders = firstRow.some((cell: any) => 
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

    // Вопросы о колонках (A, B, C соответствуют индексам 1, 2, 3)
    questions.push({
      id: 'collection-column',
      question: 'В какой колонке находится название коллекции и цвета? (A = 1, B = 2, и т.д.)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 1 (A)',
    })

    questions.push({
      id: 'stock-column',
      question: 'В какой колонке находится наличие? (формат: -, +/-, +)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 2 (B)',
    })

    questions.push({
      id: 'arrival-column',
      question: 'В какой колонке находится дата следующего поступления?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 3 (C)',
    })

    // Специальный вопрос о правиле Alfa 2303
    questions.push({
      id: 'alfa2303-rule',
      question: 'Подтвердите правило для коллекции "Alfa 2303": Alfa 2303 - коллекция, остальное - цвет?',
      type: 'skip',
      options: ['Да', 'Нет'],
      default: 'Да',
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

