import * as cheerio from 'cheerio'
import axios from 'axios'
import * as XLSX from 'xlsx'

export interface ParsedFabric {
  collection: string
  colorNumber: string
  inStock: boolean | null
  meterage: number | null
  price: number | null
  nextArrivalDate: Date | null
  comment: string | null
}

export interface ParsingAnalysis {
  questions: Array<{
    id: string
    question: string
    type: 'column' | 'row' | 'header' | 'skip'
    options?: string[]
    default?: string
  }>
  sampleData: any[]
  structure: {
    columns: number
    rows: number
    headers?: string[]
  }
}

export interface ParsingRules {
  columnMappings?: {
    collection?: number
    color?: number
    inStock?: number
    meterage?: number
    price?: number
    nextArrivalDate?: number
    comment?: number
  }
  skipRows?: number[]
  skipPatterns?: string[]
  headerRow?: number
  specialRules?: Record<string, any>
}

export class TextileNovaParser {
  private parseDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) {
        return date
      }
    } catch (e) {
      // Ignore
    }
    return null
  }

  private validateDate(date: Date | null): Date | null {
    if (!date) return null
    const year = date.getFullYear()
    if (year >= 1900 && year <= 2100) {
      return date
    }
    return null
  }

  private parseCollectionAndColor(text: string, specialRules?: Record<string, any>): { collection: string; color: string } {
    // Упрощенная логика парсинга коллекции и цвета
    const parts = text.trim().split(/\s+/)
    if (parts.length === 0) return { collection: '', color: '' }
    
    // Ищем цифры в тексте
    const colorMatch = text.match(/\d+/)
    if (colorMatch) {
      const colorIndex = text.indexOf(colorMatch[0])
      const collection = text.substring(0, colorIndex).trim()
      const color = colorMatch[0]
      return { collection, color }
    }
    
    // Если цифр нет, последнее слово - цвет, остальное - коллекция
    if (parts.length > 1) {
      const color = parts[parts.length - 1]
      const collection = parts.slice(0, -1).join(' ')
      return { collection, color }
    }
    
    return { collection: text, color: '' }
  }

  async parse(url: string, rules: ParsingRules): Promise<ParsedFabric[]> {
    console.log(`[TextileNovaParser] Загрузка страницы: ${url}`)

    if (!url || url.trim() === '') {
      throw new Error('URL не может быть пустым')
    }

    try {
      new URL(url)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      throw new Error(`Невалидный URL: ${url}. Ошибка: ${errorMessage}`)
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000,
    })

    const $ = cheerio.load(response.data)
    console.log('[TextileNovaParser] HTML успешно загружен и распарсен')

    let sheetUrl: string | null = null
    
    $('a').each((_, element) => {
      if (sheetUrl) return
      
      const $link = $(element)
      const text = $link.text().toLowerCase()
      if (text.includes('получить остатки') || text.includes('остатки')) {
        let href = $link.attr('href')
        if (!href) return
        
        if (href.startsWith('//')) {
          href = `https:${href}`
        } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
          try {
            const baseUrl = new URL(url)
            if (href.startsWith('/')) {
              href = `${baseUrl.origin}${href}`
            } else {
              href = new URL(href, baseUrl.href).href
            }
          } catch (e) {
            console.warn(`[TextileNovaParser] Не удалось преобразовать относительную ссылку: ${href}`, e)
            return
          }
        }
        
        try {
          new URL(href)
          sheetUrl = href
        } catch (e) {
          console.warn(`[TextileNovaParser] Невалидный URL после преобразования: ${href}`, e)
        }
      }
    })

    if (!sheetUrl) {
      throw new Error('Ссылка "Получить остатки" не найдена на странице')
    }

    console.log(`[TextileNovaParser] Найдена ссылка на Google Sheets: ${sheetUrl}`)
    
    const sheetIdMatch = (sheetUrl as string).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!sheetIdMatch) {
      throw new Error('Не удалось извлечь ID таблицы из ссылки')
    }

    const sheetId = sheetIdMatch[1]
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}`
    
    try {
      new URL(exportUrl)
    } catch (e) {
      throw new Error(`Невалидный URL для экспорта: ${exportUrl}`)
    }
    
    console.log(`[TextileNovaParser] URL для экспорта: ${exportUrl}`)
    
    const excelResponse = await axios.get(exportUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    console.log(`[TextileNovaParser] Файл скачан, размер: ${excelResponse.data.length} байт`)

    const workbook = XLSX.read(excelResponse.data, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    console.log(`[TextileNovaParser] Excel загружен, вкладка: ${sheetName}, строк: ${data.length}`)

    const rawFabrics: any[] = []
    let currentCollection = ''
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (row.length < 2) continue

      const collectionColor = row[0]?.toString().trim() || ''
      if (!collectionColor) continue

      if (collectionColor.toLowerCase().includes('больше') || 
          collectionColor.toLowerCase().includes('метров') ||
          collectionColor.toLowerCase().includes('м')) {
        continue
      }

      const stockText = row[1]?.toString().trim() || ''
      if (!stockText) {
        if (!/\d/.test(collectionColor)) {
          currentCollection = collectionColor
        }
        continue
      }

      if (stockText.toLowerCase().includes('больше') || 
          stockText.toLowerCase().includes('метров') ||
          (stockText.toLowerCase().includes('м') && !stockText.includes('+'))) {
        continue
      }

      let inStock: boolean | null = null
      let comment: string | null = null
      const stockLower = stockText.toLowerCase().trim()
      const stockUpper = stockText.toUpperCase().trim()

      if (stockText.includes('+')) {
        inStock = true
      } else if (stockLower.includes('ограничено') || stockLower.includes('ограниченно')) {
        inStock = true
        comment = 'ВНИМАНИЕ, МАЛО!'
      } else if (stockUpper === 'НЕТ' || stockLower === 'нет') {
        inStock = false
      } else {
        continue
      }

      const arrivalValue = row[2]
      let nextArrivalDateStr: string | null = null

      if (arrivalValue !== undefined && arrivalValue !== null && arrivalValue !== '') {
        if (typeof arrivalValue === 'number') {
          const excelEpoch = new Date(1899, 11, 30)
          const date = new Date(excelEpoch.getTime() + arrivalValue * 24 * 60 * 60 * 1000)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            if (year >= 1900 && year <= 2100) {
              nextArrivalDateStr = date.toISOString().split('T')[0]
            }
          }
        } else {
          const str = String(arrivalValue).trim()
          if (str && str !== '-' && str.toLowerCase() !== 'нет') {
            nextArrivalDateStr = str
          }
        }
      }

      let fullCollectionColor = collectionColor
      const isFullName = /\s+\d/.test(collectionColor)
      if (currentCollection && !isFullName && !collectionColor.toLowerCase().startsWith(currentCollection.toLowerCase())) {
        fullCollectionColor = `${currentCollection} ${collectionColor}`.trim()
      }

      rawFabrics.push({
        collectionColor: fullCollectionColor,
        inStock,
        meterage: null,
        price: null,
        nextArrivalDateStr,
        comment,
      })
    }

    const parsedFabrics: ParsedFabric[] = rawFabrics
      .filter(fabric => {
        const rowIndex = rawFabrics.indexOf(fabric)
        if (rules.skipRows?.includes(rowIndex + 1)) {
          return false
        }
        if (rules.skipPatterns?.some(pattern => fabric.collectionColor.includes(pattern))) {
          return false
        }
        return true
      })
      .map(fabric => {
        const { collection, color } = this.parseCollectionAndColor(fabric.collectionColor, rules.specialRules)
        
        let nextArrivalDate: Date | null = null
        if (fabric.nextArrivalDateStr) {
          const dateMatch = fabric.nextArrivalDateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/)
          if (dateMatch) {
            const day = parseInt(dateMatch[1])
            const month = parseInt(dateMatch[2]) - 1
            let year = parseInt(dateMatch[3])
            
            if (year < 100) {
              const currentYear = new Date().getFullYear()
              if (year <= 30) {
                year = 2000 + year
              } else {
                year = 1900 + year
              }
              if (year > currentYear + 1) {
                year = year - 100
              }
            }
            
            if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
              const date = new Date(year, month, day)
              if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                nextArrivalDate = date
              }
            }
          } else {
            const parsed = this.parseDate(fabric.nextArrivalDateStr)
            if (parsed) {
              nextArrivalDate = this.validateDate(parsed)
            }
          }
        }
        
        nextArrivalDate = this.validateDate(nextArrivalDate)
        
        return {
          collection,
          colorNumber: color,
          inStock: fabric.inStock,
          meterage: fabric.meterage,
          price: fabric.price,
          nextArrivalDate,
          comment: fabric.comment,
        }
      })
      .filter(fabric => fabric.collection || fabric.colorNumber)

    console.log(`[TextileNovaParser] Найдено тканей: ${parsedFabrics.length}`)
    return parsedFabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    console.log(`[TextileNovaParser] Анализ страницы: ${url}`)

    if (!url || url.trim() === '') {
      throw new Error('URL не может быть пустым')
    }

    try {
      new URL(url)
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e)
      throw new Error(`Невалидный URL: ${url}. Ошибка: ${errorMessage}`)
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000,
    })

    const $ = cheerio.load(response.data)
    console.log('[TextileNovaParser] HTML успешно загружен и распарсен')

    let sheetUrl: string | null = null
    
    $('a').each((_, element) => {
      if (sheetUrl) return
      
      const $link = $(element)
      const text = $link.text().toLowerCase()
      if (text.includes('получить остатки') || text.includes('остатки')) {
        let href = $link.attr('href')
        if (!href) return
        
        if (href.startsWith('//')) {
          href = `https:${href}`
        } else if (!href.startsWith('http://') && !href.startsWith('https://')) {
          try {
            const baseUrl = new URL(url)
            if (href.startsWith('/')) {
              href = `${baseUrl.origin}${href}`
            } else {
              href = new URL(href, baseUrl.href).href
            }
          } catch (e) {
            console.warn(`[TextileNovaParser] Не удалось преобразовать относительную ссылку: ${href}`, e)
            return
          }
        }
        
        try {
          new URL(href)
          sheetUrl = href
        } catch (e) {
          console.warn(`[TextileNovaParser] Невалидный URL после преобразования: ${href}`, e)
        }
      }
    })

    if (!sheetUrl) {
      throw new Error('Ссылка "Получить остатки" не найдена на странице')
    }

    const sheetIdMatch = (sheetUrl as string).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!sheetIdMatch) {
      throw new Error('Не удалось извлечь ID таблицы из ссылки')
    }

    const sheetId = sheetIdMatch[1]
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}`
    
    try {
      new URL(exportUrl)
    } catch (e) {
      throw new Error(`Невалидный URL для экспорта: ${exportUrl}`)
    }
    
    const excelResponse = await axios.get(exportUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    const workbook = XLSX.read(excelResponse.data, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    for (let i = 0; i < Math.min(15, data.length); i++) {
      sampleData.push(data[i] || [])
    }

    const maxColumns = Math.max(...sampleData.map(row => row.length), 0)

    const firstRow = sampleData[0] || []
    const hasHeaders = firstRow.some((cell: any) => 
      ['коллекция', 'цвет', 'наличие', 'остатки', 'дата'].some(keyword => 
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

    questions.push({
      id: 'collection-column',
      question: 'В какой колонке находится коллекция и цвет? (A = 1)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 1 (A)',
    })

    questions.push({
      id: 'inStock-column',
      question: 'В какой колонке находится наличие/остатки? (B = 2)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 2 (B)',
    })

    questions.push({
      id: 'nextArrival-column',
      question: 'В какой колонке находится дата следующего поступления? (C = 3)',
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

