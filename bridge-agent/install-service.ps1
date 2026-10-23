$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "CuttingBridge servisini kurmak için PowerShell'i Yönetici olarak çalıştırın."
}

$nssmCommand = Get-Command nssm -ErrorAction Stop
$nodeCommand = Get-Command node -ErrorAction Stop
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$serverPath = Join-Path $PSScriptRoot "server.js"
$logDirectory = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null

& $nssmCommand.Source install CuttingBridge $nodeCommand.Source $serverPath
if ($LASTEXITCODE -ne 0) {
  throw "NSSM servis kurulumu başarısız oldu (exit $LASTEXITCODE)."
}

& $nssmCommand.Source set CuttingBridge AppDirectory $projectRoot
if ($LASTEXITCODE -ne 0) { throw "Servis çalışma dizini ayarlanamadı." }
& $nssmCommand.Source set CuttingBridge AppStdout (Join-Path $logDirectory "stdout.log")
if ($LASTEXITCODE -ne 0) { throw "Servis stdout log yolu ayarlanamadı." }
& $nssmCommand.Source set CuttingBridge AppStderr (Join-Path $logDirectory "stderr.log")
if ($LASTEXITCODE -ne 0) { throw "Servis stderr log yolu ayarlanamadı." }
& $nssmCommand.Source set CuttingBridge AppExit Default Restart
if ($LASTEXITCODE -ne 0) { throw "Servis yeniden başlatma politikası ayarlanamadı." }
& $nssmCommand.Source set CuttingBridge Start SERVICE_AUTO_START
if ($LASTEXITCODE -ne 0) { throw "Servis otomatik başlatma ayarı yapılamadı." }
& $nssmCommand.Source start CuttingBridge
if ($LASTEXITCODE -ne 0) { throw "CuttingBridge servisi başlatılamadı." }

Write-Host "CuttingBridge servisi kuruldu ve başlatıldı."
