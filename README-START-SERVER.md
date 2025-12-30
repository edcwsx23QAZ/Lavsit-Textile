# Инструкция по запуску lavsit-textile на порту 4001

## ⚠️ ВАЖНО: При перезагрузке сервера в рамках чата запускать ТОЛЬКО lavsit-textile!

## Способ 1: Использование скрипта START-LAVSIT-TEXTILE.bat

1. Откройте командную строку (cmd.exe)
2. Перейдите в директорию проекта:
   ```
   cd /d E:\Программы\cursor\repositary\lavsit-textile
   ```
3. Запустите скрипт:
   ```
   START-LAVSIT-TEXTILE.bat
   ```

## Способ 2: Ручной запуск

1. Откройте командную строку (cmd.exe)
2. Остановите все процессы на порту 4001:
   ```
   for /f "tokens=5" %a in ('netstat -ano ^| findstr :4001 ^| findstr LISTENING') do taskkill /F /PID %a
   ```
3. Перейдите в директорию проекта:
   ```
   cd /d E:\Программы\cursor\repositary\lavsit-textile
   ```
4. Запустите сервер:
   ```
   npm run dev
   ```

## Проверка запуска

После запуска сервер должен быть доступен на: http://localhost:4001

Проверить, что сервер запущен:
```
netstat -ano | findstr :4001 | findstr LISTENING
```

## Проблема: Запускается lavsit-russia-delivery вместо lavsit-textile

Если на порту 4001 запускается не тот проект:

1. Остановите ВСЕ процессы Node.js:
   ```
   taskkill /F /IM node.exe
   ```
2. Убедитесь, что вы находитесь в правильной директории:
   ```
   cd /d E:\Программы\cursor\repositary\lavsit-textile
   dir package.json
   ```
   Должен показать файл package.json с именем "lavsit-textile"
3. Запустите сервер:
   ```
   npm run dev
   ```

## Директории проектов

- **lavsit-textile**: `E:\Программы\cursor\repositary\lavsit-textile` (порт 4001)
- **lavsit-russia-delivery**: `E:\Программы\cursor\repositary\lavsit-russia-delivery-1763017917119` (другой порт)


