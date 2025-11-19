# 🔧 Service Account 통합 및 권한 정리 가이드

## 📋 현재 상황

두 개의 서비스 계정이 존재:

1. **App Engine Default Service Account**
   - Email: `plasma-canyon-477402-i8@appspot.gserviceaccount.com`
   - 권한: 소유자, 편집자 ⚠️ (과도한 권한)

2. **BobPT Backend Service Account** (커스텀)
   - Email: `bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com`
   - 권한: 소유자, 편집자 ⚠️ (과도한 권한)

### ⚠️ 문제점

1. **중복된 서비스 계정** - 관리 복잡도 증가
2. **과도한 권한** - 소유자/편집자 권한은 보안상 위험
3. **최소 권한 원칙 위반** - 필요한 권한만 부여해야 함

---

## ✅ 권장 솔루션

### 사용할 서비스 계정: `bobpt-backend`

**이유:**
- ✅ 용도가 명확함 (BobPT 전용)
- ✅ 커스텀 계정으로 관리가 쉬움
- ✅ App Engine default는 App Engine에서만 사용

### 필요한 최소 권한

BobPT Backend에 필요한 권한만:

| 역할 (Role) | 용도 | 권한 ID |
|------------|------|---------|
| **Storage Object Admin** | GCS 파일 업로드/다운로드/삭제 | `roles/storage.objectAdmin` |
| **Cloud Datastore User** | Firestore 읽기/쓰기 | `roles/datastore.user` |
| **Cloud Translation API User** | 번역 기능 | `roles/cloudtranslate.user` |

---

## 🛠️ 정리 절차

### Step 1: bobpt-backend 서비스 계정 권한 재설정

#### 1-1. Google Cloud Console 접속

```
https://console.cloud.google.com/iam-admin/iam?project=plasma-canyon-477402-i8
```

#### 1-2. bobpt-backend 서비스 계정 찾기

`bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com` 찾기

#### 1-3. 기존 권한 제거

1. 서비스 계정 옆 편집 아이콘 (✏️) 클릭
2. **소유자** 역할 제거 (❌ 삭제 버튼)
3. **편집자** 역할 제거 (❌ 삭제 버튼)

#### 1-4. 필요한 권한만 추가

"ADD ANOTHER ROLE" 버튼으로 다음 역할 추가:

1. **Storage Object Admin**
   - 역할 검색: "Storage Object Admin"
   - 선택: `roles/storage.objectAdmin`

2. **Cloud Datastore User**
   - 역할 검색: "Cloud Datastore User"
   - 선택: `roles/datastore.user`

3. **Cloud Translation API User**
   - 역할 검색: "Cloud Translation API User"
   - 선택: `roles/cloudtranslate.user`

4. "SAVE" 클릭

---

### Step 2: App Engine Default Service Account 권한 정리

#### 2-1. App Engine 사용 여부 확인

**BobPT가 App Engine을 사용하지 않는다면:**

1. App Engine default service account 찾기:
   `plasma-canyon-477402-i8@appspot.gserviceaccount.com`

2. 편집 아이콘 클릭

3. **소유자**, **편집자** 역할 제거

4. App Engine을 사용하지 않으면 **비활성화** (또는 최소 권한만 유지)

**App Engine을 사용한다면:**

- App Engine 기본 권한만 유지
- 소유자/편집자는 제거

---

### Step 3: bobpt-backend 서비스 계정 키 생성

기존 키가 없거나 App Engine default를 사용 중이었다면:

1. **Service Accounts 페이지로 이동**
   ```
   https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8
   ```

2. **bobpt-backend** 클릭

3. **KEYS** 탭 클릭

4. **ADD KEY** > **Create new key** 선택

5. **JSON** 선택 > **CREATE**

6. 다운로드된 JSON 파일 저장

---

### Step 4: Backend 설정 업데이트

#### 4-1. 키 파일 배치

```bash
# 다운로드한 키 파일을 backend 폴더로 복사
cp ~/Downloads/plasma-canyon-477402-i8-*.json /home/user/bobpt/backend/service-account-key.json

# 파일 확인
cat backend/service-account-key.json | jq '.client_email'
# 출력: "bobpt-backend@plasma-canyon-477402-i8.iam.gserviceaccount.com"
```

#### 4-2. 환경 변수 설정

```bash
# 환경 변수 설정
export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"

# 영구 설정
echo 'export GOOGLE_APPLICATION_CREDENTIALS="/home/user/bobpt/backend/service-account-key.json"' >> ~/.bashrc
source ~/.bashrc
```

#### 4-3. Backend 재시작

```bash
# 기존 서버 중지 (Ctrl+C)
# 재시작
cd /home/user/bobpt/backend
uvicorn main:app --reload --port 8000
```

