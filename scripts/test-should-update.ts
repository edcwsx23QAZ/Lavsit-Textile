import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testShouldUpdate() {
  console.log('='.repeat(80))
  console.log('ТЕСТИРОВАНИЕ ЛОГИКИ shouldUpdateFromParser')
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
    
    console.log(`\n✅ Ткань в БД:`)
    console.log(`   Метраж: ${dbFabric.meterage} (тип: ${typeof dbFabric.meterage})`)
    console.log(`   В наличии: ${dbFabric.inStock}`)
    
    // Симулируем данные из парсера
    const parsedFabric = {
      collection: 'Заказные ткани',
      colorNumber: 'RETRO organza blue',
      meterage: 85.6,
      inStock: true,
      comment: null,
    }
    
    console.log(`\n📥 Данные из парсера:`)
    console.log(`   Метраж: ${parsedFabric.meterage} (тип: ${typeof parsedFabric.meterage})`)
    console.log(`   В наличии: ${parsedFabric.inStock}`)
    
    // Проверяем сравнение как в shouldUpdateFromParser
    console.log(`\n🔍 Сравнение:`)
    console.log(`   inStock БД: ${dbFabric.inStock}, inStock парсер: ${parsedFabric.inStock}`)
    console.log(`   inStock совпадают: ${dbFabric.inStock === parsedFabric.inStock}`)
    
    console.log(`   meterage БД: ${dbFabric.meterage}, meterage парсер: ${parsedFabric.meterage}`)
    console.log(`   meterage совпадают: ${dbFabric.meterage === parsedFabric.meterage}`)
    console.log(`   meterage !== parsedFabric.meterage: ${dbFabric.meterage !== parsedFabric.meterage}`)
    
    // Проверяем с учетом типов
    console.log(`\n🔍 Детальное сравнение метража:`)
    console.log(`   dbFabric.meterage === parsedFabric.meterage: ${dbFabric.meterage === parsedFabric.meterage}`)
    console.log(`   dbFabric.meterage !== parsedFabric.meterage: ${dbFabric.meterage !== parsedFabric.meterage}`)
    console.log(`   Math.abs(dbFabric.meterage - parsedFabric.meterage): ${Math.abs((dbFabric.meterage || 0) - (parsedFabric.meterage || 0))}`)
    
    // Проверяем логику shouldUpdateFromParser
    const shouldUpdate = 
      dbFabric.inStock !== parsedFabric.inStock ||
      dbFabric.meterage !== parsedFabric.meterage
    
    console.log(`\n📊 Результат shouldUpdateFromParser:`)
    console.log(`   Должно обновляться: ${shouldUpdate}`)
    
    if (!shouldUpdate) {
      console.log(`\n❌ ПРОБЛЕМА: shouldUpdateFromParser вернет false!`)
      console.log(`   Это означает, что обновление не произойдет`)
      console.log(`   Причина: значения считаются одинаковыми`)
    } else {
      console.log(`\n✅ shouldUpdateFromParser вернет true`)
      console.log(`   Обновление должно произойти`)
    }
    
    // Проверяем, есть ли активная ручная загрузка
    const activeStockUpload = await prisma.manualUpload.findFirst({
      where: {
        supplierId: supplier.id,
        type: 'stock',
        isActive: true,
      },
    })
    
    console.log(`\n📋 Активная ручная загрузка:`)
    if (activeStockUpload) {
      console.log(`   ✅ Найдена: ID=${activeStockUpload.id}`)
      console.log(`   Это может блокировать обновление из парсера`)
    } else {
      console.log(`   ❌ Не найдена`)
      console.log(`   Обновление из парсера должно работать`)
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testShouldUpdate().catch(console.error)

