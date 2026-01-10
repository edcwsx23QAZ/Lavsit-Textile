import * as cheerio from 'cheerio'
import axios from 'axios'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class TextileDataParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    const response = await axios.get(url)
    const $ = cheerio.load(response.data)
    const fabrics: ParsedFabric[] = []

    // Находим таблицу
    const table = $('table').first()
    if (table.length === 0) {
      throw new Error('Таблица не найдена на странице')
    }

    // Получаем заголовки таблицы
    const headers: string[] = []
    table.find('thead tr').first().find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim().toLowerCase())
    })

    // Находим индексы колонок по заголовкам
    const collectionIndex = headers.findIndex(h => h.includes('товар') || h.includes('название'))
    const meterageIndex = headers.findIndex(h => h.includes('остаток'))
    const commentIndex = headers.findIndex(h => h.includes('макс') || h.includes('ролик'))
    const arrivalIndex = headers.findIndex(h => h.includes('дата') && h.includes('приход'))

    table.find('tbody tr, tr').each((index, row) => {
      // Пропускаем заголовки и технические строки согласно правилам
      if (rules.skipRows?.includes(index + 1)) {
        return
      }

      const cells = $(row).find('td, th')
      if (cells.length < 4) return

      // Получаем данные из нужных колонок
      let collectionColor = ''
      let meterageText = ''
      let commentText = ''
      let arrivalText = ''

      // Используем индексы из заголовков или правила
      if (collectionIndex >= 0) {
        collectionColor = $(cells[collectionIndex]).text().trim()
      } else if (rules.columnMappings.collection !== undefined) {
        collectionColor = $(cells[rules.columnMappings.collection]).text().trim()
      }

      if (meterageIndex >= 0) {
        meterageText = $(cells[meterageIndex]).text().trim()
      } else if (rules.columnMappings.meterage !== undefined) {
        meterageText = $(cells[rules.columnMappings.meterage]).text().trim()
      }

      if (commentIndex >= 0) {
        commentText = $(cells[commentIndex]).text().trim()
      } else if (rules.columnMappings.comment !== undefined) {
        commentText = $(cells[rules.columnMappings.comment]).text().trim()
      }

      if (arrivalIndex >= 0) {
        arrivalText = $(cells[arrivalIndex]).text().trim()
      } else if (rules.columnMappings.nextArrivalDate !== undefined) {
        arrivalText = $(cells[rules.columnMappings.nextArrivalDate]).text().trim()
      }

      // Пропускаем если это заголовок или подзаголовок
      if (rules.skipPatterns?.some(pattern => collectionColor.includes(pattern))) {
        return
      }

      if (!collectionColor) return

      // Применяем специальные правила для TextileData
      const specialRules = {
        ...rules.specialRules,
        removeUnderscoreBackslash: true,
        colorOnlyNumbers: true,
      }
      const { collection, color } = this.parseCollectionAndColor(collectionColor, specialRules)

      // Парсинг метража и наличия для TextileData
      // 1. В столбец "метраж" должно попадать количество включая знаки ">" или "<"
      // 2. Если в столбце метраж цифра больше 10 ставим плашку "в наличии"
      // 3. Если в столбце метраж цифра меньше 10, ставим плашку "нет в наличии"
      // 5. Если в столбец метраж не попали цифры или попал символ -, ставим плашку "нет в наличии"
      
      let meterage: number | null = null
      let inStock: boolean = false // По умолчанию нет в наличии
      let meterageComment: string | null = null // Для сохранения оригинального текста с > или <
      
      if (meterageText && meterageText.trim() !== '-' && meterageText.trim() !== '') {
        const trimmedMeterage = meterageText.trim()
        
        // Проверяем, есть ли знаки > или < в тексте метража
        const hasComparisonSign = /[<>]/.test(trimmedMeterage)
        
        // Извлекаем число из текста (может быть ">10", "<5", "15", "10.5" и т.д.)
        const numberMatch = trimmedMeterage.match(/(\d+(?:[.,]\d+)?)/)
        if (numberMatch) {
          const numValue = parseFloat(numberMatch[1].replace(',', '.'))
          if (!isNaN(numValue) && numValue > 0) {
            meterage = numValue
            
            // Если в метраже есть знаки > или <, сохраняем оригинальный текст
            if (hasComparisonSign) {
              meterageComment = trimmedMeterage
            }
            
            // Определяем наличие на основе числа
            if (numValue > 10) {
              inStock = true // Больше 10 - в наличии
            } else {
              inStock = false // Меньше или равно 10 - нет в наличии
            }
          }
        } else {
          // Нет цифр - нет в наличии
          inStock = false
        }
      } else {
        // Пустое или "-" - нет в наличии
        inStock = false
      }

      // 4. Если в графу "комментарий" попали цифры, пишем перед ними текст "Максимальный размер ролика"
      let finalComment: string | null = null
      if (commentText && commentText.trim()) {
        // Проверяем, есть ли в комментарии цифры
        if (/\d/.test(commentText)) {
          finalComment = `Максимальный размер ролика ${commentText.trim()}`
        } else {
          finalComment = commentText.trim()
        }
      }
      
      // Объединяем комментарий метража (с > или <) с комментарием из столбца комментария
      if (meterageComment) {
        if (finalComment) {
          finalComment = `${meterageComment}. ${finalComment}`
        } else {
          finalComment = meterageComment
        }
      }

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock,
        meterage,
        price: null,
        nextArrivalDate: this.parseDate(arrivalText),
        comment: finalComment,
      }

      // Логирование для первых нескольких строк для отладки
      if (fabrics.length < 5) {
        console.log(`[TextileData] Строка ${index + 1}: коллекция="${collection}", цвет="${color}", meterageText="${meterageText}", meterage=${meterage}, inStock=${inStock}, comment="${finalComment}"`)
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

    // Собираем заголовки
    const headers: string[] = []
    table.find('thead tr').first().find('th, td').each((_, cell) => {
      headers.push($(cell).text().trim())
    })

    // Собираем первые 10 строк для анализа
    table.find('tbody tr, tr').slice(0, 10).each((index, row) => {
      const cells = $(row).find('td, th')
      const rowData: string[] = []
      cells.each((_, cell) => {
        rowData.push($(cell).text().trim())
      })
      if (rowData.length > 0) {
        sampleData.push(rowData)
      }
    })

    const maxColumns = Math.max(...sampleData.map(row => row.length), headers.length)

    questions.push({
      id: 'collection-column',
      question: 'В какой колонке находится "Товар" (коллекция и цвет)?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    questions.push({
      id: 'meterage-column',
      question: 'В какой колонке находится "Остаток" (метраж)?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    questions.push({
      id: 'comment-column',
      question: 'В какой колонке находится "Макс.ролик" (комментарий)?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    questions.push({
      id: 'arrival-column',
      question: 'В какой колонке находится "Дата прихода"?',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1}`),
    })

    return {
      questions,
      sampleData,
      structure: {
        columns: maxColumns,
        rows: sampleData.length,
        headers: headers.length > 0 ? headers : undefined,
      },
    }
  }
}

