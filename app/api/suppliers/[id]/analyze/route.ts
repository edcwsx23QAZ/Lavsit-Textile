import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { ArtvisionParser } from '@/lib/parsers/artvision-parser'
import { SouzmParser } from '@/lib/parsers/souzm-parser'
import { DomiartParser } from '@/lib/parsers/domiart-parser'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supplier = await prisma.supplier.findUnique({
      where: { id: params.id },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    let parser
    
    // Проверяем метод парсинга для email-поставщиков
    if (supplier.parsingMethod === 'email') {
      // For email type, we need to get the latest unprocessed attachment
      const { EmailParser } = await import('@/lib/email/email-parser')
      
      if (!supplier.emailConfig) {
        return NextResponse.json(
          { error: 'Email configuration not found. Please configure email settings first.' },
          { status: 400 }
        )
      }

      let emailConfig = JSON.parse(supplier.emailConfig)
      
      // Нормализуем структуру emailConfig (конвертируем из вложенной в плоскую, если нужно)
      if (emailConfig.imap && (emailConfig.imap.host || emailConfig.imap.port || emailConfig.imap.user)) {
        // Вложенная структура - конвертируем в плоскую для EmailParser
        emailConfig = {
          host: emailConfig.imap.host || '',
          port: emailConfig.imap.port || 993,
          user: emailConfig.imap.user || '',
          password: emailConfig.imap.password || '',
          secure: emailConfig.imap.secure !== false,
          fromEmail: emailConfig.fromEmail || '',
          subjectFilter: emailConfig.subjectFilter || '',
          searchDays: emailConfig.searchDays || 90,
          searchUnreadOnly: emailConfig.searchUnreadOnly !== undefined ? emailConfig.searchUnreadOnly : false,
          useAnyLatestAttachment: emailConfig.useAnyLatestAttachment === true,
        }
      }
      
      const emailParser = new EmailParser(emailConfig)
      
      // Get attachments - use any latest if configured, otherwise only unprocessed
      const useAnyLatest = emailConfig.useAnyLatestAttachment === true
      const unprocessedFiles = await emailParser.getUnprocessedAttachments(supplier.id, useAnyLatest)
      
      if (unprocessedFiles.length === 0) {
        const message = useAnyLatest 
          ? 'No email attachments found. Please check emails first using /parse-email endpoint.'
          : 'No unprocessed email attachments found. Please check emails first using /parse-email endpoint or enable "Use any latest attachment" in settings.'
        return NextResponse.json(
          { error: message },
          { status: 400 }
        )
      }

      // Use the most recent file
      const filePath = unprocessedFiles[0]
      
      // Выбираем парсер в зависимости от поставщика
      if (supplier.name === 'Аметист') {
        const { AmetistParser } = await import('@/lib/parsers/ametist-parser')
        parser = new AmetistParser(supplier.id, supplier.name)
      } else {
        const { EmailExcelParser } = await import('@/lib/parsers/email-excel-parser')
        parser = new EmailExcelParser(supplier.id, supplier.name)
      }
      
      // Override analyze method to use file path
      const originalAnalyze = parser.analyze.bind(parser)
      parser.analyze = async () => {
        return originalAnalyze(filePath)
      }
    } else {
      // Для остальных поставщиков используем switch по имени
      switch (supplier.name) {
        case 'Artvision':
          parser = new ArtvisionParser(supplier.id, supplier.name)
          break
        case 'Союз-М':
          parser = new SouzmParser(supplier.id, supplier.name)
          break
        case 'Домиарт':
          parser = new DomiartParser(supplier.id, supplier.name)
          break
        case 'Артекс':
          const { ArteksParser } = await import('@/lib/parsers/arteks-parser')
          parser = new ArteksParser(supplier.id, supplier.name)
          break
        case 'TextileData':
          const { TextileDataParser } = await import('@/lib/parsers/textiledata-parser')
          parser = new TextileDataParser(supplier.id, supplier.name)
          break
        case 'NoFrames':
          const { NoFramesParser } = await import('@/lib/parsers/noframes-parser')
          parser = new NoFramesParser(supplier.id, supplier.name)
          break
        case 'Tex.Group':
        case 'Fancy Fabric':
          const { TexGroupParser } = await import('@/lib/parsers/texgroup-parser')
          parser = new TexGroupParser(supplier.id, supplier.name)
          break
        case 'Vektor':
          const { VektorParser } = await import('@/lib/parsers/vektor-parser')
          parser = new VektorParser(supplier.id, supplier.name)
          break
        case 'TextileNova':
          const { TextileNovaParser } = await import('@/lib/parsers/textilenova-parser')
          parser = new TextileNovaParser(supplier.id, supplier.name)
          break
        case 'Viptextil':
          const { ViptextilParser } = await import('@/lib/parsers/viptextil-parser')
          parser = new ViptextilParser(supplier.id, supplier.name)
          break
        case 'Artefact':
          const { ArtefactParser } = await import('@/lib/parsers/artefact-parser')
          parser = new ArtefactParser(supplier.id, supplier.name)
          break
        case 'Эгида':
          const { EgidaParser } = await import('@/lib/parsers/egida-parser')
          parser = new EgidaParser(supplier.id, supplier.name)
          break
        default:
          return NextResponse.json(
            { error: 'Unknown supplier' },
            { status: 400 }
          )
      }
    }

    // For email type, analyze method is already overridden to use file path
    // For other types, use parsingUrl
    const analysis = supplier.parsingMethod === 'email'
      ? await parser.analyze('') // URL not used for email type
      : await parser.analyze(supplier.parsingUrl)

    return NextResponse.json(analysis)
  } catch (error: any) {
    console.error('Error analyzing supplier:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze supplier' },
      { status: 500 }
    )
  }
}

