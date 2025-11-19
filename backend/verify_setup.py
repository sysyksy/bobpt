#!/usr/bin/env python
"""
Setup Verification Script
모든 필수 설정과 서비스 연결을 확인합니다.
"""

import os
import sys
import subprocess
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def print_header(title):
    """Print section header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def check_python_version():
    """Python 버전 확인"""
    version = sys.version_info
    if version.major >= 3 and version.minor >= 9:
        print(f"✅ Python {version.major}.{version.minor}.{version.micro}")
        return True
    else:
        print(f"❌ Python {version.major}.{version.minor}.{version.micro} (3.9+ 필요)")
        return False

def check_ffmpeg():
    """FFmpeg 설치 확인"""
    try:
        result = subprocess.run(
            ["ffmpeg", "-version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            version = result.stdout.split('\n')[0]
            print(f"✅ {version}")
            return True
        else:
            print("❌ FFmpeg 실행 실패")
            return False
    except FileNotFoundError:
        print("❌ FFmpeg가 설치되지 않았거나 PATH에 없습니다")
        return False
    except Exception as e:
        print(f"❌ FFmpeg 확인 실패: {e}")
        return False

def check_env_file():
    """환경 변수 파일 확인"""
    env_file = Path(".env")
    if env_file.exists():
        print(f"✅ .env 파일 존재")
        return True
    else:
        print(f"❌ .env 파일 없음 (.env.example을 복사하세요)")
        return False

def check_env_variables():
    """필수 환경 변수 확인"""
    required_vars = {
        'OPENAI_API_KEY': 'OpenAI API 키',
        'GCS_BUCKET': 'GCS 버킷 이름',
        'JWT_SECRET': 'JWT 시크릿 키',
    }

    optional_vars = {
        'GOOGLE_APPLICATION_CREDENTIALS': 'Google Cloud 인증 파일',
        'NAVER_CLIENT_ID': 'Naver API 클라이언트 ID (선택)',
        'NAVER_CLIENT_SECRET': 'Naver API 시크릿 (선택)',
    }

    all_ok = True

    print("\n필수 환경 변수:")
    for var, description in required_vars.items():
        value = os.getenv(var)
        if value:
            # 민감한 정보는 일부만 표시
            if 'KEY' in var or 'SECRET' in var:
                display_value = value[:8] + "..." if len(value) > 8 else "***"
            else:
                display_value = value
            print(f"  ✅ {var}: {display_value}")
        else:
            print(f"  ❌ {var}: 설정되지 않음")
            all_ok = False

    print("\n선택적 환경 변수:")
    for var, description in optional_vars.items():
        value = os.getenv(var)
        if value:
            if 'KEY' in var or 'SECRET' in var or 'CREDENTIALS' in var:
                display_value = value[:20] + "..." if len(value) > 20 else value
            else:
                display_value = value
            print(f"  ✅ {var}: {display_value}")
        else:
            print(f"  ⚠️  {var}: 설정되지 않음 (선택사항)")

    return all_ok

def check_google_credentials():
    """Google Cloud 인증 파일 확인"""
    cred_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

    if not cred_path:
        print("❌ GOOGLE_APPLICATION_CREDENTIALS 환경 변수 없음")
        return False

    if not os.path.exists(cred_path):
        print(f"❌ 인증 파일을 찾을 수 없음: {cred_path}")
        return False

    print(f"✅ 인증 파일 존재: {cred_path}")
    return True

def check_google_cloud_services():
    """Google Cloud 서비스 연결 확인"""
    all_ok = True

    # Storage
    try:
        from google.cloud import storage
        client = storage.Client()
        bucket_name = os.getenv('GCS_BUCKET', 'bob-sto')
        bucket = client.bucket(bucket_name)
        exists = bucket.exists()

        if exists:
            print(f"✅ Cloud Storage: 버킷 '{bucket_name}' 연결 성공")
        else:
            print(f"❌ Cloud Storage: 버킷 '{bucket_name}' 없음")
            all_ok = False
    except Exception as e:
        print(f"❌ Cloud Storage 연결 실패: {e}")
        all_ok = False

    # Firestore
    try:
        from google.cloud import firestore
        db = firestore.Client()
        # Test connection by listing collections
        collections = list(db.collections(max_results=1))
        print(f"✅ Firestore: 연결 성공")
    except Exception as e:
        print(f"❌ Firestore 연결 실패: {e}")
        all_ok = False

    # Translation
    try:
        from google.cloud.translate_v3 import TranslationServiceClient
        client = TranslationServiceClient()
        print(f"✅ Translation API: 클라이언트 생성 성공")
    except Exception as e:
        print(f"❌ Translation API 초기화 실패: {e}")
        all_ok = False

    # Vision (OCR)
    try:
        from google.cloud import vision
        client = vision.ImageAnnotatorClient()
        print(f"✅ Vision API (OCR): 클라이언트 생성 성공")
    except Exception as e:
        print(f"❌ Vision API 초기화 실패: {e}")
        all_ok = False

    return all_ok

def check_python_packages():
    """필수 Python 패키지 확인"""
    required_packages = [
        'fastapi',
        'uvicorn',
        'pydantic',
        'sqlalchemy',
        'google.cloud.storage',
        'google.cloud.firestore',
        'google.cloud.translate_v3',
        'google.cloud.vision',
        'openai',
        'whisper',
        'jose',
        'passlib',
    ]

    all_ok = True

    for package in required_packages:
        try:
            __import__(package)
            print(f"  ✅ {package}")
        except ImportError:
            print(f"  ❌ {package} (설치 필요)")
            all_ok = False

    return all_ok

def check_database():
    """데이터베이스 확인"""
    db_file = Path("bobpt.db")

    if not db_file.exists():
        print("❌ 데이터베이스 파일 없음 (init_db.py 실행 필요)")
        return False

    print(f"✅ 데이터베이스 파일 존재: {db_file} ({db_file.stat().st_size} bytes)")

    # Test connection
    try:
        from database import SessionLocal, Project
        db = SessionLocal()
        count = db.query(Project).count()
        print(f"✅ 데이터베이스 연결 성공 (프로젝트: {count}개)")
        db.close()
        return True
    except Exception as e:
        print(f"❌ 데이터베이스 연결 실패: {e}")
        return False

def main():
    """메인 검증 프로세스"""
    print("\n" + "="*60)
    print("  BobPT Setup Verification")
    print("="*60)

    results = {}

    # 1. Python version
    print_header("1. Python 버전")
    results['python'] = check_python_version()

    # 2. FFmpeg
    print_header("2. FFmpeg")
    results['ffmpeg'] = check_ffmpeg()

    # 3. Environment file
    print_header("3. 환경 변수 파일")
    results['env_file'] = check_env_file()

    # 4. Environment variables
    print_header("4. 환경 변수")
    results['env_vars'] = check_env_variables()

    # 5. Google credentials
    print_header("5. Google Cloud 인증")
    results['google_creds'] = check_google_credentials()

    # 6. Python packages
    print_header("6. Python 패키지")
    results['packages'] = check_python_packages()

    # 7. Google Cloud services (only if credentials exist)
    if results['google_creds']:
        print_header("7. Google Cloud 서비스")
        results['google_services'] = check_google_cloud_services()
    else:
        print_header("7. Google Cloud 서비스")
        print("⚠️  Google Cloud 인증이 설정되지 않아 건너뜁니다")
        results['google_services'] = False

    # 8. Database
    print_header("8. 데이터베이스")
    results['database'] = check_database()

    # Summary
    print_header("검증 요약")

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    print(f"\n통과: {passed}/{total}")

    if all(results.values()):
        print("\n🎉 모든 검증 통과! 서버를 시작할 수 있습니다.")
        print("\n다음 명령으로 서버를 실행하세요:")
        print("  uvicorn main:app --reload --port 8000")
    else:
        print("\n⚠️  일부 검증 실패. 위의 항목들을 확인하세요.")
        print("\n실패한 항목:")
        for name, passed in results.items():
            if not passed:
                print(f"  ❌ {name}")

        print("\n도움말:")
        print("  - Python 패키지: pip install -r requirements.txt")
        print("  - 환경 변수: .env.example을 복사하여 .env 생성")
        print("  - 데이터베이스: python init_db.py 실행")
        print("  - Google Cloud: SETUP_GUIDE.md 참조")

    print("\n" + "="*60)

if __name__ == "__main__":
    main()
