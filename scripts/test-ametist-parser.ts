/**
 * Тестирование парсера Аметиста
 */

import { PrismaClient } from '@prisma/client'
import { EmailParser } from '../lib/email/email-parser'
import { AmetistParser } from '../lib/parsers/ametist-parser'
import * as fs from 'fs'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Тестирование парсера Аметиста...\n')

  // Находим поставщика Аметист
  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  if (!ametist) {
    console.log('❌ Поставщик Аметист не найден')
    process.exit(1)
  }

  if (!ametist.emailConfig) {
    console.log('❌ Email конфигурация не найдена')
    process.exit(1)
  }

  console.log(`✅ Поставщик найден: ${ametist.name} (ID: ${ametist.id})\n`)

  // Парсим email конфигурацию
  let emailConfig = JSON.parse(ametist.emailConfig)
  
  // Нормализуем структуру
  if (emailConfig.imap && (emailConfig.imap.host || emailConfig.imap.port || emailConfig.imap.user)) {
    emailConfig = {
      host: emailConfig.imap.host || '',
      port: emailConfig.imap.port || 993,
      user: emailConfig.imap.user || '',
      password: emailConfig.imap.password || '',
      secure: emailConfig.imap.secure !== false,
      fromEmail: emailConfig.fromEmail || '',
      subjectFilter: emailConfig.subjectFilter || '',
      searchDays: emailConfig.searchDays || 90,
      searchUnreadOnly: emailConfig.searchUnreadOnly !== undefined ? emailConfig.searchUnreadOnly : false,
      useAnyLatestAttachment: emailConfig.useAnyLatestAttachment === true,
    }
  }

  console.log('📧 Email конфигурация:')
  console.log(`   From: ${emailConfig.fromEmail}`)
  console.log(`   Subject: ${emailConfig.subjectFilter || '(не указан)'}`)
  console.log(`   Search Days: ${emailConfig.searchDays}`)
  console.log(`   Use Any Latest: ${emailConfig.useAnyLatestAttachment}\n`)

  // Подключаемся к email
  const emailParser = new EmailParser(emailConfig)
  console.log('🔌 Подключение к email серверу...')
  await emailParser.connect()
  console.log('✅ Подключено\n')

  try {
    // Ищем письма за последние 7 дней (чтобы найти сегодняшнее письмо)
    const searchDays = 7
    const since = new Date()
    since.setDate(since.getDate() - searchDays)

    console.log(`📬 Поиск писем за последние ${searchDays} дней (с ${since.toISOString()})...`)
    
    let emails = await emailParser.fetchNewEmails(ametist.id, since)
    console.log(`   Найдено писем с фильтрами: ${emails.length}`)

    // Если не найдено, пробуем без фильтров
    if (emails.length === 0 && (emailConfig.fromEmail || emailConfig.subjectFilter)) {
      console.log(`   ⚠️ Пробуем поиск без фильтров...`)
      const emailConfigWithoutFilters = {
        ...emailConfig,
        fromEmail: undefined,
        subjectFilter: undefined,
      }
      const emailParserWithoutFilters = new EmailParser(emailConfigWithoutFilters)
      await emailParserWithoutFilters.connect()
      
      try {
        const emailsWithoutFilters = await emailParserWithoutFilters.fetchNewEmails(ametist.id, since)
        console.log(`   Найдено писем без фильтров: ${emailsWithoutFilters.length}`)
        
        if (emailsWithoutFilters.length > 0) {
          // Фильтруем вручную
          let filteredEmails = emailsWithoutFilters
          
          if (emailConfig.fromEmail) {
            filteredEmails = filteredEmails.filter(email => {
              const fromText = email.from?.text || email.from?.value?.[0]?.address || ''
              return fromText.toLowerCase().includes(emailConfig.fromEmail.toLowerCase())
            })
          }
          
          if (emailConfig.subjectFilter && filteredEmails.length > 0) {
            filteredEmails = filteredEmails.filter(email => {
              const subject = email.subject || ''
              return subject.toLowerCase().includes(emailConfig.subjectFilter.toLowerCase())
            })
          }
          
          emails = filteredEmails
          console.log(`   После ручной фильтрации: ${emails.length} писем`)
        }
      } finally {
        await emailParserWithoutFilters.disconnect()
      }
    }

    if (emails.length === 0) {
      console.log('\n❌ Письма не найдены')
      process.exit(1)
    }

    // Сортируем по дате (новые первыми)
    emails.sort((a, b) => {
      const dateA = a.date || new Date(0)
      const dateB = b.date || new Date(0)
      return dateB.getTime() - dateA.getTime()
    })

    console.log(`\n📋 Найденные письма (от новых к старым):`)
    emails.forEach((email, idx) => {
      const date = email.date ? new Date(email.date).toLocaleString('ru-RU') : 'нет даты'
      console.log(`   ${idx + 1}. От: ${email.from?.text || 'unknown'}`)
      console.log(`      Тема: ${email.subject || 'no subject'}`)
      console.log(`      Дата: ${date}`)
    })

    // Берем последнее письмо
    const latestEmail = emails[0]
    console.log(`\n📧 Обрабатываем последнее письмо:`)
    console.log(`   От: ${latestEmail.from?.text || 'unknown'}`)
    console.log(`   Тема: ${latestEmail.subject || 'no subject'}`)
    console.log(`   Дата: ${latestEmail.date ? new Date(latestEmail.date).toLocaleString('ru-RU') : 'нет даты'}`)

    // Ищем Excel/ZIP вложения
    const attachments = emailParser.extractExcelAttachments(latestEmail)
    console.log(`\n📎 Найдено вложений: ${attachments.length}`)
    
    if (attachments.length === 0) {
      console.log('❌ Excel/ZIP вложения не найдены в письме')
      process.exit(1)
    }

    attachments.forEach((att, idx) => {
      console.log(`   ${idx + 1}. ${att.filename} (${att.size || 'unknown'} bytes)`)
    })

    // Берем первое вложение
    const attachment = attachments[0]
    console.log(`\n📦 Обрабатываем вложение: ${attachment.filename}`)

    // Сохраняем вложение
    const filePath = await emailParser.saveAttachment(ametist.id, latestEmail, attachment)
    console.log(`✅ Вложение сохранено: ${filePath}`)

    // Проверяем, что файл существует
    if (!fs.existsSync(filePath)) {
      console.log('❌ Файл не найден на диске')
      process.exit(1)
    }

    console.log(`\n🔍 Валидация файла...`)
    const parser = new AmetistParser(ametist.id, ametist.name)
    const isValid = await parser.validateFile(filePath)
    
    if (!isValid) {
      console.log('❌ Файл не прошел валидацию')
      process.exit(1)
    }

    console.log('✅ Файл валиден\n')

    // Загружаем правила парсинга
    console.log('📋 Загрузка правил парсинга...')
    const rules = await parser.loadRules()
    
    if (!rules) {
      console.log('⚠️ Правила не найдены, требуется анализ')
      console.log('   Запустите: POST /api/suppliers/' + ametist.id + '/analyze')
      process.exit(1)
    }

    console.log('✅ Правила загружены\n')

    // Парсим файл
    console.log('🔄 Парсинг файла...')
    const fabrics = await parser.parse(filePath)
    
    console.log(`\n✅ Парсинг завершен!`)
    console.log(`   Найдено тканей: ${fabrics.length}`)

    if (fabrics.length > 0) {
      console.log(`\n📊 Примеры найденных тканей (первые 10):`)
      fabrics.slice(0, 10).forEach((fabric, idx) => {
        console.log(`   ${idx + 1}. "${fabric.collection}" | "${fabric.colorNumber}"`)
        console.log(`      В наличии: ${fabric.inStock ? 'Да' : 'Нет'}`)
        console.log(`      Метраж: ${fabric.meterage || 'нет'}`)
        console.log(`      Комментарий: ${fabric.comment || 'нет'}`)
      })
    } else {
      console.log('⚠️ Ткани не найдены - возможно проблема с правилами парсинга')
    }

    console.log('\n✅ Тестирование завершено успешно!')

  } finally {
    await emailParser.disconnect()
  }
}

main()
  .catch((e) => {
    console.error('\n❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

