import puppeteer from 'puppeteer'

async function testTextileNova() {
  console.log('=== Тестирование парсера TextileNova ===\n')

  const browser = await puppeteer.launch({
    headless: false, // Показываем браузер для отладки
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

    console.log('Страница загружена, делаем скриншот...')
    await page.screenshot({ path: 'textilenova-1-initial.png' })
    console.log('Скриншот сохранен: textilenova-1-initial.png\n')

    // Ищем кнопку "Получить остатки"
    console.log('Поиск кнопки "Получить остатки"...')
    
    const buttonInfo = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('a, button, div, span'))
      const results: any[] = []
      
      buttons.forEach((btn, idx) => {
        const text = btn.textContent?.toLowerCase() || ''
        if (text.includes('остатки') || text.includes('получить')) {
          results.push({
            index: idx,
            tag: btn.tagName,
            text: btn.textContent?.trim(),
            className: btn.className,
            id: (btn as HTMLElement).id,
            href: (btn as HTMLElement).getAttribute('href'),
          })
        }
      })
      
      return results
    })

    console.log(`Найдено ${buttonInfo.length} элементов с текстом "остатки" или "получить":`)
    buttonInfo.forEach((info, idx) => {
      console.log(`  ${idx + 1}. ${info.tag} - "${info.text}" (class: ${info.className}, id: ${info.id}, href: ${info.href})`)
    })
    console.log('')

    // Пробуем найти и нажать кнопку
    const buttonClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('a, button, div, span'))
      const button = buttons.find(btn => {
        const text = btn.textContent?.toLowerCase() || ''
        return text.includes('получить остатки') || text.includes('остатки')
      })
      
      if (button) {
        (button as HTMLElement).click()
        return true
      }
      return false
    })

    if (buttonClicked) {
      console.log('✓ Кнопка найдена и нажата')
    } else {
      console.log('✗ Кнопка не найдена')
    }

    // Ждем загрузки
    console.log('Ожидание загрузки данных (5 секунд)...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Делаем скриншот после нажатия
    await page.screenshot({ path: 'textilenova-2-after-click.png' })
    console.log('Скриншот сохранен: textilenova-2-after-click.png\n')

    // Проверяем наличие таблицы
    const tableInfo = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'))
      return {
        count: tables.length,
        tables: tables.map((table, idx) => {
          const rows = Array.from(table.querySelectorAll('tr'))
          return {
            index: idx,
            rows: rows.length,
            firstRowCells: rows[0] ? Array.from(rows[0].querySelectorAll('td, th')).map(cell => cell.textContent?.trim()) : [],
            sampleRows: rows.slice(0, 5).map((row, rowIdx) => {
              const cells = Array.from(row.querySelectorAll('td, th'))
              return {
                rowIndex: rowIdx,
                cells: cells.map(cell => cell.textContent?.trim()),
              }
            }),
          }
        }),
      }
    })

    console.log(`Найдено таблиц: ${tableInfo.count}`)
    tableInfo.tables.forEach((table, idx) => {
      console.log(`\nТаблица ${idx + 1}:`)
      console.log(`  Строк: ${table.rows}`)
      console.log(`  Первая строка (заголовки?): ${table.firstRowCells.join(' | ')}`)
      console.log(`  Примеры строк:`)
      table.sampleRows.forEach((row, rowIdx) => {
        console.log(`    Строка ${rowIdx}: ${row.cells.join(' | ')}`)
      })
    })

    // Пробуем найти данные
    if (tableInfo.count > 0) {
      const fabrics = await page.evaluate(() => {
        const fabrics: any[] = []
        const table = document.querySelector('table')
        
        if (!table) {
          return fabrics
        }

        const rows = Array.from(table.querySelectorAll('tr'))
        
        rows.forEach((row, index) => {
          const cells = Array.from(row.querySelectorAll('td, th'))
          if (cells.length < 3) return

          const collectionColor = cells[0]?.textContent?.trim() || ''
          const stockText = cells[1]?.textContent?.trim() || ''
          const arrivalText = cells[2]?.textContent?.trim() || ''

          if (collectionColor && stockText) {
            fabrics.push({
              rowIndex: index,
              collectionColor,
              stockText,
              arrivalText,
            })
          }
        })

        return fabrics
      })

      console.log(`\nНайдено строк с данными: ${fabrics.length}`)
      if (fabrics.length > 0) {
        console.log('Первые 5 строк:')
        fabrics.slice(0, 5).forEach((fabric, idx) => {
          console.log(`  ${idx + 1}. Строка ${fabric.rowIndex}: "${fabric.collectionColor}" | "${fabric.stockText}" | "${fabric.arrivalText}"`)
        })
      }
    } else {
      console.log('\n⚠️ Таблицы не найдены!')
      
      // Проверяем, что вообще есть на странице
      const pageContent = await page.evaluate(() => {
        return {
          title: document.title,
          bodyText: document.body.textContent?.substring(0, 500),
          links: Array.from(document.querySelectorAll('a')).slice(0, 10).map(a => ({
            text: a.textContent?.trim(),
            href: a.getAttribute('href'),
          })),
        }
      })
      
      console.log('\nИнформация о странице:')
      console.log(`  Заголовок: ${pageContent.title}`)
      console.log(`  Текст (первые 500 символов): ${pageContent.bodyText}`)
      console.log(`  Ссылки (первые 10):`)
      pageContent.links.forEach((link, idx) => {
        console.log(`    ${idx + 1}. "${link.text}" -> ${link.href}`)
      })
    }

  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
  } finally {
    console.log('\nЗакрытие браузера через 10 секунд...')
    await new Promise(resolve => setTimeout(resolve, 10000))
    await browser.close()
  }
}

testTextileNova()
  .then(() => {
    console.log('\n=== Тест завершен ===')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })


