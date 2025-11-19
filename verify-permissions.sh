#!/bin/bash

# Service Account 권한 검증 가이드
# Google Cloud Console에서 현재 권한 상태를 확인하는 방법

echo "🔍 Service Account 권한 검증 가이드"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PROJECT_ID="plasma-canyon-477402-i8"
BOBPT_SA="bobpt-backend@${PROJECT_ID}.iam.gserviceaccount.com"

echo "이 가이드는 Google Cloud Console에서 권한을 확인하는 방법을 안내합니다."
echo ""

# =====================================
# Step 1: Console 접속
# =====================================

echo "========================================"
echo "📋 Step 1: IAM 페이지 접속"
echo "========================================"
echo ""
echo "다음 링크를 브라우저에서 열어주세요:"
echo -e "${BLUE}https://console.cloud.google.com/iam-admin/iam?project=${PROJECT_ID}${NC}"
echo ""
read -p "IAM 페이지를 열었으면 Enter를 누르세요..."
echo ""

# =====================================
# Step 2: bobpt-backend 권한 확인
# =====================================

echo "========================================"
echo "📋 Step 2: bobpt-backend 권한 확인"
echo "========================================"
echo ""
echo "IAM 페이지에서 다음 서비스 계정을 찾으세요:"
echo -e "${BLUE}${BOBPT_SA}${NC}"
echo ""
echo "권한 확인:"
echo ""

# Expected permissions
echo -e "${GREEN}✅ 있어야 할 권한 (정확히 이 3개):${NC}"
echo "   1. Storage Object Admin (roles/storage.objectAdmin)"
echo "   2. Cloud Datastore User (roles/datastore.user)"
echo "   3. Cloud Translation API User (roles/cloudtranslate.user)"
echo ""

echo -e "${RED}❌ 없어야 할 권한:${NC}"
echo "   - Owner (roles/owner)"
echo "   - Editor (roles/editor)"
echo "   - Viewer (roles/viewer)"
echo "   - 기타 불필요한 권한"
echo ""

read -p "bobpt-backend의 현재 권한을 확인했으면 Enter를 누르세요..."
echo ""

# User input for current permissions
echo "현재 bobpt-backend에 설정된 권한을 입력해주세요:"
echo "(여러 개일 경우 한 줄에 하나씩, 완료 후 빈 줄에서 Enter)"
echo ""

CURRENT_PERMS=()
while true; do
    read -p "권한 (완료: 빈 줄에서 Enter): " perm
    if [ -z "$perm" ]; then
        break
    fi
    CURRENT_PERMS+=("$perm")
done

echo ""
echo "입력한 권한:"
for perm in "${CURRENT_PERMS[@]}"; do
    echo "  - $perm"
done
echo ""

# =====================================
# Step 3: 권한 검증
# =====================================

echo "========================================"
echo "📋 Step 3: 권한 검증"
echo "========================================"
echo ""

HAS_STORAGE=false
HAS_DATASTORE=false
HAS_TRANSLATE=false
HAS_OWNER=false
HAS_EDITOR=false
EXTRA_PERMS=()

for perm in "${CURRENT_PERMS[@]}"; do
    case "$perm" in
        *"Storage Object Admin"*|*"storage.objectAdmin"*)
            HAS_STORAGE=true
            ;;
        *"Cloud Datastore User"*|*"datastore.user"*)
            HAS_DATASTORE=true
            ;;
        *"Cloud Translation"*|*"cloudtranslate.user"*)
            HAS_TRANSLATE=true
            ;;
        *"Owner"*|*"owner"*)
            HAS_OWNER=true
            ;;
        *"Editor"*|*"editor"*)
            HAS_EDITOR=true
            ;;
        *)
            EXTRA_PERMS+=("$perm")
            ;;
    esac
done

# Check required permissions
echo "필수 권한 체크:"
if [ "$HAS_STORAGE" = true ]; then
    echo -e "${GREEN}  ✅ Storage Object Admin${NC}"
else
    echo -e "${RED}  ❌ Storage Object Admin (없음 - 추가 필요)${NC}"
fi

if [ "$HAS_DATASTORE" = true ]; then
    echo -e "${GREEN}  ✅ Cloud Datastore User${NC}"
else
    echo -e "${RED}  ❌ Cloud Datastore User (없음 - 추가 필요)${NC}"
fi

if [ "$HAS_TRANSLATE" = true ]; then
    echo -e "${GREEN}  ✅ Cloud Translation API User${NC}"
else
    echo -e "${RED}  ❌ Cloud Translation API User (없음 - 추가 필요)${NC}"
fi

echo ""

# Check unwanted permissions
ISSUES_FOUND=false

if [ "$HAS_OWNER" = true ]; then
    echo -e "${RED}  ⚠️  Owner 권한 발견 (제거 필요)${NC}"
    ISSUES_FOUND=true
fi

if [ "$HAS_EDITOR" = true ]; then
    echo -e "${RED}  ⚠️  Editor 권한 발견 (제거 필요)${NC}"
    ISSUES_FOUND=true
fi

