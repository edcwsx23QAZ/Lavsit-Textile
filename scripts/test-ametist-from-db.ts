/**
 * Тестирование парсера Аметиста на основе данных из базы
 */

import { PrismaClient } from '@prisma/client'
import { AmetistParser } from '../lib/parsers/ametist-parser'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Тестирование парсера Аметиста (из базы данных)...\n')

  // Находим поставщика Аметист
  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
    include: {
      emailAttachments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!ametist) {
    console.log('❌ Поставщик Аметист не найден')
    process.exit(1)
  }

  console.log(`✅ Поставщик найден: ${ametist.name} (ID: ${ametist.id})\n`)

  // Проверяем вложения
  if (!ametist.emailAttachments || ametist.emailAttachments.length === 0) {
    console.log('❌ Вложения не найдены в базе данных')
    console.log('   Попробуйте запустить парсинг через API: POST /api/suppliers/' + ametist.id + '/parse')
    process.exit(1)
  }

  console.log(`📎 Найдено вложений: ${ametist.emailAttachments.length}\n`)

  // Берем последнее вложение
  const latestAttachment = ametist.emailAttachments[0]
  console.log(`📧 Последнее вложение:`)
  console.log(`   ID: ${latestAttachment.id}`)
  console.log(`   Файл: ${latestAttachment.filename}`)
  console.log(`   Дата: ${latestAttachment.createdAt.toLocaleString('ru-RU')}`)
  console.log(`   Путь: ${latestAttachment.filePath || 'не указан'}\n`)

  // Проверяем путь к файлу
  let filePath = latestAttachment.filePath

  if (!filePath) {
    // Пробуем стандартный путь
    const uploadsDir = path.join(process.cwd(), 'uploads', 'email-attachments', ametist.id)
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
  const parser = new AmetistParser(ametist.id, ametist.name)
  
  try {
    const isValid = await parser.validateFile(filePath)
    
    if (!isValid) {
      console.log('❌ Файл не прошел валидацию')
      process.exit(1)
    }

    console.log('✅ Файл валиден (ZIP архив с Excel файлом внутри)\n')
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
    console.log(`   Запустите: POST /api/suppliers/${ametist.id}/analyze`)
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
    console.log(`📊 Примеры найденных тканей (первые 15):`)
    fabrics.slice(0, 15).forEach((fabric, idx) => {
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
    console.log(`   В наличии: ${inStock} (${((inStock / fabrics.length) * 100).toFixed(1)}%)`)
    console.log(`   С метражем: ${withMeterage} (${((withMeterage / fabrics.length) * 100).toFixed(1)}%)`)
    console.log(`   С коллекцией: ${withCollection} (${((withCollection / fabrics.length) * 100).toFixed(1)}%)`)
  } else {
    console.log('⚠️ Ткани не найдены - возможно проблема с правилами парсинга')
    console.log(`   Проверьте правила или запустите анализ: POST /api/suppliers/${ametist.id}/analyze`)
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

