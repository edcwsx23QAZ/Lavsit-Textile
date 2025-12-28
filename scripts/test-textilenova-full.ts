import { TextileNovaParser } from '../lib/parsers/textilenova-parser'
import { PrismaClient } from '@prisma/client'
import { createAutoRules } from '../lib/parsers/auto-rules'

const prisma = new PrismaClient()

async function testTextileNovaFull() {
  console.log('=== Полный тест парсера TextileNova ===\n')

  // Получаем ID поставщика
  const supplier = await prisma.supplier.findUnique({
    where: { name: 'TextileNova' }
  })

  if (!supplier) {
    console.error('Поставщик TextileNova не найден в базе данных!')
    await prisma.$disconnect()
    return
  }

  const supplierId = supplier.id
  const parser = new TextileNovaParser(supplierId, 'TextileNova')

  try {
    const url = 'https://textilnova.ru//'

    // Проводим анализ
    console.log('1. Анализ структуры данных...')
    const analysis = await parser.analyze(url)
    console.log(`   ✓ Анализ завершен, найдено ${analysis.sampleData.length} строк для анализа\n`)

    // Создаем правила
    console.log('2. Создание правил парсинга...')
    const rules = createAutoRules('TextileNova', analysis)
    await parser.saveRules(rules)
    console.log(`   ✓ Правила созданы:`)
    console.log(`     - Коллекция: колонка ${(rules.columnMappings.collection ?? 0) + 1} (A)`)
    console.log(`     - Наличие: колонка ${(rules.columnMappings.inStock ?? 1) + 1} (B)`)
    console.log(`     - Дата: колонка ${(rules.columnMappings.nextArrivalDate ?? 2) + 1} (C)`)
    console.log(`     - Пропуск строк: ${rules.skipRows?.join(', ') || 'нет'}\n`)

    // Парсим данные
    console.log('3. Парсинг данных...')
    const fabrics = await parser.parse(url)
    console.log(`   ✓ Найдено тканей: ${fabrics.length}\n`)

    if (fabrics.length > 0) {
      console.log('Первые 10 тканей:')
      fabrics.slice(0, 10).forEach((fabric, idx) => {
        console.log(`   ${idx + 1}. ${fabric.collection} ${fabric.colorNumber} - ${fabric.inStock ? `В наличии${fabric.comment ? ` (${fabric.comment})` : ''}` : 'Нет в наличии'}${fabric.nextArrivalDate ? ` (приход: ${fabric.nextArrivalDate.toLocaleDateString('ru-RU')})` : ''}`)
      })
      console.log('')
    } else {
      console.log('   ⚠️ ПРОБЛЕМА: Не найдено ни одной ткани!')
      console.log('   Возможные причины:')
      console.log('   - Все строки пропущены из-за пустого столбца B')
      console.log('   - Не удается распарсить коллекцию/цвет')
      console.log('   - Слишком строгие фильтры')
      console.log('')
    }

  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testTextileNovaFull()
  .then(() => {
    console.log('\n=== Тест завершен ===')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })


