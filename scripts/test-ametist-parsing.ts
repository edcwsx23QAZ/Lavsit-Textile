/**
 * Тестирование парсинга Аметиста
 */
import { prisma } from '../lib/db/prisma'
import { AmetistParser } from '../lib/parsers/ametist-parser'

async function testAmetistParsing() {
  try {
    console.log('🧪 Тестирование парсинга Аметиста...\n')

    // Находим поставщика Аметист
    const ametist = await prisma.supplier.findFirst({
      where: { name: 'Аметист' },
    })

    if (!ametist) {
      console.log('❌ Поставщик Аметист не найден')
      return
    }

    console.log(`✅ Аметист найден: ID = ${ametist.id}`)

    // Проверяем правила парсинга
    const parser = new AmetistParser(ametist.id, ametist.name)
    const rules = await parser.loadRules()
    
    if (rules) {
      console.log('\n✅ Правила парсинга найдены:')
      console.log(JSON.stringify(rules, null, 2))
    } else {
      console.log('\n⚠️ Правила парсинга не найдены (будут созданы автоматически)')
    }

    // Проверяем email конфигурацию
    if (!ametist.emailConfig) {
      console.log('\n❌ Email конфигурация отсутствует')
      return
    }

    let emailConfig = JSON.parse(ametist.emailConfig)
    console.log('\n📧 Email конфигурация:')
    console.log(`   Host: ${emailConfig.host || emailConfig.imap?.host || 'не указан'}`)
    console.log(`   Port: ${emailConfig.port || emailConfig.imap?.port || 'не указан'}`)
    console.log(`   User: ${emailConfig.user || emailConfig.imap?.user || 'не указан'}`)
    console.log(`   Password: ${emailConfig.password || emailConfig.imap?.password ? '***установлен***' : 'не установлен'}`)
    console.log(`   From Email: ${emailConfig.fromEmail || 'не указан'}`)
    console.log(`   Subject Filter: ${emailConfig.subjectFilter || 'не указан'}`)

    // Пытаемся выполнить парсинг
    console.log('\n🚀 Запуск парсинга...')
    try {
      const fabrics = await parser.parse('')
      console.log(`\n✅ Парсинг успешен! Найдено тканей: ${fabrics.length}`)
      
      if (fabrics.length > 0) {
        console.log('\n📊 Примеры распарсенных тканей (первые 5):')
        fabrics.slice(0, 5).forEach((fabric, idx) => {
          console.log(`   ${idx + 1}. ${fabric.collection} - ${fabric.colorNumber}`)
          console.log(`      В наличии: ${fabric.inStock}, Метраж: ${fabric.meterage}, Дата: ${fabric.nextArrivalDate || 'нет'}`)
        })
      }
    } catch (parseError: any) {
      console.error('\n❌ Ошибка при парсинге:')
      console.error(`   Сообщение: ${parseError.message}`)
      console.error(`   Стек: ${parseError.stack}`)
    }

    // Проверяем количество тканей в БД
    const fabricCount = await prisma.fabric.count({
      where: { supplierId: ametist.id },
    })
    console.log(`\n📊 Тканей в базе данных: ${fabricCount}`)
  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAmetistParsing()

