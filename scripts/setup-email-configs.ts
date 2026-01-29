/**
 * Автоматическая настройка email конфигураций для поставщиков
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📧 Настройка email конфигураций...\n')

  // Находим поставщиков
  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  const nortex = await prisma.supplier.findFirst({
    where: { name: 'Нортекс' },
  })

  if (!ametist) {
    console.log('❌ Поставщик Аметист не найден')
  } else {
    console.log(`✅ Аметист найден: ID = ${ametist.id}`)
  }

  if (!nortex) {
    console.log('❌ Поставщик Нортекс не найден')
  } else {
    console.log(`✅ Нортекс найден: ID = ${nortex.id}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Для настройки email конфигураций используйте:')
  console.log('='.repeat(60) + '\n')

  if (ametist) {
    console.log('📧 Аметист:')
    console.log(`   ID: ${ametist.id}`)
    console.log(`   Endpoint: POST /api/suppliers/${ametist.id}/email-config`)
    console.log(`   Конфигурация:`)
    console.log(`   {`)
    console.log(`     "host": "imap.mail.ru",`)
    console.log(`     "port": 993,`)
    console.log(`     "secure": true,`)
    console.log(`     "user": "your-email@example.com",`)
    console.log(`     "password": "your-password",`)
    console.log(`     "fromEmail": "noreply@ametist.ru",`)
    console.log(`     "subjectFilter": "Остатки номенклатуры на складе 'ООО Аметист'",`)
    console.log(`     "searchDays": 90,`)
    console.log(`     "searchUnreadOnly": false`)
    console.log(`   }`)
    console.log('')
  }

  if (nortex) {
    console.log('📧 Нортекс:')
    console.log(`   ID: ${nortex.id}`)
    console.log(`   Endpoint: POST /api/suppliers/${nortex.id}/email-config`)
    console.log(`   Конфигурация:`)
    console.log(`   {`)
    console.log(`     "host": "imap.mail.ru",`)
    console.log(`     "port": 993,`)
    console.log(`     "secure": true,`)
    console.log(`     "user": "your-email@example.com",`)
    console.log(`     "password": "your-password",`)
    console.log(`     "fromEmail": "obivkanortex@mail.ru",`)
    console.log(`     "subjectFilter": "",`)
    console.log(`     "searchDays": 90,`)
    console.log(`     "searchUnreadOnly": false`)
    console.log(`   }`)
    console.log('')
  }

  console.log('='.repeat(60))
  console.log('\n💡 Примечание: Замените "your-email@example.com" и "your-password"')
  console.log('   на реальные данные доступа к почтовому ящику\n')
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

