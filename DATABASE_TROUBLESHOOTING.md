# Диагностика и исправление проблем с базой данных

## Проблема

На всех страницах, кроме главной, появляется ошибка:
```
Что-то пошло не так!
An error occurred in the Server Components render.
```

## Причины

Скорее всего, база данных Supabase недоступна по одной из следующих причин:

1. **База данных в режиме паузы** (Free tier)
2. **Миграции не применены** к базе данных
3. **Неправильный DATABASE_URL** в переменных окружения
4. **Проблемы с сетью** или firewall

## Решение

### 1. Проверьте статус базы данных Supabase

1. Перейдите на https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Проверьте статус базы данных:
   - Если база данных в режиме паузы, нажмите "Resume" или "Restore"
   - Дождитесь полной активации базы данных (может занять несколько минут)

### 2. Примените миграции к базе данных

#### Вариант A: Через Supabase SQL Editor

1. Перейдите в **SQL Editor** в Supabase Dashboard
2. Скопируйте содержимое файла `prisma/migrations/init_postgresql/migration.sql`
3. Выполните SQL скрипт в SQL Editor

#### Вариант B: Через API endpoint (после активации базы данных)

1. Убедитесь, что база данных активна
2. Создайте переменную окружения `MIGRATION_SECRET_KEY` в Vercel:
   ```bash
   vercel env add MIGRATION_SECRET_KEY production --token R7r2N1maVjii1BkkRQvidtls
   ```
3. Вызовите API endpoint для применения миграций:
   ```bash
   curl -X POST https://lavsit-textile.vercel.app/api/migrate \
     -H "Authorization: Bearer YOUR_SECRET_KEY"
   ```

#### Вариант C: Локально (если база данных доступна локально)

```bash
cd "E:\Work programs\cursor\repositary\lavsit-textile"
$env:DATABASE_URL = "postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public"
npx prisma migrate deploy
```

### 3. Проверьте DATABASE_URL

Убедитесь, что `DATABASE_URL` правильно настроен в Vercel:

```bash
vercel env ls --token R7r2N1maVjii1BkkRQvidtls
```

Должен быть:
```
DATABASE_URL = postgresql://postgres:edcwsx123QAZ!@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```

### 4. Проверьте подключение к базе данных

После применения миграций, проверьте подключение:

1. Откройте любую страницу приложения (например, `/categories`)
2. Если база данных доступна и миграции применены, страница должна загрузиться
3. Если база данных недоступна, вы увидите информативное сообщение об ошибке

## Текущее состояние

✅ **Обработка ошибок добавлена** - все Server Components теперь корректно обрабатывают ошибки подключения к базе данных

✅ **Информативные сообщения об ошибках** - пользователи видят понятные сообщения вместо общих ошибок

⚠️ **База данных требуется** - для работы страниц необходимо, чтобы база данных Supabase была активна и миграции были применены

## Дополнительная информация

- **Главная страница работает** - она не использует базу данных (Client Component)
- **Остальные страницы требуют базу данных** - они используют Server Components с Prisma
- **API endpoints также требуют базу данных** - они обращаются к Prisma для выполнения запросов

