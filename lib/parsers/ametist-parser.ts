import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import AdmZip from 'adm-zip'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from './base-parser'

export class AmetistParser extends BaseParser {
  /**
   * Проверяет, что Excel файл валиден и содержит нужные данные
   */
  async validateFile(filePath: string): Promise<boolean> {
    try {
      console.log(`[AmetistParser] Валидация файла: ${filePath}`)

      // Проверяем, является ли файл ZIP архивом
      let excelPath = filePath
      if (filePath.endsWith('.zip')) {
        excelPath = await this.extractZipFile(filePath)
      }

      if (!fs.existsSync(excelPath)) {
        console.log(`[AmetistParser] Файл не существует: ${excelPath}`)
        return false
      }

      // Проверяем размер файла
      const stats = fs.statSync(excelPath)
      if (stats.size === 0) {
        console.log(`[AmetistParser] Файл пустой: ${excelPath}`)
        return false
      }

      // Пытаемся загрузить Excel файл
      let workbook: XLSX.WorkBook
      try {
        const buffer = fs.readFileSync(excelPath)
        workbook = XLSX.read(buffer, { type: 'buffer' })
      } catch (error: any) {
        console.log(`[AmetistParser] Не удалось загрузить Excel файл: ${error.message}`)
        return false
      }

      // Проверяем, что есть хотя бы одна вкладка
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        console.log(`[AmetistParser] Файл не содержит вкладок`)
        return false
      }

      // Проверяем, что хотя бы одна вкладка содержит данные
      let hasData = false
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName]
        if (!worksheet) continue
        
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
        // Проверяем, что есть хотя бы 2 строки с данными (заголовок + данные)
        if (data.length >= 2) {
          hasData = true
          break
        }
      }

      if (!hasData) {
        console.log(`[AmetistParser] Файл не содержит данных`)
        return false
      }

      console.log(`[AmetistParser] Файл валиден`)
      return true
    } catch (error: any) {
      console.log(`[AmetistParser] Ошибка валидации: ${error.message}`)
      return false
    }
  }

  /**
   * Распаковывает ZIP архив и находит Excel файл
   */
  private async extractZipFile(zipPath: string): Promise<string> {
    const zip = new AdmZip(zipPath)
    const extractPath = path.join(path.dirname(zipPath), 'extracted')
    
    // Создаем папку для распаковки
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true })
    }

    // Распаковываем архив
    zip.extractAllTo(extractPath, true)

    // Ищем Excel файл в распакованных файлах
    const files = fs.readdirSync(extractPath)
    const excelFile = files.find(file => 
      file.endsWith('.xlsx') || file.endsWith('.xls')
    )

    if (!excelFile) {
      throw new Error('Excel файл не найден в ZIP архиве')
    }

    const excelPath = path.join(extractPath, excelFile)
    console.log(`[AmetistParser] Найден Excel файл в архиве: ${excelPath}`)
    
    return excelPath
  }

  async parse(filePath: string): Promise<ParsedFabric[]> {
    const rules = await this.loadRules()
    if (!rules) {
      throw new Error('Правила парсинга не установлены. Сначала проведите анализ.')
    }

    // Проверяем, является ли файл ZIP архивом
    let excelPath = filePath
    if (filePath.endsWith('.zip')) {
      excelPath = await this.extractZipFile(filePath)
    }

    // Загружаем Excel файл
    const buffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
    // Используем первую вкладку
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    // Используем raw: true для получения точных значений ячеек (включая строки с запятыми)
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: true }) as any[][]
    
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

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1

      // Пропускаем строки согласно правилам
      if (rules.skipRows?.includes(rowNumber)) {
        continue
      }

      // Колонка C (индекс 2) - коллекция
      const collectionCol = rules.columnMappings.collection ?? 2
      const collection = row[collectionCol]?.toString().trim() || ''

      if (!collection) continue

      // Колонка E (индекс 4) - цвет
      const colorCol = rules.columnMappings.color ?? 4
      let color = row[colorCol]?.toString().trim() || ''

      // Логируем исходные значения для отладки
      console.log(`[AmetistParser] Строка ${rowNumber}: коллекция="${collection}", цвет (до обработки)="${color}"`)

      // Если первое слово цвета совпадает с коллекцией, оставляем весь цвет как есть
      // (например, "BYORK latte" остается "BYORK latte", а не "latte")
      // Это позволяет сохранить полное название цвета, если оно включает название коллекции
      // Если нужно удалить префикс, это можно настроить через правила парсинга
      
      if (!color) continue

      // Колонка G (индекс 6) - метраж (точные значения)
      // Используем правила из базы данных, если они есть, иначе по умолчанию индекс 6
      const meterageCol = rules.columnMappings.meterage ?? rules.columnMappings.inStock ?? 6
      const meterageValue = row[meterageCol]

      let meterage: number | null = null
      let inStock: boolean | null = null
      let comment: string | null = null

      // Парсим значение метража из ячейки столбца G (индекс 6)
      // Также проверяем следующую колонку (H, индекс 7) на случай, если там единица измерения "м"
      if (meterageValue !== undefined && meterageValue !== null && meterageValue !== '') {
        // Логируем исходное значение для отладки
        console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": значение из столбца ${meterageCol} (${String.fromCharCode(65 + meterageCol)}) типа ${typeof meterageValue} = ${meterageValue}`)
        
        let numValue: number | null = null
        
        // Если значение уже число, используем его напрямую
        if (typeof meterageValue === 'number') {
          if (!isNaN(meterageValue) && meterageValue > 0) {
            numValue = meterageValue
          }
        } else {
          // Если значение строка, парсим её
          let valueStr = String(meterageValue).trim()
          
          // Проверяем следующую колонку (H, индекс 7) на наличие единицы измерения "м"
          // Если в текущей ячейке только число, а в следующей "м", объединяем их
          if (row[meterageCol + 1] && String(row[meterageCol + 1]).trim().toLowerCase() === 'м') {
            // Единица измерения в следующей колонке, используем только текущее значение
            console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": единица измерения "м" найдена в следующей колонке`)
          } else if (valueStr.toLowerCase().endsWith('м')) {
            // Единица измерения в той же ячейке, убираем её
            valueStr = valueStr.replace(/м\s*$/i, '').trim()
          }
          
          console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": парсим значение "${valueStr}"`)
          
          // Убираем знаки > и < для извлечения числа
          const cleanedStr = valueStr.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()
          
          // Сначала ищем число с десятичной частью (76,4 или 76.4)
          const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
          if (decimalMatch) {
            const wholePart = decimalMatch[1]
            const decimalPart = decimalMatch[2]
            const extractedStr = `${wholePart}.${decimalPart}`
            numValue = parseFloat(extractedStr)
            console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": найдено число с десятичной частью = ${numValue} (из "${valueStr}")`)
          } else {
            // Если нет десятичной части, пробуем распарсить всю строку как число
            // Убираем пробелы, заменяем запятую на точку
            let normalizedStr = cleanedStr.replace(/\s+/g, '').replace(/,/g, '.')
            numValue = parseFloat(normalizedStr)
            
            // Если не удалось, ищем первое целое число в строке
            if (isNaN(numValue) || numValue === 0) {
              const integerMatch = cleanedStr.match(/(\d+)/)
              if (integerMatch) {
                numValue = parseFloat(integerMatch[1])
                console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": найдено целое число = ${numValue} (из "${valueStr}")`)
              }
            }
          }
        }
        
        // Если нашли число, определяем наличие и комментарий
        if (numValue !== null && !isNaN(numValue) && numValue > 0) {
          meterage = numValue // Сохраняем точное значение без округления
          inStock = true
          
          // Если число меньше 10, добавляем комментарий
          if (numValue < 10) {
            comment = 'ВНИМАНИЕ, МАЛО!'
          }
          
          console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": метраж = ${meterage}, в наличии = ${inStock}, комментарий = ${comment || 'нет'}`)
        } else {
          // Если не удалось извлечь число, проверяем текстовые значения
          const valueStr = String(meterageValue).trim().toLowerCase()
          if (valueStr.includes('нет') || valueStr.includes('не в наличии')) {
            inStock = false
            console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": нет в наличии (текстовое значение)`)
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

      // Логируем финальное значение для отладки
      if (collection.toLowerCase().includes('retro') && color.toLowerCase().includes('organza')) {
        console.log(`[AmetistParser] ФИНАЛЬНОЕ значение для RETRO organza blue: метраж = ${meterage}, в наличии = ${inStock}, комментарий = ${comment}`)
        console.log(`[AmetistParser] Полная строка данных:`, row)
        console.log(`[AmetistParser] Значение колонки H (7):`, row[7])
      }

      fabrics.push(fabric)
    }

    // Удаляем временные файлы после парсинга
    if (filePath.endsWith('.zip') && excelPath !== filePath) {
      try {
        const extractPath = path.dirname(excelPath)
        if (fs.existsSync(extractPath)) {
          fs.rmSync(extractPath, { recursive: true, force: true })
        }
      } catch (error) {
        console.warn(`[AmetistParser] Не удалось удалить временные файлы: ${error}`)
      }
    }

    return fabrics
  }

  async analyze(filePath: string): Promise<ParsingAnalysis> {
    // Проверяем, является ли файл ZIP архивом
    let excelPath = filePath
    if (filePath.endsWith('.zip')) {
      excelPath = await this.extractZipFile(filePath)
    }

    const buffer = fs.readFileSync(excelPath)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    
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

    // Удаляем временные файлы после анализа
    if (filePath.endsWith('.zip') && excelPath !== filePath) {
      try {
        const extractPath = path.dirname(excelPath)
        if (fs.existsSync(extractPath)) {
          fs.rmSync(extractPath, { recursive: true, force: true })
        }
      } catch (error) {
        console.warn(`[AmetistParser] Не удалось удалить временные файлы: ${error}`)
      }
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

