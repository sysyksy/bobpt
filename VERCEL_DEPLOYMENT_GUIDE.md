# Vercel 배포 가이드 및 분석

**작성일**: 2025-11-24
**프로젝트**: BOBPT (Video Transcription & Editing Platform)

---

## 📊 배포 가능성 분석

### ✅ 프론트엔드 (React + Vite)

**결론**: **완벽하게 배포 가능** 🎉

**이유**:
- ✅ React + Vite 스택은 Vercel의 기본 지원 대상
- ✅ 정적 파일 생성 (`npm run build`)
- ✅ 자동 최적화 및 CDN 배포
- ✅ 제로 설정으로 배포 가능

**배포 방법**:
```bash
# 1. Vercel CLI 설치
npm i -g vercel

# 2. 프로젝트 루트에서 배포
vercel

# 또는 GitHub 연동으로 자동 배포
```

---

### ⚠️ 백엔드 (FastAPI + Python)

**결론**: **부분적으로 가능하지만 심각한 제약사항** ⚠️

#### Vercel의 서버리스 함수 제약사항

| 항목 | Vercel 제한 | 현재 백엔드 요구사항 | 호환성 |
|------|------------|---------------------|-------|
| **타임아웃** | Hobby: 10초<br>Pro: 60초<br>Enterprise: 900초 | STT 처리: 수분<br>동영상 처리: 수분~수십분 | ❌ 불가 |
| **메모리** | 1024MB (최대 3008MB) | OpenCV, FFmpeg: 높은 메모리 사용 | ⚠️ 제한적 |
| **파일 시스템** | Read-only (500MB 제한) | 업로드, 임시 파일 처리 | ❌ 불가 |
| **백그라운드 작업** | 불가능 | BackgroundTasks 사용 중 | ❌ 불가 |
| **WebSocket** | 제한적 | 사용 안 함 | ✅ OK |
| **패키지 크기** | 50MB (압축) | OpenCV, Whisper 등 무거운 패키지 | ❌ 초과 |

#### 현재 백엔드의 문제점

**1. 긴 처리 시간이 필요한 작업들**
```python
# 이런 작업들이 타임아웃 초과
- STT 처리 (Whisper): 1분 영상 = 약 30초~1분
- 동영상 처리: 수분
- 챕터 생성: 수십초
- 썸네일 생성: 수십초
```

**2. 백그라운드 작업 사용**
```python
@app.post("/api/youtube/process")
async def process_youtube_video(background_tasks: BackgroundTasks):
    background_tasks.add_task(process_video_task)  # ❌ Vercel에서 불가
```

**3. 로컬 파일 시스템 사용**
```python
# ❌ Vercel의 read-only 파일 시스템에서 불가
- uploads/ 디렉토리에 파일 저장
- logs/ 디렉토리에 로그 저장
- 임시 파일 생성 및 처리
```

**4. 무거운 패키지**
```python
# requirements.txt의 큰 패키지들
- openai-whisper (1GB+)
- opencv-python (100MB+)
- scikit-image (50MB+)
- yt-dlp (큰 의존성)
```

---

## 🎯 추천 배포 전략

### 옵션 1: 하이브리드 배포 (추천) ⭐

**프론트엔드**: Vercel
**백엔드**: Google Cloud Run

**장점**:
- ✅ 프론트엔드는 Vercel의 빠른 CDN과 최적화 활용
- ✅ 백엔드는 제약 없이 모든 기능 사용 가능
- ✅ 기존 Google Cloud 인프라 활용
- ✅ 오토 스케일링 및 비용 효율적

**비용**:
- Vercel: 프론트엔드 무료 (Hobby 플랜)
- Cloud Run: 사용량 기반 (첫 200만 요청 무료)

**배포 방법**:
```bash
# 1. 프론트엔드 → Vercel
cd /project-root
vercel

# 2. 백엔드 → Google Cloud Run
cd backend
gcloud run deploy bobpt-backend \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated
```

---

### 옵션 2: 완전 Google Cloud (올인원)

**프론트엔드**: Cloud Storage + Cloud CDN
**백엔드**: Cloud Run

**장점**:
- ✅ 모든 리소스가 하나의 플랫폼에 통합
- ✅ 네트워크 레이턴시 최소화
- ✅ IAM 기반 통합 보안
- ✅ Firestore/Storage와 동일한 프로젝트

**비용**:
- 약간 더 높을 수 있지만 통합 관리 가능

---

### 옵션 3: Vercel + 외부 작업 큐 (고급)

**프론트엔드**: Vercel
**경량 API**: Vercel Serverless Functions
**무거운 작업**: Cloud Tasks / Cloud Functions / AWS Lambda

