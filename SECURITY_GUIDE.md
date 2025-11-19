# Security Guide

## 🔒 보안 가이드

**Project Brew**의 안전한 사용을 위한 보안 가이드입니다.

---

## 🔑 API 키 관리

### 1. 환경변수 사용 (필수)

**절대 하지 말아야 할 것:**
```python
# ❌ 잘못된 예: 코드에 직접 하드코딩
client = OpenAI(api_key="sk-proj-...")
```

**올바른 방법:**
```python
# ✅ 올바른 예: 환경변수 사용
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.environ.get("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
```

### 2. .env 파일 설정

#### .env 파일 생성
```bash
# .env.example을 복사하여 .env 생성
cp .env.example .env
cp backend/.env.example backend/.env

# .env 파일 편집
nano .env
```

#### .env 파일 내용
```bash
# OpenAI API 키 (필수)
OPENAI_API_KEY=your-actual-api-key-here

# Google Cloud 설정
GCS_BUCKET=your-bucket-name
GOOGLE_CLOUD_PROJECT=your-project-id

# JWT 시크릿 (프로덕션에서는 반드시 변경)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

### 3. .gitignore 확인

다음 파일들이 `.gitignore`에 포함되어 있는지 확인:

```gitignore
# 환경변수 파일
.env
.env.local
.env.*.local

# 민감한 파일
*.key
*.pem
*.p12
*-key.json
credentials.json
service-account*.json

# GCP 서비스 계정 키
gcp-credentials.json
```

### 4. Git 커밋 전 확인

```bash
# 커밋 전 민감한 정보 검사
git status
git diff

# .env 파일이 Tracked 상태인지 확인
git ls-files | grep .env
# 결과가 없어야 정상 (있으면 삭제 필요)

# 만약 실수로 .env를 추가했다면
git rm --cached .env
git rm --cached backend/.env
```

---

## 🌐 Google Cloud 보안

### 1. 서비스 계정 권한 최소화

**최소 권한 원칙 적용:**
```bash
# Cloud Storage 읽기/쓰기만 필요한 경우
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Firestore 읽기/쓰기만 필요한 경우
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### 2. Cloud Storage 버킷 보안

#### Uniform Bucket-Level Access 활성화
```bash
gsutil uniformbucketlevelaccess set on gs://YOUR_BUCKET_NAME
```

#### 버킷 권한 확인
```bash
gsutil iam get gs://YOUR_BUCKET_NAME
```

#### 불필요한 공개 액세스 제거
```bash
gsutil iam ch -d allUsers gs://YOUR_BUCKET_NAME
gsutil iam ch -d allAuthenticatedUsers gs://YOUR_BUCKET_NAME
```

### 3. Firestore 보안 규칙

**Firestore 보안 규칙 예시:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 읽기/쓰기 가능
    match /projects/{projectId} {
      allow read, write: if request.auth != null;
    }

    // 특정 사용자만 자신의 프로젝트 접근 가능
    match /users/{userId}/projects/{projectId} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

---

## 🚨 API 키 노출 시 대응

### 1. 즉시 해야 할 일

