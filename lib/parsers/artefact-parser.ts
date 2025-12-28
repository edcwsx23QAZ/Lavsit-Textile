import axios from 'axios'
import * as cheerio from 'cheerio'
import * as XLSX from 'xlsx'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'
import { validateDate } from '@/lib/date-validation'

export class ArtefactParser extends BaseParser {
  /**
   * Находит ссылку на скачивание Excel файла на странице
   */
  private async findDownloadUrl(pageUrl: string): Promise<string> {
    const response = await axios.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })
    const $ = cheerio.load(response.data)
    
    // Ищем ссылку со словом "скачать" (case-insensitive)
    let downloadUrl: string | null = null
    
    $('a').each((_, element) => {
      const text = $(element).text().toLowerCase().trim()
      const href = $(element).attr('href')
      
      if (text.includes('скачать') && href) {
        // Если относительная ссылка, делаем абсолютной
        if (href.startsWith('http')) {
          downloadUrl = href
        } else {
          const baseUrl = new URL(pageUrl)
          downloadUrl = new URL(href, baseUrl.origin).href
        }
        return false // Прерываем цикл
      }
    })
    
    if (!downloadUrl) {
      throw new Error('Не найдена ссылка "скачать" на странице')
    }
    
    console.log(`[ArtefactParser] Найдена ссылка для скачивания: ${downloadUrl}`)
    return downloadUrl
  }

  /**
   * Парсит коллекцию и цвет из столбца B по правилам Artefact
   * Правила:
   * 1. Коллекция это все слова в ячейке B, идущие до цифр
   * 2. Если в ячейке B цифр нет, то коллекция это все слова, кроме последнего (тогда последнее слово - цвет)
   * 3. В остальных случаях цвет начинается с цифр или знака №
   */
  private parseCollectionAndColorArtefact(text: string): { collection: string; color: string } | null {
    const trimmed = text.trim()
    if (!trimmed) return null
    
    // Нормализуем пробелы (заменяем множественные пробелы на одинарные)
    const normalized = trimmed.replace(/\s+/g, ' ')
    
    // Ищем цифры в тексте
    const digitMatch = normalized.match(/\d/)
    const hasDigits = digitMatch !== null
    
    if (hasDigits) {
      // Если есть цифры: коллекция = все слова до цифр, цвет = цифры и все после
      // Пример: "Projekt BLACK 016133" -> коллекция: "Projekt BLACK", цвет: "016133"
      
      // Ищем первое вхождение цифры
      const firstDigitIndex = normalized.search(/\d/)
      if (firstDigitIndex > 0) {
        // Разделяем по первому вхождению цифры
        const collection = normalized.substring(0, firstDigitIndex).trim()
        const color = normalized.substring(firstDigitIndex).trim()
        
        // Проверяем, что коллекция не пуста
        if (collection) {
          return { collection, color }
        }
      }
      
      // Альтернативный вариант: ищем по паттерну "слово слово цифры"
      const match = normalized.match(/^(.+?)\s+(\d.*)$/)
      if (match) {
        const collection = match[1].trim()
        const color = match[2].trim()
        if (collection) {
          return { collection, color }
        }
      }
      
      // Альтернативный вариант: ищем знак №
      const noMatch = normalized.match(/^(.+?)\s*(№\s*.+)$/)
      if (noMatch) {
        return {
          collection: noMatch[1].trim(),
          color: noMatch[2].trim(),
        }
      }
    } else {
      // Если цифр нет: коллекция = все слова кроме последнего, последнее слово = цвет
      const parts = normalized.split(/\s+/).filter(p => p.trim().length > 0)
      if (parts.length >= 2) {
        const collection = parts.slice(0, -1).join(' ').trim()
        const color = parts[parts.length - 1].trim()
        return { collection, color }
      } else if (parts.length === 1) {
        // Если только одно слово, считаем его коллекцией, цвет пустой
        return { collection: parts[0], color: '' }
      }
    }
    
    return null
  }

  /**
   * Парсит метраж и наличие из столбца C
   */
  private parseMeterageAndStock(text: string): { meterage: number | null; inStock: boolean; comment: string | null } {
    const trimmed = String(text).trim().toLowerCase()
    
    if (trimmed === 'нет' || trimmed === '') {
      return {
        meterage: null,
        inStock: false,
        comment: null,
      }
    }
    
    if (trimmed === 'много') {
      return {
        meterage: null,
        inStock: true,
        comment: null,
      }
    }
    
    // Пытаемся распарсить число
    const numValue = parseFloat(trimmed.replace(',', '.'))
    if (!isNaN(numValue) && numValue > 0) {
      const inStock = true
      let comment: string | null = null
      
      if (numValue < 10) {
        comment = 'ВНИМАНИЕ, МАЛО!'
      }
      
      return {
        meterage: numValue,
        inStock,
        comment,
      }
    }
    
    // Если не удалось распарсить, считаем что не в наличии
    return {
      meterage: null,
      inStock: false,
      comment: trimmed,
    }
  }

  async parse(url: string): Promise<ParsedFabric[]> {
    let rules: ParsingRules | null = null
    try {
      rules = await this.loadRules()
    } catch (error) {
      console.log(`[ArtefactParser] Не удалось загрузить правила из БД, используем дефолтные: ${error}`)
    }
    
    const defaultRules: ParsingRules = {
      columnMappings: {
        collection: 0, // Столбец A (индекс 0) - коллекция и цвет
        meterage: 2,   // Столбец C (индекс 2) - метраж
        comment: 3,     // Столбец D (индекс 3) - комментарий
        nextArrivalDate: 5, // Столбец F (индекс 5) - дата поступления
      },
      skipRows: [],
      skipPatterns: [],
      specialRules: {
        artefactPattern: true,
      },
    }
    
    const activeRules = rules || defaultRules
    console.log(`[ArtefactParser] Используются правила: ${rules ? 'из БД' : 'дефолтные'}`)

    // Шаг 1: Находим ссылку для скачивания
    const downloadUrl = await this.findDownloadUrl(url)
    
    // Шаг 2: Скачиваем Excel файл
    console.log(`[ArtefactParser] Скачиваем файл: ${downloadUrl}`)
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    
    // Используем первую вкладку
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    console.log(`[ArtefactParser] Загружено строк: ${data.length}`)
    
    const fabrics: ParsedFabric[] = []
    let processedCount = 0
    let skippedCount = 0
    let addedCount = 0
    let stopParsing = false
    
    // Проходим по всем строкам
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1
      
      // Если уже встретили "3_Материалы сопутствующие", прекращаем парсинг
      if (stopParsing) {
        break
      }
      
      // Проверяем, не является ли это строкой "3_Материалы сопутствующие"
      const firstCell = String(row[0] || '').trim()
      if (firstCell === '3_Материалы сопутствующие' || firstCell.includes('3_Материалы сопутствующие')) {
        stopParsing = true
        console.log(`[ArtefactParser] Найдена строка "3_Материалы сопутствующие" на строке ${rowNumber}, прекращаем парсинг`)
        break
      }
      
      // Столбец A (индекс 0) - коллекция и цвет
      const colA = String(row[0] || '').trim()
      if (!colA) {
        skippedCount++
        continue
      }
      
      // Пропускаем заголовки
      const colALower = colA.toLowerCase()
      if (colALower === 'номенклатура' || 
          colALower.includes('артефакт') ||
          colALower.includes('москва') ||
          colALower.includes('www.artefakt')) {
        skippedCount++
        continue
      }
      
      // Пропускаем заголовки разделов (строки, которые заканчиваются на цифру с подчеркиванием в начале)
      if (colA.match(/^\d+_/)) {
        skippedCount++
        continue
      }
      
      // Столбец C (индекс 2) - метраж
      const colC = String(row[2] || '').trim()
      
      // Если столбец C пуст, игнорируем строку (по правилам)
      if (!colC || colC === '') {
        skippedCount++
        if (processedCount < 5) {
          console.log(`[ArtefactParser] Строка ${rowNumber} пропущена: столбец C пуст. A="${colA}", C="${colC}"`)
        }
        continue
      }
      
      processedCount++
      
      // Парсим коллекцию и цвет из столбца A
      const collectionColor = this.parseCollectionAndColorArtefact(colA)
      if (!collectionColor || !collectionColor.collection) {
        skippedCount++
        if (processedCount <= 5) {
          console.log(`[ArtefactParser] Строка ${rowNumber} пропущена: не удалось распарсить коллекцию и цвет. A="${colA}"`)
        }
        continue
      }
      
      // Логируем первые несколько успешно распарсенных строк
      if (addedCount < 5) {
        console.log(`[ArtefactParser] Строка ${rowNumber}: A="${colA}" -> коллекция="${collectionColor.collection}", цвет="${collectionColor.color}", C="${colC}"`)
      }
      
      // Парсим метраж и наличие из столбца C
      const { meterage, inStock, comment: meterageComment } = this.parseMeterageAndStock(colC)
      
      // Столбец D (индекс 3) - комментарий
      const colD = String(row[3] || '').trim()
      
      // Объединяем комментарии (если есть и из метража, и из столбца D)
      let finalComment: string | null = null
      if (meterageComment && colD) {
        finalComment = `${meterageComment}. ${colD}`
      } else if (meterageComment) {
        finalComment = meterageComment
      } else if (colD) {
        finalComment = colD
      }
      
      // Столбец F (индекс 5) - дата ближайшего поступления
      let nextArrivalDate: Date | null = null
      const colF = row[5]
      if (colF) {
        const parsedDate = this.parseDate(String(colF))
        if (parsedDate && validateDate(parsedDate)) {
          nextArrivalDate = parsedDate
        }
      }
      
      const fabric: ParsedFabric = {
        collection: collectionColor.collection,
        colorNumber: collectionColor.color || '',
        inStock,
        meterage,
        price: null,
        nextArrivalDate,
        comment: finalComment,
      }
      
      fabrics.push(fabric)
      addedCount++
      
      // Логируем примеры для отладки
      if (addedCount <= 10) {
        console.log(`[ArtefactParser] Пример ${addedCount}: "${fabric.collection}" "${fabric.colorNumber}" - ${fabric.inStock ? 'В наличии' : 'Не в наличии'} (метраж: ${fabric.meterage || 'N/A'})`)
      }
    }
    
    console.log(`[ArtefactParser] ИТОГО: обработано валидных строк: ${processedCount}, добавлено тканей: ${addedCount}, пропущено: ${skippedCount}`)
    
    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    // Находим ссылку для скачивания
    const downloadUrl = await this.findDownloadUrl(url)
    
    // Скачиваем Excel файл
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' })
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
    const hasHeaders = firstRow.some(cell => 
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
      id: 'meterage-column',
      question: 'В какой колонке находится метраж? (C = 3)',
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

