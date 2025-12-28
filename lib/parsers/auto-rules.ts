import { ParsingAnalysis, ParsingRules } from './base-parser'

/**
 * Автоматически создает правила парсинга на основе анализа данных
 */
export function createAutoRules(
  supplierName: string,
  analysis: ParsingAnalysis
): ParsingRules {
  const rules: ParsingRules = {
    columnMappings: {},
    skipRows: [],
    skipPatterns: [],
  }

  // Определяем правила в зависимости от поставщика
  if (supplierName === 'Artvision') {
    // Artvision: первая колонка - коллекция+цвет, вторая - наличие, третья - метраж, четвертая - дата
    rules.columnMappings.collection = 0
    rules.columnMappings.inStock = 1
    rules.columnMappings.meterage = 2
    rules.columnMappings.nextArrivalDate = 3
    
    // Специальное правило для Artvision: если есть тире, то первая часть - коллекция, вторая - цвет
    rules.specialRules = {
      artvisionDashPattern: true,
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'Союз-М') {
    // Союз-М: колонка B (номер 2 в Excel, индекс 1 в массиве) - коллекция+цвет, C (3/2) - наличие, D (4/3) - дата, E (5/4) - комментарий
    // В Excel номера колонок: A=1, B=2, C=3, D=4, E=5
    // Но мы сохраняем индексы массива (0-based): A=0, B=1, C=2, D=3, E=4
    rules.columnMappings.collection = 1 // B = индекс 1 (0-based, соответствует номеру 2 в Excel)
    rules.columnMappings.inStock = 2 // C = индекс 2 (0-based, соответствует номеру 3 в Excel)
    rules.columnMappings.nextArrivalDate = 3 // D = индекс 3 (0-based, соответствует номеру 4 в Excel)
    rules.columnMappings.comment = 4 // E = индекс 4 (0-based, соответствует номеру 5 в Excel)
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'Домиарт') {
    // Домиарт: колонка A (индекс 0) - коллекция+цвет, B (1) - наличие, C (2) - дата
    rules.columnMappings.collection = 0 // A = индекс 0
    rules.columnMappings.inStock = 1 // B = индекс 1
    rules.columnMappings.nextArrivalDate = 2 // C = индекс 2
    
    // Специальное правило для Alfa 2303
    rules.specialRules = {
      alfa2303Pattern: true,
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'Артекс') {
    // Артекс: колонка A (индекс 0) - коллекция+цвет, B (1) - наличие, C (2) - дата
    rules.columnMappings.collection = 0 // A = индекс 0
    rules.columnMappings.inStock = 1 // B = индекс 1
    rules.columnMappings.nextArrivalDate = 2 // C = индекс 2
    
    // Специальное правило: убирать "Мебельная ткань"
    rules.specialRules = {
      removeFurnitureText: true,
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'TextileData') {
    // TextileData: HTML таблица, колонки определяются по заголовкам
    // Товар - коллекция+цвет, Остаток - метраж, Макс.ролик - комментарий, Дата прихода - дата
    rules.columnMappings.collection = 0
    rules.columnMappings.meterage = 1
    rules.columnMappings.comment = 2
    rules.columnMappings.nextArrivalDate = 3
    
    // Специальное правило: убирать "_\" и оставлять только цифры для цвета
    rules.specialRules = {
      removeUnderscoreBackslash: true,
      colorOnlyNumbers: true,
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'NoFrames') {
    // NoFrames: колонка B (индекс 1) - коллекция+цвет, D (3) - наличие, E (4) - дата
    rules.columnMappings.collection = 1 // B = индекс 1
    rules.columnMappings.inStock = 3 // D = индекс 3
    rules.columnMappings.nextArrivalDate = 4 // E = индекс 4
    
    // Специальные правила: убирать "ткань мебельная" и кавычки
    rules.specialRules = {
      removeFurnitureText: true,
      removeQuotes: true,
    }
    
    // Пропускаем заголовки и служебные строки (первые 6 строк)
    // Строка 1: пустая
    // Строка 2-5: служебная информация
    // Строка 6: заголовки таблицы
    rules.skipRows = [1, 2, 3, 4, 5, 6]
    rules.headerRow = 6
  } else if (supplierName === 'Нортекс' || supplierName === 'Нортекс') {
    // Нортекс: колонка C (индекс 2) - коллекция и цвет ("Ткань Collection Color")
    // Столбец E (индекс 4) - галочка "V" для наличия < 100м
    // Столбец F (индекс 5) - может быть галочка "V", метраж (цифры), дата прихода (текст), комментарий
    // Столбец G (индекс 6) - если заполнен, в наличии, метраж 100+м
    rules.columnMappings.collection = 2 // C = индекс 2
    // inStock, meterage, nextArrivalDate, comment будут определяться динамически из столбцов E, F, G
    
    // Специальные правила для Нортекса
    rules.specialRules = {
      nortexPattern: true,
      removeTkanPrefix: true, // Игнорировать слово "ткань"
    }
    
    // Пропускаем заголовки и служебные строки (первые 10 строк)
    rules.skipRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    rules.headerRow = 10
    
    // Пропускаем строки, которые не содержат "Ткань" в столбце C
    rules.skipPatterns = ['пог. м', 'Ед.изм.', 'отчет создан']
  } else if (supplierName === 'Tex.Group' || supplierName === 'Fancy Fabric') {
    // Tex.Group: колонка B (индекс 1) - коллекция и цвет, колонка D (индекс 3) - наличие
    rules.columnMappings.collection = 1 // B = индекс 1
    rules.columnMappings.inStock = 3 // D = индекс 3
    
    // Специальное правило для Tex.Group: первое слово - коллекция, цифры и остальное - цвет
    rules.specialRules = {
      texGroupPattern: true,
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'Vektor') {
    // Vektor: колонка A (индекс 0) - коллекция+цвет, колонка E (индекс 4) - единица измерения, колонка F (индекс 5) - наличие/метраж
    rules.columnMappings.collection = 0 // A = индекс 0
    rules.columnMappings.inStock = 5 // F = индекс 5 (наличие/метраж)
    
    // Специальные правила для Vektor
    rules.specialRules = {
      removeTkanPrefix: true, // Удаление префикса "Ткань"
      removeKozhZam: true, // Удаление "КОЖ ЗАМ" и "КОЖ ЗАМ АВТО"
      vektorPattern: true, // Специальный паттерн парсинга для Vektor
    }
    
    // Пропускаем строки с "Сетка" и "ФУРНИТУРА"
    rules.skipPatterns = ['Сетка', 'ФУРНИТУРА', 'Остатки товаров', 'Область учета', 'Номенклатура']
    
    // Пропускаем заголовки и служебные строки (первые 9 строк)
    rules.skipRows = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    rules.headerRow = 9
  } else if (supplierName === 'Аметист') {
    // Аметист: колонка C (индекс 2) - коллекция, E (индекс 4) - цвет, G (индекс 6) - наличие, J (индекс 9) - дата
    rules.columnMappings.collection = 2 // C = индекс 2
    rules.columnMappings.color = 4 // E = индекс 4
    rules.columnMappings.inStock = 6 // G = индекс 6
    rules.columnMappings.nextArrivalDate = 9 // J = индекс 9
    
    // Специальное правило для Аметиста: удаление первого слова цвета, если оно совпадает с коллекцией
    rules.specialRules = {
      ametistColorPattern: true, // Удаление первого слова цвета, если совпадает с коллекцией
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'TextileNova') {
    // TextileNova: колонка A (индекс 0) - коллекция и цвет, B (индекс 1) - остатки, C (индекс 2) - дата
    rules.columnMappings.collection = 0 // A = индекс 0
    rules.columnMappings.inStock = 1 // B = индекс 1 (остатки)
    rules.columnMappings.nextArrivalDate = 2 // C = индекс 2 (дата)
    
    // Специальные правила для TextileNova
    rules.specialRules = {
      textilenovaPattern: true, // Специальный паттерн для TextileNova
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1]
      rules.headerRow = 1
    }
  } else if (supplierName === 'Viptextil') {
    // Viptextil: колонка A (индекс 0) - коллекция и цвет, B (индекс 1) - наличие
    rules.columnMappings.collection = 0 // A = индекс 0
    rules.columnMappings.inStock = 1 // B = индекс 1 (наличие)
    
    // Специальные правила для Viptextil: первое слово - коллекция, остальное - цвет (может быть текстом)
    rules.specialRules = {
      viptextilPattern: true, // Первое слово - коллекция, остальное - цвет (текст, не только цифры)
    }
    
    // Пропускаем заголовки если они есть
    if (analysis.structure.headers) {
      rules.skipRows = [1, 2] // Пропускаем первую строку (заголовок) и вторую (пустая или "Остатки")
      rules.headerRow = 1
    } else {
      // Если заголовки не определены автоматически, но есть строка с "Номенклатура"
      const firstRow = analysis.sampleData[0] || []
      if (firstRow.some(cell => cell.toLowerCase().includes('номенклатура'))) {
        rules.skipRows = [1, 2]
        rules.headerRow = 1
      }
    }
    
    // Добавляем паттерны для пропуска заголовков разделов
    if (!rules.skipPatterns) {
      rules.skipPatterns = []
    }
    rules.skipPatterns.push(
      'ИСКУССТВЕННАЯ КОЖА',
      'Кожа иск',
      'Кожа иск.',
      'ТКАНИ',
      'Жаккард',
      'Шенилл',
      'Шенилл (рас)',
      'Компаньон',
      'Основа',
      'Остатки',
      'Итого',
      'Номенклатура'
    )
    
    // Пропускаем строки, где второй столбец пуст (заголовки коллекций)
    // Это будет обработано в парсере
  }

  // Автоматически определяем строки для пропуска на основе пустых или заголовочных строк
  analysis.sampleData.forEach((row, index) => {
    const rowStr = row.join(' ').toLowerCase()
    // Пропускаем строки с заголовками
    if (
      rowStr.includes('коллекция') ||
      rowStr.includes('цвет') ||
      rowStr.includes('наличие') ||
      rowStr.includes('метраж') ||
      rowStr.includes('дата') ||
      rowStr.includes('комментарий')
    ) {
      if (!rules.skipRows?.includes(index + 1)) {
        rules.skipRows = rules.skipRows || []
        rules.skipRows.push(index + 1)
      }
    }
  })

  return rules
}

