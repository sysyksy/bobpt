# 🚀 하이브리드 배포 완료 가이드

**배포 날짜**: 2025-11-24
**배포 방식**: 프론트엔드 (Vercel) + 백엔드 (Google Cloud Run)

---

## 📊 배포 현황

### ✅ 완료된 작업

1. **백엔드 파일 생성**
   - ✅ `backend/Dockerfile` - Cloud Run 배포용 Docker 설정
   - ✅ `backend/.dockerignore` - 불필요한 파일 제외

2. **프론트엔드 파일 생성**
   - ✅ `vercel.json` - Vercel 배포 설정
   - ✅ `.env.production` - 프로덕션 환경 변수

3. **백엔드 배포 (Cloud Run)**
   - 🔄 진행 중...
   - 리전: asia-northeast3 (서울)
   - 메모리: 2GB
   - CPU: 2 vCPU
   - 타임아웃: 3600초 (1시간)
   - 최대 인스턴스: 10

---

## 🔄 현재 진행 중: 백엔드 배포

### 배포 명령어
```bash
cd backend
gcloud run deploy bobpt-backend \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8" \
  --quiet
```

### 배포 단계
1. ✅ Artifact Registry 저장소 생성
2. 🔄 Docker 이미지 빌드 중... (약 3-5분)
3. ⏳ Cloud Run에 이미지 푸시
4. ⏳ 서비스 배포 및 시작

---

## 📝 배포 완료 후 작업

### 1. 백엔드 URL 확인

배포가 완료되면 다음 명령어로 URL 확인:
```bash
gcloud run services describe bobpt-backend \
  --region asia-northeast3 \
  --format 'value(status.url)'
```

예상 URL: `https://bobpt-backend-xxxxx-an.a.run.app`

### 2. 프론트엔드 환경 변수 업데이트

**`.env.production` 파일 수정**:
```env
VITE_API_URL=https://bobpt-backend-xxxxx-an.a.run.app
```

**`vercel.json` 파일 수정**:
```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://bobpt-backend-xxxxx-an.a.run.app/api/:path*"
    }
  ],
  "env": {
    "VITE_API_URL": "https://bobpt-backend-xxxxx-an.a.run.app"
  }
}
```

### 3. CORS 설정 업데이트

백엔드 배포가 완료되면 Vercel에서 프론트엔드를 배포한 후, 그 URL을 백엔드의 CORS 설정에 추가해야 합니다.

**`backend/.env` 또는 Cloud Run 환경 변수에 추가**:
```env
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173
```

또는 `backend/config/settings.py` 수정:
```python
cors_origins: List[str] = [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://your-app.vercel.app",  # Vercel URL 추가
]
```

### 4. 프론트엔드 Vercel 배포

#### 옵션 A: GitHub 연동 (추천)

1. GitHub에 푸시:
```bash
git add .
git commit -m "Add deployment configuration"
git push origin main
```

