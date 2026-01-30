# Решения проблемы "Circuit breaker open"

## Текущая проблема
```
FATAL: Circuit breaker open: Too many authentication errors
```

Это означает, что Supabase временно заблокировал подключения из-за множественных неудачных попыток аутентификации.

## ✅ Выполненные действия

1. ✅ Обновлен `.env.local` с правильным паролем (без URL-кодирования)
2. ✅ Dev сервер перезапущен
3. ✅ Проверены различные варианты подключения

## 🔧 Варианты решения

### Вариант 1: Подождать сброса circuit breaker (РЕКОМЕНДУЕТСЯ)

Circuit breaker в Supabase автоматически сбрасывается через **5-10 минут** после последней неудачной попытки.

**Действия:**
1. Подождите 10-15 минут
2. Проверьте подключение: http://localhost:4002/suppliers
3. Если ошибка сохраняется, переходите к варианту 2

### Вариант 2: Проверить правильность пароля

Убедитесь, что пароль в `.env.local` точно соответствует паролю из Supabase:

```env
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Проверка:**
1. Откройте Supabase Dashboard
2. Settings → Database
3. Сравните пароль в connection string

### Вариант 3: Использовать прямое подключение (временно)

Если pooler заблокирован, можно временно использовать прямое подключение:

```env
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.supabase.co:5432/postgres?schema=public&connect_timeout=30&sslmode=require
```

**⚠️ Внимание:** Прямое подключение не рекомендуется для production, но может помочь обойти circuit breaker.

### Вариант 4: Сбросить пароль в Supabase

Если проблема сохраняется:

1. Откройте Supabase Dashboard
2. Settings → Database → Reset Database Password
3. Обновите `.env.local` с новым паролем
4. Перезапустите сервер

### Вариант 5: Проверить другие источники подключений

Убедитесь, что нет других процессов, которые пытаются подключиться с неправильным паролем:

```powershell
# Проверить все процессы Node.js
Get-Process -Name node | Select-Object Id, ProcessName, StartTime

# Остановить все процессы Node.js (осторожно!)
Get-Process -Name node | Stop-Process -Force
```

## 📋 Чеклист для диагностики

- [ ] Подождали 10-15 минут после последней ошибки
- [ ] Проверили правильность пароля в `.env.local`
- [ ] Перезапустили dev сервер полностью
- [ ] Проверили, что нет других процессов с неправильным паролем
- [ ] Проверили Supabase Dashboard на наличие проблем

## 🔍 Проверка подключения

После ожидания, проверьте подключение:

```powershell
# Проверить через API
Invoke-WebRequest -Uri "http://localhost:4002/api/test-db" -UseBasicParsing

# Или открыть в браузере
# http://localhost:4002/suppliers
```

## 📞 Если проблема сохраняется

1. Проверьте логи Supabase Dashboard
2. Убедитесь, что проект не находится в режиме паузы
3. Проверьте настройки firewall/сети
4. Попробуйте создать новый проект Supabase для тестирования

