import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function simulateUpdate() {
  console.log('='.repeat(80))
  console.log('СИМУЛЯЦИЯ ОБНОВЛЕНИЯ ДЛЯ RETRO organza blue')
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
    
    // Получаем все ткани поставщика
    const existingFabrics = await prisma.fabric.findMany({
      where: { supplierId: supplier.id },
      select: {
        collection: true,
        colorNumber: true,
        inStock: true,
        meterage: true,
      },
    })
    
    console.log(`\n📊 Тканей в базе: ${existingFabrics.length}`)
    
    // Симулируем данные из парсера (как будто парсер вернул 85.6)
    const parsedFabrics = existingFabrics.map(f => ({
      ...f,
      // Для RETRO organza blue меняем метраж на 85.6
      meterage: (f.colorNumber.toLowerCase().includes('organza') && 
                 f.colorNumber.toLowerCase().includes('blue'))
        ? 85.6
        : f.meterage,
    }))
    
    // Находим RETRO organza в симулированных данных
    const retroOrganzaParsed = parsedFabrics.find(f => 
      f.colorNumber.toLowerCase().includes('organza') && 
      f.colorNumber.toLowerCase().includes('blue')
    )
    
    const retroOrganzaExisting = existingFabrics.find(f => 
      f.colorNumber.toLowerCase().includes('organza') && 
      f.colorNumber.toLowerCase().includes('blue')
    )
    
    if (retroOrganzaParsed && retroOrganzaExisting) {
      console.log(`\n🎯 RETRO organza blue:`)
      console.log(`   В БД: метраж = ${retroOrganzaExisting.meterage}`)
      console.log(`   В парсере: метраж = ${retroOrganzaParsed.meterage}`)
      console.log(`   Изменился? ${retroOrganzaExisting.meterage !== retroOrganzaParsed.meterage}`)
    }
    
    // Симулируем логику shouldUpdateFromParser
    const normalizeKey = (collection: string, color: string) => {
      return `${collection.trim().toLowerCase()}|${color.trim().toLowerCase()}`
    }
    
    const existingKeys = new Set(
      existingFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
    )
    const parsedKeys = new Set(
      parsedFabrics.map(f => normalizeKey(f.collection, f.colorNumber))
    )
    
    console.log(`\n🔍 Сравнение ключей:`)
    console.log(`   В базе: ${existingKeys.size}`)
    console.log(`   В парсере: ${parsedKeys.size}`)
    console.log(`   Количество совпадает? ${existingKeys.size === parsedKeys.size}`)
    
    // Проверяем изменения
    let hasChanges = false
    let changesCount = 0
    
    for (const parsed of parsedFabrics) {
      const key = normalizeKey(parsed.collection, parsed.colorNumber)
      const existing = existingFabrics.find(
        f => normalizeKey(f.collection, f.colorNumber) === key
      )
      
      if (!existing) {
        hasChanges = true
        changesCount++
        console.log(`\n   ⚠️  Новая ткань: ${parsed.collection} - ${parsed.colorNumber}`)
        continue
      }
      
      if (existing.inStock !== parsed.inStock) {
        hasChanges = true
        changesCount++
        console.log(`\n   ⚠️  Изменилось наличие: ${parsed.collection} - ${parsed.colorNumber}`)
        continue
      }
      
      if (existing.meterage !== parsed.meterage) {
        hasChanges = true
        changesCount++
        const isRetro = parsed.colorNumber.toLowerCase().includes('organza') || 
                       parsed.colorNumber.toLowerCase().includes('retro')
        const marker = isRetro ? '🎯' : '  '
        console.log(`\n${marker} Изменился метраж: ${parsed.collection} - ${parsed.colorNumber}`)
        console.log(`      Было: ${existing.meterage}, Стало: ${parsed.meterage}`)
        continue
      }
    }
    
    console.log(`\n📊 ИТОГО:`)
    console.log(`   Есть изменения: ${hasChanges}`)
    console.log(`   Количество изменений: ${changesCount}`)
    console.log(`   shouldUpdateFromParser вернет: ${hasChanges}`)
    
    if (!hasChanges) {
      console.log(`\n❌ ПРОБЛЕМА: shouldUpdateFromParser вернет false, обновление не произойдет!`)
      console.log(`   Это означает, что функция считает, что данные не изменились`)
    } else {
      console.log(`\n✅ shouldUpdateFromParser вернет true, обновление должно произойти`)
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

simulateUpdate().catch(console.error)

