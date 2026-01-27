# 📋 Environment Variables для связки Vercel + Supabase

Полный список всех переменных окружения, необходимых для работы проекта Lavsit Textile на Vercel с базой данных Supabase.

---

## 🔴 ОБЯЗАТЕЛЬНЫЕ переменные (Required)

### 1. DATABASE_URL
**Описание:** Строка подключения к PostgreSQL базе данных Supabase для серверных операций и миграций.

**Формат:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres?schema=public
```

**Как получить:**
1. Перейдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Database**
4. Найдите раздел **"Connection string"**
5. Выберите вкладку **"URI"**
6. Скопируйте строку подключения
7. **Важно:** Замените `[YOUR-PASSWORD]` на реальный пароль базы данных
8. Добавьте `?schema=public` в конец строки (если его нет)

**Пример:**
```
DATABASE_URL=postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```

**Примечание:** Если пароль содержит специальные символы (например, `!`), может потребоваться URL-encoding (`!` → `%21`), но Prisma обычно обрабатывает это автоматически.

---

### 2. NEXT_PUBLIC_SUPABASE_URL
**Описание:** URL проекта Supabase для клиентской аутентификации и API вызовов.

**Формат:**
```
https://[PROJECT-ID].supabase.co
```

**Как получить:**
1. Перейдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **API**
4. Найдите раздел **"Project URL"**
5. Скопируйте URL

**Пример:**
```
NEXT_PUBLIC_SUPABASE_URL=https://hduadapicktrcrqjvzvd.supabase.co
```

**Важно:** Префикс `NEXT_PUBLIC_` означает, что эта переменная будет доступна в браузере (клиентском коде).

---

### 3. NEXT_PUBLIC_SUPABASE_ANON_KEY
**Описание:** Публичный (анонимный) ключ Supabase для клиентской аутентификации.

**Формат:** Длинная строка (JWT токен)

**Как получить:**
1. Перейдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **API**
4. Найдите раздел **"Project API keys"**
5. Найдите ключ с меткой **"anon" "public"**
6. Нажмите кнопку **"Reveal"** или **"Copy"**
7. Скопируйте ключ

**Пример:**
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq
```

**Важно:** 
- Этот ключ безопасен для использования в клиентском коде
- Он имеет ограниченные права доступа (согласно Row Level Security политикам)

---

## 🟡 РЕКОМЕНДУЕМЫЕ переменные (Recommended)

### 4. SUPABASE_SERVICE_ROLE_KEY
**Описание:** Секретный ключ сервисной роли Supabase для серверных операций с полными правами доступа.

**Формат:** Длинная строка (JWT токен)

