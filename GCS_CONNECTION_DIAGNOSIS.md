# Google Cloud Storage 연결 진단 보고서

## 🔍 진단 결과

### ❌ 발견된 문제

#### 1. **Backend 서버가 실행되고 있지 않음**
```bash
# 확인 결과: uvicorn 프로세스 없음
ps aux | grep uvicorn
# 결과: 프로세스 없음
```

#### 2. **Service Account Key 파일 없음**
```bash
# 확인 결과: .json 키 파일을 찾을 수 없음
ls backend/*.json
# 결과: No such file or directory
```

#### 3. **GOOGLE_APPLICATION_CREDENTIALS 환경 변수 미설정**
- Backend 코드에서 Google Cloud 클라이언트 초기화 시 필요
- 현재 설정되어 있지 않음

## ✅ 확인된 정상 항목

### 1. **.env 파일 설정 정상**
```bash
GOOGLE_CLOUD_PROJECT=plasma-canyon-477402-i8
GCS_BUCKET=bob-sto
PORT=8000
```

### 2. **프로젝트 구조 정상**
- Backend 코드 존재
- Frontend 코드 존재
- 설정 파일 존재

## 🛠️ 해결 방법

### 필수 작업 1: Service Account Key 다운로드

Google Cloud Console에서 서비스 계정 키를 다운로드해야 합니다:

1. **Google Cloud Console 접속**
   ```
   https://console.cloud.google.com/
   ```

2. **프로젝트 선택**
   - `plasma-canyon-477402-i8` 프로젝트 선택

3. **서비스 계정 페이지로 이동**
   ```
   IAM & Admin > Service Accounts
   ```

4. **서비스 계정 찾기**
   - `bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com` 찾기
   - 또는 기존 서비스 계정 선택

5. **키 생성 및 다운로드**
   - 서비스 계정 클릭
   - "KEYS" 탭 선택
   - "ADD KEY" > "Create new key" 클릭
   - "JSON" 형식 선택
   - 다운로드된 JSON 파일을 `backend/` 폴더에 저장
   - 파일명 예: `service-account-key.json`

### 필수 작업 2: 환경 변수 설정

**옵션 A: 환경 변수로 설정 (권장)**

```bash
# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"

# 영구 설정 (Linux/Mac)
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"' >> ~/.bashrc
source ~/.bashrc
```

**옵션 B: .env 파일에 추가**

`backend/.env` 파일에 다음 줄 추가:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/home/user/bobpt/backend/service-account-key.json
```

그리고 `backend/main.py`에서 이를 로드하도록 수정:
```python
import os
from dotenv import load_dotenv

load_dotenv()
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = os.getenv('GOOGLE_APPLICATION_CREDENTIALS', '')
```

### 필수 작업 3: CORS 설정 적용 (이전에 안 했다면)

```bash
# GCS 버킷에 CORS 설정 적용
./setup-gcs.sh

# 또는 수동으로
gsutil cors set gcs-cors.json gs://bob-sto
```

### 필수 작업 4: Backend 서버 시작

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**예상 출력:**
```
[OK] Google Cloud clients initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

**만약 에러가 발생하면:**
```
[WARN] Google Cloud client initialization failed: ...
[INFO] Running in dev mode - GCS/Firestore/Translation features disabled
```
→ Service account key가 제대로 설정되지 않은 것입니다.

## 🧪 연결 테스트

### 1. Backend API 테스트
```bash
# 터미널 1: Backend 실행
cd backend
uvicorn main:app --reload --port 8000

# 터미널 2: API 테스트
curl http://localhost:8000/api/projects
```

**성공 시 출력:**
```json
{"projects": [...]}
```

### 2. Frontend 실행 및 테스트
```bash
# 터미널 3: Frontend 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 후:
1. 파일 업로드 시도
2. 브라우저 개발자 도구 (F12) > Network 탭 확인
3. 403 에러 없는지 확인

## 📋 체크리스트

- [ ] Service Account Key JSON 파일 다운로드
- [ ] `backend/` 폴더에 키 파일 저장
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정
- [ ] GCS CORS 설정 적용 (`./setup-gcs.sh`)
- [ ] Backend 서버 시작 및 로그 확인
- [ ] Frontend 실행
- [ ] 파일 업로드 테스트
- [ ] 비디오 재생 테스트

## 🔧 추가 문제 해결

### 문제: "Permission denied" 에러

**해결:**
```bash
# Service Account에 권한 부여
gcloud projects add-iam-policy-binding plasma-canyon-477402-i8 \
  --member="serviceAccount:bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding plasma-canyon-477402-i8 \
  --member="serviceAccount:bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

### 문제: "Module not found" 에러

**해결:**
```bash
cd backend
pip install -r requirements.txt
```

### 문제: CORS 에러 계속 발생

**해결:**
```bash
# CORS 설정 확인
gsutil cors get gs://bob-sto

# CORS 재적용
gsutil cors set gcs-cors.json gs://bob-sto

# Backend 재시작
```

## 📞 지원

더 자세한 내용은:
- `TROUBLESHOOTING-403.md` 참조
- Google Cloud 문서: https://cloud.google.com/storage/docs/authentication
