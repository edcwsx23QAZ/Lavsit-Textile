# 🔧 Настройка DATABASE_URL для Vercel

## Проблема

Ошибка: `Invalid prisma.$queryRaw() invocation: error: Error validating datasource db: the URL must start with the protocol postgresql:// or postgres://`

Это означает, что `DATABASE_URL` либо не настроен, либо имеет неправильный формат.

## Решение

### Шаг 1: Получите PostgreSQL Connection String

Если используете Supabase:

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект
3. Перейдите в **Settings** → **Database**
4. Найдите **Connection String** → **Connection Pooling**
5. Скопируйте connection string (должен начинаться с `postgresql://`)

**Пример правильного формата:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Важно:**
- ✅ Должен начинаться с `postgresql://` или `postgres://`
- ✅ Пароль должен быть URL-encoded (`%21` вместо `!`, `%40` вместо `@`)
- ✅ Должен использовать Connection Pooler (`pgbouncer=true`) для Vercel
- ✅ Порт должен быть `6543` (pooler) или `5432` (direct)

### Шаг 2: Настройте DATABASE_URL в Vercel

1. Откройте Vercel Dashboard: https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Нажмите **Add New**
5. Заполните:
   - **Key**: `DATABASE_URL`
   - **Value**: вставьте connection string из шага 1
   - **Environment**: выберите все (Production, Preview, Development)
6. Нажмите **Save**

### Шаг 3: Проверьте формат

После добавления переменной проверьте:

1. В Vercel Dashboard → **Settings** → **Environment Variables**
2. Найдите `DATABASE_URL`
3. Убедитесь, что значение начинается с `postgresql://` или `postgres://`
4. Убедитесь, что нет лишних пробелов или символов

### Шаг 4: Перезапустите деплой

После настройки `DATABASE_URL`:

1. В Vercel Dashboard → **Deployments**
2. Найдите последний деплой
3. Нажмите **Redeploy** (три точки → Redeploy)

Или просто сделайте новый коммит - Vercel автоматически задеплоит.

### Шаг 5: Проверьте работу

После деплоя проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"hasDatabaseUrl": true`
   - Должен показать `"databaseUrlType": "postgresql"`
   - Должен показать `"databaseUrlValid": true`

2. **Страницы**:
   - `/suppliers` - должна работать
   - `/fabrics` - должна работать

## Частые ошибки

### ❌ DATABASE_URL не начинается с postgresql://
**Причина:** Неправильный формат connection string

**Решение:** Используйте Connection Pooler connection string из Supabase

### ❌ Пароль не URL-encoded
**Причина:** Специальные символы в пароле (`!`, `@`, `#` и т.д.)

**Решение:** URL-encode пароль:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- и т.д.

### ❌ Используется прямой порт вместо pooler
**Причина:** Использование порта `5432` вместо `6543`

**Решение:** Используйте Connection Pooler с портом `6543` и параметром `pgbouncer=true`

## Проверка через Health Endpoint

Откройте: `https://lavsit-textile.vercel.app/api/health`

**Если все правильно:**
```json
{
  "environment": {
    "hasDatabaseUrl": true,
    "databaseUrlType": "postgresql",
    "databaseUrlValid": true,
    "databaseUrlPreview": "postgresql://aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  },
  "database": {
    "connected": true
  }
}
```

**Если DATABASE_URL не настроен:**
```json
{
  "environment": {
    "hasDatabaseUrl": false,
    "databaseUrlType": "not_set"
  }
}
```

**Если DATABASE_URL неправильного формата:**
```json
{
  "environment": {
    "hasDatabaseUrl": true,
    "databaseUrlType": "invalid",
    "databaseUrlValid": false
  }
}
```

## Дополнительно: Применение миграций

После настройки `DATABASE_URL` убедитесь, что миграции применены:

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Выполните SQL из файла: `prisma/migrations/init_postgresql/migration-fixed.sql`

## Полезные ссылки

- Vercel Dashboard: https://vercel.com/dashboard
- Supabase Dashboard: https://supabase.com/dashboard
- Health Check: https://lavsit-textile.vercel.app/api/health