**Как получить:**
1. Перейдите в [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **API**
4. Найдите раздел **"Project API keys"**
5. Найдите ключ с меткой **"service_role" "secret"**
6. Нажмите кнопку **"Reveal"** или **"Copy"**
7. Скопируйте ключ

**Пример:**
```
SUPABASE_SERVICE_ROLE_KEY=sb_secret_Nmrfz9rwXqnrD8TEkQlA_5dm3YIkp
```

**Важно:** 
- ⚠️ **НИКОГДА** не используйте этот ключ в клиентском коде!
- Этот ключ имеет полные права доступа к базе данных
- Используйте его только для серверных операций (API routes, миграции)
- Храните его только в переменных окружения сервера

**Использование:**
- Применение миграций через Supabase API
- Серверные операции, требующие полных прав доступа
- Обход Row Level Security политик (если необходимо)

---

## 🟢 ОПЦИОНАЛЬНЫЕ переменные (Optional)

### 5. MIGRATION_SECRET_KEY
**Описание:** Секретный ключ для защиты API endpoint `/api/apply-migrations` и `/api/migrate`.

**Формат:** Любая строка (рекомендуется использовать случайную длинную строку)

**Как создать:**
```bash
# Генерация случайного ключа (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Или используйте любой генератор случайных строк
```

**Пример:**
```
MIGRATION_SECRET_KEY=your-secret-migration-key-here-12345
```

**Использование:**
- Защита API endpoints для применения миграций
- Используется в заголовке `Authorization: Bearer [KEY]` при вызове миграционных endpoints

**Как добавить в Vercel:**
```bash
vercel env add MIGRATION_SECRET_KEY production --token [YOUR_VERCEL_TOKEN]
```

---

### 6. EMAIL_CHECKER_API_KEY
**Описание:** API ключ для защиты endpoint `/api/jobs/check-emails`.

**Формат:** Любая строка

**Пример:**
```
EMAIL_CHECKER_API_KEY=your-email-checker-api-key-here
```

**Использование:**
- Защита API endpoint для проверки email
- Используется для аутентификации запросов к email checker

---

## 📝 Полный пример конфигурации

### Для локальной разработки (.env.local)
```env
# Database Configuration (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public"
NEXT_PUBLIC_SUPABASE_URL="https://hduadapicktrcrqjvzvd.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_ilEL1_gyNIxzQCskLJtjNA_2a1iArsq"

# Supabase Service Role (для серверных операций)
SUPABASE_SERVICE_ROLE_KEY="sb_secret_Nmrfz9rwXqnrD8TEkQlA_5dm3YIkp"

# Migration Security (опционально)
MIGRATION_SECRET_KEY="your-secret-migration-key-here"

# Email Checker (опционально)
EMAIL_CHECKER_API_KEY="your-email-checker-api-key-here"
```

### Для Vercel (Environment Variables)

Добавьте все переменные в Vercel Dashboard:
1. Перейдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект **lavsit-textile**
3. Перейдите в **Settings** → **Environment Variables**
4. Добавьте каждую переменную:
   - **Key:** Имя переменной (например, `DATABASE_URL`)
   - **Value:** Значение переменной
   - **Environment:** Выберите `Production`, `Preview`, `Development` (или все)

**Или через CLI:**
```bash
# Установите Vercel CLI (если еще не установлен)
npm install -g vercel

# Авторизуйтесь
vercel login

# Добавьте переменные окружения
vercel env add DATABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production

# Опционально
vercel env add MIGRATION_SECRET_KEY production
vercel env add EMAIL_CHECKER_API_KEY production
```

---

## 🔍 Проверка настроенных переменных

### Проверить переменные в Vercel через CLI:
```bash
vercel env ls
```

### Проверить переменные в Vercel через Dashboard:
1. Перейдите в **Settings** → **Environment Variables**
2. Убедитесь, что все обязательные переменные присутствуют

### Проверить подключение к базе данных:
```bash
# Через API endpoint (если настроен)
curl https://lavsit-textile.vercel.app/api/test-db
```

---

## ⚠️ Важные замечания

### Безопасность:
1. **НИКОГДА** не коммитьте файлы `.env` или `.env.local` в Git
2. **НИКОГДА** не используйте `SUPABASE_SERVICE_ROLE_KEY` в клиентском коде
3. Используйте `NEXT_PUBLIC_*` переменные только для данных, безопасных для публикации
4. Храните секретные ключи только в переменных окружения сервера

### Формат DATABASE_URL:
- Обязательно добавьте `?schema=public` в конец строки подключения
- Если пароль содержит специальные символы, может потребоваться URL-encoding
- Используйте формат URI (не Session mode)

### Переменные с префиксом NEXT_PUBLIC_:
- Эти переменные доступны в браузере (клиентском коде)
- Используйте их только для публичных данных
- Не храните секретные ключи в переменных с префиксом `NEXT_PUBLIC_`

### После добавления переменных:
1. Перезапустите приложение на Vercel (или дождитесь автоматического перезапуска)
2. Проверьте логи на наличие ошибок подключения
3. Убедитесь, что миграции применены к базе данных

---

## 📚 Дополнительные ресурсы

- [Supabase Documentation](https://supabase.com/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Prisma Connection Strings](https://www.prisma.io/docs/concepts/database-connectors/postgresql#connection-details)

---

## ✅ Чеклист настройки

- [ ] `DATABASE_URL` настроен в Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_URL` настроен в Vercel
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` настроен в Vercel
- [ ] `SUPABASE_SERVICE_ROLE_KEY` настроен в Vercel (рекомендуется)
- [ ] `MIGRATION_SECRET_KEY` настроен в Vercel (опционально)
- [ ] `EMAIL_CHECKER_API_KEY` настроен в Vercel (опционально)
- [ ] Все переменные добавлены для окружения `Production`
- [ ] Все переменные добавлены для окружения `Preview` (если нужно)
- [ ] Проверено подключение к базе данных через `/api/test-db`
- [ ] Миграции применены к базе данных

---

**Готово!** После настройки всех переменных окружения проект должен корректно работать на Vercel с базой данных Supabase. 🚀

