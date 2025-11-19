# Windows 환경에서 Service Account Key 검증

## 현재 상태

환경 변수: `C:\project-brew\bobpt\backend\gcp-credentials.json`

---

## 🔍 키 파일 검증 단계

### 1단계: 파일 존재 확인

```powershell
Test-Path "C:\project-brew\bobpt\backend\gcp-credentials.json"
```

**예상 출력:** `True`

만약 `False`이면 파일이 없는 것입니다.

---

### 2단계: JSON 유효성 및 내용 확인

```powershell
# JSON 파싱 시도
$key = Get-Content "C:\project-brew\bobpt\backend\gcp-credentials.json" | ConvertFrom-Json

# 주요 정보 출력
Write-Host "Type: $($key.type)"
Write-Host "Project ID: $($key.project_id)"
Write-Host "Client Email: $($key.client_email)"
Write-Host "Private Key ID: $($key.private_key_id)"
```

**올바른 출력 예시:**
```
Type: service_account
Project ID: plasma-canyon-477402-i8
Client Email: bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com
Private Key ID: abc123...
```

**❌ 잘못된 경우:**
- Type이 `service_account`가 아님
- Project ID가 `plasma-canyon-477402-i8`가 아님
- Client Email이 다른 서비스 계정 (특히 `@appspot.gserviceaccount.com`)
- JSON 파싱 오류 발생

---

### 3단계: 키 파일이 잘못된 경우

만약 위에서 확인한 결과가 올바르지 않다면:

#### A. 잘못된 서비스 계정 키를 사용 중

**증상:**
```
Client Email: plasma-canyon-477402-i8@appspot.gserviceaccount.com  ← App Engine default
```

**해결:**
1. 올바른 서비스 계정 키 다시 다운로드:
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8
   ```
2. **bobpt-backend** 서비스 계정 선택
3. KEYS 탭 > ADD KEY > Create new key > JSON
4. 다운로드한 파일로 `gcp-credentials.json` 교체

#### B. JSON 파일이 손상됨

**증상:**
```powershell
ConvertFrom-Json : Invalid JSON primitive: ...
```

**해결:**
1. 기존 파일 삭제
2. 새로운 키 다운로드

#### C. 키가 비활성화됨

Google Cloud Console에서 키가 비활성화되었을 수 있습니다.

**확인:**
1. Google Cloud Console > Service Accounts
2. bobpt-backend 클릭
3. KEYS 탭에서 키 상태 확인

---

### 4단계: 올바른 키로 교체

```powershell
# 1. 백업 (선택사항)
Copy-Item "C:\project-brew\bobpt\backend\gcp-credentials.json" "C:\project-brew\bobpt\backend\gcp-credentials.json.backup"

# 2. 새로 다운로드한 파일 복사
Copy-Item "C:\Users\sinyo\Downloads\plasma-canyon-477402-i8-*.json" "C:\project-brew\bobpt\backend\gcp-credentials.json"

# 3. 검증
$key = Get-Content "C:\project-brew\bobpt\backend\gcp-credentials.json" | ConvertFrom-Json
Write-Host "Project ID: $($key.project_id)"
Write-Host "Client Email: $($key.client_email)"
```

---

### 5단계: Backend 재시작

```powershell
# 기존 Backend 중지 (Ctrl+C)

# 재시작
cd C:\project-brew\bobpt\backend
uvicorn main:app --reload --port 8000
```

**성공 메시지 확인:**
```
[OK] Google Cloud clients initialized successfully
```

---

## 🚨 Invalid JWT Signature 오류의 일반적인 원인

### 1. 잘못된 서비스 계정 키

**문제:**
- App Engine default 계정의 키를 사용 (`@appspot.gserviceaccount.com`)
- 다른 프로젝트의 키를 사용

**해결:**
- **bobpt-backend** 서비스 계정의 키만 사용

### 2. 만료되거나 비활성화된 키

**문제:**
- Google Cloud Console에서 키가 삭제/비활성화됨

**해결:**
- 새로운 키 생성

### 3. 키 파일이 손상됨

**문제:**
- JSON 형식이 깨짐
- 파일 복사 중 오류

**해결:**
- 새로 다운로드

### 4. 시스템 시간이 맞지 않음

**문제:**
- JWT 토큰은 시간에 민감
- 시스템 시간이 크게 틀리면 인증 실패

**해결:**
```powershell
# 관리자 권한 PowerShell에서
w32tm /resync

