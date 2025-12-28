import * as cheerio from 'cheerio'
import axios from 'axios'
import puppeteer from 'puppeteer'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class ViptextilParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    let rules: ParsingRules | null = null
    try {
      rules = await this.loadRules()
    } catch (error) {
      console.log(`[ViptextilParser] Не удалось загрузить правила из БД, используем дефолтные: ${error}`)
    }
    
    const defaultRules: ParsingRules = {
      columnMappings: {
        collection: 0,
        inStock: 1,
      },
      skipRows: [],
      skipPatterns: [
        'ИСКУССТВЕННАЯ КОЖА',
        'Кожа иск',
        'Кожа иск.',
        'ТКАНИ',
        'Жаккард',
        'Шенилл',
        'Шенилл (рас)',
        'Компаньон',
        'Основа',
        'Остатки',
        'Итого',
        'Номенклатура',
      ],
      specialRules: {
        viptextilPattern: true,
      },
    }
    
    const activeRules = rules || defaultRules
    console.log(`[ViptextilParser] Используются правила: ${rules ? 'из БД' : 'дефолтные'}`)

    // Пробуем сначала через axios, если не получается - используем Puppeteer
    let html: string
    try {
      console.log(`[ViptextilParser] Пробуем загрузить через axios...`)
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'http://tgn1.viptextil.ru/',
        },
        timeout: 30000,
      })
      html = response.data
      console.log(`[ViptextilParser] ✓ HTML загружен через axios`)
    } catch (axiosError: any) {
      if (axiosError.response?.status === 403 || axiosError.code === 'ECONNREFUSED') {
        console.log(`[ViptextilParser] Ошибка 403 при загрузке через axios, пробуем через Puppeteer...`)
        // Используем Puppeteer для обхода блокировки
        const browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-extensions',
            '--disable-plugins',
          ],
        })
        try {
          const page = await browser.newPage()
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
          await page.setViewport({ width: 1920, height: 1080 })
          
          // Отключаем блокировку запросов и добавляем дополнительные заголовки
          await page.setExtraHTTPHeaders({
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'http://tgn1.viptextil.ru/',
          })
          
          // ВАЖНО: Отключаем request interception, чтобы избежать ERR_BLOCKED_BY_CLIENT
          // Вместо этого используем прямую загрузку
          try {
            console.log(`[ViptextilParser] Пробуем загрузить страницу через Puppeteer...`)
            await page.goto(url, { 
              waitUntil: 'domcontentloaded', 
              timeout: 30000,
              // Отключаем блокировку рекламы и других расширений
            })
            
            // Ждем немного, чтобы страница полностью загрузилась
            await page.waitForTimeout(2000)
            
            html = await page.content()
            console.log(`[ViptextilParser] ✓ HTML загружен через Puppeteer, длина: ${html.length} символов`)
          } catch (gotoError: any) {
            // Если получили ERR_BLOCKED_BY_CLIENT, пробуем другой подход
            if (gotoError.message?.includes('ERR_BLOCKED_BY_CLIENT') || gotoError.message?.includes('blocked')) {
              console.log(`[ViptextilParser] Обнаружена блокировка, пробуем альтернативный метод...`)
              
              // Пробуем использовать evaluate для получения HTML через JavaScript
              try {
                html = await page.evaluate(async () => {
                  const response = await fetch(window.location.href, {
                    headers: {
                      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                      'Accept-Language': 'ru-RU,ru;q=0.9',
                    }
                  })
                  return await response.text()
                })
                console.log(`[ViptextilParser] ✓ HTML получен через evaluate, длина: ${html.length} символов`)
              } catch (evalError: any) {
                console.error(`[ViptextilParser] Ошибка при evaluate:`, evalError.message)
                // Если и это не сработало, пробуем получить HTML напрямую из DOM
                html = await page.evaluate(() => document.documentElement.outerHTML)
                console.log(`[ViptextilParser] ✓ HTML получен из DOM, длина: ${html.length} символов`)
              }
            } else {
              throw gotoError
            }
          }
        } catch (puppeteerError: any) {
          console.error(`[ViptextilParser] Ошибка при использовании Puppeteer:`, puppeteerError.message)
          // Если Puppeteer не сработал, пробуем использовать curl через child_process
          console.log(`[ViptextilParser] Пробуем использовать curl как последний вариант...`)
          const { exec } = await import('child_process')
          const { promisify } = await import('util')
          const execAsync = promisify(exec)
          
          try {
            // Используем curl для загрузки HTML
            const { stdout } = await execAsync(`curl -L -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" -H "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" "${url}"`)
            html = stdout
            console.log(`[ViptextilParser] ✓ HTML загружен через curl, длина: ${html.length} символов`)
          } catch (curlError: any) {
            console.error(`[ViptextilParser] Ошибка при использовании curl:`, curlError.message)
            throw new Error(`Не удалось загрузить HTML страницу Viptextil. Ошибки: axios (${axiosError.message}), puppeteer (${puppeteerError.message}), curl (${curlError.message})`)
          }
        } finally {
          if (browser) {
            await browser.close()
          }
        }
      } else {
        throw axiosError
      }
    }
    
    const $ = cheerio.load(html)
    const fabrics: ParsedFabric[] = []

    const table = $('table').first()
    if (table.length === 0) {
      throw new Error('Таблица не найдена на странице')
    }

    let processedCount = 0
    let skippedCount = 0
    let addedCount = 0
    const examples: ParsedFabric[] = []
    
    // Проходим по всем строкам таблицы
    table.find('tr').each((index, row) => {
      const rowIndex = index + 1
      const cells = $(row).find('td, th')
      
      // Нужно минимум 2 ячейки
      if (cells.length < 2) {
        skippedCount++
        return
      }

      // Получаем текст из ячеек
      const col1 = $(cells[0]).text().trim()
      const col2 = $(cells[1]).text().trim()
      
      // Пропускаем полностью пустые строки
      if (!col1 && !col2) {
        skippedCount++
        return
      }
      
      const col1Lower = col1.toLowerCase()
      const col2Lower = col2.toLowerCase()
      
      // Пропускаем заголовки таблицы
      if (col1Lower.includes('номенклатура') || 
          col1Lower.includes('итого') ||
          col1Lower.includes('остатки на:')) {
        skippedCount++
        return
      }
      
      // Пропускаем заголовки разделов
      if (col1Lower.includes('искусственная') ||
          col1Lower.includes('кожа иск') ||
          col1Lower === 'ткани' ||
          col1Lower === 'жакард' ||
          col1Lower === 'шенилл' ||
          col1Lower === 'остатки' ||
          col1Lower === 'итого' ||
          col1Lower === 'компаньон' ||
          col1Lower === 'основа') {
        skippedCount++
        return
      }
      
      // КЛЮЧЕВАЯ ЛОГИКА: Если вторая колонка пуста - это заголовок коллекции, пропускаем
      // Если вторая колонка НЕ пуста - это данные о ткани
      if (!col2 || col2.length === 0) {
        skippedCount++
        return
      }
      
      // Пропускаем строки где первая колонка пуста
      if (!col1 || col1.length === 0) {
        skippedCount++
        return
      }
      
      // Парсим коллекцию и цвет: первое слово - коллекция, остальное - цвет
      // Примеры: 
      // - "Pegas silk" -> коллекция: "Pegas", цвет: "silk"
      // - "Pegas silver" -> коллекция: "Pegas", цвет: "silver"
      // - "Boss mineral blue" -> коллекция: "Boss", цвет: "mineral blue"
      const parts = col1.split(/\s+/).filter(p => p.trim().length > 0)
      
      if (parts.length < 2) {
        // Если только одно слово, это заголовок коллекции, пропускаем
        skippedCount++
        return
      }
      
      const collection = parts[0].trim()
      const color = parts.slice(1).join(' ').trim()
      
      // Проверяем, что есть и коллекция, и цвет
      if (!collection || !color || collection.length === 0 || color.length === 0) {
        skippedCount++
        return
      }
      
      // Парсим наличие
      // Если напротив цвета есть надпись "есть в наличии" - в наличии
      // В остальных случаях (например "уточнять наличие по звонку") - не в наличии
      let inStock: boolean = false
      if (col2Lower.includes('есть в наличии')) {
        inStock = true
      }
      
      // Создаем объект ткани
      const fabric: ParsedFabric = {
        collection,
        colorNumber: color,
        inStock,
        meterage: null,
        price: null,
        nextArrivalDate: null,
        comment: inStock === false ? col2 : null,
      }
      
      fabrics.push(fabric)
      addedCount++
      processedCount++
      
      // Сохраняем примеры для логирования
      if (examples.length < 20) {
        examples.push(fabric)
      }
      
      // Специальная проверка на примеры из требования
      if (collection.toLowerCase() === 'pegas' && 
          (color.toLowerCase() === 'silk' || 
           color.toLowerCase() === 'silver' || 
           color.toLowerCase() === 'stone')) {
        console.log(`[ViptextilParser] ✅ НАЙДЕН ПРИМЕР: "${collection}" "${color}" - ${inStock ? 'В наличии' : 'Не в наличии'} (${col2})`)
      }
    })
    
    console.log(`[ViptextilParser] ИТОГО: обработано валидных строк: ${processedCount}, добавлено тканей: ${addedCount}, пропущено: ${skippedCount}`)
    
    if (examples.length > 0) {
      console.log(`[ViptextilParser] Примеры найденных тканей (первые ${Math.min(examples.length, 20)}):`)
      examples.forEach((f, i) => {
        console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
      })
    }
    
    if (addedCount === 0) {
      console.log(`[ViptextilParser] ❌ ВНИМАНИЕ: Не добавлено ни одной ткани!`)
      console.log(`[ViptextilParser] Обработано валидных строк: ${processedCount}, пропущено: ${skippedCount}`)
      
      // Дополнительная диагностика: показываем первые 30 строк
      console.log(`[ViptextilParser] Первые 30 строк таблицы для диагностики:`)
      table.find('tr').slice(0, 30).each((index, row) => {
        const cells = $(row).find('td, th')
        if (cells.length >= 2) {
          const col1 = $(cells[0]).text().trim()
          const col2 = $(cells[1]).text().trim()
          console.log(`  Строка ${index + 1}: "${col1}" | "${col2}"`)
        }
      })
    }

    return fabrics
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 30000,
    })
    const $ = cheerio.load(response.data)
    const questions: ParsingAnalysis['questions'] = []
    const sampleData: any[] = []

    const table = $('table').first()
    if (table.length === 0) {
      throw new Error('Таблица не найдена на странице')
    }

    // Собираем первые 50 строк для анализа
    table.find('tr').slice(0, 50).each((index, row) => {
      const cells = $(row).find('td, th')
      const rowData: string[] = []
      cells.each((_, cell) => {
        rowData.push($(cell).text().trim())
      })
      if (rowData.length > 0) {
        sampleData.push(rowData)
      }
    })

    const maxColumns = Math.max(...sampleData.map(row => row.length), 0)

    // Определяем заголовки
    let hasHeaders = false
    const firstRow = sampleData[0] || []
    
    hasHeaders = firstRow.some(cell => {
      const lower = cell.toLowerCase()
      return lower.includes('номенклатура') || 
             lower.includes('итого') ||
             (lower.includes('остатки') && lower.includes('на:'))
    })

    // Ищем строки с данными о тканях
    let dataRowIndex = -1
    for (let i = 0; i < sampleData.length; i++) {
      const row = sampleData[i]
      if (row.length >= 2) {
        const col1 = row[0]?.trim() || ''
        const col2 = row[1]?.trim() || ''
        
        if (!col1 || !col2) continue
        
        const col1Lower = col1.toLowerCase()
        if (col1Lower.includes('искусственная') ||
            col1Lower === 'ткани' ||
            col1Lower === 'жакард' ||
            col1Lower === 'шенилл' ||
            col1Lower === 'остатки' ||
            col1Lower === 'итого') {
          continue
        }
        
        const parts = col1.split(/\s+/).filter(p => p.trim().length > 0)
        if (parts.length >= 2) {
          const col2Lower = col2.toLowerCase()
          if (col2Lower.includes('есть в наличии') || col2Lower.includes('уточнять')) {
            dataRowIndex = i
            break
          }
        }
      }
    }

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
      question: 'В какой колонке находится наличие? (B = 2)',
      type: 'column',
      options: Array.from({ length: maxColumns }, (_, i) => `Колонка ${i + 1} (${String.fromCharCode(65 + i)})`),
      default: 'Колонка 2 (B)',
    })

    if (dataRowIndex >= 0 && dataRowIndex < sampleData.length) {
      const dataRow = sampleData[dataRowIndex]
      console.log(`[ViptextilParser analyze] Найдена строка с данными на позиции ${dataRowIndex + 1}:`, dataRow)
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
