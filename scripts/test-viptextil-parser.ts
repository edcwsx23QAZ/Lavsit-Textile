import { ViptextilParser } from '../lib/parsers/viptextil-parser'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testParser() {
  try {
    // Находим поставщика Viptextil
    const supplier = await prisma.supplier.findFirst({
      where: { name: 'Viptextil' },
    })

    if (!supplier) {
      console.error('Поставщик Viptextil не найден в базе данных')
      process.exit(1)
    }

    console.log(`Тестируем парсер для поставщика: ${supplier.name}`)
    console.log(`URL: ${supplier.parsingUrl}\n`)

    const parser = new ViptextilParser(supplier.id, supplier.name)
    const url = supplier.parsingUrl || 'http://tgn1.viptextil.ru/vip/ostatki.html'

    console.log('Запускаем парсинг...\n')
    const fabrics = await parser.parse(url)

    console.log(`Найдено тканей: ${fabrics.length}\n`)

    if (fabrics.length === 0) {
      console.log('⚠️ Парсер не нашел ни одной ткани!')
      console.log('Проверьте структуру HTML страницы.\n')
    } else {
      console.log('Первые 10 тканей:')
      fabrics.slice(0, 10).forEach((fabric, i) => {
        console.log(`\n${i + 1}. ${fabric.collection} ${fabric.colorNumber}`)
        console.log(`   В наличии: ${fabric.inStock ? 'Да' : 'Нет'}`)
        console.log(`   Комментарий: ${fabric.comment || 'нет'}`)
      })
    }

    // Проверяем правила парсинга
    const rules = await parser.loadRules()
    if (rules) {
      console.log('\n\nПравила парсинга:')
      console.log(JSON.stringify(rules, null, 2))
    } else {
      console.log('\n\nПравила парсинга не установлены (используются дефолтные)')
    }

  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testParser()



