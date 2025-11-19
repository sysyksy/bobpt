# Translation Feature Guide

## 🌍 초월 번역(Localization) 기능 가이드

**Subup 스타일의 문맥 기반 번역** - 단순 기계 번역이 아닌, 영상의 맥락과 톤앤매너를 살린 초월 번역을 제공합니다.

---

## 🎯 핵심 기능

### 1. **Context Extraction (문맥 분석)**
영상의 전체 트랜스크립트를 분석하여:
- 장르 파악 (예: 게임 리뷰, 교육, 브이로그 등)
- 화자의 톤앤매너 (예: 캐주얼, 격식있는, 유머러스 등)
- 타겟 시청자 (예: 20대 게이머, 주부, 학생 등)
- 핵심 주제 및 키워드
- 스타일 특징 (밈 사용, 존댓말/반말 등)

### 2. **Subtitle Localization (자막 번역)**
문맥 정보를 바탕으로:
- 원본의 의미와 뉘앙스 정확히 전달
- 타겟 언어권 문화에 맞게 의역
- 화면 자막용 간결한 문장 (한 줄당 최대 40자)
- 밈(Meme)과 속어를 타겟 언어권에 맞게 변환
- 존댓말/반말 톤 유지
- **타임스탬프 구조 절대 유지**

### 3. **Metadata Translation (SEO 최적화)**
YouTube 최적화:
- 클릭률(CTR) 높은 제목 스타일
- 감정적 어휘 활용 (Amazing, Shocking 등)
- 타겟 언어권 트렌드 반영
- 검색 최적화 키워드 포함

---

## 🏗️ 아키텍처

### 파이프라인 흐름

```
비디오 업로드
  ↓
GCS Trigger
  ↓
Cloud Functions
  ↓ 1. FFmpeg 오디오 추출
  ↓ 2. Whisper API STT
  ↓ 3. Firestore 저장 (원본 자막)
  ↓
  ↓ 4. TranslationAgent 초기화
  ↓ 5. Context Extraction (문맥 분석)
  ↓ 6. Subtitle Localization (자막 번역)
  ↓ 7. Metadata Translation (제목/설명 번역)
  ↓ 8. Firestore 업데이트 (번역 결과)
  ↓
완료
```

### Firestore 스키마

```json
{
  "id": "project-uuid",
  "fileName": "video.mp4",
  "status": "transcribed",
  "language": "ko",

  // 원본 STT 결과
  "transcript": [
    {
      "start_time": 0.0,
      "end_time": 2.5,
      "word": "안녕하세요"
    }
  ],
  "full_text": "안녕하세요 여러분...",

  // 문맥 분석 결과
  "context": {
    "genre": "게임 리뷰",
    "tone": "캐주얼하고 텐션 높은 톤",
    "target_audience": "20대 게이머",
    "key_themes": "액션 게임, 난이도, 보스전",
    "style_notes": "밈과 게임 용어 사용, 반말 사용"
  },

  // 번역 결과
  "translations": {
    "en": {
      "title": "This Game is INSANE! | Epic Boss Battle Gameplay",
      "description": "I died 10+ times fighting this boss but finally beat it! Check out this crazy action game...",
      "captions": [
        {
          "start_time": 0.0,
          "end_time": 2.5,
          "word": "Hey everyone!"
        }
      ],
      "full_text": "Hey everyone! ..."
    },
    "ja": {
      "title": "このゲーム難しすぎる！｜超絶ボス戦",
      "description": "...",
      "captions": [...]
    }
  },

  "translation_status": "completed",
  "created_at": "2025-01-15T10:30:00Z"
}
```

---

## 🚀 사용 방법

### 1. Cloud Functions 설정

#### 환경 변수 설정

```bash
# OpenAI API Key (필수)
export OPENAI_API_KEY="sk-..."

# 번역 활성화 (기본값: true)
export ENABLE_TRANSLATION="true"

# 타겟 언어 설정 (쉼표로 구분)
export TRANSLATION_LANGUAGES="en,ja,zh"
```

#### Cloud Functions 배포

