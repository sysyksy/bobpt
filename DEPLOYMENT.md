# BobPT 배포 가이드

## 🎯 프로덕션 배포 체크리스트

### 1️⃣ 사전 준비 사항

- [x] OpenAI API 키 발급 (https://platform.openai.com/account/api-keys)
- [x] Google Cloud 프로젝트 설정
- [x] Firestore 및 Cloud Storage 활성화
- [ ] 프로덕션 도메인 준비

### 2️⃣ 백엔드 배포 (Google Cloud Run)

#### Step 1: Docker 이미지 준비

```bash
cd backend

# Dockerfile 생성 (아래 내용 참조)
# 그 후 이미지 빌드
docker build -t bob-backend:latest .
```

#### Step 2: Google Cloud Run에 배포

```bash
# 1. 인증
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# 2. 이미지 빌드 및 푸시
gcloud builds submit --tag gcr.io/YOUR_GCP_PROJECT_ID/bob-backend

# 3. Cloud Run 배포
gcloud run deploy bob-backend \
  --image gcr.io/YOUR_GCP_PROJECT_ID/bob-backend \
  --platform managed \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=your-api-key,GCS_BUCKET=bob-sto,CORS_ORIGIN=https://your-frontend-domain.com"
```

#### Step 3: 환경 변수 설정

Cloud Run 배포 후 환경 변수를 다음과 같이 설정합니다:

```
PORT=8080
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
GCS_BUCKET=bob-sto
MAX_FILE_SIZE=500
REQUEST_TIMEOUT=300000
OPENAI_API_KEY=sk-xxxxx...
WHISPER_MODEL=whisper-1
```

### 3️⃣ 프론트엔드 배포 (Vercel)

#### Step 1: Vercel 프로젝트 연동

```bash
npm install -g vercel
vercel login
```

#### Step 2: 프로젝트 루트에서 배포

```bash
# 프로젝트 루트 디렉토리에서
vercel
```

#### Step 3: 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수를 설정합니다:

```
VITE_API_URL=https://bob-backend-xxxxx.run.app
```

프론트엔드 코드에서 API 호출할 때:

```javascript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
```

#### Step 4: 프로덕션 도메인 설정

Vercel 대시보드에서 커스텀 도메인을 추가합니다.

### 4️⃣ Cloud Function 배포 (GCP)

#### Step 1: 함수 배포

```bash
gcloud functions deploy trigger_stt \
  --runtime python311 \
  --trigger-resource bob-sto \
  --trigger-event google.storage.object.finalize \
  --entry-point trigger_stt \
  --set-env-vars "OPENAI_API_KEY=your-api-key" \
  --timeout 1800s \
  --memory 1024MB
```

#### Step 2: 필요 라이브러리 설정

`requirements.txt`에 다음이 포함되었는지 확인:

```
functions-framework==3.*
google-cloud-storage
google-cloud-firestore
ffmpeg-python
openai>=1.0.0
```

### 5️⃣ CORS 설정

GCS 버킷의 CORS 설정을 프로덕션 도메인으로 업데이트합니다:

```bash
gsutil cors set cors.json gs://bob-sto
```

`cors.json`:
```json
[
  {
    "origin": ["https://your-frontend-domain.com"],
    "method": ["GET", "HEAD", "DELETE", "PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

### 6️⃣ API 엔드포인트 변경

프론트엔드의 API 클라이언트에서 백엔드 URL을 변경합니다:

**`src/apiClient.ts` 예시:**

```typescript
const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://bob-backend-xxxxx.run.app'
  : 'http://localhost:5001';

export async function getProjects() {
  const response = await axios.get(`${API_BASE_URL}/api/projects`);
  return response.data;
}
```

---

## 🔧 로컬 테스트

배포 전 로컬에서 프로덕션 환경을 테스트할 수 있습니다:

```bash
# 백엔드
cd backend
NODE_ENV=production node server.js

# 프론트엔드 (다른 터미널)
npm run build
npm run preview  # 프로덕션 빌드 미리보기
```

---

## 📊 배포 후 모니터링

### Google Cloud Console
- Cloud Run: 트래픽, 에러율, 응답 시간 모니터링
- Cloud Logging: 백엔드 로그 확인
- Cloud Trace: API 성능 추적

### Vercel Dashboard
- 배포 히스토리 확인
- 성능 분석
- 에러 모니터링

---

## 🚨 주의 사항

1. **API 키 보안**: 절대 코드에 API 키를 하드코딩하지 마세요
2. **CORS 설정**: 프로덕션 도메인만 허용하도록 제한
3. **파일 크기**: Cloud Run 메모리 제한 (최대 8GB) 고려
4. **타임아웃**: STT 처리에 시간이 걸리므로 적절히 설정
5. **비용**: OpenAI Whisper API 사용량 모니터링

---

## 💬 트러블슈팅

### 1. CORS 에러
- 백엔드의 `CORS_ORIGIN`을 프론트엔드 도메인으로 설정
- GCS 버킷 CORS 설정 확인

### 2. Whisper API 에러 (401)
- OpenAI API 키 확인
- API 키에 충분한 크레딧이 있는지 확인

### 3. 파일 업로드 실패
- Cloud Storage 버킷 권한 확인
- 파일 크기 제한 확인 (최대 500MB)

### 4. STT 처리 지연
- Cloud Function 메모리 증설 (1GB → 2GB)
- 타임아웃 설정 증가 (1800s)

---

## 📞 지원

문제가 발생하면:
1. Cloud Logging에서 에러 메시지 확인
2. API 응답 상태 코드 확인
3. OpenAI API 상태 페이지 확인 (https://status.openai.com)
