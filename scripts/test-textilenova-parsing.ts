import { TextileNovaParser } from '../lib/parsers/textilenova-parser'

const parser = new TextileNovaParser('test', 'TextileNova')

const testCases = [
  'Helena 01',
  'Helena 03',
  'Mistral22 01',
  'Belen14 02',
]

const specialRules = {
  textilenovaPattern: true,
}

console.log('=== Тестирование парсинга коллекции и цвета для TextileNova ===\n')

testCases.forEach((text, idx) => {
  console.log(`Тест ${idx + 1}: "${text}"`)
  
  const trimmed = text.trim()
  
  // Применяем textilenovaPattern
  if (specialRules.textilenovaPattern) {
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 2) {
      const collection = parts[0]
      const color = parts.slice(1).join(' ')
      
      if (collection && color) {
        console.log(`  → Коллекция: "${collection}", Цвет: "${color}"`)
        console.log('')
        return
      }
    }
  }
  
  // Стандартный парсинг
  const match = trimmed.match(/^([A-Za-zА-Яа-яЁё\s]+?)\s+(\d+.*)$/)
  if (match) {
    console.log(`  → Коллекция: "${match[1].trim()}", Цвет: "${match[2].trim()}"`)
  } else {
    console.log(`  → Коллекция: "${trimmed}", Цвет: ""`)
  }
  console.log('')
})



