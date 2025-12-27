import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Создаем поставщиков
  const suppliers = [
    {
      name: 'Artvision',
      websiteUrl: 'https://artvision-home.ru',
      parsingMethod: 'html',
      parsingUrl: 'https://artvision-home.ru/leftovers/',
    },
    {
      name: 'Союз-М',
      websiteUrl: 'https://www.souz-m.ru',
      parsingMethod: 'excel',
      parsingUrl: 'https://www.souz-m.ru/leftovers/?is_load_excel=1',
    },
    {
      name: 'Домиарт',
      websiteUrl: 'https://k-domiart.ru',
      parsingMethod: 'excel',
      parsingUrl: 'https://k-domiart.ru/assets/files/instock_moscow.xlsx',
    },
    {
      name: 'Артекс',
      websiteUrl: 'https://artextkani.ru',
      parsingMethod: 'excel',
      parsingUrl: 'https://artextkani.ru/wp-content/uploads/25.12.2025-2.xlsx',
    },
    {
      name: 'TextileData',
      websiteUrl: 'https://textiledata.ru',
      parsingMethod: 'html',
      parsingUrl: 'https://textiledata.ru/ostatki-tkaney/',
    },
    {
      name: 'NoFrames',
      websiteUrl: 'https://no-frames.ru',
      parsingMethod: 'excel',
      parsingUrl: 'https://no-frames.ru/design/themes/abt__unitheme2/media/files/NALICHIE_NA_SKLADE_NOFRAMES.XLS?v={timestamp}',
    },
    {
      name: 'Нортекс',
      websiteUrl: 'https://nortex.ru',
      parsingMethod: 'email',
      parsingUrl: '', // Для email типа URL не используется
    },
  ]

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { name: supplier.name },
      update: supplier,
      create: supplier,
    })
    console.log(`✓ Создан/обновлен поставщик: ${supplier.name}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

