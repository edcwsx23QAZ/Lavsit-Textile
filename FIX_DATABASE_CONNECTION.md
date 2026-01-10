# Исправление подключения к базе данных

## Проблема

Все страницы кроме главной выдают ошибку:
```
База данных недоступна
Не удалось подключиться к базе данных. Пожалуйста, проверьте настройки подключения.
```

## Причины

1. **Миграции не применены** - таблицы не существуют в базе данных (самая вероятная причина)
2. **Неправильный DATABASE_URL** - пароль содержит специальный символ `!`, который требует URL-encoding

## Решение

### Шаг 1: Применение миграций через Supabase SQL Editor

**ВАЖНО:** Это критически важно! Без применения миграций база данных не будет работать.

1. Откройте https://supabase.com/dashboard/project/hduadapicktrcrqjvzvd
2. Перейдите в **SQL Editor** в левом меню
3. Нажмите **"New Query"**
4. Откройте файл `prisma/migrations/init_postgresql/migration.sql` в вашем проекте
5. **Скопируйте весь SQL скрипт** из файла (все 143 строки)
6. Вставьте SQL скрипт в SQL Editor
7. Нажмите **"Run"** или `Ctrl+Enter` / `Cmd+Enter`
8. Дождитесь успешного выполнения (должно появиться "Success. No rows returned" или подобное сообщение)

### Шаг 2: Проверка таблиц

После применения миграций проверьте, что таблицы созданы:

В Supabase SQL Editor выполните:
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

### Шаг 3: Проверка подключения через Vercel

1. После применения миграций, подождите 1-2 минуты для применения изменений
2. Откройте: `https://lavsit-textile.vercel.app/api/test-db`
3. Должен вернуться JSON:
   ```json
   {
     "success": true,
     "message": "База данных доступна",
     "tablesCount": 7,
     "tables": ["Supplier", "Fabric", ...],
     "hasRequiredTables": {
       "Supplier": true,
       "Fabric": true,
       ...
     }
   }
   ```

Если все еще ошибка, выполните redeploy на Vercel:

```bash
vercel --prod --token R7r2N1maVjii1BkkRQvidtls --yes
```

### Шаг 4: Проверка работы страниц

После применения миграций и проверки подключения:

1. Откройте `/categories` - должна загрузиться без ошибок
2. Откройте `/fabrics` - должна загрузиться без ошибок
3. Откройте `/suppliers` - должна загрузиться без ошибок
4. Откройте `/palette` - должна загрузиться без ошибок

## Что было исправлено

✅ **DATABASE_URL обновлен** - пароль теперь правильно URL-encoded (`edcwsx123QAZ%21` вместо `edcwsx123QAZ!`)

✅ **Переменные окружения обновлены** - для всех сред (Production, Preview, Development)

⚠️ **Требуется применение миграций** - это критически важно! Без этого таблицы не будут существовать и подключение не будет работать.

## Альтернативный способ: Проверка через Supabase Dashboard

Если миграции уже применены, но подключение все еще не работает:

1. Откройте Supabase Dashboard → Settings → Database
2. Проверьте раздел **Connection Pooling**
3. Убедитесь, что **Connection string** правильный:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres
   ```
4. Проверьте раздел **Network Restrictions** - убедитесь, что нет ограничений по IP

## Если проблема сохраняется

Если после применения миграций проблема все еще сохраняется:

1. Проверьте логи Vercel:
   ```bash
   vercel logs https://lavsit-textile.vercel.app --token R7r2N1maVjii1BkkRQvidtls
   ```

2. Проверьте, что DATABASE_URL правильно настроен в Vercel:
   ```bash
   vercel env ls --token R7r2N1maVjii1BkkRQvidtls
   ```

3. Убедитесь, что база данных действительно активна в Supabase Dashboard (все показатели должны быть зелеными)

4. Проверьте, что миграции применены - таблицы должны быть видны в **Table Editor** в Supabase Dashboard


