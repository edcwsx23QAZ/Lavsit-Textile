import axios from 'axios'
import ExcelJS from 'exceljs'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class SouzmParser extends BaseParser {
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

    worksheet.eachRow((row, rowNumber) => {
      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        return
      }

      // Excel использует 1-based номера колонок, но мы храним 0-based индексы
      // Конвертируем: индекс 0 = колонка 1 (A), индекс 1 = колонка 2 (B), и т.д.
      const collectionCol = (rules.columnMappings.collection ?? 1) + 1 // B = индекс 1 -> номер 2
      const inStockCol = (rules.columnMappings.inStock ?? 2) + 1 // C = индекс 2 -> номер 3
      const arrivalCol = (rules.columnMappings.nextArrivalDate ?? 3) + 1 // D = индекс 3 -> номер 4
      const commentCol = (rules.columnMappings.comment ?? 4) + 1 // E = индекс 4 -> номер 5
      
      const collectionColor = row.getCell(collectionCol).value?.toString().trim() || ''
      const inStockText = row.getCell(inStockCol).value?.toString().trim() || ''
      const arrivalText = row.getCell(arrivalCol).value?.toString().trim() || ''
      const commentText = row.getCell(commentCol).value?.toString().trim() || ''

      // Пропускаем заголовки и технические строки
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        return
      }

      if (!collectionColor) return

      const { collection, color } = this.parseCollectionAndColor(collectionColor, rules.specialRules)

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock: this.parseBoolean(inStockText),
        meterage: null,
        price: null,
        nextArrivalDate: this.parseDate(arrivalText),
        comment: commentText || null,
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

    // Вопросы о колонках (B, C, D, E соответствуют индексам 2, 3, 4, 5)
    questions.push({
      id: 'collection-column',
      question: 'В какой колонке находится название коллекции и цвета? (B = 2, C = 3, и т.д.)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 2 (B)',
    })

    questions.push({
      id: 'stock-column',
      question: 'В какой колонке находится наличие?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 3 (C)',
    })

    questions.push({
      id: 'arrival-column',
      question: 'В какой колонке находится дата следующего поступления?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 4 (D)',
    })

    questions.push({
      id: 'comment-column',
      question: 'В какой колонке находится комментарий?',
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

