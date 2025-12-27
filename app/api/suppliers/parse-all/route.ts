import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ArtvisionParser } from '@/lib/parsers/artvision-parser'
import { SouzmParser } from '@/lib/parsers/souzm-parser'
import { DomiartParser } from '@/lib/parsers/domiart-parser'

export async function POST() {
  try {
    const suppliers = await prisma.supplier.findMany()
    console.log(`[parse-all] Начинаем парсинг ${suppliers.length} поставщиков`)

    const results = await Promise.allSettled(
      suppliers.map(async (supplier) => {
        try {
          console.log(`[parse-all] Обработка поставщика: ${supplier.name}`)
          
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
            default:
              throw new Error(`Unknown supplier: ${supplier.name}`)
          }

          // Проверяем наличие правил парсинга
          const rules = await parser.loadRules()
          if (!rules) {
            console.log(`[parse-all] Правила не найдены для ${supplier.name}, проводим автоматический анализ...`)
            // Автоматически проводим анализ и создаем правила
            try {
              const analysis = await parser.analyze(supplier.parsingUrl)
              const { createAutoRules } = await import('@/lib/parsers/auto-rules')
              const autoRules = createAutoRules(supplier.name, analysis)
              await parser.saveRules(autoRules)
              console.log(`[parse-all] Правила автоматически созданы для ${supplier.name}`)
            } catch (analysisError: any) {
              console.error(`[parse-all] Ошибка анализа для ${supplier.name}:`, analysisError)
              throw new Error(`Не удалось создать правила для ${supplier.name}: ${analysisError.message}`)
            }
          } else {
            console.log(`[parse-all] Правила найдены для ${supplier.name}`)
          }

          console.log(`[parse-all] Парсинг данных для ${supplier.name}...`)
          const fabrics = await parser.parse(supplier.parsingUrl)
          console.log(`[parse-all] Получено ${fabrics.length} тканей от ${supplier.name}`)

          // Сохраняем распарсенные данные в Excel файл
          try {
            const { saveParsedDataToExcel } = await import('@/lib/parsers/save-parsed-data')
            await saveParsedDataToExcel(supplier.id, supplier.name, fabrics)
            console.log(`[parse-all] Данные сохранены в Excel для ${supplier.name}`)
          } catch (saveError: any) {
            console.error(`[parse-all] Ошибка сохранения в Excel для ${supplier.name}:`, saveError)
            // Не прерываем выполнение, если не удалось сохранить в Excel
          }

          await prisma.$transaction([
            prisma.fabric.deleteMany({
              where: { supplierId: supplier.id },
            }),
            ...fabrics.map(fabric =>
              prisma.fabric.create({
                data: {
                  ...fabric,
                  supplierId: supplier.id,
                  lastUpdatedAt: new Date(),
                },
              })
            ),
          ])

          await prisma.supplier.update({
            where: { id: supplier.id },
            data: {
              fabricsCount: fabrics.length,
              lastUpdatedAt: new Date(),
              status: 'active',
              errorMessage: null,
            },
          })

          console.log(`[parse-all] Успешно обработан поставщик ${supplier.name}: ${fabrics.length} тканей`)
          return {
            supplierId: supplier.id,
            supplierName: supplier.name,
            success: true,
            fabricsCount: fabrics.length,
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
      })
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

