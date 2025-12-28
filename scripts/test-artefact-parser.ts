import axios from 'axios'
import * as cheerio from 'cheerio'
import * as XLSX from 'xlsx'

const pageUrl = 'https://artefakt-msk.com/%D0%BD%D0%B0%D0%BB%D0%B8%D1%87%D0%B8%D0%B5'

async function findDownloadUrl(pageUrl: string): Promise<string> {
  console.log('=== Шаг 1: Загружаем HTML страницу ===')
  const response = await axios.get(pageUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  })
  const $ = cheerio.load(response.data)
  
  console.log('HTML загружен\n')
  
  // Ищем ссылку со словом "скачать"
  let downloadUrl: string | null = null
  
  console.log('=== Шаг 2: Ищем ссылку "скачать" ===')
  $('a').each((_, element) => {
    const text = $(element).text().toLowerCase().trim()
    const href = $(element).attr('href')
    
    if (text.includes('скачать') && href) {
      if (href.startsWith('http')) {
        downloadUrl = href
      } else {
        const baseUrl = new URL(pageUrl)
        downloadUrl = new URL(href, baseUrl.origin).href
      }
      console.log(`Найдена ссылка: "${text}" -> ${downloadUrl}`)
      return false
    }
  })
  
  // Если не нашли по тексту, ищем по расширению файла
  if (!downloadUrl) {
    console.log('Ссылка "скачать" не найдена, ищем по расширению .xlsx/.xls')
    $('a').each((_, element) => {
      const href = $(element).attr('href')
      if (href && (href.toLowerCase().endsWith('.xlsx') || href.toLowerCase().endsWith('.xls'))) {
        if (href.startsWith('http')) {
          downloadUrl = href
        } else {
          const baseUrl = new URL(pageUrl)
          downloadUrl = new URL(href, baseUrl.origin).href
        }
        console.log(`Найдена ссылка по расширению: ${downloadUrl}`)
        return false
      }
    })
  }
  
  if (!downloadUrl) {
    throw new Error('Не найдена ссылка для скачивания')
  }
  
  return downloadUrl
}

function parseCollectionAndColorArtefact(text: string): { collection: string; color: string } | null {
  const trimmed = text.trim()
  if (!trimmed) return null
  
  // Нормализуем пробелы
  const normalized = trimmed.replace(/\s+/g, ' ')
  
  // Ищем цифры
  const digitMatch = normalized.match(/\d/)
  const hasDigits = digitMatch !== null
  
  if (hasDigits) {
    // Ищем первое вхождение цифры
    const firstDigitIndex = normalized.search(/\d/)
    if (firstDigitIndex > 0) {
      const collection = normalized.substring(0, firstDigitIndex).trim()
      const color = normalized.substring(firstDigitIndex).trim()
      if (collection) {
        return { collection, color }
      }
    }
    
    // Альтернативный вариант
    const match = normalized.match(/^(.+?)\s+(\d.*)$/)
    if (match) {
      const collection = match[1].trim()
      const color = match[2].trim()
      if (collection) {
        return { collection, color }
      }
    }
  } else {
    const parts = normalized.split(/\s+/).filter(p => p.trim().length > 0)
    if (parts.length >= 2) {
      const collection = parts.slice(0, -1).join(' ').trim()
      const color = parts[parts.length - 1].trim()
      return { collection, color }
    } else if (parts.length === 1) {
      return { collection: parts[0], color: '' }
    }
  }
  
  return null
}

function parseMeterageAndStock(text: string): { meterage: number | null; inStock: boolean; comment: string | null } {
  const trimmed = String(text).trim().toLowerCase()
  
  if (trimmed === 'нет' || trimmed === '') {
    return { meterage: null, inStock: false, comment: null }
  }
  
  if (trimmed === 'много') {
    return { meterage: null, inStock: true, comment: null }
  }
  
  const numValue = parseFloat(trimmed.replace(',', '.'))
  if (!isNaN(numValue) && numValue > 0) {
    const inStock = true
    let comment: string | null = null
    
    if (numValue < 10) {
      comment = 'ВНИМАНИЕ, МАЛО!'
    }
    
    return { meterage: numValue, inStock, comment }
  }
  
  return { meterage: null, inStock: false, comment: trimmed }
}

