import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

async function checkServerLogs() {
  console.log('='.repeat(80))
  console.log('ПРОВЕРКА ЛОГОВ СЕРВЕРА')
  console.log('='.repeat(80))
  
  try {
    // Ищем файлы логов
    const logFiles = [
      'dev.log',
      'server.log',
      '.next/server.log',
      'logs/server.log',
    ]
    
    console.log('\n📁 Поиск файлов логов...')
    
    for (const logFile of logFiles) {
      const fullPath = path.join(process.cwd(), logFile)
      if (fs.existsSync(fullPath)) {
        console.log(`\n✅ Найден файл: ${logFile}`)
        const content = fs.readFileSync(fullPath, 'utf-8')
        const lines = content.split('\n')
        
        // Ищем строки с RETRO organza
        const relevantLines = lines.filter(line => 
          line.toLowerCase().includes('retro') || 
          line.toLowerCase().includes('organza') ||
          line.includes('updateFabricsFromParser') ||
          line.includes('shouldUpdateFromParser') ||
          line.includes('метраж') ||
          line.includes('meterage')
        )
        
        if (relevantLines.length > 0) {
          console.log(`\n📋 Найдено ${relevantLines.length} релевантных строк:`)
          relevantLines.slice(-50).forEach(line => {
            console.log(`   ${line}`)
          })
        } else {
          console.log(`   Нет релевантных строк`)
        }
      }
    }
    
    // Проверяем последние обновления в БД
    console.log(`\n` + '='.repeat(80))
    console.log('ПОСЛЕДНИЕ ОБНОВЛЕНИЯ В БД')
    console.log('='.repeat(80))
    
    const allSuppliers = await prisma.supplier.findMany()
    const supplier = allSuppliers.find(s => 
      s.name.toLowerCase().includes('аметист') || s.name.toLowerCase().includes('ametist')
    )
    
    if (supplier) {
      const recentFabrics = await prisma.fabric.findMany({
        where: {
          supplierId: supplier.id,
          lastUpdatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Последние 24 часа
          },
        },
        orderBy: {
          lastUpdatedAt: 'desc',
        },
        take: 20,
      })
      
      console.log(`\nНайдено ${recentFabrics.length} тканей, обновленных за последние 24 часа:`)
      recentFabrics.forEach(f => {
        const isRetro = f.colorNumber.toLowerCase().includes('organza') || 
                       f.colorNumber.toLowerCase().includes('retro')
        const marker = isRetro ? '🎯' : '  '
        console.log(`${marker} ${f.collection} - ${f.colorNumber}: метраж=${f.meterage}, обновлено=${f.lastUpdatedAt}`)
      })
      
      // Проверяем конкретно RETRO organza
      const retroOrganza = await prisma.fabric.findFirst({
        where: {
          supplierId: supplier.id,
          colorNumber: {
            contains: 'organza',
          },
        },
      })
      
      if (retroOrganza) {
        console.log(`\n🎯 RETRO organza blue:`)
        console.log(`   Метраж: ${retroOrganza.meterage}`)
        console.log(`   Последнее обновление: ${retroOrganza.lastUpdatedAt}`)
        console.log(`   Время с последнего обновления: ${Math.round((Date.now() - retroOrganza.lastUpdatedAt!.getTime()) / 1000 / 60)} минут`)
      }
    }
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

checkServerLogs().catch(console.error)

