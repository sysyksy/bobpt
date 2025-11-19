# Service Account Key 진단 스크립트
# Windows PowerShell용

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔍 Service Account Key 진단" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$keyPath = $env:GOOGLE_APPLICATION_CREDENTIALS
$hasErrors = $false

# 1. 환경 변수 확인
Write-Host "1️⃣  환경 변수 확인" -ForegroundColor Yellow
Write-Host ""
if ($keyPath) {
    Write-Host "   ✅ GOOGLE_APPLICATION_CREDENTIALS 설정됨" -ForegroundColor Green
    Write-Host "      경로: $keyPath" -ForegroundColor White
} else {
    Write-Host "   ❌ GOOGLE_APPLICATION_CREDENTIALS가 설정되지 않음" -ForegroundColor Red
    Write-Host ""
    Write-Host "   해결 방법:" -ForegroundColor Yellow
    Write-Host "   `$env:GOOGLE_APPLICATION_CREDENTIALS=`"C:\project-brew\bobpt\backend\gcp-credentials.json`"" -ForegroundColor Cyan
    $hasErrors = $true
    exit 1
}
Write-Host ""

# 2. 파일 존재 확인
Write-Host "2️⃣  파일 존재 확인" -ForegroundColor Yellow
Write-Host ""
if (Test-Path $keyPath) {
    Write-Host "   ✅ 파일 존재 확인" -ForegroundColor Green
    $fileInfo = Get-Item $keyPath
    Write-Host "      크기: $($fileInfo.Length) bytes" -ForegroundColor White
    Write-Host "      수정일: $($fileInfo.LastWriteTime)" -ForegroundColor White
} else {
    Write-Host "   ❌ 파일 없음: $keyPath" -ForegroundColor Red
    Write-Host ""
    Write-Host "   파일을 생성하거나 환경 변수를 올바른 경로로 설정하세요" -ForegroundColor Yellow
    $hasErrors = $true
    exit 1
}
Write-Host ""

# 3. JSON 유효성 및 내용 확인
Write-Host "3️⃣  JSON 유효성 및 내용 확인" -ForegroundColor Yellow
Write-Host ""
try {
    $key = Get-Content $keyPath -Raw | ConvertFrom-Json

    Write-Host "   📋 키 파일 정보:" -ForegroundColor Cyan
    Write-Host "      Type:           $($key.type)" -ForegroundColor White
    Write-Host "      Project ID:     $($key.project_id)" -ForegroundColor White
    Write-Host "      Client Email:   $($key.client_email)" -ForegroundColor White

    if ($key.private_key_id) {
        Write-Host "      Private Key ID: $($key.private_key_id.Substring(0,20))..." -ForegroundColor White
    }

    Write-Host ""

    # 세부 검증
    $validationPassed = $true

    # Type 확인
    if ($key.type -ne "service_account") {
        Write-Host "   ❌ Type이 'service_account'가 아님 (현재: $($key.type))" -ForegroundColor Red
        $validationPassed = $false
        $hasErrors = $true
    } else {
        Write-Host "   ✅ Type: service_account" -ForegroundColor Green
    }

    # Project ID 확인
    if ($key.project_id -ne "plasma-canyon-477402-i8") {
        Write-Host "   ❌ 잘못된 프로젝트 ID" -ForegroundColor Red
        Write-Host "      예상: plasma-canyon-477402-i8" -ForegroundColor Yellow
        Write-Host "      실제: $($key.project_id)" -ForegroundColor Yellow
        $validationPassed = $false
        $hasErrors = $true
    } else {
        Write-Host "   ✅ Project ID: plasma-canyon-477402-i8" -ForegroundColor Green
    }

    # Client Email 확인
    if ($key.client_email -like "*bobpt-backend@plasma-canyon-477402-i8*") {
        Write-Host "   ✅ Service Account: bobpt-backend" -ForegroundColor Green
    } elseif ($key.client_email -like "*@appspot.gserviceaccount.com") {
        Write-Host "   ⚠️  App Engine default 서비스 계정 사용 중" -ForegroundColor Yellow
        Write-Host "      권장: bobpt-backend 계정 사용" -ForegroundColor Yellow
        Write-Host "      현재: $($key.client_email)" -ForegroundColor White
        $validationPassed = $false
        $hasErrors = $true
    } else {
        Write-Host "   ⚠️  예상하지 못한 서비스 계정" -ForegroundColor Yellow
        Write-Host "      현재: $($key.client_email)" -ForegroundColor White
    }

    # Private Key 확인
    if ($key.private_key) {
        if ($key.private_key -like "-----BEGIN PRIVATE KEY-----*") {
            Write-Host "   ✅ Private Key 형식 정상" -ForegroundColor Green
        } else {
            Write-Host "   ❌ Private Key 형식 이상" -ForegroundColor Red
            $validationPassed = $false
            $hasErrors = $true
        }
    } else {
        Write-Host "   ❌ Private Key 없음" -ForegroundColor Red
        $validationPassed = $false
        $hasErrors = $true
    }

    Write-Host ""

    if ($validationPassed) {
        Write-Host "   ✅ 키 파일 검증 통과!" -ForegroundColor Green
    } else {
        Write-Host "   ❌ 키 파일에 문제가 있습니다" -ForegroundColor Red
        Write-Host ""
        Write-Host "   해결 방법:" -ForegroundColor Yellow
        Write-Host "   1. Google Cloud Console에서 새 키 다운로드" -ForegroundColor White
        Write-Host "      https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8" -ForegroundColor Blue
        Write-Host "   2. bobpt-backend 서비스 계정 선택" -ForegroundColor White
        Write-Host "   3. KEYS 탭 > ADD KEY > Create new key > JSON" -ForegroundColor White
        Write-Host "   4. 다운로드한 파일로 교체:" -ForegroundColor White
        Write-Host "      Copy-Item `"C:\Users\sinyo\Downloads\plasma-canyon-*.json`" `"$keyPath`"" -ForegroundColor Cyan
    }

} catch {
    Write-Host "   ❌ JSON 파싱 실패" -ForegroundColor Red
    Write-Host "      오류: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   파일이 손상되었습니다. 새로 다운로드하세요" -ForegroundColor Yellow
    $hasErrors = $true
}
Write-Host ""

