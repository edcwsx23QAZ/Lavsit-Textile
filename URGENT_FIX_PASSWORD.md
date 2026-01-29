# 🔴 СРОЧНО: Исправление ошибки аутентификации

## Проблема

Ошибка: **"Tenant or user not found"**

Это означает, что **пароль в DATABASE_URL на Vercel неправильный**.

## ✅ Решение (5 минут)

### Шаг 1: Получите правильный пароль

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
2. Перейдите в **Settings → Database**
3. Найдите раздел **Database password**
4. Если пароль забыт или неизвестен:
   - Нажмите **Reset database password**
   - Скопируйте новый пароль
   - **ВАЖНО:** Сохраните пароль в безопасном месте!

### Шаг 2: URL-encode пароль (если нужно)

Если пароль содержит специальные символы, их нужно закодировать:

| Символ | URL-encoded |
|--------|-------------|
| `!` | `%21` |
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `*` | `%2A` |
| `(` | `%28` |
| `)` | `%29` |
| `+` | `%2B` |
| `=` | `%3D` |

**Пример:**
- Пароль: `MyPass123!`
- URL-encoded: `MyPass123%21`

### Шаг 3: Сформируйте DATABASE_URL

**Формат:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:[URL_ENCODED_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Замените `[URL_ENCODED_PASSWORD]` на ваш пароль (URL-encoded, если нужно)**

### Шаг 4: Обновите на Vercel

1. Откройте: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables
2. Найдите `DATABASE_URL`
3. Нажмите **Edit** (или три точки → Edit)
4. Вставьте правильный connection string с правильным паролем
5. **ВАЖНО:** Убедитесь, что выбраны все окружения:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
6. Нажмите **Save**

### Шаг 5: Пересоберите проект

1. Перейдите в **Deployments**: https://vercel.com/narfius-projects/lavsit-textile/deployments
2. Нажмите **Redeploy** на последнем deployment
3. Или создайте новый deployment: **Deploy** → выберите последний коммит

### Шаг 6: Проверьте

1. Дождитесь завершения сборки (2-3 минуты)
2. Откройте: https://lavsit-textile.vercel.app/api/health
3. Проверьте, что `database.connected: true`
4. Проверьте страницы - они должны работать!

## 🎯 Быстрый способ: Получить Connection String из Supabase

Если не хотите вручную формировать connection string:

1. Откройте Supabase Dashboard
2. **Settings → Database**
3. Найдите раздел **Connection string**
4. Выберите **Connection pooling** (не Direct!)
5. Скопируйте connection string
6. Вставьте его в `DATABASE_URL` на Vercel
7. Пересоберите проект

Это гарантирует правильный формат и пароль.

## ⚠️ Важно

- Пароль должен быть **URL-encoded**, если содержит специальные символы
- Используйте **Connection Pooler** (порт 6543), не прямое подключение
- После изменения переменной **обязательно пересоберите** проект
- Пароль чувствителен к регистру!

## ✅ После исправления

Проверьте:
- ✅ Health endpoint: `/api/health` показывает `database.connected: true`
- ✅ Страницы работают: `/fabrics`, `/suppliers`, `/categories`, `/palette`
- ✅ Нет ошибок "База данных недоступна"

