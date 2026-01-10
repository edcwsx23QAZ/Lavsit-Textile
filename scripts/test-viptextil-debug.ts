import { PrismaClient } from '@prisma/client'
import { ViptextilParser } from '../lib/parsers/viptextil-parser'

const prisma = new PrismaClient()

async function main() {
  try {
    // Находим поставщика Viptextil
    const supplier = await prisma.supplier.findFirst({
      where: { name: 'Viptextil' },
    })

    if (!supplier) {
      console.error('Поставщик Viptextil не найден')
      return
    }

    console.log(`Найден поставщик: ${supplier.name} (ID: ${supplier.id})`)
    console.log(`URL: ${supplier.parsingUrl}\n`)

    const parser = new ViptextilParser(supplier.id, supplier.name)
    const url = supplier.parsingUrl || 'http://tgn1.viptextil.ru/vip/ostatki.html'

    console.log('Запускаем парсинг...\n')
    const fabrics = await parser.parse(url)

    console.log(`\nНайдено тканей: ${fabrics.length}\n`)
    
    if (fabrics.length > 0) {
      console.log('Первые 20 тканей:')
      fabrics.slice(0, 20).forEach((f, i) => {
        console.log(`${i + 1}. "${f.collection}" - "${f.colorNumber}" (в наличии: ${f.inStock})`)
      })
    } else {
      console.log('Ткани не найдены!')
    }
  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error(error.stack)
  } finally {
    await prisma.$disconnect()
  }
}

main()




