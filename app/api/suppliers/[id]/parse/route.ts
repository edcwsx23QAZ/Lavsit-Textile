import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ArtvisionParser } from '@/lib/parsers/artvision-parser'
import { SouzmParser } from '@/lib/parsers/souzm-parser'
import { DomiartParser } from '@/lib/parsers/domiart-parser'
import { updateFabricsFromParser } from '@/lib/manual-upload-utils'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

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
            { error: 'Email configuration not found' },
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
        
        // Store file path for later use
        ;(parser as any).filePath = filePath
        break
      default:
        return NextResponse.json(
          { error: 'Unknown supplier' },
          { status: 400 }
        )
    }

    // Проверяем наличие правил парсинга
    const rules = await parser.loadRules()
    if (!rules) {
      console.log(`[parse] Правила не найдены для ${supplier.name}, проводим автоматический анализ...`)
      // Автоматически проводим анализ и создаем правила
      try {
        // For email type, analyze method is already overridden to use file path
        // For other types, use parsingUrl
        const analysis = supplier.parsingMethod === 'email'
          ? await (parser as any).analyze((parser as any).filePath)
          : await parser.analyze(supplier.parsingUrl)
        const { createAutoRules } = await import('@/lib/parsers/auto-rules')
        const autoRules = createAutoRules(supplier.name, analysis)
        await parser.saveRules(autoRules)
        console.log(`[parse] Правила автоматически созданы для ${supplier.name}`)
      } catch (analysisError: any) {
        console.error(`[parse] Ошибка анализа для ${supplier.name}:`, analysisError)
        return NextResponse.json(
          { 
            error: 'Не удалось автоматически создать правила парсинга. Проведите анализ вручную.',
            details: analysisError.message 
          },
          { status: 400 }
        )
      }
    } else {
      console.log(`[parse] Правила найдены для ${supplier.name}`)
    }

    // For email type, use stored file path
    // For other types, use parsingUrl
    const fabrics = supplier.parsingMethod === 'email' 
      ? await (parser as any).parse((parser as any).filePath)
      : await parser.parse(supplier.parsingUrl)

    // Сохраняем распарсенные данные в Excel файл
    try {
      const { saveParsedDataToExcel } = await import('@/lib/parsers/save-parsed-data')
      await saveParsedDataToExcel(supplier.id, supplier.name, fabrics)
      console.log(`[parse] Данные сохранены в Excel для ${supplier.name}`)
    } catch (saveError: any) {
      console.error(`[parse] Ошибка сохранения в Excel для ${supplier.name}:`, saveError)
      // Не прерываем выполнение, если не удалось сохранить в Excel
    }

    // Обновляем ткани, учитывая ручные загрузки
    const updatedCount = await updateFabricsFromParser(supplier.id, fabrics)

    // Получаем актуальное количество тканей
    const fabricsCount = await prisma.fabric.count({
      where: { supplierId: supplier.id },
    })

    // Обновляем информацию о поставщике
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        fabricsCount,
        lastUpdatedAt: new Date(),
        status: 'active',
        errorMessage: null,
      },
    })

    return NextResponse.json({
      success: true,
      fabricsCount: fabrics.length,
    })
  } catch (error: any) {
    console.error('Error parsing supplier:', error)
    
    // Обновляем статус поставщика при ошибке
    await prisma.supplier.update({
      where: { id: params.id },
      data: {
        status: 'error',
        errorMessage: error.message || 'Unknown error',
      },
    })

    return NextResponse.json(
      { error: error.message || 'Failed to parse supplier' },
      { status: 500 }
    )
  }
}

