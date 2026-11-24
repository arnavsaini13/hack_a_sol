param(
    [Parameter(Mandatory = $false)]
    [string]$BackendUrl = "http://localhost:8000"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   JanAgriPortal Android APK Automated Build Pipeline     " -ForegroundColor Cyan
Write-Host "   Target Backend: $BackendUrl                             " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green

# 1. Set environment variable for Vite build
$cleanUrl = $BackendUrl.Trim().TrimEnd('/')
$env:VITE_API_BASE_URL = $cleanUrl

# 2. Build frontend web assets
Write-Host "`n[1/3] Building frontend production bundle..." -ForegroundColor Cyan
Set-Location "$scriptDir\frontend"

try {
    pnpm run build
} catch {
    Write-Host "[ERROR] Frontend build failed. Check TypeScript/Vite errors above." -ForegroundColor Red
    Set-Location $scriptDir
    exit 1
}

# 3. Sync Capacitor Android project
Write-Host "`n[2/3] Syncing Capacitor native Android project..." -ForegroundColor Cyan
try {
    pnpm exec cap sync android
} catch {
    Write-Host "[ERROR] Capacitor sync failed." -ForegroundColor Red
    Set-Location $scriptDir
    exit 1
}

# 4. Attempt Gradle assembleDebug build
Write-Host "`n[3/3] Compiling Android APK with Gradle..." -ForegroundColor Cyan

# Auto-detect modern JDK from Android Studio if available
$androidStudioJbr = "C:\Program Files\Android\Android Studio\jbr"
if (Test-Path $androidStudioJbr) {
    $env:JAVA_HOME = $androidStudioJbr
    $env:PATH = "$androidStudioJbr\bin;$env:PATH"
    Write-Host "[INFO] Using Android Studio JDK: $androidStudioJbr" -ForegroundColor Gray
}

$gradlew = "$scriptDir\frontend\android\gradlew.bat"
$buildSuccess = $false

if (Test-Path $gradlew) {
    Set-Location "$scriptDir\frontend\android"
    try {
        & $gradlew assembleDebug
        if ($LASTEXITCODE -eq 0) {
            $apkPath = "$scriptDir\frontend\android\app\build\outputs\apk\debug\app-debug.apk"
            if (Test-Path $apkPath) {
                $buildSuccess = $true
                $apkSizeMB = [math]::Round((Get-Item $apkPath).Length / 1MB, 2)
                Write-Host "`n==========================================================" -ForegroundColor Green
                Write-Host " [SUCCESS] Android APK built successfully!                " -ForegroundColor Green
                Write-Host " Location : $apkPath                                      " -ForegroundColor Yellow
                Write-Host " File Size: $apkSizeMB MB                                 " -ForegroundColor Gray
                Write-Host "==========================================================" -ForegroundColor Green
            }
        }
    } catch {
        # Gradle CLI requires local ANDROID_HOME / JDK 17+ environment variables
    }
}

if (-not $buildSuccess) {
    Write-Host "`n[INFO] Standalone Gradle CLI compilation requires ANDROID_HOME / JDK configured." -ForegroundColor Yellow
    Write-Host "[INFO] Opening project in Android Studio (Build -> Build Bundle(s) / APK(s) -> Build APK)..." -ForegroundColor Cyan
    Set-Location "$scriptDir\frontend"
    pnpm exec cap open android
}

Set-Location $scriptDir
Write-Host "`nDone." -ForegroundColor Green
