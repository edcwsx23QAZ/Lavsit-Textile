import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testUpdateLogic() {
  console.log('='.repeat(80))
  console.log('ТЕСТИРОВАНИЕ ЛОГИКИ ПОИСКА И ОБНОВЛЕНИЯ')
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
    
    console.log(`\n✅ Ткань найдена в БД:`)
    console.log(`   ID: ${dbFabric.id}`)
    console.log(`   Коллекция: "${dbFabric.collection}"`)
    console.log(`   Цвет: "${dbFabric.colorNumber}"`)
    console.log(`   Метраж: ${dbFabric.meterage}`)
    console.log(`   Длина коллекции: ${dbFabric.collection.length}`)
    console.log(`   Длина цвета: ${dbFabric.colorNumber.length}`)
    console.log(`   Коллекция (hex): ${Buffer.from(dbFabric.collection).toString('hex')}`)
    console.log(`   Цвет (hex): ${Buffer.from(dbFabric.colorNumber).toString('hex')}`)
    
    // Симулируем данные из парсера
    const parsedFabric = {
      collection: 'Заказные ткани',
      colorNumber: 'RETRO organza blue',
      meterage: 85.6,
      inStock: true,
      comment: null,
    }
    
    console.log(`\n📥 Данные из парсера:`)
    console.log(`   Коллекция: "${parsedFabric.collection}"`)
    console.log(`   Цвет: "${parsedFabric.colorNumber}"`)
    console.log(`   Метраж: ${parsedFabric.meterage}`)
    console.log(`   Длина коллекции: ${parsedFabric.collection.length}`)
    console.log(`   Длина цвета: ${parsedFabric.colorNumber.length}`)
    console.log(`   Коллекция (hex): ${Buffer.from(parsedFabric.collection).toString('hex')}`)
    console.log(`   Цвет (hex): ${Buffer.from(parsedFabric.colorNumber).toString('hex')}`)
    
    // Нормализуем как в функции обновления
    const normalizeKey = (collection: string, color: string) => {
      return `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
    }
    
    const dbKey = normalizeKey(dbFabric.collection, dbFabric.colorNumber)
    const parsedKey = normalizeKey(parsedFabric.collection, parsedFabric.colorNumber)
    
    console.log(`\n🔍 Сравнение ключей:`)
    console.log(`   Ключ БД: "${dbKey}"`)
    console.log(`   Ключ парсера: "${parsedKey}"`)
    console.log(`   Совпадают: ${dbKey === parsedKey}`)
    
    // Проверяем посимвольно
    console.log(`\n🔍 Посимвольное сравнение коллекции:`)
    const dbCollection = dbFabric.collection.trim().toLowerCase()
    const parsedCollection = parsedFabric.collection.trim().toLowerCase()
    console.log(`   БД: "${dbCollection}" (${dbCollection.length} символов)`)
    console.log(`   Парсер: "${parsedCollection}" (${parsedCollection.length} символов)`)
    
    if (dbCollection !== parsedCollection) {
      console.log(`   ❌ НЕ СОВПАДАЮТ!`)
      for (let i = 0; i < Math.max(dbCollection.length, parsedCollection.length); i++) {
        const dbChar = dbCollection[i] || '?'
        const parsedChar = parsedCollection[i] || '?'
        if (dbChar !== parsedChar) {
          console.log(`   Позиция ${i}: БД="${dbChar}" (${dbChar.charCodeAt(0)}), Парсер="${parsedChar}" (${parsedChar.charCodeAt(0)})`)
        }
      }
    } else {
      console.log(`   ✅ Совпадают`)
    }
    
    console.log(`\n🔍 Посимвольное сравнение цвета:`)
    const dbColor = dbFabric.colorNumber.trim().toLowerCase()
    const parsedColor = parsedFabric.colorNumber.trim().toLowerCase()
    console.log(`   БД: "${dbColor}" (${dbColor.length} символов)`)
    console.log(`   Парсер: "${parsedColor}" (${parsedColor.length} символов)`)
    
    if (dbColor !== parsedColor) {
      console.log(`   ❌ НЕ СОВПАДАЮТ!`)
      for (let i = 0; i < Math.max(dbColor.length, parsedColor.length); i++) {
        const dbChar = dbColor[i] || '?'
        const parsedChar = parsedColor[i] || '?'
        if (dbChar !== parsedChar) {
          console.log(`   Позиция ${i}: БД="${dbChar}" (${dbChar.charCodeAt(0)}), Парсер="${parsedChar}" (${parsedChar.charCodeAt(0)})`)
        }
      }
    } else {
      console.log(`   ✅ Совпадают`)
    }
    
    // Проверяем поиск как в функции обновления
    const allFabrics = await prisma.fabric.findMany({
      where: { 
        supplierId: supplier.id,
        excludedFromParsing: false,
      },
      select: {
        id: true,
        collection: true,
        colorNumber: true,
      },
    })
    
    const normalizedCollection = parsedFabric.collection.trim().toLowerCase()
    const normalizedColor = parsedFabric.colorNumber.trim().toLowerCase()
    
    const existing = allFabrics.find(f => 
      f.collection.trim().toLowerCase() === normalizedCollection &&
      f.colorNumber.trim().toLowerCase() === normalizedColor
    )
    
    console.log(`\n🔍 Результат поиска в функции обновления:`)
    if (existing) {
      console.log(`   ✅ Ткань найдена: ID=${existing.id}`)
      console.log(`   Коллекция БД: "${existing.collection}"`)
      console.log(`   Цвет БД: "${existing.colorNumber}"`)
    } else {
      console.log(`   ❌ Ткань НЕ найдена!`)
      console.log(`   Искали: коллекция="${normalizedCollection}", цвет="${normalizedColor}"`)
      console.log(`\n   Похожие ткани в БД:`)
      const similar = allFabrics.filter(f => 
        f.colorNumber.toLowerCase().includes('organza')
      )
      similar.forEach(f => {
        const fCollection = f.collection.trim().toLowerCase()
        const fColor = f.colorNumber.trim().toLowerCase()
        console.log(`     - "${f.collection}" - "${f.colorNumber}"`)
        console.log(`       Нормализовано: "${fCollection}" - "${fColor}"`)
        console.log(`       Совпадает коллекция: ${fCollection === normalizedCollection}`)
        console.log(`       Совпадает цвет: ${fColor === normalizedColor}`)
      })
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

testUpdateLogic().catch(console.error)


