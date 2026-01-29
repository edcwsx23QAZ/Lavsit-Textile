/**
 * Автоматическая настройка правил парсинга для Аметиста
 * Использует DATABASE_URL из переменных окружения (для продакшн БД)
 */
import { PrismaClient } from '@prisma/client'

// Используем PrismaClient напрямую, чтобы использовать DATABASE_URL из env
const prisma = new PrismaClient()

import { AmetistParser } from '../lib/parsers/ametist-parser'
import { ParsingRules } from '../lib/parsers/base-parser'

async function setupAmetistRules() {
  try {
    console.log('🔧 Настройка правил парсинга для Аметиста...\n')

    // Находим поставщика Аметист
    const ametist = await prisma.supplier.findFirst({
      where: { name: 'Аметист' },
    })

    if (!ametist) {
      console.log('❌ Поставщик Аметист не найден')
      return
    }

    console.log(`✅ Аметист найден: ID = ${ametist.id}`)

    // Создаем парсер
    const parser = new AmetistParser(ametist.id, ametist.name)

    // Проверяем, есть ли уже правила
    const existingRules = await parser.loadRules()
    if (existingRules) {
      console.log('\n⚠️ Правила уже существуют:')
      console.log(JSON.stringify(existingRules, null, 2))
      console.log('\n❓ Перезаписать существующие правила? (y/n)')
      // Для автоматического выполнения перезаписываем
    }

    try {
      // Проводим анализ файла
      console.log('\n📊 Проведение анализа файла...')
      const analysis = await parser.analyze('')
      console.log('✅ Анализ завершен')

      // Создаем правила на основе анализа и стандартных настроек для Аметиста
      const rules: ParsingRules = {
        columnMappings: {
          collection: 2, // C = индекс 2
          color: 4, // E = индекс 4
          inStock: 6, // G = индекс 6 (метраж/наличие)
          meterage: 6, // G = индекс 6 (метраж)
          nextArrivalDate: 9, // J = индекс 9
        },
        skipRows: [],
        skipPatterns: [],
        headerRow: undefined,
        specialRules: {
          ametistColorPattern: true, // Удаление первого слова цвета, если совпадает с коллекцией
        },
      }

      // Определяем строку заголовков и строки для пропуска
      // Анализируем первые строки для определения структуры
      const firstRow = analysis.sampleData[0] || []
      const secondRow = analysis.sampleData[1] || []
      const thirdRow = analysis.sampleData[2] || []
      
      // Проверяем, есть ли заголовки в строке 3 (индекс 2)
      const hasHeadersInRow3 = thirdRow.some((cell: any) => 
        ['код', 'вид', 'тип', 'артикул', 'номенклатура', 'коллекция', 'цвет', 'наличие', 'метраж', 'дата'].some(keyword => 
          String(cell).toLowerCase().includes(keyword)
        )
      )
      
      if (hasHeadersInRow3) {
        // Строка 3 (индекс 2) содержит заголовки
        rules.headerRow = 2 // Строка 3 в Excel (индекс 2)
        rules.skipRows = [1, 2] // Пропускаем строки 1 и 2 (служебная информация)
        console.log('\n✅ Обнаружены заголовки в строке 3')
      } else if (analysis.structure.headers) {
        // Если заголовки определены автоматически, но не в строке 3
        rules.headerRow = 0
        rules.skipRows = [1]
        console.log('\n✅ Используются автоматически определенные заголовки')
      } else {
        // Если заголовков нет, пропускаем первые 2 строки
        rules.skipRows = [1, 2]
        console.log('\n⚠️ Заголовки не обнаружены, пропускаем первые 2 строки')
      }
      
      console.log('\n📊 Структура файла:')
      console.log(`   Колонок: ${analysis.structure.columns}`)
      console.log(`   Строк в выборке: ${analysis.structure.rows}`)
      console.log(`   Заголовки: ${analysis.structure.headers ? 'есть' : 'нет'}`)
      if (analysis.structure.headers) {
        console.log(`   Заголовки: ${analysis.structure.headers.slice(0, 10).join(', ')}...`)
      }
      console.log(`\n   Первые 3 строки данных:`)
      for (let i = 0; i < Math.min(3, analysis.sampleData.length); i++) {
        console.log(`   Строка ${i + 1}: ${analysis.sampleData[i].slice(0, 5).join(' | ')}...`)
      }

      console.log('\n📋 Созданные правила:')
      console.log(JSON.stringify(rules, null, 2))

      // Сохраняем правила
      await parser.saveRules(rules)
      console.log('\n✅ Правила успешно сохранены!')

      // Проверяем, что правила сохранены
      const savedRules = await parser.loadRules()
      if (savedRules) {
        console.log('\n✅ Проверка: правила успешно загружены из БД')
        console.log(JSON.stringify(savedRules, null, 2))
      } else {
        console.log('\n⚠️ Предупреждение: правила не найдены после сохранения')
      }
    } catch (error: any) {
      console.error('\n❌ Ошибка при анализе файла:', error.message)
      console.error('Стек ошибки:', error.stack)
      
      // Если анализ не удался, создаем правила по умолчанию
      console.log('\n📋 Создание правил по умолчанию...')
      const defaultRules: ParsingRules = {
        columnMappings: {
          collection: 2, // C = индекс 2
          color: 4, // E = индекс 4
          inStock: 6, // G = индекс 6
          meterage: 6, // G = индекс 6
          nextArrivalDate: 9, // J = индекс 9
        },
        skipRows: [1], // Пропускаем заголовки
        headerRow: 0,
        specialRules: {
          ametistColorPattern: true,
        },
      }

      await parser.saveRules(defaultRules)
      console.log('✅ Правила по умолчанию сохранены')
    }
  } catch (error) {
    console.error('❌ Ошибка при настройке правил:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupAmetistRules()

