$ErrorActionPreference = "Stop"

function Test-Command {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($null -ne $command) {
    Write-Host "  [ok] tool: $Name"
    return $true
  }

  Write-Host "  [missing] tool: $Name"
  return $false
}

function Test-WebView2Runtime {
  $paths = @(
    "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
  )

  foreach ($path in $paths) {
    if (Test-Path $path) {
      Write-Host "  [ok] runtime: WebView2"
      return $true
    }
  }

  Write-Host "  [missing] runtime: WebView2"
  return $false
}

function Test-MsvcBuildTools {
  $vsWhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vsWhere) {
    $installPath = & $vsWhere -latest -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($LASTEXITCODE -eq 0 -and $installPath) {
      Write-Host "  [ok] prerequisite: Visual Studio C++ Build Tools"
      return $true
    }
  }

  if (Get-Command cl.exe -ErrorAction SilentlyContinue) {
    Write-Host "  [ok] prerequisite: MSVC compiler in PATH"
    return $true
  }

  Write-Host "  [missing] prerequisite: Visual Studio C++ Build Tools"
  return $false
}

Write-Host "Checking Tauri Windows desktop prerequisites..."
Write-Host

$missing = @()

if (-not (Test-Command "node")) { $missing += "node" }
if (-not (Test-Command "npm")) { $missing += "npm" }
if (-not (Test-Command "rustup")) { $missing += "rustup" }
if (-not (Test-Command "cargo")) { $missing += "cargo" }

if (-not (Test-MsvcBuildTools)) { $missing += "msvc-build-tools" }
if (-not (Test-WebView2Runtime)) { $missing += "webview2" }

Write-Host

if ($missing.Count -eq 0) {
  Write-Host "Tauri Windows prerequisites look good."
  exit 0
}

Write-Host "Missing prerequisites detected:"
foreach ($item in $missing) {
  Write-Host "  - $item"
}

Write-Host
Write-Host "Official Tauri v2 Windows prerequisites:"
Write-Host
Write-Host "  1. Install Microsoft C++ Build Tools with 'Desktop development with C++'"
Write-Host "  2. Install Microsoft Edge WebView2 if it is not already present"
Write-Host "  3. Install Rust and select the MSVC host toolchain"
Write-Host
Write-Host "Helpful references:"
Write-Host "  https://v2.tauri.app/start/prerequisites/"
Write-Host "  https://v2.tauri.app/distribute/windows-installer/"
Write-Host
Write-Host "After installing prerequisites, rerun:"
Write-Host
Write-Host "  npm run tauri:doctor:windows"
Write-Host "  npm run tauri:check"
Write-Host "  npm run tauri:dev"

exit 1
