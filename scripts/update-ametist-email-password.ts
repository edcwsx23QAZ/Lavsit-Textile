/**
 * Обновление пароля приложения для Аметиста
 */
import { prisma } from '../lib/db/prisma'

async function updateAmetistPassword() {
  try {
    console.log('🔧 Обновление пароля приложения для Аметиста...\n')

    // Находим поставщика Аметист
    const ametist = await prisma.supplier.findFirst({
      where: { name: 'Аметист' },
    })

    if (!ametist) {
      console.log('❌ Поставщик Аметист не найден')
      return
    }

    console.log(`✅ Аметист найден: ID = ${ametist.id}`)

    if (!ametist.emailConfig) {
      console.log('❌ Email конфигурация для Аметиста отсутствует')
      return
    }

    // Парсим текущую конфигурацию
    let emailConfig: any
    try {
      emailConfig = JSON.parse(ametist.emailConfig)
    } catch (error) {
      console.log('❌ Ошибка парсинга email конфигурации:', error)
      return
    }

    console.log('\n📋 Текущая email конфигурация:')
    console.log(JSON.stringify(emailConfig, null, 2))

    // Новый пароль приложения
    const newPassword = 'sujo hoft xfem vtsk'

    // Обновляем пароль во всех местах
    let updated = false
    
    if (emailConfig.imap) {
      emailConfig.imap.password = newPassword
      updated = true
      console.log('\n✅ Пароль обновлен в imap.password')
    }
    
    if (emailConfig.password !== undefined) {
      emailConfig.password = newPassword
      updated = true
      console.log('✅ Пароль обновлен в password')
    }
    
    if (!updated) {
      // Если пароля нет нигде, добавляем его
      if (emailConfig.imap) {
        emailConfig.imap.password = newPassword
        console.log('\n✅ Пароль добавлен в imap.password')
      } else {
        emailConfig.password = newPassword
        console.log('\n✅ Пароль добавлен в password')
      }
    }

    // Сохраняем обновленную конфигурацию
    await prisma.supplier.update({
      where: { id: ametist.id },
      data: {
        emailConfig: JSON.stringify(emailConfig),
      },
    })

    console.log('\n✅ Email конфигурация успешно обновлена!')
    console.log('\n📋 Обновленная конфигурация:')
    console.log(JSON.stringify(emailConfig, null, 2))
  } catch (error) {
    console.error('❌ Ошибка при обновлении пароля:', error)
  } finally {
    await prisma.$disconnect()
  }
}

updateAmetistPassword()

