import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkRetroOrganza() {
  console.log('='.repeat(80))
  console.log('ПРОВЕРКА ТКАНИ "RETRO organza blue" В БАЗЕ ДАННЫХ')
  console.log('='.repeat(80))
  
  try {
    // 1. Находим поставщика Аметист
    const allSuppliers = await prisma.supplier.findMany()
    const supplier = allSuppliers.find(s => 
      s.name.toLowerCase().includes('аметист') || s.name.toLowerCase().includes('ametist')
    )
    
    if (!supplier) {
      console.error('❌ Поставщик Аметист не найден')
      return
    }
    
    console.log(`\n✅ Поставщик: ${supplier.name} (ID: ${supplier.id})`)
    
    // 2. Ищем все ткани с "organza" или "retro"
    const allFabrics = await prisma.fabric.findMany({
      where: {
        supplierId: supplier.id,
      },
    })
    
    console.log(`\nВсего тканей у поставщика: ${allFabrics.length}`)
    
    // Ищем ткани с organza
    const organzaFabrics = allFabrics.filter(f => 
      f.colorNumber.toLowerCase().includes('organza')
    )
    
    console.log(`\nТканей с "organza": ${organzaFabrics.length}`)
    organzaFabrics.forEach(f => {
      console.log(`\n  - "${f.collection}" - "${f.colorNumber}"`)
      console.log(`    ID: ${f.id}`)
      console.log(`    Метраж: ${f.meterage} (тип: ${typeof f.meterage})`)
      console.log(`    В наличии: ${f.inStock}`)
      console.log(`    Комментарий: ${f.comment || 'нет'}`)
      console.log(`    Последнее обновление: ${f.lastUpdatedAt}`)
      console.log(`    Исключена из парсинга: ${f.excludedFromParsing}`)
    })
    
    // Ищем ткани с "retro"
    const retroFabrics = allFabrics.filter(f => 
      f.collection.toLowerCase().includes('retro') || 
      f.colorNumber.toLowerCase().includes('retro')
    )
    
    console.log(`\nТканей с "retro": ${retroFabrics.length}`)
    retroFabrics.slice(0, 10).forEach(f => {
      console.log(`\n  - "${f.collection}" - "${f.colorNumber}"`)
      console.log(`    Метраж: ${f.meterage}`)
    })
    
    // Ищем конкретно "RETRO organza blue"
    const targetFabrics = allFabrics.filter(f => 
      f.colorNumber.toLowerCase().includes('organza') && 
      f.colorNumber.toLowerCase().includes('blue')
    )
    
    console.log(`\n` + '='.repeat(80))
    console.log('ТКАНИ "organza blue"')
    console.log('='.repeat(80))
    
    if (targetFabrics.length === 0) {
      console.log('\n⚠️ Ткань "RETRO organza blue" не найдена в БД')
      console.log('\nПроверяем похожие ткани:')
      
      // Ищем ткани с "organza"
      const similar = allFabrics.filter(f => 
        f.colorNumber.toLowerCase().includes('organza')
      )
      
      if (similar.length > 0) {
        console.log(`\nНайдено ${similar.length} тканей с "organza":`)
        similar.forEach(f => {
          console.log(`  - "${f.collection}" - "${f.colorNumber}": метраж = ${f.meterage}`)
        })
      }
    } else {
      targetFabrics.forEach((f, i) => {
        console.log(`\n${i + 1}. "${f.collection}" - "${f.colorNumber}"`)
        console.log(`   ID: ${f.id}`)
        console.log(`   Метраж: ${f.meterage} (тип: ${typeof f.meterage})`)
        console.log(`   В наличии: ${f.inStock}`)
        console.log(`   Комментарий: ${f.comment || 'нет'}`)
        console.log(`   Последнее обновление: ${f.lastUpdatedAt}`)
        
        if (f.meterage === 100) {
          console.log(`   ❌ ПРОБЛЕМА: Метраж = 100 (должно быть 85.6)`)
        } else if (Math.abs((f.meterage || 0) - 85.6) < 0.1) {
          console.log(`   ✅ Метраж корректен`)
        }
      })
    }
    
    // Проверяем ткани с метражом 100
    const fabricsWith100 = allFabrics.filter(f => 
      f.meterage !== null && Math.abs(f.meterage - 100) < 0.1
    )
    
    console.log(`\n` + '='.repeat(80))
    console.log(`ТКАНЕЙ С МЕТРАЖОМ ОКОЛО 100: ${fabricsWith100.length}`)
    console.log('='.repeat(80))
    
    // Ищем ткани с метражом 85.6
    const fabricsWith856 = allFabrics.filter(f => 
      f.meterage !== null && Math.abs(f.meterage - 85.6) < 0.1
    )
    
    console.log(`\nТКАНЕЙ С МЕТРАЖОМ ОКОЛО 85.6: ${fabricsWith856.length}`)
    if (fabricsWith856.length > 0) {
      fabricsWith856.slice(0, 5).forEach(f => {
        console.log(`  - "${f.collection}" - "${f.colorNumber}": метраж = ${f.meterage}`)
      })
    }
    
    // Проверяем последние обновления
    console.log(`\n` + '='.repeat(80))
    console.log('ПОСЛЕДНИЕ ОБНОВЛЕНИЯ ТКАНЕЙ')
    console.log('='.repeat(80))
    
    const recentFabrics = allFabrics
      .filter(f => f.lastUpdatedAt)
      .sort((a, b) => b.lastUpdatedAt!.getTime() - a.lastUpdatedAt!.getTime())
      .slice(0, 10)
    
    recentFabrics.forEach(f => {
      console.log(`\n  - "${f.collection}" - "${f.colorNumber}"`)
      console.log(`    Метраж: ${f.meterage}, Обновлено: ${f.lastUpdatedAt}`)
    })
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkRetroOrganza().catch(console.error)


