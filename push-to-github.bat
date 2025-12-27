@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Current directory: %CD%
echo.
echo Checking Git status...
git status
echo.
echo Initializing Git if needed...
if not exist .git (
    git init
)
echo.
echo Adding all files...
git add .
echo.
echo Creating commit...
git commit -m "Initial commit: Lavsit Textile project"
echo.
echo Adding remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/edcwsx23QAZ/Lavsit-Textile.git
echo.
echo Setting branch to main...
git branch -M main
echo.
echo Pushing to GitHub...
git push -u origin main
echo.
echo Done!
pause

