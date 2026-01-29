/**
 * Обновление subjectFilter для Аметиста
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Обновление subjectFilter для Аметиста...\n')

  const ametist = await prisma.supplier.findFirst({
    where: { name: 'Аметист' },
  })

  if (!ametist) {
    console.log('❌ Поставщик Аметист не найден')
    process.exit(1)
  }

  if (!ametist.emailConfig) {
    console.log('❌ Email конфигурация для Аметиста отсутствует')
    process.exit(1)
  }

  let emailConfig = JSON.parse(ametist.emailConfig)
  
  console.log(`Текущий subjectFilter: "${emailConfig.subjectFilter || 'не указан'}"`)
  
  // Обновляем subjectFilter
  emailConfig.subjectFilter = "Остатки номенклатуры на складе 'ООО Аметист'"
  
  // Убеждаемся, что useAnyLatestAttachment включен для повторной обработки
  emailConfig.useAnyLatestAttachment = true
  
  await prisma.supplier.update({
    where: { id: ametist.id },
    data: {
      emailConfig: JSON.stringify(emailConfig),
    },
  })

  console.log(`✅ subjectFilter обновлен: "${emailConfig.subjectFilter}"`)
  console.log(`✅ useAnyLatestAttachment: ${emailConfig.useAnyLatestAttachment}`)
  console.log('\nТеперь парсер будет использовать последние вложения, даже если они уже обработаны')
}

main()
  .catch((e) => {
    console.error('Ошибка:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

