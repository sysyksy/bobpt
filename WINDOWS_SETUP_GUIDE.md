# 🪟 Windows 환경에서 BobPT 설정 가이드

## 🔴 현재 오류

```
503 Getting metadata from plugin failed with error:
('invalid_grant: Invalid JWT Signature.')
```

**원인:** Service Account Key가 설정되지 않았거나 잘못됨

---

## ✅ Windows에서 Service Account Key 설정

### Step 1: Service Account Key 다운로드

1. **Google Cloud Console 접속**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8
   ```

2. **bobpt-backend 서비스 계정 선택**
   - `bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com` 찾기

3. **키 생성**
   - "KEYS" 탭 클릭
   - "ADD KEY" > "Create new key" 선택
   - "JSON" 선택 > "CREATE" 클릭
   - 다운로드된 JSON 파일 저장 (예: `plasma-canyon-477402-i8-abc123.json`)

---

### Step 2: 키 파일 배치

**다운로드한 파일을 프로젝트 폴더로 이동:**

```powershell
# PowerShell에서 실행
# 다운로드 폴더의 파일명을 확인하고 복사
copy "C:\Users\sinyo\Downloads\plasma-canyon-*.json" "C:\project-brew\bobpt\backend\service-account-key.json"
```

**또는 Windows 탐색기에서:**
1. `C:\Users\sinyo\Downloads` 폴더 열기
2. `plasma-canyon-...json` 파일 찾기
3. `C:\project-brew\bobpt\backend\` 폴더로 복사
4. 이름을 `service-account-key.json`으로 변경

---

### Step 3: 환경 변수 설정 (Windows)

#### 옵션 A: PowerShell에서 임시 설정 (현재 세션만)

```powershell
# PowerShell 열기
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\project-brew\bobpt\backend\service-account-key.json"

# 설정 확인
echo $env:GOOGLE_APPLICATION_CREDENTIALS
```

#### 옵션 B: CMD에서 임시 설정

```cmd
:: 명령 프롬프트(CMD) 열기
set GOOGLE_APPLICATION_CREDENTIALS=C:\project-brew\bobpt\backend\service-account-key.json

:: 설정 확인
echo %GOOGLE_APPLICATION_CREDENTIALS%
```

#### 옵션 C: 시스템 환경 변수로 영구 설정 (권장) 🌟

**GUI 방식:**

1. **시스템 속성 열기**
   - `Win + Pause` 키 누르기
   - 또는 "내 PC" 우클릭 > "속성"

2. **고급 시스템 설정**
   - 왼쪽 메뉴에서 "고급 시스템 설정" 클릭

3. **환경 변수 버튼 클릭**

4. **새 환경 변수 추가** (사용자 변수)
   - "새로 만들기" 버튼 클릭
   - 변수 이름: `GOOGLE_APPLICATION_CREDENTIALS`
   - 변수 값: `C:\project-brew\bobpt\backend\service-account-key.json`
   - "확인" 클릭

5. **모든 창에서 "확인" 클릭**

6. **터미널 재시작** (중요!)
   - 기존 PowerShell/CMD 창 모두 닫기
   - 새 PowerShell/CMD 창 열기

**PowerShell 명령어 방식:**

```powershell
# 사용자 환경 변수에 영구 추가 (관리자 권한 불필요)
[Environment]::SetEnvironmentVariable(
    "GOOGLE_APPLICATION_CREDENTIALS",
    "C:\project-brew\bobpt\backend\service-account-key.json",
    "User"
)

# 현재 세션에도 바로 적용
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\project-brew\bobpt\backend\service-account-key.json"
```

---

### Step 4: 환경 변수 확인

**PowerShell에서:**
```powershell
echo $env:GOOGLE_APPLICATION_CREDENTIALS
# 출력: C:\project-brew\bobpt\backend\service-account-key.json

# 파일 존재 확인
Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS
# 출력: True
```

**CMD에서:**
```cmd
echo %GOOGLE_APPLICATION_CREDENTIALS%
:: 출력: C:\project-brew\bobpt\backend\service-account-key.json

