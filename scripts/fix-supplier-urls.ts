/**
 * Скрипт для обновления URL поставщиков в базе данных
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Обновление URL поставщиков...\n')

  // Обновляем URL для Артекса
  const arteks = await prisma.supplier.findFirst({
    where: { name: 'Артекс' },
  })

  if (arteks) {
    const newUrl = 'https://artextkani.ru/wp-content/uploads/YYYY/MM/DD.MM.YYYY-1.xlsx'
    if (arteks.parsingUrl !== newUrl) {
      await prisma.supplier.update({
        where: { id: arteks.id },
        data: {
          parsingUrl: newUrl,
        },
      })
      console.log(`✅ Обновлен URL для Артекса: ${newUrl}`)
    } else {
      console.log(`ℹ️ URL для Артекса уже актуальный: ${newUrl}`)
    }
  } else {
    console.log(`⚠️ Поставщик Артекс не найден`)
  }

  // Проверяем email конфигурации для Аметиста и Нортекса
  console.log('\n📧 Проверка email конфигураций...\n')

  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  if (ametist) {
    if (ametist.emailConfig) {
      try {
        const config = JSON.parse(ametist.emailConfig)
        console.log(`✅ Аметист: email конфигурация найдена`)
        console.log(`   From: ${config.fromEmail || config.imap?.fromEmail || 'не указан'}`)
        console.log(`   Subject: ${config.subjectFilter || config.imap?.subjectFilter || 'не указан'}`)
      } catch (e) {
        console.log(`⚠️ Аметист: ошибка парсинга email конфигурации`)
      }
    } else {
      console.log(`⚠️ Аметист: email конфигурация отсутствует`)
      console.log(`   Нужно настроить через POST /api/suppliers/${ametist.id}/email-config`)
    }
  }

  const nortex = await prisma.supplier.findFirst({
    where: { name: 'Нортекс' },
  })

  if (nortex) {
    if (nortex.emailConfig) {
      try {
        const config = JSON.parse(nortex.emailConfig)
        console.log(`✅ Нортекс: email конфигурация найдена`)
        console.log(`   From: ${config.fromEmail || config.imap?.fromEmail || 'не указан'}`)
        console.log(`   Subject: ${config.subjectFilter || config.imap?.subjectFilter || 'не указан'}`)
      } catch (e) {
        console.log(`⚠️ Нортекс: ошибка парсинга email конфигурации`)
      }
    } else {
      console.log(`⚠️ Нортекс: email конфигурация отсутствует`)
      console.log(`   Нужно настроить через POST /api/suppliers/${nortex.id}/email-config`)
    }
  }

  console.log('\n✅ Обновление завершено')
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

