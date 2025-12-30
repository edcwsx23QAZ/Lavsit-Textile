import axios from 'axios'
import ExcelJS from 'exceljs'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class ArteksParser extends BaseParser {
  /**
   * Пытается скачать файл, перебирая даты от сегодня в обратном порядке
   */
  private async downloadFileWithDateFallback(baseUrl: string): Promise<Buffer> {
    const today = new Date()
    const maxDaysBack = 30 // Максимум 30 дней назад
    
    for (let daysBack = 0; daysBack < maxDaysBack; daysBack++) {
      const date = new Date(today)
      date.setDate(date.getDate() - daysBack)
      
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      
      const dateStr = `${day}.${month}.${year}`
      // Заменяем дату в URL (формат: DD.MM.YYYY-2.xlsx)
      // Ищем паттерн даты и заменяем его
      const url = baseUrl.replace(/\d{2}\.\d{2}\.\d{4}-\d+\.xlsx/, `${dateStr}-2.xlsx`)
      
      try {
        const response = await axios.get(url, { 
          responseType: 'arraybuffer',
          timeout: 10000,
          validateStatus: (status) => status === 200,
        })
        console.log(`[Arteks] Успешно скачан файл с датой: ${dateStr}`)
        return Buffer.from(response.data)
      } catch (error: any) {
        if (error.response?.status === 404) {
          console.log(`[Arteks] Файл не найден для даты: ${dateStr}, пробуем следующую...`)
          continue
        }
        throw error
      }
    }
    
    throw new Error('Не удалось скачать файл за последние 30 дней')
  }

  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    // Скачиваем файл с перебором дат
    const buffer = await this.downloadFileWithDateFallback(url)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    
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
    } else {
      await this.saveDataStructure(structure)
    }

    worksheet.eachRow((row, rowNumber) => {
      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        return
      }

      // Excel использует 1-based номера колонок, но мы храним 0-based индексы
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

      // Применяем специальные правила (убираем "Мебельная ткань")
      const specialRules = {
        ...rules.specialRules,
        removeFurnitureText: true,
      }
      const { collection, color } = this.parseCollectionAndColor(collectionColor, specialRules)

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock: this.parseBoolean(inStockText),
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
    // Пытаемся скачать файл с текущей датой
    const buffer = await this.downloadFileWithDateFallback(url)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    
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
      default: 'Колонка 2 (B)',
    })

    questions.push({
      id: 'arrival-column',
      question: 'В какой колонке находится дата следующего поступления?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(64 + i)})`),
      default: 'Колонка 3 (C)',
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

