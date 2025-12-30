import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function forceUpdateRetroOrganza() {
  console.log('='.repeat(80))
  console.log('ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ МЕТРАЖА ДЛЯ RETRO organza blue')
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
    
    // Находим ткань
    const fabric = await prisma.fabric.findFirst({
      where: {
        supplierId: supplier.id,
        colorNumber: {
          contains: 'organza',
        },
      },
    })
    
    if (!fabric) {
      console.error('❌ Ткань не найдена')
      return
    }
    
    console.log(`\n📊 Текущее состояние:`)
    console.log(`   ID: ${fabric.id}`)
    console.log(`   Коллекция: "${fabric.collection}"`)
    console.log(`   Цвет: "${fabric.colorNumber}"`)
    console.log(`   Метраж: ${fabric.meterage}`)
    console.log(`   В наличии: ${fabric.inStock}`)
    console.log(`   Последнее обновление: ${fabric.lastUpdatedAt}`)
    
    if (fabric.meterage === 100) {
      console.log(`\n🔄 Обновляем метраж с 100 на 85.6...`)
      
      await prisma.fabric.update({
        where: { id: fabric.id },
        data: {
          meterage: 85.6,
          lastUpdatedAt: new Date(),
        },
      })
      
      console.log(`\n✅ Метраж обновлен на 85.6`)
      
      // Проверяем результат
      const updatedFabric = await prisma.fabric.findUnique({
        where: { id: fabric.id },
        select: { meterage: true, lastUpdatedAt: true },
      })
      
      console.log(`\n📊 Результат:`)
      console.log(`   Метраж: ${updatedFabric?.meterage}`)
      console.log(`   Последнее обновление: ${updatedFabric?.lastUpdatedAt}`)
      
      if (updatedFabric?.meterage === 85.6) {
        console.log(`\n✅ УСПЕХ: Метраж успешно обновлен!`)
      } else {
        console.log(`\n❌ ОШИБКА: Метраж не обновился`)
      }
    } else if (Math.abs((fabric.meterage || 0) - 85.6) < 0.1) {
      console.log(`\n✅ Метраж уже корректен (${fabric.meterage})`)
    } else {
      console.log(`\n⚠️  Метраж: ${fabric.meterage} (не 100 и не 85.6)`)
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

forceUpdateRetroOrganza().catch(console.error)

