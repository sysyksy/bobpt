# ⚡ "Invalid JWT Signature" 오류 빠른 해결

## 🔴 현재 문제

```
[ERROR] Failed to initialize project: Timeout of 60.0s exceeded,
last exception: 503 Getting metadata from plugin failed with error:
('invalid_grant: Invalid JWT Signature.', {'error': 'invalid_grant',
'error_description': 'Invalid JWT Signature.'})
```

**증상:**
- ❌ 프로젝트 초기화 실패 (500 에러)
- ❌ 프로젝트 목록 사라짐
- ❌ Firestore 연결 끊김

## 🎯 원인

Google Cloud 인증 정보(Service Account Key)가 **없거나 잘못됨**

현재 시스템 상태:
- ❌ Service Account Key 파일 없음 (`backend/*.json` 없음)
- ❌ `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 미설정
- ✅ Backend 서버는 실행 중이지만 인증 실패

## 🛠️ 해결 방법 (3단계)

### 🔑 Step 1: Service Account Key 다운로드

1. **Google Cloud Console 접속**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8
   ```

2. **서비스 계정 선택**
   - 기존 계정: `bobpt-backend` 또는 유사한 이름
   - 없다면: "CREATE SERVICE ACCOUNT" 클릭
     - 이름: `bobpt-backend`
     - 역할: Storage Admin, Cloud Datastore User, Cloud Translation API User

3. **키 생성**
   - 서비스 계정 클릭
   - "KEYS" 탭
   - "ADD KEY" > "Create new key"
   - "JSON" 선택
   - "CREATE" 클릭

   → JSON 파일 자동 다운로드 (예: `plasma-canyon-477402-i8-abc123.json`)

### 📁 Step 2: 키 파일 이동

```bash
# 다운로드한 파일을 backend 폴더로 복사
cp ~/Downloads/plasma-canyon-*.json /home/user/bobpt/backend/service-account-key.json

# 파일 확인
ls -la /home/user/bobpt/backend/service-account-key.json
```

### 🔧 Step 3: 환경 변수 설정 및 재시작

```bash
# 환경 변수 설정
export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"

# 영구 설정 (선택사항)
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"' >> ~/.bashrc
source ~/.bashrc

# Backend 재시작 (기존 서버 Ctrl+C로 중지 후)
cd /home/user/bobpt/backend
uvicorn main:app --reload --port 8000
```

**성공 메시지 확인:**
```
[OK] Google Cloud clients initialized successfully
INFO:     Uvicorn running on http://127.0.0.1:8000
```

---

## 🚀 자동 설정 스크립트

대화형 가이드를 따라하려면:

```bash
./setup-service-account.sh
```

이 스크립트는:
- ✅ 단계별 안내 제공
- ✅ 파일 복사 자동화
- ✅ 환경 변수 자동 설정
- ✅ 유효성 검사 수행

---

## ✅ 해결 확인

### 1. Backend 로그 확인

**성공:**
```
[OK] Google Cloud clients initialized successfully
```

**실패:**
```
[WARN] Google Cloud client initialization failed: ...
[INFO] Running in dev mode - GCS/Firestore/Translation features disabled
```

### 2. 프로젝트 목록 테스트

```bash
curl http://localhost:8000/api/projects
```

**성공:** JSON 응답 (프로젝트 목록 또는 빈 배열)
**실패:** 503 에러

### 3. Frontend에서 확인

1. Frontend 실행: `npm run dev`
2. 브라우저에서 http://localhost:5173 접속
3. 프로젝트 목록 표시 확인
4. 파일 업로드 테스트

---

## 🔍 추가 문제 해결

### 문제: "Permission denied" 에러

서비스 계정에 권한이 부족합니다.

**해결:**
```bash
# gcloud가 설치되어 있다면
gcloud projects add-iam-policy-binding plasma-canyon-477402-i8 \
  --member="serviceAccount:bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding plasma-canyon-477402-i8 \
  --member="serviceAccount:bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

또는 Google Cloud Console에서 수동으로 권한 부여:
1. IAM & Admin > IAM
2. 서비스 계정 찾기
3. "Edit principal" 클릭
4. 역할 추가

### 문제: JSON 파일이 잘못됨

**확인:**
```bash
cat backend/service-account-key.json | jq .
```

올바른 형식:
```json
{
  "type": "service_account",
  "project_id": "plasma-canyon-477402-i8",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com",
  ...
}
```

### 문제: 환경 변수가 설정되지 않음

**확인:**
```bash
echo $GOOGLE_APPLICATION_CREDENTIALS
```

**출력 없음 또는 빈 문자열이면:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"
```

새 터미널을 열 때마다 설정해야 하므로 `~/.bashrc`에 추가하는 것이 좋습니다.

---

## 📋 체크리스트

완료 여부를 확인하세요:

- [ ] Google Cloud Console에서 Service Account Key JSON 다운로드
- [ ] `backend/service-account-key.json` 파일 존재 확인
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` 환경 변수 설정
- [ ] Backend 서버 재시작
- [ ] `[OK] Google Cloud clients initialized successfully` 메시지 확인
- [ ] Frontend에서 프로젝트 목록 표시 확인
- [ ] 파일 업로드 테스트 성공

---

## 🆘 여전히 문제가 있다면

1. **진단 스크립트 실행:**
   ```bash
   ./quick-check.sh
   ```

2. **상세 가이드 참조:**
   - `GCS_CONNECTION_DIAGNOSIS.md`
   - `TROUBLESHOOTING-403.md`

3. **Backend 로그 확인:**
   - Backend 실행 시 출력되는 모든 메시지 확인
   - 특히 `[ERROR]`, `[WARN]` 메시지 주목

4. **Service Account Key 재생성:**
   - 기존 키 삭제
   - 새로운 키 생성
   - Step 1부터 다시 시작

---

## 💡 참고

- Service Account Key는 **민감 정보**입니다
- Git에 커밋하지 마세요 (`.gitignore`에 이미 포함됨)
- 키가 유출되면 즉시 삭제하고 새로 생성하세요
- 프로덕션 환경에서는 더 안전한 인증 방식(Workload Identity 등) 사용 권장
