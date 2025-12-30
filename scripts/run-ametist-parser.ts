import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function runAmetistParser() {
  console.log('='.repeat(80))
  console.log('ЗАПУСК ПАРСЕРА АМЕТИСТ')
  console.log('='.repeat(80))
  
  try {
    // Находим поставщика Аметист
    const supplier = await prisma.supplier.findFirst({
      where: {
        name: {
          contains: 'Аметист',
        },
      },
    })
    
    if (!supplier) {
      console.error('❌ Поставщик Аметист не найден')
      return
    }
    
    console.log(`\n✅ Поставщик найден: ${supplier.name} (ID: ${supplier.id})`)
    console.log(`   Метод парсинга: ${supplier.parsingMethod}`)
    console.log(`   URL парсинга: ${supplier.parsingUrl || 'N/A'}`)
    
    // Проверяем текущее состояние ткани RETRO organza blue
    const fabricBefore = await prisma.fabric.findFirst({
      where: {
        supplierId: supplier.id,
        colorNumber: {
          contains: 'organza',
        },
      },
    })
    
    if (fabricBefore) {
      console.log(`\n📊 Состояние ДО парсинга:`)
      console.log(`   Метраж: ${fabricBefore.meterage}`)
      console.log(`   В наличии: ${fabricBefore.inStock}`)
      console.log(`   Последнее обновление: ${fabricBefore.lastUpdatedAt}`)
    }
    
    // Запускаем парсинг через API
    console.log(`\n🔄 Запуск парсинга через API...`)
    const apiUrl = `http://localhost:3000/api/suppliers/${supplier.id}/parse`
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`\n❌ Ошибка API: ${response.status} ${response.statusText}`)
      console.error(`   Ответ: ${errorText}`)
      return
    }
    
    const result = await response.json()
    console.log(`\n✅ Парсинг завершен:`)
    console.log(`   Найдено тканей: ${result.fabricsCount || result.fabrics?.length || 'N/A'}`)
    console.log(`   Обновлено/создано: ${result.updatedCount || 'N/A'}`)
    console.log(`   Сообщение: ${result.message || 'N/A'}`)
    
    // Проверяем состояние ткани ПОСЛЕ парсинга
    const fabricAfter = await prisma.fabric.findFirst({
      where: {
        supplierId: supplier.id,
        colorNumber: {
          contains: 'organza',
        },
      },
    })
    
    if (fabricAfter) {
      console.log(`\n📊 Состояние ПОСЛЕ парсинга:`)
      console.log(`   Метраж: ${fabricAfter.meterage}`)
      console.log(`   В наличии: ${fabricAfter.inStock}`)
      console.log(`   Последнее обновление: ${fabricAfter.lastUpdatedAt}`)
      
      if (fabricBefore) {
        console.log(`\n🔍 Сравнение:`)
        console.log(`   Метраж изменился: ${fabricBefore.meterage !== fabricAfter.meterage} (было: ${fabricBefore.meterage}, стало: ${fabricAfter.meterage})`)
        console.log(`   Наличие изменилось: ${fabricBefore.inStock !== fabricAfter.inStock}`)
        console.log(`   Обновлено: ${fabricBefore.lastUpdatedAt?.getTime() !== fabricAfter.lastUpdatedAt?.getTime()}`)
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

runAmetistParser().catch(console.error)

