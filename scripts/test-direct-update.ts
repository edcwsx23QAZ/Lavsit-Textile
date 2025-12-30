import { PrismaClient } from '@prisma/client'
import { updateFabricsFromParser } from '@/lib/manual-upload-utils'
import { AmetistParser } from '@/lib/parsers/ametist-parser'

const prisma = new PrismaClient()

async function testDirectUpdate() {
  console.log('='.repeat(80))
  console.log('ПРЯМОЕ ТЕСТИРОВАНИЕ ОБНОВЛЕНИЯ ЧЕРЕЗ updateFabricsFromParser')
  console.log('='.repeat(80))
  
  try {
    // Находим поставщика
    const allSuppliers = await prisma.supplier.findMany()
    const supplier = allSuppliers.find(s => 
      s.name.toLowerCase().includes('аметист') || s.name.toLowerCase().includes('ametist')
    )
    
    if (!supplier) {
      console.error('❌ Поставщик не найден')
      return
    }
    
    console.log(`\n✅ Поставщик: ${supplier.name} (ID: ${supplier.id})`)
    
    // Проверяем текущее значение в БД
    const dbFabric = await prisma.fabric.findFirst({
      where: {
        supplierId: supplier.id,
        colorNumber: {
          contains: 'organza',
        },
      },
    })
    
    if (dbFabric) {
      console.log(`\n📊 Текущее значение в БД:`)
      console.log(`   Метраж: ${dbFabric.meterage}`)
      console.log(`   В наличии: ${dbFabric.inStock}`)
      console.log(`   Последнее обновление: ${dbFabric.lastUpdatedAt}`)
    }
    
    // Загружаем правила парсинга
    const rules = await prisma.parsingRule.findMany({
      where: { supplierId: supplier.id },
    })
    
    console.log(`\n📋 Правил парсинга: ${rules.length}`)
    
    // Находим файл для парсинга (используем последний загруженный файл или путь из правил)
    // Для теста используем путь из правил или стандартный путь
    const filePath = rules.find(r => r.filePath)?.filePath || 
                     'uploads/ametist.xlsx' // Замените на реальный путь
    
    console.log(`\n📁 Путь к файлу: ${filePath}`)
    console.log(`⚠️  ВНИМАНИЕ: Убедитесь, что файл существует по этому пути`)
    
    // Создаем парсер
    const parser = new AmetistParser(supplier.id, rules)
    
    // Парсим файл
    console.log(`\n🔄 Запуск парсинга...`)
    const parsedFabrics = await parser.parse(filePath)
    
    console.log(`\n✅ Парсинг завершен. Найдено тканей: ${parsedFabrics.length}`)
    
    // Ищем RETRO organza blue в результатах парсинга
    const retroOrganza = parsedFabrics.find(f => 
      f.colorNumber.toLowerCase().includes('organza') && 
      f.colorNumber.toLowerCase().includes('blue')
    )
    
    if (retroOrganza) {
      console.log(`\n🎯 Найдена ткань "RETRO organza blue" в результатах парсинга:`)
      console.log(`   Коллекция: "${retroOrganza.collection}"`)
      console.log(`   Цвет: "${retroOrganza.colorNumber}"`)
      console.log(`   Метраж: ${retroOrganza.meterage} (тип: ${typeof retroOrganza.meterage})`)
      console.log(`   В наличии: ${retroOrganza.inStock}`)
    } else {
      console.log(`\n⚠️  Ткань "RETRO organza blue" не найдена в результатах парсинга`)
      console.log(`   Похожие ткани:`)
      parsedFabrics
        .filter(f => f.colorNumber.toLowerCase().includes('organza'))
        .slice(0, 5)
        .forEach(f => {
          console.log(`     - "${f.collection}" - "${f.colorNumber}": метраж = ${f.meterage}`)
        })
    }
    
    // Вызываем updateFabricsFromParser
    console.log(`\n🔄 Запуск updateFabricsFromParser...`)
    const updatedCount = await updateFabricsFromParser(supplier.id, parsedFabrics)
    
    console.log(`\n✅ Обновлено тканей: ${updatedCount}`)
    
    // Проверяем значение в БД после обновления
    const updatedFabric = await prisma.fabric.findFirst({
      where: {
        supplierId: supplier.id,
        colorNumber: {
          contains: 'organza',
        },
      },
    })
    
    if (updatedFabric) {
      console.log(`\n📊 Значение в БД после обновления:`)
      console.log(`   Метраж: ${updatedFabric.meterage}`)
      console.log(`   В наличии: ${updatedFabric.inStock}`)
      console.log(`   Последнее обновление: ${updatedFabric.lastUpdatedAt}`)
      
      if (updatedFabric.meterage === 85.6 || Math.abs((updatedFabric.meterage || 0) - 85.6) < 0.1) {
        console.log(`\n✅ УСПЕХ: Метраж обновлен корректно!`)
      } else if (updatedFabric.meterage === 100) {
        console.log(`\n❌ ПРОБЛЕМА: Метраж все еще 100, обновление не произошло`)
      } else {
        console.log(`\n⚠️  Метраж: ${updatedFabric.meterage} (ожидалось 85.6)`)
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testDirectUpdate().catch(console.error)

