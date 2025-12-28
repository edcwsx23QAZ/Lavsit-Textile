/**
 * Тестовый скрипт для проверки парсинга метража в парсере Аметист
 */

// Симулируем логику парсинга метража
function testMeterageParsing(value: any, description: string) {
  console.log(`\n=== Тест: ${description} ===`)
  console.log(`Исходное значение: ${value} (тип: ${typeof value})`)
  
  let meterage: number | null = null
  let inStock: boolean | null = null
  let comment: string | null = null
  
  if (value !== undefined && value !== null && value !== '') {
    if (typeof value === 'number') {
      if (!isNaN(value) && value > 0) {
        meterage = value
        inStock = true
        if (value <= 20) {
          comment = 'ВНИМАНИЕ, МАЛО!'
        }
        console.log(`✅ Результат: метраж = ${meterage} (из числа)`)
      }
    } else {
      const valueStr = String(value).trim()
      console.log(`Парсим строку: "${valueStr}"`)
      
      // Ищем все числа с десятичной частью
      const allDecimalMatches = Array.from(valueStr.matchAll(/(\d+)[,.](\d+)/g))
      let bestMatch: { value: number; match: string } | null = null
      
      for (const match of allDecimalMatches) {
        const wholePart = match[1]
        const decimalPart = match[2]
        const extractedStr = `${wholePart}.${decimalPart}`
        const parsedValue = parseFloat(extractedStr)
        
        if (!isNaN(parsedValue) && parsedValue > 0) {
          if (!bestMatch || parsedValue < bestMatch.value || (parsedValue < 100 && bestMatch.value >= 100)) {
            bestMatch = { value: parsedValue, match: match[0] }
          }
        }
      }
      
      if (bestMatch) {
        meterage = bestMatch.value
        inStock = true
        if (bestMatch.value <= 20) {
          comment = 'ВНИМАНИЕ, МАЛО!'
        }
        console.log(`✅ Результат: метраж = ${meterage} (найдено "${bestMatch.match}")`)
      } else {
        // Пробуем найти целое число
        let normalizedStr = valueStr.replace(/\s+/g, '').replace(/,/g, '.')
        let numValue = parseFloat(normalizedStr)
        
        if (isNaN(numValue) || numValue === 0) {
          const integerMatch = valueStr.match(/(\d+)/)
          if (integerMatch) {
            numValue = parseFloat(integerMatch[1])
          }
        }
        
        if (!isNaN(numValue) && numValue > 0) {
          meterage = numValue
          inStock = true
          if (numValue <= 20) {
            comment = 'ВНИМАНИЕ, МАЛО!'
          }
          console.log(`✅ Результат: метраж = ${meterage} (целое число)`)
        } else {
          console.log(`❌ Результат: не удалось распарсить`)
        }
      }
    }
  }
  
  return { meterage, inStock, comment }
}

// Тестовые случаи
console.log('🧪 Тестирование парсинга метража для Аметист\n')

// Тест 1: Точное значение с запятой
testMeterageParsing('85,6', 'Точное значение с запятой')

// Тест 2: Точное значение с точкой
testMeterageParsing('85.6', 'Точное значение с точкой')

// Тест 3: Число из Excel (может быть прочитано как число)
testMeterageParsing(85.6, 'Число 85.6')

// Тест 4: Строка с несколькими числами (проблемный случай)
testMeterageParsing('85,6 есть в наличии 100', 'Строка с несколькими числами (85,6 и 100)')

// Тест 5: Строка с "есть в наличии 100" и "85,6"
testMeterageParsing('есть в наличии 100 85,6', 'Строка с "есть в наличии 100" и "85,6"')

// Тест 6: Только целое число
testMeterageParsing('100', 'Только целое число 100')

// Тест 7: Смешанный формат
testMeterageParsing('85,6 м в наличии', 'Смешанный формат с единицами')

console.log('\n✅ Тестирование завершено')