2. Vercel 대시보드 (https://vercel.com)
   - "Add New Project" 클릭
   - GitHub 레포지토리 선택
   - 환경 변수 설정:
     - `VITE_API_URL` = `https://bobpt-backend-xxxxx-an.a.run.app`
   - "Deploy" 클릭

#### 옵션 B: Vercel CLI

```bash
# Vercel CLI 설치 (아직 안 했다면)
npm install -g vercel

# 프로젝트 루트에서 실행
vercel

# 질문에 답변:
# - Set up and deploy? Y
# - Which scope? (계정 선택)
# - Link to existing project? N
# - Project name? bobpt (또는 원하는 이름)
# - Directory? ./ (엔터)
# - Override settings? N

# 환경 변수 설정
vercel env add VITE_API_URL production
# 값: https://bobpt-backend-xxxxx-an.a.run.app

# 프로덕션 배포
vercel --prod
```

### 5. 배포 확인

#### 백엔드 테스트
```bash
# Health check
curl https://bobpt-backend-xxxxx-an.a.run.app/

# API 테스트
curl https://bobpt-backend-xxxxx-an.a.run.app/api/projects
```

#### 프론트엔드 테스트
```bash
# Vercel URL로 접속
https://your-app.vercel.app

# API 프록시 테스트
curl https://your-app.vercel.app/api/projects
```

---

## 🔍 문제 해결

### 백엔드 배포 실패 시

**로그 확인**:
```bash
gcloud run services logs read bobpt-backend --region asia-northeast3 --limit 50
```

**재배포**:
```bash
cd backend
gcloud run deploy bobpt-backend \
  --source . \
  --region asia-northeast3 \
  --quiet
```

### CORS 에러 발생 시

**증상**: 프론트엔드에서 API 호출 시 CORS 에러

**해결**:
1. 백엔드 CORS 설정에 Vercel URL 추가
2. Cloud Run 환경 변수 업데이트:
```bash
gcloud run services update bobpt-backend \
  --region asia-northeast3 \
  --set-env-vars "CORS_ORIGINS=https://your-app.vercel.app,http://localhost:5173"
```

### 프론트엔드에서 API 호출 실패

**원인**: 환경 변수 미설정 또는 잘못된 URL

**확인**:
1. `.env.production` 파일 확인
2. `vercel.json` 파일 확인
3. Vercel 대시보드 → Settings → Environment Variables 확인

**해결**:
```bash
# Vercel에서 환경 변수 업데이트 후 재배포
vercel --prod
```

---

## 📊 배포 완료 체크리스트

### 백엔드 (Cloud Run)
- [ ] Docker 이미지 빌드 완료
- [ ] Cloud Run 서비스 배포 완료
- [ ] URL 확인 및 복사
- [ ] Health check 성공 (`/` 엔드포인트)
- [ ] API 테스트 성공 (`/api/projects`)

### 프론트엔드 (Vercel)
- [ ] `.env.production` 업데이트 (백엔드 URL)
- [ ] `vercel.json` 업데이트 (백엔드 URL)
- [ ] Vercel에 배포
- [ ] 환경 변수 설정 (Vercel 대시보드)
- [ ] 프론트엔드 접속 테스트
- [ ] API 호출 테스트

### CORS 설정
- [ ] 백엔드에 프론트엔드 URL 추가
- [ ] CORS preflight 테스트
- [ ] 실제 API 호출 테스트

### 최종 확인
- [ ] 프로젝트 목록 조회 작동
- [ ] 트랜스크립트 조회 작동
- [ ] 챕터 생성 작동
- [ ] 파일 업로드 작동
- [ ] 로그 확인 (에러 없음)

---

## 🎯 다음 단계

### 모니터링 설정

**Cloud Run 로그 확인**:
```bash
# 실시간 로그
gcloud run services logs tail bobpt-backend --region asia-northeast3

# 최근 로그
gcloud run services logs read bobpt-backend --region asia-northeast3 --limit 100
```

**Vercel 로그 확인**:
- Vercel 대시보드 → 프로젝트 선택 → Deployments → 최근 배포 클릭 → Logs

### 커스텀 도메인 설정 (선택사항)

**Vercel**:
1. 도메인 구매 (예: bobpt.com)
2. Vercel 대시보드 → Settings → Domains
3. 도메인 추가 및 DNS 설정

**Cloud Run**:
1. Cloud Run → bobpt-backend → Custom Domains
2. 도메인 추가 (예: api.bobpt.com)
3. DNS 레코드 추가

### CI/CD 자동화 (선택사항)

**GitHub Actions 워크플로우**:
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: google-github-actions/setup-gcloud@v1
      - run: |
          cd backend
          gcloud run deploy bobpt-backend \
            --source . \
            --region asia-northeast3
```

---

## 💰 예상 비용

### 프론트엔드 (Vercel)
- **Hobby 플랜**: $0/월
  - 트래픽: 100GB
  - 빌드: 100분/월

### 백엔드 (Cloud Run)
- **무료 티어**:
  - 요청: 월 200만 건
  - CPU: 월 360,000 vCPU-초
  - 메모리: 월 720,000 GiB-초

- **예상 비용** (월 10만 요청 기준):
  - CPU (2 vCPU): ~$10
  - 메모리 (2GB): ~$5
  - 네트워크: ~$1
  - **총**: ~$16/월

### 기타 Google Cloud
- **Firestore**: 대부분 무료 티어 내
- **Cloud Storage**: 5GB까지 무료
- **Cloud Translation**: 50만 자/월 무료

**총 예상 비용**: **$20~30/월**

---

## 📞 지원

문제가 발생하면:
1. 로그 확인 (Cloud Run / Vercel)
2. 환경 변수 확인
3. CORS 설정 확인
4. 네트워크 연결 확인

---

**🎉 배포 완료 후 프로덕션 서비스 시작!**

배포가 완료되면 전 세계 어디서나 빠르게 접속 가능한 서비스가 됩니다!
