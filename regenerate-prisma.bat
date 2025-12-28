@echo off
echo Остановите dev сервер (Ctrl+C) перед выполнением этого скрипта
echo.
pause
echo Удаление кэша Prisma...
if exist "node_modules\.prisma" (
    rmdir /s /q "node_modules\.prisma"
)
echo Генерация Prisma Client...
call npx prisma generate
echo.
echo Готово! Теперь можно запустить dev сервер снова: npm run dev
pause