**구조**:
```
프론트엔드 (Vercel)
    ↓
경량 API (Vercel)
    ↓ (작업 큐에 푸시)
Cloud Tasks / SQS
    ↓
Worker (Cloud Run / Lambda)
    ↓ (콜백)
프론트엔드에 알림
```

**장점**:
- ✅ Vercel의 빠른 응답 활용
- ✅ 무거운 작업은 별도 처리
- ✅ 확장성 높음

**단점**:
- ⚠️ 아키텍처 복잡도 증가
- ⚠️ 리팩토링 필요

---

## 🚀 추천: 하이브리드 배포 (옵션 1)

### 1단계: 프론트엔드 Vercel 배포

#### vercel.json 생성
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://bobpt-backend-xxxxx.run.app/api/:path*"
    }
  ],
  "env": {
    "VITE_API_URL": "https://bobpt-backend-xxxxx.run.app"
  }
}
```

#### 환경 변수 설정 (.env.production)
```env
VITE_API_URL=https://bobpt-backend-xxxxx.run.app
```

#### 배포
```bash
# GitHub 연동 (추천)
1. GitHub에 푸시
2. Vercel 대시보드에서 프로젝트 연결
3. 자동 배포

# 또는 CLI
vercel --prod
```

---

### 2단계: 백엔드 Cloud Run 배포

#### Dockerfile 생성
```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Python 의존성
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 앱 코드
COPY . .

# 포트 설정
ENV PORT=8080
EXPOSE 8080

