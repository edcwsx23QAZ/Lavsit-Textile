import * as XLSX from 'xlsx'
import AdmZip from 'adm-zip'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'
import { EmailParser, EmailConfig, EmailAttachment } from '@/lib/email/email-parser'
import { prisma } from '@/lib/db/prisma'

/**
 * Новый парсер Аметиста, работающий с Buffer вместо файлов
 * Интегрирован с EmailParser для получения писем напрямую
 */
/**
 * Парсер Аметиста - работает с Buffer вместо файлов
 * Интегрирован с EmailParser для получения писем напрямую
 * Использует настройки из базы данных для подключения к почте
 */
export class AmetistParser extends BaseParser {
  private emailParser: EmailParser | null = null

  /**
   * Получает email конфигурацию из базы данных
   */
  private async getEmailConfig(): Promise<EmailConfig> {
    const supplier = await prisma.supplier.findUnique({
      where: { id: this.supplierId },
      select: { emailConfig: true },
    })

    if (!supplier || !supplier.emailConfig) {
      throw new Error(`Email configuration not found for ${this.supplierName}`)
    }

    let emailConfig = JSON.parse(supplier.emailConfig)

    // Нормализуем структуру emailConfig (конвертируем из вложенной в плоскую, если нужно)
    if (emailConfig.imap && (emailConfig.imap.host || emailConfig.imap.port || emailConfig.imap.user)) {
      // Вложенная структура - конвертируем в плоскую для EmailParser
      emailConfig = {
        host: emailConfig.imap.host || 'imap.gmail.com',
        port: emailConfig.imap.port || 993,
        user: emailConfig.imap.user || '',
        password: emailConfig.imap.password || '',
        secure: emailConfig.imap.secure !== false,
        fromEmail: emailConfig.fromEmail || '',
        subjectFilter: emailConfig.subjectFilter || "Остатки номенклатуры на складе 'ООО Аметист'",
        searchDays: emailConfig.searchDays || 90,
        searchUnreadOnly: emailConfig.searchUnreadOnly !== undefined ? emailConfig.searchUnreadOnly : false,
        useAnyLatestAttachment: emailConfig.useAnyLatestAttachment === true,
      }
    }

    return emailConfig
  }

  /**
   * Подключается к почте и получает последнее письмо с вложением
   */
  private async fetchLatestEmailAttachment(): Promise<EmailAttachment | null> {
    const emailConfig = await this.getEmailConfig()
    this.emailParser = new EmailParser(emailConfig)
    
    await this.emailParser.connect()

    try {
      // Получаем период поиска из конфигурации
      const searchDays = emailConfig.searchDays || 90
      const since = new Date()
      since.setDate(since.getDate() - searchDays)

      console.log(`[AmetistParser] Searching emails from last ${searchDays} days (since ${since.toISOString()})`)

      // Получаем письма
      const emails = await this.emailParser.fetchNewEmails(this.supplierId, since)
      console.log(`[AmetistParser] Found ${emails.length} email(s) matching criteria`)

      if (emails.length === 0) {
        console.log(`[AmetistParser] No emails found`)
        return null
      }

      // Сортируем письма по дате (от новых к старым)
      const sortedEmails = [...emails].sort((a, b) => {
        const dateA = a.date || new Date(0)
        const dateB = b.date || new Date(0)
        return dateB.getTime() - dateA.getTime()
      })

      // Ищем письмо с валидным Excel или ZIP вложением
      // extractExcelAttachments уже возвращает и Excel и ZIP файлы
      for (const email of sortedEmails) {
        const attachments = this.emailParser.extractExcelAttachments(email)

        if (attachments.length > 0) {
          // Возвращаем первое найденное вложение
          const attachment = attachments[0]
          console.log(`[AmetistParser] Found attachment: ${attachment.filename} (${attachment.size || attachment.content.length} bytes)`)
          console.log(`[AmetistParser] Email date: ${email.date ? new Date(email.date).toISOString() : 'unknown'}`)
          console.log(`[AmetistParser] Email subject: ${email.subject || 'unknown'}`)
          console.log(`[AmetistParser] Email from: ${email.from || 'unknown'}`)
          return attachment
        }
      }

      console.log(`[AmetistParser] No valid attachments found in emails`)
      return null
    } finally {
      await this.emailParser.disconnect()
      this.emailParser = null
    }
  }

