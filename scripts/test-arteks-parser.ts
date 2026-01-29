/**
 * Тестирование парсера Артекс
 */

import { PrismaClient } from '@prisma/client'
import { ArteksParser } from '../lib/parsers/arteks-parser'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 Тестирование парсера Артекс...\n')

  // Находим поставщика Артекс
  const arteks = await prisma.supplier.findFirst({
    where: { name: 'Артекс' },
  })

  if (!arteks) {
    console.log('❌ Поставщик Артекс не найден')
    process.exit(1)
  }

  console.log(`✅ Поставщик найден: ${arteks.name} (ID: ${arteks.id})`)
  console.log(`   URL: ${arteks.parsingUrl || 'не указан'}\n`)

  // Создаем парсер
  const parser = new ArteksParser(arteks.id, arteks.name)

  // Получаем URL для парсинга
  const parsingUrl = arteks.parsingUrl
  if (!parsingUrl) {
    console.log('❌ URL для парсинга не указан')
    process.exit(1)
  }

  console.log(`📥 URL для парсинга: ${parsingUrl}\n`)

  // Парсим файл (парсер сам скачает файл с перебором дат)
  console.log('🔄 Парсинг файла (с автоматическим скачиванием)...')
  let fabrics
  try {
    fabrics = await parser.parse(parsingUrl)
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
      console.log(`\n📚 Найденные коллекции (первые 20):`)
      uniqueCollections.slice(0, 20).forEach((col, idx) => {
        console.log(`   ${idx + 1}. ${col}`)
      })
      if (uniqueCollections.length > 20) {
        console.log(`   ... и еще ${uniqueCollections.length - 20} коллекций`)
      }
    }
  } else {
    console.log('⚠️ Ткани не найдены - возможно проблема с правилами парсинга')
    console.log(`   Проверьте правила или запустите анализ: POST /api/suppliers/${arteks.id}/analyze`)
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

