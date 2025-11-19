# BobPT 빠른 시작 가이드

## 🚀 5분 안에 시작하기

### 사전 요구 사항

- Node.js 18+ 설치
- Python 3.9+ 설치 (Cloud Function 용)
- OpenAI API 키 ([발급 받기](https://platform.openai.com/account/api-keys))
- Google Cloud 프로젝트 설정 완료

---

## 📦 Step 1: 프로젝트 설정

```bash
# 1. 저장소 클론 (이미 완료했다면 스킵)
git clone <your-repo-url>
cd bobpt

# 2. 프론트엔드 의존성 설치
npm install

# 3. 백엔드 의존성 설치
cd backend
npm install
cd ..
```

---

## 🔑 Step 2: 환경 변수 설정

### 백엔드 환경 설정

```bash
# 1. backend/.env 파일 생성
cd backend
cp .env.example .env

# 2. .env 파일 편집
# OPENAI_API_KEY=sk-xxxxx... (발급 받은 키 입력)
# CORS_ORIGIN=http://localhost:5173 (기본값 - 변경 불필요)
```

**필수 입력:**
```
OPENAI_API_KEY=sk-xxxxx...  # OpenAI API 키
```

### GCP 인증

```bash
# Google Cloud 인증
gcloud auth application-default login

# 또는 서비스 계정 JSON 키 사용
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
```

---

## ▶️ Step 3: 로컬 개발 서버 시작

### 터미널 1: 백엔드 시작

```bash
cd backend
npm run dev
```

**예상 출력:**
```
🔧 백엔드 서버 초기화 중...
   포트: 5001
   CORS: http://localhost:5173
   버킷: bob-sto
   STT 모델: ✅ OpenAI Whisper

[200] GET /api/health - 2ms

╔════════════════════════════════════════╗
║  🚀 백엔드 서버 실행 중                ║
║  📍 http://localhost:5001               ║
╚════════════════════════════════════════╝
```

### 터미널 2: 프론트엔드 시작

```bash
# 프로젝트 루트에서
npm run dev
```

**예상 출력:**
```
  VITE v5.4.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

---

## 🎯 Step 4: 기능 테스트

### 1️⃣ 건강 체크
```bash
curl http://localhost:5001/api/health
# 응답: {"status":"ok","message":"백엔드 서버 정상 작동 중"}
```

### 2️⃣ 비디오 업로드 테스트

브라우저에서 `http://localhost:5173` 접속

1. **로컬 비디오 업로드** 탭으로 이동
2. 비디오 파일 선택 (테스트 파일: `ETC/abc.mp4`)
3. 언어 선택 (기본값: 한국어)
4. "업로드" 버튼 클릭
5. Whisper STT 처리 대기 (1-2분 소요)

### 3️⃣ YouTube 자막 추출 테스트

1. **YouTube 자막 추출** 탭으로 이동
2. YouTube URL 입력 (예: `https://www.youtube.com/watch?v=...`)
3. "자막 추출" 버튼 클릭

---

## 🔍 API 엔드포인트 빠른 참조

### 프로젝트 관리
```bash
# 모든 프로젝트 조회
curl http://localhost:5001/api/projects

# 특정 프로젝트 조회
curl http://localhost:5001/api/projects/{projectId}

# 프로젝트 상태 확인
curl http://localhost:5001/api/project-status/{projectId}
```

### 비디오 업로드
```bash
# 비디오 업로드
curl -X POST -F "video=@video.mp4" \
  -F "language=ko-KR" \
  http://localhost:5001/api/upload-video
```

### STT (Whisper API)
```bash
# 오디오 파일 음성 인식
curl -X POST -F "audio=@audio.mp3" \
  -F "language=ko" \
  http://localhost:5001/api/transcribe-audio
```

### 번역
```bash
# 자막 번역
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "captions": [{"text": "안녕하세요", "word": "안녕하세요"}],
    "targetLanguage": "en"
  }' \
  http://localhost:5001/api/translate-captions
```

---

## 📊 Firestore 데이터 구조

```javascript
// projects/{projectId}
{
  id: string,                    // 프로젝트 ID
  fileName: string,              // GCS의 비디오 파일명
  originalName: string,          // 업로드한 원본 파일명
  status: 'processing' | 'transcribed',
  fileSize: number,              // 파일 크기 (바이트)
  language: string,              // 설정된 언어 (ko-KR, en-US 등)
  uploadedAt: ISO string,        // 업로드 시간

  // STT 처리 후 추가됨
  transcript: [{
    word: string,
    start_time: number,          // 초 단위
    end_time: number,
  }],
  full_text: string,             // 전체 텍스트
  created_at: Server Timestamp,
}
```

---

## 🐛 문제 해결

### "OpenAI API 키 없음" 에러
**원인**: `OPENAI_API_KEY` 환경 변수가 설정되지 않음

**해결책**:
```bash
cd backend
echo 'OPENAI_API_KEY=sk-xxxxx...' >> .env
npm run dev
```

### "CORS 에러"
**원인**: 프론트엔드와 백엔드의 CORS 설정이 맞지 않음

**해결책**:
- 백엔드 실행: `CORS_ORIGIN=http://localhost:5173`
- Vite 설정: `vite.config.ts` 프록시 확인
```bash
cat backend/.env | grep CORS
```

### "파일 업로드 실패"
**원인**: GCS 버킷 권한 문제

**해결책**:
```bash
# GCS 인증 확인
gcloud auth list

# 버킷 접근 권한 확인
gsutil ls gs://bob-sto
```

### "Whisper API 에러 (401)"
**원인**: OpenAI API 키가 유효하지 않음

**해결책**:
1. OpenAI 대시보드 접속: https://platform.openai.com/account/api-keys
2. API 키 재발급
3. `.env` 파일 업데이트
4. 백엔드 재시작

---

## 📚 다음 단계

1. **프로덕션 배포**: [DEPLOYMENT.md](./DEPLOYMENT.md) 참조
2. **API 상세 문서**: [API_DOCS.md](./API_DOCS.md) (작성 예정)
3. **성능 최적화**: Cloud Function 메모리 증설, Caching 설정

---

## 💡 팁

### 개발 중 유용한 명령어

```bash
# 백엔드 로그 확인 (실시간)
cd backend && npm run dev

# 프론트엔드 빌드 확인
npm run build

# Firestore 데이터 확인
gcloud firestore documents list --collection projects

# GCS 파일 확인
gsutil ls -r gs://bob-sto/
```

### 성능 모니터링

```bash
# 백엔드 응답 시간 확인
curl -w "응답 시간: %{time_total}초\n" http://localhost:5001/api/health

# Whisper API 비용 확인
# OpenAI 대시보드: https://platform.openai.com/account/billing/overview
```

---

## 🆘 지원

문제가 해결되지 않으면:
1. `.env` 파일이 올바르게 설정되었는지 확인
2. 백엔드 콘솔 로그 확인 (❌ 빨간 에러 메시지)
3. OpenAI API 상태 확인: https://status.openai.com

---

**축하합니다!** 🎉 BobPT가 준비되었습니다!

다음은 프로덕션 배포입니다. [DEPLOYMENT.md](./DEPLOYMENT.md)를 참조하세요.
