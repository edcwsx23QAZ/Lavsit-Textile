# Диагностика проблемы с базой данных на Vercel

## 🔍 Текущая ситуация

На страницах отображается ошибка: "База данных недоступна"

## ✅ Локальная проверка

Подключение к базе данных работает локально:
- ✅ Формат connection string правильный (Connection Pooler)
- ✅ Подключение установлено
- ✅ Тестовый запрос выполнен

## 🔧 Проверка на Vercel

### 1. Проверьте Health Endpoint

Откройте в браузере:
```
https://lavsit-textile.vercel.app/api/health
```

Этот endpoint покажет:
- Настроен ли `DATABASE_URL`
- Формат connection string
- Статус подключения к базе данных
- Детальную информацию об ошибках

### 2. Проверьте переменные окружения на Vercel

1. Откройте проект: https://vercel.com/narfius-projects/lavsit-textile
2. Перейдите в **Settings → Environment Variables**
3. Проверьте наличие `DATABASE_URL`
4. Убедитесь, что значение правильное:
   ```
   postgresql://postgres.hduadapicktrcrqjvzvd:edcwsx123QA@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
   ```
5. Проверьте, что переменная доступна для всех окружений:
   - ✅ Production
   - ✅ Preview
   - ✅ Development

### 3. Проверьте логи на Vercel

1. Откройте последний deployment
2. Перейдите в **Runtime Logs**
3. Откройте одну из страниц (`/fabrics`, `/suppliers`, и т.д.)
4. Ищите ошибки подключения к базе данных

### 4. Проверьте статус базы данных Supabase

1. Откройте Supabase Dashboard: https://supabase.com/dashboard
2. Выберите проект `hduadapicktrcrqjvzvd`
3. Проверьте статус проекта (не должен быть в режиме паузы)
4. Перейдите в **Settings → Database**
5. Проверьте, что база данных активна

## 🐛 Возможные проблемы и решения

### Проблема 1: DATABASE_URL не настроен на Vercel

**Симптомы:**
- Health endpoint показывает `hasDatabaseUrl: false`
- Страницы показывают "База данных недоступна"

**Решение:**
1. Откройте Vercel Dashboard
2. Settings → Environment Variables
3. Добавьте `DATABASE_URL` с правильным значением
4. Убедитесь, что выбраны все окружения
5. Пересоберите проект (Redeploy)

### Проблема 2: Неправильный формат DATABASE_URL

**Симптомы:**
- Health endpoint показывает `isValidForVercel: false`
- Ошибка "Can't reach database server" (P1001)

**Решение:**
Убедитесь, что используется Connection Pooler:
```
postgresql://postgres.hduadapicktrcrqjvzvd:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&schema=public
```

**НЕ используйте:**
```
postgresql://postgres:[PASSWORD]@db.hduadapicktrcrqjvzvd.supabase.co:5432/postgres?schema=public
```

### Проблема 3: База данных Supabase в режиме паузы

**Симптомы:**
- Ошибка "Can't reach database server" (P1001)
- Health endpoint показывает ошибку подключения

**Решение:**
1. Откройте Supabase Dashboard
2. Если проект в режиме паузы, разбудите его
3. Дождитесь активации (обычно 1-2 минуты)
4. Проверьте подключение снова

### Проблема 4: Неправильный пароль

**Симптомы:**
- Ошибка "Authentication failed" (P1000)
- Health endpoint показывает ошибку аутентификации

**Решение:**
1. Проверьте пароль в Supabase Dashboard
2. Убедитесь, что пароль URL-encoded (специальные символы экранированы)
3. Обновите `DATABASE_URL` на Vercel
4. Пересоберите проект

### Проблема 5: Переменная не доступна во время сборки

**Симптомы:**
- Сборка проходит, но runtime ошибки
- Prisma Client не может подключиться

**Решение:**
1. Убедитесь, что `DATABASE_URL` доступна для всех окружений
2. Проверьте, что переменная не помечена как "Build-time only"
3. Пересоберите проект после изменения переменных

## 🔧 Быстрое исправление

Если нужно быстро исправить проблему:

1. **Проверьте health endpoint:**
   ```
   https://lavsit-textile.vercel.app/api/health
   ```

2. **Если `hasDatabaseUrl: false`:**
   - Добавьте `DATABASE_URL` на Vercel
   - Пересоберите проект

3. **Если `isValidForVercel: false`:**
   - Обновите `DATABASE_URL` на правильный формат (Connection Pooler)
   - Пересоберите проект

4. **Если база данных недоступна:**
   - Проверьте статус Supabase проекта
   - Разбудите проект, если он в режиме паузы

## 📊 Диагностические команды

### Локальная проверка подключения:
```bash
npm run db:test
```

### Проверка переменных окружения:
```bash
npm run vercel:check-env
```

### Комплексная проверка:
```bash
npm run vercel:verify
```

## 📞 Дополнительная помощь

Если проблема сохраняется:

1. Проверьте логи на Vercel (Runtime Logs)
2. Проверьте health endpoint: `/api/health`
3. Убедитесь, что база данных Supabase активна
4. Проверьте правильность `DATABASE_URL` на Vercel

## ✅ Чеклист для исправления

- [ ] Проверен health endpoint (`/api/health`)
- [ ] `DATABASE_URL` настроен на Vercel
- [ ] `DATABASE_URL` использует Connection Pooler (порт 6543)
- [ ] Переменная доступна для всех окружений
- [ ] База данных Supabase активна (не в режиме паузы)
- [ ] Проект пересобран после изменения переменных
- [ ] Проверены Runtime Logs на Vercel

