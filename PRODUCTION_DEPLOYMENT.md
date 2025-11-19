# 📦 BobPT 프로덕션 배포 가이드

완전한 프로덕션 배포 절차를 단계별로 설명합니다.

---

## 1️⃣ 배포 전 체크리스트

### 보안 검수
- [ ] JWT_SECRET 변경 (최소 32자, 무작위 문자열)
- [ ] CORS 설정에 프로덕션 도메인만 추가
- [ ] 환경 변수 파일 보안 검토
- [ ] 데이터베이스 보안 규칙 설정
- [ ] API 레이트 제한 설정

### 성능 최적화
- [ ] Frontend 빌드 최적화 (번들 크기 확인)
- [ ] Backend 메모리 설정 (권장: 2GB)
- [ ] 데이터베이스 인덱스 설정
- [ ] CDN 설정 (이미지, 정적 파일)

### 모니터링 설정
- [ ] Cloud Logging 설정
- [ ] Error Tracking 설정
- [ ] Performance Monitoring 설정
- [ ] 알림 규칙 설정

---

## 2️⃣ 단계별 배포

### Step 1: 프로덕션 환경 변수 설정

#### Backend (.env.production)
```bash
# 강력한 JWT 시크릿 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 출력 예: a3f8b2c9d1e4f7a0b8c2d5e7f0a1b3c5d7e8f9a0b1c2d3e4f5a6b7c8d9e0

# .env.production에 입력
JWT_SECRET=a3f8b2c9d1e4f7a0b8c2d5e7f0a1b3c5d7e8f9a0b1c2d3e4f5a6b7c8d9e0
```

#### Firestore 보안 규칙
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 사용자만 자신의 데이터 접근 가능
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    // 사용자만 자신의 프로젝트 접근 가능
    match /projects/{projectId} {
      allow read, write: if
        request.auth != null &&
        resource.data.userId == request.auth.token.claims.userId;
    }
  }
}
```

#### Cloud Storage 보안 규칙
```gsutil
# 버킷 정책 설정
gsutil lifecycle set - gs://bob-sto <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 90}  # 90일 후 삭제
      }
    ]
  }
}
EOF

