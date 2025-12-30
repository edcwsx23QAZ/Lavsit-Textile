/**
 * Диагностика SQLite базы данных
 * Запуск: tsx scripts/diagnose-db.ts
 */

import { PrismaClient } from '@prisma/client'
import { ensureDatabaseInitialized } from '../lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface DiagnosticResult {
  check: string
  status: 'ok' | 'warning' | 'error'
  value: any
  message?: string
}

const results: DiagnosticResult[] = []

async function checkDatabaseFile() {
  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db')
  const walPath = path.join(process.cwd(), 'prisma', 'dev.db-wal')
  const shmPath = path.join(process.cwd(), 'prisma', 'dev.db-shm')
  
  console.log('\n[Проверка файлов БД]')
  console.log(`  Путь к БД: ${dbPath}`)
  
  if (!fs.existsSync(dbPath)) {
    results.push({
      check: 'Database file exists',
      status: 'error',
      value: false,
      message: 'Файл БД не найден'
    })
    console.log('  ❌ Файл БД не найден')
    return
  }
  
  const stats = fs.statSync(dbPath)
  const sizeMB = stats.size / (1024 * 1024)
  
  results.push({
    check: 'Database file exists',
    status: 'ok',
    value: true,
    message: `Размер: ${sizeMB.toFixed(2)} MB`
  })
  console.log(`  ✅ Файл БД найден, размер: ${sizeMB.toFixed(2)} MB`)
  
  if (fs.existsSync(walPath)) {
    const walStats = fs.statSync(walPath)
    const walSizeMB = walStats.size / (1024 * 1024)
    console.log(`  ℹ️  WAL файл существует, размер: ${walSizeMB.toFixed(2)} MB`)
    results.push({
      check: 'WAL file exists',
      status: 'ok',
      value: true,
      message: `WAL mode включен, размер: ${walSizeMB.toFixed(2)} MB`
    })
  } else {
    console.log(`  ⚠️  WAL файл не найден (WAL mode может быть не включен)`)
    results.push({
      check: 'WAL file exists',
      status: 'warning',
      value: false,
      message: 'WAL mode не активен - рекомендуется включить для параллельных чтений'
    })
  }
}

async function checkPragmaSettings() {
  console.log('\n[Проверка PRAGMA настроек]')
  
  try {
    // Journal mode
    const journalModeResult = await prisma.$queryRaw<Array<{ journal_mode: string }>>`
      PRAGMA journal_mode
    `
    const journalMode = journalModeResult[0]?.journal_mode || 'unknown'
    const isWal = journalMode === 'wal'
    
    results.push({
      check: 'Journal mode',
      status: isWal ? 'ok' : 'warning',
      value: journalMode,
      message: isWal 
        ? 'WAL mode включен - поддерживает параллельные чтения'
        : `Режим: ${journalMode}. Рекомендуется WAL mode для лучшей производительности`
    })
    console.log(`  ${isWal ? '✅' : '⚠️'}  Journal mode: ${journalMode}`)
    
    // Synchronous
    const synchronousResult = await prisma.$queryRaw<Array<{ synchronous: number | bigint }>>`
      PRAGMA synchronous
    `
    const synchronousValue = synchronousResult[0]?.synchronous ?? -1
    const synchronous = typeof synchronousValue === 'bigint' ? Number(synchronousValue) : synchronousValue
    const syncText = synchronous === 0 ? 'OFF' : synchronous === 1 ? 'NORMAL' : synchronous === 2 ? 'FULL' : 'UNKNOWN'
    
    results.push({
      check: 'Synchronous',
      status: synchronous === 1 ? 'ok' : 'warning',
      value: syncText,
      message: synchronous === 1 
        ? 'NORMAL - хороший баланс производительности и безопасности'
        : `Текущее значение: ${syncText}. Рекомендуется NORMAL (1)`
    })
    console.log(`  ${synchronous === 1 ? '✅' : '⚠️'}  Synchronous: ${syncText} (${synchronous})`)
    
    // Busy timeout
    const busyTimeoutResult = await prisma.$queryRaw<Array<{ busy_timeout: number | bigint }>>`
      PRAGMA busy_timeout
    `
    const busyTimeoutValue = busyTimeoutResult[0]?.busy_timeout ?? 0
    const busyTimeout = typeof busyTimeoutValue === 'bigint' ? Number(busyTimeoutValue) : busyTimeoutValue
    
    results.push({
      check: 'Busy timeout',
      status: busyTimeout >= 5000 ? 'ok' : 'warning',
      value: `${busyTimeout}ms`,
      message: busyTimeout >= 5000
        ? `Таймаут установлен: ${busyTimeout}ms`
        : `Таймаут: ${busyTimeout}ms. Рекомендуется минимум 5000ms`
    })
    console.log(`  ${busyTimeout >= 5000 ? '✅' : '⚠️'}  Busy timeout: ${busyTimeout}ms`)
    
    // Cache size (в страницах)
    const cacheSizeResult = await prisma.$queryRaw<Array<{ cache_size: number | bigint }>>`
      PRAGMA cache_size
    `
    const cacheSizeValue = cacheSizeResult[0]?.cache_size ?? 0
    const cacheSize = typeof cacheSizeValue === 'bigint' ? Number(cacheSizeValue) : cacheSizeValue
    const cacheSizeMB = Math.abs(cacheSize) * 4 / 1024 // 4 KB per page
    
    results.push({
      check: 'Cache size',
      status: 'ok',
      value: `${cacheSizeMB.toFixed(2)} MB`,
      message: `Размер кэша: ${cacheSizeMB.toFixed(2)} MB`
    })
    console.log(`  ℹ️   Cache size: ${cacheSizeMB.toFixed(2)} MB`)
    
  } catch (error: any) {
    console.log(`  ❌ Ошибка при проверке PRAGMA: ${error.message}`)
    results.push({
      check: 'Pragma settings',
      status: 'error',
      value: null,
      message: error.message
    })
  }
}