:: 파일 존재 확인
dir %GOOGLE_APPLICATION_CREDENTIALS%
```

---

### Step 5: Backend 재시작

**기존 Backend 중지:**
- `Ctrl + C` 눌러서 종료

**새 터미널 창에서 Backend 시작:**

```powershell
# PowerShell
cd C:\project-brew\bobpt\backend
uvicorn main:app --reload --port 8000
```

**또는 CMD:**
```cmd
cd C:\project-brew\bobpt\backend
uvicorn main:app --reload --port 8000
```

**성공 메시지 확인:**
```
[OK] Google Cloud clients initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000
```

**실패 시 메시지:**
```
[WARN] Google Cloud client initialization failed: ...
```

---

## 🔍 문제 해결

### 문제 1: "파일을 찾을 수 없음"

**원인:** 파일 경로가 잘못됨

**해결:**
```powershell
# 파일이 실제로 존재하는지 확인
Get-ChildItem "C:\project-brew\bobpt\backend\*.json"

# 파일 내용 확인 (JSON 형식)
Get-Content "C:\project-brew\bobpt\backend\service-account-key.json" | Select-Object -First 5
```

### 문제 2: "Invalid JWT Signature" 계속 발생

**원인 1: 환경 변수가 설정되지 않음**

```powershell
# 확인
echo $env:GOOGLE_APPLICATION_CREDENTIALS

# 빈 값이면 Step 3으로 돌아가서 다시 설정
```

**원인 2: 터미널을 재시작하지 않음**

환경 변수를 시스템 설정에서 변경했다면 **터미널을 완전히 종료하고 다시 열어야** 합니다.

**원인 3: JSON 파일이 손상됨**

```powershell
# JSON 유효성 검사
Get-Content "C:\project-brew\bobpt\backend\service-account-key.json" | ConvertFrom-Json
```

오류가 나면 다시 다운로드하세요.

**원인 4: 시스템 시간이 맞지 않음**

JWT 인증은 시스템 시간에 의존합니다. Windows 시간 설정이 정확한지 확인:
1. 설정 > 시간 및 언어 > 날짜 및 시간
2. "자동으로 시간 설정" 켜기

### 문제 3: 키 파일 경로에 공백이 있음

**Windows 경로에 공백이 있으면 따옴표로 감싸야 합니다:**

```powershell
# 잘못된 예
$env:GOOGLE_APPLICATION_CREDENTIALS=C:\Users\My Name\bobpt\backend\key.json

# 올바른 예
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\My Name\bobpt\backend\key.json"
```

---

## 📋 체크리스트

- [ ] Service Account Key JSON 파일 다운로드
- [ ] 파일을 `C:\project-brew\bobpt\backend\service-account-key.json`에 저장
- [ ] 환경 변수 `GOOGLE_APPLICATION_CREDENTIALS` 설정
- [ ] 환경 변수 확인 (`echo $env:GOOGLE_APPLICATION_CREDENTIALS`)
- [ ] 파일 존재 확인 (`Test-Path ...`)
- [ ] 모든 터미널 창 닫기
- [ ] 새 PowerShell/CMD 창 열기
- [ ] Backend 재시작
- [ ] `[OK] Google Cloud clients initialized successfully` 메시지 확인

---

## 🚀 빠른 설정 스크립트 (PowerShell)

다음 스크립트를 `setup-windows.ps1`로 저장하고 실행:

```powershell
# setup-windows.ps1

Write-Host "🔧 BobPT Windows 설정 스크립트" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ROOT = "C:\project-brew\bobpt"
$BACKEND_DIR = "$PROJECT_ROOT\backend"
$KEY_FILE = "$BACKEND_DIR\service-account-key.json"

# Check if key file exists
if (-Not (Test-Path $KEY_FILE)) {
    Write-Host "❌ Service Account Key 파일을 찾을 수 없습니다" -ForegroundColor Red
    Write-Host "   위치: $KEY_FILE" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "다운로드 폴더에서 키 파일을 찾는 중..." -ForegroundColor Yellow

    $downloadFiles = Get-ChildItem "$env:USERPROFILE\Downloads\plasma-canyon-*.json" -ErrorAction SilentlyContinue

    if ($downloadFiles) {
        $latestFile = $downloadFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        Write-Host "✅ 발견: $($latestFile.Name)" -ForegroundColor Green
        Write-Host ""

        $copy = Read-Host "이 파일을 복사할까요? (y/n)"
        if ($copy -eq 'y') {
            Copy-Item $latestFile.FullName $KEY_FILE
            Write-Host "✅ 파일 복사 완료" -ForegroundColor Green
        }
    } else {
        Write-Host "❌ Downloads 폴더에서 키 파일을 찾을 수 없습니다" -ForegroundColor Red
        Write-Host ""
        Write-Host "Google Cloud Console에서 키를 다운로드하세요:" -ForegroundColor Yellow
        Write-Host "https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8" -ForegroundColor Blue
        exit 1
    }
}

