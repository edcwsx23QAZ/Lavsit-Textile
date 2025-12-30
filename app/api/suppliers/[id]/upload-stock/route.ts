import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import * as XLSX from 'xlsx'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supplierId = params.id

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Файл не предоставлен' }, { status: 400 })
    }

    // Проверяем расширение файла
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'Поддерживаются только Excel файлы (.xlsx, .xls)' }, { status: 400 })
    }

    // Читаем файл
    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Берем первый лист
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

    if (data.length === 0) {
      return NextResponse.json({ error: 'Файл пустой' }, { status: 400 })
    }

    // Ищем заголовки (коллекция, цвет, метраж)
    let collectionCol = -1
    let colorCol = -1
    let meterageCol = -1
    let headerRow = 0

    // Ищем строку с заголовками
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i].map((cell: any) => String(cell).toLowerCase().trim())
      const collectionIdx = row.findIndex((cell: string) => 
        cell.includes('коллекция') || cell.includes('collection')
      )
      const colorIdx = row.findIndex((cell: string) => 
        cell.includes('цвет') || cell.includes('номер') || cell.includes('color')
      )
      const meterageIdx = row.findIndex((cell: string) => 
        cell.includes('метр') || cell.includes('остаток') || cell.includes('метраж') || cell.includes('meterage') || cell.includes('stock')
      )

      if (collectionIdx !== -1 && colorIdx !== -1) {
        collectionCol = collectionIdx
        colorCol = colorIdx
        meterageCol = meterageIdx !== -1 ? meterageIdx : -1
        headerRow = i
        break
      }
    }

    if (collectionCol === -1 || colorCol === -1) {
      return NextResponse.json({ error: 'Не найдены столбцы "Коллекция" и "Цвет" в файле' }, { status: 400 })
    }

    // Обрабатываем данные
    let updated = 0
    let notFound = 0

    for (let i = headerRow + 1; i < data.length; i++) {
      const row = data[i]
      const collection = String(row[collectionCol] || '').trim()
      const colorNumber = String(row[colorCol] || '').trim()

      if (!collection || !colorNumber) continue

      // Ищем ткань в базе
      const fabric = await prisma.fabric.findFirst({
        where: {
          supplierId,
          collection: collection,
          colorNumber: colorNumber,
        },
      })

      if (!fabric) {
        notFound++
        continue
      }

      // Обновляем метраж и наличие
      let meterage: number | null = null
      if (meterageCol !== -1) {
        const meterageValue = row[meterageCol]
        if (meterageValue !== undefined && meterageValue !== null && meterageValue !== '') {
          const parsed = parseFloat(String(meterageValue).replace(/[^\d.,]/g, '').replace(',', '.'))
          if (!isNaN(parsed) && parsed > 0) {
            meterage = parsed
          }
        }
      }

      await prisma.fabric.update({
        where: { id: fabric.id },
        data: {
          meterage,
          inStock: meterage !== null && meterage > 0,
          lastUpdatedAt: new Date(),
        },
      })

      updated++
    }

    return NextResponse.json({
      success: true,
      updated,
      notFound,
      message: `Обновлено: ${updated}, не найдено: ${notFound}`,
    })
  } catch (error: any) {
    console.error('Error uploading stock:', error)
    return NextResponse.json(
      { error: error.message || 'Ошибка загрузки наличия' },
      { status: 500 }
    )
  }
}

