# 🔧 Исправление ошибки "Tenant or user not found"

## Проблема

Ошибка: `FATAL: Tenant or user not found`

Эта ошибка означает, что **DATABASE_URL содержит неправильный connection string** для Supabase.

## Причины

1. **Неправильный пароль** - не URL-encoded
2. **Неправильный Project ID**
3. **Неправильный формат connection string**

## Решение

### Правильный формат для Supabase Connection Pooler:

```
postgresql://postgres.[PROJECT_ID]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Для вашего проекта:

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Важно:**
- ✅ Project ID: `hduadapicktrcrqjvzvd`
- ✅ Пароль: `edcwsx123QAZ%21` (URL-encoded: `!` → `%21`)
- ✅ Регион: `aws-0-us-east-1`
- ✅ Порт: `6543` (Connection Pooler)
- ✅ Параметр: `pgbouncer=true`

## Как получить правильный Connection String

### Вариант 1: Из Supabase Dashboard

1. Откройте https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Перейдите в **Settings** → **Database**
4. Найдите **Connection String** → **Connection Pooling**
5. Выберите **Session mode** или **Transaction mode**
6. Скопируйте connection string

**Важно:** Пароль в connection string должен быть URL-encoded автоматически, но если нет - закодируйте вручную:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- и т.д.

### Вариант 2: Собрать вручную

Если знаете пароль и project ID:

1. URL-encode пароль:
   - Пароль: `edcwsx123QAZ!`
   - URL-encoded: `edcwsx123QAZ%21`

2. Соберите connection string:
   ```
   postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
   ```

## Настройка в Vercel

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите `DATABASE_URL` или создайте новый
5. **Удалите старый** и добавьте правильный connection string
6. Убедитесь, что:
   - Key: `DATABASE_URL` (точно так, без пробелов)
   - Value: правильный connection string (начинается с `postgresql://`)
   - Environment: все (Production, Preview, Development)
7. Сохраните
8. **Перезапустите деплой**: Deployments → последний деплой → Redeploy

## Проверка

После настройки проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"connected": true`

2. **Страницы**:
   - `/suppliers` - должна работать
   - `/fabrics` - должна работать

## Частые ошибки

### ❌ Неправильный пароль
**Проблема:** Пароль не URL-encoded
**Решение:** Закодируйте специальные символы (`!` → `%21`)

### ❌ Неправильный Project ID
**Проблема:** Project ID неверный
**Решение:** Проверьте Project ID в Supabase Dashboard

### ❌ Используется прямой порт вместо pooler
**Проблема:** Порт `5432` вместо `6543`
**Решение:** Используйте Connection Pooler с портом `6543`

### ❌ Отсутствует параметр pgbouncer
**Проблема:** Нет `pgbouncer=true`
**Решение:** Добавьте `?pgbouncer=true` в connection string

## Полезные ссылки

- Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
- Vercel Dashboard: https://vercel.com/dashboard
- Health Check: https://lavsit-textile.vercel.app/api/health



