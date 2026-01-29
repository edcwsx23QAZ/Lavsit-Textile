# Промпт для решения проблемы с базой данных на Vercel

## Контекст проекта

**Проект**: lavsit-textile
**Расположение**: E:\Work programs\cursor\repositary\lavsit-textile
**GitHub**: https://github.com/edcwsx23QAZ/Lavsit-Textile.git
**Vercel**: https://lavsit-textile.vercel.app

## Проблема

На Vercel страницы не работают из-за ошибки подключения к базе данных:
- Ошибка: `FATAL: Tenant or user not found`
- Health endpoint: `https://lavsit-textile.vercel.app/api/health` показывает `"connected": false`
- DATABASE_URL настроен в Vercel (`hasDatabaseUrl: true`, `databaseUrlType: "postgresql"`, `databaseUrlValid: true`)
- Но подключение не работает

## Технические детали

- **База данных**: Supabase PostgreSQL
- **Project ID**: `hduadapicktrcrqjvzvd`
- **Пароль**: `edcwsx123QAZ!` (должен быть URL-encoded как `edcwsx123QAZ%21`)
- **Регион**: `aws-0-us-east-1`
- **Порт для pooler**: `6543`
- **Локально**: Работает с SQLite
- **На Vercel**: Должен работать с PostgreSQL через Connection Pooler

## Правильный формат connection string

```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QAZ%21@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## Что нужно сделать

1. Проверить текущий DATABASE_URL в Vercel Environment Variables
2. Убедиться, что connection string правильный (пароль URL-encoded, правильный формат для pooler)
3. Проверить, что миграции применены в Supabase
4. Исправить проблему и задеплоить

## Важные файлы

- `prisma/schema.prisma` - схема базы данных (SQLite локально, PostgreSQL на Vercel)
- `scripts/prepare-vercel-schema.js` - скрипт переключения схемы для Vercel
- `lib/db/prisma.ts` - инициализация Prisma Client
- `lib/db/safe-query.ts` - безопасные запросы к БД
- `app/api/health/route.ts` - health check endpoint

## Ограничения

- НЕ путать с проектом `lavsit-russia-delivery` - работаем ТОЛЬКО с `lavsit-textile`
- SQLite не работает на Vercel (read-only файловая система)
- Нужно использовать PostgreSQL Connection Pooler для Vercel



