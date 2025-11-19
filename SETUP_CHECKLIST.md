# 🚀 BobPT 최종 설정 체크리스트

이 문서는 BobPT를 완전히 구동하기 위해 필요한 모든 설정 항목을 정리합니다.

---

## ✅ 완료된 항목들

### 1. Backend 설정
- ✅ Express.js 서버 구축 (port 5001)
- ✅ JWT 인증 시스템 구현
  - 회원가입 (`/api/auth/register`)
  - 로그인 (` /api/auth/login`)
  - 사용자 정보 조회 (` /api/auth/me`)
- ✅ Google Cloud Storage 연동 (파일 업로드/다운로드)
- ✅ Firestore 데이터베이스 연동
- ✅ OpenAI Whisper API 통합
- ✅ 오디오 강화 파이프라인 (5단계)
- ✅ CORS 보안 설정
- ✅ 입력값 검증 및 path traversal 방지

### 2. Frontend 설정
- ✅ React + TypeScript 프로젝트
- ✅ 인증 페이지 (로그인/회원가입)
- ✅ YouTube 자막 추출기
- ✅ 로컬 비디오 업로드
- ✅ 프로젝트 목록 관리
- ✅ 자막 편집 및 번역 기능
- ✅ Axios 인터셉터로 토큰 자동 추가

### 3. Cloud Function (Python)
- ✅ 비디오 STT 처리 파이프라인
- ✅ FFmpeg으로 오디오 추출
- ✅ Whisper API로 음성 인식
- ✅ 오디오 강화 전처리
- ✅ Firestore 결과 저장
- ✅ 에러 핸들링

---

## 🔧 필수 구성 항목 체크리스트

### 1️⃣ Google Cloud Platform 설정

#### 1.1 프로젝트 생성
- [ ] GCP 콘솔에서 새 프로젝트 생성
- [ ] 프로젝트 ID: 기록해두기

#### 1.2 필요한 API 활성화
```bash
# 다음 API들을 활성화해야 합니다:
- Cloud Storage API
- Firestore API
- Cloud Functions API
- Cloud Build API
```

**설정 방법:**
1. GCP 콘솔 → API 및 서비스 → 라이브러리
2. 각 API 검색 후 '활성화' 클릭

#### 1.3 Service Account 생성
```bash
# GCP 콘솔 → IAM 및 관리자 → Service Account
1. '+ Service Account 만들기' 클릭
2. 서비스 계정 이름 입력 (예: bob-sa)
3. 역할 선택:
   - Editor (모든 권한, 개발용)
   - 또는 개별 권한 설정 (프로덕션)
4. 키 생성:
   - JSON 형식으로 다운로드
   - `~/.config/gcloud/bob-key.json` 에 저장
```

#### 1.4 로컬 인증 설정
```bash
# gcloud CLI 설치 (아직 안 했다면)
# https://cloud.google.com/sdk/docs/install

# 인증 설정
gcloud auth activate-service-account --key-file=~/.config/gcloud/bob-key.json

# 기본 프로젝트 설정
gcloud config set project YOUR_PROJECT_ID
```

#### 1.5 Firestore 데이터베이스 생성
```
1. GCP 콘솔 → Firestore Database
2. '+ 데이터베이스 만들기' 클릭
3. 위치: asia-northeast1 (서울) 선택
4. 모드: 네이티브 모드 선택
5. 보안 규칙: 개발용은 '테스트 모드', 프로덕션은 '프로덕션 모드'
```

#### 1.6 Cloud Storage Bucket 생성
```
1. GCP 콘솔 → Cloud Storage
2. '+ 버킷 만들기' 클릭
3. 버킷 이름: bob-sto (또는 원하는 이름, 고유해야 함)
4. 위치: asia-northeast1 (서울)
5. 스토리지 클래스: Standard
6. 액세스 제어: 균일한 액세스 제어
```

### 2️⃣ Backend 환경 변수 설정

#### 파일: `backend/.env` (개발 환경)

```env
# 백엔드 서버 설정
PORT=5001
NODE_ENV=development

# CORS 설정
CORS_ORIGIN=http://localhost:5173

# Google Cloud 설정
GCS_BUCKET=bob-sto  # ⬅️ 위에서 생성한 버킷 이름

# OpenAI API
OPENAI_API_KEY=OPENAI_API_KEY=sk-proj-your-api-key-here


# JWT 설정
JWT_SECRET=your-super-secret-jwt-key-change-in-production  # ⬅️ 변경 권장
JWT_EXPIRY=7d
```

#### 파일: `backend/.env.production` (프로덕션 환경)

```env
PORT=5001
NODE_ENV=production

# 프로덕션 도메인으로 변경
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

GCS_BUCKET=bob-sto

OPENAI_API_KEY=sk-svcacct-...

# 프로덕션용 강력한 시크릿 키
JWT_SECRET=PROD_VERY_LONG_RANDOM_STRING_MIN_32_CHARS_CHANGE_THIS
JWT_EXPIRY=7d
```

### 3️⃣ Frontend 환경 설정

**확인 사항:**
- ✅ Frontend는 `http://localhost:5173` 에서 실행 (Vite 개발 서버)
- ✅ Backend와 통신은 `/api` 프록시로 자동 전달됨 (vite.config.ts 설정됨)

#### vite.config.ts 확인:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:5001',
      changeOrigin: true
    }
  }
}
```

---

## 🧪 테스트 순서 (중요!)

### Step 1: 로컬 개발 환경 테스트

#### 1.1 Backend 시작
```bash
cd backend
npm install
npm start