# 4. 시스템 시간 확인
Write-Host "4️⃣  시스템 시간 확인" -ForegroundColor Yellow
Write-Host ""
$now = Get-Date
$utcNow = $now.ToUniversalTime()

Write-Host "   현재 로컬 시간: $($now.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White
Write-Host "   UTC 시간:       $($utcNow.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor White

# 시간이 크게 틀린지 확인 (간단한 체크)
$currentYear = $now.Year
if ($currentYear -lt 2024 -or $currentYear -gt 2026) {
    Write-Host "   ⚠️  시스템 시간이 정확하지 않을 수 있습니다" -ForegroundColor Yellow
    Write-Host "      JWT 인증은 정확한 시간이 필요합니다" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "   시간 동기화 (관리자 PowerShell에서):" -ForegroundColor Yellow
    Write-Host "      w32tm /resync" -ForegroundColor Cyan
} else {
    Write-Host "   ✅ 시스템 시간 정상" -ForegroundColor Green
}
Write-Host ""

# 5. Backend 연결 테스트 (선택)
Write-Host "5️⃣  Backend 연결 테스트" -ForegroundColor Yellow
Write-Host ""

$testBackend = Read-Host "Backend API 연결을 테스트할까요? (y/n)"

if ($testBackend -eq 'y') {
    Write-Host ""
    Write-Host "   Backend API 테스트 중..." -ForegroundColor Cyan

    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8000/api/projects" -Method GET -TimeoutSec 5 -ErrorAction Stop
        Write-Host "   ✅ Backend 응답 정상 (Status: $($response.StatusCode))" -ForegroundColor Green
    } catch {
        if ($_.Exception.Message -like "*Unable to connect*" -or $_.Exception.Message -like "*Connection refused*") {
            Write-Host "   ⚠️  Backend가 실행되고 있지 않습니다" -ForegroundColor Yellow
            Write-Host ""
            Write-Host "   Backend 시작 방법:" -ForegroundColor Yellow
            Write-Host "      cd C:\project-brew\bobpt\backend" -ForegroundColor Cyan
            Write-Host "      uvicorn main:app --reload --port 8000" -ForegroundColor Cyan
        } else {
            Write-Host "   ❌ Backend 오류: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "📊 진단 결과" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if (-not $hasErrors) {
    Write-Host "✅ 모든 검사 통과!" -ForegroundColor Green
    Write-Host ""
    Write-Host "다음 단계:" -ForegroundColor Cyan
    Write-Host "1. Backend 재시작 (기존 서버 Ctrl+C로 중지)" -ForegroundColor White
    Write-Host "2. 새 PowerShell 창 열기" -ForegroundColor White
    Write-Host "3. Backend 시작:" -ForegroundColor White
    Write-Host "   cd C:\project-brew\bobpt\backend" -ForegroundColor Yellow
    Write-Host "   uvicorn main:app --reload --port 8000" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "4. 다음 메시지 확인:" -ForegroundColor White
    Write-Host "   [OK] Google Cloud clients initialized successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  문제가 발견되었습니다" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "위에 표시된 오류를 해결한 후 다시 실행하세요" -ForegroundColor White
    Write-Host ""
    Write-Host "추가 도움말:" -ForegroundColor Cyan
    Write-Host "- VERIFY_KEY_WINDOWS.md" -ForegroundColor White
    Write-Host "- WINDOWS_SETUP_GUIDE.md" -ForegroundColor White
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
