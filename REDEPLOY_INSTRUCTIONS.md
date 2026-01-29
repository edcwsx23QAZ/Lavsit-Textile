# Инструкция по пересборке проекта на Vercel

## ⚠️ Важно

После изменения переменных окружения на Vercel **обязательно нужно пересобрать проект**, иначе изменения не применятся!

## 🔧 Как пересобрать проект на Vercel

### Способ 1: Через Vercel Dashboard (рекомендуется)

1. Откройте проект: https://vercel.com/narfius-projects/lavsit-textile
2. Перейдите в раздел **Deployments**
3. Найдите последний deployment
4. Нажмите на три точки (⋮) рядом с deployment
5. Выберите **"Redeploy"**
6. Подтвердите пересборку
7. Дождитесь завершения (2-3 минуты)

### Способ 2: Создать новый deployment

1. Откройте проект на Vercel
2. Перейдите в **Deployments**
3. Нажмите кнопку **"Deploy"** (или **"Create Deployment"**)
4. Выберите последний коммит из GitHub
5. Нажмите **"Deploy"**
6. Дождитесь завершения

### Способ 3: Через GitHub (автоматический)

Если проект настроен на автоматический деплой:
1. Создайте пустой коммит:
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push origin main
   ```
2. Vercel автоматически начнет новую сборку

## ✅ После пересборки

Подождите 2-3 минуты, затем проверьте:

1. **Health endpoint:**
   ```
   https://lavsit-textile.vercel.app/api/health
   ```

2. **Или через скрипт:**
   ```bash
   npm run vercel:status
   ```

3. **Проверьте страницы:**
   - https://lavsit-textile.vercel.app/fabrics
   - https://lavsit-textile.vercel.app/suppliers
   - https://lavsit-textile.vercel.app/categories
   - https://lavsit-textile.vercel.app/palette

## 🔍 Проверка статуса деплоя

1. Откройте Vercel Dashboard
2. Перейдите в **Deployments**
3. Найдите последний deployment
4. Проверьте статус:
   - **Building** - сборка в процессе
   - **Ready** - сборка завершена
   - **Error** - ошибка сборки (проверьте логи)

## ⚠️ Если проблема сохраняется

Если после пересборки все еще видна ошибка:

1. **Проверьте переменную еще раз:**
   - Убедитесь, что в поле "Value" нет префикса `DATABASE_URL=`
   - Должно быть только connection string, начинающийся с `postgresql://`

2. **Проверьте окружения:**
   - Убедитесь, что переменная доступна для всех окружений
   - Production, Preview, Development

3. **Проверьте логи:**
   - Откройте последний deployment
   - Перейдите в **Runtime Logs**
   - Проверьте ошибки подключения

