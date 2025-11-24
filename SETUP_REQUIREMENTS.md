# 🔑 BobPT 프로젝트 필수 설정 가이드

## 📋 목차
1. [필수 API 키 및 인증 정보](#1-필수-api-키-및-인증-정보)
2. [파일 경로 설정](#2-파일-경로-설정)
3. [환경 변수 설정](#3-환경-변수-설정)
4. [백엔드 설정](#4-백엔드-설정)
5. [프론트엔드 설정](#5-프론트엔드-설정)

---

## 1. 필수 API 키 및 인증 정보

### 🔴 필수 (반드시 필요)

#### 1.1 Google Cloud Platform (GCP)

**프로젝트 정보:**
- **프로젝트 ID**: `plasma-canyon-477402-i8`
- **GCS 버킷 이름**: `bob-sto`
- **서비스 계정**: `bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com`

**필요한 API:**
- ✅ Cloud Storage API
- ✅ Cloud Firestore API
- ✅ Cloud Translation API
- ✅ Cloud Vision API (OCR용)

**Service Account Key 파일:**
- **파일명**: `service-account-key.json` 또는 `gcp-credentials.json`
- **위치**: `C:\project-brew\bobpt\backend\service-account-key.json`
- **다운로드 방법**:
  1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8
  2. 서비스 계정 선택
  3. "KEYS" 탭 > "ADD KEY" > "Create new key" > "JSON" 선택
  4. 다운로드한 파일을 위 경로에 저장

#### 1.2 OpenAI API

**필요한 키:**
- **API Key**: `OPENAI_API_KEY`
- **용도**: 
  - Whisper STT (음성 인식)
  - GPT-4o-mini (챕터 생성, 썸네일 생성)
- **발급 방법**: https://platform.openai.com/api-keys

**예시 형식:**
```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### 1.3 JWT Secret (인증용)

**용도**: 사용자 인증 토큰 서명
- **생성 방법** (PowerShell):
  ```powershell
  # 랜덤 32바이트 hex 문자열 생성
  -join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
  ```
- **또는 온라인 도구**: https://www.random.org/strings/

**예시:**
```
JWT_SECRET=your-super-secret-jwt-key-CHANGE-THIS-IN-PRODUCTION-1234567890abcdef
```

### 🟡 선택사항 (기능 향상용)

#### 1.4 Naver API (맞춤법 검사)

**필요한 정보:**
- **Client ID**: `NAVER_CLIENT_ID`
- **Client Secret**: `NAVER_CLIENT_SECRET`
- **발급 방법**: https://developers.naver.com/apps/#/register
- **용도**: 한국어 맞춤법 검사 (없어도 Google NLP로 대체 가능)

---

## 2. 파일 경로 설정

### 2.1 프로젝트 루트 경로

**Windows:**
```
C:\project-brew\bobpt\
```

**Linux/Mac:**
```
/home/user/bobpt/
```

### 2.2 백엔드 경로

```
backend/
├── service-account-key.json    # GCP 인증 파일 (필수)
├── .env                        # 환경 변수 파일 (필수)
├── main.py                     # FastAPI 서버
├── requirements.txt            # Python 의존성
├── venv/                       # Python 가상환경
├── uploads/                    # 업로드된 비디오 임시 저장
└── downloads/                  # YouTube 다운로드 임시 저장
```

### 2.3 프론트엔드 경로

```
frontend/ (또는 src/)
├── src/
│   ├── App.tsx                 # 메인 앱 컴포넌트
│   ├── apiClient.ts            # API 클라이언트
│   └── ...
├── package.json
└── vite.config.js
```

### 2.4 Google Cloud 인증 파일 경로

**Windows:**
```
C:\project-brew\bobpt\backend\service-account-key.json
```

**Linux/Mac:**
```
/home/user/bobpt/backend/service-account-key.json
```

---

## 3. 환경 변수 설정

### 3.1 백엔드 `.env` 파일 생성

**위치**: `backend/.env`

**내용:**
```env
# ========== Server Configuration ==========
PORT=8000
NODE_ENV=development

# ========== CORS Configuration ==========
CORS_ORIGIN=http://localhost:5173

# ========== Google Cloud Platform ==========
GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8
GCS_BUCKET=bob-sto
# 서비스 계정 키 파일 경로 (절대 경로)
GOOGLE_APPLICATION_CREDENTIALS=C:\project-brew\bobpt\backend\service-account-key.json

# ========== OpenAI API ==========
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_API_KEY_HERE

# ========== JWT Authentication ==========
# 강력한 랜덤 문자열로 변경! (예: openssl rand -hex 32)
JWT_SECRET=your-super-secret-jwt-key-CHANGE-THIS-IN-PRODUCTION
JWT_EXPIRY=7d

# ========== Whisper Configuration ==========
WHISPER_MODEL=base
ENABLE_AUDIO_ENHANCEMENT=true

# ========== Upload Limits ==========
MAX_FILE_SIZE=500
REQUEST_TIMEOUT=300000

# ========== Naver API (Optional - 맞춤법 검사) ==========
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-secret
```

### 3.2 시스템 환경 변수 설정 (Windows)

**PowerShell에서:**
```powershell
# 임시 설정 (현재 세션만)
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\project-brew\bobpt\backend\service-account-key.json"

# 영구 설정 (시스템 환경 변수)
[System.Environment]::SetEnvironmentVariable(
    "GOOGLE_APPLICATION_CREDENTIALS",
    "C:\project-brew\bobpt\backend\service-account-key.json",
    [System.EnvironmentVariableTarget]::User
)
```

**CMD에서:**
```cmd
setx GOOGLE_APPLICATION_CREDENTIALS "C:\project-brew\bobpt\backend\service-account-key.json"
```

---

## 4. 백엔드 설정

### 4.1 Python 가상환경 설정

```powershell
# Windows
cd C:\project-brew\bobpt\backend
python -m venv venv
.\venv\Scripts\activate

# Linux/Mac
cd /home/user/bobpt/backend
python3 -m venv venv
source venv/bin/activate
```

### 4.2 의존성 설치

```bash
pip install -r requirements.txt
```

**주요 패키지:**
- `fastapi` - 웹 프레임워크
- `uvicorn` - ASGI 서버
- `google-cloud-storage` - GCS 클라이언트
- `google-cloud-firestore` - Firestore 클라이언트
- `google-cloud-translate` - 번역 API
- `google-cloud-vision` - OCR API
- `openai` - OpenAI API
- `openai-whisper` - 음성 인식
- `yt-dlp` - YouTube 다운로드
- `opencv-python` - 이미지 처리
- `pillow` - 이미지 처리

### 4.3 서버 실행

```bash
# 개발 모드
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 프로덕션 모드
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

**서버 주소**: `http://localhost:8000`

---

## 5. 프론트엔드 설정

### 5.1 의존성 설치

```bash
# 루트 디렉토리 또는 frontend 디렉토리
npm install
```

### 5.2 개발 서버 실행

```bash
# 루트 디렉토리
npm run dev

# 또는 frontend 디렉토리
cd frontend
npm run dev
```

**프론트엔드 주소**: `http://localhost:5173`

### 5.3 API 엔드포인트 설정

**파일**: `src/apiClient.ts`

**기본 설정:**
```typescript
const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:8000/api'
  : '/api';
```

**프로덕션 환경 변수** (`.env.production`):
```env
VITE_API_BASE_URL=https://your-api-domain.com/api
```

---

## 6. API 엔드포인트 목록

### 6.1 인증 API
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인
- `GET /api/auth/me` - 현재 사용자 정보

### 6.2 프로젝트 API
- `POST /api/projects/init` - 프로젝트 초기화
- `GET /api/projects` - 프로젝트 목록
- `GET /api/projects/{project_id}` - 프로젝트 상세
- `GET /api/project-status/{project_id}` - 프로젝트 상태
- `GET /api/projects/{project_id}/transcript` - 트랜스크립트 조회
- `POST /api/projects/{project_id}/transcript/update` - 트랜스크립트 업데이트

### 6.3 YouTube API
- `POST /api/youtube/process` - YouTube 비디오 처리
- `GET /api/youtube/status/{project_id}` - YouTube 처리 상태

### 6.4 번역 API
- `POST /api/translate-captions` - 자막 번역
- `GET /api/projects/{project_id}/translations` - 번역 목록
- `POST /api/projects/{project_id}/translate` - 번역 트리거

### 6.5 OCR & 맞춤법 검사 API
- `POST /api/ocr-spellcheck/youtube` - YouTube OCR 분석
- `POST /api/ocr-spellcheck/quick-check` - 빠른 맞춤법 검사

### 6.6 내보내기 API
- `POST /api/projects/{project_id}/export` - 프로젝트 내보내기
- `GET /api/projects/{project_id}/export/formats` - 지원 형식 목록

### 6.7 썸네일 API
- `POST /api/projects/{project_id}/thumbnails/generate` - 썸네일 생성
- `GET /api/projects/{project_id}/thumbnails` - 썸네일 조회

### 6.8 챕터 API
- `POST /api/projects/{project_id}/chapters` - 챕터 생성
- `GET /api/projects/{project_id}/chapters` - 챕터 조회

---

## 7. 설정 검증

### 7.1 백엔드 설정 확인

```bash
cd backend
python verify_setup.py
```

**확인 항목:**
- ✅ 환경 변수 설정
- ✅ Google Cloud 인증
- ✅ OpenAI API 키
- ✅ 필수 패키지 설치

### 7.2 Google Cloud 연결 테스트

```python
# Python에서 테스트
from google.cloud import storage
from google.cloud import firestore

# Storage 테스트
storage_client = storage.Client()
buckets = list(storage_client.list_buckets())
print(f"✅ GCS 연결 성공: {len(buckets)} 버킷 발견")

# Firestore 테스트
db = firestore.Client()
print("✅ Firestore 연결 성공")
```

---

## 8. 문제 해결

### 8.1 "Invalid JWT Signature" 오류

**원인**: Service Account Key 파일이 없거나 잘못됨

**해결:**
1. Google Cloud Console에서 키 다운로드
2. `backend/service-account-key.json`에 저장
3. 환경 변수 설정: `GOOGLE_APPLICATION_CREDENTIALS`

### 8.2 CORS 오류

**원인**: 프론트엔드와 백엔드 포트 불일치

**해결:**
- `backend/main.py`의 `origins` 리스트에 프론트엔드 URL 추가
- 기본값: `http://localhost:5173`

### 8.3 OpenAI API 오류

**원인**: API 키가 없거나 잘못됨

**해결:**
1. https://platform.openai.com/api-keys 에서 키 확인
2. `.env` 파일에 `OPENAI_API_KEY` 설정
3. 백엔드 재시작

---

## 9. 빠른 시작 체크리스트

- [ ] Google Cloud Service Account Key 다운로드 및 저장
- [ ] OpenAI API 키 발급
- [ ] `backend/.env` 파일 생성 및 설정
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정
- [ ] Python 가상환경 생성 및 의존성 설치
- [ ] 백엔드 서버 실행 (`uvicorn main:app --reload`)
- [ ] 프론트엔드 의존성 설치 (`npm install`)
- [ ] 프론트엔드 서버 실행 (`npm run dev`)
- [ ] 브라우저에서 `http://localhost:5173` 접속

---

## 10. 추가 리소스

- **Google Cloud Console**: https://console.cloud.google.com/
- **OpenAI Platform**: https://platform.openai.com/
- **Naver Developers**: https://developers.naver.com/
- **FastAPI 문서**: https://fastapi.tiangolo.com/
- **Vite 문서**: https://vitejs.dev/

---

**마지막 업데이트**: 2024년 1월



