# Какой тип Connection Pooling выбрать для Vercel

## ✅ Рекомендуемые настройки

### 1. Transaction pooler (рекомендуется для Vercel)

**Почему Transaction pooler:**
- ✅ Оптимизирован для serverless окружений (Vercel)
- ✅ Идеален для коротких транзакций
- ✅ Быстрое подключение и отключение
- ✅ Меньше overhead для serverless функций

**Настройки в Supabase Dashboard:**
- **Type:** `URI` или `Node.js` (оба подойдут, но `URI` проще)
- **Transaction pooler:** ✅ Выбрать
- **Session pooler:** ❌ Не выбирать (для serverless не оптимален)

### 2. Session pooler (альтернатива)

**Когда использовать:**
- Если нужны долгие сессии
- Если используются PREPARE statements
- Для обычных серверов (не serverless)

**Для Vercel:** Не рекомендуется, так как serverless функции короткоживущие.

## 📋 Пошаговая инструкция

### В Supabase Dashboard:

1. **Settings → Database → Connection string**

2. **Выберите "Connection pooling"** (не "Direct connection"!)

3. **Выберите "Transaction pooler"** (не "Session pooler")

4. **Type:** Выберите `URI` (проще всего) или `Node.js`

5. **Скопируйте connection string**

6. **Добавьте параметры** (если их нет):
   ```
   ?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
   ```

### Пример правильного connection string:

```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 🔍 Разница между типами

### Transaction pooler
- **Порт:** 6543
- **Режим:** Transaction mode
- **Использование:** Serverless, короткие транзакции
- **Поддержка PREPARE:** ❌ Нет
- **Для Vercel:** ✅ Рекомендуется

### Session pooler
- **Порт:** 6543
- **Режим:** Session mode
- **Использование:** Долгие сессии, PREPARE statements
- **Поддержка PREPARE:** ✅ Да
- **Для Vercel:** ⚠️ Можно, но не оптимально

## ⚠️ Важно

1. **НЕ используйте "Direct connection"** - не работает на Vercel
2. **НЕ используйте порт 5432** - только 6543 для pooler
3. **Обязательно добавьте параметры** (`pgbouncer=true`, `schema=public`, и т.д.)
4. **После изменения пересоберите проект** на Vercel

## ✅ Итоговые настройки

**В Supabase Dashboard:**
- ✅ Connection pooling (не Direct)
- ✅ Transaction pooler (не Session)
- ✅ Type: URI (или Node.js)
- ✅ Скопировать connection string
- ✅ Добавить параметры

**На Vercel:**
- ✅ Вставить connection string в DATABASE_URL
- ✅ Выбрать все окружения (Production, Preview, Development)
- ✅ Сохранить
- ✅ Пересобрать проект

## 📝 Чеклист

- [ ] Выбран "Connection pooling" (не Direct)
- [ ] Выбран "Transaction pooler" (не Session)
- [ ] Type: URI или Node.js
- [ ] Connection string содержит `pooler.supabase.com`
- [ ] Порт: 6543 (не 5432)
- [ ] Добавлены параметры (`pgbouncer=true`, `schema=public`, и т.д.)
- [ ] DATABASE_URL обновлен на Vercel
- [ ] Проект пересобран

