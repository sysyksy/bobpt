# BOBPT Hub 디버깅 접근 방식 평가 및 개선점

## 📊 현재 상태 분석

### ✅ 잘하고 있는 점

1. **문서화가 매우 잘 되어있음**
   - `TROUBLESHOOTING-403.md`, `GCS_CONNECTION_DIAGNOSIS.md` 등 구체적인 트러블슈팅 가이드
   - 각 이슈별로 원인, 해결방법, 검증 단계까지 정리
   - 이건 정말 좋은 습관입니다!

2. **에러 로깅이 체계적**
   ```python
   print(f"[ERROR] Failed to generate chapters: {str(e)}")
   print(f"[OK] Chapters generated for project {project_id}")
   print(f"[INFO] Generating chapters for project {project_id}")
   ```
   - 로그 레벨 구분 ([ERROR], [OK], [INFO], [WARN])
   - 명확한 컨텍스트 포함

3. **환경 분리 처리**
   ```python
   try:
       storage_client = storage.Client()
   except Exception as e:
       print(f"[WARN] Google Cloud client initialization failed: {str(e)}")
       storage_client = None
   ```
   - GCP 없이도 로컬 개발 가능하도록 graceful degradation

## 🚨 개선이 필요한 부분

### 1. **에러 핸들링이 일관성 없음**

**문제:**
```python
# 패턴 1: 단순 raise
except Exception as e:
    print(f"[ERROR] Failed to get transcript: {str(e)}")
    raise HTTPException(status_code=500, detail=str(e))

# 패턴 2: HTTPException은 그냥 raise
except HTTPException:
    raise
except Exception as e:
    print(f"[ERROR] Login failed: {str(e)}")
    raise HTTPException(status_code=500, detail="Login failed")
```

**문제점:**
- 어떤 경우는 상세 에러를 노출하고 (보안 위험)
- 어떤 경우는 일반 메시지만 반환 (디버깅 어려움)
- 스택 트레이스 정보가 손실됨

**해결책:**
```python
# backend/utils/error_handler.py 생성
import logging
import traceback
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class ErrorHandler:
    """통일된 에러 핸들링"""
    
    @staticmethod
    def handle_exception(
        e: Exception, 
        context: str,
        user_message: str = "An error occurred",
        status_code: int = 500,
        log_stacktrace: bool = True
    ):
        """
        Args:
            e: 발생한 예외
            context: 에러 발생 위치 (예: "generate_chapters")
            user_message: 사용자에게 보여줄 메시지
            status_code: HTTP 상태 코드
            log_stacktrace: 스택트레이스 로깅 여부
        """
        # 개발 환경에서는 상세 정보 로깅
        if log_stacktrace:
            logger.error(f"[{context}] {str(e)}")
            logger.error(traceback.format_exc())
        else:
            logger.error(f"[{context}] {str(e)}")
        
        # HTTPException은 그대로 raise
        if isinstance(e, HTTPException):
            raise e
            
        # 프로덕션에서는 상세 에러 숨김
        raise HTTPException(
            status_code=status_code,
            detail=user_message
        )

# 사용 예시
@app.post("/api/projects/{project_id}/chapters")
def generate_chapters(project_id: str):
    try:
        # ... 로직 ...
        return {"chapters": chapters}
    except HTTPException:
        raise
    except Exception as e:
        ErrorHandler.handle_exception(
            e,
            context="generate_chapters",
            user_message="Failed to generate chapters. Please try again."
        )
```

### 2. **로깅 시스템이 print 기반**

**문제:**
```python
print(f"[ERROR] Failed to update transcript: {str(e)}")
```

**문제점:**
- 로그 레벨 필터링 불가
- 파일 저장/전송 어려움
- 운영 환경에서 디버깅 힘듦
- 타임스탬프 없음

**해결책:**
```python
# backend/config/logging_config.py
import logging
import sys
from logging.handlers import RotatingFileHandler

def setup_logging(log_level=logging.INFO):
    """통일된 로깅 설정"""
    
    # 로거 생성
    logger = logging.getLogger("bobpt")
    logger.setLevel(log_level)
    
    # 포맷 정의
    formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # 콘솔 핸들러
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # 파일 핸들러 (10MB 로그 파일, 5개까지 보관)
    file_handler = RotatingFileHandler(
        'logs/bobpt.log',
        maxBytes=10*1024*1024,
        backupCount=5
    )
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger

# main.py에서 사용
from config.logging_config import setup_logging

logger = setup_logging()

@app.post("/api/projects/{project_id}/chapters")
def generate_chapters(project_id: str):
    logger.info(f"Generating chapters for project {project_id}")
    try:
        # ... 로직 ...
        logger.info(f"Chapters generated successfully for {project_id}")
        return {"chapters": chapters}
    except Exception as e:
        logger.error(f"Failed to generate chapters for {project_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Chapter generation failed")
```

