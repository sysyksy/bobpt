# BobPT 전체 기능 활성화 설정 가이드

이 가이드는 GCS, Firestore, Translation, OCR 등 모든 Google Cloud 기능을 활성화하여 전체 스택을 로컬에서 테스트하는 방법을 설명합니다.

## 📋 목차
1. [사전 요구사항](#사전-요구사항)
2. [Google Cloud 설정](#google-cloud-설정)
3. [로컬 환경 설정](#로컬-환경-설정)
4. [백엔드 설정](#백엔드-설정)
5. [프론트엔드 설정](#프론트엔드-설정)
6. [데이터베이스 초기화](#데이터베이스-초기화)
7. [실행 및 테스트](#실행-및-테스트)

---

## 🔧 사전 요구사항

### 1. 필수 소프트웨어 설치

- **Python 3.9+**: `python --version`
- **Node.js 18+**: `node --version`
- **FFmpeg**: `ffmpeg -version`
- **Git**: `git --version`

### 2. FFmpeg 설치 (Windows)

FFmpeg가 없다면 설치:

1. https://www.gyan.dev/ffmpeg/builds/ 접속
2. **ffmpeg-git-full.7z** 다운로드
3. 압축 해제 후 `bin` 폴더를 시스템 PATH에 추가

```powershell
# PATH 확인
$env:Path

# FFmpeg 테스트
ffmpeg -version
```

---

## ☁️ Google Cloud 설정

### 1. Google Cloud Project 생성

1. https://console.cloud.google.com/ 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. 프로젝트 ID 기록 (예: `bobpt-project-123456`)

### 2. API 활성화

다음 API들을 활성화해야 합니다:

```
- Cloud Storage API
- Cloud Firestore API
- Cloud Translation API
- Cloud Vision API (OCR)
```

**활성화 방법:**
1. Google Cloud Console → API 및 서비스 → 라이브러리
2. 각 API 검색 후 "사용 설정" 클릭

### 3. 서비스 계정 생성

1. **IAM 및 관리자 → 서비스 계정** 이동
2. **서비스 계정 만들기** 클릭
3. 이름 입력 (예: `bobpt-service-account`)
4. **역할 부여:**
   - Storage 관리자
   - Cloud Datastore 사용자
   - Cloud Translation API 사용자
   - Cloud Vision API 사용자

5. **키 생성:**
   - 서비스 계정 클릭 → 키 탭 → 키 추가 → JSON
   - 다운로드된 JSON 파일을 안전한 위치에 저장
   - 파일명 예: `bobpt-service-account-key.json`

### 4. GCS 버킷 생성

1. **Cloud Storage → 버킷** 이동
2. **버킷 만들기** 클릭
3. 설정:
   - **이름**: `bob-sto` (또는 원하는 이름)
   - **위치 유형**: Region
   - **리전**: asia-northeast3 (서울)
   - **스토리지 클래스**: Standard
   - **액세스 제어**: 세분화된 액세스 제어

4. **CORS 설정** (버킷 선택 → 구성 → CORS 편집):

```json
[
  {
    "origin": ["http://localhost:5173", "http://localhost:3000"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### 5. Firestore 데이터베이스 생성

1. **Firestore → 데이터베이스 만들기**
2. **Native 모드** 선택
3. **리전**: asia-northeast3 (서울)
4. **보안 규칙**: 테스트 모드로 시작 (개발용)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // 개발용 - 프로덕션에서는 변경 필요
    }
  }
}
```

---

## 💻 로컬 환경 설정

### 1. 최신 코드 가져오기

```powershell
cd C:\project-brew\bobpt
git checkout claude/setup-react-video-editor-01MsvQTmjKh5BMgcZdaJU9Uh
git pull origin claude/setup-react-video-editor-01MsvQTmjKh5BMgcZdaJU9Uh
```

### 2. 서비스 계정 키 설정

서비스 계정 JSON 키 파일을 프로젝트 루트에 저장:

```powershell
# 예시: C:\project-brew\bobpt\gcp-credentials.json
```

**⚠️ 중요:** `.gitignore`에 이미 추가되어 있으므로 Git에 커밋되지 않습니다.

---

## 🐍 백엔드 설정

### 1. 가상환경 생성 및 활성화

```powershell
cd C:\project-brew\bobpt\backend
python -m venv venv
.\venv\Scripts\activate
```

### 2. 의존성 설치

```powershell
pip install -r requirements.txt
```

**설치 시간:** 약 5-10분 (PyTorch, Whisper 등 대용량 패키지 포함)

### 3. .env 파일 생성

```powershell
copy .env.example .env
notepad .env
```

### 4. .env 파일 설정

```env
# ========== Server Configuration ==========
PORT=8000
NODE_ENV=development

# ========== CORS Configuration ==========
CORS_ORIGIN=http://localhost:5173

# ========== Google Cloud Storage ==========
GCS_BUCKET=bob-sto
# 서비스 계정 키 파일 경로 (절대 경로 사용)
GOOGLE_APPLICATION_CREDENTIALS=C:\project-brew\bobpt\gcp-credentials.json

# ========== OpenAI API ==========
OPENAI_API_KEY=sk-your-actual-openai-api-key-here
WHISPER_MODEL=whisper-1
ENABLE_AUDIO_ENHANCEMENT=true

# ========== JWT Authentication ==========
# 강력한 랜덤 문자열로 변경! (예: openssl rand -hex 32)
JWT_SECRET=your-super-secret-jwt-key-CHANGE-THIS-IN-PRODUCTION
JWT_EXPIRY=7d

# ========== Upload Limits ==========
MAX_FILE_SIZE=500
REQUEST_TIMEOUT=300000

# ========== Naver API (Optional - 맞춤법 검사) ==========
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
```

### 5. 환경 변수 검증

```powershell
# PowerShell에서 환경 변수 설정 (임시)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\project-brew\bobpt\gcp-credentials.json"

# 검증
python -c "import os; print(os.getenv('GOOGLE_APPLICATION_CREDENTIALS'))"
```

### 6. Google Cloud 인증 테스트

```powershell
python
```

```python
from google.cloud import storage, firestore

# Storage 테스트
try:
    client = storage.Client()
    bucket = client.bucket('bob-sto')
    print(f"✅ GCS 연결 성공: {bucket.name}")
except Exception as e:
    print(f"❌ GCS 연결 실패: {e}")

# Firestore 테스트
try:
    db = firestore.Client()
    print("✅ Firestore 연결 성공")
except Exception as e:
    print(f"❌ Firestore 연결 실패: {e}")
```

---

## 🌐 프론트엔드 설정

### 1. 의존성 설치

```powershell
cd C:\project-brew\bobpt
npm install
```

### 2. 환경 변수 (선택사항)

프론트엔드는 기본적으로 `http://localhost:8000`을 백엔드로 사용합니다.

변경이 필요하면 `.env.local` 생성:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🗄️ 데이터베이스 초기화

### 1. 데이터베이스 초기화 스크립트 실행

```powershell
cd C:\project-brew\bobpt\backend
.\venv\Scripts\activate

# Python으로 데이터베이스 초기화
python -c "from database import init_db; init_db(); print('✅ Database initialized')"
```

이 명령은 `bobpt.db` SQLite 파일을 생성합니다.

### 2. 데이터베이스 확인

```powershell
# SQLite가 설치되어 있다면
sqlite3 bobpt.db
.tables
.schema projects
.quit
```

---

## 🚀 실행 및 테스트

### 1. 백엔드 실행

```powershell
# 터미널 1: 백엔드
cd C:\project-brew\bobpt\backend
.\venv\Scripts\activate

# 환경 변수 설정 (중요!)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\project-brew\bobpt\gcp-credentials.json"

# 서버 실행
uvicorn main:app --reload --port 8000
```

**성공 메시지:**
```
[OK] Google Cloud clients initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

### 2. 프론트엔드 실행

```powershell
# 터미널 2: 프론트엔드
cd C:\project-brew\bobpt
npm run dev
```

**접속:** http://localhost:5173

### 3. API 테스트

#### 3.1 Health Check
```powershell
curl http://localhost:8000/
```

응답:
```json
{"Hello":"Project Brew Backend - Cloud Native"}
```

#### 3.2 회원가입
```powershell
curl -X POST http://localhost:8000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

#### 3.3 로그인
```powershell
curl -X POST http://localhost:8000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

응답에서 `token` 값을 복사하세요.

#### 3.4 인증된 요청 테스트
```powershell
$token = "eyJhbGc..."  # 위에서 받은 토큰

curl http://localhost:8000/api/auth/me `
  -H "Authorization: Bearer $token"
```

---

## 🎬 전체 워크플로우 테스트

### 1. 프론트엔드에서 테스트

1. **회원가입/로그인**
   - http://localhost:5173 접속
   - 회원가입 또는 로그인

2. **비디오 업로드**
   - 짧은 비디오 파일 준비 (1-2분 권장)
   - 업로드 → GCS에 저장됨
   - Firestore에 프로젝트 메타데이터 저장됨

3. **STT 처리**
   - 백엔드가 자동으로 Whisper로 음성 인식
   - 자막 생성 및 Firestore 업데이트

4. **번역 테스트**
   - 자막 선택 → 번역 요청
   - Google Cloud Translation API 호출

5. **OCR 테스트** (선택)
   - YouTube URL 입력
   - OCR 분석 실행

---

## 🐛 트러블슈팅

### 문제: Google Cloud 인증 실패

**증상:**
```
[WARN] Google Cloud client initialization failed
```

**해결:**
```powershell
# 1. 환경 변수 확인
$env:GOOGLE_APPLICATION_CREDENTIALS

# 2. JSON 키 파일 경로 확인
Test-Path C:\project-brew\bobpt\gcp-credentials.json

# 3. 권한 확인
# Google Cloud Console에서 서비스 계정 권한 재확인
```

### 문제: FFmpeg 오류

**증상:**
```
[ERROR] Audio extraction failed
```

**해결:**
```powershell
# FFmpeg 설치 확인
ffmpeg -version

# PATH에 추가되었는지 확인
where.exe ffmpeg
```

### 문제: Firestore 연결 실패

**해결:**
1. Firestore가 Native 모드로 생성되었는지 확인
2. 서비스 계정에 "Cloud Datastore 사용자" 역할이 있는지 확인
3. API가 활성화되었는지 확인

### 문제: CORS 오류

**증상:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**해결:**
1. `backend/main.py`의 `origins` 리스트 확인
2. 프론트엔드 포트 확인 (5173)
3. 브라우저 개발자 도구 → 네트워크 탭에서 Origin 헤더 확인

---

## 📊 모니터링

### 백엔드 로그

모든 요청과 에러가 터미널에 출력됩니다:
- `[OK]`: 성공
- `[INFO]`: 정보
- `[WARN]`: 경고
- `[ERROR]`: 오류

### Google Cloud Console

- **Cloud Storage**: 업로드된 비디오 확인
- **Firestore**: 프로젝트 데이터 확인
- **할당량**: API 사용량 모니터링

---

## 🔒 보안 주의사항

### 개발 환경 (현재)

- ✅ JWT 인증 활성화됨
- ✅ CORS 제한됨 (localhost만)
- ✅ 파일 경로 검증 활성화됨
- ⚠️ Firestore 규칙: 테스트 모드 (읽기/쓰기 모두 허용)

### 프로덕션 배포 전

1. **JWT_SECRET 변경**
   ```powershell
   # 강력한 랜덤 키 생성
   python -c "import secrets; print(secrets.token_hex(32))"
   ```

2. **Firestore 보안 규칙 강화**
3. **프로젝트 API에 인증 추가**
4. **Rate Limiting 추가**
5. **HTTPS 사용**

---

## 📝 체크리스트

시작하기 전 확인:

- [ ] Python 3.9+ 설치됨
- [ ] Node.js 18+ 설치됨
- [ ] FFmpeg 설치 및 PATH 추가됨
- [ ] Google Cloud Project 생성됨
- [ ] 모든 필요한 API 활성화됨
- [ ] 서비스 계정 생성 및 키 다운로드됨
- [ ] GCS 버킷 생성됨
- [ ] Firestore 데이터베이스 생성됨
- [ ] `.env` 파일 설정됨
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정됨
- [ ] 백엔드 의존성 설치됨
- [ ] 프론트엔드 의존성 설치됨
- [ ] 데이터베이스 초기화됨

---

## 🎯 다음 단계

모든 설정이 완료되면:

1. 백엔드 실행
2. 프론트엔드 실행
3. API 테스트
4. 전체 워크플로우 테스트
5. 개발 시작! 🚀

---

## 💡 유용한 명령어

```powershell
# 로그 확인
Get-Content .\backend\logs\app.log -Tail 50 -Wait

# 프로세스 확인
Get-Process | Where-Object {$_.ProcessName -like "*python*"}
Get-Process | Where-Object {$_.ProcessName -like "*node*"}

# 포트 사용 확인
netstat -ano | findstr :8000
netstat -ano | findstr :5173

# 프로세스 종료
Stop-Process -Id <PID>
```

---

질문이나 문제가 있으면 알려주세요! 🙋‍♂️
