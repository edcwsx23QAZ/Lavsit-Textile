# 🔑 Как получить пароль базы данных для connection string

## Где найти пароль базы данных Supabase

### Способ 1: Из Supabase Dashboard (РЕКОМЕНДУЕТСЯ)

1. **Откройте Supabase Dashboard**
   - Перейдите на https://supabase.com/dashboard
   - Войдите в свой аккаунт

2. **Выберите проект**
   - Найдите проект `hduadapicktrcrqjvzvd`
   - Нажмите на него

3. **Перейдите в настройки базы данных**
   - В левом меню нажмите **Settings** (⚙️)
   - Выберите **Database**

4. **Найдите раздел "Database password"**
   - Прокрутите вниз до раздела **Database password**
   - Если пароль был установлен ранее, вы увидите кнопку **Reset database password**
   - Если пароль не был установлен или забыт, нажмите **Reset database password**

5. **Скопируйте пароль**
   - После сброса пароля, Supabase покажет новый пароль
   - **ВАЖНО:** Скопируйте пароль сразу - он больше не будет показан!
   - Сохраните пароль в безопасном месте

### Способ 2: Из Connection String в Supabase Dashboard

1. **Откройте Supabase Dashboard**
   - https://supabase.com/dashboard
   - Выберите проект `hduadapicktrcrqjvzvd`

2. **Перейдите в Settings → Database**

3. **Найдите раздел "Connection string"**
   - Прокрутите до раздела **Connection string**
   - Выберите вкладку **Connection pooling** (не "URI" или "JDBC")

4. **Выберите режим**
   - **Session mode** (рекомендуется для большинства случаев)
   - Или **Transaction mode**

5. **Скопируйте connection string**
   - Supabase автоматически сгенерирует connection string с правильным паролем
   - **Используйте этот connection string напрямую** - не редактируйте его!

## ⚠️ Важные моменты

### Пароль уже URL-encoded в connection string

Когда вы копируете connection string из Supabase Dashboard, пароль уже правильно URL-encoded. **НЕ редактируйте connection string вручную!**

**Пример:**
- Пароль: `edcwsx123QAZ!`
- В connection string: `edcwsx123QAZ%21` (автоматически закодирован)

### Если пароль содержит специальные символы

Если вы создаете connection string вручную (не рекомендуется), нужно URL-encode специальные символы:

- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `*` → `%2A`
- `+` → `%2B`
- `=` → `%3D`
- `?` → `%3F`

**Но лучше использовать connection string из Supabase Dashboard - он уже правильно закодирован!**

## 📋 Пошаговая инструкция для Vercel

1. **Получите connection string из Supabase**
   - Settings → Database → Connection string → Connection pooling → Session mode
   - Скопируйте весь connection string

2. **Вставьте в Vercel**
   - Откройте https://vercel.com/dashboard
   - Выберите проект `lavsit-textile`
   - Settings → Environment Variables
   - Найдите или создайте `DATABASE_URL`
   - Вставьте connection string из Supabase (полностью, без изменений)
   - Сохраните

3. **Перезапустите деплой**
   - Deployments → последний деплой → Redeploy

## 🔒 Безопасность

- **НЕ храните пароли в коде**
- **НЕ коммитьте пароли в Git**
- Используйте Environment Variables в Vercel
- Пароль виден только при первом создании/сбросе - сохраните его сразу

## ❓ Что делать, если пароль забыт?

1. Откройте Supabase Dashboard
2. Settings → Database
3. Database password → **Reset database password**
4. Скопируйте новый пароль
5. Обновите `DATABASE_URL` в Vercel Environment Variables
6. Перезапустите деплой

## 📝 Пример правильного connection string

Connection string из Supabase Dashboard будет выглядеть примерно так:

```
postgresql://postgres.hduadapicktrcrqjvzvd:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Где `[YOUR_PASSWORD]` - это ваш пароль, уже правильно URL-encoded.

**ВАЖНО:** Используйте connection string ТОЧНО как показано в Supabase Dashboard, не редактируйте его вручную!



