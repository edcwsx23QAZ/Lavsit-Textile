import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: ['error', 'warn'],
})

interface TestResult {
  name: string
  success: boolean
  message: string
  data?: any
  error?: string
}

async function testDatabaseConnection(): Promise<TestResult> {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`
    const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
    return {
      name: 'Database Connection',
      success: true,
      message: `База данных доступна. Найдено таблиц: ${tables.length}`,
      data: { tablesCount: tables.length, tables: tables.map(t => t.table_name) }
    }
  } catch (error: any) {
    return {
      name: 'Database Connection',
      success: false,
      message: 'База данных недоступна',
      error: error.message
    }
  }
}

async function testCategories(): Promise<TestResult> {
  try {
    const categories = await prisma.fabricCategory.findMany({
      orderBy: { price: 'asc' },
    })
    return {
      name: 'Categories Page',
      success: true,
      message: `Категории загружены. Найдено: ${categories.length}`,
      data: { count: categories.length }
    }
  } catch (error: any) {
    return {
      name: 'Categories Page',
      success: false,
      message: 'Ошибка загрузки категорий',
      error: error.message
    }
  }
}

async function testFabrics(): Promise<TestResult> {
  try {
    const fabrics = await prisma.fabric.findMany({
      where: { excludedFromParsing: false },
      take: 10,
      select: {
        id: true,
        collection: true,
        colorNumber: true,
        inStock: true,
      },
    })
    return {
      name: 'Fabrics Page',
      success: true,
      message: `Ткани загружены. Всего (первые 10): ${fabrics.length}`,
      data: { count: fabrics.length }
    }
  } catch (error: any) {
    return {
      name: 'Fabrics Page',
      success: false,
      message: 'Ошибка загрузки тканей',
      error: error.message
    }
  }
}

async function testSuppliers(): Promise<TestResult> {
  try {
    const suppliers = await prisma.supplier.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        _count: { select: { fabrics: true } }
      },
    })
    return {
      name: 'Suppliers Page',
      success: true,
      message: `Поставщики загружены. Найдено: ${suppliers.length}`,
      data: { count: suppliers.length, suppliers: suppliers.map(s => ({ name: s.name, status: s.status, fabricsCount: s._count.fabrics })) }
    }
  } catch (error: any) {
    return {
      name: 'Suppliers Page',
      success: false,
      message: 'Ошибка загрузки поставщиков',
      error: error.message
    }
  }
}

async function testPalette(): Promise<TestResult> {
  try {
    const fabrics = await prisma.fabric.findMany({
      where: { excludedFromParsing: false },
      select: {
        id: true,
        colorHex: true,
      },
      take: 10,
    })
    const withColors = fabrics.filter(f => f.colorHex).length
    return {
      name: 'Palette Page',
      success: true,
      message: `Палитра загружена. Тканей с цветами: ${withColors} из ${fabrics.length}`,
      data: { total: fabrics.length, withColors }
    }
  } catch (error: any) {
    return {
      name: 'Palette Page',
      success: false,
      message: 'Ошибка загрузки палитры',
      error: error.message
    }
  }
}

async function testParsingRules(): Promise<TestResult> {
  try {
    const rules = await prisma.parsingRule.findMany({
      select: {
        id: true,
        supplierId: true,
      },
    })
    return {
      name: 'Parsing Rules',
      success: true,
      message: `Правила парсинга загружены. Найдено: ${rules.length}`,
      data: { count: rules.length }
    }
  } catch (error: any) {
    return {
      name: 'Parsing Rules',
      success: false,
      message: 'Ошибка загрузки правил парсинга',
      error: error.message
    }
  }
}

async function runAllTests() {
  console.log('🧪 Запуск тестов всех страниц и функций...\n')
  
  const tests = [
    testDatabaseConnection,
    testCategories,
    testFabrics,
    testSuppliers,
    testPalette,
    testParsingRules,
  ]

  const results: TestResult[] = []

  for (const test of tests) {
    try {
      const result = await test()
      results.push(result)
      const icon = result.success ? '✅' : '❌'
      console.log(`${icon} ${result.name}: ${result.message}`)
      if (result.error) {
        console.log(`   Ошибка: ${result.error}`)
      }
    } catch (error: any) {
      results.push({
        name: test.name,
        success: false,
        message: 'Критическая ошибка',
        error: error.message
      })
      console.log(`❌ ${test.name}: Критическая ошибка - ${error.message}`)
    }
  }

  console.log('\n📊 Итоги тестирования:')
  const successCount = results.filter(r => r.success).length
  const failCount = results.filter(r => !r.success).length
  console.log(`✅ Успешно: ${successCount}`)
  console.log(`❌ Ошибок: ${failCount}`)
  console.log(`📈 Всего: ${results.length}`)

  const failedTests = results.filter(r => !r.success)
  if (failedTests.length > 0) {
    console.log('\n❌ Неудачные тесты:')
    failedTests.forEach(test => {
      console.log(`   - ${test.name}: ${test.error || test.message}`)
    })
  }

  await prisma.$disconnect()
  
  process.exit(failCount > 0 ? 1 : 0)
}

runAllTests().catch((error) => {
  console.error('❌ Критическая ошибка при выполнении тестов:', error)
  process.exit(1)
})
