# 🚀 Project Brew - 빠른 시작 가이드

이 가이드는 Project Brew의 완벽한 설정과 실행을 위한 단계별 절차입니다.

## 📋 요구사항

- **Node.js** 18+ (프론트엔드)
- **Python** 3.10+ (백엔드)
- **FFmpeg** (오디오 추출)
- **Google Cloud 계정** (선택사항, 번역 기능 사용 시)

---

## 🔧 1단계: 프로젝트 설정

### 1.1 저장소 클론 및 의존성 설치

```bash
cd project-brew/bobpt

# 프론트엔드 의존성
npm install

# 백엔드 가상 환경 설정
cd backend
python -m venv venv
source venv/Scripts/activate  # Windows PowerShell
# 또는
source venv/bin/activate  # Mac/Linux

# 백엔드 의존성
pip install -r requirements.txt
```

### 1.2 FFmpeg 설치

**Windows:**
```bash
# Chocolatey 사용
choco install ffmpeg

# 또는 직접 다운로드
# https://ffmpeg.org/download.html
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu):**
```bash
sudo apt-get install ffmpeg
```

---

## ☁️ 2단계: Google Cloud 설정 (선택사항)

번역 기능을 사용하려면 Google Cloud 설정이 필요합니다.

### 옵션 A: 자동 설정 스크립트 (권장)

**Windows (PowerShell):**
```powershell
# 프로젝트 루트에서
.\setup-google-cloud.ps1
```

**Mac/Linux (Bash):**
```bash
# 프로젝트 루트에서
chmod +x setup-google-cloud.sh
./setup-google-cloud.sh
```

### 옵션 B: 수동 설정

자세한 단계는 [GOOGLE_CLOUD_SETUP.md](./GOOGLE_CLOUD_SETUP.md) 참고

**빠른 체크리스트:**
1. Google Cloud 프로젝트 생성: `project-brew`
2. 서비스 계정 생성 및 JSON 키 다운로드
3. Cloud Translation API 활성화
4. 환경 변수 설정:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
   GOOGLE_CLOUD_PROJECT=project-brew-123456
   ```

---

## 🎬 3단계: 애플리케이션 실행

### 터미널 1: 백엔드 서버 시작

```bash
cd project-brew/bobpt/backend
source venv/Scripts/activate  # Windows: venv\Scripts\activate.bat
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

예상 출력:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### 터미널 2: 프론트엔드 개발 서버 시작

```bash
cd project-brew/bobpt
npm run dev
```

예상 출력:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

### 3단계 검증

- 브라우저에서 `http://localhost:5173` 접속
- 비디오 업로드 페이지 확인

---

## 📹 4단계: 첫 번째 비디오 처리

### 4.1 비디오 업로드

1. 브라우저에서 `http://localhost:5173` 접속
2. 비디오 파일 선택 및 업로드 (MP4, WebM 등)
3. 자동 STT(음성-텍스트) 처리 시작
4. 진행 상황 바를 통해 상태 모니터링

### 4.2 자막 편집

처리 완료 후:

1. **자막 선택**: 오른쪽 패널에서 자막 클릭
2. **편집 모드**: 연필 아이콘 클릭
3. **텍스트 수정**: 자막 텍스트 편집
4. **저장**: 체크 아이콘 클릭

### 4.3 번역 (선택사항)

Google Cloud 설정이 완료된 경우:

1. 자막 선택 후 "번역" 버튼 클릭
2. 언어 선택 (한국어, 영어 등)
3. 자동 번역 적용

---

## 🎨 5단계: 새로운 에디터 페이지 사용

### 에디터 페이지 특징

새로 만들어진 `EditorPageV2.tsx` 컴포넌트는:

- **Neon Focus 테마**: 다크 모드 + 전기 파란색 액센트
- **3단 레이아웃**:
  - 왼쪽 상단: 비디오 플레이어
  - 왼쪽 하단: 타임라인 시각화
  - 오른쪽: 자막 편집 패널
- **직관적인 상호작용**: 자막 클릭으로 타임스탬프 이동

### EditorPageV2 통합

```tsx
// src/App.tsx에서
import EditorPageV2 from './EditorPageV2';

// 라우터에 추가
<Route path="/editor-v2" element={<EditorPageV2 />} />
```

또는 기존 EditorPage 대체:

```tsx
export default EditorPageV2;  // EditorPage 대신
```

---

## 🧪 6단계: 기본 테스트

### API 엔드포인트 테스트

