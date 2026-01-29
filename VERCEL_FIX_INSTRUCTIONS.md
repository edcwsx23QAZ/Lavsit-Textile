# 🔧 Инструкция по исправлению проблем на Vercel

## Проблема
Страницы не работают на Vercel, хотя локально все работает.

## Причины и решения

### 1. ✅ Схема Prisma обновлена
- Добавлено поле `lastParsedCount` в модель Supplier для совместимости с PostgreSQL
- Скрипт автоматического переключения на PostgreSQL улучшен

### 2. ⚠️ Проверьте DATABASE_URL в Vercel

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Убедитесь, что переменная `DATABASE_URL` настроена:

```
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Важно**: Пароль должен быть URL-encoded (`%21` вместо `!`)

### 3. ⚠️ Примените миграции в Supabase

Миграции должны быть применены в Supabase. Выполните SQL из файла:
`prisma/migrations/init_postgresql/migration-fixed.sql`

**Как применить:**
1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Скопируйте содержимое `prisma/migrations/init_postgresql/migration-fixed.sql`
4. Выполните SQL запрос

### 4. 🔄 Перезапустите деплой на Vercel

После применения миграций:
1. В Vercel Dashboard откройте проект
2. Перейдите в **Deployments**
3. Найдите последний деплой
4. Нажмите **Redeploy** (три точки → Redeploy)

Или просто сделайте новый коммит и пуш в GitHub - Vercel автоматически задеплоит.

### 5. 📋 Проверьте логи Vercel

Если проблемы остаются:
1. В Vercel Dashboard откройте проект
2. Перейдите в **Deployments** → выберите последний деплой
3. Откройте **Logs**
4. Проверьте ошибки сборки или runtime ошибки

## Что было исправлено

1. ✅ Добавлено поле `lastParsedCount` в схему SQLite для совместимости
2. ✅ Улучшен скрипт `prepare-vercel-schema.js` для правильного переключения на PostgreSQL
3. ✅ Схема теперь совместима между SQLite и PostgreSQL

## Проверка работы

После применения всех исправлений проверьте:
- ✅ `/suppliers` - страница поставщиков должна работать
- ✅ `/fabrics` - страница тканей должна работать
- ✅ `/categories` - страница категорий должна работать
- ✅ `/palette` - страница палитры должна работать

## Если проблемы остаются

1. Проверьте логи Vercel на наличие ошибок
2. Убедитесь, что `DATABASE_URL` правильно настроен (с URL-encoded паролем)
3. Проверьте, что миграции применены в Supabase
4. Убедитесь, что база данных Supabase не находится в режиме паузы