### 3. **디버깅 도구 부족**

**문제:**
- 요청/응답 추적 어려움
- 성능 병목 파악 불가
- 에러 발생 시 재현 어려움

**해결책:**

```python
# backend/middleware/debug_middleware.py
import time
import uuid
from fastapi import Request
import logging

logger = logging.getLogger("bobpt")

@app.middleware("http")
async def debug_middleware(request: Request, call_next):
    """요청/응답 로깅 및 성능 측정"""
    
    # 고유 요청 ID 생성
    request_id = str(uuid.uuid4())[:8]
    
    # 요청 정보 로깅
    logger.info(f"[{request_id}] {request.method} {request.url.path}")
    
    # 시작 시간 기록
    start_time = time.time()
    
    try:
        # 요청 처리
        response = await call_next(request)
        
        # 처리 시간 계산
        process_time = time.time() - start_time
        
        # 응답 로깅
        logger.info(
            f"[{request_id}] Completed in {process_time:.2f}s - "
            f"Status: {response.status_code}"
        )
        
        # 응답 헤더에 요청 ID 추가 (디버깅용)
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
        
    except Exception as e:
        logger.error(f"[{request_id}] Request failed: {str(e)}", exc_info=True)
        raise

# 느린 요청 감지
@app.middleware("http")
async def slow_request_detector(request: Request, call_next):
    """3초 이상 걸리는 요청 감지"""
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    if duration > 3.0:
        logger.warning(
            f"SLOW REQUEST: {request.method} {request.url.path} "
            f"took {duration:.2f}s"
        )
    
    return response
```

### 4. **환경별 설정이 하드코딩**

**문제:**
```python
BUCKET_NAME = "bob-sto"  # 하드코딩
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
]
```

**해결책:**
```python
# backend/config/settings.py
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """환경 변수 기반 설정"""
    
    # Google Cloud
    gcp_project_id: str
    gcp_bucket_name: str = "bob-sto"
    
    # CORS
    cors_origins: List[str] = ["http://localhost:5173"]
    
    # API Keys
    openai_api_key: str
    
    # Database
    firestore_collection: str = "projects"
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/bobpt.log"
    
    # JWT
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60 * 24  # 24시간
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# 사용
settings = Settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # ...
)
```

### 5. **테스트 코드 없음**

**문제:**
- 수동 테스트만 가능
- 회귀 버그 발견 어려움
- 리팩토링 시 불안함

**해결책:**
```python
# backend/tests/test_chapters.py
import pytest
from fastapi.testclient import TestClient
from unittest.mock import Mock, patch

from main import app

client = TestClient(app)

@pytest.fixture
def mock_firestore():
    """Firestore 모킹"""
    with patch('main.db') as mock_db:
        # 프로젝트 문서 모킹
        mock_doc = Mock()
        mock_doc.exists = True
        mock_doc.to_dict.return_value = {
            "transcript": [
                {"start_time": 0.0, "end_time": 5.0, "word": "안녕하세요"}
            ]
        }
        
        mock_db.collection.return_value.document.return_value.get.return_value = mock_doc
        yield mock_db

@pytest.fixture
def mock_chapter_generator():
    """챕터 생성 모킹"""
    with patch('main.generate_youtube_chapters') as mock_gen:
        mock_gen.return_value = "00:00 인트로\n05:00 본론"
        yield mock_gen

def test_generate_chapters_success(mock_firestore, mock_chapter_generator):
    """챕터 생성 성공 케이스"""
    response = client.post("/api/projects/test-project-id/chapters")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "completed"
    assert "chapters" in data

def test_generate_chapters_no_transcript(mock_firestore):
    """트랜스크립트 없을 때"""
    mock_firestore.collection.return_value.document.return_value.get.return_value.to_dict.return_value = {
        "transcript": []
    }
    
    response = client.post("/api/projects/test-project-id/chapters")
    assert response.status_code == 400

def test_generate_chapters_project_not_found():
    """프로젝트 없을 때"""
    with patch('main.db') as mock_db:
        mock_db.collection.return_value.document.return_value.get.return_value.exists = False
        response = client.post("/api/projects/test-project-id/chapters")
        assert response.status_code == 404
```

