# BobPT Windows Setup Script
# Service Account Key 설정 자동화

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔧 BobPT Windows 설정 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = "C:\project-brew\bobpt"
$BACKEND_DIR = "$PROJECT_ROOT\backend"
$KEY_FILE = "$BACKEND_DIR\service-account-key.json"

# Check if running in correct directory
if (-Not (Test-Path $PROJECT_ROOT)) {
    Write-Host "❌ 프로젝트 디렉토리를 찾을 수 없습니다: $PROJECT_ROOT" -ForegroundColor Red
    Write-Host ""
    Write-Host "현재 작업 디렉토리를 확인하세요:" -ForegroundColor Yellow
    Write-Host "  Get-Location" -ForegroundColor Cyan
    Write-Host ""

    $currentDir = Get-Location
    Write-Host "현재 위치: $currentDir" -ForegroundColor Yellow

    if (Test-Path ".\backend") {
        Write-Host ""
        Write-Host "✅ 현재 위치에 backend 폴더가 있습니다" -ForegroundColor Green
        $PROJECT_ROOT = $currentDir.Path
        $BACKEND_DIR = "$PROJECT_ROOT\backend"
        $KEY_FILE = "$BACKEND_DIR\service-account-key.json"
        Write-Host "   프로젝트 루트: $PROJECT_ROOT" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "프로젝트 디렉토리로 이동 후 다시 실행하세요:" -ForegroundColor Yellow
        Write-Host "  cd C:\project-brew\bobpt" -ForegroundColor Cyan
        Write-Host "  .\setup-windows.ps1" -ForegroundColor Cyan
        exit 1
    }
}

# Step 1: Check if key file exists
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 1: Service Account Key 파일 확인" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $KEY_FILE) {
    Write-Host "✅ 키 파일 발견: $KEY_FILE" -ForegroundColor Green

    # Verify it's valid JSON
    try {
        $keyContent = Get-Content $KEY_FILE | ConvertFrom-Json
        Write-Host "✅ JSON 형식 유효" -ForegroundColor Green
        Write-Host "   Project ID: $($keyContent.project_id)" -ForegroundColor White
        Write-Host "   Service Account: $($keyContent.client_email)" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "❌ JSON 파일이 손상되었습니다" -ForegroundColor Red
        Write-Host "   파일을 삭제하고 다시 다운로드하세요" -ForegroundColor Yellow
        Write-Host ""
        $replace = Read-Host "기존 파일을 삭제하고 계속할까요? (y/n)"
        if ($replace -eq 'y') {
            Remove-Item $KEY_FILE
        } else {
            exit 1
        }
    }
} else {
    Write-Host "❌ 키 파일을 찾을 수 없습니다" -ForegroundColor Red
    Write-Host "   예상 위치: $KEY_FILE" -ForegroundColor Yellow
    Write-Host ""
}

# If key file doesn't exist, try to find it
if (-Not (Test-Path $KEY_FILE)) {
    Write-Host "Downloads 폴더에서 키 파일을 찾는 중..." -ForegroundColor Yellow
    Write-Host ""

    $downloadFiles = Get-ChildItem "$env:USERPROFILE\Downloads\plasma-canyon-*.json" -ErrorAction SilentlyContinue |
                     Sort-Object LastWriteTime -Descending

    if ($downloadFiles) {
        Write-Host "발견된 파일:" -ForegroundColor Green
        for ($i = 0; $i -lt [Math]::Min($downloadFiles.Count, 5); $i++) {
            $file = $downloadFiles[$i]
            Write-Host "  [$i] $($file.Name) ($(Get-Date $file.LastWriteTime -Format 'yyyy-MM-dd HH:mm'))" -ForegroundColor White
        }
        Write-Host ""

        $selection = Read-Host "복사할 파일 번호를 입력하세요 (Enter = 최신 파일)"

        if ([string]::IsNullOrWhiteSpace($selection)) {
            $selectedFile = $downloadFiles[0]
        } else {
            $selectedFile = $downloadFiles[[int]$selection]
        }

        if ($selectedFile) {
            Write-Host ""
            Write-Host "선택한 파일: $($selectedFile.Name)" -ForegroundColor Cyan
            Copy-Item $selectedFile.FullName $KEY_FILE
            Write-Host "✅ 파일 복사 완료: $KEY_FILE" -ForegroundColor Green
            Write-Host ""

            # Verify the copied file
            try {
                $keyContent = Get-Content $KEY_FILE | ConvertFrom-Json
                Write-Host "✅ JSON 유효성 검사 통과" -ForegroundColor Green
                Write-Host "   Project ID: $($keyContent.project_id)" -ForegroundColor White
                Write-Host "   Service Account: $($keyContent.client_email)" -ForegroundColor White
                Write-Host ""
            } catch {
                Write-Host "❌ 복사한 파일이 유효한 JSON이 아닙니다" -ForegroundColor Red
                Remove-Item $KEY_FILE
                exit 1
            }
        }
    } else {
        Write-Host "❌ Downloads 폴더에서 키 파일을 찾을 수 없습니다" -ForegroundColor Red
        Write-Host ""
        Write-Host "다음 단계를 수행하세요:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "1. Google Cloud Console에서 Service Account 키 다운로드:" -ForegroundColor White
        Write-Host "   https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8" -ForegroundColor Blue
        Write-Host ""
        Write-Host "2. bobpt-backend 서비스 계정 선택" -ForegroundColor White
        Write-Host "3. KEYS 탭 > ADD KEY > Create new key > JSON" -ForegroundColor White
        Write-Host ""
        Write-Host "4. 다운로드한 파일을 다음 위치에 저장:" -ForegroundColor White
        Write-Host "   $KEY_FILE" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "5. 이 스크립트를 다시 실행하세요" -ForegroundColor White
        Write-Host ""
        exit 1
    }
}

