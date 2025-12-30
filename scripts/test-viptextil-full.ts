import { PrismaClient } from '@prisma/client'
import { ViptextilParser } from '../lib/parsers/viptextil-parser'
import { updateFabricsFromParser } from '../lib/manual-upload-utils'

const prisma = new PrismaClient()

async function testFullFlow() {
  const url = 'http://tgn1.viptextil.ru/vip/ostatki.html'
  
  try {
    console.log('=== ПОЛНОЕ ТЕСТИРОВАНИЕ VIPTEXTIL (с сохранением в БД) ===\n')
    
    // Находим поставщика
    const supplier = await prisma.supplier.findFirst({
      where: { name: 'Viptextil' }
    })
    
    if (!supplier) {
      console.log('❌ Поставщик Viptextil не найден в БД')
      return
    }
    
    console.log(`✓ Поставщик найден: ${supplier.name} (ID: ${supplier.id})`)
    
    // Проверяем текущее количество тканей
    const beforeCount = await prisma.fabric.count({
      where: { supplierId: supplier.id }
    })
    console.log(`Тканей в БД до парсинга: ${beforeCount}\n`)
    
    // Создаем парсер
    const parser = new ViptextilParser(supplier.id, supplier.name)
    
    // Запускаем парсинг
    console.log('Запускаем парсинг...')
    const parsedFabrics = await parser.parse(url)
    
    console.log(`\nПарсер вернул ${parsedFabrics.length} тканей\n`)
    
    if (parsedFabrics.length === 0) {
      console.log('❌ Парсер не вернул ни одной ткани!')
      return
    }
    
    // Показываем примеры
    console.log('Примеры тканей из парсера (первые 10):')
    parsedFabrics.slice(0, 10).forEach((f, i) => {
      console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
    })
    
    // Проверяем примеры Pegas
    const pegasFabrics = parsedFabrics.filter(f => f.collection.toLowerCase() === 'pegas')
    console.log(`\nНайдено тканей Pegas: ${pegasFabrics.length}`)
    if (pegasFabrics.length > 0) {
      pegasFabrics.slice(0, 5).forEach((f, i) => {
        console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
      })
    }
    
    // Сохраняем в БД
    console.log('\n=== СОХРАНЕНИЕ В БД ===\n')
    const updatedCount = await updateFabricsFromParser(supplier.id, parsedFabrics)
    
    console.log(`\nОбновлено/создано тканей: ${updatedCount}`)
    
    // Проверяем количество после парсинга
    const afterCount = await prisma.fabric.count({
      where: { supplierId: supplier.id }
    })
    console.log(`Тканей в БД после парсинга: ${afterCount}`)
    console.log(`Изменение: ${afterCount - beforeCount}`)
    
    // Проверяем примеры Pegas в БД
    const pegasInDb = await prisma.fabric.findMany({
      where: {
        supplierId: supplier.id,
        collection: { equals: 'Pegas', mode: 'insensitive' }
      },
      take: 5
    })
    
    console.log(`\nТканей Pegas в БД: ${pegasInDb.length}`)
    if (pegasInDb.length > 0) {
      pegasInDb.forEach((f, i) => {
        console.log(`  ${i + 1}. "${f.collection}" "${f.colorNumber}" - ${f.isAvailable ? 'В наличии' : 'Не в наличии'}`)
      })
    }
    
    // Проверяем конкретные примеры
    console.log('\n=== ПРОВЕРКА КОНКРЕТНЫХ ПРИМЕРОВ ===\n')
    const testCases = [
      { collection: 'Pegas', color: 'silk' },
      { collection: 'Pegas', color: 'silver' },
      { collection: 'Pegas', color: 'stone' },
    ]
    
    for (const testCase of testCases) {
      const found = await prisma.fabric.findFirst({
        where: {
          supplierId: supplier.id,
          collection: { equals: testCase.collection, mode: 'insensitive' },
          colorNumber: { equals: testCase.color, mode: 'insensitive' }
        }
      })
      
      if (found) {
        console.log(`✓ Найдено: "${found.collection}" "${found.colorNumber}" - ${found.isAvailable ? 'В наличии' : 'Не в наличии'}`)
      } else {
        console.log(`❌ Не найдено: "${testCase.collection}" "${testCase.color}"`)
      }
    }
    
  } catch (error: any) {
    console.error('❌ Ошибка:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testFullFlow()