### 6. **데이터 형식 변환 로직이 산재**

**문제:**
```python
# 여기저기서 반복되는 변환 코드
if "start" in item and "end" in item:
    captions.append({...})
elif "start_time" in item:
    captions.append({...})
```

**해결책:**
```python
# backend/models/transcript.py
from typing import List, Dict, Any
from pydantic import BaseModel, Field

class TranscriptSegment(BaseModel):
    """통일된 트랜스크립트 세그먼트 모델"""
    start: float
    end: float
    text: str

    @classmethod
    def from_firestore(cls, data: Dict[str, Any]) -> "TranscriptSegment":
        """Firestore 포맷에서 변환"""
        # 새 형식
        if "start" in data and "end" in data:
            return cls(
                start=data["start"],
                end=data["end"],
                text=data.get("text", "")
            )
        # 구 형식
        elif "start_time" in data:
            return cls(
                start=data["start_time"],
                end=data["end_time"],
                text=data.get("word", "")
            )
        else:
            raise ValueError(f"Invalid transcript format: {data}")
    
    def to_firestore(self) -> Dict[str, Any]:
        """Firestore 저장 포맷으로 변환"""
        return {
            "start_time": self.start,
            "end_time": self.end,
            "word": self.text
        }

# 사용
transcript_segments = [
    TranscriptSegment.from_firestore(item) 
    for item in raw_transcript
]
```

## 🎯 디버깅 워크플로우 개선안

### Phase 1: 개발 중 (현재)

```bash
# 1. 로깅 개선
✓ print → logging 전환
✓ 요청 ID 추적
✓ 성능 측정

# 2. 에러 핸들링 통일
✓ ErrorHandler 클래스 도입
✓ 스택트레이스 보존

# 3. 환경 설정 분리
✓ .env 기반 설정
✓ 하드코딩 제거
```

### Phase 2: 테스트 도입

```bash
# 1. 단위 테스트
pytest backend/tests/

# 2. 통합 테스트
pytest backend/tests/integration/

# 3. CI/CD에서 자동 실행
```

### Phase 3: 모니터링

```bash
# 1. Sentry 연동 (에러 추적)
pip install sentry-sdk

# 2. 성능 모니터링
# Slow query 감지
# 메모리 사용량 추적

# 3. 알림 설정
# 중요 에러 발생 시 슬랙 알림
```

## 📝 즉시 적용 가능한 체크리스트

### 에러 발생 시
- [ ] 로그에 요청 ID가 있는가?
- [ ] 스택트레이스가 전부 기록되었는가?
- [ ] 재현 가능한가?
- [ ] 관련 문서가 업데이트되었는가?

### 코드 작성 시
- [ ] try-except는 통일된 패턴을 따르는가?
- [ ] 하드코딩된 값이 없는가?
- [ ] 로그 메시지가 충분히 상세한가?
- [ ] 에러 메시지가 사용자 친화적인가?

### 배포 전
- [ ] .env 파일이 업데이트되었는가?
- [ ] 로그 레벨이 적절한가? (dev=DEBUG, prod=INFO)
- [ ] 테스트가 통과했는가?
- [ ] 롤백 계획이 있는가?

## 🔧 권장 도구

### 디버깅
- **httpx**: API 테스트
- **ipdb**: Python 디버거
- **pytest**: 테스트 프레임워크

### 모니터링
- **Sentry**: 에러 추적
- **Datadog/New Relic**: APM

### 로그 관리
- **Loguru**: 더 나은 로깅
- **ELK Stack**: 로그 수집/분석

## 💡 마무리

**당장 시작하기 좋은 것 3가지:**

1. **로깅 시스템 개선** (1-2시간)
   - `logging_config.py` 생성
   - print → logger 전환

2. **에러 핸들러 통일** (2-3시간)
   - `ErrorHandler` 클래스 생성
   - 주요 엔드포인트에 적용

3. **디버깅 미들웨어 추가** (1시간)
   - 요청/응답 로깅
   - 성능 측정

**문서화도 이미 잘하고 계시니, 이 3가지만 추가하면 디버깅이 훨씬 수월해질 거예요!**
