# Пошаговая инструкция: Настройка DATABASE_URL на Vercel

## 📋 Что выбрать в Supabase Dashboard

### ✅ Правильные настройки:

1. **Type:** `URI` ✅ (уже выбрано)
2. **Transaction pooler:** ✅ (уже выбрано)
3. **Connection string:** Скопируйте из поля

## 🔧 Шаг 1: Получите Connection String из Supabase

1. В Supabase Dashboard вы видите connection string:
   ```
   postgresql://postgres.hduadapicktrcrqjvzvd:[YOUR-PASSWORD]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres
   ```

2. **Скопируйте этот connection string**

3. **Замените `[YOUR-PASSWORD]` на ваш реальный пароль базы данных**
   - Если пароль содержит специальные символы (!, @, #, и т.д.), их нужно URL-encode:
     - `!` → `%21`
     - `@` → `%40`
     - `#` → `%23`
     - и т.д.

4. **Добавьте параметры в конец** (после `/postgres`):
   ```
   ?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
   ```

**Итоговый формат должен быть:**
```
postgresql://postgres.hduadapicktrcrqjvzvd:[ВАШ_ПАРОЛЬ]@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 🔧 Шаг 2: Обновите DATABASE_URL на Vercel

1. Откройте Vercel Dashboard: https://vercel.com/narfius-projects/lavsit-textile/settings/environment-variables

2. Найдите переменную `DATABASE_URL`

3. Нажмите **Edit** (или три точки → Edit)

4. **Удалите** старый connection string полностью

5. **Вставьте** новый connection string (с замененным паролем и добавленными параметрами)

6. **ВАЖНО:** Убедитесь, что выбраны все окружения:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

7. Нажмите **Save**

## 🔧 Шаг 3: Пересоберите проект

1. Перейдите в **Deployments**: https://vercel.com/narfius-projects/lavsit-textile/deployments

2. Нажмите **Redeploy** на последнем deployment

3. Или создайте новый deployment: **Deploy** → выберите последний коммит

4. Дождитесь завершения сборки (2-3 минуты)

## ✅ Шаг 4: Проверьте результат

1. Откройте health endpoint: https://lavsit-textile.vercel.app/api/health

2. Проверьте, что:
   - `databaseUrlDetails.isPooler: true` ✅
   - `databaseUrlDetails.port: "6543"` ✅
   - `databaseUrlDetails.isValidForVercel: true` ✅
   - `database.connected: true` ✅

3. Проверьте страницы - они должны работать!

## ⚠️ Важные моменты

### Регион может отличаться

В вашем connection string указан регион `aws-1-eu-west-1`, но ранее использовался `aws-0-us-east-1`. 

**Это нормально!** Используйте тот регион, который показан в Supabase Dashboard для вашего проекта.

### Пароль должен быть URL-encoded

Если пароль содержит специальные символы:
- `MyPass123!` → `MyPass123%21`
- `Pass@2024` → `Pass%402024`
- `Secret#1` → `Secret%231`

### Параметры обязательны

Не забудьте добавить параметры:
- `pgbouncer=true` - обязательно для pooler
- `schema=public` - схема базы данных
- `connect_timeout=30` - таймаут подключения
- `pool_timeout=30` - таймаут пула
- `sslmode=require` - требовать SSL

## 🧪 Пример полного connection string

Если ваш пароль `edcwsx123QA` (без специальных символов):
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

Если ваш пароль `edcwsx123QA!` (с восклицательным знаком):
```
postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA%21@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public&connect_timeout=30&pool_timeout=30&sslmode=require
```

## 📝 Чеклист

- [ ] Скопирован connection string из Supabase (Transaction pooler, URI)
- [ ] Заменен `[YOUR-PASSWORD]` на реальный пароль
- [ ] Пароль URL-encoded (если содержит специальные символы)
- [ ] Добавлены параметры (`?pgbouncer=true&schema=public&...`)
- [ ] DATABASE_URL обновлен на Vercel
- [ ] Выбраны все окружения (Production, Preview, Development)
- [ ] Проект пересобран на Vercel
- [ ] Health endpoint показывает `database.connected: true`
- [ ] Страницы работают без ошибок