  /**
   * Валидация файла из Buffer
   */
  async validate(buffer: Buffer, filename: string): Promise<boolean> {
    try {
      console.log(`[AmetistParser] Validating file: ${filename} (${buffer.length} bytes)`)

      if (buffer.length === 0) {
        console.log(`[AmetistParser] File is empty`)
        return false
      }

      let excelBuffer: Buffer

      // Если это ZIP, распаковываем в память
      if (filename.endsWith('.zip') || filename.endsWith('.ZIP')) {
        const zip = new AdmZip(buffer)
        const zipEntries = zip.getEntries()
        const excelEntry = zipEntries.find(entry => 
          entry.entryName.endsWith('.xlsx') || entry.entryName.endsWith('.xls')
        )

        if (!excelEntry) {
          console.log(`[AmetistParser] Excel file not found in ZIP archive`)
          return false
        }

        excelBuffer = excelEntry.getData()
        console.log(`[AmetistParser] Extracted Excel file from ZIP: ${excelEntry.entryName}`)
      } else {
        excelBuffer = buffer
      }

      // Валидация Excel файла
      const workbook = XLSX.read(excelBuffer, { type: 'buffer' })

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.log(`[AmetistParser] File contains no sheets`)
        return false
      }

      // Проверяем, что хотя бы одна вкладка содержит данные
      let hasData = false
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) continue

        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
        if (data.length >= 2) {
          hasData = true
          break
        }
      }

      if (!hasData) {
        console.log(`[AmetistParser] File contains no data`)
        return false
      }

      console.log(`[AmetistParser] File is valid`)
      return true
    } catch (error: any) {
      console.log(`[AmetistParser] Validation error: ${error.message}`)
      return false
    }
  }

  /**
   * Парсинг из Buffer
   */
  async parseFromBuffer(buffer: Buffer, filename: string): Promise<ParsedFabric[]> {
    let rules = await this.loadRules()
    
    // Если правил нет, создаем по умолчанию
    if (!rules) {
      console.log(`[AmetistParser] ⚠️ Правила парсинга не найдены. Создание правил по умолчанию...`)
      
      const defaultRules: ParsingRules = {
        columnMappings: {
          collection: 2, // C = индекс 2
          color: 4, // E = индекс 4
          inStock: 6, // G = индекс 6
          meterage: 6, // G = индекс 6
          nextArrivalDate: 9, // J = индекс 9
        },
        skipRows: [1, 2], // Пропускаем строки 1 и 2 (служебная информация)
        headerRow: 2, // Строка 3 (индекс 2) содержит заголовки
        specialRules: {
          ametistColorPattern: true,
        },
      }
      
      await this.saveRules(defaultRules)
      console.log(`[AmetistParser] ✅ Правила по умолчанию сохранены`)
      rules = defaultRules
    }

    console.log(`[AmetistParser] Parsing file: ${filename} (${buffer.length} bytes)`)
    console.log(`[AmetistParser] File hash (first 16 bytes): ${buffer.slice(0, 16).toString('hex')}`)

    let excelBuffer: Buffer

    // Если это ZIP, распаковываем в память
    if (filename.endsWith('.zip') || filename.endsWith('.ZIP')) {
      const zip = new AdmZip(buffer)
      const zipEntries = zip.getEntries()
      const excelEntry = zipEntries.find(entry => 
        entry.entryName.endsWith('.xlsx') || entry.entryName.endsWith('.xls')
      )

      if (!excelEntry) {
        throw new Error('Excel файл не найден в ZIP архиве')
      }

      excelBuffer = excelEntry.getData()
      console.log(`[AmetistParser] Extracted Excel file from ZIP: ${excelEntry.entryName}`)
    } else {
      excelBuffer = buffer
    }

    // Загружаем Excel файл
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })

    // Используем первую вкладку
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      defval: '', 
      raw: true,
    }) as any[][]

    const fabrics: ParsedFabric[] = []

    // Сохраняем структуру для сравнения
    const structure = {
      rowCount: data.length,
      columnCount: data.length > 0 ? Math.max(...data.map(row => row.length)) : 0,
      firstRow: data[0] || [],
    }

    await this.saveDataStructure(structure)

    // Пропускаем строки согласно правилам
    const startRow = rules.headerRow ? rules.headerRow + 1 : 1
    
    console.log(`[AmetistParser] Начало парсинга: всего строк ${data.length}, начинаем со строки ${startRow + 1}`)

    let processedCount = 0
    let skippedCount = 0
    let emptyCollectionCount = 0
    let emptyColorCount = 0

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1

      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        skippedCount++
        continue
      }

      // Колонка C (индекс 2) - коллекция
      const collectionCol = rules.columnMappings.collection ?? 2
      const collection = row[collectionCol]?.toString().trim() || ''

      if (!collection) {
        emptyCollectionCount++
        continue
      }

      // Колонка E (индекс 4) - цвет
      const colorCol = rules.columnMappings.color ?? 4
      let color = row[colorCol]?.toString().trim() || ''

      if (!color) {
        emptyColorCount++
        continue
      }
      
      processedCount++
      
      // Логируем каждые 100 обработанных строк
      if (processedCount % 100 === 0) {
        console.log(`[AmetistParser] Обработано ${processedCount} тканей (строка ${rowNumber})...`)
      }

      // Колонка G (индекс 6) - метраж (точные значения)
      const meterageCol = rules.columnMappings.meterage ?? rules.columnMappings.inStock ?? 6

      // Получаем значение напрямую из ячейки для точности
      const colLetter = String.fromCharCode(65 + meterageCol)
      const cellAddress = `${colLetter}${rowNumber}`
      const cell = worksheet[cellAddress]

      let meterageValue: any = undefined

      if (cell) {
        // ПРИОРИТЕТ 1: Если есть cell.w (отформатированное строковое значение), используем его
        if (cell.w !== undefined && typeof cell.w === 'string') {
          meterageValue = cell.w.trim()
        } 
        // ПРИОРИТЕТ 2: Если cell.w нет или это не строка, используем cell.v (исходное значение)
        else if (cell.v !== undefined) {
          meterageValue = cell.v
        }
      }

      // ПРИОРИТЕТ 3: Если не получили значение из ячейки, используем значение из массива
      if (meterageValue === undefined || meterageValue === null) {
        meterageValue = row[meterageCol]
      }

      let meterage: number | null = null
      let inStock: boolean | null = null
      let comment: string | null = null

      // Парсим значение метража
      if (meterageValue !== undefined && meterageValue !== null && meterageValue !== '') {
        let numValue: number | null = null

        if (typeof meterageValue === 'string') {
          let valueStr = String(meterageValue).trim()

          // Проверяем следующую колонку H (индекс 7) на наличие единицы измерения "м"
          const nextCol = meterageCol + 1
          if (row[nextCol] && String(row[nextCol]).trim().toLowerCase() === 'м') {
            // Единица измерения в следующей колонке, используем только текущее значение
          } else if (valueStr.toLowerCase().endsWith('м')) {
            valueStr = valueStr.replace(/м\s*$/i, '').trim()
          }

          // Убираем знаки > и < для извлечения числа
          const cleanedStr = valueStr.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()

          // Ищем число с десятичной частью (85,6 или 85.6)
          const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
          if (decimalMatch) {
            const wholePart = decimalMatch[1]
            const decimalPart = decimalMatch[2]
            const extractedStr = `${wholePart}.${decimalPart}`
            numValue = parseFloat(extractedStr)
          } else {
            // Если нет десятичной части, пробуем распарсить всю строку как число
            let normalizedStr = cleanedStr.replace(/\s+/g, '').replace(/,/g, '.')
            numValue = parseFloat(normalizedStr)

            // Если не удалось, ищем первое целое число в строке
            if (isNaN(numValue) || numValue === 0) {
              const integerMatch = cleanedStr.match(/(\d+)/)
              if (integerMatch) {
                numValue = parseFloat(integerMatch[1])
              }
            }
          }
        } else if (typeof meterageValue === 'number') {
          // Если значение уже число, проверяем cell.w для получения исходной строки
          if (cell && cell.w && typeof cell.w === 'string') {
            const formattedStr = cell.w.trim()
            let valueStr = formattedStr.replace(/м\s*$/i, '').trim()
            const cleanedStr = valueStr.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()
            const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
            if (decimalMatch) {
              const wholePart = decimalMatch[1]
              const decimalPart = decimalMatch[2]
              const extractedStr = `${wholePart}.${decimalPart}`
              numValue = parseFloat(extractedStr)
            } else {
              numValue = meterageValue
            }
          } else if (!isNaN(meterageValue) && meterageValue > 0) {
            numValue = meterageValue
          }
        }

        // Если нашли число, определяем наличие и комментарий
        if (numValue !== null && !isNaN(numValue) && numValue > 0) {
          meterage = numValue
          inStock = true

          // Если число меньше 10, добавляем комментарий
          if (numValue < 10) {
            comment = 'ВНИМАНИЕ, МАЛО!'
          }
        } else {
          // Если не удалось извлечь число, проверяем текстовые значения
          const valueStr = String(meterageValue).trim().toLowerCase()
          if (valueStr.includes('нет') || valueStr.includes('не в наличии')) {
            inStock = false
          }
        }
      }

      // Колонка J (индекс 9) - дата следующего прихода
      const nextArrivalCol = rules.columnMappings.nextArrivalDate ?? 9
      const nextArrivalValue = row[nextArrivalCol]
      let nextArrivalDate: Date | null = null

      if (nextArrivalValue !== undefined && nextArrivalValue !== null && nextArrivalValue !== '') {
        const dateStr = String(nextArrivalValue).trim()
        if (dateStr) {
          const parsedDate = this.parseDate(dateStr)
          if (parsedDate) {
            nextArrivalDate = parsedDate
          }
        }
      }

      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock,
        meterage,
        price: null,
        nextArrivalDate,
        comment,
      }

      fabrics.push(fabric)
    }

    console.log(`[AmetistParser] Парсинг завершен:`)
    console.log(`[AmetistParser]   Всего строк в файле: ${data.length}`)
    console.log(`[AmetistParser]   Пропущено по skipRows: ${skippedCount}`)
    console.log(`[AmetistParser]   Пропущено (нет коллекции): ${emptyCollectionCount}`)
    console.log(`[AmetistParser]   Пропущено (нет цвета): ${emptyColorCount}`)
    console.log(`[AmetistParser]   Обработано валидных строк: ${processedCount}`)
    console.log(`[AmetistParser]   Создано тканей: ${fabrics.length}`)
    
    if (fabrics.length !== processedCount) {
      console.log(`[AmetistParser] ⚠️ ВНИМАНИЕ: Обработано ${processedCount} строк, но создано только ${fabrics.length} тканей!`)
    }
    
    console.log(`[AmetistParser] Parsed ${fabrics.length} fabrics`)
    return fabrics
  }


  /**
   * Основной метод parse - получает письмо, валидирует и парсит
   */
  async parse(url: string): Promise<ParsedFabric[]> {
    // Игнорируем url, получаем письмо напрямую
    console.log(`[AmetistParser] Starting parse for ${this.supplierName}`)

    // Проверяем наличие правил, если их нет - создаем по умолчанию
    let rules = await this.loadRules()
    if (!rules) {
      console.log(`[AmetistParser] ⚠️ Правила парсинга не найдены. Создание правил по умолчанию...`)
      
      // Создаем правила по умолчанию для Аметиста
      const defaultRules: ParsingRules = {
        columnMappings: {
          collection: 2, // C = индекс 2
          color: 4, // E = индекс 4
          inStock: 6, // G = индекс 6
          meterage: 6, // G = индекс 6
          nextArrivalDate: 9, // J = индекс 9
        },
        skipRows: [1, 2], // Пропускаем строки 1 и 2 (служебная информация)
        headerRow: 2, // Строка 3 (индекс 2) содержит заголовки
        specialRules: {
          ametistColorPattern: true,
        },
      }
      
      await this.saveRules(defaultRules)
      console.log(`[AmetistParser] ✅ Правила по умолчанию сохранены`)
      rules = defaultRules
    }

    // Получаем последнее письмо с вложением
    const attachment = await this.fetchLatestEmailAttachment()

    if (!attachment) {
      throw new Error('No email attachments found. Please check email configuration and ensure emails exist in mailbox.')
    }

    // Валидация
    const isValid = await this.validate(attachment.content, attachment.filename)
    if (!isValid) {
      throw new Error(`Invalid attachment: ${attachment.filename}`)
    }

    // Парсинг
    return await this.parseFromBuffer(attachment.content, attachment.filename)
  }

  /**
   * Анализ файла (для совместимости с BaseParser)
   */
  async analyze(url: string): Promise<ParsingAnalysis> {
    // Получаем последнее письмо с вложением
    const attachment = await this.fetchLatestEmailAttachment()

    if (!attachment) {
      throw new Error('No email attachments found for analysis')
    }

    let excelBuffer: Buffer

    // Если это ZIP, распаковываем в память
    if (attachment.filename.endsWith('.zip') || attachment.filename.endsWith('.ZIP')) {
      const zip = new AdmZip(attachment.content)
      const zipEntries = zip.getEntries()
      const excelEntry = zipEntries.find(entry => 
        entry.entryName.endsWith('.xlsx') || entry.entryName.endsWith('.xls')
      )

      if (!excelEntry) {
        throw new Error('Excel file not found in ZIP archive')
      }

      excelBuffer = excelEntry.getData()
    } else {
      excelBuffer = attachment.content
    }

    const workbook = XLSX.read(excelBuffer, { type: 'buffer' })
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
      question: 'В какой колонке находится название коллекции? (C = 3)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 3 (C)',
    })

    questions.push({
      id: 'color-column',
      question: 'В какой колонке находится цвет? (E = 5)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 5 (E)',
    })

    questions.push({
      id: 'inStock-column',
      question: 'В какой колонке находится наличие/метраж? (G = 7)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 7 (G)',
    })

    questions.push({
      id: 'nextArrival-column',
      question: 'В какой колонке находится дата следующего прихода? (J = 10)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 10 (J)',
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

