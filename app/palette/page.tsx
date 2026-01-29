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
    
    // Проверяем различные коды ошибок Prisma
    const errorCode = error?.code || error?.meta?.code
    const isDatabaseError = 
      errorCode === 'P1001' || // Can't reach database server
      errorCode === 'P1000' || // Authentication failed
      errorCode === 'P1003' || // Database does not exist
      errorCode === 'P1011' || // TLS connection error
      errorCode === 'P1017' || // Server has closed the connection
      error?.message?.includes('Can\'t reach database') ||
      error?.message?.includes('P1001') ||
      error?.message?.includes('P1000') ||
      error?.message?.includes('database') ||
      error?.message?.includes('Connection') ||
      error?.message?.includes('PrismaClient') ||
      error?.message?.includes('Invalid `prisma') ||
      error?.message?.includes('Unknown database')
    
    // Всегда показываем fallback UI вместо проброса ошибки
    return (
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Палитра цветов</h1>
        </div>
        <div className={`border rounded-lg p-4 ${isDatabaseError ? 'border-yellow-300 bg-yellow-50' : 'border-red-300 bg-red-50'}`}>
          <h3 className={`text-lg font-semibold mb-2 ${isDatabaseError ? 'text-yellow-800' : 'text-red-800'}`}>
            {isDatabaseError ? 'База данных недоступна' : 'Ошибка загрузки данных'}
          </h3>
          <p className={`mb-4 ${isDatabaseError ? 'text-yellow-700' : 'text-red-700'}`}>
            {isDatabaseError 
              ? 'Не удалось подключиться к базе данных. Пожалуйста, проверьте настройки подключения.'
              : 'Произошла ошибка при загрузке данных. Пожалуйста, попробуйте обновить страницу.'}
          </p>
          {(process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'development') && (
            <p className={`text-sm ${isDatabaseError ? 'text-yellow-600' : 'text-red-600'}`}>
              {error?.message || 'Неизвестная ошибка'}
              {errorCode && ` (Код: ${errorCode})`}
            </p>
          )}
        </div>
      </div>
    )
  }
}
