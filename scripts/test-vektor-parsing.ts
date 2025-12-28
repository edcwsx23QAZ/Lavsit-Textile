import { VektorParser } from '../lib/parsers/vektor-parser'

const parser = new VektorParser('test', 'Vektor')

const testCases = [
  'КОЖ ЗАМ АВТО YW-0415-B2 BLACK ПЕРФ',
  'КОЖ ЗАМ GRIFON 01',
  'КОЖ ЗАМ HQ2029 02',
  'Ткань Aphrodite 07 Mocca',
  'NUOVO 9166 BLACK ГЛАДКАЯ',
]

const specialRules = {
  removeTkanPrefix: true,
  removeKozhZam: true,
  vektorPattern: true,
}

console.log('=== Тестирование парсинга коллекции и цвета ===\n')

testCases.forEach((text, idx) => {
  console.log(`Тест ${idx + 1}: "${text}"`)
  
  // Удаляем префиксы
  let trimmed = text.trim()
  if (specialRules.removeKozhZam) {
    trimmed = trimmed.replace(/КОЖ\s+ЗАМ\s+АВТО\s*/gi, '').trim()
    trimmed = trimmed.replace(/КОЖ\s+ЗАМ\s*/gi, '').trim()
  }
  if (specialRules.removeTkanPrefix) {
    trimmed = trimmed.replace(/^ткань\s+/i, '').trim()
  }
  
  console.log(`  После удаления префиксов: "${trimmed}"`)
  
  // Применяем vektorPattern
  if (specialRules.vektorPattern) {
    // Паттерн 1: Код-номер цвет описание с дефисом
    const codePatternWithDash = trimmed.match(/^([A-Z0-9-]+)-([A-Z0-9]+)\s+(.+)$/i)
    if (codePatternWithDash) {
      console.log(`  → Коллекция: "${codePatternWithDash[1]}", Цвет: "${codePatternWithDash[2]} ${codePatternWithDash[3]}"`)
      console.log('')
      return
    }
    
    // Паттерн 2: Код номер цвет описание без дефиса
    const codePatternNoDash = trimmed.match(/^([A-Z0-9-]+)\s+([A-Z]{1,3}\d+[A-Z0-9]*)\s+(.+)$/i)
    if (codePatternNoDash) {
      console.log(`  → Коллекция: "${codePatternNoDash[1]}", Цвет: "${codePatternNoDash[2]} ${codePatternNoDash[3]}"`)
      console.log('')
      return
    }
    
    // Паттерн 3: Название номер
    const namePattern = trimmed.match(/^([A-Za-zА-Яа-яЁё0-9]+)\s+(\d+.*)$/i)
    if (namePattern) {
      console.log(`  → Коллекция: "${namePattern[1]}", Цвет: "${namePattern[2]}"`)
      console.log('')
      return
    }
  }
  
  // Стандартный парсинг
  const match = trimmed.match(/^([A-Za-zА-Яа-яЁё\s]+?)\s*(\d+.*)$/)
  if (match) {
    console.log(`  → Коллекция: "${match[1].trim()}", Цвет: "${match[2].trim()}"`)
  } else {
    console.log(`  → Коллекция: "${trimmed}", Цвет: ""`)
  }
  console.log('')
})

