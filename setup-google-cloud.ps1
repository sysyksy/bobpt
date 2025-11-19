# Google Cloud 환경 설정 스크립트 (PowerShell)
# Windows 환경에서 Google Cloud 자격증명 설정을 자동화합니다

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Google Cloud 환경 설정 도구" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. JSON 키 파일 찾기
Write-Host "[1/4] JSON 서비스 계정 키 파일 확인..." -ForegroundColor Yellow

$keyFiles = Get-ChildItem -Path "$PSScriptRoot\backend" -Filter "*-key.json" -Recurse
$parentKeyFiles = Get-ChildItem -Path "$PSScriptRoot" -Filter "*-key.json" -ErrorAction SilentlyContinue

$allKeyFiles = @($keyFiles) + @($parentKeyFiles) | Where-Object { $_.Name -ne $null }

if ($allKeyFiles.Count -eq 0) {
    Write-Host "❌ JSON 키 파일을 찾을 수 없습니다" -ForegroundColor Red
    Write-Host ""
    Write-Host "다음 단계를 따르세요:" -ForegroundColor Yellow
    Write-Host "1. Google Cloud Console (https://console.cloud.google.com) 접속"
    Write-Host "2. 프로젝트 생성: 'project-brew'"
    Write-Host "3. '서비스 계정' → '키' → 'JSON 키 만들기'"
    Write-Host "4. 다운로드한 파일을 프로젝트 루트 또는 backend 폴더에 저장"
    Write-Host "5. 이 스크립트를 다시 실행"
    Write-Host ""
    exit 1
}

Write-Host "✓ $($allKeyFiles.Count)개의 키 파일 발견:" -ForegroundColor Green
$allKeyFiles | ForEach-Object { Write-Host "  - $($_.FullName)" -ForegroundColor Green }
Write-Host ""

# 사용할 키 파일 선택
$selectedKeyFile = $allKeyFiles[0]
if ($allKeyFiles.Count -gt 1) {
    Write-Host "사용할 파일을 선택하세요 (기본값: 첫 번째):" -ForegroundColor Yellow
    $allKeyFiles | ForEach-Object -Begin { $i = 0 } -Process {
        Write-Host "  [$i] $($_.Name)" -ForegroundColor White
        $i++
    }
    Write-Host ""

    $selection = Read-Host "번호 입력 (기본값: 0)"
    if ([int]::TryParse($selection, [ref]$null) -and $selection -ge 0 -and $selection -lt $allKeyFiles.Count) {
        $selectedKeyFile = $allKeyFiles[[int]$selection]
    } else {
        Write-Host "❌ 잘못된 선택입니다. 기본값 사용: $($selectedKeyFile.Name)" -ForegroundColor Yellow
    }
}

Write-Host "선택된 파일: $($selectedKeyFile.Name)" -ForegroundColor Green
Write-Host ""

# 2. JSON 파일에서 프로젝트 ID 추출
Write-Host "[2/4] Google Cloud 프로젝트 ID 추출..." -ForegroundColor Yellow

