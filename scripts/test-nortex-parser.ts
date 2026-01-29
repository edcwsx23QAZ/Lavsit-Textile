/**
 * Тестирование парсера Нортекс на основе данных из базы
 */

import { PrismaClient } from '@prisma/client'
import { EmailExcelParser } from '../lib/parsers/email-excel-parser'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Тестирование парсера Нортекс (из базы данных)...\n')

  // Находим поставщика Нортекс
  const nortex = await prisma.supplier.findFirst({
    where: { name: 'Нортекс' },
    include: {
      emailAttachments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!nortex) {
    console.log('❌ Поставщик Нортекс не найден')
    process.exit(1)
  }

  console.log(`✅ Поставщик найден: ${nortex.name} (ID: ${nortex.id})\n`)

  // Проверяем вложения
  if (!nortex.emailAttachments || nortex.emailAttachments.length === 0) {
    console.log('❌ Вложения не найдены в базе данных')
    console.log('   Попробуйте запустить парсинг через API: POST /api/suppliers/' + nortex.id + '/parse')
    process.exit(1)
  }

  console.log(`📎 Найдено вложений: ${nortex.emailAttachments.length}\n`)

  // Показываем все вложения
  console.log(`📧 Все вложения (от новых к старым):`)
  nortex.emailAttachments.forEach((att, idx) => {
    const date = att.createdAt.toLocaleString('ru-RU')
    console.log(`   ${idx + 1}. Файл: ${att.filename}`)
    console.log(`      Дата: ${date}`)
    console.log(`      Путь: ${att.filePath || 'не указан'}`)
  })

  // Берем последнее вложение
  const latestAttachment = nortex.emailAttachments[0]
  console.log(`\n📧 Обрабатываем последнее вложение:`)
  console.log(`   ID: ${latestAttachment.id}`)
  console.log(`   Файл: ${latestAttachment.filename}`)
  console.log(`   Дата: ${latestAttachment.createdAt.toLocaleString('ru-RU')}`)
  console.log(`   Путь: ${latestAttachment.filePath || 'не указан'}\n`)

  // Проверяем путь к файлу
  let filePath = latestAttachment.filePath

  if (!filePath) {
    // Пробуем стандартный путь
    const uploadsDir = path.join(process.cwd(), 'uploads', 'email-attachments', nortex.id)
    const possiblePath = path.join(uploadsDir, latestAttachment.filename)
    
    if (fs.existsSync(possiblePath)) {
      filePath = possiblePath
      console.log(`✅ Файл найден по стандартному пути: ${filePath}\n`)
    } else {
      console.log(`❌ Файл не найден. Проверьте путь: ${possiblePath}`)
      console.log(`   Или запустите парсинг через API для автоматической загрузки`)
      process.exit(1)
    }
  } else {
    // Проверяем, существует ли файл
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ Файл по указанному пути не существует: ${filePath}`)
      // Пробуем относительный путь
      const relativePath = path.join(process.cwd(), filePath)
      if (fs.existsSync(relativePath)) {
        filePath = relativePath
        console.log(`✅ Файл найден по относительному пути: ${filePath}\n`)
      } else {
        console.log(`❌ Файл не найден ни по одному пути`)
        process.exit(1)
      }
    } else {
      console.log(`✅ Файл найден: ${filePath}\n`)
    }
  }

  // Проверяем размер файла
  const stats = fs.statSync(filePath)
  console.log(`📊 Информация о файле:`)
  console.log(`   Размер: ${(stats.size / 1024).toFixed(2)} KB`)
  console.log(`   Изменен: ${stats.mtime.toLocaleString('ru-RU')}\n`)

  // Валидация файла
  console.log(`🔍 Валидация файла...`)
  const parser = new EmailExcelParser(nortex.id, nortex.name)
  
  try {
    const isValid = await parser.validateFile(filePath)
    
    if (!isValid) {
      console.log('❌ Файл не прошел валидацию')
      process.exit(1)
    }

    console.log('✅ Файл валиден (Excel файл)\n')
  } catch (error: any) {
    console.log(`❌ Ошибка валидации: ${error.message}`)
    console.log(`   Детали:`, error)
    process.exit(1)
  }

  // Загружаем правила парсинга
  console.log('📋 Загрузка правил парсинга...')
  const rules = await parser.loadRules()
  
  if (!rules) {
    console.log('⚠️ Правила не найдены, требуется анализ')
    console.log(`   Запустите: POST /api/suppliers/${nortex.id}/analyze`)
    process.exit(1)
  }

  console.log('✅ Правила загружены')
  console.log(`   Правил: ${rules.length}\n`)

  // Парсим файл
  console.log('🔄 Парсинг файла...')
  let fabrics
  try {
    fabrics = await parser.parse(filePath)
  } catch (error: any) {
    console.log(`❌ Ошибка парсинга: ${error.message}`)
    console.log(`   Детали:`, error)
    process.exit(1)
  }
  
  console.log(`\n✅ Парсинг завершен!`)
  console.log(`   Найдено тканей: ${fabrics.length}\n`)

  if (fabrics.length > 0) {
    console.log(`📊 Примеры найденных тканей (первые 20):`)
    fabrics.slice(0, 20).forEach((fabric, idx) => {
      console.log(`\n   ${idx + 1}. Коллекция: "${fabric.collection || 'нет'}"`)
      console.log(`      Артикул/Цвет: "${fabric.colorNumber || 'нет'}"`)
      console.log(`      В наличии: ${fabric.inStock ? '✅ Да' : '❌ Нет'}`)
      console.log(`      Метраж: ${fabric.meterage || 'нет'}`)
      console.log(`      Комментарий: ${fabric.comment || 'нет'}`)
    })

    // Статистика
    const inStock = fabrics.filter(f => f.inStock).length
    const withMeterage = fabrics.filter(f => f.meterage).length
    const withCollection = fabrics.filter(f => f.collection).length
    
    console.log(`\n📈 Статистика:`)
    console.log(`   Всего тканей: ${fabrics.length}`)
    console.log(`   В наличии: ${inStock} (${fabrics.length > 0 ? ((inStock / fabrics.length) * 100).toFixed(1) : 0}%)`)
    console.log(`   С метражем: ${withMeterage} (${fabrics.length > 0 ? ((withMeterage / fabrics.length) * 100).toFixed(1) : 0}%)`)
    console.log(`   С коллекцией: ${withCollection} (${fabrics.length > 0 ? ((withCollection / fabrics.length) * 100).toFixed(1) : 0}%)`)

    // Показываем уникальные коллекции
    const uniqueCollections = [...new Set(fabrics.map(f => f.collection).filter(Boolean))]
    if (uniqueCollections.length > 0) {
      console.log(`\n📚 Найденные коллекции (${uniqueCollections.length}):`)
      uniqueCollections.slice(0, 20).forEach((col, idx) => {
        console.log(`   ${idx + 1}. ${col}`)
      })
      if (uniqueCollections.length > 20) {
        console.log(`   ... и еще ${uniqueCollections.length - 20} коллекций`)
      }
    }
  } else {
    console.log('⚠️ Ткани не найдены - возможно проблема с правилами парсинга')
    console.log(`   Проверьте правила или запустите анализ: POST /api/suppliers/${nortex.id}/analyze`)
  }

  console.log('\n✅ Тестирование завершено успешно!')
}

main()
  .catch((e) => {
    console.error('\n❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