1. **API 키 즉시 폐기**
   - [OpenAI API Keys](https://platform.openai.com/api-keys)
   - [Google Cloud Console](https://console.cloud.google.com/iam-admin/serviceaccounts)

2. **새 키 발급 및 교체**
   ```bash
   # .env 파일 업데이트
   nano .env
   # OPENAI_API_KEY=새로운키

   # 서비스 재시작
   pkill -f uvicorn
   uvicorn main:app --reload
   ```

3. **Git 히스토리에서 제거 (노출된 경우)**
   ```bash
   # BFG Repo-Cleaner 사용
   bfg --replace-text passwords.txt
   git push --force

   # 또는 git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

### 2. GitHub에 푸시한 경우

1. **GitHub Secret Scanning** 알림 확인
2. **즉시 키 폐기** (자동으로 무효화될 수 있음)
3. **Repository를 Private으로 전환** (임시 조치)
4. **Git 히스토리 정리** 후 Force Push

---

## 🔐 프로덕션 배포 보안

### 1. 환경변수 설정 (Cloud Run)

```bash
gcloud run deploy PROJECT_BREW \
  --set-env-vars OPENAI_API_KEY=your-key \
  --set-env-vars JWT_SECRET=production-secret \
  --set-env-vars GCS_BUCKET=your-bucket \
  --no-allow-unauthenticated
```

### 2. Secret Manager 사용 (권장)

```bash
# Secret 생성
echo -n "sk-proj-..." | \
  gcloud secrets create openai-api-key \
  --data-file=-

# Cloud Run에서 Secret 마운트
gcloud run deploy PROJECT_BREW \
  --set-secrets OPENAI_API_KEY=openai-api-key:latest
```

### 3. Cloud Functions 환경변수

```bash
gcloud functions deploy trigger_stt \
  --set-env-vars OPENAI_API_KEY=your-key \
  --runtime=python311 \
  --gen2
```

---

## 🛡️ 추가 보안 조치

### 1. CORS 설정 강화

**backend/main.py:**
```python
# 프로덕션 환경에서는 특정 도메인만 허용
origins = [
    "https://yourdomain.com",
    "https://app.yourdomain.com",
]

# 개발 환경에서만 localhost 허용
if os.getenv("NODE_ENV") == "development":
    origins.append("http://localhost:5173")
    origins.append("http://localhost:5174")
```

### 2. Rate Limiting 추가

```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter

@app.post("/api/youtube/process")
@limiter.limit("10/hour")  # 시간당 10번 제한
async def process_youtube_video(...):
    ...
```

### 3. JWT 토큰 보안

```python
import jwt
from datetime import datetime, timedelta

# 강력한 시크릿 사용
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET or JWT_SECRET == "your-super-secret-jwt-key-change-in-production":
    raise ValueError("프로덕션에서 JWT_SECRET을 반드시 변경하세요!")

# 짧은 만료 시간 설정
JWT_EXPIRY = timedelta(hours=1)

def create_token(user_id: str):
    payload = {
        "user_id": user_id,
        "exp": datetime.utcnow() + JWT_EXPIRY,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")
```

### 4. 입력 검증

```python
from pydantic import BaseModel, validator

class YouTubeProcessRequest(BaseModel):
    url: str
    target_languages: List[str] = ["en"]
    source_language: str = "ko"

    @validator("url")
    def validate_youtube_url(cls, v):
        if "youtube.com" not in v and "youtu.be" not in v:
            raise ValueError("올바른 YouTube URL이 아닙니다")
        return v

    @validator("target_languages")
    def validate_languages(cls, v):
        valid_langs = ["en", "ja", "zh", "es", "fr", "de", "ko"]
        for lang in v:
            if lang not in valid_langs:
                raise ValueError(f"지원하지 않는 언어: {lang}")
        return v
```

---

## 📋 보안 체크리스트

### 배포 전 체크리스트

- [ ] `.env` 파일이 `.gitignore`에 포함되어 있는가?
- [ ] Git 히스토리에 API 키가 없는가?
- [ ] 프로덕션 환경변수가 설정되어 있는가?
- [ ] JWT_SECRET이 기본값에서 변경되었는가?
- [ ] CORS가 특정 도메인만 허용하도록 설정되어 있는가?
- [ ] Rate limiting이 적용되어 있는가?
- [ ] Firestore 보안 규칙이 설정되어 있는가?
- [ ] Cloud Storage 버킷이 비공개인가?
- [ ] 서비스 계정 권한이 최소화되어 있는가?

### 정기 점검 항목

- [ ] API 사용량 모니터링 (비정상적인 증가 확인)
- [ ] 로그 확인 (의심스러운 접근 패턴)
- [ ] 의존성 업데이트 (보안 패치)
- [ ] API 키 로테이션 (3-6개월마다)

---

## 🆘 보안 사고 대응

### 1. API 키 노출 발견 시

1. **즉시 키 폐기** (5분 이내)
2. **새 키 발급 및 배포**
3. **사용 로그 확인** (비정상적인 사용 여부)
4. **Git 히스토리 정리**
5. **팀원에게 알림**

### 2. 무단 접근 발견 시

1. **즉시 서비스 중단** (필요시)
2. **로그 수집 및 분석**
3. **영향 범위 파악**
4. **패치 적용 및 재배포**
5. **사후 보고서 작성**

---

## 📞 연락처

보안 문제 발견 시:
- GitHub Issues: https://github.com/your-repo/issues
- 이메일: security@yourdomain.com

---

## 📚 참고 자료

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OpenAI API Security Best Practices](https://platform.openai.com/docs/guides/safety-best-practices)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

**Made with 🔒 by Project Brew Team**

**마지막 업데이트**: 2025-01-19
