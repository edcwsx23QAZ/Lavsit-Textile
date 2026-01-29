# ✅ Чеклист для исправления проблем на Vercel

## 🔍 Диагностика

### 1. Проверьте health endpoint
Откройте: `https://lavsit-textile.vercel.app/api/health`

Этот endpoint покажет:
- ✅ Настроен ли DATABASE_URL
- ✅ Тип базы данных (PostgreSQL/SQLite)
- ✅ Статус подключения к базе данных
- ✅ Ошибки подключения

### 2. Проверьте логи Vercel
1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Deployments** → последний деплой
4. Откройте **Logs**
5. Проверьте ошибки сборки или runtime ошибки

## 🔧 Обязательные настройки

### 1. DATABASE_URL в Vercel Environment Variables

**КРИТИЧЕСКИ ВАЖНО!**

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Убедитесь, что `DATABASE_URL` настроен:

```
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Важно:**
- ✅ Пароль должен быть URL-encoded (`%21` вместо `!`)
- ✅ Должен использовать Connection Pooler (`pgbouncer=true`)
- ✅ Должен быть настроен для всех окружений (Production, Preview, Development)

### 2. Миграции в Supabase

**КРИТИЧЕСКИ ВАЖНО!**

1. Откройте Supabase Dashboard
2. Перейдите в **SQL Editor**
3. Выполните SQL из файла: `prisma/migrations/init_postgresql/migration-fixed.sql`

**Проверка:**
- Убедитесь, что таблицы созданы: `Supplier`, `Fabric`, `FabricCategory`, и т.д.
- Проверьте, что база данных не в режиме паузы

## 🚀 После настройки

### 1. Перезапустите деплой
- В Vercel Dashboard → **Deployments** → последний деплой → **Redeploy**
- Или просто сделайте новый коммит (уже отправлен)

### 2. Проверьте работу
- `/api/health` - должен показать `"connected": true`
- `/suppliers` - должна работать
- `/fabrics` - должна работать
- `/categories` - должна работать
- `/palette` - должна работать

## 🐛 Если проблемы остаются

### Проверьте логи сборки
В логах Vercel ищите:
- `🔧 Обнаружен Vercel - переключаемся на PostgreSQL` - скрипт должен выполниться
- `✅ Schema.prisma обновлен для PostgreSQL` - схема должна переключиться
- `❌ DATABASE_URL не найден!` - значит DATABASE_URL не настроен

### Проверьте runtime ошибки
В runtime логах ищите:
- `[Prisma] ⚠️ DATABASE_URL не найден` - DATABASE_URL не настроен
- `[checkDatabaseConnection] Error:` - ошибка подключения к БД
- Коды ошибок Prisma: `P1001`, `P1000`, `P1017` и т.д.

## 📋 Быстрая проверка

1. ✅ DATABASE_URL настроен в Vercel? → Проверьте `/api/health`
2. ✅ Миграции применены в Supabase? → Проверьте таблицы в Supabase
3. ✅ Деплой успешен? → Проверьте логи Vercel
4. ✅ Страницы работают? → Проверьте `/suppliers`, `/fabrics`

## 🔗 Полезные ссылки

- Vercel Dashboard: https://vercel.com/dashboard
- Health Check: https://lavsit-textile.vercel.app/api/health
- GitHub Repo: https://github.com/edcwsx23QAZ/Lavsit-Textile
- Supabase Dashboard: https://supabase.com/dashboard



