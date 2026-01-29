# 🔴 СРОЧНО: Исправление значения DATABASE_URL

## Проблема

В поле "Value" на Vercel есть префикс `DATABASE_URL=` перед connection string.

**Текущее значение (неправильно):**
```
DATABASE_URL=postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## ✅ Исправление

### Уберите `DATABASE_URL=` из начала значения!

**Правильное значение:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 🔧 Что сделать

1. В поле "Value" **удалите** `DATABASE_URL=` в начале
2. Оставьте **только** connection string (начинается с `postgresql://`)
3. Сохраните изменения
4. Пересоберите проект

## 📋 Пошаговая инструкция

1. **В поле "Value"** должно быть:
   ```
   postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
   ```

2. **НЕ должно быть:**
   ```
   DATABASE_URL=postgresql://...
   ```

3. Сохраните и пересоберите проект

