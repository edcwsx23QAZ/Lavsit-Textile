# Скрипт для проверки статуса автозапуска
# Использование: .\scripts\check-autostart.ps1

$taskName = "LavsitTextileLocalParser"

Write-Host "Checking scheduled task status..." -ForegroundColor Cyan
Write-Host ""

try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    
    Write-Host "Task found!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Task Name: $($task.TaskName)" -ForegroundColor White
    Write-Host "State: $($task.State)" -ForegroundColor White
    Write-Host "Last Run Time: $($task.LastRunTime)" -ForegroundColor White
    Write-Host "Next Run Time: $($task.NextRunTime)" -ForegroundColor White
    Write-Host ""
    Write-Host "Action: $($task.Actions[0].Execute) $($task.Actions[0].Arguments)" -ForegroundColor Gray
    Write-Host "Trigger: $($task.Triggers[0])" -ForegroundColor Gray
    
    if ($task.State -eq "Ready") {
        Write-Host ""
        Write-Host "Task is ready and will run at next logon" -ForegroundColor Green
    } elseif ($task.State -eq "Running") {
        Write-Host ""
        Write-Host "Task is currently running" -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "Task state: $($task.State)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Task not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "The scheduled task has not been created yet." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To create it, run:" -ForegroundColor Cyan
    Write-Host "  .\scripts\setup-autostart.bat (as Administrator)" -ForegroundColor White
    Write-Host "  or" -ForegroundColor Gray
    Write-Host "  npm run local-parser:setup (in PowerShell as Administrator)" -ForegroundColor White
}

