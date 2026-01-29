/**
 * Проверка и исправление конфигураций парсеров
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Проверка конфигураций парсеров...\n')

  // Находим Аметист и Артекс
  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  const arteks = await prisma.supplier.findFirst({
    where: { name: 'Артекс' },
  })

  if (!ametist) {
    console.log('❌ Аметист не найден')
    process.exit(1)
  }

  if (!arteks) {
    console.log('❌ Артекс не найден')
    process.exit(1)
  }

  console.log(`✅ Аметист найден: ID = ${ametist.id}`)
  console.log(`   Parsing Method: ${ametist.parsingMethod}`)
  console.log(`   Email Config: ${ametist.emailConfig ? '✅ есть' : '❌ нет'}`)
  
  if (ametist.emailConfig) {
    try {
      const config = JSON.parse(ametist.emailConfig)
      console.log(`   From Email: ${config.fromEmail || config.imap?.fromEmail || 'не указан'}`)
      console.log(`   Subject Filter: ${config.subjectFilter || config.imap?.subjectFilter || 'не указан'}`)
      console.log(`   Use Any Latest: ${config.useAnyLatestAttachment || config.imap?.useAnyLatestAttachment || false}`)
    } catch (e) {
      console.log(`   ⚠️ Ошибка парсинга конфигурации: ${e}`)
    }
  }

  console.log(`\n✅ Артекс найден: ID = ${arteks.id}`)
  console.log(`   Parsing Method: ${arteks.parsingMethod}`)
  console.log(`   Parsing URL: ${arteks.parsingUrl || 'не указан'}`)
  console.log(`   Email Config: ${arteks.emailConfig ? '⚠️ есть (не должно быть для URL парсера)' : '✅ нет'}`)

  // Исправляем Артекс - убираем email конфигурацию, если она есть
  if (arteks.parsingMethod !== 'url' || arteks.emailConfig) {
    console.log(`\n🔧 Исправление Артекса...`)
    await prisma.supplier.update({
      where: { id: arteks.id },
      data: {
        parsingMethod: 'url',
        emailConfig: null,
      },
    })
    console.log(`✅ Артекс исправлен: parsingMethod = 'url', emailConfig = null`)
  }

  // Проверяем и исправляем Аметист
  if (ametist.parsingMethod !== 'email') {
    console.log(`\n🔧 Исправление метода парсинга Аметиста...`)
    await prisma.supplier.update({
      where: { id: ametist.id },
      data: {
        parsingMethod: 'email',
      },
    })
    console.log(`✅ Аметист исправлен: parsingMethod = 'email'`)
  }

  // Проверяем email конфигурацию Аметиста
  if (!ametist.emailConfig) {
    console.log(`\n❌ У Аметиста нет email конфигурации!`)
    console.log(`   Нужно настроить через POST /api/suppliers/${ametist.id}/email-config`)
    process.exit(1)
  }

  let emailConfig = JSON.parse(ametist.emailConfig)
  
  // Проверяем, есть ли вложенная структура
  const hasNestedStructure = emailConfig.imap && (emailConfig.imap.host || emailConfig.imap.port || emailConfig.imap.user)
  
  // Нормализуем конфигурацию для проверки (конвертируем из вложенной в плоскую, если нужно)
  let normalizedConfig = emailConfig
  if (hasNestedStructure) {
    // Вложенная структура - конвертируем в плоскую для проверки
    normalizedConfig = {
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

  // Проверяем обязательные поля (в нормализованной конфигурации)
  const requiredFields = ['host', 'port', 'user', 'password']
  const missingFields = requiredFields.filter(field => {
    const value = normalizedConfig[field]
    return !value || value === ''
  })
  
  if (missingFields.length > 0) {
    console.log(`\n⚠️ У Аметиста отсутствуют обязательные поля в плоской структуре: ${missingFields.join(', ')}`)
    console.log(`   Проверяем вложенную структуру...`)
    
    // Проверяем вложенную структуру
    if (hasNestedStructure) {
      const nestedMissing = requiredFields.filter(field => {
        const value = emailConfig.imap?.[field]
        return !value || value === ''
      })
      
      if (nestedMissing.length > 0) {
        console.log(`\n❌ У Аметиста отсутствуют обязательные поля и во вложенной структуре: ${nestedMissing.join(', ')}`)
        console.log(`   Нужно настроить через POST /api/suppliers/${ametist.id}/email-config`)
        process.exit(1)
      } else {
        console.log(`✅ Все обязательные поля найдены во вложенной структуре`)
      }
    } else {
      console.log(`\n❌ У Аметиста отсутствуют обязательные поля: ${missingFields.join(', ')}`)
      console.log(`   Нужно настроить через POST /api/suppliers/${ametist.id}/email-config`)
      process.exit(1)
    }
  }

  // Обновляем конфигурацию, сохраняя структуру (вложенную или плоскую)
  let needsUpdate = false
  const expectedSubject = "Остатки номенклатуры на складе 'ООО Аметист'"
  const expectedFrom = "noreply@ametist.ru"
  
  if (hasNestedStructure) {
    // Обновляем вложенную структуру
    if (emailConfig.useAnyLatestAttachment !== true) {
      emailConfig.useAnyLatestAttachment = true
      needsUpdate = true
    }
    if (emailConfig.subjectFilter !== expectedSubject) {
      emailConfig.subjectFilter = expectedSubject
      needsUpdate = true
    }
    if (emailConfig.fromEmail !== expectedFrom) {
      emailConfig.fromEmail = expectedFrom
      needsUpdate = true
    }
  } else {
    // Обновляем плоскую структуру
    if (emailConfig.useAnyLatestAttachment !== true) {
      emailConfig.useAnyLatestAttachment = true
      needsUpdate = true
    }
    if (emailConfig.subjectFilter !== expectedSubject) {
      emailConfig.subjectFilter = expectedSubject
      needsUpdate = true
    }
    if (emailConfig.fromEmail !== expectedFrom) {
      emailConfig.fromEmail = expectedFrom
      needsUpdate = true
    }
  }

  if (needsUpdate) {
    console.log(`\n🔧 Обновляем конфигурацию Аметиста...`)
    await prisma.supplier.update({
      where: { id: ametist.id },
      data: {
        emailConfig: JSON.stringify(emailConfig),
      },
    })
    console.log(`✅ Конфигурация обновлена:`)
    console.log(`   useAnyLatestAttachment: ${emailConfig.useAnyLatestAttachment || emailConfig.imap?.useAnyLatestAttachment}`)
    console.log(`   subjectFilter: "${emailConfig.subjectFilter || emailConfig.imap?.subjectFilter}"`)
    console.log(`   fromEmail: "${emailConfig.fromEmail || emailConfig.imap?.fromEmail}"`)
  }
  
  // Используем нормализованную конфигурацию для вывода
  const finalConfig = hasNestedStructure ? {
    fromEmail: emailConfig.fromEmail || '',
    subjectFilter: emailConfig.subjectFilter || '',
    useAnyLatestAttachment: emailConfig.useAnyLatestAttachment === true,
  } : normalizedConfig

  console.log(`\n✅ Все конфигурации проверены и исправлены!`)
  console.log(`\n📋 Итоговые настройки:`)
  console.log(`\nАметист:`)
  console.log(`   Method: email`)
  console.log(`   From: ${finalConfig.fromEmail}`)
  console.log(`   Subject: ${finalConfig.subjectFilter}`)
  console.log(`   Use Any Latest: ${finalConfig.useAnyLatestAttachment}`)
  console.log(`\nАртекс:`)
  console.log(`   Method: url`)
  console.log(`   URL: ${arteks.parsingUrl}`)
}

main()
  .catch((e) => {
    console.error('\n❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

