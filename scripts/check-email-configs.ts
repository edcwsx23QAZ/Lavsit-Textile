/**
 * Проверка email конфигураций для поставщиков
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📧 Проверка email конфигураций...\n')

  const suppliers = await prisma.supplier.findMany({
    where: {
      OR: [
        { name: 'Аметист' },
        { name: 'Нортекс' },
      ],
    },
  })

  for (const supplier of suppliers) {
    console.log(`\n${'='.repeat(60)}`)
    console.log(`Поставщик: ${supplier.name}`)
    console.log(`ID: ${supplier.id}`)
    console.log(`Метод парсинга: ${supplier.parsingMethod}`)
    
    if (supplier.emailConfig) {
      try {
        const config = JSON.parse(supplier.emailConfig)
        console.log(`\n✅ Email конфигурация найдена:`)
        console.log(`   Host: ${config.host || config.imap?.host || 'не указан'}`)
        console.log(`   Port: ${config.port || config.imap?.port || 'не указан'}`)
        console.log(`   User: ${config.user || config.imap?.user || 'не указан'}`)
        console.log(`   Password: ${config.password || config.imap?.password ? '***' : 'не указан'}`)
        console.log(`   From Email: ${config.fromEmail || 'не указан'}`)
        console.log(`   Subject Filter: ${config.subjectFilter || 'не указан'}`)
        console.log(`   Search Days: ${config.searchDays || 90}`)
        console.log(`   Search Unread Only: ${config.searchUnreadOnly !== false ? 'true' : 'false'}`)
        console.log(`   Use Any Latest: ${config.useAnyLatestAttachment === true ? 'true' : 'false'}`)
      } catch (e: any) {
        console.log(`\n❌ Ошибка парсинга email конфигурации: ${e.message}`)
      }
    } else {
      console.log(`\n❌ Email конфигурация отсутствует!`)
      console.log(`   Настройте через: POST /api/suppliers/${supplier.id}/email-config`)
      
      // Предлагаем стандартные настройки
      if (supplier.name === 'Аметист') {
        console.log(`\n   Рекомендуемая конфигурация для Аметиста:`)
        console.log(`   {
          "host": "imap.mail.ru",
          "port": 993,
          "secure": true,
          "user": "your-email@example.com",
          "password": "your-password",
          "fromEmail": "noreply@ametist.ru",
          "subjectFilter": "Остатки номенклатуры на складе 'ООО Аметист'",
          "searchDays": 90,
          "searchUnreadOnly": false
        }`)
      } else if (supplier.name === 'Нортекс') {
        console.log(`\n   Рекомендуемая конфигурация для Нортекса:`)
        console.log(`   {
          "host": "imap.mail.ru",
          "port": 993,
          "secure": true,
          "user": "your-email@example.com",
          "password": "your-password",
          "fromEmail": "obivkanortex@mail.ru",
          "searchDays": 90,
          "searchUnreadOnly": false
        }`)
      }
    }
    
    // Проверяем количество вложений в БД
    const attachmentsCount = await prisma.emailAttachment.count({
      where: { supplierId: supplier.id },
    })
    
    const processedCount = await prisma.emailAttachment.count({
      where: { 
        supplierId: supplier.id,
        processed: true,
      },
    })
    
    console.log(`\n📎 Вложения в базе данных:`)
    console.log(`   Всего: ${attachmentsCount}`)
    console.log(`   Обработано: ${processedCount}`)
    console.log(`   Необработано: ${attachmentsCount - processedCount}`)
  }

  console.log(`\n${'='.repeat(60)}\n`)
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

