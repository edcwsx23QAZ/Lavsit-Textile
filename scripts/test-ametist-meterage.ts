import { PrismaClient } from '@prisma/client'
import { AmetistParser } from '../lib/parsers/ametist-parser'
import * as fs from 'fs'
import * as path from 'path'
const prisma = new PrismaClient()

function findFilesRecursive(dir: string, pattern: RegExp, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) {
    return files
  }
  
  const items = fs.readdirSync(dir)
  for (const item of items) {
    const fullPath = path.join(dir, item)
    try {
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        findFilesRecursive(fullPath, pattern, files)
      } else if (stat.isFile() && pattern.test(item.toLowerCase())) {
        files.push(fullPath)
      }
    } catch (e) {
      // Игнорируем ошибки доступа
    }
  }
  return files
}

async function findAmetistFiles(): Promise<string[]> {
  // Ищем файлы в директории email attachments
  const emailDir = path.join(process.cwd(), 'data', 'email-attachments')
  
  const patterns = [
    /ametist/i,
    /аметист/i,
    /\.xls$/i,
    /\.xlsx$/i,
    /\.zip$/i,
  ]
  
  const files: string[] = []
  for (const pattern of patterns) {
    const matches = findFilesRecursive(emailDir, pattern)
    files.push(...matches)
  }
  
  // Удаляем дубликаты и сортируем по дате изменения (новые первыми)
  const uniqueFiles = Array.from(new Set(files))
    .filter(f => fs.existsSync(f))
    .map(f => ({ path: f, mtime: fs.statSync(f).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
    .map(f => f.path)
  
  return uniqueFiles
}

async function testAmetistParser() {
  console.log('='.repeat(80))
  console.log('ТЕСТИРОВАНИЕ ПАРСЕРА АМЕТИСТ ДЛЯ МЕТРАЖА')
  console.log('='.repeat(80))
  
  try {
    // 1. Находим поставщика Аметист
    const allSuppliers = await prisma.supplier.findMany()
    const supplier = allSuppliers.find(s => 
      s.name.toLowerCase().includes('аметист') || s.name.toLowerCase().includes('ametist')
    )
    
    if (!supplier) {
      console.error('❌ Поставщик Аметист не найден в базе данных')
      return
    }
    
    console.log(`✅ Найден поставщик: ${supplier.name} (ID: ${supplier.id})`)
    console.log(`   Метод парсинга: ${supplier.parsingMethod}`)
    console.log(`   URL парсинга: ${supplier.parsingUrl || 'N/A'}`)
    
    // 2. Находим файлы для парсинга
    let filePath: string | null = null
    
    if (supplier.parsingMethod === 'email') {
      console.log('\n📧 Поставщик использует email-парсинг, ищем файлы...')
      const files = await findAmetistFiles()
      
      if (files.length === 0) {
        console.error('❌ Файлы для парсинга не найдены')
        console.log('   Проверьте директорию data/email-attachments/')
        return
      }
      
      console.log(`✅ Найдено ${files.length} файлов:`)
      files.slice(0, 5).forEach((f, i) => {
        const stat = fs.statSync(f)
        console.log(`   ${i + 1}. ${path.basename(f)} (${stat.size} bytes, ${stat.mtime.toISOString()})`)
      })
      
      filePath = files[0]
      console.log(`\n📄 Используем файл: ${path.basename(filePath)}`)
    } else if (supplier.parsingUrl) {
      filePath = supplier.parsingUrl
      console.log(`\n📄 Используем URL: ${filePath}`)
    } else {
      console.error('❌ Не удалось определить источник данных для парсинга')
      return
    }
    
    // 3. Создаем парсер
    const parser = new AmetistParser(supplier.id, supplier.name)
    console.log('\n🔧 Парсер создан')
    
    // 4. Загружаем правила парсинга
    const rules = await parser.loadRules()
    if (!rules) {
      console.error('❌ Правила парсинга не найдены')
      return
    }
    
    console.log('✅ Правила парсинга загружены:')
    console.log(`   Коллекция: колонка ${rules.columnMappings.collection ?? 2}`)
    console.log(`   Цвет: колонка ${rules.columnMappings.color ?? 4}`)
    console.log(`   Метраж: колонка ${rules.columnMappings.meterage ?? rules.columnMappings.inStock ?? 6}`)
    
    // 5. Запускаем парсинг
    console.log('\n' + '='.repeat(80))
    console.log('ЗАПУСК ПАРСИНГА')
    console.log('='.repeat(80))
    
    const fabrics = await parser.parse(filePath)
    
    console.log(`\n✅ Парсинг завершен. Найдено тканей: ${fabrics.length}`)
    
    // 6. Ищем ткань "RETRO organza blue"
    console.log('\n' + '='.repeat(80))
    console.log('ПОИСК ТКАНИ "RETRO organza blue"')
    console.log('='.repeat(80))
    
    const retroFabrics = fabrics.filter(f => 
      f.collection.toLowerCase().includes('retro') || 
      f.colorNumber.toLowerCase().includes('organza') ||
      f.colorNumber.toLowerCase().includes('retro')
    )
    
    console.log(`\nНайдено тканей с "retro" или "organza": ${retroFabrics.length}`)
    
    retroFabrics.forEach((f, i) => {
      console.log(`\n${i + 1}. "${f.collection}" - "${f.colorNumber}"`)
      console.log(`   Метраж: ${f.meterage} (тип: ${typeof f.meterage})`)
      console.log(`   В наличии: ${f.inStock}`)
      console.log(`   Комментарий: ${f.comment || 'нет'}`)
    })
    
    // Ищем ткань "RETRO organza blue" разными способами
    let targetFabric = fabrics.find(f => 
      f.colorNumber.toLowerCase().includes('organza') && 
      f.colorNumber.toLowerCase().includes('blue')
    )
    
    // Если не нашли, ищем по коллекции RETRO
    if (!targetFabric) {
      targetFabric = fabrics.find(f => 
        f.collection.toLowerCase().includes('retro') &&
        f.colorNumber.toLowerCase().includes('organza')
      )
    }
    
    // Если все еще не нашли, ищем любую ткань с "retro" и "organza"
    if (!targetFabric) {
      const retroOrganza = fabrics.filter(f => 
        (f.collection.toLowerCase().includes('retro') || f.colorNumber.toLowerCase().includes('retro')) &&
        f.colorNumber.toLowerCase().includes('organza')
      )
      if (retroOrganza.length > 0) {
        targetFabric = retroOrganza[0]
        console.log(`\nНайдено ${retroOrganza.length} тканей с "retro" и "organza":`)
        retroOrganza.forEach(f => {
          console.log(`  - "${f.collection}" - "${f.colorNumber}": метраж = ${f.meterage}`)
        })
      }
    }
    
    if (!targetFabric) {
      console.log('\n⚠️ Ткань "RETRO organza blue" не найдена в результатах парсинга')
      console.log('   Проверяем все ткани с "organza":')
      const organzaFabrics = fabrics.filter(f => 
        f.colorNumber.toLowerCase().includes('organza')
      )
      organzaFabrics.forEach(f => {
        console.log(`   - "${f.collection}" - "${f.colorNumber}": метраж = ${f.meterage}`)
      })
    } else {
      console.log('\n' + '='.repeat(80))
      console.log('РЕЗУЛЬТАТ ДЛЯ "RETRO organza blue"')
      console.log('='.repeat(80))
      console.log(`Коллекция: "${targetFabric.collection}"`)
      console.log(`Цвет: "${targetFabric.colorNumber}"`)
      console.log(`Метраж: ${targetFabric.meterage} (тип: ${typeof targetFabric.meterage})`)
      console.log(`В наличии: ${targetFabric.inStock}`)
      console.log(`Комментарий: ${targetFabric.comment || 'нет'}`)
      
      if (targetFabric.meterage === 100) {
        console.log('\n❌ ПРОБЛЕМА: Метраж = 100 (должно быть 85.6)')
      } else if (Math.abs((targetFabric.meterage || 0) - 85.6) < 0.1) {
        console.log('\n✅ Метраж корректен (около 85.6)')
      } else {
        console.log(`\n⚠️ Метраж = ${targetFabric.meterage} (ожидалось 85.6)`)
      }
    }
    
    // 7. Проверяем значение в БД
    console.log('\n' + '='.repeat(80))
    console.log('ПРОВЕРКА ЗНАЧЕНИЯ В БАЗЕ ДАННЫХ')
    console.log('='.repeat(80))
    
    if (targetFabric) {
      const allFabrics = await prisma.fabric.findMany({
        where: {
          supplierId: supplier.id,
        },
      })
      const dbFabric = allFabrics.find(f => 
        f.collection.trim().toLowerCase() === targetFabric.collection.trim().toLowerCase() &&
        f.colorNumber.trim().toLowerCase() === targetFabric.colorNumber.trim().toLowerCase()
      )
      
      if (dbFabric) {
        console.log(`\nТекущее значение в БД:`)
        console.log(`   Метраж: ${dbFabric.meterage} (тип: ${typeof dbFabric.meterage})`)
        console.log(`   В наличии: ${dbFabric.inStock}`)
        console.log(`   Комментарий: ${dbFabric.comment || 'нет'}`)
        console.log(`   Последнее обновление: ${dbFabric.lastUpdatedAt}`)
        
        if (dbFabric.meterage === 100) {
          console.log('\n❌ ПРОБЛЕМА В БД: Метраж = 100 (должно быть 85.6)')
        } else if (Math.abs((dbFabric.meterage || 0) - 85.6) < 0.1) {
          console.log('\n✅ Метраж в БД корректен')
        } else {
          console.log(`\n⚠️ Метраж в БД = ${dbFabric.meterage} (ожидалось 85.6)`)
        }
        
        // Сравниваем значения
        if (targetFabric.meterage !== dbFabric.meterage) {
          console.log(`\n⚠️ РАСХОЖДЕНИЕ: Парсер вернул ${targetFabric.meterage}, в БД ${dbFabric.meterage}`)
        } else {
          console.log(`\n✅ Значения совпадают: ${targetFabric.meterage}`)
        }
      } else {
        console.log('\n⚠️ Ткань не найдена в базе данных')
      }
    }
    
    // 8. Ищем все ткани с метражом около 100
    console.log('\n' + '='.repeat(80))
    console.log('ПОИСК ТКАНЕЙ С МЕТРАЖОМ ОКОЛО 100')
    console.log('='.repeat(80))
    
    const fabricsWith100 = fabrics.filter(f => 
      f.meterage !== null && Math.abs(f.meterage - 100) < 1
    )
    
    if (fabricsWith100.length > 0) {
      console.log(`\nНайдено ${fabricsWith100.length} тканей с метражом около 100:`)
      fabricsWith100.forEach((f, i) => {
        console.log(`\n${i + 1}. "${f.collection}" - "${f.colorNumber}"`)
        console.log(`   Метраж: ${f.meterage}`)
      })
    } else {
      console.log('\n✅ Тканей с метражом около 100 не найдено')
    }
    
    console.log('\n' + '='.repeat(80))
    console.log('ТЕСТИРОВАНИЕ ЗАВЕРШЕНО')
    console.log('='.repeat(80))
    
  } catch (error: any) {
    console.error('\n❌ ОШИБКА:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testAmetistParser().catch(console.error)
