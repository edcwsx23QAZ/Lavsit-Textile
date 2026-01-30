# 🚀 Инструкция по деплою на Vercel

## ✅ Выполнено

1. ✅ Изменения закоммичены и запушены в GitHub
2. ✅ Vercel автоматически начал деплоймент после push
3. ✅ Создан скрипт для обновления DATABASE_URL

## ⚠️ КРИТИЧЕСКИ ВАЖНО: Обновить DATABASE_URL на Vercel

**Проблема была решена локально**, но на Vercel нужно обновить переменную окружения `DATABASE_URL` с правильным форматом.

### ❌ Старый формат (вызывает ошибки):
```
postgresql://...?pgbouncer=true&schema=public&...
```

### ✅ Новый формат (работает):
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=public&connect_timeout=30&sslmode=require
```

## 🔧 Варианты обновления

### Вариант 1: Автоматический (рекомендуется)

Если у вас установлен Vercel CLI:

```bash
npm run vercel:update-db-url
```

Или напрямую:

```bash
tsx scripts/update-vercel-database-url.ts
```

### Вариант 2: Через Vercel Dashboard

1. Откройте https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите переменную `DATABASE_URL`
5. Нажмите **Edit** или удалите и создайте заново
6. Вставьте новый формат (без `pgbouncer=true`):
   ```
   postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?schema=public&connect_timeout=30&sslmode=require
   ```
7. Убедитесь, что переменная добавлена для всех окружений:
   - ✅ Production
   - ✅ Preview
   - ✅ Development
8. Сохраните изменения
9. Перезапустите деплоймент (Redeploy)

### Вариант 3: Через Vercel CLI вручную

```bash
# Удалить старую переменную
vercel env rm DATABASE_URL production
vercel env rm DATABASE_URL preview
vercel env rm DATABASE_URL development

# Добавить новую переменную
vercel env add DATABASE_URL production
# Вставьте новый формат при запросе

vercel env add DATABASE_URL preview
# Вставьте новый формат при запросе

vercel env add DATABASE_URL development
# Вставьте новый формат при запросе
```

## ✅ После обновления

1. **Перезапустите деплоймент:**
   - В Vercel Dashboard → Deployments
   - Найдите последний деплоймент
   - Нажмите "..." → "Redeploy"

2. **Проверьте логи деплоя:**
   - Убедитесь, что нет ошибок подключения к БД
   - Проверьте, что нет ошибок "Circuit breaker open"
   - Проверьте, что нет ошибок "Authentication failed"

3. **Проверьте работу приложения:**
   - Откройте https://lavsit-textile.vercel.app/suppliers
   - Убедитесь, что страница загружается без ошибок БД

## 📋 Чеклист

- [ ] DATABASE_URL обновлен на Vercel (без `pgbouncer=true`)
- [ ] Переменная добавлена для всех окружений (Production, Preview, Development)
- [ ] Деплоймент перезапущен (Redeploy)
- [ ] Логи деплоя проверены (нет ошибок БД)
- [ ] Приложение работает (страница `/suppliers` загружается)

## 🔍 Проверка статуса деплоя

Проверить статус деплоя можно через:

```bash
npm run vercel:status
```

Или в Vercel Dashboard:
- https://vercel.com/dashboard
- Выберите проект → Deployments

## 📝 Дополнительная информация

Подробная документация:
- `VERCEL_DATABASE_URL_UPDATE.md` - детальная инструкция по обновлению
- `DATABASE_FIX_COMPLETE.md` - описание проблемы и решения

## 🆘 Если что-то пошло не так

1. Проверьте логи деплоя на Vercel
2. Убедитесь, что DATABASE_URL обновлен правильно
3. Проверьте, что пароль в URL соответствует паролю в Supabase Dashboard
4. Убедитесь, что проект Supabase не находится в режиме паузы

