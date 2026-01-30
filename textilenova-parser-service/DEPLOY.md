# Инструкция по деплою TextileNova Parser Service

## Деплой на Render.com

### Шаг 1: Подготовка репозитория

1. Убедитесь, что сервис находится в отдельной директории `textilenova-parser-service`
2. Закоммитьте и запушьте изменения в GitHub

### Шаг 2: Создание сервиса на Render

1. Зайдите на [render.com](https://render.com) и войдите в аккаунт
2. Нажмите "New +" → "Web Service"
3. Подключите ваш GitHub репозиторий
4. Выберите ветку `main`
5. Настройте сервис:
   - **Name**: `textilenova-parser-service`
   - **Environment**: `Node`
   - **Build Command**: `cd textilenova-parser-service && npm install && npm run build`
   - **Start Command**: `cd textilenova-parser-service && npm start`
   - **Root Directory**: оставьте пустым (или укажите `textilenova-parser-service`)

### Шаг 3: Переменные окружения

Добавьте в Render Dashboard:
- `NODE_ENV=production`
- `PORT=10000` (Render автоматически установит, но можно указать явно)

### Шаг 4: Получение URL сервиса

После деплоя Render предоставит URL вида:
`https://textilenova-parser-service.onrender.com`

### Шаг 5: Настройка Vercel

1. Зайдите в Vercel Dashboard → Settings → Environment Variables
2. Добавьте переменную:
   - **Name**: `TEXTILENOVA_PARSER_SERVICE_URL`
   - **Value**: URL вашего Render сервиса (например, `https://textilenova-parser-service.onrender.com`)
3. Передеплойте приложение на Vercel

## Деплой на Railway

### Шаг 1: Подготовка

1. Установите Railway CLI: `npm i -g @railway/cli`
2. Войдите: `railway login`

### Шаг 2: Создание проекта

1. В директории `textilenova-parser-service` выполните: `railway init`
2. Выберите "Create new project"
3. Назовите проект: `textilenova-parser-service`

### Шаг 3: Деплой

1. Выполните: `railway up`
2. Railway автоматически определит Node.js и задеплоит

### Шаг 4: Получение URL

1. Выполните: `railway domain` для получения URL
2. Или найдите URL в Railway Dashboard

### Шаг 5: Настройка Vercel

Аналогично шагу 5 для Render

## Проверка работы

### Тест health check:
```bash
curl https://your-service-url.onrender.com/health
```

### Тест analyze:
```bash
curl -X POST https://your-service-url.onrender.com/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://textilnova.ru/..."}'
```

### Тест parse:
```bash
curl -X POST https://your-service-url.onrender.com/parse \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://textilnova.ru/...",
    "rules": {
      "skipRows": [],
      "skipPatterns": []
    }
  }'
```

## Логи

### Render:
- Логи доступны в Render Dashboard → Logs

### Railway:
- Логи доступны через CLI: `railway logs`
- Или в Railway Dashboard → Deployments → View Logs

## Troubleshooting

1. **Сервис не запускается**: Проверьте логи на Render/Railway
2. **Timeout ошибки**: Увеличьте timeout в Vercel (уже установлен на 300 секунд)
3. **CORS ошибки**: CORS уже настроен в сервисе, но проверьте настройки Render/Railway
4. **Внешний сервис недоступен**: Проверьте, что сервис запущен и URL правильный

