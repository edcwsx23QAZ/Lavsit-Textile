/**
 * Автоматическая настройка email конфигураций для Аметиста и Нортекса
 * 
 * ВАЖНО: Перед запуском укажите реальные данные доступа к почтовому ящику
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ⚠️ ЗАМЕНИТЕ НА РЕАЛЬНЫЕ ДАННЫЕ
const EMAIL_CONFIG = {
  host: 'imap.mail.ru', // или другой IMAP сервер
  port: 993,
  secure: true,
  user: 'your-email@example.com', // ⚠️ ЗАМЕНИТЕ
  password: 'your-password', // ⚠️ ЗАМЕНИТЕ
  searchDays: 90,
  searchUnreadOnly: false,
}

async function main() {
  console.log('📧 Автоматическая настройка email конфигураций...\n')

  // Проверяем, что данные не дефолтные
  if (EMAIL_CONFIG.user === 'your-email@example.com' || EMAIL_CONFIG.password === 'your-password') {
    console.log('❌ ОШИБКА: Необходимо указать реальные данные доступа к почтовому ящику!')
    console.log('   Откройте файл scripts/auto-setup-email-configs.ts и замените:')
    console.log('   - EMAIL_CONFIG.user на ваш email')
    console.log('   - EMAIL_CONFIG.password на ваш пароль')
    process.exit(1)
  }

  // Находим поставщиков
  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  const nortex = await prisma.supplier.findFirst({
    where: { name: 'Нортекс' },
  })

  if (!ametist) {
    console.log('❌ Поставщик Аметист не найден')
    process.exit(1)
  }

  if (!nortex) {
    console.log('❌ Поставщик Нортекс не найден')
    process.exit(1)
  }

  // Настраиваем Аметист
  console.log(`\n📧 Настройка Аметиста (ID: ${ametist.id})...`)
  const ametistConfig = {
    ...EMAIL_CONFIG,
    fromEmail: 'noreply@ametist.ru',
    subjectFilter: "Остатки номенклатуры на складе 'ООО Аметист'",
  }

  await prisma.supplier.update({
    where: { id: ametist.id },
    data: {
      emailConfig: JSON.stringify(ametistConfig),
      parsingMethod: 'email',
    },
  })

  console.log('✅ Email конфигурация для Аметиста настроена')
  console.log(`   From: ${ametistConfig.fromEmail}`)
  console.log(`   Subject: ${ametistConfig.subjectFilter}`)

  // Настраиваем Нортекс
  console.log(`\n📧 Настройка Нортекса (ID: ${nortex.id})...`)
  const nortexConfig = {
    ...EMAIL_CONFIG,
    fromEmail: 'obivkanortex@mail.ru',
    subjectFilter: '', // Пустой фильтр
  }

  await prisma.supplier.update({
    where: { id: nortex.id },
    data: {
      emailConfig: JSON.stringify(nortexConfig),
      parsingMethod: 'email',
    },
  })

  console.log('✅ Email конфигурация для Нортекса настроена')
  console.log(`   From: ${nortexConfig.fromEmail}`)
  console.log(`   Subject: ${nortexConfig.subjectFilter || '(не указан)'}`)

  console.log('\n✅ Все email конфигурации настроены!')
  console.log('\nТеперь можно запускать парсинг:')
  console.log(`   POST /api/suppliers/${ametist.id}/parse`)
  console.log(`   POST /api/suppliers/${nortex.id}/parse`)
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

