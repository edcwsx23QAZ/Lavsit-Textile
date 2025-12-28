import ExcelJS from 'exceljs'
import { prisma } from '@/lib/prisma'
import { formatDate } from './utils'

/**
 * Экспортирует все ткани в Excel файл
 */
export async function exportAllFabricsToExcel(): Promise<Buffer> {
  const fabrics = await prisma.fabric.findMany({
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: [
      { supplier: { name: 'asc' } },
      { collection: 'asc' },
      { colorNumber: 'asc' },
    ],
  })

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Все ткани')

  // Заголовки
  worksheet.columns = [
    { header: 'Поставщик', key: 'supplier', width: 15 },
    { header: 'Коллекция', key: 'collection', width: 20 },
    { header: 'Номер цвета', key: 'colorNumber', width: 15 },
    { header: 'Наличие', key: 'inStock', width: 10 },
    { header: 'Метраж', key: 'meterage', width: 12 },
    { header: 'Цена', key: 'price', width: 12 },
    { header: 'Дата обновления', key: 'lastUpdatedAt', width: 18 },
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
      supplier: fabric.supplier.name,
      collection: fabric.collection,
      colorNumber: fabric.colorNumber,
      inStock: fabric.inStock === null ? '-' : fabric.inStock ? 'Да' : 'Нет',
      meterage: fabric.meterage ? `${fabric.meterage} м` : '-',
      price: fabric.price ? `${fabric.price} ₽` : '-',
      lastUpdatedAt: formatDate(fabric.lastUpdatedAt),
      nextArrivalDate: fabric.nextArrivalDate ? formatDate(fabric.nextArrivalDate) : '-',
      comment: fabric.comment || '-',
    })
  })

  // Автоматическая ширина колонок
  worksheet.columns.forEach((column) => {
    if (column.header) {
      column.width = Math.max(column.width || 10, column.header.length + 2)
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

/**
 * Экспортирует ткани конкретного поставщика в Excel файл
 */
export async function exportSupplierFabricsToExcel(supplierId: string): Promise<Buffer> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: {
      fabrics: {
        orderBy: [
          { collection: 'asc' },
          { colorNumber: 'asc' },
        ],
      },
    },
  })

  if (!supplier) {
    throw new Error('Поставщик не найден')
  }

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(supplier.name)

  // Заголовки
  worksheet.columns = [
    { header: 'Коллекция', key: 'collection', width: 20 },
    { header: 'Номер цвета', key: 'colorNumber', width: 15 },
    { header: 'Наличие', key: 'inStock', width: 10 },
    { header: 'Метраж', key: 'meterage', width: 12 },
    { header: 'Цена', key: 'price', width: 12 },
    { header: 'Дата обновления', key: 'lastUpdatedAt', width: 18 },
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
  supplier.fabrics.forEach((fabric) => {
    worksheet.addRow({
      collection: fabric.collection,
      colorNumber: fabric.colorNumber,
      inStock: fabric.inStock === null ? '-' : fabric.inStock ? 'Да' : 'Нет',
      meterage: fabric.meterage ? `${fabric.meterage} м` : '-',
      price: fabric.price ? `${fabric.price} ₽` : '-',
      lastUpdatedAt: formatDate(fabric.lastUpdatedAt),
      nextArrivalDate: fabric.nextArrivalDate ? formatDate(fabric.nextArrivalDate) : '-',
      comment: fabric.comment || '-',
    })
  })

  // Автоматическая ширина колонок
  worksheet.columns.forEach((column) => {
    if (column.header) {
      column.width = Math.max(column.width || 10, column.header.length + 2)
    }
  })

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}



