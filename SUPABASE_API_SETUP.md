# 🔧 Настройка подключения через Supabase API

## Данные проекта

- **URL**: https://hduadapicktrcrqjvzvd.supabase.co
- **Publishable Key**: `sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq`
- **Secret Key**: `sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp`

## Переменные окружения для Vercel

### 1. Supabase URL и ключи

```
NEXT_PUBLIC_SUPABASE_URL=https://hduadapicktrcrqjvzvd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq
SUPABASE_SERVICE_ROLE_KEY=sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp
```

### 2. DATABASE_URL для Prisma

**Вариант A: Получить из Supabase Dashboard (РЕКОМЕНДУЕТСЯ)**

1. Откройте https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Settings → Database → Connection string → Connection pooling → Session mode
4. Скопируйте connection string полностью

**Вариант B: Сформировать автоматически**

Если у вас есть пароль базы данных, можно использовать скрипт:

```bash
npm run setup:supabase-env
```

Или установите переменную `SUPABASE_DB_PASSWORD` и connection string сформируется автоматически.

## Настройка в Vercel

1. **Откройте Vercel Dashboard**
   - https://vercel.com/dashboard
   - Выберите проект `lavsit-textile`

2. **Перейдите в Settings → Environment Variables**

3. **Добавьте переменные:**

   | Key | Value | Environment |
   |-----|-------|-------------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://hduadapicktrcrqjvzvd.supabase.co` | All |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq` | All |
   | `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_NmrKSfz9rwXqnrD8TEkQlA_5dm3YIkp` | All |
   | `DATABASE_URL` | Connection string из Supabase Dashboard | All |

4. **Сохраните и перезапустите деплой**

## Использование в коде

### Prisma (для серверных запросов)

```typescript
import { prisma } from '@/lib/db/prisma'

// Используется как обычно
const suppliers = await prisma.supplier.findMany()
```

### Supabase Client (для клиентских запросов или альтернатива)

```typescript
import { supabase } from '@/lib/supabase/client'

// Для обычных запросов (с RLS)
const { data, error } = await supabase
  .from('suppliers')
  .select('*')

// Для админских операций (обходит RLS)
import { supabaseAdmin } from '@/lib/supabase/client'
const { data, error } = await supabaseAdmin
  .from('suppliers')
  .select('*')
```

## Проверка подключения

После настройки проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"database.connected": true` (Prisma)
   - Должен показать `"supabase.connected": true` (Supabase API)

2. **Страницы**:
   - `/suppliers` - должна работать
   - `/fabrics` - должна работать

## Важные моменты

### Безопасность

- ✅ `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY` - безопасны для клиента
- ⚠️ `SUPABASE_SERVICE_ROLE_KEY` - **НЕ используйте в клиентском коде!** Только на сервере
- ⚠️ `DATABASE_URL` - содержит пароль, только на сервере

### Когда использовать что

- **Prisma**: Для серверных компонентов и API routes, когда нужна типизация и миграции
- **Supabase Client**: Для клиентских компонентов, когда нужен real-time или RLS (Row Level Security)

## Устранение проблем

### Ошибка "Tenant or user not found"

1. Проверьте, что `DATABASE_URL` правильный (из Supabase Dashboard)
2. Убедитесь, что пароль URL-encoded
3. Проверьте, что используется Connection Pooler (порт 6543)

### Supabase API не работает

1. Проверьте, что `NEXT_PUBLIC_SUPABASE_URL` правильный
2. Проверьте, что ключи правильные
3. Убедитесь, что база данных не в режиме паузы

## Полезные ссылки

- Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
- Vercel Dashboard: https://vercel.com/dashboard
- Health Check: https://lavsit-textile.vercel.app/api/health