```bash
gcloud functions deploy trigger_stt \
  --gen2 \
  --runtime=python311 \
  --region=asia-northeast3 \
  --source=. \
  --entry-point=trigger_stt \
  --trigger-event-filters="type=google.cloud.storage.object.v1.finalized" \
  --trigger-event-filters="bucket=bob-sto" \
  --set-env-vars OPENAI_API_KEY=$OPENAI_API_KEY \
  --set-env-vars ENABLE_TRANSLATION=true \
  --set-env-vars TRANSLATION_LANGUAGES=en,ja,zh \
  --memory=2GB \
  --timeout=540s
```

### 2. Python 코드에서 직접 사용

```python
from translation_agent import TranslationAgent

# TranslationAgent 초기화
agent = TranslationAgent(api_key="sk-...")

# 1. 문맥 분석
context = agent.analyze_context(
    full_transcript="안녕하세요 여러분! 오늘은...",
    source_language="ko"
)

print(f"장르: {context['genre']}")
print(f"톤: {context['tone']}")

# 2. 자막 번역
captions = [
    {"start": 0.0, "end": 2.5, "text": "안녕하세요 여러분!"},
    {"start": 2.5, "end": 5.0, "text": "오늘은 게임 리뷰를 가져왔어요."}
]

translated = agent.translate_captions(
    captions=captions,
    target_language="en",
    context=context,
    source_language="ko"
)

# 3. 메타데이터 번역
metadata = agent.translate_metadata(
    title="[게임 리뷰] 역대급 난이도!",
    description="이 게임은 정말 어려웠습니다...",
    target_language="en",
    context=context
)

print(f"제목: {metadata['title']}")

# 4. 올인원 번역
result = agent.translate_project(
    full_transcript="...",
    captions=[...],
    title="...",
    description="...",
    target_languages=["en", "ja", "zh"],
    source_language="ko"
)
```

### 3. Backend API 사용

#### 모든 번역 조회
```bash
GET /api/projects/{project_id}/translations

# Response:
{
  "projectId": "uuid",
  "status": "completed",
  "context": {...},
  "translations": {
    "en": {...},
    "ja": {...}
  },
  "available_languages": ["en", "ja"]
}
```

#### 특정 언어 번역 조회
```bash
GET /api/projects/{project_id}/translations/en

# Response:
{
  "projectId": "uuid",
  "language": "en",
  "title": "Translated Title",
  "description": "Translated Description",
  "captions": [...],
  "full_text": "Full transcript"
}
```

#### 수동 번역 트리거
```bash
POST /api/projects/{project_id}/translate
Content-Type: application/json

["en", "ja", "zh"]

# Response:
{
  "projectId": "uuid",
  "status": "pending",
  "target_languages": ["en", "ja", "zh"],
  "message": "Translation request submitted"
}
```

---

## ⚙️ 설정 옵션

### TranslationAgent 초기화 옵션

```python
agent = TranslationAgent(
    api_key="sk-...",  # OpenAI API Key (None이면 환경변수에서 가져옴)
)

# 사용 모델: gpt-4o-mini (비용 효율적)
# Temperature:
#   - Context Analysis: 0.3 (일관성)
#   - Caption Translation: 0.5 (창의적 의역)
#   - Metadata Translation: 0.7 (창의적 제목)
```

### 지원 언어

- **en**: 영어 (미국)
- **ja**: 일본어
- **zh**: 중국어 (간체)
- **es**: 스페인어
- **fr**: 프랑스어
- **de**: 독일어
- **ko**: 한국어 (원본)

---

## 🎨 번역 품질 예시

### 원본 (한국어)
```
장르: 게임 리뷰
톤: 캐주얼, 텐션 높음
자막: "이 보스 진짜 미쳤어요 ㅋㅋㅋ 10번 넘게 죽었어요"
```

### 영어 번역 (Subup 스타일)
```
Genre: Game Review
Tone: Casual, High Energy
Caption: "This boss is INSANE lol died like 10+ times"

Title:
  기계 번역: "[Game Review] Legendary Difficulty!"
  Subup 스타일: "This Game is INSANE! | I Died 10+ Times 😱"
```

