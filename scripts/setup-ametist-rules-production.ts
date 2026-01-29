/**
 * Автоматическая настройка правил парсинга для Аметиста в продакшн БД
 * Использует DATABASE_URL из переменных окружения
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function setupAmetistRulesProduction() {
  try {
    console.log('🔧 Настройка правил парсинга для Аметиста (продакшн)...\n')
    console.log(`📊 DATABASE_URL: ${process.env.DATABASE_URL ? 'установлен' : 'не установлен'}\n`)

    // Находим поставщика Аметист
    const ametist = await prisma.supplier.findFirst({
      where: { name: 'Аметист' },
    })

    if (!ametist) {
      console.log('❌ Поставщик Аметист не найден')
      return
    }

    console.log(`✅ Аметист найден: ID = ${ametist.id}`)

    // Проверяем существующие правила
    const existingRule = await prisma.parsingRule.findUnique({
      where: { supplierId: ametist.id },
    })

    if (existingRule) {
      console.log('\n⚠️ Правила уже существуют:')
      console.log(JSON.stringify(JSON.parse(existingRule.rules), null, 2))
    }

    // Создаем правила на основе стандартных настроек для Аметиста
    // Эти правила основаны на анализе структуры файла Аметиста
    const rules: any = {
      columnMappings: {
        collection: 2, // C = индекс 2
        color: 4, // E = индекс 4
        inStock: 6, // G = индекс 6 (метраж/наличие)
        meterage: 6, // G = индекс 6 (метраж)
        nextArrivalDate: 9, // J = индекс 9
      },
      skipRows: [1, 2], // Пропускаем строки 1 и 2 (служебная информация)
      skipPatterns: [],
      headerRow: 2, // Строка 3 (индекс 2) содержит заголовки
      specialRules: {
        ametistColorPattern: true, // Удаление первого слова цвета, если совпадает с коллекцией
      },
    }

    console.log('\n📋 Правила для сохранения:')
    console.log(JSON.stringify(rules, null, 2))

    // Сохраняем правила
    await prisma.parsingRule.upsert({
      where: { supplierId: ametist.id },
      create: {
        supplierId: ametist.id,
        rules: JSON.stringify(rules),
      },
      update: {
        rules: JSON.stringify(rules),
        updatedAt: new Date(),
      },
    })

    console.log('\n✅ Правила успешно сохранены в продакшн БД!')

    // Проверяем, что правила сохранены
    const savedRule = await prisma.parsingRule.findUnique({
      where: { supplierId: ametist.id },
    })

    if (savedRule) {
      console.log('\n✅ Проверка: правила успешно загружены из БД')
      console.log(JSON.stringify(JSON.parse(savedRule.rules), null, 2))
    } else {
      console.log('\n⚠️ Предупреждение: правила не найдены после сохранения')
    }
  } catch (error) {
    console.error('❌ Ошибка при настройке правил:', error)
    if (error instanceof Error) {
      console.error('Сообщение:', error.message)
      console.error('Стек:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

setupAmetistRulesProduction()

