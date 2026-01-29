# 🔧 Настройка DATABASE_URL для Vercel - ПОШАГОВАЯ ИНСТРУКЦИЯ

## ⚠️ ВАЖНО: Используйте Connection Pooler!

**НЕ используйте** прямое подключение (порт 5432) - оно **НЕ РАБОТАЕТ** на Vercel!

## Шаг 1: Получите Connection String из Supabase

1. Откройте https://supabase.com/dashboard
2. Войдите в свой аккаунт
3. Выберите проект **hduadapicktrcrqjvzvd**
4. В левом меню нажмите **Settings** (⚙️)
5. Выберите **Database**
6. Прокрутите вниз до раздела **Connection string**
7. **ВАЖНО:** Выберите вкладку **Connection pooling** (НЕ "URI"!)
8. Выберите режим:
   - **Session mode** (рекомендуется)
   - Или **Transaction mode**
9. Нажмите кнопку **Copy** рядом с connection string
10. **Скопируйте весь connection string** - он будет выглядеть примерно так:

```
postgresql://postgres.hduadapicktrcrqjvzvd:[YOUR_PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## Шаг 2: Проверьте формат

Убедитесь, что connection string:
- ✅ Содержит `pooler.supabase.com` (НЕ `db.supabase.co`)
- ✅ Использует порт `6543` (НЕ `5432`)
- ✅ Содержит `pgbouncer=true`
- ✅ Username в формате `postgres.hduadapicktrcrqjvzvd` (НЕ просто `postgres`)

## Шаг 3: Настройте в Vercel

1. Откройте https://vercel.com/dashboard
2. Войдите в свой аккаунт
3. Найдите проект **lavsit-textile** и нажмите на него
4. В верхнем меню нажмите **Settings**
5. В левом меню выберите **Environment Variables**
6. Найдите переменную `DATABASE_URL` (если есть)
7. Если `DATABASE_URL` существует:
   - Нажмите на нее
   - Нажмите **Delete** (удалить)
   - Подтвердите удаление
8. Нажмите **Add New**
9. Заполните форму:
   - **Key**: `DATABASE_URL` (точно так, без пробелов)
   - **Value**: вставьте connection string из Supabase (весь, полностью)
   - **Environment**: выберите все три (Production, Preview, Development)
10. Нажмите **Save**

## Шаг 4: Перезапустите деплой

1. В Vercel Dashboard перейдите в **Deployments**
2. Найдите последний деплой
3. Нажмите на три точки (⋮) справа от деплоя
4. Выберите **Redeploy**
5. Подтвердите перезапуск

## Проверка

После деплоя проверьте:

1. **Health endpoint**: `https://lavsit-textile.vercel.app/api/health`
   - Должен показать `"database.connected": true`
   - `"databaseUrlPreview"` должен содержать `pooler.supabase.com:6543`

2. **Страницы**:
   - `https://lavsit-textile.vercel.app/suppliers` - должна работать
   - `https://lavsit-textile.vercel.app/fabrics` - должна работать

## Частые ошибки

### ❌ Ошибка: "Can't reach database server at db.hduadapicktrcrqjvzvd.supabase.co:5432"

**Причина:** Используется прямое подключение (порт 5432)

**Решение:** Используйте Connection Pooler connection string (порт 6543) из Supabase Dashboard

### ❌ Ошибка: "Tenant or user not found"

**Причина:** Неправильный пароль или формат connection string

**Решение:** 
- Получите connection string из Supabase Dashboard (Connection pooling)
- Не редактируйте его вручную
- Убедитесь, что пароль URL-encoded (Supabase делает это автоматически)

### ❌ Ошибка: Connection string не работает

**Причина:** Возможно, скопировали из раздела "URI" вместо "Connection pooling"

**Решение:** Используйте ТОЛЬКО connection string из раздела "Connection pooling"

## Разница между форматами

