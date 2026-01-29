# Исправление ошибки аутентификации базы данных

## 🔴 Проблема

Ошибка: **"Tenant or user not found"**

Это означает, что пароль в `DATABASE_URL` на Vercel неправильный или не URL-encoded.

## ✅ Решение

### Шаг 1: Получите правильный пароль из Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Перейдите в **Settings → Database**
4. Найдите раздел **Database password**
5. Если пароль забыт, нажмите **Reset database password**
6. Скопируйте новый пароль

### Шаг 2: URL-encode пароль

Если пароль содержит специальные символы (!, @, #, $, %, &, *, и т.д.), их нужно URL-encode:

- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `*` → `%2A`
- `(` → `%28`
- `)` → `%29`
- `+` → `%2B`
- `=` → `%3D`

**Пример:**
- Пароль: `edcwsx123QA!`
- URL-encoded: `edcwsx123QA%21`

### Шаг 3: Сформируйте правильный DATABASE_URL

Формат:
```
postgresql://postgres.hduadapicktrcrqjvzvd:[URL_ENCODED_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Пример с паролем `edcwsx123QA`:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Пример с паролем `edcwsx123QA!` (с восклицательным знаком):**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Шаг 4: Обновите DATABASE_URL на Vercel

1. Откройте проект на Vercel: https://vercel.com/narfius-projects/lavsit-textile
2. Перейдите в **Settings → Environment Variables**
3. Найдите `DATABASE_URL`
4. Нажмите на три точки (⋮) → **Edit**
5. Вставьте правильный connection string с URL-encoded паролем
6. Убедитесь, что выбраны все окружения:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
7. Сохраните изменения

### Шаг 5: Пересоберите проект

1. Перейдите в **Deployments**
2. Найдите последний deployment
3. Нажмите **Redeploy** (или **Deploy** → выберите последний коммит)
4. Дождитесь завершения сборки

### Шаг 6: Проверьте результат

1. Откройте health endpoint: https://lavsit-textile.vercel.app/api/health
2. Проверьте, что `database.connected: true`
3. Проверьте страницы:
   - https://lavsit-textile.vercel.app/fabrics
   - https://lavsit-textile.vercel.app/suppliers
   - https://lavsit-textile.vercel.app/categories
   - https://lavsit-textile.vercel.app/palette

## 🔧 Альтернативный способ: Получить Connection String из Supabase

1. Откройте Supabase Dashboard
2. Перейдите в **Settings → Database**
3. Найдите раздел **Connection string**
4. Выберите **Connection pooling** (не Direct connection!)
5. Скопируйте connection string
6. Вставьте его в `DATABASE_URL` на Vercel

Это гарантирует правильный формат и пароль.

## ⚠️ Важные моменты

1. **Пароль должен быть URL-encoded**, если содержит специальные символы
2. **Используйте Connection Pooler** (порт 6543), а не прямое подключение
3. **Username должен быть** `postgres.hduadapicktrcrqjvzvd` (не просто `postgres`)
4. **После изменения переменной** обязательно пересоберите проект

## 🧪 Проверка пароля

Можно проверить правильность пароля локально:

```bash
# Установите DATABASE_URL с новым паролем
$env:DATABASE_URL="postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public"

# Запустите тест подключения
npm run db:test
```

Если подключение успешно, значит пароль правильный.

## 📝 Чеклист

- [ ] Получен правильный пароль из Supabase Dashboard
- [ ] Пароль URL-encoded (если содержит специальные символы)
- [ ] Сформирован правильный DATABASE_URL
- [ ] DATABASE_URL обновлен на Vercel для всех окружений
- [ ] Проект пересобран на Vercel
- [ ] Health endpoint показывает `database.connected: true`
- [ ] Страницы работают без ошибок

