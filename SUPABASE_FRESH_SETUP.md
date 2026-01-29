# 🔄 Настройка базы данных с нуля через Supabase API

## ✅ Выполнено

### 1. Обновлен Supabase Client
- **Файл:** `lib/supabase/client.ts`
- **Настройки:**
  - Project ID: `hduadapicktrcrqjvzvd`
  - URL: `https://hduadapicktrcrqjvzvd.supabase.co`
  - Anon Key: `sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq`
  - Service Key: `sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp`
  - Пароль: `edcwsx123QA`

### 2. Создан новый модуль для работы через API
- **Файл:** `lib/db/supabase-db.ts`
- **Функции:**
  - `suppliers` - работа с таблицей Supplier
  - `fabrics` - работа с таблицей Fabric
  - `fabricCategories` - работа с таблицей FabricCategory
  - `checkDatabaseConnection()` - проверка подключения

### 3. Connection String для Connection Pooler
- **Для Vercel (обязательно использовать Connection Pooler):**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

- **Для локальной разработки (прямое подключение):**
```
postgresql://postgres:edcwsx123QA@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public&sslmode=require
```

## 📋 Переменные окружения для Vercel

Добавьте в Vercel Dashboard → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://hduadapicktrcrqjvzvd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq
SUPABASE_SERVICE_ROLE_KEY=sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
DATABASE_PASSWORD=edcwsx123QA
```

## 🔧 Использование

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

## ⚠️ Важно

1. **Для Vercel:** Используйте Connection Pooler (порт 6543)
2. **Для локальной разработки:** Можно использовать прямое подключение (порт 5432)
3. **Supabase API:** Работает везде, не требует connection string
4. **Prisma:** Требует DATABASE_URL для работы

## 🔍 Проверка

1. **Health Endpoint:** `https://lavsit-textile.vercel.app/api/health`
2. **Проверка подключения:**
```typescript
import { checkDatabaseConnection } from '@/lib/db/supabase-db'
const result = await checkDatabaseConnection()
console.log(result)
```

## 📝 Следующие шаги

1. Примените миграции в Supabase
2. Проверьте подключение через health endpoint
3. Протестируйте работу страниц



