# Настройка переменных окружения на Vercel

## Проблема

Страницы `/fabrics`, `/suppliers`, `/categories`, `/palette` могут возвращать 404 ошибки, если переменная окружения `DATABASE_URL` не настроена правильно на Vercel.

## 🚀 Быстрая проверка

Для автоматической проверки настройки используйте:

```bash
# Проверка переменных окружения
npm run vercel:check-env

# Комплексная проверка готовности к деплою
npm run vercel:verify
```

Подробнее см. [VERCEL_AUTO_SETUP.md](VERCEL_AUTO_SETUP.md)

## Требуемые переменные окружения

### DATABASE_URL (обязательно)

**Описание:** Строка подключения к базе данных PostgreSQL (Supabase)

**⚠️ ВАЖНО:** Для Vercel необходимо использовать **Connection Pooler** (порт 6543), а не прямое подключение!

**✅ Правильный формат для Vercel (Connection Pooler):**
```
postgresql://postgres.PROJECT_ID:PASSWORD@REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Пример:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
```

**❌ Неправильный формат (прямое подключение - НЕ работает на Vercel):**
```
postgresql://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres?schema=public
```

**Где найти:**
1. Откройте проект в Supabase Dashboard
2. Перейдите в Settings → Database
3. Найдите "Connection string"
4. **ВАЖНО:** Выберите **"Connection pooling"** (не "Direct connection"!)
5. Скопируйте строку подключения
6. Убедитесь, что она содержит:
   - `pooler.supabase.com` (не `db.supabase.co`)
   - Порт `6543` (не `5432`)
   - Параметр `pgbouncer=true`

**Как установить на Vercel:**
1. Откройте проект на Vercel: https://vercel.com/narfius-projects/lavsit-textile
2. Перейдите в Settings → Environment Variables
3. Добавьте переменную:
   - **Name:** `DATABASE_URL`
   - **Value:** ваша строка подключения из Supabase
   - **Environment:** выберите все окружения (Production, Preview, Development)
4. Сохраните изменения

**Важно:**
- Переменная должна быть доступна во время **Build** и **Runtime**
- После добавления переменной необходимо пересобрать проект (Redeploy)

## Проверка настройки

### 1. Проверка через Vercel Dashboard

1. Откройте проект на Vercel
2. Перейдите в Settings → Environment Variables
3. Убедитесь, что `DATABASE_URL` присутствует и доступна для всех окружений

### 2. Проверка через логи сборки

1. Откройте последний deployment на Vercel
2. Перейдите в Build Logs
3. Убедитесь, что команда `prisma generate` выполняется успешно
4. Проверьте, что нет ошибок подключения к базе данных

### 3. Проверка через Runtime логи

1. Откройте последний deployment на Vercel
2. Перейдите в Runtime Logs
3. Откройте одну из страниц: `/fabrics`, `/suppliers`, `/categories`, `/palette`
4. Проверьте логи на наличие ошибок подключения к базе данных

## Типичные ошибки

### Ошибка: "Can't reach database server" (P1001)

**Причина:** База данных недоступна или неправильный DATABASE_URL

**Решение:**
1. Проверьте, что база данных Supabase не находится в режиме паузы
2. Проверьте правильность DATABASE_URL на Vercel
3. Убедитесь, что переменная доступна для всех окружений

### Ошибка: "Authentication failed" (P1000)

**Причина:** Неправильный пароль в DATABASE_URL

**Решение:**
1. Проверьте пароль в строке подключения
2. Если пароль был изменен, обновите DATABASE_URL на Vercel

### Ошибка: "Database does not exist" (P1003)

**Причина:** Неправильное имя базы данных в DATABASE_URL

**Решение:**
1. Проверьте имя базы данных в строке подключения
2. Обычно это должно быть `postgres`

## После настройки

После правильной настройки переменных окружения:

1. **Проверьте настройку автоматически:**
   ```bash
   npm run vercel:check-env
   npm run vercel:verify
   ```

2. **Пересоберите проект:**
   - На Vercel Dashboard откройте проект
   - Перейдите в Deployments
   - Нажмите "Redeploy" для последнего deployment
   - Или используйте CLI: `vercel --prod`

3. **Проверьте страницы:**
   - Откройте https://lavsit-textile.vercel.app/fabrics
   - Откройте https://lavsit-textile.vercel.app/suppliers
   - Откройте https://lavsit-textile.vercel.app/categories
   - Откройте https://lavsit-textile.vercel.app/palette

4. **Проверьте логи:**
   - Если страницы все еще не работают, проверьте Runtime Logs на Vercel
   - Ищите ошибки подключения к базе данных
   - Используйте `/api/health` для диагностики: https://lavsit-textile.vercel.app/api/health

## Дополнительные переменные (опционально)

Если используются другие переменные окружения, убедитесь, что они также настроены на Vercel.

## Контакты

Если проблема сохраняется после выполнения всех шагов:
1. Проверьте логи на Vercel
2. Проверьте статус базы данных Supabase
3. Убедитесь, что миграции Prisma применены к базе данных

