'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isDatabaseError = 
    error.message?.includes('database') ||
    error.message?.includes('Connection') ||
    error.message?.includes('P1001') ||
    error.message?.includes('P1000') ||
    error.message?.includes('Tenant or user not found') ||
    error.digest

  return (
    <html>
      <body>
        <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
            Что-то пошло не так!
          </h2>
          
          {isDatabaseError && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#fef3c7', 
              border: '1px solid #fbbf24',
              borderRadius: '8px',
              marginBottom: '1rem'
            }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                База данных недоступна
              </h3>
              <p style={{ marginBottom: '0.5rem' }}>
                Не удалось подключиться к базе данных. Проверьте настройки DATABASE_URL в Vercel.
              </p>
              <p style={{ fontSize: '0.875rem', color: '#92400e' }}>
                Убедитесь, что используется Connection Pooler (порт 6543) с параметром pgbouncer=true
              </p>
            </div>
          )}

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <p style={{ marginBottom: '0.5rem', fontWeight: 'bold' }}>Детали ошибки:</p>
            <pre style={{ 
              fontSize: '0.75rem', 
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {error.message || 'Неизвестная ошибка'}
              {error.digest && `\n\nDigest: ${error.digest}`}
              {error.stack && `\n\nStack:\n${error.stack}`}
            </pre>
          </div>

          <button
            onClick={reset}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#000',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '0.5rem'
            }}
          >
            Попробовать снова
          </button>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#6b7280',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Вернуться на главную
          </button>
        </div>
      </body>
    </html>
  )
}





