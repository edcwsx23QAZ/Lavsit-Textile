import * as cheerio from 'cheerio'
import axios from 'axios'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class ArtvisionParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    const fabrics: ParsedFabric[] = []

    // Находим таблицу с остатками
    $('table tr').each((index, row) => {
      // Пропускаем заголовки и технические строки согласно правилам
      if (rules.skipRows?.includes(index)) {
        return
      }

      const cells = $(row).find('td')
      if (cells.length < 4) return

      const collectionColor = $(cells[rules.columnMappings.collection ?? 0]).text().trim()
      const inStockText = $(cells[rules.columnMappings.inStock ?? 1]).text().trim()
      const meterageText = $(cells[rules.columnMappings.meterage ?? 2]).text().trim()
      const arrivalText = $(cells[rules.columnMappings.nextArrivalDate ?? 3]).text().trim()

      // Пропускаем если это заголовок или подзаголовок
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        return
      }

      if (!collectionColor) return

      // Применяем специальное правило для Artvision с тире
      const specialRules = {
        ...rules.specialRules,
        artvisionDashPattern: true,
      }
      const { collection, color } = this.parseCollectionAndColor(collectionColor, specialRules)

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock: this.parseBoolean(inStockText),
        meterage: this.parseNumber(meterageText),
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
    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    // Находим таблицу
    const table = $('table').first()
    if (table.length === 0) {
      throw new Error('Таблица не найдена на странице')
    }

    // Собираем первые 10 строк для анализа
    table.find('tr').slice(0, 10).each((index, row) => {
      const cells = $(row).find('td, th')
      const rowData: string[] = []
      cells.each((_, cell) => {
        rowData.push($(cell).text().trim())
      })
      if (rowData.length > 0) {
        sampleData.push(rowData)
      }
    })

    const maxColumns = Math.max(...sampleData.map(row => row.length))

    // Определяем заголовки
    const firstRow = sampleData[0] || []
    const hasHeaders = firstRow.some(cell => 
      ['коллекция', 'цвет', 'наличие', 'метраж', 'дата'].some(keyword => 
        cell.toLowerCase().includes(keyword)
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
      question: 'В какой колонке находится название коллекции и цвета?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    questions.push({
      id: 'stock-column',
      question: 'В какой колонке находится наличие?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    questions.push({
      id: 'meterage-column',
      question: 'В какой колонке находится метраж?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    questions.push({
      id: 'arrival-column',
      question: 'В какой колонке находится дата поступления?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
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
        headers: hasHeaders ? firstRow : undefined,
      },
    }
  }
}

