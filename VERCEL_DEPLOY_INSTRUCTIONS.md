# Инструкции по деплою на Vercel

## ✅ Выполнено

1. ✅ Код отправлен на GitHub (ветка `main` с SQLite)
2. ✅ Создана ветка `vercel-postgresql` с PostgreSQL для Vercel
3. ✅ Ветка отправлена на GitHub

## ⚠️ Важно: SQLite не работает на Vercel

Vercel использует read-only файловую систему, поэтому SQLite база данных не может быть записана.

**Решение**: Используем PostgreSQL (Supabase) для Vercel.

## Шаги для деплоя на Vercel

### Вариант 1: Через Vercel Dashboard (рекомендуется)

1. **Откройте Vercel Dashboard**
   - https://vercel.com/dashboard
   - Проект: `lavsit-textile`

2. **Настройте переменные окружения**
   - Settings → Environment Variables
   - Добавьте:
     ```
     DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
     ```
   - Примените для: Production, Preview, Development

3. **Подключите ветку vercel-postgresql**
   - Settings → Git
   - Или создайте новый деплой из ветки `vercel-postgresql`

4. **Примените миграции в Supabase**
   - Откройте https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
   - SQL Editor → New Query
   - Скопируйте содержимое `prisma/migrations/init_postgresql/migration.sql`
   - Выполните SQL скрипт

5. **Задеплойте**
   - Deployments → New Deployment
   - Выберите ветку `vercel-postgresql`
   - Нажмите Deploy

### Вариант 2: Через Vercel CLI

```bash
# 1. Установите Vercel CLI (если не установлен)
npm i -g vercel

# 2. Войдите в Vercel
vercel login

# 3. Переключитесь на ветку с PostgreSQL
git checkout vercel-postgresql

# 4. Настройте переменные окружения
vercel env add DATABASE_URL production
# Вставьте: postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require

# 5. Задеплойте
vercel --prod
```

## Проверка после деплоя

1. **Проверьте API endpoint**
   - https://lavsit-textile.vercel.app/api/test-db
   - Должен вернуть `success: true` и список таблиц

2. **Проверьте страницы**
   - https://lavsit-textile.vercel.app/ - главная
   - https://lavsit-textile.vercel.app/fabrics - ткани
   - https://lavsit-textile.vercel.app/suppliers - поставщики
   - https://lavsit-textile.vercel.app/categories - категории
   - https://lavsit-textile.vercel.app/palette - палитра

## Текущее состояние

### GitHub
- ✅ `main` - SQLite версия (для локальной разработки и VPS)
- ✅ `vercel-postgresql` - PostgreSQL версия (для Vercel)

### Vercel
- ⚠️ Требуется настройка переменных окружения
- ⚠️ Требуется применение миграций в Supabase
- ⚠️ Требуется деплой ветки `vercel-postgresql`

## Автоматический деплой

Если проект подключен к GitHub через Vercel:
- При пуше в ветку `vercel-postgresql` → автоматический деплой
- При пуше в `main` → деплой SQLite версии (не будет работать)

## Рекомендации

1. **Для локальной разработки**: используйте ветку `main` (SQLite)
2. **Для Vercel**: используйте ветку `vercel-postgresql` (PostgreSQL)
3. **Для VPS**: можно использовать любую версию

## Устранение проблем

### Ошибка: "Can't reach database"
- Проверьте DATABASE_URL в Vercel Environment Variables
- Убедитесь, что миграции применены в Supabase
- Проверьте, что база данных Supabase не на паузе

### Ошибка: "Table does not exist"
- Примените миграции в Supabase через SQL Editor
- Проверьте файл `prisma/migrations/init_postgresql/migration.sql`

### Страницы не загружаются
- Проверьте логи Vercel: `vercel logs`
- Проверьте подключение к базе данных
- Убедитесь, что Prisma Client сгенерирован

