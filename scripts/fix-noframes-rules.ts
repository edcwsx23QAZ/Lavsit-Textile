import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixNoFramesRules() {
  console.log('Исправление правил парсинга для NoFrames...')
  
  const supplier = await prisma.supplier.findFirst({
    where: { name: 'NoFrames' },
  })
  
  if (!supplier) {
    console.error('Поставщик NoFrames не найден!')
    await prisma.$disconnect()
    return
  }
  
  // Правильные правила для NoFrames
  const correctRules = {
    columnMappings: {
      collection: 1, // B = индекс 1 (исправлено с 0)
      inStock: 3,    // D = индекс 3
      nextArrivalDate: 4, // E = индекс 4
    },
    skipRows: [1, 2, 3, 4, 5, 6], // Пропускаем первые 6 строк
    skipPatterns: [],
    specialRules: {
      removeFurnitureText: true,
      removeQuotes: true,
    },
  }
  
  await prisma.parsingRule.upsert({
    where: { supplierId: supplier.id },
    create: {
      supplierId: supplier.id,
      rules: JSON.stringify(correctRules),
    },
    update: {
      rules: JSON.stringify(correctRules),
      updatedAt: new Date(),
    },
  })
  
  console.log('✓ Правила обновлены:')
  console.log(JSON.stringify(correctRules, null, 2))
  
  await prisma.$disconnect()
}

fixNoFramesRules().catch(console.error)