```bash
# 프로젝트 목록 조회
curl http://localhost:8000/api/projects

# 특정 프로젝트 조회
curl http://localhost:8000/api/projects/{project_id}

# 트랜스크립트 조회
curl http://localhost:8000/api/projects/{project_id}/transcript

# 자막 번역 테스트
curl -X POST http://localhost:8000/api/translate-captions \
  -H "Content-Type: application/json" \
  -d '{
    "captions": [
      {"start": 0, "end": 5, "text": "Hello world"}
    ],
    "targetLanguage": "ko-KR"
  }'
```

### UI 테스트

1. ✓ 비디오 업로드
2. ✓ STT 처리 진행 상황 표시
3. ✓ 자막 표시
4. ✓ 자막 편집
5. ✓ 타임라인 상호작용
6. ✓ 재생/일시중지

---

## 🐛 문제 해결

### "포트 8000이 이미 사용 중" 오류

```bash
# 다른 포트 사용
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

### "FFmpeg를 찾을 수 없음" 오류

```bash
# FFmpeg 설치 확인
ffmpeg -version

# 설치되지 않았으면 위의 설치 지침 참고
```

### "Google Cloud 인증 오류"

```bash
# 환경 변수 확인
echo $GOOGLE_CLOUD_PROJECT  # Mac/Linux
echo %GOOGLE_CLOUD_PROJECT%  # Windows

# 다시 설정
# Windows: .\setup-google-cloud.ps1
# Mac/Linux: ./setup-google-cloud.sh
```

### "모듈을 찾을 수 없음" 오류

```bash
# 가상 환경 활성화 확인
source venv/Scripts/activate  # Windows

# 의존성 재설치
pip install -r requirements.txt
```

---

## 📁 프로젝트 구조

```
project-brew/
├── bobpt/
│   ├── backend/
│   │   ├── main.py              # FastAPI 메인 서버
│   │   ├── database.py          # SQLite ORM 정의
│   │   ├── stt_processor.py     # Whisper STT 처리
│   │   └── requirements.txt     # Python 의존성
│   ├── src/
│   │   ├── App.tsx              # 메인 앱 컴포넌트
│   │   ├── EditorPageV2.tsx     # 새로운 에디터 페이지
│   │   ├── pages/
│   │   ├── components/
│   │   └── apiClient.ts         # API 통신
│   ├── GOOGLE_CLOUD_SETUP.md    # Google Cloud 상세 가이드
│   ├── setup-google-cloud.ps1   # Windows 자동 설정
│   ├── setup-google-cloud.sh    # Mac/Linux 자동 설정
│   └── package.json
└── ...
```

---

## 🚀 배포 준비

### 환경 변수 체크리스트

```bash
# 프로덕션 환경 변수
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/to/key.json
GOOGLE_CLOUD_PROJECT=project-brew-prod
DATABASE_URL=postgresql://user:pass@localhost/bobpt
VITE_API_URL=https://api.yourdomain.com
```

### 보안 체크리스트

- [ ] `.gitignore`에 `*-key.json` 추가
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정
- [ ] 서비스 계정에 최소 권한만 부여 (Editor 제외)
- [ ] API 키와 민감한 정보가 코드에 노출되지 않음
- [ ] HTTPS 활성화
- [ ] CORS 설정 검토

---

## 📚 참고 문서

- [Google Cloud 상세 설정](./GOOGLE_CLOUD_SETUP.md)
- [변경 사항 요약](./CHANGES_SUMMARY.md)
- [API 문서](./docs/API.md) (필요시 생성)
- [에디터 페이지 가이드](./docs/EDITOR_PAGE.md) (필요시 생성)

---

## 💡 팁

### 개발 중 빠른 리로드

- **프론트엔드**: Vite 자동 리로드 (HMR 활성화)
- **백엔드**: `--reload` 플래그로 자동 리로드

### 데이터 초기화

```bash
# SQLite 데이터베이스 재설정
rm backend/bobpt.db
python -c "from database import init_db; init_db()"
```

### 로그 레벨 조정

```bash
# 상세 로깅
python -m uvicorn main:app --reload --log-level debug

# 최소 로깅
python -m uvicorn main:app --reload --log-level error
```

---

## 🎓 학습 리소스

- [FastAPI 문서](https://fastapi.tiangolo.com/)
- [React 문서](https://react.dev)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [Google Cloud Translation](https://cloud.google.com/translate/docs)

---

## 💬 피드백 및 지원

문제가 발생하거나 개선 사항이 있으면:

1. GitHub Issues에서 확인
2. 또는 [support@projectbrew.com](mailto:support@projectbrew.com)로 연락

---

**🎉 Project Brew 시작을 축하합니다!**

