import ExcelJS from 'exceljs'
import * as fs from 'fs'
import * as path from 'path'
import { ParsedFabric } from './base-parser'

/**
 * Сохраняет распарсенные данные в Excel файл для поставщика
 * Сохраняется только последний файл (старый удаляется)
 */
export async function saveParsedDataToExcel(
  supplierId: string,
  supplierName: string,
  fabrics: ParsedFabric[]
): Promise<string> {
  // Создаем директорию для сохранения файлов
  const dataDir = path.join(process.cwd(), 'data', 'parsed')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  // Удаляем старый файл для этого поставщика
  const oldFiles = fs.readdirSync(dataDir).filter((file) =>
    file.startsWith(`${supplierId}_`)
  )
  oldFiles.forEach((file) => {
    fs.unlinkSync(path.join(dataDir, file))
  })

  // Создаем новый файл
  const fileName = `${supplierId}_${Date.now()}.xlsx`
  const filePath = path.join(dataDir, fileName)

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Данные')

  // Заголовки
  worksheet.columns = [
    { header: 'Коллекция', key: 'collection', width: 20 },
    { header: 'Номер цвета', key: 'colorNumber', width: 15 },
    { header: 'Наличие', key: 'inStock', width: 10 },
    { header: 'Метраж', key: 'meterage', width: 12 },
    { header: 'Цена', key: 'price', width: 12 },
    { header: 'Дата поступления', key: 'nextArrivalDate', width: 18 },
    { header: 'Комментарий', key: 'comment', width: 30 },
  ]

  // Стили для заголовков
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  }

  // Данные
  fabrics.forEach((fabric) => {
    worksheet.addRow({
      collection: fabric.collection,
      colorNumber: fabric.colorNumber,
      inStock: fabric.inStock === null ? '-' : fabric.inStock ? 'Да' : 'Нет',
      meterage: fabric.meterage ? `${fabric.meterage} м` : '-',
      price: fabric.price ? `${fabric.price} ₽` : '-',
      nextArrivalDate: fabric.nextArrivalDate
        ? fabric.nextArrivalDate.toLocaleDateString('ru-RU')
        : '-',
      comment: fabric.comment || '-',
    })
  })

  await workbook.xlsx.writeFile(filePath)

  return filePath
}

/**
 * Получает путь к последнему сохраненному файлу для поставщика
 */
export function getLastParsedDataFile(supplierId: string): string | null {
  const dataDir = path.join(process.cwd(), 'data', 'parsed')
  if (!fs.existsSync(dataDir)) {
    return null
  }

  const files = fs
    .readdirSync(dataDir)
    .filter((file) => file.startsWith(`${supplierId}_`) && file.endsWith('.xlsx'))
    .map((file) => ({
      name: file,
      path: path.join(dataDir, file),
      time: fs.statSync(path.join(dataDir, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)

  return files.length > 0 ? files[0].path : null
}




