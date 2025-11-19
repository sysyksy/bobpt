# YouTube Pipeline Guide

## 🎬 YouTube → 번역 자막 원스톱 파이프라인

**"YouTube URL 하나로 번역된 자막까지"** - YouTube 링크만 입력하면 STT, 번역, 내보내기까지 자동으로 처리합니다.

---

## 🎯 핵심 기능

### 1. **스마트 자막 추출**
YouTube 영상에 이미 자막이 있으면 STT를 건너뜁니다:
- 공식 자막(Closed Caption) 우선 사용
- 자동 생성 자막(Auto-generated) 대체 사용
- 자막이 없을 때만 Whisper API 호출 → **비용 절감**

### 2. **고품질 오디오 다운로드**
- yt-dlp를 사용한 최적 품질 오디오 추출
- `-f bestaudio --audio-quality 5` 설정
- MP3 포맷으로 변환 (Whisper API 호환)

### 3. **자동 문맥 기반 번역**
- TranslationAgent를 통한 Subup 스타일 번역
- 장르, 톤앤매너 분석 후 번역
- 타임스탬프 구조 완벽 유지

### 4. **비동기 처리**
- 전체 파이프라인이 asyncio로 구현
- 백그라운드 작업으로 실행
- 상태 확인 API로 진행 상황 추적

### 5. **Firestore 통합**
- 모든 결과를 Firestore에 자동 저장
- 원본 트랜스크립트 + 모든 번역 언어
- 프로젝트 목록에서 확인 가능

---

## 🏗️ 아키텍처

### 파이프라인 흐름

```
YouTube URL 입력
  ↓
1. YouTube 메타데이터 추출 (yt-dlp --dump-json)
  ↓
2. 기존 자막 확인 (--write-sub --write-auto-sub)
  ↓
  ├─ 자막 있음 → VTT/SRT 파싱 → STT 건너뜀 💰
  └─ 자막 없음 → 오디오 다운로드 → Whisper API STT
  ↓
3. TranslationAgent 초기화
  ↓
4. Context Extraction (문맥 분석)
  ↓
5. Subtitle Localization (자막 번역)
  ↓
6. Metadata Translation (제목/설명 번역)
  ↓
7. Firestore 저장 (원본 + 번역 결과)
  ↓
완료 ✅
```

### Firestore 스키마

```json
{
  "id": "project-uuid",
  "source": "youtube",
  "url": "https://youtube.com/watch?v=...",
  "fileName": "영상 제목.mp4",
  "status": "completed",
  "language": "ko",

  // YouTube 메타데이터
  "youtube_info": {
    "title": "원본 YouTube 제목",
    "channel": "채널 이름",
    "duration": 600,
    "view_count": 123456,
    "upload_date": "20250115"
  },

  // STT 결과
  "transcript": [
    {
      "start_time": 0.0,
      "end_time": 2.5,
      "word": "안녕하세요"
    }
  ],
  "full_text": "안녕하세요 여러분...",

  // 번역 결과
  "translations": {
    "en": {
      "title": "Translated Title",
      "description": "Translated Description",
      "captions": [...],
      "full_text": "Full transcript"
    },
    "ja": {...}
  },

  "context": {...},
  "translation_status": "completed",
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

## 🚀 사용 방법

### 1. Backend API 사용 (추천)

#### YouTube 비디오 처리 시작

```bash
POST /api/youtube/process
Content-Type: application/json

{
  "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
  "target_languages": ["en", "ja", "zh"],
  "source_language": "ko",
  "enable_ocr": false
}

# Response:
{
  "project_id": "uuid",
  "status": "processing",
  "url": "https://youtube.com/watch?v=...",
  "target_languages": ["en", "ja", "zh"],
  "message": "YouTube processing started in background. Use /api/project-status/{project_id} to check progress."
}
```

#### 처리 상태 확인

```bash
GET /api/youtube/status/{project_id}

# Response (처리 중):
{
  "project_id": "uuid",
  "status": "processing",
  "source": "youtube",
  "url": "https://youtube.com/watch?v=...",
  "created_at": "2025-01-15T10:30:00Z"
}

# Response (완료):
{
  "project_id": "uuid",
  "status": "completed",
  "source": "youtube",
  "url": "https://youtube.com/watch?v=...",
  "result": {
    "title": "영상 제목",
    "full_text": "전체 트랜스크립트...",
    "transcript_length": 150,
    "available_translations": ["en", "ja", "zh"]
  }
}
```

#### 번역 결과 조회

```bash
# 특정 언어 번역 조회
GET /api/projects/{project_id}/translations/en

# 모든 번역 조회
GET /api/projects/{project_id}/translations
```

#### 자막 파일 내보내기

```bash
POST /api/projects/{project_id}/export
Content-Type: application/json

{
  "format": "srt",  # "srt", "vtt", "premiere", "fcpx"
  "frameRate": 30,
  "videoWidth": 1920,
  "videoHeight": 1080
}

# Response: 파일 다운로드 (SRT/VTT/XML)
```

### 2. Python 코드에서 직접 사용

```python
import asyncio
from youtube_pipeline import YouTubePipeline
from google.cloud import firestore

