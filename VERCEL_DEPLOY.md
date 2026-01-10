# Инструкция по деплою на Vercel

## Подготовка базы данных PostgreSQL

Поскольку SQLite не поддерживается на Vercel, необходимо использовать PostgreSQL. Рекомендуемые варианты:

### Вариант 1: Vercel Postgres (рекомендуется)
1. Перейдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите ваш проект
3. Перейдите в раздел **Storage**
4. Нажмите **Create Database** → выберите **Postgres**
5. После создания базы, скопируйте **Connection String**
6. Добавьте переменную окружения `DATABASE_URL` в **Project Settings** → **Environment Variables**

### Вариант 2: Supabase
1. Создайте проект на [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейдите в **Settings** → **Database** → **Connection string (URI format)**
3. Скопируйте connection string (замените `[YOUR-PASSWORD]` на ваш пароль)
4. Добавьте `?schema=public` в конец строки
5. Добавьте переменную окружения `DATABASE_URL` в Vercel Dashboard → **Project Settings** → **Environment Variables**

### Вариант 3: Neon / Railway / Render
1. Создайте PostgreSQL базу данных на любом из этих провайдеров
2. Получите connection string
3. Добавьте переменную окружения `DATABASE_URL` в Vercel Dashboard → **Project Settings** → **Environment Variables**

## Настройка переменных окружения в Vercel

Перейдите в Vercel Dashboard → ваш проект → **Settings** → **Environment Variables** и добавьте:

- `DATABASE_URL` - строка подключения к PostgreSQL (обязательно)
- Другие переменные окружения, если они используются в проекте (IMAP, API ключи и т.д.)

## Выполнение миграций

После настройки базы данных и переменных окружения:

```bash
# Сгенерировать Prisma Client
npx prisma generate

# Создать миграцию (если еще не создана)
npx prisma migrate dev --name init

# Применить миграции к production базе (через Vercel CLI или напрямую)
npx prisma migrate deploy
```

## Деплой на Vercel

### Шаг 1: Вход в Vercel
```bash
vercel login
```

### Шаг 2: Production деплой
```bash
vercel --prod
```

## Важные замечания

1. **Puppeteer**: 
   - Puppeteer работает на Vercel serverless функциях, но требует специальных настроек (уже включены в код: `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`)
   - Таймауты увеличены до 300 секунд в `vercel.json` для длительных операций парсинга
   - Если возникают проблемы, рассмотрите использование внешнего сервиса для парсинга или альтернативных подходов

2. **IMAP**: Если используется IMAP для парсинга email, убедитесь, что все необходимые переменные окружения настроены:
   - `IMAP_HOST`
   - `IMAP_PORT`
   - `IMAP_USER`
   - `IMAP_PASSWORD`
   - `IMAP_TLS`

3. **Таймауты**: Для длительных операций (парсинг) таймаут увеличен до 300 секунд (5 минут) в `vercel.json`. Если нужен больший таймаут, рассмотрите использование фоновых задач или разделение операций на части.

4. **Файловая система**: Vercel serverless функции имеют ограниченную файловую систему (только `/tmp` директория). Убедитесь, что все файловые операции используют `/tmp` директорию.

5. **Переменные окружения**: Обязательно настройте `DATABASE_URL` перед деплоем. Без неё сборка и работа приложения невозможны.

## Проверка после деплоя

После успешного деплоя:
1. Проверьте работу приложения на production URL
2. Проверьте логи в Vercel Dashboard → ваш проект → **Functions** → **View Function Logs**
3. Убедитесь, что база данных подключена и миграции применены

