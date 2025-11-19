# ✅ Service Account 권한 체크리스트

이 문서는 권한이 올바르게 설정되었는지 빠르게 확인하는 체크리스트입니다.

---

## 🔍 빠른 확인

### Google Cloud Console 접속

```
https://console.cloud.google.com/iam-admin/iam?project=plasma-canyon-477402-i8
```

---

## 📋 bobpt-backend 서비스 계정 체크리스트

서비스 계정 찾기: `bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com`

### ✅ 있어야 할 권한 (정확히 3개)

- [ ] **Storage Object Admin**
  - Role ID: `roles/storage.objectAdmin`
  - 용도: GCS 파일 업로드/다운로드/삭제

- [ ] **Cloud Datastore User**
  - Role ID: `roles/datastore.user`
  - 용도: Firestore 데이터 읽기/쓰기

- [ ] **Cloud Translation API User**
  - Role ID: `roles/cloudtranslate.user`
  - 용도: 번역 기능

### ❌ 없어야 할 권한

- [ ] **Owner** (roles/owner) - 제거 필요
- [ ] **Editor** (roles/editor) - 제거 필요
- [ ] **Viewer** (roles/viewer) - 제거 필요
- [ ] 기타 불필요한 권한들

---

## 📋 App Engine Default 서비스 계정 체크리스트

서비스 계정 찾기: `plasma-canyon-477402-i8@appspot.gserviceaccount.com`

### ❌ 제거해야 할 권한

- [ ] **Owner** - 제거 필요
- [ ] **Editor** - 제거 필요

**참고:** App Engine을 사용하지 않는다면 이 계정의 모든 권한을 제거해도 됩니다.

---

## 🛠️ 권한이 잘못된 경우 수정 방법

### 권한 제거하기

1. IAM 페이지에서 서비스 계정 찾기
2. 서비스 계정 옆 **✏️ (편집)** 아이콘 클릭
3. 제거할 권한 옆 **🗑️ (삭제)** 아이콘 클릭
4. **SAVE** 클릭

### 권한 추가하기

1. IAM 페이지에서 서비스 계정 찾기
2. 서비스 계정 옆 **✏️ (편집)** 아이콘 클릭
3. **ADD ANOTHER ROLE** 클릭
4. 검색창에 권한 이름 입력 (예: "Storage Object Admin")
5. 리스트에서 선택
6. **SAVE** 클릭

---

## 🎯 자주 하는 실수

### ❌ 실수 1: Role 검색 시 잘못된 권한 선택

**잘못된 예:**
- "Storage Admin" ← **너무 많은 권한**
- "Storage Object Creator" ← 다운로드 불가

**올바른 예:**
- "Storage Object Admin" ← **정확히 이것**

### ❌ 실수 2: Datastore와 Firestore 혼동

**잘못된 예:**
- "Datastore Owner" ← 너무 많은 권한

**올바른 예:**
- "Cloud Datastore User" ← **정확히 이것**

### ❌ 실수 3: 프로젝트 레벨이 아닌 리소스 레벨 권한

권한은 **프로젝트 레벨**에서 설정해야 합니다.
- ✅ IAM & Admin > IAM 에서 설정
- ❌ 개별 GCS 버킷이나 Firestore에서 설정 (충분하지 않음)

### ❌ 실수 4: Owner/Editor 권한 그대로 두기

Owner나 Editor 권한이 있으면:
- 보안 위험 증가
- 권한 범위가 너무 넓음
- 최소 권한 원칙 위반

**반드시 제거**하고 위의 3가지 권한만 설정하세요.

---

## 🧪 권한 설정 후 테스트

### 1. Backend 재시작

```bash
# 기존 서버 중지 (Ctrl+C)

# 재시작
cd /home/user/bobpt/backend
uvicorn main:app --reload --port 8000
```

**성공 메시지 확인:**
```
[OK] Google Cloud clients initialized successfully
```

**실패 시 메시지:**
```
[WARN] Google Cloud client initialization failed: ...
```

### 2. API 테스트

```bash
curl http://localhost:8000/api/projects
```

**성공:** JSON 응답 (프로젝트 목록 또는 빈 배열)

**실패:** 503 에러 또는 Permission denied

### 3. Frontend 테스트

1. Frontend 실행: `npm run dev`
2. http://localhost:5173 접속
3. 파일 업로드 시도
4. 프로젝트 목록 확인
5. 번역 기능 테스트

---

## 📊 올바른 권한 설정 예시

### IAM 페이지에서 보이는 모습

```
Principal                                              Role
─────────────────────────────────────────────────────────────────────
bobpt-backend@plasma-canyon-477402-i8...               Cloud Datastore User
                                                       Cloud Translation API User
                                                       Storage Object Admin
```

**총 3개의 권한만** 있어야 합니다.

---

## 🚨 흔한 오류와 원인

### 오류: "Permission denied on resource project..."

**원인:**
- Datastore User 권한 없음
- 또는 잘못된 서비스 계정 키 사용

**해결:**
1. Cloud Datastore User 권한 추가
2. Backend 재시작

### 오류: "403 Forbidden" (GCS 업로드 시)

**원인:**
- Storage Object Admin 권한 없음
- CORS 설정 안 됨

**해결:**
1. Storage Object Admin 권한 추가
2. `./setup-gcs.sh` 실행 (CORS 설정)
3. Backend 재시작

### 오류: "503 Translation API"

**원인:**
- Cloud Translation API User 권한 없음

**해결:**
1. Cloud Translation API User 권한 추가
2. Backend 재시작

---

## 🔄 권한 검증 자동화

대화형 검증 스크립트 실행:

```bash
./verify-permissions.sh
```

이 스크립트는:
- ✅ 현재 권한 입력 받기
- ✅ 필수 권한 확인
- ✅ 불필요한 권한 탐지
- ✅ 수정 방법 안내

---

## 📖 관련 문서

- **SERVICE_ACCOUNT_CLEANUP.md** - 권한 정리 전체 가이드
- **cleanup-permissions.sh** - 자동 정리 스크립트 (gcloud 필요)
- **QUICK_FIX_JWT_ERROR.md** - JWT 오류 해결 가이드

---

## ✅ 최종 확인

모든 체크리스트를 완료했다면:

- [ ] bobpt-backend에 정확히 3개 권한만 있음
- [ ] Owner/Editor 권한 없음
- [ ] App Engine default 계정 정리됨
- [ ] Backend 재시작 후 성공 메시지 확인
- [ ] 파일 업로드 테스트 성공
- [ ] 프로젝트 목록 정상 표시
- [ ] 번역 기능 정상 작동

---

**모든 항목이 체크되었다면 권한 설정 완료! 🎉**
