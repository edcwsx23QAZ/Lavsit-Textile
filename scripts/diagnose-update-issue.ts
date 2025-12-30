import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnoseUpdateIssue() {
  console.log('='.repeat(80))
  console.log('ДИАГНОСТИКА ПРОБЛЕМЫ ОБНОВЛЕНИЯ МЕТРАЖА')
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
    
    // Находим ткань в БД
    const dbFabric = await prisma.fabric.findFirst({
      where: {
        supplierId: supplier.id,
        colorNumber: {
          contains: 'organza',
        },
      },
    })
    
    if (!dbFabric) {
      console.error('❌ Ткань не найдена в БД')
      return
    }
    
    console.log(`\n📊 Текущее состояние в БД:`)
    console.log(`   ID: ${dbFabric.id}`)
    console.log(`   Коллекция: "${dbFabric.collection}"`)
    console.log(`   Цвет: "${dbFabric.colorNumber}"`)
    console.log(`   Метраж: ${dbFabric.meterage} (тип: ${typeof dbFabric.meterage})`)
    console.log(`   В наличии: ${dbFabric.inStock}`)
    console.log(`   Последнее обновление: ${dbFabric.lastUpdatedAt}`)
    
    // Симулируем данные из парсера
    const parsedFabric = {
      collection: 'Заказные ткани',
      colorNumber: 'RETRO organza blue',
      meterage: 85.6,
      inStock: true,
    }
    
    console.log(`\n📥 Данные из парсера (симулированные):`)
    console.log(`   Коллекция: "${parsedFabric.collection}"`)
    console.log(`   Цвет: "${parsedFabric.colorNumber}"`)
    console.log(`   Метраж: ${parsedFabric.meterage} (тип: ${typeof parsedFabric.meterage})`)
    console.log(`   В наличии: ${parsedFabric.inStock}`)
    
    // Проверяем сравнение как в shouldUpdateFromParser
    const normalizeKey = (collection: string, color: string) => {
      return `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
    }
    
    const dbKey = normalizeKey(dbFabric.collection, dbFabric.colorNumber)
    const parsedKey = normalizeKey(parsedFabric.collection, parsedFabric.colorNumber)
    
    console.log(`\n🔍 Сравнение ключей:`)
    console.log(`   Ключ БД: "${dbKey}"`)
    console.log(`   Ключ парсера: "${parsedKey}"`)
    console.log(`   Совпадают: ${dbKey === parsedKey}`)
    
    // Проверяем сравнение метража
    const existingMeterage = dbFabric.meterage ?? null
    const parsedMeterage = parsedFabric.meterage ?? null
    
    let meterageChanged = false
    if (existingMeterage === null && parsedMeterage === null) {
      meterageChanged = false
    } else if (existingMeterage === null || parsedMeterage === null) {
      meterageChanged = true
    } else {
      meterageChanged = Math.abs(existingMeterage - parsedMeterage) > 0.01
    }
    
    console.log(`\n🔍 Сравнение метража:`)
    console.log(`   БД: ${existingMeterage} (тип: ${typeof existingMeterage})`)
    console.log(`   Парсер: ${parsedMeterage} (тип: ${typeof parsedMeterage})`)
    console.log(`   Разница: ${existingMeterage !== null && parsedMeterage !== null ? Math.abs(existingMeterage - parsedMeterage) : 'N/A'}`)
    console.log(`   Изменился? ${meterageChanged}`)
    
    if (meterageChanged) {
      console.log(`\n✅ shouldUpdateFromParser вернет true - обновление должно произойти`)
      
      // Принудительно обновляем метраж
      console.log(`\n🔄 Принудительно обновляем метраж...`)
      await prisma.fabric.update({
        where: { id: dbFabric.id },
        data: {
          meterage: 85.6,
          lastUpdatedAt: new Date(),
        },
      })
      
      console.log(`\n✅ Метраж обновлен на 85.6`)
      
      // Проверяем результат
      const updatedFabric = await prisma.fabric.findUnique({
        where: { id: dbFabric.id },
        select: { meterage: true, lastUpdatedAt: true },
      })
      
      console.log(`\n📊 Результат после обновления:`)
      console.log(`   Метраж: ${updatedFabric?.meterage}`)
      console.log(`   Последнее обновление: ${updatedFabric?.lastUpdatedAt}`)
    } else {
      console.log(`\n❌ shouldUpdateFromParser вернет false - обновление НЕ произойдет!`)
      console.log(`   Это означает, что функция считает, что данные не изменились`)
      console.log(`   Возможные причины:`)
      console.log(`   1. Парсер возвращает 100 вместо 85.6`)
      console.log(`   2. Сравнение не работает корректно`)
      console.log(`   3. Значения считаются одинаковыми из-за округления`)
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

diagnoseUpdateIssue().catch(console.error)

