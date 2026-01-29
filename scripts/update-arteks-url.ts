/**
 * Обновление URL для поставщика Артекс в базе данных
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Обновление URL для Артекса...\n')

  const arteks = await prisma.supplier.findFirst({
    where: { name: 'Артекс' },
  })

  if (!arteks) {
    console.log('❌ Поставщик Артекс не найден в базе данных')
    process.exit(1)
  }

  const newUrl = 'https://artextkani.ru/wp-content/uploads/YYYY/MM/DD.MM.YYYY-1.xlsx'
  
  console.log(`Текущий URL: ${arteks.parsingUrl || 'не установлен'}`)
  console.log(`Новый URL: ${newUrl}\n`)

  await prisma.supplier.update({
    where: { id: arteks.id },
    data: {
      parsingUrl: newUrl,
    },
  })

  console.log('✅ URL для Артекса успешно обновлен!')
  console.log(`   Новый формат поддерживает: /2026/01/28.01.2026-1.xlsx`)
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

