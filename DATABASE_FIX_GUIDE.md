# 🔧 Руководство по исправлению подключения к базе данных

## 🔍 Обнаруженные проблемы

### 1. ❌ Неправильный provider в schema.prisma
**Проблема:** В `schema.prisma` был указан `provider = "sqlite"`, но для Vercel нужен PostgreSQL.

**Исправлено:** ✅ Schema обновлен на `provider = "postgresql"` с использованием `env("DATABASE_URL")`

### 2. ⚠️ Возможная проблема с форматом DATABASE_URL
**Проблема:** Supabase требует использования **Connection Pooler** (порт 6543), а не прямого подключения (порт 5432).

**Проверьте:** Формат вашего `DATABASE_URL` в Vercel Environment Variables.

---

## ✅ Что было исправлено

1. ✅ Обновлен `prisma/schema.prisma` для использования PostgreSQL
2. ✅ Создан скрипт `scripts/prepare-vercel-schema.js` для автоматического переключения
3. ✅ Обновлен `vercel.json` для использования скрипта при сборке

---

## 🔍 Проверка переменных окружения

### Шаг 1: Проверьте формат DATABASE_URL

**❌ НЕПРАВИЛЬНО (прямое подключение):**
```
postgresql://postgres:password@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```
Это **НЕ РАБОТАЕТ** на Vercel!

**✅ ПРАВИЛЬНО (Connection Pooler):**
```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
```

**Ключевые отличия:**
- ✅ Порт **6543** (не 5432)
- ✅ Домен содержит **pooler.supabase.com** (не db.xxx.supabase.co)
- ✅ Параметр **pgbouncer=true**
- ✅ Username: **postgres.[PROJECT-ID]** (не просто postgres)

---

### Шаг 2: Как получить правильный Connection String

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Settings** → **Database**
4. Найдите раздел **"Connection string"**
5. **ВАЖНО:** Выберите вкладку **"Connection pooling"** (НЕ "URI"!)
6. Выберите режим: **"Session mode"** или **"Transaction mode"**
7. Скопируйте connection string
8. Замените `[YOUR-PASSWORD]` на реальный пароль
9. Добавьте `&schema=public` в конец (если его нет)

**Пример правильного формата:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
```

**Примечание:** Если пароль содержит специальные символы (например, `!`), может потребоваться URL-encoding:
- `!` → `%21`
- `@` → `%40`
- `#` → `%23`
- и т.д.

---

### Шаг 3: Обновите переменные в Vercel

#### Через Vercel Dashboard:
1. Перейдите в [Vercel Dashboard](https://vercel.com/dashboard)
2. Выберите проект **lavsit-textile**
3. Перейдите в **Settings** → **Environment Variables**
4. Найдите `DATABASE_URL`
5. Нажмите **Edit**
6. Вставьте правильный connection string (с pooler)
7. Сохраните
8. **Перезапустите деплой** (или дождитесь автоматического перезапуска)

#### Через Vercel CLI:
```bash
# Удалите старую переменную
vercel env rm DATABASE_URL production

# Добавьте новую с правильным форматом
vercel env add DATABASE_URL production
# Вставьте правильный connection string при запросе
```

---

## 🧪 Проверка после исправления

### 1. Проверьте API endpoint:
```bash
curl https://lavsit-textile.vercel.app/api/test-db
```

**Ожидаемый результат:**
```json
{
  "success": true,
  "message": "База данных доступна",
  "tablesCount": 7,
  "tables": ["Supplier", "Fabric", "ParsingRule", ...],
  "hasRequiredTables": {
    "Supplier": true,
    "Fabric": true,
    ...
  }
}
```

### 2. Проверьте логи Vercel:
```bash
vercel logs https://lavsit-textile.vercel.app --token [YOUR_TOKEN]
```

Ищите сообщения:
- ✅ `[Prisma] ✅ Используется Connection Pooler (pgbouncer)`
- ❌ `[Prisma] ❌ ОБНАРУЖЕНО ПРЯМОЕ ПОДКЛЮЧЕНИЕ!`

---

## 📋 Чеклист исправления

- [ ] Schema обновлен на PostgreSQL (✅ уже сделано)
- [ ] Скрипт prepare-vercel-schema.js создан (✅ уже сделано)
- [ ] DATABASE_URL использует Connection Pooler (порт 6543)
- [ ] DATABASE_URL содержит `pgbouncer=true`
- [ ] DATABASE_URL содержит `schema=public`
- [ ] Username в формате `postgres.[PROJECT-ID]`
- [ ] Пароль правильно закодирован (URL-encoding если нужно)
- [ ] Переменные обновлены в Vercel Dashboard
- [ ] Деплой перезапущен
- [ ] API endpoint `/api/test-db` возвращает success: true

---

## 🆘 Если проблема не решена

### Проверьте логи Prisma:
В логах Vercel должны быть сообщения от Prisma с диагностикой. Ищите:
- `[Prisma] DATABASE_URL preview:`
- `[Prisma] Детальная диагностика DATABASE_URL:`
- `[Prisma] ❌` или `[Prisma] ✅`

### Возможные проблемы:

1. **"Can't reach database server"**
   - Проверьте, что база данных активна в Supabase Dashboard
   - Проверьте, что используете Connection Pooler (не прямое подключение)

2. **"relation does not exist"**
   - Миграции не применены
   - Примените миграции через Supabase SQL Editor или API endpoint

3. **"Invalid connection string"**
   - Проверьте формат DATABASE_URL
   - Убедитесь, что пароль правильно закодирован

4. **"Connection timeout"**
   - Используйте Connection Pooler (порт 6543)
   - Проверьте, что база данных не в режиме паузы

---

## 🔄 Альтернативное решение: Vercel Postgres

Если проблемы с Supabase продолжаются, рассмотрите переход на **Vercel Postgres**:

1. В Vercel Dashboard → ваш проект → **Storage** → **Create Database** → **Postgres**
2. После создания, `DATABASE_URL` автоматически добавится
3. Примените миграции
4. Готово!

**Преимущества:**
- ✅ Автоматическая настройка
- ✅ Оптимизировано для Vercel
- ✅ Нет проблем с connection pooling
- ✅ Бесплатный тариф: 256MB

---

## 📚 Дополнительные ресурсы

- [Supabase Connection Pooling Guide](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Prisma PostgreSQL Connection](https://www.prisma.io/docs/concepts/database-connectors/postgresql)

---

**После исправления всех пунктов чеклиста, база данных должна подключиться успешно!** 🚀

