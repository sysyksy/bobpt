#!/bin/bash

# Quick GCS Connection Check Script
# Checks if Google Cloud Storage is properly configured

echo "🔍 BobPT Google Cloud Storage 연결 진단"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# 1. Check if backend directory exists
echo "1️⃣  Backend 디렉토리 확인..."
if [ -d "backend" ]; then
    echo -e "${GREEN}✅ backend/ 디렉토리 존재${NC}"
else
    echo -e "${RED}❌ backend/ 디렉토리 없음${NC}"
    ((ERRORS++))
fi
echo ""

# 2. Check .env file
echo "2️⃣  .env 파일 확인..."
if [ -f "backend/.env" ]; then
    echo -e "${GREEN}✅ backend/.env 파일 존재${NC}"

    # Check for required variables
    if grep -q "GOOGLE_CLOUD_PROJECT" backend/.env; then
        PROJECT_ID=$(grep GOOGLE_CLOUD_PROJECT backend/.env | cut -d'=' -f2)
        echo -e "${GREEN}   ✓ GOOGLE_CLOUD_PROJECT=${PROJECT_ID}${NC}"
    else
        echo -e "${RED}   ✗ GOOGLE_CLOUD_PROJECT 없음${NC}"
        ((ERRORS++))
    fi

    if grep -q "GCS_BUCKET" backend/.env; then
        BUCKET=$(grep GCS_BUCKET backend/.env | cut -d'=' -f2)
        echo -e "${GREEN}   ✓ GCS_BUCKET=${BUCKET}${NC}"
    else
        echo -e "${RED}   ✗ GCS_BUCKET 없음${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${RED}❌ backend/.env 파일 없음${NC}"
    echo -e "${YELLOW}   💡 backend/.env.example을 복사하여 .env 파일을 생성하세요${NC}"
    ((ERRORS++))
fi
echo ""

# 3. Check for service account key
echo "3️⃣  Service Account Key 확인..."
KEY_FILES=$(find backend -name "*.json" -type f 2>/dev/null | grep -v node_modules | grep -v package)
if [ -n "$KEY_FILES" ]; then
    echo -e "${GREEN}✅ JSON 키 파일 발견:${NC}"
    echo "$KEY_FILES" | while read file; do
        echo "   - $file"
    done
else
    echo -e "${RED}❌ Service Account Key 파일(.json) 없음${NC}"
    echo -e "${YELLOW}   💡 Google Cloud Console에서 서비스 계정 키를 다운로드하세요${NC}"
    echo -e "${YELLOW}   📖 자세한 방법: GCS_CONNECTION_DIAGNOSIS.md 참조${NC}"
    ((ERRORS++))
fi
echo ""