# 출력: 🚀 백엔드 서버 실행 중 http://localhost:5001
```

#### 1.2 Frontend 시작 (새 터미널)
```bash
npm run dev

# 출력: VITE v... ready in ... ms
#       http://localhost:5173/
```

#### 1.3 브라우저에서 테스트
```
1. http://localhost:5173 접속
2. 회원가입 페이지에서 테스트 계정 생성
3. 로그인 성공 확인
4. "📹 로컬 업로드" 탭에서 테스트 비디오 업로드
5. Cloud Function이 STT 처리 (로그 확인)
6. "📂 내 프로젝트"에서 자막 확인
7. "🌐 번역" 버튼으로 번역 테스트
```

### Step 2: 각 기능별 테스트

#### 회원가입/로그인
- [ ] 이메일 형식 검증
- [ ] 비밀번호 최소 8자 검증
- [ ] 중복 이메일 방지
- [ ] 로그인 성공 후 JWT 토큰 저장
- [ ] 로그아웃 후 토큰 삭제

#### 비디오 업로드
- [ ] 파일 크기 제한 (500MB)
- [ ] 언어 선택 (한국어, 영어 등)
- [ ] 업로드 진행률 표시
- [ ] 업로드 완료 후 자동 STT 처리 시작

#### 자막 추출
- [ ] 업로드 후 5초마다 상태 확인
- [ ] STT 처리 완료 시 자막 표시
- [ ] 자막 줄 수 확인 (단어별 또는 문장별)

#### 번역
- [ ] 자막 언어 선택
- [ ] 번역 버튼 클릭
- [ ] 번역 결과 표시

#### YouTube 자막 추출
- [ ] YouTube URL 입력
- [ ] 자막 추출 성공
- [ ] SRT 파일 다운로드

---

## 🚀 배포 (프로덕션)

### Cloud Function 배포

```bash
# 1. Cloud Function 배포
gcloud functions deploy trigger_stt \
  --runtime python311 \
  --trigger-resource bob-sto \
  --trigger-event google.storage.object.finalize \
  --region asia-northeast1 \
  --entry-point trigger_stt \
  --memory 2048MB \
  --timeout 600s \
  --set-env-vars OPENAI_API_KEY=sk-svcacct-...

# 2. 배포 확인
gcloud functions list --region asia-northeast1

# 3. 로그 확인
gcloud functions logs read trigger_stt --region asia-northeast1 --limit 50
```

### Frontend 빌드 및 배포

```bash
# 1. 프로덕션 빌드
npm run build

# 2. dist 폴더를 웹 호스팅 서비스에 배포
#    (Firebase Hosting, Vercel, Netlify, etc.)

# Firebase Hosting 예시:
firebase deploy --only hosting
```

### Backend 배포

```bash
# 1. Docker 이미지 빌드
docker build -t bob-backend .

# 2. Cloud Run에 배포
gcloud run deploy bob-backend \
  --image bob-backend:latest \
  --region asia-northeast1 \
  --memory 2Gi \
  --allow-unauthenticated \
  --set-env-vars-file .env.production

# 또는 App Engine에 배포
gcloud app deploy --env-vars-file .env.production
```

---

## 🔍 트러블슈팅

### 문제: "GCS 업로드 실패"
```
해결책:
1. GCS 버킷 이름 확인
2. Service Account 권한 확인 (Storage.objectCreator)
3. 버킷 CORS 설정 확인
```

### 문제: "Whisper API 호출 실패"
```
해결책:
1. OPENAI_API_KEY 확인 (유효한 키인지)
2. API 사용량 확인 (할당량 초과 아닌지)
3. 네트워크 연결 확인
```

### 문제: "자막이 3줄만 나옴"
```
해결책:
1. Cloud Function 로그 확인
2. Whisper 응답에 단어 타임스탐프 있는지 확인
3. Firestore에 저장된 데이터 확인
```

### 문제: "인증 실패 (401 에러)"
```
해결책:
1. JWT 토큰 만료 확인
2. 로그아웃 후 재로그인
3. 브라우저 localStorage에서 토큰 확인
```

---

## 📋 설정 완료 체크리스트

### Google Cloud
- [ ] GCP 프로젝트 생성
- [ ] Service Account 생성 및 키 다운로드
- [ ] Firestore 생성
- [ ] Cloud Storage 버킷 생성 (bob-sto)
- [ ] Cloud Functions API 활성화
- [ ] Cloud Build API 활성화

### Backend
- [ ] `backend/.env` 설정 (OPENAI_API_KEY, JWT_SECRET)
- [ ] `npm install` 실행
- [ ] `npm start` 로 로컬 테스트
- [ ] API 엔드포인트 확인

### Frontend
- [ ] `npm install` 실행
- [ ] `npm run dev` 로 개발 서버 시작
- [ ] 브라우저에서 테스트

### Cloud Function
- [ ] Python 코드 배포 (또는 로컬 테스트)
- [ ] 트리거 설정 (bob-sto 버킷)
- [ ] 환경 변수 설정

---

## 🎉 완성!

모든 항목이 체크되면 BobPT는 완벽하게 작동합니다! 🚀

**다음 단계:**
1. 사용자 피드백 수집
2. 성능 최적화
3. 기능 확장
4. 모니터링 및 유지보수

---

**문의사항이 있으면 언제든지 알려주세요!** 😊
