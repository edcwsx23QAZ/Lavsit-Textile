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
    {
      name: 'Tex.Group',
      websiteUrl: 'https://tex.group',
      parsingMethod: 'excel',
      parsingUrl: 'https://tex.group/ostatki/OstatkiMSK.xls',
    },
    {
      name: 'Vektor',
      websiteUrl: 'https://vektor.club',
      parsingMethod: 'excel',
      parsingUrl: 'https://api.vektor.club/static/remainders_files/{DDMMYY}_MSK.xlsx', // Динамический URL, парсер сам найдет актуальную дату
    },
    {
      name: 'Аметист',
      websiteUrl: 'https://ametist.ru',
      parsingMethod: 'email',
      parsingUrl: '', // Для email типа URL не используется
    },
    {
      name: 'TextileNova',
      websiteUrl: 'https://textilnova.ru',
      parsingMethod: 'html',
      parsingUrl: 'https://textilnova.ru//',
    },
    {
      name: 'Viptextil',
      websiteUrl: 'http://tgn1.viptextil.ru',
      parsingMethod: 'html',
      parsingUrl: 'http://tgn1.viptextil.ru/vip/ostatki.html',
    },
    {
      name: 'Artefact',
      websiteUrl: 'https://artefakt-msk.com',
      parsingMethod: 'excel',
      parsingUrl: 'https://artefakt-msk.com/%D0%BD%D0%B0%D0%BB%D0%B8%D1%87%D0%B8%D0%B5',
    },
    {
      name: 'Эгида',
      websiteUrl: 'https://exch.tendence.ru',
      parsingMethod: 'excel',
      parsingUrl: 'https://exch.tendence.ru/download.php?file={DD.MM.YY}_ostatki_tkani_ooo_egida.xls', // Динамический URL, парсер сам найдет актуальную дату
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