async function testParser() {
  try {
    console.log('=== ТЕСТИРОВАНИЕ ПАРСЕРА ARTEFACT ===\n')
    
    // Шаг 1: Находим ссылку для скачивания
    const downloadUrl = await findDownloadUrl(pageUrl)
    console.log(`\nСсылка для скачивания: ${downloadUrl}\n`)
    
    // Шаг 2: Скачиваем Excel файл
    console.log('=== Шаг 3: Скачиваем Excel файл ===')
    const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' })
    const workbook = XLSX.read(response.data, { type: 'buffer' })
    
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]
    
    console.log(`Загружено строк: ${data.length}`)
    console.log(`Используется лист: ${sheetName}\n`)
    
    // Шаг 3: Анализируем первые 20 строк
    console.log('=== Шаг 4: Анализ первых 20 строк ===\n')
    for (let i = 0; i < Math.min(20, data.length); i++) {
      const row = data[i]
      const colA = String(row[0] || '').trim()
      const colC = String(row[2] || '').trim()
      const colD = String(row[3] || '').trim()
      
      console.log(`Строка ${i + 1}:`)
      console.log(`  A (0): "${colA}"`)
      console.log(`  B (1): "${String(row[1] || '').trim()}"`)
      console.log(`  C (2): "${colC}"`)
      console.log(`  D (3): "${colD}"`)
      
      // Проверяем, не "Распродажа"
      const firstCell = colA.toLowerCase()
      if (firstCell.includes('распродажа')) {
        console.log(`  ⚠️ Найдена строка "Распродажа" - парсинг должен остановиться здесь`)
        break
      }
      
      // Проверяем условия для парсинга
      if (!colA) {
        console.log(`  ❌ Пропущено: столбец A пуст`)
      } else if (!colC || colC === '') {
        console.log(`  ❌ Пропущено: столбец C пуст`)
      } else {
        // Пробуем распарсить
        const collectionColor = parseCollectionAndColorArtefact(colA)
        if (!collectionColor || !collectionColor.collection) {
          console.log(`  ❌ Пропущено: не удалось распарсить коллекцию и цвет`)
        } else {
          const { meterage, inStock, comment } = parseMeterageAndStock(colC)
          console.log(`  ✅ ВАЛИДНАЯ ТКАНЬ:`)
          console.log(`     Коллекция: "${collectionColor.collection}"`)
          console.log(`     Цвет: "${collectionColor.color}"`)
          console.log(`     Метраж: ${meterage || 'N/A'}`)
          console.log(`     В наличии: ${inStock}`)
          console.log(`     Комментарий: ${comment || 'нет'}`)
        }
      }
      console.log('')
    }
    
    // Шаг 4: Полный парсинг
    console.log('\n=== Шаг 5: Полный парсинг ===\n')
    const fabrics: any[] = []
    let processedCount = 0
    let skippedCount = 0
    let addedCount = 0
    let stopParsing = false
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 1
      
      if (stopParsing) {
        break
      }
      
      const firstCell = String(row[0] || '').trim().toLowerCase()
      if (firstCell.includes('распродажа')) {
        stopParsing = true
        console.log(`Найдена строка "Распродажа" на строке ${rowNumber}, прекращаем парсинг`)
        break
      }
      
      const colA = String(row[0] || '').trim()
      if (!colA) {
        skippedCount++
        continue
      }
      
      const colC = String(row[2] || '').trim()
      if (!colC || colC === '') {
        skippedCount++
        continue
      }
      
      processedCount++
      
      const collectionColor = parseCollectionAndColorArtefact(colA)
      if (!collectionColor || !collectionColor.collection) {
        skippedCount++
        continue
      }
      
      const { meterage, inStock, comment: meterageComment } = parseMeterageAndStock(colC)
      const colD = String(row[3] || '').trim()
      
      let finalComment: string | null = null
      if (meterageComment && colD) {
        finalComment = `${meterageComment}. ${colD}`
      } else if (meterageComment) {
        finalComment = meterageComment
      } else if (colD) {
        finalComment = colD
      }
      
      const fabric = {
        collection: collectionColor.collection,
        colorNumber: collectionColor.color || '',
        inStock,
        meterage,
        comment: finalComment,
      }
      
      fabrics.push(fabric)
      addedCount++
      
      if (addedCount <= 10) {
        console.log(`Ткань ${addedCount}: "${fabric.collection}" "${fabric.colorNumber}" - ${fabric.inStock ? 'В наличии' : 'Не в наличии'} (метраж: ${fabric.meterage || 'N/A'})`)
      }
    }
    
    console.log(`\n=== ИТОГИ ===`)
    console.log(`Обработано валидных строк: ${processedCount}`)
    console.log(`Добавлено тканей: ${addedCount}`)
    console.log(`Пропущено: ${skippedCount}`)
    
    if (addedCount === 0) {
      console.log(`\n❌ ПРОБЛЕМА: Не найдено ни одной ткани!`)
      console.log(`\nДетальный анализ первых 30 строк:`)
      for (let i = 0; i < Math.min(30, data.length); i++) {
        const row = data[i]
        const colB = String(row[1] || '').trim()
        const colC = String(row[2] || '').trim()
        console.log(`Строка ${i + 1}: B="${colB}" | C="${colC}"`)
      }
    } else {
      console.log(`\n✅ Успешно найдено ${addedCount} тканей`)
      console.log(`\nПримеры первых 5 тканей:`)
      fabrics.slice(0, 5).forEach((f, i) => {
        console.log(`  ${i + 1}. ${f.collection} ${f.colorNumber} - ${f.inStock ? 'В наличии' : 'Не в наличии'}`)
      })
    }
    
  } catch (error: any) {
    console.error('Ошибка:', error.message)
    console.error('Stack:', error.stack)
  }
}

testParser()

