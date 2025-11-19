#!/bin/bash

# Service Account Key 생성 및 설정 가이드
# "Invalid JWT Signature" 오류 해결

echo "🔑 Service Account Key 설정 가이드"
echo "========================================"
echo ""
echo "현재 오류: Invalid JWT Signature"
echo "원인: 올바른 서비스 계정 키가 없거나 만료됨"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}이 가이드는 Service Account Key를 생성하고 설정하는 방법을 안내합니다.${NC}"
echo ""

echo "========================================"
echo "📋 Step 1: Google Cloud Console 접속"
echo "========================================"
echo ""
echo "1. 브라우저에서 다음 주소로 이동:"
echo -e "${BLUE}   https://console.cloud.google.com/iam-admin/serviceaccounts?project=plasma-canyon-477402-i8${NC}"
echo ""
echo "2. 프로젝트가 'plasma-canyon-477402-i8'인지 확인"
echo ""

read -p "Google Cloud Console에 접속했으면 Enter를 누르세요..."
echo ""

echo "========================================"
echo "📋 Step 2: Service Account 확인/생성"
echo "========================================"
echo ""
echo "옵션 A: 기존 Service Account 사용"
echo "   - 'bobpt-backend' 또는 유사한 이름의 서비스 계정 찾기"
echo ""
echo "옵션 B: 새 Service Account 생성"
echo "   1. 'CREATE SERVICE ACCOUNT' 버튼 클릭"
echo "   2. 이름: bobpt-backend"
echo "   3. ID: bobpt-backend"
echo "   4. 설명: BobPT Backend Service Account"
echo "   5. 'CREATE AND CONTINUE' 클릭"
echo ""
echo "   6. 권한 부여 (다음 역할 추가):"
echo "      - Storage Admin (roles/storage.admin)"
echo "      - Cloud Datastore User (roles/datastore.user)"
echo "      - Cloud Translation API User (roles/cloudtranslate.user)"
echo "   7. 'CONTINUE' 클릭"
echo "   8. 'DONE' 클릭"
echo ""

read -p "Service Account를 선택/생성했으면 Enter를 누르세요..."
echo ""

echo "========================================"
echo "📋 Step 3: JSON Key 생성 및 다운로드"
echo "========================================"
echo ""
echo "1. Service Account 목록에서 'bobpt-backend' 클릭"
echo "2. 'KEYS' 탭 클릭"
echo "3. 'ADD KEY' > 'Create new key' 선택"
echo "4. 'Key type': JSON 선택"
echo "5. 'CREATE' 클릭"
echo ""
echo -e "${GREEN}   ✓ JSON 파일이 자동으로 다운로드됩니다${NC}"
echo "   (파일명 예: plasma-canyon-477402-i8-abc123.json)"
echo ""

read -p "JSON 키 파일을 다운로드했으면 Enter를 누르세요..."
echo ""

echo "========================================"
echo "📋 Step 4: 키 파일 이동 및 설정"
echo "========================================"
echo ""
echo "다운로드한 JSON 파일을 backend 폴더로 이동해야 합니다."
echo ""
echo -e "${YELLOW}다운로드 폴더에서 파일명을 확인하세요:${NC}"
echo ""

# Find recently downloaded JSON files
if [ -d ~/Downloads ]; then
    echo "최근 다운로드된 JSON 파일:"
    find ~/Downloads -name "*.json" -type f -mmin -10 2>/dev/null | while read file; do
        echo "  - $(basename "$file")"
    done
    echo ""
fi

read -p "다운로드한 JSON 파일명을 입력하세요 (확장자 포함): " JSON_FILENAME
echo ""

# Set paths
DOWNLOADS_PATH="$HOME/Downloads/$JSON_FILENAME"
TARGET_PATH="/home/user/bobpt/backend/service-account-key.json"

if [ -f "$DOWNLOADS_PATH" ]; then
    echo -e "${GREEN}✅ 파일 발견: $DOWNLOADS_PATH${NC}"
    echo ""

    # Copy file
    cp "$DOWNLOADS_PATH" "$TARGET_PATH"

    if [ -f "$TARGET_PATH" ]; then
        echo -e "${GREEN}✅ 파일 복사 완료: $TARGET_PATH${NC}"

        # Verify it's valid JSON
        if jq empty "$TARGET_PATH" 2>/dev/null; then
            echo -e "${GREEN}✅ JSON 형식 유효성 검사 통과${NC}"

            # Show key info
            echo ""
            echo "서비스 계정 정보:"
            echo "  - Type: $(jq -r '.type' "$TARGET_PATH")"
            echo "  - Project ID: $(jq -r '.project_id' "$TARGET_PATH")"
            echo "  - Email: $(jq -r '.client_email' "$TARGET_PATH")"
        else
            echo -e "${RED}❌ JSON 형식이 올바르지 않습니다${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ 파일 복사 실패${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ 파일을 찾을 수 없습니다: $DOWNLOADS_PATH${NC}"
    echo ""
    echo "수동으로 파일을 복사하세요:"
    echo "  cp ~/Downloads/YOUR-FILE.json /home/user/bobpt/backend/service-account-key.json"
    exit 1
fi

echo ""
echo "========================================"
echo "📋 Step 5: 환경 변수 설정"
echo "========================================"
echo ""

# Set environment variable for current session
export GOOGLE_APPLICATION_CREDENTIALS="$TARGET_PATH"
echo -e "${GREEN}✅ 현재 세션에 환경 변수 설정됨${NC}"

# Add to .bashrc for persistence
if ! grep -q "GOOGLE_APPLICATION_CREDENTIALS.*bobpt.*service-account-key.json" ~/.bashrc; then
    echo "" >> ~/.bashrc
    echo "# BobPT Google Cloud Credentials" >> ~/.bashrc
    echo "export GOOGLE_APPLICATION_CREDENTIALS=\"$TARGET_PATH\"" >> ~/.bashrc
    echo -e "${GREEN}✅ ~/.bashrc에 영구 설정 추가됨${NC}"
else
    echo -e "${YELLOW}⚠️  ~/.bashrc에 이미 설정되어 있습니다${NC}"
fi

echo ""
echo "현재 환경 변수 값:"
echo "  $GOOGLE_APPLICATION_CREDENTIALS"
echo ""

echo "========================================"
echo "📋 Step 6: Backend 재시작 안내"
echo "========================================"
echo ""
echo -e "${YELLOW}중요: Backend 서버를 재시작해야 합니다!${NC}"
echo ""
echo "1. 현재 실행 중인 backend 서버 중지 (Ctrl+C)"
echo "2. 새 터미널에서 다음 명령어 실행:"
echo ""
echo -e "${BLUE}   cd /home/user/bobpt/backend${NC}"
echo -e "${BLUE}   uvicorn main:app --reload --port 8000${NC}"
echo ""
echo "3. 다음 메시지 확인:"
echo -e "${GREEN}   [OK] Google Cloud clients initialized successfully${NC}"
echo ""

echo "========================================"
echo "✅ 설정 완료!"
echo "========================================"
echo ""
echo "다음 단계:"
echo "1. Backend 서버 재시작"
echo "2. Frontend 실행 (npm run dev)"
echo "3. 파일 업로드 테스트"
echo ""
echo "문제가 계속되면 다음 명령어로 확인:"
echo "  ./quick-check.sh"
echo ""