# 초기화
pipeline = YouTubePipeline(
    openai_api_key="sk-...",
    firestore_client=firestore.Client()
)

# YouTube 비디오 처리
async def process_video():
    result = await pipeline.process_youtube_url(
        url="https://youtube.com/watch?v=dQw4w9WgXcQ",
        target_languages=["en", "ja", "zh"],
        source_language="ko",
        enable_ocr=False,
        project_id="custom-project-id"
    )

    print(f"제목: {result['title']}")
    print(f"번역 언어: {list(result['translations'].keys())}")
    print(f"자막 개수: {len(result['captions'])}")

asyncio.run(process_video())
```

### 3. 로컬에서 테스트

```bash
# 1. 의존성 설치
pip install -r backend/requirements.txt

# 2. 환경 변수 설정
export OPENAI_API_KEY="sk-..."
export GOOGLE_CLOUD_PROJECT="your-project-id"

# 3. FastAPI 서버 실행
cd backend
uvicorn main:app --reload --port 8000

# 4. 테스트 요청
curl -X POST http://localhost:8000/api/youtube/process \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
    "target_languages": ["en"],
    "source_language": "ko"
  }'
```

---

## ⚙️ 설정 옵션

### 환경 변수

```bash
# 필수
export OPENAI_API_KEY="sk-..."           # OpenAI API Key
export GOOGLE_CLOUD_PROJECT="project-id" # GCP 프로젝트 ID

# 선택 (기본값 사용)
export YT_DLP_AUDIO_FORMAT="mp3"         # 오디오 포맷 (기본: mp3)
export YT_DLP_AUDIO_QUALITY="5"          # 오디오 품질 (0-10, 기본: 5)
export TRANSLATION_ENABLED="true"        # 번역 활성화 (기본: true)
```

### YouTubePipeline 초기화 옵션

```python
pipeline = YouTubePipeline(
    openai_api_key=None,        # None이면 환경변수에서 가져옴
    firestore_client=None,      # Firestore 클라이언트 (선택)
    temp_dir="/tmp/youtube",    # 임시 파일 저장 경로
)
```

### 지원 언어

- **원본 언어 (source_language)**: YouTube 자막/음성 언어
  - `ko`, `en`, `ja`, `zh`, `es`, `fr`, `de` 등

- **번역 언어 (target_languages)**: 번역할 언어 목록
  - `["en", "ja", "zh"]` 등 배열 형태로 전달

---

## 💰 비용 계산

### 시나리오 1: 자막이 이미 있는 경우 ✅ (최적)

**10분 YouTube 영상 (한국어 자막 제공)**

- YouTube 자막 다운로드: **무료**
- Whisper API: **$0** (건너뜀)
- Translation (3개 언어): **$0.005**

**총 비용**: ~**$0.005** (~7원)

### 시나리오 2: 자막이 없는 경우 (STT 필요)

**10분 YouTube 영상 (자막 없음)**

- 오디오 다운로드 (yt-dlp): **무료**
- Whisper API (10분 오디오): **$0.06**
- Translation (3개 언어): **$0.005**

**총 비용**: ~**$0.065** (~90원)

### 월별 예상 비용 (1,000개 영상 기준)

| 시나리오 | 자막 있음 비율 | STT 비용 | 번역 비용 | 총 비용 |
|---------|--------------|---------|---------|---------|
| 최적 | 80% | $12 | $5 | ~**$17** (~23,000원) |
| 보통 | 50% | $30 | $5 | ~**$35** (~47,000원) |
| 최악 | 0% | $60 | $5 | ~**$65** (~87,000원) |

**결론**: YouTube 자막을 활용하면 **최대 83% 비용 절감** 가능!

---

## 🎨 처리 예시

### 원본 YouTube 영상

```
URL: https://youtube.com/watch?v=example
제목: [게임 리뷰] 역대급 난이도의 보스전!
언어: 한국어
자막: 공식 자막 있음 ✅
```

### 1단계: 자막 확인

```bash
✅ 기존 자막 발견! STT 생략
📄 자막 파일: ko.vtt (150개 자막)
💰 비용 절감: $0.06 (Whisper API 미사용)
```

### 2단계: 문맥 분석

```json
{
  "genre": "게임 리뷰",
  "tone": "캐주얼하고 텐션 높은 톤",
  "target_audience": "20대 게이머",
  "key_themes": "액션 게임, 난이도, 보스전",
  "style_notes": "밈과 게임 용어 사용, 반말"
}
```

### 3단계: 번역 (영어)

```
원본: "이 보스 진짜 미쳤어요 ㅋㅋㅋ 10번 넘게 죽었어요"
번역: "This boss is INSANE lol died like 10+ times"

제목:
  원본: "[게임 리뷰] 역대급 난이도의 보스전!"
  번역: "This Game is INSANE! | I Died 10+ Times 😱"
```

### 4단계: Firestore 저장

```json
{
  "id": "abc-123",
  "source": "youtube",
  "fileName": "[게임 리뷰] 역대급 난이도의 보스전!.mp4",
  "status": "completed",
  "translations": {
    "en": {...},
    "ja": {...},
    "zh": {...}
  }
}
```

### 5단계: 내보내기 (SRT)

```srt
1
00:00:00,000 --> 00:00:02,500
Hey everyone!

