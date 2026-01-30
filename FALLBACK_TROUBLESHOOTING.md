# Устранение неполадок Fallback механизма

## Проблема: Парсер на Vercel не обращается к локальной машине

### Шаг 1: Проверка локального сервера

Запустите диагностический скрипт:

```powershell
npm run local-parser:diagnose
```

или

```powershell
powershell -ExecutionPolicy Bypass -File scripts/diagnose-fallback.ps1
```

### Шаг 2: Убедитесь, что локальный сервер запущен

```powershell
npm run local-parser
```

Сервер должен запуститься на порту 4002 (или из переменной `LOCAL_PARSER_PORT`).

Проверьте доступность:
```powershell
curl http://localhost:4002/health
```

Должен вернуться JSON с `{"status":"ok",...}`

### Шаг 3: Убедитесь, что туннель запущен

Запустите туннель:

```powershell
npm run local-parser:start
```

Или вручную:
```powershell
npx localtunnel --port 4002
```

Скопируйте URL из вывода (например, `https://xxxx-xxxx-xxxx.loca.lt`)

### Шаг 4: Проверьте переменную окружения в Vercel

**КРИТИЧЕСКИ ВАЖНО:** Переменная `LOCAL_PARSER_URL` должна быть установлена в Vercel Dashboard!

1. Откройте: https://vercel.com/dashboard
2. Выберите проект `lavsit-textile`
3. Перейдите в **Settings → Environment Variables**
4. Проверьте наличие переменной:
   - **Name**: `LOCAL_PARSER_URL`
   - **Value**: URL вашего туннеля (например, `https://xxxx-xxxx-xxxx.loca.lt`)
   - **Environment**: Должны быть отмечены Production, Preview, Development

5. Если переменной нет - добавьте её
6. **ВАЖНО:** После добавления/изменения переменной нужно **перезапустить деплой**!

### Шаг 5: Проверьте логи Vercel

В логах Vercel вы должны увидеть:

```
[TextileNovaParser] Attempting to parse on Vercel...
[TextileNovaParser] Error on Vercel, trying local parser: <error message>
[TextileNovaParser] LOCAL_PARSER_URL is set: https://xxxx.loca.lt
[TextileNovaParser] Attempting to connect to local parser...
```

Если вы видите:
```
[TextileNovaParser] LOCAL_PARSER_URL is not set in environment variables, skipping fallback
```

Это означает, что переменная не установлена в Vercel или деплой не был перезапущен после её добавления.

### Шаг 6: Проверьте доступность туннеля из интернета

Откройте в браузере: `https://your-tunnel-url.loca.lt/health`

Должен вернуться JSON. Если не открывается - туннель не работает или недоступен.

## Частые проблемы

### Проблема 1: "LOCAL_PARSER_URL is not set"

**Решение:**
- Добавьте переменную в Vercel Dashboard
- Перезапустите деплой после добавления

### Проблема 2: "Локальный парсер недоступен"

**Решение:**
- Убедитесь, что локальный сервер запущен
- Убедитесь, что туннель активен
- Проверьте, что URL туннеля правильный

### Проблема 3: Fallback не срабатывает

**Проверьте:**
1. Локальный сервер запущен и доступен на localhost:4002
2. Туннель активен и URL доступен из интернета
3. Переменная `LOCAL_PARSER_URL` установлена в Vercel
4. Деплой был перезапущен после добавления переменной
5. В логах Vercel есть сообщения о попытке fallback

## Тестирование

Для тестирования локального парсера:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/test-local-parser.ps1
```

Для полной диагностики:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/diagnose-fallback.ps1
```

