# ✅ Правильный DATABASE_URL для Vercel

## 🔑 Точный Connection String

Скопируйте и вставьте **ТОЧНО** этот connection string в Vercel Environment Variables:

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 📋 Проверка формата

### ✅ Правильные компоненты:

1. **Протокол**: `postgresql://` (начинается правильно)
2. **Username**: `postgres.hduadapicktrcrqjvzvd` (формат для pooler: `postgres.[PROJECT_ID]`)
3. **Password**: `edcwsx123QAZ%21` (URL-encoded: `!` → `%21`)
4. **Hostname**: `aws-0-us-east-1.pooler.supabase.com` (Connection Pooler)
5. **Port**: `6543` (порт для pooler)
6. **Database**: `postgres`
7. **Параметры**:
   - `pgbouncer=true` ✅
   - `schema=public` ✅
   - `connect_timeout=30` ✅
   - `pool_timeout=30` ✅
   - `sslmode=require` ✅

## 🔧 Как вставить в Vercel

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите `DATABASE_URL` или создайте новый
5. **ВАЖНО**: Скопируйте connection string выше **ПОЛНОСТЬЮ**, включая все параметры
6. Вставьте в поле **Value**
7. Убедитесь, что:
   - **Key**: `DATABASE_URL` (без пробелов, точно так)
   - **Value**: весь connection string (начинается с `postgresql://`)
   - **Environment**: все (Production, Preview, Development)
8. Нажмите **Save**

## ⚠️ Частые ошибки

### ❌ Неправильный пароль
**Неправильно:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ!@...
```
(пароль с `!` вместо `%21`)

**Правильно:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@...
```
(пароль с `%21` вместо `!`)

### ❌ Неправильный формат username
**Неправильно:**
```
postgresql://postgres:password@...
```
(для pooler нужен формат `postgres.[PROJECT_ID]`)

**Правильно:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:password@...
```

### ❌ Неправильный порт
**Неправильно:**
```
...pooler.supabase.com:5432/...
```
(порт 5432 для прямого подключения)

**Правильно:**
```
...pooler.supabase.com:6543/...
```
(порт 6543 для pooler)

### ❌ Отсутствует pgbouncer
**Неправильно:**
```
...postgres?schema=public
```

**Правильно:**
```
...postgres?pgbouncer=true&schema=public
```

## 🧪 Проверка connection string

После настройки в Vercel проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"databaseUrlType": "postgresql"`
   - Должен показать `"databaseUrlValid": true`
   - Должен показать `"connected": true` (если миграции применены)

2. **Локальная проверка** (если нужно):
   ```bash
   node scripts/verify-database-url.js "ваш_connection_string"
   ```

## 📝 Полный connection string для копирования

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Скопируйте строку выше полностью и вставьте в Vercel Environment Variables как значение для `DATABASE_URL`**



