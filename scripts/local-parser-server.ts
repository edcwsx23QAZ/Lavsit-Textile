import express, { Request, Response } from 'express'
import cors from 'cors'
import { BaseParser, ParsedFabric, ParsingAnalysis, ParsingRules } from '../lib/parsers/base-parser'

const app = express()
const PORT = process.env.LOCAL_PARSER_PORT || 4002

// Middleware
app.use(cors())
app.use(express.json())

// Маппинг имен парсеров на их модули
const PARSER_MAP: Record<string, () => Promise<any>> = {
  'TextileNovaParser': () => import('../lib/parsers/textilenova-parser'),
  'ArtefactParser': () => import('../lib/parsers/artefact-parser'),
  'ArteksParser': () => import('../lib/parsers/arteks-parser'),
  'ArtvisionParser': () => import('../lib/parsers/artvision-parser'),
  'DomiartParser': () => import('../lib/parsers/domiart-parser'),
  'EgidaParser': () => import('../lib/parsers/egida-parser'),
  'NoFramesParser': () => import('../lib/parsers/noframes-parser'),
  'SouzmParser': () => import('../lib/parsers/souzm-parser'),
  'TexGroupParser': () => import('../lib/parsers/texgroup-parser'),
  'TextileDataParser': () => import('../lib/parsers/textiledata-parser'),
  'VektorParser': () => import('../lib/parsers/vektor-parser'),
  'ViptextilParser': () => import('../lib/parsers/viptextil-parser'),
  'AmetistParser': () => import('../lib/parsers/ametist-parser'),
  'EmailExcelParser': () => import('../lib/parsers/email-excel-parser'),
}

/**
 * Создает экземпляр парсера по имени класса
 */
async function createParser(parserName: string, supplierId: string, supplierName: string): Promise<BaseParser> {
  const parserLoader = PARSER_MAP[parserName]
  
  if (!parserLoader) {
    throw new Error(`Парсер ${parserName} не найден`)
  }
  
  const module = await parserLoader()
  const ParserClass = module[parserName]
  
  if (!ParserClass) {
    throw new Error(`Класс ${parserName} не найден в модуле`)
  }
  
  return new ParserClass(supplierId, supplierName)
}

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    parsers: Object.keys(PARSER_MAP)
  })
})

// Parse endpoint
app.post('/parse', async (req: Request, res: Response) => {
  try {
    const { parserName, supplierId, supplierName, url, rules } = req.body

    if (!parserName) {
      return res.status(400).json({ success: false, error: 'parserName is required' })
    }

    if (!supplierId || !supplierName) {
      return res.status(400).json({ success: false, error: 'supplierId and supplierName are required' })
    }

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' })
    }

    if (!rules) {
      return res.status(400).json({ success: false, error: 'Rules are required' })
    }

    console.log(`[LocalParserServer] Parse request: ${parserName} for ${supplierName} (${supplierId})`)
    console.log(`[LocalParserServer] URL: ${url}`)
    
    const parser = await createParser(parserName, supplierId, supplierName)
    
    // Сохраняем правила временно для парсера
    await parser.saveRules(rules as ParsingRules)
    
    // Выполняем парсинг
    const result = await parser.parse(url)

    console.log(`[LocalParserServer] Parse completed, found ${result.length} fabrics`)
    
    // Преобразуем даты в строки для JSON
    const serializedResult = result.map(fabric => ({
      ...fabric,
      nextArrivalDate: fabric.nextArrivalDate ? fabric.nextArrivalDate.toISOString() : null
    }))
    
    res.json({
      success: true,
      data: serializedResult,
      count: serializedResult.length
    })
  } catch (error: any) {
    console.error('[LocalParserServer] Parse error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// Analyze endpoint
app.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { parserName, supplierId, supplierName, url } = req.body

    if (!parserName) {
      return res.status(400).json({ success: false, error: 'parserName is required' })
    }

    if (!supplierId || !supplierName) {
      return res.status(400).json({ success: false, error: 'supplierId and supplierName are required' })
    }

    if (!url) {
      return res.status(400).json({ success: false, error: 'URL is required' })
    }

    console.log(`[LocalParserServer] Analyze request: ${parserName} for ${supplierName} (${supplierId})`)
    console.log(`[LocalParserServer] URL: ${url}`)
    
    const parser = await createParser(parserName, supplierId, supplierName)
    const result = await parser.analyze(url)

    console.log(`[LocalParserServer] Analyze completed`)
    
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('[LocalParserServer] Analyze error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

app.listen(PORT, () => {
  console.log(`[LocalParserServer] Local Parser Service running on port ${PORT}`)
  console.log(`[LocalParserServer] Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`[LocalParserServer] Supported parsers: ${Object.keys(PARSER_MAP).join(', ')}`)
})