**성공 확인:**
```
[OK] Google Cloud clients initialized successfully
```

---

## 🧪 테스트

### 1. Firestore 연결 테스트

```bash
curl http://localhost:8000/api/projects
```

**성공:** JSON 응답 (프로젝트 목록)

### 2. GCS 업로드 테스트

Frontend에서 파일 업로드 시도

**성공:** 업로드 완료 후 프로젝트 목록에 표시

### 3. 번역 기능 테스트

Editor에서 번역 버튼 클릭

**성공:** 번역된 텍스트 표시

---

## 📊 권한 비교

### Before (과도한 권한) ❌

| 서비스 계정 | 권한 | 문제 |
|-----------|------|------|
| bobpt-backend | 소유자, 편집자 | 모든 리소스 접근 가능 (위험) |
| appspot default | 소유자, 편집자 | 모든 리소스 접근 가능 (위험) |

### After (최소 권한) ✅

| 서비스 계정 | 권한 | 범위 |
|-----------|------|------|
| **bobpt-backend** | Storage Object Admin | GCS만 |
| | Cloud Datastore User | Firestore만 |
| | Cloud Translation API User | Translation API만 |
| appspot default | (비활성화 또는 App Engine 기본 권한) | App Engine만 |

---

## 🔒 보안 개선 사항

1. **최소 권한 원칙 적용** ✅
   - 필요한 서비스에만 접근 가능
   - 프로젝트 전체 권한 제거

2. **서비스 계정 분리** ✅
   - 각 용도별 계정 명확히 구분
   - BobPT는 bobpt-backend만 사용

3. **감사 추적 개선** ✅
   - 어떤 계정이 어떤 작업을 했는지 명확히 구분

4. **잠재적 피해 최소화** ✅
   - 키가 유출되어도 제한된 리소스만 영향

---

## 🚀 자동 권한 설정 (gcloud CLI 사용)

gcloud가 설치되어 있다면:

```bash
#!/bin/bash

PROJECT_ID="plasma-canyon-477402-i8"
SERVICE_ACCOUNT="bobpt-backend@${PROJECT_ID}.iam.gserviceaccount.com"

# 1. 기존 소유자/편집자 권한 제거
gcloud projects remove-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/owner" || true

gcloud projects remove-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/editor" || true

# 2. 필요한 권한만 추가
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/storage.objectAdmin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/datastore.user"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/cloudtranslate.user"

echo "✅ bobpt-backend 권한 설정 완료"

# 3. App Engine default 권한 제거
APPENGINE_SA="${PROJECT_ID}@appspot.gserviceaccount.com"

gcloud projects remove-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${APPENGINE_SA}" \
  --role="roles/owner" || true

gcloud projects remove-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${APPENGINE_SA}" \
  --role="roles/editor" || true

echo "✅ App Engine default 권한 정리 완료"

# 4. 현재 권한 확인
echo ""
echo "📋 bobpt-backend 현재 권한:"
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:${SERVICE_ACCOUNT}" \
  --format="table(bindings.role)"
```

위 스크립트를 `cleanup-permissions.sh`로 저장하고 실행:

```bash
chmod +x cleanup-permissions.sh
./cleanup-permissions.sh
```

---

## ✅ 체크리스트

- [ ] Google Cloud Console IAM 페이지 접속
- [ ] bobpt-backend에서 소유자/편집자 권한 제거
- [ ] bobpt-backend에 필요한 3개 권한만 추가
  - [ ] Storage Object Admin
  - [ ] Cloud Datastore User
  - [ ] Cloud Translation API User
- [ ] App Engine default service account 권한 제거/정리
- [ ] bobpt-backend 서비스 계정 키 다운로드
- [ ] backend/service-account-key.json 파일 배치
- [ ] GOOGLE_APPLICATION_CREDENTIALS 환경 변수 설정
- [ ] Backend 재시작 및 성공 메시지 확인
- [ ] Firestore 연결 테스트
- [ ] GCS 업로드 테스트
- [ ] 번역 기능 테스트

---

## 📞 참고 자료

- [Google Cloud IAM Best Practices](https://cloud.google.com/iam/docs/best-practices)
- [Principle of Least Privilege](https://cloud.google.com/iam/docs/using-iam-securely#least_privilege)
- [Service Account Permissions](https://cloud.google.com/iam/docs/service-account-permissions)

---

## 💡 추가 고려사항

### 프로덕션 환경

프로덕션 배포 시:
- Workload Identity 사용 고려 (키 파일 불필요)
- 환경별 서비스 계정 분리 (dev, staging, prod)
- 정기적인 키 로테이션
- Cloud Audit Logs 활성화

### 모니터링

- Cloud Monitoring으로 API 사용량 추적
- IAM Policy Analyzer로 권한 사용 분석
- Recommender로 불필요한 권한 탐지
