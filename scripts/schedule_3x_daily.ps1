# Run this script in PowerShell to schedule the job 3 times a day on Windows
$workingDir = (Resolve-Path "$PSScriptRoot\..").Path
$batFile = "$workingDir\scripts\run_auto.bat"

Write-Host "Registering Windows Scheduled Tasks to run 3 times daily..." -ForegroundColor Cyan

# 9:00 AM
schtasks /create /tn "AI_Job_Apply_9AM" /tr "`"$batFile`"" /sc daily /st 09:00 /f
# 2:00 PM
schtasks /create /tn "AI_Job_Apply_2PM" /tr "`"$batFile`"" /sc daily /st 14:00 /f
# 8:00 PM
schtasks /create /tn "AI_Job_Apply_8PM" /tr "`"$batFile`"" /sc daily /st 20:00 /f

Write-Host ""
Write-Host "✅ Tasks successfully registered in Windows Task Scheduler!" -ForegroundColor Green
Write-Host "Runs automatically every day at: 9:00 AM, 2:00 PM, and 8:00 PM."
Write-Host "To remove them anytime, run:"
Write-Host "  schtasks /delete /tn AI_Job_Apply_9AM /f"
Write-Host "  schtasks /delete /tn AI_Job_Apply_2PM /f"
Write-Host "  schtasks /delete /tn AI_Job_Apply_8PM /f"
