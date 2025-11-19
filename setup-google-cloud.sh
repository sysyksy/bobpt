#!/bin/bash

# Google Cloud 환경 설정 스크립트 (Bash)
# Mac/Linux 환경에서 Google Cloud 자격증명 설정을 자동화합니다

set -e

echo "========================================"
echo "  Google Cloud 환경 설정 도구"
echo "========================================"
echo ""

# 1. JSON 키 파일 찾기
echo "[1/4] JSON 서비스 계정 키 파일 확인..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEY_FILES=()

# 루트 폴더에서 찾기
if ls "$SCRIPT_DIR"/*-key.json 1> /dev/null 2>&1; then
    KEY_FILES+=($(ls "$SCRIPT_DIR"/*-key.json))
fi

# backend 폴더에서 찾기
if [ -d "$SCRIPT_DIR/backend" ] && ls "$SCRIPT_DIR/backend"/*-key.json 1> /dev/null 2>&1; then
    KEY_FILES+=($(ls "$SCRIPT_DIR/backend"/*-key.json))
fi

if [ ${#KEY_FILES[@]} -eq 0 ]; then
    echo "❌ JSON 키 파일을 찾을 수 없습니다"
    echo ""
    echo "다음 단계를 따르세요:"
    echo "1. Google Cloud Console (https://console.cloud.google.com) 접속"
    echo "2. 프로젝트 생성: 'project-brew'"
    echo "3. '서비스 계정' → '키' → 'JSON 키 만들기'"
    echo "4. 다운로드한 파일을 프로젝트 루트 또는 backend 폴더에 저장"
    echo "5. 이 스크립트를 다시 실행"
    echo ""
    exit 1
fi

echo "✓ ${#KEY_FILES[@]}개의 키 파일 발견:"
for i in "${!KEY_FILES[@]}"; do
    echo "  [$i] $(basename "${KEY_FILES[$i]}")"
done
echo ""

# 사용할 키 파일 선택
SELECTED_KEY_FILE="${KEY_FILES[0]}"
if [ ${#KEY_FILES[@]} -gt 1 ]; then
    echo "사용할 파일을 선택하세요 (기본값: 0):"
    read -p "번호 입력: " SELECTION

    if [[ "$SELECTION" =~ ^[0-9]+$ ]] && [ "$SELECTION" -lt ${#KEY_FILES[@]} ]; then
        SELECTED_KEY_FILE="${KEY_FILES[$SELECTION]}"
    else
        echo "⚠️  잘못된 선택입니다. 기본값 사용"
    fi
fi

echo "선택된 파일: $(basename "$SELECTED_KEY_FILE")"
echo ""

# 2. JSON 파일에서 프로젝트 ID 추출
echo "[2/4] Google Cloud 프로젝트 ID 추출..."

# jq가 설치되어 있는지 확인
if ! command -v jq &> /dev/null; then
    echo "⚠️  jq가 설치되지 않았습니다"
    echo "다음 명령어로 설치하세요:"
    echo "  macOS: brew install jq"
    echo "  Ubuntu: sudo apt-get install jq"
    echo ""
    echo "또는 Python을 사용하여 프로젝트 ID를 추출합니다"
    PROJECT_ID=$(python3 -c "import json; print(json.load(open('$SELECTED_KEY_FILE'))['project_id'])")
else
    PROJECT_ID=$(jq -r '.project_id' "$SELECTED_KEY_FILE")
fi

if [ -z "$PROJECT_ID" ]; then
    echo "❌ 프로젝트 ID를 추출할 수 없습니다"
    exit 1
fi

echo "✓ 프로젝트 ID: $PROJECT_ID"
echo ""

# 3. 환경 변수 설정 (세션)
echo "[3/4] 환경 변수 설정..."

export GOOGLE_APPLICATION_CREDENTIALS="$SELECTED_KEY_FILE"
export GOOGLE_CLOUD_PROJECT="$PROJECT_ID"

echo "✓ 세션 환경 변수 설정 완료"
echo "  - GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS"
echo "  - GOOGLE_CLOUD_PROJECT=$GOOGLE_CLOUD_PROJECT"
echo ""

# 4. 영구 설정 옵션
echo "[4/4] 영구 설정 (선택사항)..."
echo ""

read -p "쉘 프로필에 영구 설정하시겠습니까? (y/n, 기본값: n): " SET_PERMANENT

if [ "$SET_PERMANENT" = "y" ] || [ "$SET_PERMANENT" = "Y" ]; then
    # 사용 중인 쉘 감지
    if [ -n "$ZSH_VERSION" ]; then
        PROFILE_FILE="$HOME/.zshrc"
    elif [ -n "$BASH_VERSION" ]; then
        PROFILE_FILE="$HOME/.bashrc"
    else
        PROFILE_FILE="$HOME/.profile"
    fi

    echo "쉘 프로필 파일: $PROFILE_FILE"

    # 환경 변수 설정
    {
        echo ""
        echo "# Google Cloud 환경 설정"
        echo "export GOOGLE_APPLICATION_CREDENTIALS=\"$SELECTED_KEY_FILE\""
        echo "export GOOGLE_CLOUD_PROJECT=\"$PROJECT_ID\""
    } >> "$PROFILE_FILE"

    echo "✓ 영구 설정 완료"
    echo "  다음 명령어로 변경사항을 즉시 적용하세요:"
    echo "  source $PROFILE_FILE"
fi

echo ""

# 5. .gitignore 확인
echo "[검사] .gitignore 설정..."

GITIGNORE_PATH="$SCRIPT_DIR/.gitignore"

if [ -f "$GITIGNORE_PATH" ]; then
    if grep -q "\*-key\.json" "$GITIGNORE_PATH"; then
        echo "✓ .gitignore이 올바르게 설정되어 있습니다"
    else
        echo "⚠️  .gitignore에 '*-key.json' 규칙이 없습니다"
        echo "다음을 .gitignore에 추가하세요:"
        echo ""
        echo "# Google Cloud"
        echo "*-key.json"
        echo "service-account-key.json"
    fi
else
    echo "⚠️  .gitignore 파일을 찾을 수 없습니다"
fi

echo ""

# 6. 완료
echo "========================================"
echo "  설정 완료!"
echo "========================================"
echo ""
echo "다음 단계:"
echo "1. 터미널 재시작 (영구 설정을 한 경우)"
echo "2. 다음 명령어로 설정 확인:"
echo ""
echo "   echo \$GOOGLE_CLOUD_PROJECT"
echo ""
echo "3. 백엔드 서버 시작:"
echo ""
echo "   cd backend"
echo "   source venv/bin/activate"
echo "   python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo ""

# 자동 검증
echo "[검증] Google Cloud 설정 테스트..."

if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python 설치 필요"
else
    if python3 -c "import google.cloud" 2>/dev/null; then
        echo "✓ Google Cloud SDK 설치됨"
    else
        echo "⚠️  google-cloud 패키지 설치 필요"
        echo "다음 명령어 실행: pip install google-cloud-translate"
    fi
fi

echo ""
