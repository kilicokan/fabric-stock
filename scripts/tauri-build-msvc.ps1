param(
  [switch]$NoBundle
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$toolchain = "stable-x86_64-pc-windows-msvc"

if (-not (Test-Path $vswhere)) {
  throw "Visual Studio Installer was not found. Install Visual Studio Build Tools with the C++ build tools workload."
}

$vsPath = & $vswhere -latest -products "*" -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if ($LASTEXITCODE -ne 0 -or -not $vsPath) {
  throw "Visual Studio C++ build tools were not found."
}

$vcvars = Join-Path $vsPath "VC\Auxiliary\Build\vcvarsall.bat"
if (-not (Test-Path $vcvars)) {
  throw "Visual Studio C++ environment script was not found: $vcvars"
}

if (-not (Test-Path (Join-Path $cargoBin "rustup.exe"))) {
  throw "rustup was not found at $cargoBin."
}

$installedTargets = & (Join-Path $cargoBin "rustup.exe") target list --toolchain $toolchain --installed
if ($LASTEXITCODE -ne 0 -or $installedTargets -notcontains "x86_64-pc-windows-msvc") {
  throw "The Rust MSVC target is missing. Install it with: rustup target add --toolchain $toolchain x86_64-pc-windows-msvc"
}

$tauriCommand = if ($NoBundle) { "tauri build --no-bundle" } else { "tauri build" }
$command = 'call "' + $vcvars + '" x64 >nul && set "PATH=' + $cargoBin + ';%PATH%" && set "RUSTUP_TOOLCHAIN=' + $toolchain + '" && cd /d "' + $projectRoot + '" && npx ' + $tauriCommand
& $env:ComSpec /d /s /c $command
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
