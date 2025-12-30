import axios from 'axios'
import * as XLSX from 'xlsx'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'
import { validateDate } from '@/lib/date-validation'

export class EgidaParser extends BaseParser {
  /**
   * Форматирует дату в формат DD.MM.YY для URL Эгида
   */
  private formatDateForUrl(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = String(date.getFullYear()).slice(-2)
    return `${day}.${month}.${year}`
  }

  /**
   * Генерирует URL для Эгида с указанной датой
   */
  private generateUrlForDate(date: Date): string {
    const dateStr = this.formatDateForUrl(date)
    return `https://exch.tendence.ru/download.php?file=${dateStr}_ostatki_tkani_ooo_egida.xls`
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
          console.log(`[EgidaParser] Найден актуальный файл: ${url} (дата: ${checkDate.toLocaleDateString('ru-RU')})`)
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
    throw new Error(`Не удалось найти актуальный файл Эгида за последние ${maxDaysBack} дней. Проверьте доступность файлов на сервере.`)
  }

  /**
   * Парсит коллекцию и цвет из столбца B по правилам Эгида
   * Первое слово - коллекция, остальное - цвет
   * Пример: "Блисс 03 (св.беж)" -> коллекция: "Блисс", цвет: "03 (св.беж)"
   */
  private parseCollectionAndColorEgida(text: string): { collection: string; color: string } | null {
    const trimmed = text.trim()
    if (!trimmed) return null
    
    // Нормализуем пробелы
    const normalized = trimmed.replace(/\s+/g, ' ')
    
    // Разделяем по первому пробелу
    const firstSpaceIndex = normalized.indexOf(' ')
    
    if (firstSpaceIndex > 0) {
      // Первое слово - коллекция, остальное - цвет
      const collection = normalized.substring(0, firstSpaceIndex).trim()
      const color = normalized.substring(firstSpaceIndex + 1).trim()
      
      if (collection) {
        return { collection, color }
      }
    }
    
    // Если пробела нет, весь текст - коллекция, цвет пустой
    return { collection: normalized, color: '' }
  }

  /**
   * Парсит наличие из столбца C
   * Может иметь три значения:
   * - "В наличии" -> в наличии
   * - "Мало" -> в наличии, комментарий "ВНИМАНИЕ, МАЛО!"
   * - "Нет в наличии" -> не в наличии
   */
  private parseStockStatus(text: string): { inStock: boolean; comment: string | null } {
    const trimmed = String(text).trim()
    const lowerTrimmed = trimmed.toLowerCase()
    
    if (lowerTrimmed === 'в наличии') {
      return { inStock: true, comment: null }
    }
    
    if (lowerTrimmed === 'мало') {
      return { inStock: true, comment: 'ВНИМАНИЕ, МАЛО!' }
    }
    
    if (lowerTrimmed === 'нет в наличии' || lowerTrimmed === 'нет') {
      return { inStock: false, comment: null }
    }
    
    // По умолчанию не в наличии
    return { inStock: false, comment: null }
  }

  async parse(url: string): Promise<ParsedFabric[]> {
    let rules: ParsingRules | null = null
    try {
      rules = await this.loadRules()
    } catch (error) {
      console.log(`[EgidaParser] Не удалось загрузить правила из БД, используем дефолтные: ${error}`)
    }
    
    const defaultRules: ParsingRules = {
      columnMappings: {
        collection: 1, // Столбец B (индекс 1)
        inStock: 2,    // Столбец C (индекс 2)
        comment: 3,     // Столбец D (индекс 3)
        nextArrivalDate: 4, // Столбец E (индекс 4)
      },
      skipRows: [],
      skipPatterns: [],
      specialRules: {
        egidaPattern: true,
      },
    }
    
    const activeRules = rules || defaultRules
    console.log(`[EgidaParser] Используются правила: ${rules ? 'из БД' : 'дефолтные'}`)

    // Для Эгида находим актуальный URL с датой
    const actualUrl = await this.findActualUrl()
    
    console.log(`[EgidaParser] Скачиваем файл: ${actualUrl}`)
    const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    
    // Используем первую вкладку
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    console.log(`[EgidaParser] Загружено строк: ${data.length}`)
    
    const fabrics: ParsedFabric[] = []
    let processedCount = 0
    let skippedCount = 0
    let addedCount = 0
    
    // Проходим по всем строкам
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1
      
      // Столбец B (индекс 1) - коллекция и цвет
      const colB = String(row[1] || '').trim()
      if (!colB) {
        skippedCount++
        continue
      }
      
      // Столбец C (индекс 2) - наличие
      const colC = String(row[2] || '').trim()
      // Если столбец C пуст, пропускаем строку
      if (!colC || colC === '') {
        skippedCount++
        continue
      }
      
      processedCount++
      
      // Парсим коллекцию и цвет из столбца B
      const collectionColor = this.parseCollectionAndColorEgida(colB)
      if (!collectionColor || !collectionColor.collection) {
        skippedCount++
        continue
      }
      
      // Парсим наличие из столбца C
      const { inStock, comment: stockComment } = this.parseStockStatus(colC)
      
      // Столбец D (индекс 3) - комментарий (только если нет в наличии)
      const colD = String(row[3] || '').trim()
      
      // Объединяем комментарии
      let finalComment: string | null = null
      
      // Если есть комментарий о малом количестве, добавляем его первым
      if (stockComment) {
        finalComment = stockComment
      }
      
      // Столбец D (индекс 3) - добавляем только если нет в наличии (inStock = false)
      if (!inStock && colD) {
        const kazanComment = `На складе в Казани ${colD}`
        if (finalComment) {
          finalComment = `${finalComment}. ${kazanComment}`
        } else {
          finalComment = kazanComment
        }
      }
      
      // Столбец E (индекс 4) - дата следующего поступления
      let nextArrivalDate: Date | null = null
      const colE = row[4]
      if (colE) {
        const parsedDate = this.parseDate(String(colE))
        if (parsedDate && validateDate(parsedDate)) {
          nextArrivalDate = parsedDate
        }
      }
      
      const fabric: ParsedFabric = {
        collection: collectionColor.collection,
        colorNumber: collectionColor.color || '',
        inStock,
        meterage: null,
        price: null,
        nextArrivalDate,
        comment: finalComment,
      }
      
      fabrics.push(fabric)
      addedCount++
      
      // Логируем примеры для отладки
      if (addedCount <= 10) {
        console.log(`[EgidaParser] Пример ${addedCount}: "${fabric.collection}" "${fabric.colorNumber}" - ${fabric.inStock ? 'В наличии' : 'Не в наличии'} (комментарий: ${fabric.comment || 'нет'})`)
      }
    }
    
    console.log(`[EgidaParser] ИТОГО: обработано валидных строк: ${processedCount}, добавлено тканей: ${addedCount}, пропущено: ${skippedCount}`)
    
    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    // Для Эгида находим актуальный URL с датой
    const actualUrl = await this.findActualUrl()
    
    console.log(`[EgidaParser] Скачиваем файл для анализа: ${actualUrl}`)
    const response = await axios.get(actualUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    // Собираем первые 30 строк для анализа
    for (let i = 0; i < Math.min(30, data.length); i++) {
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
      question: 'В какой колонке находится коллекция и цвет? (B = 2)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 2 (B)',
    })

    questions.push({
      id: 'inStock-column',
      question: 'В какой колонке находится наличие? (C = 3)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 3 (C)',
    })

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

