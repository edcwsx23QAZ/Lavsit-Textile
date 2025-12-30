import puppeteer from 'puppeteer'
import axios from 'axios'
import * as XLSX from 'xlsx'

async function testTextileNovaSheets() {
  console.log('=== Тестирование парсера TextileNova с Google Sheets ===\n')

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    await page.setViewport({ width: 1920, height: 1080 })

    const url = 'https://textilnova.ru//'
    console.log(`Переход на страницу: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Ищем ссылку на Google Sheets
    const sheetUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'))
      const link = links.find(a => {
        const text = a.textContent?.toLowerCase() || ''
        return text.includes('получить остатки') || text.includes('остатки')
      })
      
      return link ? (link as HTMLAnchorElement).href : null
    })

    if (!sheetUrl) {
      console.error('✗ Ссылка "Получить остатки" не найдена')
      return
    }

    console.log(`✓ Найдена ссылка: ${sheetUrl}\n`)

    // Извлекаем ID таблицы
    const sheetIdMatch = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
    if (!sheetIdMatch) {
      console.error('✗ Не удалось извлечь ID таблицы')
      return
    }

    const sheetId = sheetIdMatch[1]
    console.log(`✓ ID таблицы: ${sheetId}\n`)

    // Пробуем разные форматы экспорта
    const exportUrls = [
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&id=${sheetId}`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`,
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=0`,
    ]

    let workbook: XLSX.WorkBook | null = null
    let successUrl = ''

    for (const exportUrl of exportUrls) {
      try {
        console.log(`Попытка скачать: ${exportUrl}`)
        const response = await axios.get(exportUrl, { 
          responseType: 'arraybuffer',
          timeout: 30000,
        })

        if (response.data && response.data.length > 0) {
          workbook = XLSX.read(response.data, { type: 'buffer' })
          successUrl = exportUrl
          console.log(`✓ Файл скачан успешно, размер: ${response.data.length} байт\n`)
          break
        }
      } catch (error: any) {
        console.log(`✗ Ошибка: ${error.message}`)
        continue
      }
    }

    if (!workbook) {
      console.error('✗ Не удалось скачать Excel файл')
      return
    }

    console.log(`✓ Использован URL: ${successUrl}\n`)

    // Анализируем структуру
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

    console.log(`Вкладка: ${sheetName}`)
    console.log(`Всего строк: ${data.length}\n`)

    // Показываем первые 20 строк
    console.log('Первые 20 строк:')
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i]
      const a = row[0]?.toString().trim() || ''
      const b = row[1]?.toString().trim() || ''
      const c = row[2]?.toString().trim() || ''
      
      console.log(`  Строка ${i + 1}: A="${a.substring(0, 40)}" | B="${b}" | C="${c}"`)
    }

    // Парсим данные
    console.log('\nПарсинг данных:')
    let parsedCount = 0
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      if (row.length < 3) continue

      const collectionColor = row[0]?.toString().trim() || ''
      const stockText = row[1]?.toString().trim() || ''

      if (!collectionColor || !stockText) continue

      parsedCount++
      if (parsedCount <= 5) {
        let inStock: string = 'не определено'
        let comment: string = ''
        
        const stockLower = stockText.toLowerCase()
        if (stockLower.includes('+')) {
          inStock = 'В наличии'
        } else if (stockLower.includes('ограничено') || stockLower.includes('ограниченно')) {
          inStock = 'В наличии (мало)'
          comment = 'ВНИМАНИЕ, МАЛО!'
        } else if (stockLower.includes('нет')) {
          inStock = 'Нет в наличии'
        }

        console.log(`  ${parsedCount}. "${collectionColor}" | ${inStock} ${comment}`)
      }
    }

    console.log(`\n✓ Найдено строк с данными: ${parsedCount}`)

  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    console.log('\nЗакрытие браузера через 5 секунд...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    await browser.close()
  }
}

testTextileNovaSheets()
  .then(() => {
    console.log('\n=== Тест завершен ===')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })



