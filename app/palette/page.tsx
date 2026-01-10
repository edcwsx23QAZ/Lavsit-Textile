import { prisma } from '@/lib/db/prisma'
import { PalettePageClient } from './PalettePageClient'

// Отключаем static generation - страница динамическая
export const dynamic = 'force-dynamic'

export default async function PalettePage() {
  try {
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
  } catch (error: any) {
    console.error('[PalettePage] Error:', error)
    
    // Если база данных недоступна, показываем сообщение
    if (error.code === 'P1001' || error.message?.includes('Can\'t reach database')) {
      return (
        <div className="container mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Палитра цветов</h1>
          </div>
          <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">
              База данных недоступна
            </h3>
            <p className="text-yellow-700 mb-4">
              Не удалось подключиться к базе данных. Пожалуйста, проверьте настройки подключения.
            </p>
            <p className="text-sm text-yellow-600">
              {process.env.NODE_ENV === 'development' && error.message}
            </p>
          </div>
        </div>
      )
    }
    
    // Для других ошибок пробрасываем дальше
    throw error
  }
}
