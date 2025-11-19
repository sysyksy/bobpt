#!/usr/bin/env python
"""
Database Initialization Script
데이터베이스 테이블을 생성하고 초기화합니다.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from database import init_db, SessionLocal, Project, engine
from sqlalchemy import inspect

def check_existing_tables():
    """기존 테이블 확인"""
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    return tables

def main():
    """데이터베이스 초기화"""
    print("=" * 60)
    print("BobPT Database Initialization")
    print("=" * 60)

    # Check existing tables
    existing_tables = check_existing_tables()

    if existing_tables:
        print(f"\n⚠️  기존 테이블 발견: {', '.join(existing_tables)}")
        response = input("기존 데이터를 유지하고 누락된 테이블만 생성하시겠습니까? (y/n): ")

        if response.lower() != 'y':
            print("❌ 초기화 취소됨")
            return

    # Initialize database
    print("\n🔧 데이터베이스 테이블 생성 중...")
    try:
        init_db()
        print("✅ 데이터베이스 테이블 생성 완료")
    except Exception as e:
        print(f"❌ 데이터베이스 초기화 실패: {e}")
        return

    # Verify tables
    tables = check_existing_tables()
    print(f"\n📊 생성된 테이블: {', '.join(tables)}")

    # Check database file
    db_file = "bobpt.db"
    if os.path.exists(db_file):
        size = os.path.getsize(db_file)
        print(f"📁 데이터베이스 파일: {db_file} ({size} bytes)")

    # Test database connection
    print("\n🧪 데이터베이스 연결 테스트 중...")
    try:
        db = SessionLocal()
        count = db.query(Project).count()
        print(f"✅ 연결 성공! 현재 프로젝트 수: {count}")
        db.close()
    except Exception as e:
        print(f"❌ 연결 실패: {e}")
        return

    print("\n" + "=" * 60)
    print("✅ 데이터베이스 초기화 완료!")
    print("=" * 60)
    print("\n다음 명령으로 서버를 실행하세요:")
    print("  uvicorn main:app --reload --port 8000")
    print()

if __name__ == "__main__":
    main()