# 4. Check GOOGLE_APPLICATION_CREDENTIALS environment variable
echo "4️⃣  GOOGLE_APPLICATION_CREDENTIALS 환경 변수 확인..."
if [ -n "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
    echo -e "${GREEN}✅ 환경 변수 설정됨: $GOOGLE_APPLICATION_CREDENTIALS${NC}"

    if [ -f "$GOOGLE_APPLICATION_CREDENTIALS" ]; then
        echo -e "${GREEN}   ✓ 파일 존재 확인됨${NC}"
    else
        echo -e "${RED}   ✗ 파일이 존재하지 않음${NC}"
        ((ERRORS++))
    fi
else
    echo -e "${RED}❌ GOOGLE_APPLICATION_CREDENTIALS 환경 변수 없음${NC}"
    echo -e "${YELLOW}   💡 다음 명령어로 설정하세요:${NC}"
    echo -e "${YELLOW}   export GOOGLE_APPLICATION_CREDENTIALS=\"/path/to/your/key.json\"${NC}"
    ((WARNINGS++))
fi
echo ""

# 5. Check if backend server is running
echo "5️⃣  Backend 서버 상태 확인..."
if pgrep -f "uvicorn" > /dev/null; then
    echo -e "${GREEN}✅ Backend 서버 실행 중${NC}"
    PORT=$(pgrep -f "uvicorn" | head -1)
    echo "   프로세스 ID: $PORT"
else
    echo -e "${RED}❌ Backend 서버가 실행되고 있지 않음${NC}"
    echo -e "${YELLOW}   💡 다음 명령어로 시작하세요:${NC}"
    echo -e "${YELLOW}   cd backend && uvicorn main:app --reload --port 8000${NC}"
    ((WARNINGS++))
fi
echo ""

# 6. Check Python dependencies
echo "6️⃣  Python 패키지 확인..."
if [ -f "backend/requirements.txt" ]; then
    echo -e "${GREEN}✅ requirements.txt 존재${NC}"

    # Check if google-cloud-storage is installed
    if python3 -c "import google.cloud.storage" 2>/dev/null; then
        echo -e "${GREEN}   ✓ google-cloud-storage 설치됨${NC}"
    else
        echo -e "${RED}   ✗ google-cloud-storage 미설치${NC}"
        echo -e "${YELLOW}   💡 pip install -r backend/requirements.txt${NC}"
        ((ERRORS++))
    fi

    if python3 -c "import google.cloud.firestore" 2>/dev/null; then
        echo -e "${GREEN}   ✓ google-cloud-firestore 설치됨${NC}"
    else
        echo -e "${RED}   ✗ google-cloud-firestore 미설치${NC}"
        ((WARNINGS++))
    fi
else
    echo -e "${YELLOW}⚠️  requirements.txt 파일 없음${NC}"
    ((WARNINGS++))
fi
echo ""

# 7. Check gcloud/gsutil (optional)
echo "7️⃣  Google Cloud SDK 확인 (선택사항)..."
if command -v gcloud &> /dev/null; then
    echo -e "${GREEN}✅ gcloud CLI 설치됨${NC}"
    GCLOUD_VERSION=$(gcloud version --format="value(core)" 2>/dev/null | head -1)
    echo "   버전: $GCLOUD_VERSION"
else
    echo -e "${YELLOW}⚠️  gcloud CLI 미설치 (CORS 설정에 필요)${NC}"
    echo -e "${YELLOW}   💡 https://cloud.google.com/sdk/docs/install${NC}"
fi

if command -v gsutil &> /dev/null; then
    echo -e "${GREEN}✅ gsutil 설치됨${NC}"
else
    echo -e "${YELLOW}⚠️  gsutil 미설치 (CORS 설정에 필요)${NC}"
fi
echo ""

# 8. Test backend API connectivity
echo "8️⃣  Backend API 연결 테스트..."
if curl -s http://localhost:8000/api/projects > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend API 응답 정상${NC}"
else
    echo -e "${RED}❌ Backend API 응답 없음${NC}"
    echo -e "${YELLOW}   💡 Backend 서버를 시작하세요${NC}"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "========================================"
echo "📊 진단 결과 요약"
echo "========================================"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ 모든 검사 통과! GCS 연결 준비 완료${NC}"
    echo ""
    echo "다음 단계:"
    echo "1. Frontend 실행: npm run dev"
    echo "2. 브라우저에서 http://localhost:5173 접속"
    echo "3. 파일 업로드 테스트"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  경고 ${WARNINGS}개 발견 (선택사항)${NC}"
    echo ""
    echo "기본 기능은 작동할 수 있지만, 일부 기능이 제한될 수 있습니다."
    echo "자세한 내용은 위의 경고 메시지를 확인하세요."
else
    echo -e "${RED}❌ 오류 ${ERRORS}개, 경고 ${WARNINGS}개 발견${NC}"
    echo ""
    echo "GCS 연결에 문제가 있습니다. 위의 오류를 해결해주세요."
    echo ""
    echo "📖 자세한 해결 방법:"
    echo "   - GCS_CONNECTION_DIAGNOSIS.md"
    echo "   - TROUBLESHOOTING-403.md"
fi
echo ""
