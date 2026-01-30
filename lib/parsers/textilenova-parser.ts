import * as cheerio from 'cheerio'
import axios from 'axios'
import * as XLSX from 'xlsx'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class TextileNovaParser extends BaseParser {
  async parse(url: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    console.log(`[TextileNovaParser] Используем Cheerio для парсинга статического HTML`)
    console.log(`[TextileNovaParser] Загрузка страницы: ${url}`)

    // Загружаем HTML страницы с помощью axios
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000,
    })

    // Парсим HTML с помощью Cheerio
    const $ = cheerio.load(response.data)
    console.log('[TextileNovaParser] HTML успешно загружен и распарсен')

    // Ищем ссылку "Получить остатки" (она ведет на Google Sheets)
    console.log(`[TextileNovaParser] Поиск ссылки "Получить остатки"...`)
    
    let sheetUrl: string | null = null
    
    // Ищем все ссылки и проверяем их текст
    $('a').each((_, element) => {
      const $link = $(element)
      const text = $link.text().toLowerCase()
      if (text.includes('получить остатки') || text.includes('остатки')) {
        sheetUrl = $link.attr('href') || null
        // Если ссылка относительная, делаем её абсолютной
        if (sheetUrl && !sheetUrl.startsWith('http')) {
          try {
            const baseUrl = new URL(url)
            sheetUrl = new URL(sheetUrl, baseUrl.origin).href
          } catch (e) {
            console.warn(`[TextileNovaParser] Не удалось преобразовать относительную ссылку: ${sheetUrl}`)
          }
        }
        return false // Прерываем цикл
      }
    })

    if (!sheetUrl) {
      throw new Error('Ссылка "Получить остатки" не найдена на странице')
    }

    console.log(`[TextileNovaParser] Найдена ссылка на Google Sheets: ${sheetUrl}`)
    
    // Конвертируем ссылку на редактирование в ссылку на экспорт в Excel
    // Формат: https://docs.google.com/spreadsheets/d/{ID}/edit -> https://docs.google.com/spreadsheets/d/{ID}/export?format=xlsx
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!sheetIdMatch) {
      throw new Error('Не удалось извлечь ID таблицы из ссылки')
    }

    const sheetId = sheetIdMatch[1]
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}`
    
    console.log(`[TextileNovaParser] URL для экспорта: ${exportUrl}`)
    
    // Скачиваем Excel файл
    const excelResponse = await axios.get(exportUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    console.log(`[TextileNovaParser] Файл скачан, размер: ${excelResponse.data.length} байт`)

    // Парсим Excel файл
    const workbook = XLSX.read(excelResponse.data, { type: 'buffer' })
      
      // Используем первую вкладку
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
      
      console.log(`[TextileNovaParser] Excel загружен, вкладка: ${sheetName}, строк: ${data.length}`)

      // Парсим данные из Excel
      const rawFabrics: any[] = []
      let currentCollection = '' // Для отслеживания текущей коллекции
      
      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        if (row.length < 2) continue

        // Столбец A (индекс 0) - коллекция и цвет
        const collectionColor = row[0]?.toString().trim() || ''
        
        if (!collectionColor) continue

        // Пропускаем служебные строки
        if (collectionColor.toLowerCase().includes('больше') || 
            collectionColor.toLowerCase().includes('метров') ||
            collectionColor.toLowerCase().includes('м')) {
          continue
        }

        // Столбец B (индекс 1) - остатки
        // Обрабатываем только строки с данными в столбцах A и B
        const stockText = row[1]?.toString().trim() || ''
        
        // Если столбец B пуст, пропускаем строку (согласно требованиям: нужны данные в обоих столбцах)
        if (!stockText) {
          // Если в столбце A только название коллекции (без цифр), сохраняем как текущую коллекцию
          if (!/\d/.test(collectionColor)) {
            currentCollection = collectionColor
          }
          continue
        }

        // Пропускаем служебные строки в столбце B
        if (stockText.toLowerCase().includes('больше') || 
            stockText.toLowerCase().includes('метров') ||
            (stockText.toLowerCase().includes('м') && !stockText.includes('+'))) {
          continue
        }

        // Парсим наличие согласно требованиям:
        // "+" -> в наличии
        // "Ограничено" -> в наличии с комментарием "ВНИМАНИЕ, МАЛО!"
        // "НЕТ" -> нет в наличии
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
          // Если не распознано, пропускаем строку (требуются только известные статусы)
          continue
        }

        // Столбец C (индекс 2) - дата следующего поступления
        const arrivalValue = row[2]
        let nextArrivalDateStr: string | null = null

        if (arrivalValue !== undefined && arrivalValue !== null && arrivalValue !== '') {
          // Excel может возвращать даты как числа (серийные номера дат) или как строки
          if (typeof arrivalValue === 'number') {
            // Excel серийный номер даты (1 = 1900-01-01)
            // Конвертируем в дату
            const excelEpoch = new Date(1899, 11, 30) // Excel epoch: 30 декабря 1899
            const date = new Date(excelEpoch.getTime() + arrivalValue * 24 * 60 * 60 * 1000)
            // Проверяем валидность
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear()
              if (year >= 1900 && year <= 2100) {
                nextArrivalDateStr = date.toISOString().split('T')[0] // Формат YYYY-MM-DD
              }
            }
          } else {
            // Строковое значение
            const str = String(arrivalValue).trim()
            if (str && str !== '-' && str.toLowerCase() !== 'нет') {
              nextArrivalDateStr = str
            }
          }
        }

        // Формируем полное название: если collectionColor уже содержит название коллекции, используем его как есть
        // Иначе добавляем currentCollection только если collectionColor не является полным названием (не содержит пробел и цифру)
        let fullCollectionColor = collectionColor
        // Проверяем, является ли collectionColor полным названием (содержит пробел и цифру, например "Helena 07")
        const isFullName = /\s+\d/.test(collectionColor)
        if (currentCollection && !isFullName && !collectionColor.toLowerCase().startsWith(currentCollection.toLowerCase())) {
          fullCollectionColor = `${currentCollection} ${collectionColor}`.trim()
        }

        // Сохраняем данные для парсинга
        rawFabrics.push({
          collectionColor: fullCollectionColor,
          inStock,
          meterage: null,
          price: null,
          nextArrivalDateStr,
          comment,
        })
      }

      // Применяем парсинг коллекции и цвета на стороне сервера
      const parsedFabrics: ParsedFabric[] = rawFabrics
        .filter(fabric => {
          // Пропускаем заголовки и технические строки согласно правилам
          const rowIndex = rawFabrics.indexOf(fabric)
          if (rules.skipRows?.includes(rowIndex + 1)) {
            return false
          }
          
          // Пропускаем если это заголовок или подзаголовок
          if (rules.skipPatterns?.some(pattern => fabric.collectionColor.includes(pattern))) {
            return false
          }
          
          return true
        })
        .map(fabric => {
          const { collection, color } = this.parseCollectionAndColor(fabric.collectionColor, rules.specialRules)
          
          // Парсим дату из столбца C
          // Формат может быть: "20/02/26" (DD/MM/YY) или другие форматы
          let nextArrivalDate: Date | null = null
          if (fabric.nextArrivalDateStr) {
            // Пробуем разные форматы дат
            // Формат DD/MM/YY или DD/MM/YYYY
            const dateMatch = fabric.nextArrivalDateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/)
            if (dateMatch) {
              const day = parseInt(dateMatch[1])
              const month = parseInt(dateMatch[2]) - 1
              let year = parseInt(dateMatch[3])
              
              // Для 2-значного года: используем текущий год как ориентир
              // Если год меньше 30, считаем что это 20XX, иначе 19XX
              if (year < 100) {
                const currentYear = new Date().getFullYear()
                if (year <= 30) {
                  year = 2000 + year
                } else {
                  year = 1900 + year
                }
                // Если получившийся год в будущем более чем на 1 год, вероятно это прошлый век
                if (year > currentYear + 1) {
                  year = year - 100
                }
              }
              
              // Проверяем валидность даты перед созданием
              if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
                const date = new Date(year, month, day)
                // Дополнительная проверка валидности
                if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
                  nextArrivalDate = date
                }
              }
            } else {
              // Пробуем стандартный парсинг даты (для Excel серийных номеров и других форматов)
              const parsed = this.parseDate(fabric.nextArrivalDateStr)
              if (parsed) {
                nextArrivalDate = this.validateDate(parsed)
              }
            }
          }
          
          // Финальная валидация даты
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
    console.log(`[TextileNovaParser] Используем Cheerio для парсинга статического HTML`)
    console.log(`[TextileNovaParser] Анализ страницы: ${url}`)

    // Загружаем HTML страницы с помощью axios
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 30000,
    })

    // Парсим HTML с помощью Cheerio
    const $ = cheerio.load(response.data)
    console.log('[TextileNovaParser] HTML успешно загружен и распарсен')

    // Ищем ссылку на Google Sheets
    let sheetUrl: string | null = null
    
    // Ищем все ссылки и проверяем их текст
    $('a').each((_, element) => {
      const $link = $(element)
      const text = $link.text().toLowerCase()
      if (text.includes('получить остатки') || text.includes('остатки')) {
        sheetUrl = $link.attr('href') || null
        // Если ссылка относительная, делаем её абсолютной
        if (sheetUrl && !sheetUrl.startsWith('http')) {
          try {
            const baseUrl = new URL(url)
            sheetUrl = new URL(sheetUrl, baseUrl.origin).href
          } catch (e) {
            console.warn(`[TextileNovaParser] Не удалось преобразовать относительную ссылку: ${sheetUrl}`)
          }
        }
        return false // Прерываем цикл
      }
    })

    if (!sheetUrl) {
      throw new Error('Ссылка "Получить остатки" не найдена на странице')
    }

    // Извлекаем ID таблицы и скачиваем Excel
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!sheetIdMatch) {
      throw new Error('Не удалось извлечь ID таблицы из ссылки')
    }

    const sheetId = sheetIdMatch[1]
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}`
    
    // Скачиваем Excel файл
    const excelResponse = await axios.get(exportUrl, { 
      responseType: 'arraybuffer',
      timeout: 30000,
    })

    // Парсим Excel
    const workbook = XLSX.read(excelResponse.data, { type: 'buffer' })
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

      // Вопросы о колонках
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

