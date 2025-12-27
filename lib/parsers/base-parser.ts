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
    
    // Правило для Нортекса: убираем "Ткань" и парсим "Collection Color"
    // Пример: "Ткань Aphrodite 07 Mocca" -> коллекция: "Aphrodite", цвет: "07 Mocca"
    if (specialRules?.nortexPattern || specialRules?.removeTkanPrefix) {
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

    // Стандартный парсинг: коллекция (буквы) + цвет (числа и остальное)
    const match = trimmed.match(/^([A-Za-zА-Яа-яЁё\s]+?)\s*(\d+.*)$/)
    if (match) {
      return {
        collection: match[1].trim(),
        color: match[2].trim(),
      }
    }

    // Если не найдено, возвращаем весь текст как коллекцию
    return {
      collection: trimmed,
      color: '',
    }
  }

  protected parseDate(dateStr: string | null | undefined): Date | null {
    if (!dateStr) return null
    
    const str = String(dateStr).trim()
    if (!str || str === '-' || str.toLowerCase() === 'нет') return null

    // Попытка парсинга различных форматов дат
    const date = new Date(str)
    if (!isNaN(date.getTime())) {
      return date
    }

    // Парсинг формата DD.MM.YYYY
    const ddmmyyyy = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
    if (ddmmyyyy) {
      const day = parseInt(ddmmyyyy[1])
      const month = parseInt(ddmmyyyy[2]) - 1
      const year = parseInt(ddmmyyyy[3])
      return new Date(year, month, day)
    }

    return null
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

