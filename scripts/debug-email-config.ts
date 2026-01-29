/**
 * Отладка email конфигурации
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  if (!ametist) {
    console.log('❌ Аметист не найден')
    process.exit(1)
  }

  console.log('📋 Email конфигурация Аметиста (raw):')
  console.log(JSON.stringify(JSON.parse(ametist.emailConfig || '{}'), null, 2))
}

main()
  .catch((e) => {
    console.error('\n❌ Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

