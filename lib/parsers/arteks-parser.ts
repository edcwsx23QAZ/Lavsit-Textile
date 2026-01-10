import axios from 'axios'
import ExcelJS from 'exceljs'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class ArteksParser extends BaseParser {
  /**
   * Парсит статус наличия для Артекса
   * "В наличии" -> true
   * "По звонку" -> false
   * "НЕТ" -> false
   */
  private parseArteksStockStatus(text: string): boolean | null {
    if (!text) return null
    
    const str = text.trim().toLowerCase()
    
    if (str === 'в наличии') {
      return true
    }
    
    if (str === 'по звонку' || str === 'нет') {
      return false
    }
    
    return null
  }

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
        return Buffer.from(response.data as ArrayBuffer)
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
    
    // Логируем загруженные правила
    console.log(`[Arteks] Загружены правила парсинга:`, JSON.stringify(rules, null, 2))

    // Скачиваем файл с перебором дат
    const buffer = await this.downloadFileWithDateFallback(url)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer as any)
    
    const worksheet = workbook.worksheets[0]
    const fabrics: ParsedFabric[] = []
    
    // Логируем загруженные правила
    console.log(`[Arteks] Загружены правила парсинга:`, JSON.stringify(rules, null, 2))
    console.log(`[Arteks] Индексы столбцов: collection=${rules.columnMappings.collection}, inStock=${rules.columnMappings.inStock}, comment=${rules.columnMappings.comment}`)

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
      // Для Артекса: A=0 (коллекция), B=1 (наличие), C=2 (комментарий)
      const collectionCol = (rules.columnMappings.collection ?? 0) + 1 // A = индекс 0 -> номер 1
      const inStockCol = (rules.columnMappings.inStock ?? 1) + 1 // B = индекс 1 -> номер 2
      const commentCol = (rules.columnMappings.comment ?? 2) + 1 // C = индекс 2 -> номер 3
      const arrivalCol = (rules.columnMappings.nextArrivalDate ?? 2) + 1 // C = индекс 2 -> номер 3 (может быть тот же столбец)
      
      // Читаем значения из ячеек
      const collectionColorCell = row.getCell(collectionCol)
      const inStockCell = row.getCell(inStockCol)
      const commentCell = row.getCell(commentCol)
      const arrivalCell = row.getCell(arrivalCol)
      
      const collectionColor = collectionColorCell?.value?.toString().trim() || ''
      const inStockText = inStockCell?.value?.toString().trim() || ''
      const commentText = commentCell?.value?.toString().trim() || ''
      const arrivalText = arrivalCell?.value?.toString().trim() || ''
      
      // Детальное логирование для отладки (особенно для ELEGANT)
      if (collectionColor.toUpperCase().includes('ELEGANT') && collectionColor.includes('11')) {
        console.log(`[Arteks] ДЕТАЛЬНАЯ ОТЛАДКА строки ${rowNumber}:`)
        console.log(`[Arteks]   Столбец A (${collectionCol}): "${collectionColor}"`)
        console.log(`[Arteks]   Столбец B (${inStockCol}): "${inStockText}" (тип ячейки: ${inStockCell?.type})`)
        console.log(`[Arteks]   Столбец C (${commentCol}): "${commentText}" (тип ячейки: ${commentCell?.type})`)
        console.log(`[Arteks]   Правила: collection=${rules.columnMappings.collection}, inStock=${rules.columnMappings.inStock}, comment=${rules.columnMappings.comment}`)
      }

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

      // Парсим наличие для Артекса: "В наличии" -> true, "По звонку" или "НЕТ" -> false
      const inStock = this.parseArteksStockStatus(inStockText)

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock,
        meterage: null,
        price: null,
        nextArrivalDate: this.parseDate(arrivalText),
        comment: commentText || null,
      }

      // Логируем первые несколько примеров для отладки, особенно с "ELEGANT" и "По звонку"
      const shouldLog = fabrics.length < 5 || 
                       collectionColor.toUpperCase().includes('ELEGANT') || 
                       inStockText.toLowerCase().includes('звонку') ||
                       inStockText.toLowerCase().includes('нет')
      if (shouldLog) {
        console.log(`[Arteks] Пример ${fabrics.length + 1}: "${fabric.collection}" "${fabric.colorNumber}" - ${fabric.inStock ? 'В наличии' : fabric.inStock === false ? 'Не в наличии' : 'Неизвестно'} (комментарий: ${fabric.comment || 'нет'})`)
        console.log(`[Arteks] Исходные данные строки ${rowNumber}: A="${collectionColor}", B="${inStockText}", C="${commentText}"`)
        console.log(`[Arteks] После парсинга: коллекция="${collection}", цвет="${color}", наличие=${inStock} (тип: ${typeof inStock}, значение: ${JSON.stringify(inStock)})`)
        console.log(`[Arteks] Объект fabric перед добавлением:`, JSON.stringify(fabric, null, 2))
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
    await workbook.xlsx.load(buffer as any)
    
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