# 실행
CMD uvicorn main:app --host 0.0.0.0 --port $PORT
```

#### .dockerignore 생성
```
__pycache__/
*.pyc
*.pyo
*.pyd
.Python
env/
venv/
.env
*.log
.git/
.gitignore
node_modules/
dist/
uploads/*
logs/*
service-account-key.json
```

#### cloudbuild.yaml (선택사항 - CI/CD)
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - 'gcr.io/$PROJECT_ID/bobpt-backend:$COMMIT_SHA'
      - '-t'
      - 'gcr.io/$PROJECT_ID/bobpt-backend:latest'
      - '.'
      - '-f'
      - 'Dockerfile'

  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - 'gcr.io/$PROJECT_ID/bobpt-backend:$COMMIT_SHA'

  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'bobpt-backend'
      - '--image'
      - 'gcr.io/$PROJECT_ID/bobpt-backend:$COMMIT_SHA'
      - '--region'
      - 'asia-northeast3'
      - '--platform'
      - 'managed'
      - '--allow-unauthenticated'
      - '--memory'
      - '2Gi'
      - '--cpu'
      - '2'
      - '--timeout'
      - '3600'
      - '--max-instances'
      - '10'
```

#### 배포 명령어
```bash
cd backend

# 1. Docker 이미지 빌드 및 푸시
gcloud builds submit --tag gcr.io/plasma-canyon-477402-i8/bobpt-backend

# 2. Cloud Run 배포
gcloud run deploy bobpt-backend \
  --image gcr.io/plasma-canyon-477402-i8/bobpt-backend \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --timeout 3600 \
  --max-instances 10 \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY,GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8

# 배포된 URL 확인
gcloud run services describe bobpt-backend --region asia-northeast3 --format 'value(status.url)'
```

---

## 📝 백엔드 코드 수정 필요사항

### 1. 파일 업로드 → 직접 GCS 업로드로 변경

**Before (로컬 저장)**:
```python
file.save(f"uploads/{filename}")
```

**After (GCS 직접 업로드)**:
```python
bucket = storage_client.bucket(BUCKET_NAME)
blob = bucket.blob(filename)
blob.upload_from_file(file)
```

### 2. 로그 → Cloud Logging

**Before (파일 로깅)**:
```python
logging.FileHandler('logs/bobpt.log')
```

**After (Cloud Logging)**:
```python
from google.cloud import logging as cloud_logging
logging_client = cloud_logging.Client()
logging_client.setup_logging()
```

### 3. 백그라운드 작업 → Cloud Tasks

**Before (FastAPI BackgroundTasks)**:
```python
background_tasks.add_task(process_video)
```

**After (Cloud Tasks)**:
```python
from google.cloud import tasks_v2

tasks_client = tasks_v2.CloudTasksClient()
task = {
    'http_request': {
        'http_method': tasks_v2.HttpMethod.POST,
        'url': f'{SERVICE_URL}/process-video-worker',
        'body': json.dumps(data).encode()
    }
}
tasks_client.create_task(parent=queue_path, task=task)
```

---

## 💰 비용 예상 (월간)

### 프론트엔드 (Vercel)

| 플랜 | 비용 | 트래픽 | 빌드 시간 |
|-----|------|--------|----------|
| **Hobby (무료)** | $0 | 100GB | 100분 |
| Pro | $20 | 1TB | 6000분 |

**추천**: Hobby 플랜으로 시작 → 트래픽 증가 시 Pro

### 백엔드 (Cloud Run)

**무료 티어**:
- 요청: 월 200만 건
- CPU: 월 360,000 vCPU-초
- 메모리: 월 720,000 GiB-초
- 네트워크: 월 1GB

**예상 비용 (월 10만 요청 기준)**:
- CPU (2 vCPU): ~$10
- 메모리 (2GB): ~$5
- 네트워크: ~$1
- **총**: ~$16/월

### 기타 Google Cloud 비용

- **Firestore**: 읽기 5만/쓰기 2만/삭제 2만 무료 → 초과 시 소액
- **Cloud Storage**: 5GB 저장 무료 → 초과 시 $0.02/GB
- **Cloud Translation**: 월 50만 자 무료 → 초과 시 $20/백만 자

**총 예상 비용**: **$20~50/월** (트래픽에 따라 변동)

---

## ⚡ 빠른 시작 (5분 배포)

### 프론트엔드 (Vercel)

```bash
# 1. package.json에 환경 변수 스크립트 추가
npm install -D dotenv-cli

# 2. .env.production 생성
echo "VITE_API_URL=https://bobpt-backend-xxxxx.run.app" > .env.production

# 3. Vercel 배포
npx vercel --prod

# 4. Vercel 대시보드에서 환경 변수 설정
# Settings → Environment Variables → VITE_API_URL 추가
```

### 백엔드 (Cloud Run)

```bash
cd backend

# 1. gcloud 인증
gcloud auth login
gcloud config set project plasma-canyon-477402-i8

# 2. Cloud Run 배포 (소스 기반 - Dockerfile 자동 생성)
gcloud run deploy bobpt-backend \
  --source . \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --memory 2Gi \
  --timeout 3600

# 3. 배포된 URL 복사하여 프론트엔드 .env에 설정
```

---

## 🔍 배포 후 확인 사항

### 프론트엔드
```bash
# Vercel URL 확인
curl https://your-app.vercel.app

# API 프록시 확인
curl https://your-app.vercel.app/api/projects
```

### 백엔드
```bash
# Cloud Run URL 확인
curl https://bobpt-backend-xxxxx.run.app/

# API 테스트
curl https://bobpt-backend-xxxxx.run.app/api/projects
```

### 로그 확인
```bash
# Cloud Run 로그
gcloud run services logs read bobpt-backend --region asia-northeast3

# 실시간 로그
gcloud run services logs tail bobpt-backend --region asia-northeast3
```

---

## 📊 대안 비교표

| 옵션 | 프론트엔드 | 백엔드 | 비용 | 복잡도 | 추천도 |
|------|----------|--------|------|--------|--------|
| **하이브리드 (Vercel + Cloud Run)** | Vercel | Cloud Run | 💰 낮음 | ⭐ 낮음 | ⭐⭐⭐⭐⭐ |
| 완전 Google Cloud | Cloud Storage | Cloud Run | 💰 중간 | ⭐⭐ 중간 | ⭐⭐⭐⭐ |
| Vercel + 작업 큐 | Vercel | Vercel + Worker | 💰💰 높음 | ⭐⭐⭐ 높음 | ⭐⭐⭐ |
| Railway | Railway | Railway | 💰💰 높음 | ⭐ 낮음 | ⭐⭐⭐ |
| Render | Render | Render | 💰 낮음 | ⭐ 낮음 | ⭐⭐⭐⭐ |

---

## 🎯 결론 및 권장사항

### ✅ 최종 추천: 하이브리드 배포

**프론트엔드**: Vercel (무료)
**백엔드**: Google Cloud Run (~$20/월)

### 이유

1. **프론트엔드**: Vercel이 제공하는 최고의 성능과 DX
   - 자동 배포
   - Edge 네트워크 (빠른 로딩)
   - 무료 SSL/CDN
   - 제로 설정

2. **백엔드**: Cloud Run이 유일한 실용적 선택
   - 현재 코드 거의 그대로 사용 가능
   - 타임아웃 제약 없음 (최대 60분)
   - 무거운 패키지 사용 가능
   - 기존 Google Cloud 인프라 활용

3. **비용 효율**: 월 $20 정도로 프로덕션급 서비스
   - Vercel 무료 티어
   - Cloud Run 무료 티어 + 사용량 기반

### 다음 단계

1. ✅ 프론트엔드 Vercel 배포 (5분)
2. ✅ 백엔드 Cloud Run 배포 (10분)
3. ✅ 프론트엔드 환경 변수 업데이트
4. ✅ CORS 설정 확인
5. ✅ 테스트 및 모니터링

---

**🎉 Vercel + Cloud Run으로 5분 안에 프로덕션 배포 가능합니다!**
