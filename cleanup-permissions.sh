#!/bin/bash

# Service Account 권한 정리 스크립트
# bobpt-backend를 메인 서비스 계정으로 설정하고 최소 권한만 부여

set -e

PROJECT_ID="plasma-canyon-477402-i8"
BOBPT_SA="bobpt-backend@${PROJECT_ID}.iam.gserviceaccount.com"
APPENGINE_SA="${PROJECT_ID}@appspot.gserviceaccount.com"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔧 BobPT Service Account 권한 정리"
echo "========================================"
echo ""
echo "프로젝트: ${PROJECT_ID}"
echo "메인 서비스 계정: ${BOBPT_SA}"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ gcloud CLI가 설치되지 않았습니다${NC}"
    echo ""
    echo "gcloud 설치 방법:"
    echo "  https://cloud.google.com/sdk/docs/install"
    echo ""
    echo "또는 Google Cloud Console에서 수동으로 설정:"
    echo "  https://console.cloud.google.com/iam-admin/iam?project=${PROJECT_ID}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ gcloud CLI 발견${NC}"
echo ""

# Check authentication
echo "인증 상태 확인 중..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo -e "${RED}❌ gcloud 인증이 필요합니다${NC}"
    echo ""
    echo "다음 명령어로 로그인하세요:"
    echo "  gcloud auth login"
    echo ""
    exit 1
fi

ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
echo -e "${GREEN}✅ 로그인됨: ${ACTIVE_ACCOUNT}${NC}"
echo ""

# Set project
echo "프로젝트 설정 중..."
gcloud config set project ${PROJECT_ID}
echo ""

# Confirm before proceeding
echo -e "${YELLOW}⚠️  주의: 다음 작업을 수행합니다:${NC}"
echo ""
echo "1. bobpt-backend 서비스 계정 권한 정리"
echo "   - 제거: 소유자, 편집자 (과도한 권한)"
echo "   - 추가: Storage Object Admin, Cloud Datastore User, Cloud Translation API User"
echo ""
echo "2. App Engine default 서비스 계정 권한 정리"
echo "   - 제거: 소유자, 편집자"
echo ""

read -p "계속하시겠습니까? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "취소됨"
    exit 0
fi
echo ""

# =====================================
# Part 1: bobpt-backend 권한 정리
# =====================================

echo "========================================"
echo "📋 Part 1: bobpt-backend 권한 정리"
echo "========================================"
echo ""

# Check if service account exists
if ! gcloud iam service-accounts describe ${BOBPT_SA} &> /dev/null; then
    echo -e "${RED}❌ 서비스 계정이 존재하지 않습니다: ${BOBPT_SA}${NC}"
    echo ""
    echo "Google Cloud Console에서 먼저 생성하세요:"
    echo "  https://console.cloud.google.com/iam-admin/serviceaccounts?project=${PROJECT_ID}"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ 서비스 계정 존재 확인: ${BOBPT_SA}${NC}"
echo ""