async function checkIndexes() {
  console.log('\n[Проверка индексов]')
  
  try {
    // Индексы для таблицы Fabric
    const fabricIndexes = await prisma.$queryRaw<Array<{ name: string; tbl_name: string }>>`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type='index' AND tbl_name='Fabric'
    `
    
    console.log(`  ✅ Найдено индексов для Fabric: ${fabricIndexes.length}`)
    fabricIndexes.forEach(idx => {
      console.log(`     - ${idx.name}`)
    })
    
    results.push({
      check: 'Fabric indexes',
      status: fabricIndexes.length > 0 ? 'ok' : 'warning',
      value: fabricIndexes.length,
      message: `Найдено ${fabricIndexes.length} индексов`
    })
    
    // Индексы для таблицы Supplier
    const supplierIndexes = await prisma.$queryRaw<Array<{ name: string; tbl_name: string }>>`
      SELECT name, tbl_name 
      FROM sqlite_master 
      WHERE type='index' AND tbl_name='Supplier'
    `
    
    console.log(`  ✅ Найдено индексов для Supplier: ${supplierIndexes.length}`)
    supplierIndexes.forEach(idx => {
      console.log(`     - ${idx.name}`)
    })
    
    results.push({
      check: 'Supplier indexes',
      status: 'ok',
      value: supplierIndexes.length,
      message: `Найдено ${supplierIndexes.length} индексов`
    })
    
  } catch (error: any) {
    console.log(`  ❌ Ошибка при проверке индексов: ${error.message}`)
    results.push({
      check: 'Indexes',
      status: 'error',
      value: null,
      message: error.message
    })
  }
}

async function checkRecordCounts() {
  console.log('\n[Проверка количества записей]')
  
  try {
    const fabricCount = await prisma.fabric.count()
    const supplierCount = await prisma.supplier.count()
    const categoryCount = await prisma.fabricCategory.count()
    
    console.log(`  ✅ Fabric: ${fabricCount.toLocaleString()} записей`)
    console.log(`  ✅ Supplier: ${supplierCount} записей`)
    console.log(`  ✅ FabricCategory: ${categoryCount} записей`)
    
    results.push({
      check: 'Record counts',
      status: 'ok',
      value: { fabrics: fabricCount, suppliers: supplierCount, categories: categoryCount },
      message: `Fabric: ${fabricCount}, Supplier: ${supplierCount}, Categories: ${categoryCount}`
    })
    
    if (fabricCount > 100000) {
      results.push({
        check: 'Large dataset',
        status: 'warning',
        value: fabricCount,
        message: `Большой объем данных (${fabricCount} записей) - может потребоваться оптимизация запросов`
      })
      console.log(`  ⚠️  Большой объем данных - может потребоваться оптимизация`)
    }
    
  } catch (error: any) {
    console.log(`  ❌ Ошибка при подсчете записей: ${error.message}`)
    results.push({
      check: 'Record counts',
      status: 'error',
      value: null,
      message: error.message
    })
  }
}

async function runDiagnostics() {
  console.log('='.repeat(60))
  console.log('ДИАГНОСТИКА SQLITE БАЗЫ ДАННЫХ')
  console.log('='.repeat(60))
  
  // Инициализируем БД перед проверкой
  console.log('\n[Инициализация БД]')
  try {
    await ensureDatabaseInitialized()
    console.log('  ✅ Инициализация БД выполнена')
  } catch (error: any) {
    console.log(`  ⚠️  Ошибка инициализации: ${error.message}`)
  }
  
  await checkDatabaseFile()
  await checkPragmaSettings()
  await checkIndexes()
  await checkRecordCounts()
  
  // Итоги
  console.log('\n' + '='.repeat(60))
  console.log('ИТОГИ ДИАГНОСТИКИ')
  console.log('='.repeat(60))
  
  const errors = results.filter(r => r.status === 'error')
  const warnings = results.filter(r => r.status === 'warning')
  const ok = results.filter(r => r.status === 'ok')
  
  console.log(`✅ OK: ${ok.length}`)
  console.log(`⚠️  Предупреждения: ${warnings.length}`)
  console.log(`❌ Ошибки: ${errors.length}`)
  
  if (warnings.length > 0) {
    console.log('\n⚠️  Предупреждения:')
    warnings.forEach(r => {
      console.log(`  - ${r.check}: ${r.message || r.value}`)
    })
  }
  
  if (errors.length > 0) {
    console.log('\n❌ Ошибки:')
    errors.forEach(r => {
      console.log(`  - ${r.check}: ${r.message || r.value}`)
    })
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('\n✅ Все проверки пройдены успешно!')
  } else if (errors.length === 0) {
    console.log('\n⚠️  Есть предупреждения, но критических ошибок нет')
  } else {
    console.log('\n❌ Обнаружены критические ошибки')
  }
}

runDiagnostics()
  .catch(error => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

