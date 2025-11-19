# Google Cloud 환경 설정 가이드

## 📋 목차
1. Google Cloud 프로젝트 생성
2. 서비스 계정 생성 및 키 다운로드
3. 번역 API 활성화
4. 환경 변수 설정
5. 로컬 개발 검증

---

## 1️⃣ Google Cloud 프로젝트 생성

### 단계별 가이드

#### 1.1 Google Cloud Console 접속
- [Google Cloud Console](https://console.cloud.google.com) 방문
- Google 계정으로 로그인

#### 1.2 새 프로젝트 생성
```
1. 상단의 "프로젝트 선택" 클릭
2. "새 프로젝트" 버튼 클릭
3. 프로젝트 이름: "project-brew" (또는 원하는 이름)
4. 조직: (기본값 유지)
5. "만들기" 클릭
```

#### 1.3 프로젝트 ID 메모하기
- 생성된 프로젝트 ID를 저장 (예: `project-brew-123456`)
- 이후 환경 설정에 필요

---

## 2️⃣ 서비스 계정 생성 및 키 다운로드

### 단계별 가이드

#### 2.1 서비스 계정 생성
```
1. Google Cloud Console에서 "IAM 및 관리자" → "서비스 계정" 선택
2. "서비스 계정 만들기" 클릭
3. 서비스 계정 이름: "translation-service" 입력
4. 서비스 계정 ID: 자동 생성됨
5. "만들기 및 계속" 클릭
```

#### 2.2 역할 부여
```
역할 선택:
- "Editor" (전체 권한) 또는
- "Cloud Translation API 편집자" (추천: 최소 권한)

"계속" 클릭
```

#### 2.3 서비스 계정 키 생성
```
1. "키" 탭 클릭
2. "새 키 만들기" → "JSON" 선택
3. "만들기" 클릭
4. JSON 파일이 자동으로 다운로드됨
5. 파일명을 기억해두기 (예: project-brew-key.json)
```

### ⚠️ 보안 주의사항
- 다운로드한 JSON 파일은 절대 Git에 커밋하지 말 것
- `.gitignore`에 추가 확인:
  ```
  # Google Cloud
  *-key.json
  *.json
  service-account-key.json
  ```

---

## 3️⃣ 번역 API 활성화

### 단계별 가이드

#### 3.1 API 활성화 페이지 접속
```
1. Google Cloud Console에서 상단의 검색창 사용
2. "Translation API" 검색
3. "Cloud Translation API" 클릭
4. "활성화" 버튼 클릭
```

#### 3.2 API 활성화 확인
- "API 활성화됨" 표시 확인
- 대기 시간: 1-2분

---

## 4️⃣ 환경 변수 설정

### 4.1 로컬 개발 환경 (Windows - PowerShell)

```powershell
# PowerShell에서 실행
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\project-brew-key.json"
$env:GOOGLE_CLOUD_PROJECT = "project-brew-123456"

# 확인
$env:GOOGLE_CLOUD_PROJECT
```

### 4.2 로컬 개발 환경 (Windows - CMD)

```cmd
set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\project-brew-key.json
set GOOGLE_CLOUD_PROJECT=project-brew-123456

REM 확인
echo %GOOGLE_CLOUD_PROJECT%
```

### 4.3 로컬 개발 환경 (Mac/Linux)

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/project-brew-key.json"
export GOOGLE_CLOUD_PROJECT="project-brew-123456"

# 확인
echo $GOOGLE_CLOUD_PROJECT
```

### 4.4 영구 설정 (권장)

#### Windows 환경 변수 설정
```
1. "시스템 환경 변수 편집" 검색
2. "고급" 탭 → "환경 변수" 클릭
3. "새로 만들기" 클릭
   - 변수 이름: GOOGLE_APPLICATION_CREDENTIALS
   - 변수 값: C:\full\path\to\project-brew-key.json
4. 다시 "새로 만들기"
   - 변수 이름: GOOGLE_CLOUD_PROJECT
   - 변수 값: project-brew-123456
5. "확인" 클릭
6. 터미널 재시작
```

#### .env 파일 사용 (개발 환경)

프로젝트 루트에 `.env.local` 생성:

```env
# Google Cloud 설정
GOOGLE_APPLICATION_CREDENTIALS=/path/to/project-brew-key.json
GOOGLE_CLOUD_PROJECT=project-brew-123456
VITE_GOOGLE_CLOUD_PROJECT=project-brew-123456
```

`.env.local`을 `.gitignore`에 추가:
```
.env.local
.env.development.local
```

---

## 5️⃣ 로컬 개발 검증

### 5.1 Python에서 테스트

```python
# test_translation.py
import os
from google.cloud import translate_v3

# 환경 변수 확인
project_id = os.getenv("GOOGLE_CLOUD_PROJECT")
print(f"프로젝트 ID: {project_id}")

# 번역 클라이언트 초기화
client = translate_v3.TranslationServiceClient()
parent = f"projects/{project_id}/locations/global"

# 테스트 번역
request = translate_v3.TranslateTextRequest(
    parent=parent,
    contents=["Hello world"],
    target_language_code="ko"
)

response = client.translate_text(request=request)
print(f"번역 결과: {response.translations[0].translated_text}")
```

### 5.2 백엔드 서버 실행

```bash
# 환경 변수 설정 후
cd C:\project-brew\bobpt\backend
source venv/Scripts/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5.3 API 테스트

```bash
curl -X POST "http://localhost:8000/api/translate-captions" \
  -H "Content-Type: application/json" \
  -d '{
    "captions": [
      {"start": 0, "end": 5, "text": "Hello world"}
    ],
    "targetLanguage": "ko-KR"
  }'
```

예상 응답 (온라인 모드):
```json
{
  "mode": "online",
  "translated": [
    {
      "start": 0,
      "end": 5,
      "text": "안녕하세요 세계",
      "original": "Hello world"
    }
  ]
}
```

---

## 📊 비용 추정

Google Cloud Translation API 가격:
- **$15 per 1 million characters** (기본 요금)
- 월 500,000 자 무료 (1개월)

### 비용 예측
- 100자 자막 10개 = 1,000자 = $0.000015
- 월 100시간 영상 (시간당 평균 5,000자) = 500,000자 = 무료

---

## 🔐 보안 체크리스트

- [ ] JSON 키 파일이 `.gitignore`에 있는지 확인
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정됨
- [ ] `GOOGLE_CLOUD_PROJECT` 환경 변수 설정됨
- [ ] 서비스 계정에 최소 권한만 부여함
- [ ] 개발 환경과 프로덕션 환경 분리
- [ ] GitHub/공개 저장소에 키가 노출되지 않았는지 확인

---

## 🆘 문제 해결

### "로그인하지 않음" 오류
```
Error: Could not authenticate with Google Cloud
```
**해결책:**
1. `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 확인
2. JSON 파일 경로가 올바른지 확인
3. JSON 파일이 손상되지 않았는지 확인

### "API 활성화되지 않음" 오류
```
Error: Cloud Translation API has not been used in project
```
**해결책:**
1. Google Cloud Console에서 API 활성화 확인
2. 활성화 후 2-3분 대기

### "권한 부족" 오류
```
Error: Permission denied on resource
```
**해결책:**
1. 서비스 계정에 "Editor" 역할 재부여
2. 또는 "Cloud Translation API 편집자" 역할 확인

---

## 📚 참고 링크

- [Google Cloud Console](https://console.cloud.google.com)
- [Cloud Translation API 문서](https://cloud.google.com/translate/docs)
- [Python 클라이언트 라이브러리](https://cloud.google.com/python/docs/reference/translate/latest)
- [서비스 계정 생성 가이드](https://cloud.google.com/docs/authentication/getting-started)