| Параметр | Прямое подключение ❌ | Connection Pooler ✅ |
|----------|----------------------|---------------------|
| Hostname | `db.hduadapicktrcrqjvzvd.supabase.co` | `aws-0-us-east-1.pooler.supabase.com` |
| Port | `5432` | `6543` |
| Username | `postgres` | `postgres.hduadapicktrcrqjvzvd` |
| Параметры | `schema=public` | `pgbouncer=true&schema=public` |
| Работает на Vercel | ❌ Нет | ✅ Да |

## Устранение проблем

### Чеклист проверки

Перед обращением за помощью проверьте:

- [ ] DATABASE_URL использует pooler (порт 6543, НЕ 5432)
- [ ] Hostname содержит `pooler.supabase.com` (НЕ `db.supabase.co`)
- [ ] Connection string содержит параметр `pgbouncer=true`
- [ ] Username в формате `postgres.hduadapicktrcrqjvzvd` (НЕ просто `postgres`)
- [ ] Миграции применены в Supabase (проверьте через health endpoint)
- [ ] База данных не в режиме паузы (проверьте в Supabase Dashboard)
- [ ] Connection Pooler включен в Supabase (должен быть включен по умолчанию)

### Диагностика через Health Endpoint

Откройте `https://lavsit-textile.vercel.app/api/health` и проверьте:

1. **databaseUrlDetails** - детальная информация о connection string:
   - `hostname` - должен быть `aws-0-us-east-1.pooler.supabase.com`
   - `port` - должен быть `6543`
   - `isPooler` - должен быть `true`
   - `isDirect` - должен быть `false`
   - `isValidForVercel` - должен быть `true`

2. **database.connected** - должно быть `true`

3. **database.migrations** - проверьте статус миграций:
   - `migrationsApplied` - должно быть `true`
   - `tablesExist` - должно быть `true`

### Диагностика через скрипт

Запустите скрипт проверки подключения:

```bash
npx tsx scripts/verify-vercel-connection.ts
```

Скрипт проверит:
- Формат DATABASE_URL
- Подключение к базе данных
- Наличие миграций
- Наличие таблиц

### Дополнительные проверки

1. **Проверка Supabase Dashboard:**
   - Убедитесь, что проект не в режиме паузы
   - Проверьте, что Connection Pooler включен
   - Проверьте правильность пароля базы данных

2. **Проверка Vercel Environment Variables:**
   - Убедитесь, что DATABASE_URL установлен для всех окружений (Production, Preview, Development)
   - Проверьте, что нет лишних пробелов или символов
   - Убедитесь, что connection string скопирован полностью

3. **Проверка логов деплоя:**
   - В логах деплоя должны быть сообщения о правильном формате connection string
   - Не должно быть ошибок о прямом подключении (порт 5432)

### Если ничего не помогает

1. **Сбросьте пароль базы данных:**
   - Supabase Dashboard → Settings → Database → Database password → Reset
   - Создайте новый connection string
   - Обновите DATABASE_URL в Vercel

2. **Проверьте миграции:**
   - Откройте Supabase Dashboard → SQL Editor
   - Выполните SQL из `prisma/migrations/init_postgresql/migration-fixed.sql`

3. **Проверьте Connection Pooler:**
   - Убедитесь, что Connection Pooler включен в Supabase
   - Попробуйте использовать Transaction mode вместо Session mode

4. **Обратитесь за помощью:**
   - Проверьте health endpoint: `/api/health`
   - Запустите скрипт диагностики: `npx tsx scripts/verify-vercel-connection.ts`
   - Сохраните логи деплоя и health endpoint для анализа

## Полезные ссылки

- Supabase Dashboard: https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
- Vercel Dashboard: https://vercel.com/dashboard
- Health Check: https://lavsit-textile.vercel.app/api/health
- Документация по миграциям: `prisma/migrations/init_postgresql/migration-fixed.sql`

