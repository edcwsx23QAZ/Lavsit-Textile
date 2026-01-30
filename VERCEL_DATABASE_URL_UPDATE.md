# ⚠️ ВАЖНО: Обновление DATABASE_URL на Vercel

## 🔴 Критическое обновление

После исправления проблемы с подключением к базе данных, **ОБЯЗАТЕЛЬНО** обновите переменную окружения `DATABASE_URL` на Vercel!

## ❌ Старый формат (НЕ РАБОТАЕТ):
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## ✅ Новый формат (РАБОТАЕТ):
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=public&connect_timeout=30&sslmode=require
```

## 📝 Изменения:
- ❌ Удален параметр `pgbouncer=true`
- ❌ Удален параметр `pool_timeout=30`
- ✅ Оставлены только необходимые параметры

## 🔧 Как обновить на Vercel:

### Вариант 1: Через Vercel Dashboard
1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите переменную `DATABASE_URL`
5. Нажмите **Edit** или **Remove** и создайте заново
6. Вставьте новый формат (без `pgbouncer=true`)
7. Сохраните изменения
8. Перезапустите деплоймент (Redeploy)

### Вариант 2: Через Vercel CLI
```bash
vercel env rm DATABASE_URL production
vercel env add DATABASE_URL production
# Вставьте новый формат при запросе
```

### Вариант 3: Через API (если есть скрипт)
Используйте существующий скрипт для обновления переменных окружения.

## ✅ После обновления:

1. Перезапустите деплоймент на Vercel
2. Проверьте логи деплоя на наличие ошибок подключения к БД
3. Проверьте работу приложения: https://lavsit-textile.vercel.app/suppliers

## 🔍 Проверка:

После обновления проверьте, что:
- ✅ Деплоймент прошел успешно
- ✅ Нет ошибок "Circuit breaker open"
- ✅ Нет ошибок "Authentication failed"
- ✅ Страница `/suppliers` загружается без ошибок БД

## 📌 Важно:

- Параметр `pgbouncer=true` вызывал проблемы с подключением
- Prisma автоматически определяет режим pooler по порту 6543
- Не нужно явно указывать `pgbouncer=true` в connection string

