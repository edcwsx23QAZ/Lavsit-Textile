# Исправление формата DATABASE_URL на Vercel

## 🔴 Проблема

Ошибка: `DATABASE_URL имеет неправильный формат. URL должен начинаться с postgresql:// или postgres://. Текущий формат: DATABASE_URL=postgresql://post...`

Это означает, что в значении переменной `DATABASE_URL` на Vercel есть префикс `DATABASE_URL=` перед connection string.

## ❌ Неправильно

В поле "Value" на Vercel НЕ должно быть:
```
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:...
```

## ✅ Правильно

В поле "Value" должно быть ТОЛЬКО connection string:
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 🔧 Как исправить

### Шаг 1: Откройте настройки переменных на Vercel

1. Откройте: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables
2. Найдите `DATABASE_URL`
3. Нажмите **Edit**

### Шаг 2: Проверьте значение

В поле "Value" должно быть ТОЛЬКО connection string, БЕЗ префикса `DATABASE_URL=`.

**Неправильно:**
```
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
```

**Правильно:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Шаг 3: Исправьте значение

1. Если в начале есть `DATABASE_URL=` - удалите его
2. Оставьте только connection string
3. Убедитесь, что connection string содержит:
   - ✅ `pooler.supabase.com` (не `db.supabase.co`)
   - ✅ Порт `6543` (не `5432`)
   - ✅ Параметры `?pgbouncer=true&schema=public&...`
   - ✅ Без квадратных скобок вокруг пароля
4. Сохраните

### Шаг 4: Пересоберите проект

1. Перейдите в **Deployments**: https://vercel.com/narfius-projects/lavsit-textile/deployments
2. Нажмите **Redeploy** на последнем deployment
3. Дождитесь завершения сборки (2-3 минуты)

## ✅ Правильный формат для Vercel

В поле "Value" переменной `DATABASE_URL` должно быть:

```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Ключевые моменты:**
- ✅ Начинается с `postgresql://` (не `DATABASE_URL=postgresql://`)
- ✅ Использует `pooler.supabase.com` (не `db.supabase.co`)
- ✅ Порт `6543` (не `5432`)
- ✅ Пароль без квадратных скобок
- ✅ Есть параметры `?pgbouncer=true&schema=public&...`

## 🧪 Проверка после исправления

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

## ⚠️ Важно

Vercel автоматически добавляет имя переменной (`DATABASE_URL`) при чтении, поэтому в поле "Value" должно быть **только значение**, без имени переменной.

## 📝 Чеклист

- [ ] Убран префикс `DATABASE_URL=` из значения переменной
- [ ] В поле "Value" только connection string
- [ ] Connection string начинается с `postgresql://`
- [ ] Используется `pooler.supabase.com:6543`
- [ ] Пароль без квадратных скобок
- [ ] Добавлены параметры (`?pgbouncer=true&schema=public&...`)
- [ ] Выбраны все окружения (Production, Preview, Development)
- [ ] Проект пересобран
- [ ] Health endpoint показывает `database.connected: true`

