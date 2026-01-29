# 🔍 Диагностика и исправление ошибки "Tenant or user not found"

## Проблема

Ошибка: `FATAL: Tenant or user not found` при подключении к Supabase через Connection Pooler на Vercel.

## Возможные причины

1. **Неправильный формат username для pooler**
   - Текущий: `postgres.hduadapicktrcrqjvzvd`
   - Может быть нужен: `postgres` (простой формат)

2. **Проблема с URL-encoding пароля**
   - Пароль `edcwsx123QAZ!` может декодироваться дважды или не декодироваться

3. **Неправильный Project ID**
   - Проверьте в Supabase Dashboard

4. **Connection Pooler не настроен правильно**
   - Может быть нужно использовать прямое подключение для проверки

## Решение: Попробуйте эти варианты

### Вариант 1: Pooler с простым username (РЕКОМЕНДУЕТСЯ)

```
postgresql://postgres:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Отличие:** `postgres` вместо `postgres.hduadapicktrcrqjvzvd`

### Вариант 2: Pooler с project ID в username (текущий)

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Вариант 3: Без URL-encoding пароля

```
postgresql://postgres:edcwsx123QAZ!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Вариант 4: Прямое подключение (для диагностики)

```
postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public&sslmode=require
```

**Важно:** Прямое подключение не рекомендуется для production на Vercel, но можно использовать для проверки правильности пароля.

## Как получить правильный connection string из Supabase

1. Откройте https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Перейдите в **Settings** → **Database**
4. Найдите **Connection String**
5. Выберите **Connection Pooling** → **Session mode** или **Transaction mode**
6. Скопируйте connection string **ТОЧНО** как показано в Supabase

**НЕ редактируйте connection string вручную!** Используйте тот, который дает Supabase.

## Пошаговая инструкция

1. **Получите connection string из Supabase Dashboard**
   - Не используйте примеры из документации
   - Используйте ТОЧНЫЙ connection string из вашего проекта

2. **Вставьте в Vercel Environment Variables**
   - Key: `DATABASE_URL`
   - Value: connection string из Supabase (скопируйте полностью)
   - Environment: все (Production, Preview, Development)

3. **Перезапустите деплой**
   - Deployments → последний деплой → Redeploy

4. **Проверьте**
   - Health endpoint: `https://lavsit-textile.vercel.app/api/health`
   - Страницы: `/suppliers`, `/fabrics`

## Если ничего не помогает

1. Проверьте, что база данных не в режиме паузы в Supabase
2. Проверьте правильность пароля в Supabase Dashboard → Settings → Database → Database password
3. Попробуйте сбросить пароль базы данных в Supabase и создать новый connection string
4. Убедитесь, что Connection Pooler включен в Supabase



