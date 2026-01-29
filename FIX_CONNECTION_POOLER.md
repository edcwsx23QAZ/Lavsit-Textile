# 🔴 СРОЧНО: Исправление - используется прямое подключение вместо Connection Pooler

## Проблема

На Vercel используется **прямое подключение** (порт 5432) вместо **Connection Pooler** (порт 6543).

**Текущий (неправильный) формат:**
```
postgresql://postgres:[PASSWORD]@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres
```

**Правильный формат для Vercel:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## ✅ Решение (2 минуты)

### Шаг 1: Получите Connection Pooler URL из Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
2. Перейдите в **Settings → Database**
3. Найдите раздел **Connection string**
4. **ВАЖНО:** Выберите **"Connection pooling"** (НЕ "URI" или "Direct connection"!)
5. Выберите режим: **"Session mode"** или **"Transaction mode"** (оба работают)
6. Скопируйте connection string
7. Он должен содержать:
   - `pooler.supabase.com` (не `db.supabase.co`)
   - Порт `6543` (не `5432`)
   - Параметр `pgbouncer=true`

### Шаг 2: Обновите DATABASE_URL на Vercel

1. Откройте: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables
2. Найдите `DATABASE_URL`
3. Нажмите **Edit** (или три точки → Edit)
4. **Удалите** старый connection string
5. **Вставьте** новый connection string из Supabase (Connection Pooler)
6. Убедитесь, что выбраны все окружения:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
7. Нажмите **Save**

### Шаг 3: Пересоберите проект

1. Перейдите в **Deployments**: https://vercel.com/narfius-projects/lavsit-textile/deployments
2. Нажмите **Redeploy** на последнем deployment
3. Или создайте новый deployment: **Deploy** → выберите последний коммит
4. Дождитесь завершения сборки (2-3 минуты)

### Шаг 4: Проверьте результат

1. Откройте health endpoint: https://lavsit-textile.vercel.app/api/health
2. Проверьте:
   - `databaseUrlDetails.isPooler: true` ✅
   - `databaseUrlDetails.port: "6543"` ✅
   - `databaseUrlDetails.isValidForVercel: true` ✅
   - `database.connected: true` ✅

3. Проверьте страницы - они должны работать!

## 📋 Правильный формат Connection Pooler

```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Ключевые отличия от прямого подключения:**

| Параметр | Прямое подключение ❌ | Connection Pooler ✅ |
|----------|----------------------|---------------------|
| Hostname | `db.hduadapicktrcrqjvzvd.supabase.co` | `aws-0-us-east-1.pooler.supabase.com` |
| Port | `5432` | `6543` |
| Username | `postgres` | `postgres.hduadapicktrcrqjvzvd` |
| pgbouncer | отсутствует | `pgbouncer=true` |

## ⚠️ Почему прямое подключение не работает на Vercel?

1. **Ограничения соединений:** Supabase ограничивает количество прямых подключений
2. **Serverless окружение:** Vercel использует serverless функции, которым нужен Connection Pooler
3. **Таймауты:** Прямые подключения могут таймаутить в serverless окружении

## ✅ После исправления

Проверьте:
- ✅ Health endpoint показывает `isValidForVercel: true`
- ✅ `database.connected: true`
- ✅ Страницы работают без ошибок
- ✅ Нет сообщения "База данных недоступна"

## 🔍 Проверка через скрипт

После исправления запустите:
```bash
npm run vercel:status
```

Должно показать:
- ✅ Формат для Vercel: Правильный
- ✅ Подключение к базе данных: Успешно

