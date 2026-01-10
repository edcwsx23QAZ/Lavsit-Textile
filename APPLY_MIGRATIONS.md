# Применение миграций к базе данных Supabase

## Проблема

База данных Supabase недоступна локально из-за ограничений сети/IP whitelist. Миграции нужно применить через Supabase Dashboard.

## Решение: Применение миграций через Supabase SQL Editor

### Шаг 1: Откройте Supabase SQL Editor

1. Перейдите на https://supabase.com/dashboard
2. Выберите проект **Lavsit Textile** (ID: `hduadapicktrcrqjvzvd`)
3. Перейдите в раздел **SQL Editor** в левом меню
4. Нажмите **"New Query"**

### Шаг 2: Примените миграции

1. Скопируйте содержимое файла `prisma/migrations/init_postgresql/migration.sql`
2. Вставьте SQL скрипт в SQL Editor
3. Нажмите **"Run"** или `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
4. Дождитесь выполнения миграций (должно появиться сообщение "Success. No rows returned")

### Шаг 3: Проверьте таблицы

После применения миграций проверьте, что таблицы созданы:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Должны быть следующие таблицы:
- Supplier
- Fabric
- ParsingRule
- DataStructure
- EmailAttachment
- FabricCategory
- ManualUpload

## Альтернативный способ: Через Vercel API

После применения миграций через SQL Editor, можно проверить подключение через API endpoint:

### 1. Проверка подключения

```bash
curl https://lavsit-textile.vercel.app/api/test-db
```

Должен вернуть:
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

### 2. Применение миграций через API (если нужно)

Если нужно применить миграции через API (требует MIGRATION_SECRET_KEY):

1. Создайте переменную окружения в Vercel:
   ```bash
   vercel env add MIGRATION_SECRET_KEY production --token R7r2N1maVjii1BkkRQvidtls
   # Введите секретный ключ при запросе
   ```

2. Вызовите API endpoint:
   ```bash
   curl -X POST https://lavsit-textile.vercel.app/api/migrate \
     -H "Authorization: Bearer YOUR_SECRET_KEY"
   ```

## Текущее состояние

✅ **База данных активна** - все показатели базы данных Supabase активны

✅ **Переменные окружения настроены** - DATABASE_URL и другие переменные настроены в Vercel

⚠️ **Миграции требуют применения** - миграции нужно применить через Supabase SQL Editor

⚠️ **Локальное подключение недоступно** - из-за ограничений сети/IP whitelist. Это нормально для Supabase Free tier.

## После применения миграций

После успешного применения миграций:

1. Проверьте подключение через API: `https://lavsit-textile.vercel.app/api/test-db`
2. Проверьте работу страниц:
   - `/categories` - должна загрузиться без ошибок
   - `/fabrics` - должна загрузиться без ошибок
   - `/suppliers` - должна загрузиться без ошибок
   - `/palette` - должна загрузиться без ошибок

## Connection String

**Direct connection (для Vercel):**
```
postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```

**Connection Pooling (если нужно):**
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ!@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
```

**Примечание:** Сейчас используется direct connection (порт 5432) для Vercel, что должно работать, так как Vercel использует динамические IP адреса, которые обычно разрешены Supabase по умолчанию.