# 또는 설정 > 시간 및 언어 > "자동으로 시간 설정" 켜기
```

### 5. 권한이 부족함

**문제:**
- Service account에 필요한 권한이 없음

**해결:**
IAM에서 다음 권한 확인:
- Storage Object Admin
- Cloud Datastore User
- Cloud Translation API User

---

## 빠른 진단 스크립트

다음 PowerShell 스크립트로 모든 것을 한 번에 확인:

```powershell
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Service Account Key 진단" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$keyPath = $env:GOOGLE_APPLICATION_CREDENTIALS

# 1. 환경 변수 확인
Write-Host "1. 환경 변수 확인" -ForegroundColor Yellow
if ($keyPath) {
    Write-Host "   ✅ GOOGLE_APPLICATION_CREDENTIALS = $keyPath" -ForegroundColor Green
} else {
    Write-Host "   ❌ 환경 변수가 설정되지 않음" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 2. 파일 존재 확인
Write-Host "2. 파일 존재 확인" -ForegroundColor Yellow
if (Test-Path $keyPath) {
    Write-Host "   ✅ 파일 존재: $keyPath" -ForegroundColor Green
} else {
    Write-Host "   ❌ 파일 없음: $keyPath" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 3. JSON 유효성 및 내용 확인
Write-Host "3. JSON 유효성 및 내용 확인" -ForegroundColor Yellow
try {
    $key = Get-Content $keyPath | ConvertFrom-Json

    Write-Host "   Type: $($key.type)" -ForegroundColor White
    Write-Host "   Project ID: $($key.project_id)" -ForegroundColor White
    Write-Host "   Client Email: $($key.client_email)" -ForegroundColor White
    Write-Host "   Private Key ID: $($key.private_key_id.Substring(0,20))..." -ForegroundColor White

    # 검증
    if ($key.type -ne "service_account") {
        Write-Host "   ❌ Type이 'service_account'가 아님" -ForegroundColor Red
    } elseif ($key.project_id -ne "plasma-canyon-477402-i8") {
        Write-Host "   ❌ 잘못된 프로젝트 ID" -ForegroundColor Red
    } elseif ($key.client_email -notlike "*bobpt-backend@*") {
        Write-Host "   ⚠️  bobpt-backend 계정이 아닐 수 있음" -ForegroundColor Yellow
        Write-Host "      현재: $($key.client_email)" -ForegroundColor Yellow
    } else {
        Write-Host "   ✅ 키 파일 유효함" -ForegroundColor Green
    }
} catch {
    Write-Host "   ❌ JSON 파싱 실패: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   파일이 손상되었을 수 있습니다" -ForegroundColor Yellow
}
Write-Host ""

# 4. 시스템 시간 확인
Write-Host "4. 시스템 시간 확인" -ForegroundColor Yellow
$now = Get-Date
Write-Host "   현재 시간: $now" -ForegroundColor White
Write-Host "   UTC 시간: $($now.ToUniversalTime())" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "진단 완료" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
```

위 스크립트를 `diagnose-key.ps1`로 저장하고 실행:

```powershell
.\diagnose-key.ps1
```

---

## ✅ 체크리스트

올바른 설정인지 확인:

- [ ] `Test-Path` 결과가 `True`
- [ ] `type: service_account`
- [ ] `project_id: plasma-canyon-477402-i8`
- [ ] `client_email: bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com`
- [ ] JSON 파싱 오류 없음
- [ ] 시스템 시간이 정확함
- [ ] Backend 재시작 후 `[OK]` 메시지 확인

모든 항목이 체크되면 정상 작동해야 합니다! ✅