2
00:00:02,500 --> 00:00:05,000
Today I brought you a game review.

3
00:00:05,000 --> 00:00:08,500
This boss is INSANE lol died like 10+ times
```

---

## 🔧 트러블슈팅

### 1. yt-dlp 설치 실패

**증상**:
```
ModuleNotFoundError: No module named 'yt_dlp'
```

**해결**:
```bash
pip install yt-dlp>=2023.0.0
```

### 2. YouTube 다운로드 실패

**증상**:
```
ERROR: Video unavailable
```

**원인**:
- 비공개/삭제된 영상
- 지역 제한 영상
- 연령 제한 영상

**해결**:
- 공개 영상인지 확인
- VPN 사용 (지역 제한)
- 쿠키 파일 제공 (연령 제한)

```python
# 쿠키 사용 예시
yt_dlp_opts = {
    'cookiefile': '/path/to/cookies.txt',
    # ...
}
```

### 3. 자막 파싱 오류

**증상**:
```
ERROR: Failed to parse subtitle timestamp
```

**원인**: VTT/SRT 파일 형식이 비표준

**해결**:
- `youtube_pipeline.py`의 `parse_vtt_timestamp()` 함수 확인
- Fallback: Whisper API 사용

```python
# 자막 파싱 실패 시 자동으로 STT로 전환
if not captions_from_subtitle:
    print("⚠️ 자막 파싱 실패 → Whisper API 사용")
    audio_path = await self._download_audio(url)
    # ...
```

### 4. Firestore 저장 실패

**증상**:
```
PermissionDenied: Missing or insufficient permissions
```

**해결**:
```bash
# Firestore 권한 확인
gcloud projects get-iam-policy YOUR_PROJECT_ID

# 서비스 계정에 Firestore 권한 부여
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### 5. 메모리 부족 (긴 영상)

**증상**:
```
MemoryError: Unable to allocate array
```

**원인**: 1시간 이상의 긴 영상 처리

**해결**:
- Batch 처리 크기 조정 (기본: 50개 → 20개)
- 서버 메모리 증가 (최소 2GB 권장)

```python
# translation_agent.py 수정
BATCH_SIZE = 20  # 기본: 50
```

### 6. 백그라운드 작업이 멈춤

**증상**: `/api/youtube/status`가 계속 `processing` 상태

**원인**:
- FastAPI 백그라운드 작업 타임아웃
- 비동기 함수 내 예외 발생

**해결**:
```bash
# FastAPI 로그 확인
uvicorn main:app --log-level debug

# Firestore에서 에러 확인
GET /api/projects/{project_id}
# → "error" 필드 확인
```

---

## 📚 참고 자료

### yt-dlp 문서
- [공식 GitHub](https://github.com/yt-dlp/yt-dlp)
- [추출 옵션](https://github.com/yt-dlp/yt-dlp#usage-and-options)
- [자막 다운로드](https://github.com/yt-dlp/yt-dlp#subtitle-options)

### OpenAI Whisper API
- [Whisper API Pricing](https://openai.com/pricing) - $0.006/분
- [지원 언어](https://platform.openai.com/docs/guides/speech-to-text/supported-languages)

### TranslationAgent
- [TRANSLATION_FEATURE_GUIDE.md](./TRANSLATION_FEATURE_GUIDE.md)

### Firestore
- [Firestore 문서](https://cloud.google.com/firestore/docs)
- [Python SDK](https://googleapis.dev/python/firestore/latest/index.html)

---

## 🎯 다음 단계

### 프론트엔드 통합
- [ ] YouTube URL 입력 컴포넌트
- [ ] 실시간 처리 진행률 표시
- [ ] 번역 결과 미리보기
- [ ] 자막 파일 일괄 다운로드

### 추가 기능
- [ ] YouTube 재생목록 일괄 처리
- [ ] 자막 품질 점수 (기존 자막 vs STT)
- [ ] 자막 편집 및 재번역
- [ ] 여러 채널 구독 및 자동 처리

### 성능 개선
- [ ] Redis 캐시 (중복 URL 처리 방지)
- [ ] Cloud Run/Cloud Functions 배포
- [ ] Pub/Sub 큐를 통한 대규모 처리
- [ ] 병렬 번역 (여러 언어 동시 처리)

---

## 🛠️ API 요약

| Endpoint | Method | 설명 |
|----------|--------|------|
| `/api/youtube/process` | POST | YouTube 비디오 처리 시작 |
| `/api/youtube/status/{project_id}` | GET | 처리 상태 확인 |
| `/api/projects/{project_id}/translations` | GET | 모든 번역 조회 |
| `/api/projects/{project_id}/translations/{lang}` | GET | 특정 언어 번역 조회 |
| `/api/projects/{project_id}/export` | POST | 자막 파일 내보내기 |

---

**Made with ❤️ by Project Brew Team**

**Powered by yt-dlp, OpenAI Whisper, and GPT-4o-mini** 🚀
