# Автоматическая настройка и проверка Vercel

Этот документ описывает автоматические скрипты для проверки и настройки переменных окружения на Vercel.

## 📋 Доступные скрипты

### 1. Проверка переменных окружения

Проверяет наличие и правильность всех необходимых переменных окружения.

```bash
npm run vercel:check-env
```

**Что проверяет:**
- ✅ Наличие `DATABASE_URL`
- ✅ Формат `DATABASE_URL` (Connection Pooler для Vercel)
- ✅ Наличие `NEXT_PUBLIC_SUPABASE_URL` (опционально)
- ✅ Наличие `NEXT_PUBLIC_SUPABASE_ANON_KEY` (опционально)
- ✅ Подключение к базе данных

**Пример вывода:**
```
🔍 Проверка переменных окружения...

📋 Результаты проверки переменных окружения:

────────────────────────────────────────────────────────────────────────────────
✅ DATABASE_URL [ОБЯЗАТЕЛЬНО]
   ✅ Правильный формат Connection Pooler для Vercel
   Значение: postgresql://postgres.hduadapicktrcrqjvzvd:****@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public

ℹ️ NEXT_PUBLIC_SUPABASE_URL [ОПЦИОНАЛЬНО]
   Настроена
   Значение: https://hduadapicktrcrqjvzvd.supabase.co

✅ Подключение к базе данных успешно!

────────────────────────────────────────────────────────────────────────────────
✅ Все проверки пройдены успешно!
```

### 2. Комплексная проверка настройки

Полная проверка готовности проекта к деплою на Vercel.

```bash
npm run vercel:verify
```

**Что проверяет:**
- ✅ Окружение Vercel
- ✅ Формат `DATABASE_URL`
- ✅ Подключение к базе данных
- ✅ Генерация Prisma Client
- ✅ Supabase переменные
- ✅ Готовность к сборке

**Пример вывода:**
```
🔍 Комплексная проверка настройки проекта на Vercel

────────────────────────────────────────────────────────────────────────────────

📋 Результаты проверки:

✅ Vercel Environment
   Окружение: production

✅ DATABASE_URL
   Правильный формат Connection Pooler для Vercel
   Детали: Host: aws-0-us-east-1.pooler.supabase.com, Port: 6543

✅ Database Connection
   Подключение к базе данных успешно

✅ Prisma Client
   Prisma Client сгенерирован

✅ Build Readiness
   Проект готов к сборке

────────────────────────────────────────────────────────────────────────────────

✅ Все проверки пройдены успешно!
   Проект готов к деплою на Vercel.
```

### 3. Автоматическая настройка переменных на Vercel

Автоматически добавляет/обновляет переменные окружения на Vercel через CLI.

```bash
npm run vercel:setup-env
```

**Требования:**
1. Установлен Vercel CLI: `npm i -g vercel`
2. Авторизован в Vercel: `vercel login`
3. Проект связан с Vercel: `vercel link`

**Что делает:**
- Читает переменные из `.env.vercel` или использует значения по умолчанию
- Добавляет/обновляет переменные на Vercel для всех окружений (production, preview, development)

**Пример вывода:**
```
🚀 Настройка переменных окружения на Vercel

✅ Vercel CLI установлен

✅ Авторизован в Vercel

✅ Проект связан с Vercel

📋 Найдено переменных: 3

📝 Настройка DATABASE_URL...
   ✅ production: добавлено
   ✅ preview: добавлено
   ✅ development: добавлено

✅ Настройка завершена!

📌 Следующие шаги:
   1. Проверьте переменные на Vercel Dashboard
   2. Пересоберите проект: vercel --prod
```

## 🚀 Быстрый старт

### Шаг 1: Проверка текущей настройки

```bash
npm run vercel:check-env
```

Если все проверки пройдены, можно переходить к деплою.

### Шаг 2: Комплексная проверка

```bash
npm run vercel:verify
```

Этот скрипт проверяет все аспекты готовности проекта.

### Шаг 3: Автоматическая настройка (опционально)

Если нужно настроить переменные через CLI:

```bash
# Установите Vercel CLI (если еще не установлен)
npm i -g vercel

# Авторизуйтесь
vercel login

# Свяжите проект
vercel link

# Запустите настройку
npm run vercel:setup-env
```

## 📝 Формат DATABASE_URL

### ✅ Правильный формат для Vercel (Connection Pooler):

```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Ключевые параметры:**
- ✅ Hostname: `pooler.supabase.com` (не `db.supabase.co`)
- ✅ Port: `6543` (не `5432`)
- ✅ Username: `postgres.PROJECT_ID` (не просто `postgres`)
- ✅ Параметр: `pgbouncer=true`

### ❌ Неправильный формат (прямое подключение):

```
postgresql://postgres:[PASSWORD]@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```

**Почему не работает на Vercel:**
- Supabase ограничивает прямое подключение для предотвращения перегрузки
- Connection Pooler оптимизирован для serverless окружений
- Прямое подключение может привести к ошибкам "Can't reach database server"

## 🔧 Ручная настройка на Vercel

Если автоматическая настройка не подходит, можно настроить вручную:

1. Откройте проект на Vercel: https://vercel.com/narfius-projects/lavsit-textile
2. Перейдите в **Settings → Environment Variables**
3. Добавьте переменные:

| Переменная | Значение | Окружения |
|-----------|----------|-----------|
| `DATABASE_URL` | `postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public` | All |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://hduadapicktrcrqjvzvd.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq` | All |

4. Сохраните изменения
5. Пересоберите проект (Redeploy)

## 📊 Получение Connection Pooler URL из Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект
3. Перейдите в **Settings → Database**
4. Найдите раздел **Connection string**
5. Выберите **Connection pooling** (не Direct connection)
6. Скопируйте connection string
7. Убедитесь, что он содержит:
   - `pooler.supabase.com`
   - Порт `6543`
   - Параметр `pgbouncer=true`

## ⚠️ Типичные проблемы

### Ошибка: "Can't reach database server" (P1001)

**Причина:** Используется прямое подключение вместо Connection Pooler

**Решение:**
1. Проверьте формат `DATABASE_URL` через `npm run vercel:check-env`
2. Убедитесь, что используется порт `6543` и `pooler.supabase.com`
3. Обновите переменную на Vercel

### Ошибка: "Authentication failed" (P1000)

**Причина:** Неправильный пароль или формат username

**Решение:**
1. Проверьте пароль в connection string
2. Убедитесь, что пароль URL-encoded (специальные символы экранированы)
3. Для pooler username должен быть `postgres.PROJECT_ID`

### Ошибка: "Database does not exist" (P1003)

**Причина:** Неправильное имя базы данных

**Решение:**
1. Убедитесь, что в connection string указано `/postgres` (имя базы данных)
2. Проверьте, что проект Supabase активен и не находится в режиме паузы

## 📚 Дополнительные ресурсы

- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Supabase Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Prisma with Vercel](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel)

## ✅ Чеклист перед деплоем

- [ ] Запущен `npm run vercel:check-env` - все проверки пройдены
- [ ] Запущен `npm run vercel:verify` - проект готов к сборке
- [ ] `DATABASE_URL` использует Connection Pooler (порт 6543)
- [ ] Переменные окружения настроены на Vercel для всех окружений
- [ ] Prisma Client сгенерирован (`npx prisma generate`)
- [ ] Миграции применены к базе данных (если есть новые)

После выполнения всех пунктов можно деплоить проект на Vercel!

