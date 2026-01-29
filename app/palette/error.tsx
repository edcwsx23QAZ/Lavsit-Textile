'use client'

export default function PaletteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const showErrorDetails = true
  
  const errorCode = 'code' in error ? (error as any).code : undefined
  const isDatabaseError = 
    errorCode === 'P1001' ||
    errorCode === 'P1000' ||
    errorCode === 'P1017' ||
    errorCode === 'P1003' ||
    errorCode === 'P1011' ||
    error.message?.includes('Can\'t reach database') ||
    error.message?.includes('P1001') ||
    error.message?.includes('P1000') ||
    error.message?.includes('database') ||
    error.message?.includes('Connection') ||
    error.message?.includes('PrismaClient') ||
    error.message?.includes('Invalid `prisma') ||
    error.message?.includes('Server Components render') ||
    error.digest

  return (
    <div className="container mx-auto p-6">
      <div className="border border-red-300 bg-red-50 rounded-lg p-6 max-w-2xl">
        <h2 className="text-2xl font-bold mb-4 text-red-800">Ошибка загрузки страницы "Палитра"</h2>
        
        {isDatabaseError && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-300 rounded">
            <h3 className="font-semibold text-yellow-800 mb-2">База данных недоступна</h3>
            <p className="text-yellow-700 text-sm mb-2">
              Не удалось подключиться к базе данных. Возможные причины:
            </p>
            <ul className="list-disc list-inside text-yellow-700 text-sm space-y-1">
              <li>База данных Supabase находится в режиме паузы</li>
              <li>Неправильный DATABASE_URL в переменных окружения</li>
              <li>Миграции не применены к базе данных</li>
              <li>Проблемы с сетью или firewall</li>
            </ul>
          </div>
        )}

        {showErrorDetails && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-red-700 mb-2">Детали ошибки:</p>
            <pre className="text-xs bg-red-100 p-3 rounded overflow-auto text-red-900 max-h-96">
              {error.message || 'Неизвестная ошибка'}
              {error.digest && `\n\nDigest: ${error.digest}`}
              {errorCode && `\nCode: ${errorCode}`}
              {error.stack && `\n\nStack:\n${error.stack}`}
            </pre>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Попробовать снова
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Вернуться на главную
          </button>
        </div>
      </div>
    </div>
  )
}

