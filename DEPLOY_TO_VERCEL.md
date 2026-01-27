# Деплой на Vercel

## ⚠️ Важное замечание о SQLite

**SQLite не работает на Vercel!** Vercel использует read-only файловую систему, поэтому SQLite база данных не может быть записана.

### Решения:

1. **Использовать Vercel Postgres** (рекомендуется для Vercel)
2. **Использовать Supabase** (уже настроен в проекте)
3. **Использовать другую облачную БД** (Neon, Railway, etc.)

## Вариант 1: Использовать Supabase на Vercel

### Шаг 1: Настроить переменные окружения в Vercel

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте переменную:

```
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Шаг 2: Изменить schema.prisma для Vercel

Создать файл `prisma/schema.prisma` с PostgreSQL:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Шаг 3: Применить миграции

Миграции нужно применить в Supabase через SQL Editor (см. `prisma/migrations/init_postgresql/migration.sql`)

### Шаг 4: Деплой

```bash
vercel --prod
```

## Вариант 2: Использовать Vercel Postgres

### Шаг 1: Создать Vercel Postgres

1. В Vercel Dashboard → **Storage** → **Create Database**
2. Выберите **Postgres**
3. Создайте базу данных

### Шаг 2: Настроить переменные окружения

Vercel автоматически создаст переменную `POSTGRES_URL`

### Шаг 3: Обновить schema.prisma

```prisma
datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}
```

### Шаг 4: Применить миграции

```bash
vercel env pull .env.local
npx prisma migrate deploy
```

## Вариант 3: Деплой через GitHub (автоматический)

Если проект уже подключен к Vercel через GitHub:

1. Изменения уже отправлены на GitHub (ветка `main`)
2. Vercel автоматически задеплоит при пуше в `main`
3. Убедитесь, что переменные окружения настроены в Vercel Dashboard

## Текущая ситуация

- ✅ Код отправлен на GitHub (ветка `main`)
- ⚠️ Schema.prisma настроен на SQLite (не работает на Vercel)
- ⚠️ Нужно изменить на PostgreSQL для Vercel

## Рекомендация

Для Vercel лучше использовать **Supabase** (уже настроен):
1. Изменить `prisma/schema.prisma` на PostgreSQL
2. Настроить `DATABASE_URL` в Vercel Environment Variables
3. Применить миграции в Supabase
4. Задеплоить

## Команды для деплоя

```bash
# Проверка подключения к Vercel
vercel whoami

# Деплой (если проект не подключен)
vercel

# Production деплой
vercel --prod

# Проверка логов
vercel logs
```

