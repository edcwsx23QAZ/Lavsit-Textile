# ✅ Финальный чеклист настройки проекта

## 🔍 Проверка перед использованием

### 1. DATABASE_URL в Vercel

- [ ] Откройте https://vercel.com/dashboard
- [ ] Проект `lavsit-textile` → Settings → Environment Variables
- [ ] Проверьте `DATABASE_URL`:
  - [ ] Hostname содержит `pooler.supabase.com` (НЕ `db.supabase.co`)
  - [ ] Port = `6543` (НЕ `5432`)
  - [ ] Username = `postgres.hduadapicktrcrqjvzvd` (НЕ просто `postgres`)
  - [ ] Параметр `pgbouncer=true` присутствует
  - [ ] Параметр `schema=public` присутствует

### 2. Health Endpoint

- [ ] Откройте `https://lavsit-textile.vercel.app/api/health`
- [ ] Проверьте:
  - [ ] `database.connected: true`
  - [ ] `databaseUrlDetails.isValidForVercel: true`
  - [ ] `databaseUrlDetails.isPooler: true`
  - [ ] `databaseUrlDetails.isDirect: false`
  - [ ] `database.migrations.migrationsApplied: true` (если миграции применены)

### 3. Миграции в Supabase

- [ ] Откройте https://supabase.com/dashboard
- [ ] Проект `hduadapicktrcrqjvzvd` → SQL Editor
- [ ] Выполните SQL из `prisma/migrations/init_postgresql/migration-fixed.sql`
- [ ] Проверьте, что таблицы созданы

### 4. Проверка страниц

- [ ] `/suppliers` - загружается без ошибок
- [ ] `/fabrics` - загружается без ошибок
- [ ] `/categories` - загружается без ошибок
- [ ] `/palette` - загружается без ошибок

## 📋 Правильный DATABASE_URL

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 🔧 Если что-то не работает

1. **Проверьте health endpoint** - покажет детальную диагностику
2. **Проверьте логи деплоя** - могут содержать полезную информацию
3. **Запустите скрипт диагностики**: `npx tsx scripts/verify-vercel-connection.ts`
4. **Проверьте документацию**: `VERCEL_DATABASE_URL_SETUP.md`

## 📊 Статус проекта

- ✅ Детальная диагностика DATABASE_URL
- ✅ Проверка миграций
- ✅ Улучшенная обработка ошибок на всех страницах
- ✅ Fallback через Supabase API
- ✅ Скрипт диагностики
- ✅ Полная документация

## 🎯 Ожидаемый результат

После правильной настройки:
- Health endpoint показывает `database.connected: true`
- Все страницы загружаются без ошибок
- База данных доступна для чтения и записи