# CORS 설정
gsutil cors set cors.json gs://bob-sto
```

cors.json:
```json
[
  {
    "origin": ["https://yourdomain.com"],
    "method": ["GET", "PUT", "POST"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

---

### Step 2: Backend 배포 (Cloud Run)

#### Option A: Docker 사용 (권장)

```bash
# 1. Dockerfile 확인
cat backend/Dockerfile

# 2. Docker 이미지 빌드
cd backend
docker build -t gcr.io/YOUR_PROJECT_ID/bob-backend:latest .

# 3. Container Registry에 푸시
docker push gcr.io/YOUR_PROJECT_ID/bob-backend:latest

# 4. Cloud Run에 배포
gcloud run deploy bob-backend \
  --image gcr.io/YOUR_PROJECT_ID/bob-backend:latest \
  --region asia-northeast1 \
  --memory 2Gi \
  --cpu 2 \
  --allow-unauthenticated \
  --set-env-vars OPENAI_API_KEY=sk-svcacct-...,JWT_SECRET=... \
  --timeout 600s \
  --max-instances 100

# 5. 배포 확인
gcloud run describe bob-backend --region asia-northeast1
```

#### Option B: App Engine 사용

```bash
# 1. app.yaml 생성
cat > backend/app.yaml << EOF
runtime: nodejs18
env: standard
env_variables:
  NODE_ENV: "production"
  OPENAI_API_KEY: "sk-svcacct-..."
  JWT_SECRET: "your-secret-key"

handlers:
  - url: /.*
    script: auto
EOF

# 2. 배포
gcloud app deploy backend/app.yaml --region asia-northeast1

# 3. 배포 확인
gcloud app versions list
gcloud app browse
```

---

### Step 3: Cloud Function 배포 (STT 처리)

```bash
# 1. 배포 준비
cd cloud-functions

# 2. requirements.txt 확인
cat requirements.txt

# 3. Cloud Function 배포
gcloud functions deploy trigger_stt \
  --runtime python311 \
  --trigger-resource bob-sto \
  --trigger-event google.storage.object.finalize \
  --region asia-northeast1 \
  --entry-point trigger_stt \
  --memory 2048MB \
  --cpu 2 \
  --timeout 600 \
  --set-env-vars OPENAI_API_KEY=sk-svcacct-... \
  --retry

# 4. 배포 확인
gcloud functions describe trigger_stt --region asia-northeast1

# 5. 로그 확인
gcloud functions logs read trigger_stt --region asia-northeast1 --limit 100
```

---

### Step 4: Frontend 배포

#### Option A: Firebase Hosting (권장)

```bash
# 1. Firebase 프로젝트 초기화
firebase init hosting

# 2. 빌드
npm run build

# 3. 배포
firebase deploy --only hosting

# 4. 배포 URL 확인
firebase open hosting:site
```

#### Option B: Vercel

```bash
# 1. Vercel CLI 설치
npm install -g vercel

# 2. 배포
vercel --prod

# 3. 환경 변수 설정 (필요시)
vercel env add VITE_API_URL https://api.yourdomain.com
```

#### Option C: Netlify

```bash
# 1. Netlify CLI 설치
npm install -g netlify-cli

# 2. 배포
netlify deploy --prod --dir=dist

# 3. 설정
# netlify.toml 파일 생성:
[build]
command = "npm run build"
publish = "dist"

[[redirects]]
from = "/api/*"
to = "https://bob-backend.cloudfun.net/api/:splat"
status = 200
```

---

### Step 5: 도메인 및 SSL 설정

#### Cloudflare (DNS + SSL)

```bash
# 1. DNS 레코드 설정
# Type: A
# Name: yourdomain.com
# Value: Cloud Run/App Engine IP

# 2. SSL/TLS 암호화 설정
# Cloudflare 대시보드 → SSL/TLS → Flexible (최소) 또는 Full

# 3. 캐싱 설정
# Page Rules → Cache Level: Ignore Query String
```

---

## 3️⃣ 배포 후 확인

### 헬스 체크

```bash
# Backend 상태 확인
curl https://bob-backend.cloudfun.net/api/health

# 응답 예상:
# {"status":"ok","message":"백엔드 서버 정상 작동 중"}
```

### 로그 확인

```bash
# Cloud Run 로그
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=bob-backend" \
  --limit 50 \
  --region asia-northeast1

# Cloud Function 로그
gcloud logging read "resource.type=cloud_function AND resource.labels.function_name=trigger_stt" \
  --limit 50 \
  --region asia-northeast1
```

### 성능 모니터링

```bash
# Cloud Monitoring 설정
gcloud monitoring dashboards create --config-from-file=monitoring-config.json

# 메트릭 확인
gcloud monitoring metrics-descriptors list
```

---

## 4️⃣ 자동 배포 설정 (CI/CD)

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Build Frontend
        run: |
          npm install
          npm run build

      - name: Deploy Frontend
        run: |
          firebase deploy --only hosting \
            --token ${{ secrets.FIREBASE_TOKEN }}

      - name: Deploy Backend
        run: |
          gcloud auth activate-service-account --key-file=${{ secrets.GCP_KEY }}
          gcloud run deploy bob-backend \
            --source . \
            --region asia-northeast1
```

### Google Cloud Build

```yaml
# cloudbuild.yaml
steps:
  # Build Frontend
  - name: 'node:18'
    entrypoint: npm
    args: ['install']
    dir: 'frontend'

  - name: 'node:18'
    entrypoint: npm
    args: ['run', 'build']
    dir: 'frontend'

  # Build & Deploy Backend
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/bob-backend', '.']
    dir: 'backend'

  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/bob-backend']

  - name: 'gcr.io/cloud-builders/gke-deploy'
    args: ['run', '--filename=backend/', '--location=asia-northeast1', '--cluster=bob-cluster']

images:
  - 'gcr.io/$PROJECT_ID/bob-backend'
```

---

## 5️⃣ 모니터링 및 유지보수

### 주기적 점검

```bash
# 일일 점검
- API 응답 시간 모니터링
- 에러율 확인
- 로그 검토

# 주간 점검
- 데이터베이스 성능 분석
- 스토리지 사용량 확인
- 보안 로그 검토

# 월간 점검
- 비용 분석
- 백업 상태 확인
- 성능 최적화 검토
```

### 스케일링 정책

```bash
# CPU 기반 자동 스케일링
gcloud run services update bob-backend \
  --region asia-northeast1 \
  --concurrency 80 \
  --cpu-throttling \
  --min-instances 1 \
  --max-instances 100

# 트래픽 기반 스케일링
gcloud functions deploy trigger_stt \
  --region asia-northeast1 \
  --memory 2048MB \
  --timeout 600s \
  --max-instances 100
```

---

## 🚨 비상 대응

### 서비스 중단 시

```bash
# 1. 상태 확인
gcloud run services describe bob-backend --region asia-northeast1

# 2. 로그 확인
gcloud logging read "severity=ERROR" --limit 50

# 3. 이전 버전으로 롤백
gcloud run deploy bob-backend \
  --image gcr.io/$PROJECT_ID/bob-backend:PREVIOUS_VERSION

# 4. 서비스 재시작
gcloud run services update bob-backend --region asia-northeast1
```

### 데이터 복구

```bash
# Firestore 백업
gcloud firestore export gs://bob-backups/backup-$(date +%Y%m%d)

# Cloud Storage 버킷 복구
gsutil -m cp -r gs://bob-backups/backup-date gs://bob-sto
```

---

## 📊 비용 최적화

```bash
# 1. 사용량 분석
gcloud billing accounts list
gcloud billing projects list

# 2. 비용 예측
gcloud compute project-info describe --project=YOUR_PROJECT_ID

# 3. 비용 절감 방안
- Cloud Run 리소스 최적화 (필요한 만큼만)
- 저장소 정책 설정 (오래된 데이터 삭제)
- 요청 제한 설정 (DDoS 방지)
- 이미지 압축 (저장소 용량 절감)
```

---

## ✅ 배포 완료 체크리스트

- [ ] 모든 환경 변수 설정 완료
- [ ] 백엔드 배포 및 상태 확인
- [ ] Cloud Function 배포 및 로그 확인
- [ ] Frontend 배포 및 접속 확인
- [ ] 도메인 및 SSL 설정 완료
- [ ] Firestore 보안 규칙 설정
- [ ] Cloud Storage 보안 규칙 설정
- [ ] 모니터링 대시보드 설정
- [ ] 백업 설정 완료
- [ ] CI/CD 파이프라인 설정

---

**배포 완료! 🎉 이제 BobPT가 프로덕션 환경에서 실행됩니다!**

문제 발생 시 로그와 모니터링 대시보드를 확인하세요.
