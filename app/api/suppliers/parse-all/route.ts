import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ArtvisionParser } from '@/lib/parsers/artvision-parser'
import { SouzmParser } from '@/lib/parsers/souzm-parser'
import { DomiartParser } from '@/lib/parsers/domiart-parser'
import { updateFabricsFromParser } from '@/lib/manual-upload-utils'
import { getCategoryByPrice, calculatePricePerMeter, DEFAULT_CATEGORIES } from '@/lib/fabric-categories'

/**
 * Парсит одного поставщика (та же логика, что и в /api/suppliers/[id]/parse)
 */
async function parseSupplier(supplier: { id: string; name: string; parsingMethod: string | null; parsingUrl: string | null; emailConfig: string | null }) {
  try {
    console.log(`[parse-all] Обработка поставщика: ${supplier.name}`)
    
    let parser
    
    // Проверяем метод парсинга для email-поставщиков
    if (supplier.parsingMethod === 'email') {
      // For email type, we need to get the latest unprocessed attachment
      const { EmailParser } = await import('@/lib/email/email-parser')
      
      if (!supplier.emailConfig) {
        throw new Error('Email configuration not found')
      }

      const emailConfig = JSON.parse(supplier.emailConfig)
      const emailParser = new EmailParser(emailConfig)
      
      // Get unprocessed attachments
      const unprocessedFiles = await emailParser.getUnprocessedAttachments(supplier.id)
      
      if (unprocessedFiles.length === 0) {
        throw new Error('No unprocessed email attachments found')
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
      
      // Store file path for later use
      ;(parser as any).filePath = filePath
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
          throw new Error(`Unknown supplier: ${supplier.name}`)
      }
    }

    // Проверяем наличие правил парсинга
    const rules = await parser.loadRules()
    if (!rules) {
      console.log(`[parse-all] Правила не найдены для ${supplier.name}, проводим автоматический анализ...`)
      // Автоматически проводим анализ и создаем правила
      try {
        // For email type, analyze method is already overridden to use file path
        // For other types, use parsingUrl
        const analysis = supplier.parsingMethod === 'email'
          ? await (parser as any).analyze((parser as any).filePath)
          : await parser.analyze(supplier.parsingUrl!)
        const { createAutoRules } = await import('@/lib/parsers/auto-rules')
        const autoRules = createAutoRules(supplier.name, analysis)
        await parser.saveRules(autoRules)
        console.log(`[parse-all] Правила автоматически созданы для ${supplier.name}`)
      } catch (analysisError: any) {
        console.error(`[parse-all] Ошибка анализа для ${supplier.name}:`, analysisError)
        throw new Error(`Не удалось автоматически создать правила парсинга для ${supplier.name}: ${analysisError.message}`)
      }
    } else {
      console.log(`[parse-all] Правила найдены для ${supplier.name}`)
    }

    // For email type, use stored file path
    // For other types, use parsingUrl
    const fabrics = supplier.parsingMethod === 'email' 
      ? await (parser as any).parse((parser as any).filePath)
      : await parser.parse(supplier.parsingUrl!)
    
    console.log(`[parse-all] Парсер вернул ${fabrics.length} тканей для ${supplier.name}`)
    if (fabrics.length > 0) {
      console.log(`[parse-all] Примеры тканей:`, fabrics.slice(0, 3).map(f => `${f.collection} ${f.colorNumber} (${f.inStock ? 'в наличии' : 'не в наличии'})`))
    }

    // Сохраняем распарсенные данные в Excel файл
    try {
      const { saveParsedDataToExcel } = await import('@/lib/parsers/save-parsed-data')
      await saveParsedDataToExcel(supplier.id, supplier.name, fabrics)
      console.log(`[parse-all] Данные сохранены в Excel для ${supplier.name}`)
    } catch (saveError: any) {
      console.error(`[parse-all] Ошибка сохранения в Excel для ${supplier.name}:`, saveError)
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

    console.log(`[parse-all] Успешно обработан поставщик ${supplier.name}: ${fabrics.length} тканей, обновлено/создано: ${updatedCount}`)
    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      success: true,
      fabricsCount: fabrics.length,
      updatedCount,
    }
  } catch (error: any) {
    console.error(`[parse-all] Ошибка при обработке ${supplier.name}:`, error)
    // Обновляем статус поставщика при ошибке
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        status: 'error',
        errorMessage: error.message || 'Unknown error',
      },
    })
    throw error
  }
}

export async function POST() {
  try {
    const suppliers = await prisma.supplier.findMany()
    console.log(`[parse-all] Начинаем параллельный парсинг ${suppliers.length} поставщиков`)

    // Запускаем парсинг всех поставщиков параллельно
    const results = await Promise.allSettled(
      suppliers.map(supplier => parseSupplier(supplier))
    )

    const success = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    const detailedResults = results.map((r, index) => {
      if (r.status === 'fulfilled') {
        return {
          supplierId: suppliers[index].id,
          supplierName: suppliers[index].name,
          success: true,
          ...r.value,
        }
      } else {
        const reason = r.reason
        let errorMessage = 'Unknown error'
        if (reason instanceof Error) {
          errorMessage = reason.message
        } else if (typeof reason === 'string') {
          errorMessage = reason
        } else if (reason && typeof reason === 'object' && 'message' in reason) {
          errorMessage = String(reason.message)
        }
        
        return {
          supplierId: suppliers[index].id,
          supplierName: suppliers[index].name,
          success: false,
          error: errorMessage,
        }
      }
    })
    
    console.log(`[parse-all] Завершено: успешно ${success}, ошибок ${failed}`)

    return NextResponse.json({
      success: true,
      total: suppliers.length,
      successCount: success,
      failedCount: failed,
      results: detailedResults,
    })
  } catch (error: any) {
    console.error('Error parsing all suppliers:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to parse all suppliers' },
      { status: 500 }
    )
  }
}

