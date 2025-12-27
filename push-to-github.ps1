# PowerShell script to push Lavsit Textile to GitHub
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

# Get script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "Current directory: $PWD" -ForegroundColor Green
Write-Host ""

# Check if Git is initialized
if (-not (Test-Path .git)) {
    Write-Host "Initializing Git repository..." -ForegroundColor Yellow
    git init
}

# Check Git status
Write-Host "Checking Git status..." -ForegroundColor Yellow
git status
Write-Host ""

# Add all files
Write-Host "Adding all files..." -ForegroundColor Yellow
git add .
Write-Host ""

# Create commit
Write-Host "Creating commit..." -ForegroundColor Yellow
git commit -m "Initial commit: Lavsit Textile project"
Write-Host ""

# Add remote repository
Write-Host "Adding remote repository..." -ForegroundColor Yellow
git remote remove origin 2>$null
git remote add origin https://github.com/edcwsx23QAZ/Lavsit-Textile.git
Write-Host ""

# Set branch to main
Write-Host "Setting branch to main..." -ForegroundColor Yellow
git branch -M main
Write-Host ""

# Push to GitHub
Write-Host "Pushing to GitHub..." -ForegroundColor Yellow
git push -u origin main
Write-Host ""

Write-Host "Done!" -ForegroundColor Green

