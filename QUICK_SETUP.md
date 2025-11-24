# ⚡ 빠른 설정 가이드

## 🔑 필수 API 키

### 1. Google Cloud Platform
```
프로젝트 ID: plasma-canyon-477402-i8
버킷 이름: bob-sto
서비스 계정: bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com

필요한 API:
- Cloud Storage API
- Cloud Firestore API  
- Cloud Translation API
- Cloud Vision API

키 파일 경로: C:\project-brew\bobpt\backend\service-account-key.json
다운로드: https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8
```

### 2. OpenAI API
```
발급: https://platform.openai.com/api-keys
용도: Whisper STT, GPT-4o-mini (챕터/썸네일 생성)
```

### 3. JWT Secret
```
생성 방법 (PowerShell):
-join ((48..57) + (97..102) | Get-Random -Count 64 | % {[char]$_})
```

### 4. Naver API (선택사항)
```
발급: https://developers.naver.com/apps/#/register
용도: 한국어 맞춤법 검사
```

---

## 📁 필수 파일 경로

### Windows
```
프로젝트 루트: C:\project-brew\bobpt\
백엔드: C:\project-brew\bobpt\backend\
프론트엔드: C:\project-brew\bobpt\frontend\ (또는 src\)
인증 파일: C:\project-brew\bobpt\backend\service-account-key.json
환경 변수: C:\project-brew\bobpt\backend\.env
```

### Linux/Mac
```
프로젝트 루트: /home/user/bobpt/
백엔드: /home/user/bobpt/backend/
프론트엔드: /home/user/bobpt/frontend/
인증 파일: /home/user/bobpt/backend/service-account-key.json
환경 변수: /home/user/bobpt/backend/.env
```

---

## ⚙️ 환경 변수 설정

### backend/.env 파일
```env
# Google Cloud
GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8
GCS_BUCKET=bob-sto
GOOGLE_APPLICATION_CREDENTIALS=C:\project-brew\bobpt\backend\service-account-key.json

# OpenAI
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# JWT
JWT_SECRET=your-super-secret-key-CHANGE-THIS

# Naver (선택)
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-secret

# Server
PORT=8000
CORS_ORIGIN=http://localhost:5173
```

### 시스템 환경 변수 (Windows PowerShell)
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\project-brew\bobpt\backend\service-account-key.json"
```

---

## 🚀 실행 명령어

### 백엔드
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 프론트엔드
```bash
npm install
npm run dev
```

---

## 🌐 API 엔드포인트

### 기본 URL
```
백엔드: http://localhost:8000
프론트엔드: http://localhost:5173
API Base: http://localhost:8000/api
```

### 주요 엔드포인트
```
POST /api/auth/register          # 회원가입
POST /api/auth/login             # 로그인
GET  /api/projects               # 프로젝트 목록
POST /api/projects/init          # 프로젝트 초기화
POST /api/youtube/process        # YouTube 처리
POST /api/translate-captions      # 자막 번역
POST /api/ocr-spellcheck/youtube # YouTube OCR
```

---

## ✅ 설정 확인

### 백엔드 검증
```bash
cd backend
python verify_setup.py
```

### Google Cloud 연결 테스트
```python
from google.cloud import storage
client = storage.Client()
buckets = list(client.list_buckets())
print(f"✅ {len(buckets)} 버킷 발견")
```

---

## 📝 체크리스트

- [ ] Service Account Key 다운로드 및 저장
- [ ] OpenAI API 키 발급
- [ ] backend/.env 파일 생성
- [ ] GOOGLE_APPLICATION_CREDENTIALS 환경 변수 설정
- [ ] Python 가상환경 생성 및 의존성 설치
- [ ] 백엔드 서버 실행
- [ ] 프론트엔드 의존성 설치 및 실행

---

**자세한 내용은 `SETUP_REQUIREMENTS.md` 참고**



