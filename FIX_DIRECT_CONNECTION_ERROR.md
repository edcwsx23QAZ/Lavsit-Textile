# 🔧 Исправление ошибки "Can't reach database server"

## Проблема

Ошибка: `Can't reach database server at db.hduadapicktrcrqjvzvd.supabase.co:5432`

Это означает, что в Vercel Environment Variables установлен **прямой connection string** (порт 5432) вместо **Connection Pooler** (порт 6543).

## Почему это происходит

- **Прямое подключение** (порт 5432) не работает на Vercel из-за ограничений на количество соединений
- **Connection Pooler** (порт 6543) необходим для serverless окружений типа Vercel

## Решение

### Шаг 1: Получите правильный connection string

1. Откройте https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Перейдите в **Settings** → **Database**
4. Найдите раздел **Connection string**
5. Выберите вкладку **Connection pooling** (НЕ "URI"!)
6. Выберите режим: **Session mode** или **Transaction mode**
7. Скопируйте connection string полностью

### Шаг 2: Проверьте формат

Правильный connection string должен:
- ✅ Начинаться с `postgresql://`
- ✅ Содержать `pooler.supabase.com` (НЕ `db.supabase.co`)
- ✅ Использовать порт `6543` (НЕ `5432`)
- ✅ Содержать параметр `pgbouncer=true`

**Пример правильного формата:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Неправильный формат (прямое подключение):**
```
postgresql://postgres:[PASSWORD]@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```

### Шаг 3: Обновите DATABASE_URL в Vercel

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите `DATABASE_URL`
5. **Удалите старое значение** (если оно использует порт 5432)
6. Вставьте новый connection string из Supabase (Connection pooling)
7. Убедитесь, что:
   - Key: `DATABASE_URL`
   - Value: connection string из Connection pooling (порт 6543)
   - Environment: все (Production, Preview, Development)
8. Сохраните

### Шаг 4: Перезапустите деплой

1. В Vercel Dashboard → **Deployments**
2. Найдите последний деплой
3. Нажмите **Redeploy** (три точки → Redeploy)

## Проверка

После настройки проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"database.connected": true`
   - Должен показать `"databaseUrlPreview"` с `pooler.supabase.com:6543`

2. **Страницы**:
   - `/suppliers` - должна работать
   - `/fabrics` - должна работать

## Разница между прямым подключением и pooler

| Параметр | Прямое подключение | Connection Pooler |
|----------|-------------------|-------------------|
| Hostname | `db.hduadapicktrcrqjvzvd.supabase.co` | `aws-0-us-east-1.pooler.supabase.com` |
| Port | `5432` | `6543` |
| Username | `postgres` | `postgres.hduadapicktrcrqjvzvd` |
| Параметр | `schema=public` | `pgbouncer=true` |
| Работает на Vercel | ❌ Нет | ✅ Да |

## Важно

- **НЕ используйте** connection string из раздела "URI" в Supabase Dashboard
- **Используйте ТОЛЬКО** connection string из раздела "Connection pooling"
- **НЕ редактируйте** connection string вручную - используйте тот, который дает Supabase

## Полезные ссылки

- Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
- Vercel Dashboard: https://vercel.com/dashboard
- Health Check: https://lavsit-textile.vercel.app/api/health



