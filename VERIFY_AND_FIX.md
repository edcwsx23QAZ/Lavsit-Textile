# Проверка и исправление DATABASE_URL на Vercel

## 🔍 Текущая ситуация

Проверка показывает, что все еще используется **прямое подключение** (порт 5432) вместо **Connection Pooler** (порт 6543).

## ✅ Что нужно проверить

### 1. Проверьте переменную DATABASE_URL на Vercel

1. Откройте: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables
2. Найдите `DATABASE_URL`
3. Нажмите на переменную, чтобы увидеть ее значение (пароль будет скрыт)
4. Проверьте, что connection string содержит:
   - ✅ `pooler.supabase.com` (не `db.supabase.co`)
   - ✅ Порт `6543` (не `5432`)
   - ✅ `pgbouncer=true`

### 2. Проверьте окружения

Убедитесь, что `DATABASE_URL` доступна для **всех окружений**:
- ✅ Production
- ✅ Preview
- ✅ Development

Если переменная доступна только для одного окружения, добавьте для остальных.

### 3. Пересоберите проект

**ВАЖНО:** После изменения переменных окружения **обязательно пересоберите проект!**

1. Перейдите в **Deployments**: https://vercel.com/narfius-projects/lavsit-textile/deployments
2. Нажмите **Redeploy** на последнем deployment
3. Или создайте новый deployment: **Deploy** → выберите последний коммит
4. Дождитесь завершения сборки (2-3 минуты)

## 🔧 Если переменная не обновлена

### Шаг 1: Получите правильный Connection String

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
2. **Settings → Database**
3. Найдите **Connection string**
4. Выберите **"Connection pooling"** (не "URI" или "Direct connection")
5. Выберите **"Transaction pooler"** или **"Session pooler"**
6. Скопируйте connection string

### Шаг 2: Обновите на Vercel

1. Откройте Vercel: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables
2. Найдите `DATABASE_URL`
3. Нажмите **Edit**
4. **Удалите** старый connection string
5. **Вставьте** новый connection string из Supabase
6. **Добавьте параметры** в конец (если их нет):
   ```
   ?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
   ```
7. Убедитесь, что выбраны **все окружения**
8. Нажмите **Save**

### Шаг 3: Пересоберите проект

1. **Deployments** → **Redeploy**
2. Дождитесь завершения

## ✅ Проверка после исправления

После пересборки проверьте:

1. **Health endpoint:**
   ```
   https://lavsit-textile.vercel.app/api/health
   ```

2. **Должно быть:**
   - `databaseUrlDetails.isPooler: true` ✅
   - `databaseUrlDetails.port: "6543"` ✅
   - `databaseUrlDetails.isValidForVercel: true` ✅
   - `database.connected: true` ✅

3. **Или через скрипт:**
   ```bash
   npm run vercel:status
   ```

## 📋 Правильный формат Connection String

```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Ключевые элементы:**
- Username: `postgres.hduadapicktrcrqjvzvd` (не просто `postgres`)
- Hostname: `aws-1-eu-west-1.pooler.supabase.com` (содержит `pooler`)
- Port: `6543` (не `5432`)
- Параметр: `pgbouncer=true`

## ⚠️ Частые ошибки

1. **Используется старый connection string** - проверьте, что обновили на Vercel
2. **Переменная не доступна для всех окружений** - добавьте для Production, Preview, Development
3. **Проект не пересобран** - после изменения переменных обязательно пересоберите
4. **Пароль не URL-encoded** - если содержит специальные символы, закодируйте их

## 🐛 Если проблема сохраняется

1. Проверьте логи на Vercel:
   - Откройте последний deployment
   - Перейдите в **Runtime Logs**
   - Откройте одну из страниц
   - Проверьте ошибки подключения

2. Проверьте статус базы данных Supabase:
   - Убедитесь, что проект не в режиме паузы
   - Проверьте, что база данных активна

3. Попробуйте получить connection string заново из Supabase Dashboard

