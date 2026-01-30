import axios from 'axios'
import * as cheerio from 'cheerio'
import { BaseParser, ParsedFabric, ParsingAnalysis } from './base-parser'

export class ViptextilParser extends BaseParser {
  private async parseOnVercel(url: string): Promise<ParsedFabric[]> {
    console.log(`[ViptextilParser] Начинаем парсинг по новой логике: ${url}`)
    
    try {
      // Загружаем HTML страницы через axios
      console.log(`[ViptextilParser] Загружаем страницу через axios...`)
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Cache-Control': 'max-age=0',
          'Referer': url,
        },
        timeout: 30000,
        maxRedirects: 5,
        validateStatus: function (status) {
          return status >= 200 && status < 400; // Принимаем редиректы
        },
      })

      // Парсим HTML с помощью cheerio
      const $ = cheerio.load(response.data)
      console.log(`[ViptextilParser] ✅ HTML загружен успешно, размер: ${response.data.length} символов`)

      // Находим таблицу
      const tables = $('table')
      console.log(`[ViptextilParser] 🔍 Поиск таблиц: найдено ${tables.length} таблиц на странице`)
      
      // Дополнительная диагностика структуры страницы
      if (tables.length === 0) {
        console.log(`[ViptextilParser] ⚠️ Таблицы не найдены, проверяем альтернативные структуры...`)
        const divsWithTables = $('div').filter((i, el) => {
          return $(el).find('table').length > 0
        })
        console.log(`[ViptextilParser] Найдено div-ов с таблицами внутри: ${divsWithTables.length}`)
        
        // Проверяем наличие элементов с данными
        const allRows = $('tr')
        console.log(`[ViptextilParser] Найдено tr элементов: ${allRows.length}`)
        
        const allCells = $('td, th')
        console.log(`[ViptextilParser] Найдено td/th элементов: ${allCells.length}`)
      }
      
      if (tables.length === 0) {
        // Попробуем найти таблицу другими способами
        console.log(`[ViptextilParser] Таблица не найдена, проверяем структуру HTML...`)
        const bodyText = $('body').text().substring(0, 500)
        console.log(`[ViptextilParser] Первые 500 символов body: ${bodyText}`)
        throw new Error('Таблица не найдена на странице')
      }

      // Проверяем каждую таблицу и выбираем ту, в которой больше всего строк
      let bestTable = tables.first()
      let maxRows = 0
      
      tables.each((index, tableEl) => {
        const rowCount = $(tableEl).find('tr').length
        console.log(`[ViptextilParser] Таблица ${index + 1}: ${rowCount} строк`)
        if (rowCount > maxRows) {
          maxRows = rowCount
          bestTable = $(tableEl)
        }
      })
      
      console.log(`[ViptextilParser] ✅ Используем таблицу с максимальным количеством строк: ${maxRows} строк`)
      const table = bestTable

      // Получаем текст таблицы как при копировании в Excel (с табуляцией между колонками)
      console.log(`[ViptextilParser] 📊 Извлекаем данные из таблицы...`)
      const textRows: string[] = []
      let rowCount = 0
      let skippedRows = 0

      table.find('tr').each((index, row) => {
        rowCount++
        const cells = $(row).find('td, th')
        const cellCount = cells.length
        
        // Логируем первые 200 строк полностью для диагностики
        if (index < 200) {
          const allCellTexts = cells.map((i, cell) => $(cell).text().trim()).get()
          console.log(`[ViptextilParser] Строка ${index + 1}: ${cellCount} ячеек -> [${allCellTexts.join(' | ')}]`)
        }
        
        if (cellCount >= 2) {
          // Получаем текст из первых двух ячеек
          const col1 = $(cells[0]).text().trim()
          const col2 = $(cells[1]).text().trim()
          
          // Объединяем с табуляцией (как в Excel)
          if (col1 || col2) {
            textRows.push(`${col1}\t${col2}`)
          } else {
            skippedRows++
          }
        } else {
          skippedRows++
        }
      })
      
      console.log(`[ViptextilParser] 📊 Результаты извлечения:`)
      console.log(`[ViptextilParser]   - Всего строк (tr): ${rowCount}`)
      console.log(`[ViptextilParser]   - Строк с 2+ ячейками: ${textRows.length}`)
      console.log(`[ViptextilParser]   - Пропущено строк: ${skippedRows}`)
      
      if (textRows.length === 0) {
        console.log(`[ViptextilParser] ❌ КРИТИЧЕСКАЯ ОШИБКА: Не удалось извлечь ни одной строки из таблицы!`)
        console.log(`[ViptextilParser] Проверьте структуру HTML таблицы`)
      }

      const tableText = textRows.join('\n')
      console.log(`[ViptextilParser] Получен текст таблицы, длина: ${tableText.length} символов, строк: ${textRows.length}`)

      // Парсим текст как таблицу Excel (разделитель - табуляция)
      const lines = tableText.split('\n').filter(line => line.trim().length > 0)
      console.log(`[ViptextilParser] Разделено на строк: ${lines.length}`)
      
      if (lines.length === 0) {
        console.log(`[ViptextilParser] ❌ ВНИМАНИЕ: Нет строк для обработки!`)
        console.log(`[ViptextilParser] Полный текст таблицы (первые 500 символов): "${tableText.substring(0, 500)}"`)
      }

      const fabrics: ParsedFabric[] = []
      let processedCount = 0
      let skippedCount = 0
      let skippedEmptyCol2 = 0
      let skippedHeaders = 0
      let skippedSingleWord = 0

      for (const line of lines) {
        // Разделяем строку на колонки по табуляции
        const columns = line.split('\t').map(col => col.trim())

        // Должно быть минимум 2 колонки
        if (columns.length < 2) {
          skippedCount++
          continue
        }

        const col1 = columns[0] // Коллекция и цвет
        const col2 = columns[1] // Наличие

        // КЛЮЧЕВАЯ ЛОГИКА: Если второй столбец пустой - игнорируем строку
        if (!col2 || col2.length === 0) {
          skippedCount++
          skippedEmptyCol2++
          continue
        }

        // Пропускаем заголовки и служебные строки
        const col1Lower = col1.toLowerCase()
        const col2Lower = col2.toLowerCase()
        
        const isHeader = col1Lower.includes('номенклатура') ||
            col1Lower.includes('итого') ||
            col1Lower.includes('остатки на:') ||
            col1Lower.includes('искусственная') ||
            col1Lower.includes('кожа иск') ||
            col1Lower === 'ткани' ||
            col1Lower === 'жакард' ||
            col1Lower === 'шенилл' ||
            col1Lower === 'остатки' ||
            col1Lower === 'компаньон' ||
            col1Lower === 'основа' ||
            col1Lower === ''
        
        // Пропускаем строки, где первая колонка содержит только название коллекции без цвета
        const isSingleWord = col1Lower && !col1.includes(' ') && col2Lower !== 'есть в наличии' && !col2Lower.includes('уточнять')
        
        if (isHeader || isSingleWord) {
          skippedCount++
          if (isHeader) skippedHeaders++
          if (isSingleWord) skippedSingleWord++
          continue
        }

        // Парсим коллекцию и цвет: первое слово - коллекция, остальное - цвет
        const parts = col1.split(/\s+/).filter(p => p.trim().length > 0)
        
        if (parts.length < 2) {
          // Если только одно слово, это заголовок коллекции, пропускаем
          skippedCount++
          continue
        }

        const collection = parts[0].trim()
        const color = parts.slice(1).join(' ').trim()

        // Проверяем, что есть и коллекция, и цвет
        if (!collection || !color || collection.length === 0 || color.length === 0) {
          skippedCount++
          continue
        }

        // Парсим наличие
        // Если во втором столбце написано "есть в наличии" - в наличии
        // Остальные значения означают "нет в наличии"
        const inStock = col2Lower.includes('есть в наличии')

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
        processedCount++
      }

      console.log(`[ViptextilParser] ИТОГО: обработано: ${processedCount}, пропущено: ${skippedCount}, добавлено тканей: ${fabrics.length}`)
      console.log(`[ViptextilParser] Детали пропуска: пустой col2: ${skippedEmptyCol2}, заголовки: ${skippedHeaders}, одно слово: ${skippedSingleWord}`)

      if (fabrics.length > 0) {
        console.log(`[ViptextilParser] Примеры найденных тканей (первые 10):`)
        fabrics.slice(0, 10).forEach((f, i) => {
          console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
        })
      }

      if (fabrics.length === 0) {
        console.log(`[ViptextilParser] ❌ ВНИМАНИЕ: Не найдено ни одной ткани!`)
        console.log(`[ViptextilParser] Первые 200 строк текста для диагностики:`)
        lines.slice(0, 200).forEach((line, i) => {
          console.log(`  ${i + 1}. "${line}"`)
        })
      }

      return fabrics
    } catch (error: any) {
      console.error(`[ViptextilParser] Ошибка при парсинге:`, error)
      throw new Error(`Ошибка парсинга Viptextil: ${error.message}`)
    }
  }

  private async analyzeOnVercel(url: string): Promise<ParsingAnalysis> {
    // Для анализа используем ту же логику, что и для парсинга
    const fabrics = await this.parse(url)
    
    const sampleData: any[] = []
    
    // Создаем примеры данных для анализа
    fabrics.slice(0, 20).forEach(fabric => {
      sampleData.push([`${fabric.collection} ${fabric.colorNumber}`, fabric.inStock ? 'есть в наличии' : 'нет в наличии'])
    })

    const questions: ParsingAnalysis['questions'] = [
      {
        id: 'collection-column',
        question: 'В какой колонке находится коллекция и цвет? (A = 1)',
        type: 'column',
        options: ['Колонка 1 (A)', 'Колонка 2 (B)'],
        default: 'Колонка 1 (A)',
      },
      {
        id: 'inStock-column',
        question: 'В какой колонке находится наличие? (B = 2)',
        type: 'column',
        options: ['Колонка 1 (A)', 'Колонка 2 (B)'],
        default: 'Колонка 2 (B)',
      },
    ]

    return {
      questions,
      sampleData,
      structure: {
        columns: 2,
        rows: sampleData.length,
      },
    }
  }

  async parse(url: string): Promise<ParsedFabric[]> {
    return await this.withFallback(
      async () => await this.parseOnVercel(url),
      async () => {
        const rules = await this.loadRules()
        if (!rules) {
          throw new Error('Правила парсинга не установлены')
        }
        const result = await this.callLocalParser('/parse', { url, rules })
        return result.map((f: any) => ({
          ...f,
          nextArrivalDate: f.nextArrivalDate ? new Date(f.nextArrivalDate) : null
        }))
      }
    )
  }

  async analyze(url: string): Promise<ParsingAnalysis> {
    return await this.withFallback(
      async () => await this.analyzeOnVercel(url),
      async () => await this.callLocalParser('/analyze', { url })
    )
  }
}