try {
    $content = Get-Content $selectedKeyFile.FullPath -Raw | ConvertFrom-Json
    $projectId = $content.project_id

    if (-not $projectId) {
        throw "프로젝트 ID를 찾을 수 없습니다"
    }

    Write-Host "✓ 프로젝트 ID: $projectId" -ForegroundColor Green
} catch {
    Write-Host "❌ JSON 파일 처리 중 오류: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 3. 환경 변수 설정
Write-Host "[3/4] 환경 변수 설정..." -ForegroundColor Yellow

# 세션 환경 변수 (현재 PowerShell 세션에서만)
$env:GOOGLE_APPLICATION_CREDENTIALS = $selectedKeyFile.FullPath
$env:GOOGLE_CLOUD_PROJECT = $projectId

Write-Host "✓ 세션 환경 변수 설정 완료" -ForegroundColor Green
Write-Host "  - GOOGLE_APPLICATION_CREDENTIALS=$($env:GOOGLE_APPLICATION_CREDENTIALS)" -ForegroundColor Gray
Write-Host "  - GOOGLE_CLOUD_PROJECT=$($env:GOOGLE_CLOUD_PROJECT)" -ForegroundColor Gray

Write-Host ""

# 4. 영구 설정 옵션
Write-Host "[4/4] 영구 설정 (선택사항)..." -ForegroundColor Yellow
Write-Host ""

$setPermanent = Read-Host "Windows 환경 변수에 영구 설정하시겠습니까? (y/n, 기본값: n)"

if ($setPermanent -eq "y" -or $setPermanent -eq "Y") {
    try {
        # Admin 권한 확인
        $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

        if (-not $isAdmin) {
            Write-Host "⚠️  Admin 권한이 필요합니다" -ForegroundColor Yellow
            Write-Host "다음 명령어를 관리자 PowerShell에서 실행하세요:" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "[System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', '$($selectedKeyFile.FullPath)', 'User')" -ForegroundColor Cyan
            Write-Host "[System.Environment]::SetEnvironmentVariable('GOOGLE_CLOUD_PROJECT', '$projectId', 'User')" -ForegroundColor Cyan
            Write-Host ""
        } else {
            [System.Environment]::SetEnvironmentVariable('GOOGLE_APPLICATION_CREDENTIALS', $selectedKeyFile.FullPath, 'User')
            [System.Environment]::SetEnvironmentVariable('GOOGLE_CLOUD_PROJECT', $projectId, 'User')
            Write-Host "✓ 사용자 환경 변수에 설정 완료" -ForegroundColor Green
        }
    } catch {
        Write-Host "❌ 환경 변수 설정 중 오류: $_" -ForegroundColor Red
    }
}

Write-Host ""

# 5. .gitignore 확인
Write-Host "[검사] .gitignore 설정..." -ForegroundColor Yellow

$gitignorePath = "$PSScriptRoot\.gitignore"
$needsUpdate = $false

if (Test-Path $gitignorePath) {
    $gitignoreContent = Get-Content $gitignorePath -Raw

    if ($gitignoreContent -notmatch "\*-key\.json") {
        Write-Host "⚠️  .gitignore에 '*-key.json' 규칙이 없습니다" -ForegroundColor Yellow
        Write-Host "다음을 .gitignore에 추가하세요:" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "# Google Cloud" -ForegroundColor Cyan
        Write-Host "*-key.json" -ForegroundColor Cyan
        Write-Host "service-account-key.json" -ForegroundColor Cyan
        Write-Host ""
        $needsUpdate = $true
    } else {
        Write-Host "✓ .gitignore이 올바르게 설정되어 있습니다" -ForegroundColor Green
    }
} else {
    Write-Host "⚠️  .gitignore 파일을 찾을 수 없습니다" -ForegroundColor Yellow
}

Write-Host ""

# 6. 완료
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  설정 완료!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "1. 터미널 재시작 (영구 설정을 한 경우)"
Write-Host "2. 다음 명령어로 설정 확인:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   `$env:GOOGLE_CLOUD_PROJECT" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. 백엔드 서버 시작:" -ForegroundColor Yellow
Write-Host ""
Write-Host "   cd backend" -ForegroundColor Cyan
Write-Host "   source venv/Scripts/activate" -ForegroundColor Cyan
Write-Host "   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Cyan
Write-Host ""

# 자동 검증
Write-Host "[검증] Google Cloud 설정 테스트..." -ForegroundColor Yellow

try {
    # Python 설치 확인
    $pythonCheck = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Python 설치됨: $pythonCheck" -ForegroundColor Green

        # 필수 패키지 확인
        $importTest = python -c "import google.cloud; print('Google Cloud SDK 설치됨')" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $importTest" -ForegroundColor Green
        } else {
            Write-Host "⚠️  google-cloud 패키지 설치 필요" -ForegroundColor Yellow
            Write-Host "다음 명령어 실행: pip install google-cloud-translate" -ForegroundColor Cyan
        }
    }
} catch {
    Write-Host "⚠️  자동 검증 불가능 (Python 설치 확인)" -ForegroundColor Yellow
}

Write-Host ""
