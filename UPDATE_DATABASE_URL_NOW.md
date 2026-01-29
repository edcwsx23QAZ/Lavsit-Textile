# 🔧 СРОЧНО: Обновите DATABASE_URL в Vercel

## ❌ Текущая проблема

В Vercel установлен **неправильный** DATABASE_URL:
- Использует прямое подключение (порт 5432)
- Не работает на Vercel из-за IPv4 ограничений
- Supabase рекомендует использовать Session Pooler

## ✅ Правильный DATABASE_URL

Скопируйте и вставьте **ТОЧНО** этот connection string в Vercel:

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 📋 Пошаговая инструкция

### Шаг 1: Откройте Vercel Dashboard

1. Перейдите на https://vercel.com/dashboard
2. Войдите в свой аккаунт
3. Найдите проект **lavsit-textile** и нажмите на него

### Шаг 2: Обновите DATABASE_URL

1. В верхнем меню нажмите **Settings**
2. В левом меню выберите **Environment Variables**
3. Найдите переменную **DATABASE_URL**
4. Нажмите на нее (или на три точки справа)
5. Нажмите **Delete** (удалить) - подтвердите удаление
6. Нажмите **Add New**
7. Заполните:
   - **Key**: `DATABASE_URL`
   - **Value**: вставьте connection string выше (весь, полностью)
   - **Environment**: выберите все три (Production, Preview, Development)
8. Нажмите **Save**

### Шаг 3: Перезапустите деплой

1. Перейдите в **Deployments**
2. Найдите последний деплой
3. Нажмите на три точки (⋮) справа
4. Выберите **Redeploy**
5. Подтвердите

## ✅ Проверка

После обновления проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"database.connected": true`
   - `"databaseUrlPreview"` должен содержать `pooler.supabase.com:6543`

2. **Страницы**:
   - `/suppliers` - должна работать
   - `/fabrics` - должна работать

## 🔍 Разница

| Параметр | Текущий (неправильный) ❌ | Правильный ✅ |
|----------|--------------------------|---------------|
| Hostname | `db.hduadapicktrcrqjvzvd.supabase.co` | `aws-0-us-east-1.pooler.supabase.com` |
| Port | `5432` | `6543` |
| Username | `postgres` | `postgres.hduadapicktrcrqjvzvd` |
| Параметры | `schema=public` | `pgbouncer=true&schema=public&...` |
| IPv4 совместимость | ❌ Нет | ✅ Да |
| Работает на Vercel | ❌ Нет | ✅ Да |

## ⚠️ Важно

- **НЕ используйте** connection string из раздела "URI" в Supabase
- **Используйте ТОЛЬКО** Connection Pooler connection string
- Пароль в connection string: `edcwsx123QA` (без специальных символов, URL-encoding не требуется)