# Verify key file is valid JSON
Write-Host ""
Write-Host "JSON 파일 유효성 검사 중..." -ForegroundColor Yellow
try {
    $keyContent = Get-Content $KEY_FILE | ConvertFrom-Json
    Write-Host "✅ JSON 형식 유효" -ForegroundColor Green
    Write-Host "   Project: $($keyContent.project_id)" -ForegroundColor Cyan
    Write-Host "   Email: $($keyContent.client_email)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ JSON 파일이 손상되었습니다" -ForegroundColor Red
    Write-Host "   다시 다운로드하세요" -ForegroundColor Yellow
    exit 1
}

# Set environment variable
Write-Host ""
Write-Host "환경 변수 설정 중..." -ForegroundColor Yellow

# Current session
$env:GOOGLE_APPLICATION_CREDENTIALS = $KEY_FILE
Write-Host "✅ 현재 세션에 설정됨" -ForegroundColor Green

# Persistent (User level)
[Environment]::SetEnvironmentVariable(
    "GOOGLE_APPLICATION_CREDENTIALS",
    $KEY_FILE,
    "User"
)
Write-Host "✅ 영구 환경 변수로 설정됨 (사용자 레벨)" -ForegroundColor Green

# Verify
Write-Host ""
Write-Host "설정 확인:" -ForegroundColor Cyan
Write-Host "  환경 변수: $env:GOOGLE_APPLICATION_CREDENTIALS" -ForegroundColor White
Write-Host "  파일 존재: $(Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS)" -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ 설정 완료!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Yellow
Write-Host "1. 이 PowerShell 창을 닫기" -ForegroundColor White
Write-Host "2. 새 PowerShell 창 열기" -ForegroundColor White
Write-Host "3. Backend 시작:" -ForegroundColor White
Write-Host "   cd $BACKEND_DIR" -ForegroundColor Cyan
Write-Host "   uvicorn main:app --reload --port 8000" -ForegroundColor Cyan
Write-Host ""
```

**실행 방법:**

```powershell
# PowerShell을 관리자 권한으로 열기
# 실행 정책 변경 (한 번만)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 스크립트 실행
.\setup-windows.ps1
```

---

## 🔄 Backend 재시작 후에도 오류 발생 시

### 1. 환경 변수 다시 확인

```powershell
echo $env:GOOGLE_APPLICATION_CREDENTIALS
```

빈 값이면 새 터미널을 열지 않았거나 설정이 안 된 것입니다.

### 2. 키 파일 재생성

기존 키가 손상되었을 가능성:
1. Google Cloud Console에서 기존 키 삭제
2. 새 키 생성 및 다운로드
3. Step 2부터 다시 진행

### 3. Python 환경 확인

```powershell
# Python 버전 확인
python --version

# Google Cloud 패키지 확인
pip list | Select-String "google"
```

### 4. 시스템 시간 동기화

```powershell
# 시간 동기화 (관리자 권한 필요)
w32tm /resync
```

---

## 📞 추가 도움

모든 단계를 완료했는데도 오류가 계속되면:

1. **Backend 로그 전체 복사**
   - 특히 `[OK]` 또는 `[WARN]` 메시지

2. **환경 변수 값 확인**
   ```powershell
   echo $env:GOOGLE_APPLICATION_CREDENTIALS
   ```

3. **키 파일 정보 확인**
   ```powershell
   Get-Content "C:\project-brew\bobpt\backend\service-account-key.json" | ConvertFrom-Json | Select-Object project_id, client_email
   ```

위 정보를 제공하시면 더 정확한 진단이 가능합니다.

---

## 💡 참고

Windows에서는 경로 구분자가 `\` (백슬래시)입니다:
- ✅ `C:\project-brew\bobpt\backend\service-account-key.json`
- ❌ `C:/project-brew/bobpt/backend/service-account-key.json` (PowerShell에서는 작동하지만 권장하지 않음)

환경 변수 설정 방법이 Linux/Mac과 다릅니다:
- Linux/Mac: `export GOOGLE_APPLICATION_CREDENTIALS=...`
- Windows PowerShell: `$env:GOOGLE_APPLICATION_CREDENTIALS=...`
- Windows CMD: `set GOOGLE_APPLICATION_CREDENTIALS=...`
