import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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
      case 'email':
        // For email type, we need to get the latest unprocessed attachment
        const { EmailParser } = await import('@/lib/email/email-parser')
        const { EmailExcelParser } = await import('@/lib/parsers/email-excel-parser')
        
        if (!supplier.emailConfig) {
          return NextResponse.json(
            { error: 'Email configuration not found. Please configure email settings first.' },
            { status: 400 }
          )
        }

        const emailConfig = JSON.parse(supplier.emailConfig)
        const emailParser = new EmailParser(emailConfig)
        
        // Get unprocessed attachments
        const unprocessedFiles = await emailParser.getUnprocessedAttachments(supplier.id)
        
        if (unprocessedFiles.length === 0) {
          return NextResponse.json(
            { error: 'No unprocessed email attachments found. Please check emails first using /parse-email endpoint.' },
            { status: 400 }
          )
        }

        // Use the most recent file
        const filePath = unprocessedFiles[0]
        parser = new EmailExcelParser(supplier.id, supplier.name)
        
        // Override analyze method to use file path
        const originalAnalyze = parser.analyze.bind(parser)
        parser.analyze = async () => {
          return originalAnalyze(filePath)
        }
        break
      default:
        return NextResponse.json(
          { error: 'Unknown supplier' },
          { status: 400 }
        )
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

