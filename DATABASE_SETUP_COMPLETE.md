# ✅ Настройка базы данных завершена

## 🔄 Что было сделано

### 1. Удалена старая связка с базой данных
- Очищены старые настройки
- Удалены устаревшие connection strings

### 2. Создана новая структура через Supabase API

#### Файлы:
- **`lib/supabase/client.ts`** - Обновленный Supabase клиент с правильными credentials
- **`lib/db/supabase-db.ts`** - Новый модуль для работы через Supabase REST API
- **`app/api/health/route.ts`** - Обновлен для проверки через Supabase API

#### Настройки:
- **Project ID:** `hduadapicktrcrqjvzvd`
- **URL:** `https://hduadapicktrcrqjvzvd.supabase.co`
- **Anon Key:** `sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq`
- **Service Key:** `sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp`
- **Пароль:** `edcwsx123QA`

## 📋 Переменные окружения для Vercel

Скопируйте из файла `VERCEL_ENV_VARS.txt` или используйте:

```
NEXT_PUBLIC_SUPABASE_URL=https://hduadapicktrcrqjvzvd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq
SUPABASE_SERVICE_ROLE_KEY=sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
DATABASE_PASSWORD=edcwsx123QA
```

## 🔧 Connection String

### Для Vercel (Connection Pooler - обязательно!)
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Важно:** 
- Используется порт **6543** (Connection Pooler)
- Hostname: `aws-0-us-east-1.pooler.supabase.com`
- Username: `postgres.hduadapicktrcrqjvzvd` (формат для pooler)
- Параметр `pgbouncer=true` обязателен

### Для локальной разработки (прямое подключение)
```
postgresql://postgres:edcwsx123QA@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public&sslmode=require
```

**Важно:**
- Используется порт **5432** (прямое подключение)
- Hostname: `db.hduadapicktrcrqjvzvd.supabase.co`
- Username: `postgres` (простой формат)
- **НЕ работает на Vercel!**

## 🚀 Использование

### Через Supabase API (рекомендуется)

```typescript
import { suppliers, fabrics, fabricCategories } from '@/lib/db/supabase-db'

// Получить всех поставщиков
const allSuppliers = await suppliers.findMany()

// Получить ткани с фильтром
const stockFabrics = await fabrics.findMany({
  where: { inStock: true },
  orderBy: { lastUpdatedAt: 'desc' },
  take: 100,
})

// Создать категорию
const newCategory = await fabricCategories.create({
  category: 1,
  price: 100,
})
```

### Через Prisma (если нужно)

```typescript
import { prisma } from '@/lib/db/prisma'

const suppliers = await prisma.supplier.findMany()
```

## ✅ Проверка

1. **Health Endpoint:**
   - Откройте: `https://lavsit-textile.vercel.app/api/health`
   - Проверьте: `supabase.connected: true`

2. **Проверка подключения:**
```typescript
import { checkDatabaseConnection } from '@/lib/db/supabase-db'
const result = await checkDatabaseConnection()
console.log(result)
```

## 📝 Следующие шаги

1. **Добавьте переменные окружения в Vercel:**
   - Откройте Vercel Dashboard → Settings → Environment Variables
   - Скопируйте значения из `VERCEL_ENV_VARS.txt`
   - Добавьте для всех окружений (Production, Preview, Development)

2. **Примените миграции:**
   - Откройте Supabase Dashboard → SQL Editor
   - Выполните SQL из `prisma/migrations/init_postgresql/migration-fixed.sql`

3. **Проверьте работу:**
   - Health endpoint должен показывать `supabase.connected: true`
   - Страницы должны загружаться без ошибок

## 📚 Документация

- `SUPABASE_FRESH_SETUP.md` - Подробная инструкция по настройке
- `VERCEL_ENV_VARS.txt` - Переменные окружения для копирования



