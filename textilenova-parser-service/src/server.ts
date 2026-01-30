import express, { Request, Response } from 'express'
import cors from 'cors'
import { TextileNovaParser, ParsingRules } from './parser'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Parse endpoint
app.post('/parse', async (req: Request, res: Response) => {
  try {
    const { url, rules } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    if (!rules) {
      return res.status(400).json({ error: 'Rules are required' })
    }

    console.log(`[Server] Parse request received for URL: ${url}`)
    
    const parser = new TextileNovaParser()
    const result = await parser.parse(url, rules as ParsingRules)

    console.log(`[Server] Parse completed, found ${result.length} fabrics`)
    
    res.json({
      success: true,
      data: result,
      count: result.length
    })
  } catch (error: any) {
    console.error('[Server] Parse error:', error)
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
    const { url } = req.body

    if (!url) {
      return res.status(400).json({ error: 'URL is required' })
    }

    console.log(`[Server] Analyze request received for URL: ${url}`)
    
    const parser = new TextileNovaParser()
    const result = await parser.analyze(url)

    console.log(`[Server] Analyze completed`)
    
    res.json({
      success: true,
      data: result
    })
  } catch (error: any) {
    console.error('[Server] Analyze error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

app.listen(PORT, () => {
  console.log(`[Server] TextileNova Parser Service running on port ${PORT}`)
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`)
})