# Step 2: Set environment variable
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 2: 환경 변수 설정" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Current session
$env:GOOGLE_APPLICATION_CREDENTIALS = $KEY_FILE
Write-Host "✅ 현재 PowerShell 세션에 설정됨" -ForegroundColor Green

# Persistent (User level)
try {
    [Environment]::SetEnvironmentVariable(
        "GOOGLE_APPLICATION_CREDENTIALS",
        $KEY_FILE,
        "User"
    )
    Write-Host "✅ 사용자 환경 변수에 영구 저장됨" -ForegroundColor Green
} catch {
    Write-Host "⚠️  영구 환경 변수 설정 실패" -ForegroundColor Yellow
    Write-Host "   현재 세션에서만 사용 가능합니다" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "설정된 값:" -ForegroundColor Cyan
Write-Host "  GOOGLE_APPLICATION_CREDENTIALS = $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor White
Write-Host ""

# Verify file exists at that path
if (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS) {
    Write-Host "✅ 파일 존재 확인됨" -ForegroundColor Green
} else {
    Write-Host "❌ 환경 변수의 파일을 찾을 수 없습니다" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 3: Check Python and packages
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Step 3: Python 환경 확인" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python
try {
    $pythonVersion = python --version 2>&1
    Write-Host "✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Python을 찾을 수 없습니다" -ForegroundColor Red
    Write-Host "   Python을 설치하세요: https://www.python.org/downloads/" -ForegroundColor Yellow
    exit 1
}

# Check Google Cloud packages
Write-Host ""
Write-Host "Google Cloud 패키지 확인 중..." -ForegroundColor Yellow

$packages = @(
    "google-cloud-storage",
    "google-cloud-firestore",
    "google-cloud-translate"
)

$missingPackages = @()

foreach ($package in $packages) {
    $installed = pip list 2>$null | Select-String $package
    if ($installed) {
        Write-Host "  ✅ $package" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $package (미설치)" -ForegroundColor Red
        $missingPackages += $package
    }
}

if ($missingPackages.Count -gt 0) {
    Write-Host ""
    Write-Host "⚠️  일부 패키지가 설치되지 않았습니다" -ForegroundColor Yellow
    Write-Host ""
    $install = Read-Host "지금 설치할까요? (y/n)"

    if ($install -eq 'y') {
        Write-Host ""
        Write-Host "패키지 설치 중..." -ForegroundColor Yellow
        Set-Location $BACKEND_DIR
        pip install -r requirements.txt
        Write-Host "✅ 설치 완료" -ForegroundColor Green
    }
}

Write-Host ""

# Step 4: Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ 설정 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. 이 PowerShell 창을 닫으세요" -ForegroundColor White
Write-Host ""
Write-Host "2. 새 PowerShell 창을 열고 Backend를 시작하세요:" -ForegroundColor White
Write-Host "   cd $BACKEND_DIR" -ForegroundColor Yellow
Write-Host "   uvicorn main:app --reload --port 8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. 다음 메시지가 나타나는지 확인:" -ForegroundColor White
Write-Host "   [OK] Google Cloud clients initialized successfully" -ForegroundColor Green
Write-Host ""
Write-Host "4. Frontend 실행 (다른 터미널):" -ForegroundColor White
Write-Host "   cd $PROJECT_ROOT" -ForegroundColor Yellow
Write-Host "   npm run dev" -ForegroundColor Yellow
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Offer to open backend directory
$openDir = Read-Host "Backend 디렉토리를 열까요? (y/n)"
if ($openDir -eq 'y') {
    Set-Location $BACKEND_DIR
    Write-Host ""
    Write-Host "✅ Backend 디렉토리로 이동했습니다" -ForegroundColor Green
    Write-Host "   Backend 시작: uvicorn main:app --reload --port 8000" -ForegroundColor Yellow
    Write-Host ""
}
