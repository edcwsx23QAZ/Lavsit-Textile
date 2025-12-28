import { prisma } from '@/lib/prisma'

export interface StructureWarning {
  supplierId: string
  supplierName: string
  message: string
  oldStructure: any
  newStructure: any
}

export async function checkStructureChanges(
  supplierId: string,
  newStructure: any
): Promise<StructureWarning | null> {
  const existing = await prisma.dataStructure.findUnique({
    where: { supplierId },
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
    },
  })

  if (!existing) {
    return null
  }

  const oldStructure = JSON.parse(existing.structure)
  const oldStr = JSON.stringify(oldStructure)
  const newStr = JSON.stringify(newStructure)

  if (oldStr !== newStr) {
    return {
      supplierId,
      supplierName: existing.supplier.name,
      message: `Структура данных для поставщика "${existing.supplier.name}" изменилась`,
      oldStructure,
      newStructure,
    }
  }

  return null
}



