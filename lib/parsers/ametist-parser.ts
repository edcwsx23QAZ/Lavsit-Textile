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
    // Также используем cellText: false, чтобы получить исходное значение ячейки
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

    for (let i = startRow; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1 // Номер строки в Excel (начиная с 1)

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
      // Используем правила из базы данных, если они есть, иначе по умолчанию индекс 6 (колонка G)
      // В колонке H (индекс 7) находится единица измерения "м"
      const meterageCol = rules.columnMappings.meterage ?? rules.columnMappings.inStock ?? 6
      
      // Получаем значение напрямую из ячейки для точности
      // Преобразуем индекс колонки в букву (6 -> G)
      const colLetter = String.fromCharCode(65 + meterageCol)
      const cellAddress = `${colLetter}${rowNumber}`
      const cell = worksheet[cellAddress]
      
      // ДЛЯ ОТЛАДКИ: Проверяем соседние строки для RETRO organza
      if (collection.toLowerCase().includes('retro') || color.toLowerCase().includes('organza') || color.toLowerCase().includes('retro')) {
        console.log(`[AmetistParser] ===== ПРОВЕРКА СОСЕДНИХ СТРОК для "${collection}" - "${color}" (строка ${rowNumber}) =====`)
        // Проверяем строку выше
        if (rowNumber > 1) {
          const prevCellAddress = `${colLetter}${rowNumber - 1}`
          const prevCell = worksheet[prevCellAddress]
          const prevRow = data[i - 1]
          console.log(`[AmetistParser] Строка выше (${rowNumber - 1}): ячейка ${prevCellAddress} = ${prevCell?.v} (cell.w = ${prevCell?.w}), row[${meterageCol}] = ${prevRow?.[meterageCol]}`)
        }
        // Проверяем текущую строку
        console.log(`[AmetistParser] Текущая строка (${rowNumber}): ячейка ${cellAddress} = ${cell?.v} (cell.w = ${cell?.w}), row[${meterageCol}] = ${row[meterageCol]}`)
        // Проверяем строку ниже
        if (i + 1 < data.length) {
          const nextCellAddress = `${colLetter}${rowNumber + 1}`
          const nextCell = worksheet[nextCellAddress]
          const nextRow = data[i + 1]
          console.log(`[AmetistParser] Строка ниже (${rowNumber + 1}): ячейка ${nextCellAddress} = ${nextCell?.v} (cell.w = ${nextCell?.w}), row[${meterageCol}] = ${nextRow?.[meterageCol]}`)
        }
        console.log(`[AmetistParser] ==========================================`)
      }
      
      // КРИТИЧНО: Приоритет - использовать cell.w (отформатированное строковое значение)
      // Это даст нам исходное значение с запятой "85,6", если оно было в файле
      // Excel может преобразовать "85,6" в число 85.6 или даже 100 (если запятая интерпретируется как разделитель тысяч)
      // cell.w содержит исходное отформатированное значение как строку
      let meterageValue: any = undefined
      
      if (cell) {
        // ПРИОРИТЕТ 1: Если есть cell.w (отформатированное строковое значение), используем его
        // Это даст нам исходную строку "85,6" даже если Excel преобразовал её в число
        if (cell.w !== undefined && typeof cell.w === 'string') {
          meterageValue = cell.w.trim()
          console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": используем cell.w = "${meterageValue}" (отформатированное строковое значение)`)
        } 
        // ПРИОРИТЕТ 2: Если cell.w нет или это не строка, используем cell.v (исходное значение)
        else if (cell.v !== undefined) {
          meterageValue = cell.v
          console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": используем cell.v = ${meterageValue} (исходное значение, тип: ${typeof meterageValue})`)
        }
      }
      
      // ПРИОРИТЕТ 3: Если не получили значение из ячейки, используем значение из массива
      if (meterageValue === undefined || meterageValue === null) {
        meterageValue = row[meterageCol]
        console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": используем row[${meterageCol}] = ${JSON.stringify(meterageValue)} (из массива)`)
      }

      let meterage: number | null = null
      let inStock: boolean | null = null
      let comment: string | null = null

      // Парсим значение метража из колонки G (индекс 6)
      // Единица измерения "м" находится в следующей колонке H (индекс 7)
      let valueToParse = meterageValue

      if (valueToParse !== undefined && valueToParse !== null && valueToParse !== '') {
        // Логируем исходное значение для отладки
        const cellInfo = cell ? ` (ячейка ${cellAddress}: v=${cell.v}, w=${cell.w}, t=${cell.t}, z=${cell.z})` : ' (ячейка не найдена)'
        console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": значение из столбца ${meterageCol} (${String.fromCharCode(65 + meterageCol)}) типа ${typeof valueToParse} = ${JSON.stringify(valueToParse)}${cellInfo}`)
        console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": row[${meterageCol}] = ${JSON.stringify(row[meterageCol])}, row[${meterageCol + 1}] = ${JSON.stringify(row[meterageCol + 1])}`)
        
        let numValue: number | null = null
        
        // Парсим значение в зависимости от его типа
        // Если это строка (особенно из cell.w), парсим её для извлечения числа с запятой
        if (typeof valueToParse === 'string') {
          // Парсим строковое значение
          let valueStr = String(valueToParse).trim()
          
          // Проверяем следующую колонку H (индекс 7) на наличие единицы измерения "м"
          // Если в текущей ячейке только число, а в следующей "м", используем текущее значение
          const nextCol = meterageCol + 1
          if (row[nextCol] && String(row[nextCol]).trim().toLowerCase() === 'м') {
            // Единица измерения в следующей колонке, используем только текущее значение
            console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": единица измерения "м" найдена в следующей колонке ${nextCol} (${String.fromCharCode(65 + nextCol)})`)
          } else if (valueStr.toLowerCase().endsWith('м')) {
            // Единица измерения в той же ячейке, убираем её
            valueStr = valueStr.replace(/м\s*$/i, '').trim()
          }
          
          console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": парсим значение "${valueStr}"`)
          
          // Убираем знаки > и < для извлечения числа
          const cleanedStr = valueStr.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()
          
          // КРИТИЧНО: Сначала ищем число с десятичной частью (85,6 или 85.6)
          // Это важно для правильного парсинга значений типа "85,6" из Excel
          // Excel может сохранять числа с запятой как строки
          const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
          if (decimalMatch) {
            const wholePart = decimalMatch[1]
            const decimalPart = decimalMatch[2]
            const extractedStr = `${wholePart}.${decimalPart}`
            numValue = parseFloat(extractedStr)
            console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": найдено число с десятичной частью = ${numValue} (из "${valueStr}", извлечено "${extractedStr}")`)
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
            } else {
              console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": распарсено как число = ${numValue} (из "${valueStr}", нормализовано "${normalizedStr}")`)
            }
          }
        } else if (typeof valueToParse === 'number') {
          // Если значение уже число, проверяем, не было ли оно неправильно интерпретировано
          // Например, "85,6" могло быть преобразовано в 100 (если запятая считалась разделителем тысяч)
          // В этом случае проверяем cell.w для получения исходной строки
          if (cell && cell.w && typeof cell.w === 'string') {
            // Есть строковое представление - используем его для парсинга
            const formattedStr = cell.w.trim()
            console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": число ${valueToParse}, но cell.w = "${formattedStr}", парсим как строку`)
            
            // Парсим строку заново
            let valueStr = formattedStr.replace(/м\s*$/i, '').trim()
            const cleanedStr = valueStr.replace(/^[<>≤≥]+|[<>]+$/g, '').trim()
            const decimalMatch = cleanedStr.match(/(\d+)[,.](\d+)/)
            if (decimalMatch) {
              const wholePart = decimalMatch[1]
              const decimalPart = decimalMatch[2]
              const extractedStr = `${wholePart}.${decimalPart}`
              numValue = parseFloat(extractedStr)
              console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": из cell.w найдено число с десятичной частью = ${numValue} (из "${formattedStr}")`)
            } else {
              // Если не нашли десятичную часть, используем исходное число
              numValue = valueToParse
              console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": используем исходное числовое значение = ${numValue}`)
            }
          } else if (!isNaN(valueToParse) && valueToParse > 0) {
            // Нет строкового представления, используем число напрямую
            numValue = valueToParse
            const nextColValue = row[meterageCol + 1]
            if (nextColValue && String(nextColValue).trim().toLowerCase() === 'м') {
              console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": числовое значение = ${numValue} (единица измерения в следующей колонке)`)
            } else {
              console.log(`[AmetistParser] Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": числовое значение = ${numValue}`)
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
          const valueStr = String(valueToParse).trim().toLowerCase()
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
      if (collection.toLowerCase().includes('retro') || color.toLowerCase().includes('organza') || color.toLowerCase().includes('retro')) {
        console.log(`[AmetistParser] ===== ОТЛАДКА для "${collection}" - "${color}" (строка ${rowNumber}) =====`)
        console.log(`[AmetistParser] ФИНАЛЬНОЕ значение перед сохранением в массив: метраж = ${meterage}, в наличии = ${inStock}, комментарий = ${comment || 'нет'}`)
        console.log(`[AmetistParser] Полная строка данных (первые 10 колонок):`, row.slice(0, 10))
        console.log(`[AmetistParser] Значение колонки G (6):`, row[6], `(тип: ${typeof row[6]})`)
        console.log(`[AmetistParser] Значение колонки H (7):`, row[7], `(тип: ${typeof row[7]})`)
        console.log(`[AmetistParser] Использованная колонка для метража: ${meterageCol} (${String.fromCharCode(65 + meterageCol)})`)
        console.log(`[AmetistParser] Значение fabric.meterage перед push: ${fabric.meterage}`)
        console.log(`[AmetistParser] ==========================================`)
      }
      
      // Дополнительная проверка: логируем все строки с метражом около 100 или 85.6
      if (meterage !== null && (Math.abs(meterage - 100) < 1 || Math.abs(meterage - 85.6) < 1)) {
        console.log(`[AmetistParser] ВНИМАНИЕ: Строка ${rowNumber}, коллекция "${collection}", цвет "${color}": метраж = ${meterage} (близко к 100 или 85.6)`)
      }

      // Финальная проверка перед добавлением в массив
      if (collection.toLowerCase().includes('retro') || color.toLowerCase().includes('organza') || color.toLowerCase().includes('retro')) {
        console.log(`[AmetistParser] ПЕРЕД PUSH: fabric.meterage = ${fabric.meterage}, fabric.inStock = ${fabric.inStock}`)
      }
      
      fabrics.push(fabric)
      
      // Проверка после добавления
      if (collection.toLowerCase().includes('retro') || color.toLowerCase().includes('organza') || color.toLowerCase().includes('retro')) {
        const lastFabric = fabrics[fabrics.length - 1]
        console.log(`[AmetistParser] ПОСЛЕ PUSH: последняя ткань в массиве - meterage = ${lastFabric.meterage}, inStock = ${lastFabric.inStock}`)
      }
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