if [ ${#EXTRA_PERMS[@]} -gt 0 ]; then
    echo -e "${YELLOW}  ⚠️  추가 권한 발견:${NC}"
    for perm in "${EXTRA_PERMS[@]}"; do
        echo "     - $perm"
    done
    ISSUES_FOUND=true
fi

echo ""

# =====================================
# Step 4: App Engine 서비스 계정 확인
# =====================================

echo "========================================"
echo "📋 Step 4: App Engine 서비스 계정 확인"
echo "========================================"
echo ""
echo "다음 서비스 계정도 확인하세요:"
echo -e "${BLUE}${PROJECT_ID}@appspot.gserviceaccount.com${NC}"
echo ""
echo "이 계정에 Owner 또는 Editor 권한이 있나요? (y/n)"
read -p "> " has_appengine_perms

if [[ "$has_appengine_perms" =~ ^[Yy]$ ]]; then
    echo -e "${RED}  ⚠️  App Engine 서비스 계정에 과도한 권한 (정리 필요)${NC}"
    ISSUES_FOUND=true
else
    echo -e "${GREEN}  ✅ App Engine 서비스 계정 정리됨${NC}"
fi

echo ""

# =====================================
# Summary and Recommendations
# =====================================

echo "========================================"
echo "📊 검증 결과"
echo "========================================"
echo ""

if [ "$HAS_STORAGE" = true ] && [ "$HAS_DATASTORE" = true ] && [ "$HAS_TRANSLATE" = true ] && \
   [ "$HAS_OWNER" = false ] && [ "$HAS_EDITOR" = false ] && [ ${#EXTRA_PERMS[@]} -eq 0 ] && \
   [[ ! "$has_appengine_perms" =~ ^[Yy]$ ]]; then
    echo -e "${GREEN}✅ 모든 권한이 올바르게 설정되어 있습니다!${NC}"
    echo ""
    echo "다음 단계:"
    echo "1. Backend 재시작"
    echo "2. 파일 업로드 테스트"
    echo "3. 모든 기능 정상 작동 확인"
else
    echo -e "${RED}⚠️  권한 설정에 문제가 있습니다${NC}"
    echo ""
    echo "수정이 필요한 사항:"
    echo ""

    if [ "$HAS_STORAGE" = false ]; then
        echo -e "${RED}1. Storage Object Admin 권한 추가${NC}"
    fi

    if [ "$HAS_DATASTORE" = false ]; then
        echo -e "${RED}2. Cloud Datastore User 권한 추가${NC}"
    fi

    if [ "$HAS_TRANSLATE" = false ]; then
        echo -e "${RED}3. Cloud Translation API User 권한 추가${NC}"
    fi

    if [ "$HAS_OWNER" = true ] || [ "$HAS_EDITOR" = true ]; then
        echo -e "${RED}4. Owner/Editor 권한 제거${NC}"
    fi

    if [[ "$has_appengine_perms" =~ ^[Yy]$ ]]; then
        echo -e "${RED}5. App Engine 서비스 계정 권한 정리${NC}"
    fi
fi

echo ""
echo "========================================"
echo "🔧 권한 수정 방법"
echo "========================================"
echo ""
echo "IAM 페이지에서 권한을 수정하려면:"
echo ""
echo "1. 서비스 계정 옆의 ✏️ (편집) 아이콘 클릭"
echo ""
echo "2. 제거할 권한:"
echo "   - 권한 옆의 🗑️ (삭제) 아이콘 클릭"
echo ""
echo "3. 추가할 권한:"
echo "   - 'ADD ANOTHER ROLE' 버튼 클릭"
echo "   - 검색창에서 권한 이름 입력"
echo "   - 선택 후 'SAVE' 클릭"
echo ""

echo "자세한 가이드:"
echo "  - SERVICE_ACCOUNT_CLEANUP.md 참조"
echo ""

# =====================================
# Test Backend Connection
# =====================================

echo "========================================"
echo "🧪 Backend 연결 테스트"
echo "========================================"
echo ""

read -p "Backend가 실행 중인가요? (y/n): " backend_running

if [[ "$backend_running" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Backend API 테스트 중..."

    if curl -s http://localhost:8000/api/projects > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Backend API 응답 정상${NC}"

        # Check for specific errors in response
        RESPONSE=$(curl -s http://localhost:8000/api/projects 2>&1)
        if echo "$RESPONSE" | grep -q "503\|Permission denied\|Invalid JWT"; then
            echo -e "${RED}⚠️  API 응답에 오류 포함:${NC}"
            echo "$RESPONSE" | head -5
        else
            echo -e "${GREEN}✅ API 정상 응답${NC}"
        fi
    else
        echo -e "${RED}❌ Backend API 응답 없음${NC}"
        echo "   Backend를 시작하세요: cd backend && uvicorn main:app --reload --port 8000"
    fi
else
    echo ""
    echo "Backend를 시작한 후 다시 테스트하세요:"
    echo "  cd /home/user/bobpt/backend"
    echo "  uvicorn main:app --reload --port 8000"
fi

echo ""
echo "========================================"
echo "✅ 검증 완료"
echo "========================================"
echo ""
