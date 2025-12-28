/**
 * Утилиты для нормализации цен к единому формату
 * Все цены приводятся к рублям (RUB)
 */

export interface NormalizedPrice {
  value: number // Цена в рублях
  currency: string // Исходная валюта
  originalValue: number // Исходное значение
}

/**
 * Нормализует цену к рублям
 * Поддерживает различные форматы: "1000 руб", "1000 ₽", "1000", "1 000", "1,000.50", "3 171,00р." и т.д.
 */
export function normalizePrice(priceValue: any): number | null {
  if (priceValue === null || priceValue === undefined) {
    return null
  }

  // Если это уже число
  if (typeof priceValue === 'number') {
    return priceValue > 0 ? priceValue : null
  }

  // Преобразуем в строку
  let priceStr = String(priceValue).trim()

  if (!priceStr || priceStr === '' || priceStr === '-') {
    return null
  }

  // Удаляем символы валют (но сохраняем точку и запятую для определения формата)
  priceStr = priceStr
    .replace(/[₽рубр]/gi, '') // Удаляем символы рублей (но не точку!)
    .replace(/[€eur]/gi, '') // Удаляем символы евро
    .replace(/[$usd]/gi, '') // Удаляем символы доллара
    .trim()

  // Определяем формат числа:
  // - Если есть и точка, и запятая: точка = разделитель тысяч, запятая = десятичный разделитель (европейский формат: "3.171,00")
  // - Если только запятая: запятая = десятичный разделитель, пробелы = разделители тысяч (российский формат: "3 171,00")
  // - Если только точка: точка = десятичный разделитель, пробелы или запятые = разделители тысяч (американский формат: "3,171.00" или "3 171.00")
  
  const hasComma = priceStr.includes(',')
  const hasDot = priceStr.includes('.')
  
  if (hasComma && hasDot) {
    // Европейский формат: "3.171,00" - точка = тысячи, запятая = десятичные
    // Определяем позиции: последний разделитель = десятичный
    const lastComma = priceStr.lastIndexOf(',')
    const lastDot = priceStr.lastIndexOf('.')
    
    if (lastComma > lastDot) {
      // Запятая последняя - это десятичный разделитель
      priceStr = priceStr.replace(/\./g, '') // Удаляем точки (разделители тысяч)
      priceStr = priceStr.replace(',', '.') // Заменяем запятую на точку
    } else {
      // Точка последняя - это десятичный разделитель
      priceStr = priceStr.replace(/,/g, '') // Удаляем запятые (разделители тысяч)
    }
  } else if (hasComma && !hasDot) {
    // Российский формат: "3 171,00" - пробелы = тысячи, запятая = десятичные
    priceStr = priceStr.replace(/\s+/g, '') // Удаляем пробелы (разделители тысяч)
    priceStr = priceStr.replace(',', '.') // Заменяем запятую на точку
  } else if (!hasComma && hasDot) {
    // Американский формат: "3,171.00" или "3 171.00"
    // Если есть запятые перед точкой - это разделители тысяч
    const dotIndex = priceStr.indexOf('.')
    const beforeDot = priceStr.substring(0, dotIndex)
    
    if (beforeDot.includes(',')) {
      // "3,171.00" - запятые = тысячи
      priceStr = priceStr.replace(/,/g, '')
    } else {
      // "3 171.00" - пробелы = тысячи
      priceStr = priceStr.replace(/\s+/g, '')
    }
  } else {
    // Только цифры и пробелы: "3 171" или "3171"
    priceStr = priceStr.replace(/\s+/g, '') // Удаляем пробелы
  }

  // Парсим число
  const parsed = parseFloat(priceStr)

  if (isNaN(parsed) || parsed <= 0) {
    return null
  }

  // Возвращаем цену в рублях (предполагаем, что исходная цена уже в рублях)
  // Если в будущем понадобится конвертация валют, можно добавить здесь
  return parsed
}

/**
 * Нормализует цену с информацией об исходной валюте
 */
export function normalizePriceWithCurrency(priceValue: any): NormalizedPrice | null {
  const normalized = normalizePrice(priceValue)
  
  if (normalized === null) {
    return null
  }

  // Определяем исходную валюту (по умолчанию рубли)
  let currency = 'RUB'
  const priceStr = String(priceValue).toLowerCase()
  
  if (priceStr.includes('€') || priceStr.includes('eur') || priceStr.includes('евро')) {
    currency = 'EUR'
  } else if (priceStr.includes('$') || priceStr.includes('usd') || priceStr.includes('доллар')) {
    currency = 'USD'
  }

  return {
    value: normalized,
    currency,
    originalValue: typeof priceValue === 'number' ? priceValue : parseFloat(String(priceValue).replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
  }
}