# Get current roles
echo "현재 권한 조회 중..."
CURRENT_ROLES=$(gcloud projects get-iam-policy ${PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${BOBPT_SA}" \
  --format="value(bindings.role)" 2>/dev/null || echo "")

if [ -n "$CURRENT_ROLES" ]; then
    echo "현재 권한:"
    echo "$CURRENT_ROLES" | while read role; do
        echo "  - $role"
    done
else
    echo "  (권한 없음)"
fi
echo ""

# Remove excessive permissions
echo "과도한 권한 제거 중..."

if echo "$CURRENT_ROLES" | grep -q "roles/owner"; then
    echo -e "${YELLOW}  - 소유자 권한 제거...${NC}"
    gcloud projects remove-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${BOBPT_SA}" \
      --role="roles/owner" \
      --quiet || true
    echo -e "${GREEN}    ✓ 완료${NC}"
fi

if echo "$CURRENT_ROLES" | grep -q "roles/editor"; then
    echo -e "${YELLOW}  - 편집자 권한 제거...${NC}"
    gcloud projects remove-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${BOBPT_SA}" \
      --role="roles/editor" \
      --quiet || true
    echo -e "${GREEN}    ✓ 완료${NC}"
fi

echo ""

# Add necessary permissions
echo "필요한 권한 추가 중..."

# Storage Object Admin
if ! echo "$CURRENT_ROLES" | grep -q "roles/storage.objectAdmin"; then
    echo -e "${BLUE}  + Storage Object Admin 추가...${NC}"
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${BOBPT_SA}" \
      --role="roles/storage.objectAdmin" \
      --condition=None \
      --quiet
    echo -e "${GREEN}    ✓ 완료${NC}"
else
    echo -e "${GREEN}  ✓ Storage Object Admin 이미 있음${NC}"
fi

# Cloud Datastore User
if ! echo "$CURRENT_ROLES" | grep -q "roles/datastore.user"; then
    echo -e "${BLUE}  + Cloud Datastore User 추가...${NC}"
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${BOBPT_SA}" \
      --role="roles/datastore.user" \
      --condition=None \
      --quiet
    echo -e "${GREEN}    ✓ 완료${NC}"
else
    echo -e "${GREEN}  ✓ Cloud Datastore User 이미 있음${NC}"
fi

# Cloud Translation API User
if ! echo "$CURRENT_ROLES" | grep -q "roles/cloudtranslate.user"; then
    echo -e "${BLUE}  + Cloud Translation API User 추가...${NC}"
    gcloud projects add-iam-policy-binding ${PROJECT_ID} \
      --member="serviceAccount:${BOBPT_SA}" \
      --role="roles/cloudtranslate.user" \
      --condition=None \
      --quiet
    echo -e "${GREEN}    ✓ 완료${NC}"
else
    echo -e "${GREEN}  ✓ Cloud Translation API User 이미 있음${NC}"
fi

echo ""
echo -e "${GREEN}✅ bobpt-backend 권한 설정 완료${NC}"
echo ""

# =====================================
# Part 2: App Engine default 권한 정리
# =====================================

echo "========================================"
echo "📋 Part 2: App Engine default 권한 정리"
echo "========================================"
echo ""

# Check if App Engine default service account exists
if gcloud iam service-accounts describe ${APPENGINE_SA} &> /dev/null; then
    echo -e "${GREEN}✅ App Engine default 서비스 계정 존재${NC}"
    echo ""

    # Get current roles
    echo "현재 권한 조회 중..."
    APPENGINE_ROLES=$(gcloud projects get-iam-policy ${PROJECT_ID} \
      --flatten="bindings[].members" \
      --filter="bindings.members:serviceAccount:${APPENGINE_SA}" \
      --format="value(bindings.role)" 2>/dev/null || echo "")

    if [ -n "$APPENGINE_ROLES" ]; then
        echo "현재 권한:"
        echo "$APPENGINE_ROLES" | while read role; do
            echo "  - $role"
        done
    else
        echo "  (권한 없음)"
    fi
    echo ""

    # Remove excessive permissions
    echo "과도한 권한 제거 중..."

    if echo "$APPENGINE_ROLES" | grep -q "roles/owner"; then
        echo -e "${YELLOW}  - 소유자 권한 제거...${NC}"
        gcloud projects remove-iam-policy-binding ${PROJECT_ID} \
          --member="serviceAccount:${APPENGINE_SA}" \
          --role="roles/owner" \
          --quiet || true
        echo -e "${GREEN}    ✓ 완료${NC}"
    fi

    if echo "$APPENGINE_ROLES" | grep -q "roles/editor"; then
        echo -e "${YELLOW}  - 편집자 권한 제거...${NC}"
        gcloud projects remove-iam-policy-binding ${PROJECT_ID} \
          --member="serviceAccount:${APPENGINE_SA}" \
          --role="roles/editor" \
          --quiet || true
        echo -e "${GREEN}    ✓ 완료${NC}"
    fi

    echo ""
    echo -e "${GREEN}✅ App Engine default 권한 정리 완료${NC}"
else
    echo -e "${YELLOW}⚠️  App Engine default 서비스 계정 없음 (건너뜀)${NC}"
fi

echo ""

# =====================================
# Summary
# =====================================

echo "========================================"
echo "📊 최종 권한 확인"
echo "========================================"
echo ""

echo "bobpt-backend 서비스 계정 권한:"
gcloud projects get-iam-policy ${PROJECT_ID} \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${BOBPT_SA}" \
  --format="table(bindings.role)" || echo "  (권한 없음)"

echo ""
echo "========================================"
echo "✅ 권한 정리 완료!"
echo "========================================"
echo ""
echo "다음 단계:"
echo "1. bobpt-backend 서비스 계정 키 다운로드 (아직 안 했다면)"
echo "   https://console.cloud.google.com/iam-admin/serviceaccounts?project=${PROJECT_ID}"
echo ""
echo "2. 키 파일을 backend 폴더에 저장"
echo "   cp ~/Downloads/plasma-canyon-*.json /home/user/bobpt/backend/service-account-key.json"
echo ""
echo "3. 환경 변수 설정"
echo "   export GOOGLE_APPLICATION_CREDENTIALS=\"/home/user/bobpt/backend/service-account-key.json\""
echo ""
echo "4. Backend 재시작"
echo "   cd /home/user/bobpt/backend && uvicorn main:app --reload --port 8000"
echo ""
