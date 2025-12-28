import { prisma } from '@/lib/prisma'

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
  columnMappings: {
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

export abstract class BaseParser {
  protected supplierId: string
  protected supplierName: string

  constructor(supplierId: string, supplierName: string) {
    this.supplierId = supplierId
    this.supplierName = supplierName
  }

  abstract parse(url: string): Promise<ParsedFabric[]>
  abstract analyze(url: string): Promise<ParsingAnalysis>
  
  protected async saveRules(rules: ParsingRules): Promise<void> {
    await prisma.parsingRule.upsert({
      where: { supplierId: this.supplierId },
      create: {
        supplierId: this.supplierId,
        rules: JSON.stringify(rules),
      },
      update: {
        rules: JSON.stringify(rules),
        updatedAt: new Date(),
      },
    })
  }

  protected async loadRules(): Promise<ParsingRules | null> {
    const rule = await prisma.parsingRule.findUnique({
      where: { supplierId: this.supplierId },
    })
    return rule ? JSON.parse(rule.rules) : null
  }

  protected async saveDataStructure(structure: any): Promise<void> {
    await prisma.dataStructure.upsert({
      where: { supplierId: this.supplierId },
      create: {
        supplierId: this.supplierId,
        structure: JSON.stringify(structure),
        lastCheckedAt: new Date(),
      },
      update: {
        structure: JSON.stringify(structure),
        lastCheckedAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  protected async compareStructure(newStructure: any): Promise<boolean> {
    const existing = await prisma.dataStructure.findUnique({
      where: { supplierId: this.supplierId },
    })
    
    if (!existing) return true
    
    const oldStructure = JSON.parse(existing.structure)
    return JSON.stringify(oldStructure) === JSON.stringify(newStructure)
  }

  protected parseCollectionAndColor(text: string, specialRules?: Record<string, any>): { collection: string; color: string } {
    if (!text || typeof text !== 'string') {
      return { collection: '', color: '' }
    }

    let trimmed = text.trim()
    
    // Убираем "Мебельная ткань" или "ткань мебельная" если указано в правилах
    if (specialRules?.removeFurnitureText) {
      trimmed = trimmed.replace(/мебельная\s+ткань\s*/gi, '').trim()
      trimmed = trimmed.replace(/ткань\s+мебельная\s*/gi, '').trim()
    }
    
    // Убираем кавычки если указано в правилах
    if (specialRules?.removeQuotes) {
      trimmed = trimmed.replace(/["'"]/g, '').trim()
    }
    
    // Специальное правило для Alfa 2303
    if (specialRules?.alfa2303Pattern) {
      const alfaMatch = trimmed.match(/^(Alfa\s+2303)\s+(.+)$/i)
      if (alfaMatch) {
        return {
          collection: alfaMatch[1],
          color: alfaMatch[2].trim(),
        }
      }
    }

    // Правило для Artvision: если есть тире, то первая часть - коллекция, вторая - цвет
    // Пример: Dinastia-01 -> Dinastia (коллекция), 01 (цвет)
    if (specialRules?.artvisionDashPattern) {
      const dashMatch = trimmed.match(/^(.+?)\s*-\s*(.+)$/)
      if (dashMatch) {
        return {
          collection: dashMatch[1].trim(),
          color: dashMatch[2].trim(),
        }
      }
    }

    // Правило для TextileData: убираем "_\" и извлекаем цвет только из цифр
    if (specialRules?.removeUnderscoreBackslash || specialRules?.colorOnlyNumbers) {
      if (specialRules?.removeUnderscoreBackslash) {
        trimmed = trimmed.replace(/_\\/g, '')
      }
      if (specialRules?.colorOnlyNumbers) {
        const colorMatch = trimmed.match(/(\d+)/)
        const color = colorMatch ? colorMatch[1] : ''
        const collection = trimmed.replace(/\d+/g, '').trim()
        if (collection && color) {
          return { collection, color }
        }
      }
    }
    
    // Правило для Vektor: удаление "КОЖ ЗАМ" и "КОЖ ЗАМ АВТО" (должно быть ПЕРЕД другими правилами)
    if (specialRules?.removeKozhZam) {
      trimmed = trimmed.replace(/КОЖ\s+ЗАМ\s+АВТО\s*/gi, '').trim()
      trimmed = trimmed.replace(/КОЖ\s+ЗАМ\s*/gi, '').trim()
    }

    // Правило для Vektor: после удаления "КОЖ ЗАМ" парсим по паттерну (должно быть ПЕРЕД nortexPattern)
    if (specialRules?.vektorPattern) {
      // Паттерн 1: Код-номер цвет описание с дефисом (например, "YW-0415-B2 BLACK ПЕРФ")
      const codePatternWithDash = trimmed.match(/^([A-Z0-9-]+)-([A-Z0-9]+)\s+(.+)$/i)
      if (codePatternWithDash) {
        return {
          collection: codePatternWithDash[1], // "YW-0415"
          color: `${codePatternWithDash[2]} ${codePatternWithDash[3]}`.trim(), // "B2 BLACK ПЕРФ"
        }
      }
      
      // Паттерн 2: Код номер цвет описание без дефиса (например, "YW-0415 B2 BLACK ПЕРФ" или "YW-0415 BR1 BROWN ГЛАДКАЯ")
      // Ищем паттерн: код с дефисом, затем пробел, затем буквы+цифры (1-3 буквы + цифры), затем остальное
      const codePatternNoDash = trimmed.match(/^([A-Z0-9-]+)\s+([A-Z]{1,3}\d+[A-Z0-9]*)\s+(.+)$/i)
      if (codePatternNoDash) {
        return {
          collection: codePatternNoDash[1], // "YW-0415"
          color: `${codePatternNoDash[2]} ${codePatternNoDash[3]}`.trim(), // "B2 BLACK ПЕРФ" или "BR1 BROWN ГЛАДКАЯ"
        }
      }
      
      // Паттерн 3: Название номер (например, "GRIFON 01" или "HQ2029 02")
      const namePattern = trimmed.match(/^([A-Za-zА-Яа-яЁё0-9]+)\s+(\d+.*)$/i)
      if (namePattern) {
        return {
          collection: namePattern[1], // "GRIFON" или "HQ2029"
          color: namePattern[2], // "01" или "02"
        }
      }
      
      // Если паттерны не сработали, используем стандартный парсинг
      // Но только если есть и буквы, и цифры
      if (/[A-Za-zА-Яа-яЁё]/.test(trimmed) && /\d/.test(trimmed)) {
        const match = trimmed.match(/^([A-Za-zА-Яа-яЁё0-9-]+?)\s*(\d+.*)$/)
        if (match) {
          return {
            collection: match[1].trim(),
            color: match[2].trim(),
          }
        }
      }
    }

    // Правило для Нортекса: убираем "Ткань" и парсим "Collection Color"
    // Пример: "Ткань Aphrodite 07 Mocca" -> коллекция: "Aphrodite", цвет: "07 Mocca"
    // ВАЖНО: Это правило НЕ должно срабатывать для Vektor (проверяем, что нет vektorPattern)
    if ((specialRules?.nortexPattern || specialRules?.removeTkanPrefix) && !specialRules?.vektorPattern) {
      // Игнорируем слово "ткань" в начале
      trimmed = trimmed.replace(/^ткань\s+/i, '').trim()
      
      // Первое слово - коллекция, остальное - цвет
      const parts = trimmed.split(/\s+/)
      if (parts.length > 0) {
        const collection = parts[0]
        const color = parts.slice(1).join(' ')
        if (collection) {
          return { collection, color }
        }
      }
    }

    // Правило для Tex.Group: первое слово - коллекция, цифры и остальное - цвет
    // Пример: "Fancy 123 Red" -> коллекция: "Fancy", цвет: "123 Red"
    if (specialRules?.texGroupPattern) {
      const parts = trimmed.split(/\s+/)
      if (parts.length > 0) {
        const firstWord = parts[0]
        const rest = parts.slice(1).join(' ')
        
        // Проверяем, что в остатке есть цифры
        if (rest && /\d/.test(rest)) {
          return {
            collection: firstWord,
            color: rest,
          }
        }
      }
    }

    // Правило для TextileNova: коллекция + номер цвета (применяется ПЕРЕД стандартным парсингом)
    // Пример: "Helena 01" -> коллекция: "Helena", цвет: "01"
    if (specialRules?.textilenovaPattern) {
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 2) {
        // Первое слово - коллекция, остальное - цвет
        const collection = parts[0]
        const color = parts.slice(1).join(' ')
        
        if (collection && color) {
          return {
            collection,
            color,
          }
        }
      }
    }

    // Правило для Viptextil: первое слово - коллекция, остальное - цвет (может быть не только цифры)
    // Пример: "Boss avocado" -> коллекция: "Boss", цвет: "avocado"
    // Пример: "Renaissance D4714 366032 com amber" -> коллекция: "Renaissance", цвет: "D4714 366032 com amber"
    if (specialRules?.viptextilPattern) {
      const parts = trimmed.split(/\s+/)
      if (parts.length >= 2) {
        // Первое слово - коллекция, остальное - цвет
        const collection = parts[0]
        const color = parts.slice(1).join(' ')
        
        if (collection && color) {
          return {
            collection,
            color,
          }
        }
      }
    }

    // Стандартный парсинг: коллекция (буквы) + цвет (числа и остальное)
    // Пример: "Helena 01" -> коллекция: "Helena", цвет: "01"
    // ВАЖНО: Это правило НЕ должно срабатывать для TextileNova (проверяем, что нет textilenovaPattern)
    if (!specialRules?.textilenovaPattern) {
      const match = trimmed.match(/^([A-Za-zА-Яа-яЁё\s]+?)\s+(\d+.*)$/)
      if (match) {
        return {
          collection: match[1].trim(),
          color: match[2].trim(),
        }
      }
    }

    // Если не найдено, возвращаем весь текст как коллекцию
    return {
      collection: trimmed,
      color: '',
    }
  }

  protected parseDate(dateStr: string | number | null | undefined): Date | null {
    if (dateStr === null || dateStr === undefined) return null
    
    // Если это число, возможно это Excel серийный номер даты
    if (typeof dateStr === 'number') {
      // Excel серийный номер даты (1 = 1900-01-01)
      // Конвертируем в дату
      const excelEpoch = new Date(1899, 11, 30) // Excel epoch: 30 декабря 1899
      const date = new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000)
      // Проверяем валидность
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear()
        if (year >= 1900 && year <= 2100) {
          return date
        }
      }
      return null
    }
    
    const str = String(dateStr).trim()
    if (!str || str === '-' || str.toLowerCase() === 'нет') return null

    // Попытка парсинга различных форматов дат
    const date = new Date(str)
    // Проверяем, что дата валидна и находится в разумных пределах (1900-2100)
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear()
      if (year >= 1900 && year <= 2100) {
        return date
      }
    }

    // Парсинг формата DD.MM.YYYY
    const ddmmyyyy = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1])
      const month = parseInt(ddmmyyyy[2]) - 1
      const year = parseInt(ddmmyyyy[3])
      
      // Проверяем валидность даты
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day)
        // Дополнительная проверка, что дата корректна (например, 31 февраля будет автоматически преобразована)
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date
        }
      }
    }

    // Парсинг формата DD/MM/YYYY
    const ddmmyyyySlash = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
    if (ddmmyyyySlash) {
      const day = parseInt(ddmmyyyySlash[1])
      const month = parseInt(ddmmyyyySlash[2]) - 1
      const year = parseInt(ddmmyyyySlash[3])
      
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day)
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date
        }
      }
    }

    // Парсинг формата YYYY-MM-DD
    const yyyymmdd = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1])
      const month = parseInt(yyyymmdd[2]) - 1
      const day = parseInt(yyyymmdd[3])
      
      if (year >= 1900 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day)
        if (date.getFullYear() === year && date.getMonth() === month && date.getDate() === day) {
          return date
        }
      }
    }

    return null
  }

  /**
   * Валидирует дату перед сохранением в базу данных
   */
  protected validateDate(date: Date | null | undefined): Date | null {
    if (!date) return null
    
    // Проверяем, что дата валидна
    if (isNaN(date.getTime())) {
      return null
    }
    
    // Проверяем, что дата находится в разумных пределах (1900-2100)
    const year = date.getFullYear()
    if (year < 1900 || year > 2100) {
      return null
    }
    
    return date
  }

  protected parseBoolean(value: string | null | undefined): boolean | null {
    if (!value) return null
    
    const str = String(value).trim().toLowerCase()
    
    if (str === 'есть' || str === 'да' || str === 'yes' || str === 'true' || str === '+' || str === 'много') {
      return true
    }
    
    if (str === 'нет' || str === 'no' || str === 'false' || str === '-' || str === 'мало') {
      return false
    }
    
    return null
  }

  protected parseNumber(value: string | number | null | undefined): number | null {
    if (value === null || value === undefined) return null
    
    if (typeof value === 'number') {
      return isNaN(value) ? null : value
    }
    
    const str = String(value).trim().replace(/,/g, '.')
    const num = parseFloat(str)
    return isNaN(num) ? null : num
  }
}