### 일본어 번역
```
Caption: "このボスマジでヤバいwww 10回以上死んだ"

Title:
  기계 번역: "【ゲームレビュー】伝説の難易度！"
  Subup 스타일: "このゲーム難しすぎる！｜10回以上死亡www"
```

---

## 🔧 JSON 파싱 오류 방지

### 문제
LLM이 JSON 형식을 지키지 않을 수 있음:
```python
# 잘못된 출력 예시
"Here's the translation: {"title": "..."}""
```

### 해결책 1: OpenAI JSON Mode 사용
```python
response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[...],
    response_format={"type": "json_object"}  # ✅ JSON 강제
)
```

### 해결책 2: 명확한 시스템 프롬프트
```python
system_prompt = """
반드시 JSON 형식으로만 답변하세요.
다른 텍스트는 포함하지 마세요.
"""
```

### 해결책 3: Fallback 처리
```python
try:
    result = json.loads(response.choices[0].message.content)
except json.JSONDecodeError:
    # Fallback: 원본 유지
    result = captions
```

---

## 💰 비용 계산

### GPT-4o-mini 가격 (2025년 1월 기준)
- Input: $0.150 / 1M tokens
- Output: $0.600 / 1M tokens

### 예상 비용 (10분 영상 기준)
- 트랜스크립트 길이: ~2,000자 (한국어) = ~1,500 tokens
- 자막 개수: ~100개
- 번역 언어: 3개 (en, ja, zh)

**비용 계산:**
- Context Analysis: 1,500 input + 200 output = ~$0.0003
- Caption Translation (per language): 2,000 input + 2,000 output = ~$0.0015
- Metadata Translation (per language): 500 input + 200 output = ~$0.0002

**총 비용 (3개 언어)**: 약 **$0.006** (~8원)

**월 1,000개 영상 처리**: 약 **$6** (~8,000원)

---

## 🐛 트러블슈팅

### 1. TranslationAgent 초기화 실패
**원인**: OPENAI_API_KEY 미설정

**해결**:
```bash
export OPENAI_API_KEY="sk-..."
```

### 2. JSON 파싱 오류
**원인**: LLM이 JSON 형식을 지키지 않음

**해결**:
- `response_format={"type": "json_object"}` 사용 (이미 적용됨)
- Fallback 로직 동작 확인

### 3. 번역 품질 낮음
**원인**: 문맥 분석 실패

**해결**:
- 전체 트랜스크립트가 충분히 긴지 확인 (최소 100자 이상)
- Temperature 조정 (현재: 0.3-0.7)

### 4. 타임스탬프 깨짐
**원인**: LLM이 타임스탬프 수정

**해결**:
- 시스템 프롬프트에 "타임스탬프 절대 변경 금지" 명시 (이미 적용됨)
- JSON 구조 검증 로직 추가

### 5. Cloud Functions 메모리 초과
**원인**: 긴 영상 (1시간 이상)

**해결**:
- Cloud Functions 메모리를 4GB로 증가
- Batch 처리 크기 조정 (현재: 50개씩)

---

## 📚 참고 자료

### Subup 스타일 번역 예시
- [Subup 공식 사이트](https://subup.ai/)
- YouTube 자막 번역 베스트 프랙티스

### OpenAI API 문서
- [Chat Completions API](https://platform.openai.com/docs/guides/chat)
- [JSON Mode](https://platform.openai.com/docs/guides/structured-outputs)
- [GPT-4o-mini Pricing](https://openai.com/pricing)

---

## 🎯 다음 단계

### 추가 개선 사항
- [ ] 번역 품질 평가 시스템 (BLEU, METEOR 스코어)
- [ ] 사용자 피드백 기반 번역 개선
- [ ] 전문 용어 사전 (Glossary) 기능
- [ ] 번역 히스토리 및 버전 관리
- [ ] 멀티모달 번역 (이미지/영상 맥락 포함)

### 프론트엔드 통합
- [ ] 번역 언어 선택 UI
- [ ] 번역 결과 미리보기
- [ ] 번역 편집 기능
- [ ] 번역된 자막 다운로드 (SRT/VTT)

---

**Made with ❤️ by Project Brew Team**

**Powered by OpenAI GPT-4o-mini** 🚀
