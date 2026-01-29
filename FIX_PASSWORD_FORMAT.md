# Исправление формата пароля в DATABASE_URL

## ❌ Проблема

В connection string используются квадратные скобки вокруг пароля:
```
postgresql://postgres.hduadapicktrcrqjvzvd:[увсцыч123ЙФЯ]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
```

**Квадратные скобки `[ ]` - это placeholder из документации Supabase!**
**В реальном connection string их НЕ должно быть!**

## ✅ Правильный формат

### Без квадратных скобок:

```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### ⚠️ Важно: URL-encoding для кириллицы

Пароль содержит кириллицу (`увсцыч123ЙФЯ`), которая может потребовать URL-encoding.

**Проверьте:**
- Если пароль работает без encoding - используйте как есть
- Если возникают ошибки аутентификации - используйте URL-encoded версию

**URL-encoded версия пароля:**
```
увсцыч123ЙФЯ → %D1%83%D0%B2%D1%81%D1%86%D1%8B%D1%87123%D0%99%D0%A4%D0%AF
```

**Connection string с URL-encoded паролем:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:%D1%83%D0%B2%D1%81%D1%86%D1%8B%D1%87123%D0%99%D0%A4%D0%AF@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 📋 Пошаговая инструкция

### Шаг 1: Уберите квадратные скобки

**Неправильно:**
```
[увсцыч123ЙФЯ]
```

**Правильно:**
```
увсцыч123ЙФЯ
```

### Шаг 2: Добавьте параметры (согласно инструкции Supabase)

Согласно инструкции Supabase, нужно добавить параметры в конец connection string:

```
?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

### Шаг 3: Полный connection string

**Вариант 1: Без URL-encoding (попробуйте сначала)**
```
postgresql://postgres.hduadapicktrcrqjvzvd:увсцыч123ЙФЯ@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

**Вариант 2: С URL-encoding (если вариант 1 не работает)**
```
postgresql://postgres.hduadapicktrcrqjvzvd:%D1%83%D0%B2%D1%81%D1%86%D1%8B%D1%87123%D0%99%D0%A4%D0%AF@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 🔧 Как получить URL-encoded пароль

### В JavaScript/Node.js:
```javascript
const password = 'увсцыч123ЙФЯ'
const encoded = encodeURIComponent(password)
console.log(encoded) // %D1%83%D0%B2%D1%81%D1%86%D1%8B%D1%87123%D0%99%D0%A4%D0%AF
```

### Онлайн инструменты:
- https://www.urlencoder.org/
- Вставьте пароль → получите URL-encoded версию

## ✅ Обновление на Vercel

1. Откройте: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables
2. Найдите `DATABASE_URL`
3. Нажмите **Edit**
4. Вставьте правильный connection string:
   - Без квадратных скобок
   - С параметрами в конце
   - С URL-encoded паролем (если нужно)
5. Убедитесь, что выбраны все окружения
6. Сохраните
7. **Пересоберите проект** (Redeploy)

## 🧪 Проверка

После обновления проверьте:

1. Health endpoint: https://lavsit-textile.vercel.app/api/health
2. Должно быть: `database.connected: true`
3. Или через скрипт: `npm run vercel:status`

## ⚠️ Важные моменты

1. **Квадратные скобки [ ] - это placeholder**, их нужно убрать
2. **Кириллица может потребовать URL-encoding** - попробуйте оба варианта
3. **Параметры обязательны** - добавьте `?pgbouncer=true&schema=public&...`
4. **После изменения пересоберите проект** - иначе изменения не применятся

## 📝 Чеклист

- [ ] Убраны квадратные скобки `[ ]` из пароля
- [ ] Добавлены параметры (`?pgbouncer=true&schema=public&...`)
- [ ] Пароль URL-encoded (если содержит кириллицу или специальные символы)
- [ ] DATABASE_URL обновлен на Vercel
- [ ] Выбраны все окружения (Production, Preview, Development)
- [ ] Проект пересобран
- [ ] Health endpoint показывает `database.connected: true`

