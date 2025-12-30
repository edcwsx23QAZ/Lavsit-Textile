import { prisma } from '@/lib/db/prisma'
import { PalettePageClient } from './PalettePageClient'

export default async function PalettePage() {
  // Загружаем ткани с цветами напрямую в Server Component
  const fabrics = await prisma.fabric.findMany({
    where: { excludedFromParsing: false },
    select: {
      id: true,
      collection: true,
      colorNumber: true,
      colorHex: true,
      imageUrl: true,
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

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Палитра цветов</h1>
        <p className="text-muted-foreground">
          Всего тканей с цветами: {fabrics.filter(f => f.colorHex).length.toLocaleString('ru')}
        </p>
      </div>

      <PalettePageClient initialFabrics={fabrics} />
    </div>
  )
}
