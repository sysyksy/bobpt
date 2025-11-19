from google.cloud import storage

def set_bucket_cors(bucket_name):
    """버킷에 CORS 설정 적용 (더 강력한 버전)"""
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        
        # 기존 CORS 설정 확인
        bucket.reload()
        print(f"🔍 현재 CORS 설정: {bucket.cors}\n")
        
        # CORS 설정 (더 포괄적)
        bucket.cors = [
            {
                "origin": ["*"],  # 모든 origin 허용
                "method": ["GET", "HEAD", "OPTIONS"],  # OPTIONS 추가
                "responseHeader": [
                    "Content-Type",
                    "Content-Length", 
                    "Content-Range",
                    "Range",
                    "Accept-Ranges",  # 비디오 스트리밍용
                    "Content-Disposition"
                ],
                "maxAgeSeconds": 3600
            }
        ]
        
        # 변경 사항 적용
        bucket.patch()
        
        # 적용 확인
        bucket.reload()
        
        print(f"✅ CORS 설정 완료!\n")
        print(f"📋 새 CORS 설정:")
        for i, rule in enumerate(bucket.cors, 1):
            print(f"\n규칙 {i}:")
            print(f"  Origin: {rule.get('origin')}")
            print(f"  Methods: {rule.get('method')}")
            print(f"  Response Headers: {rule.get('responseHeader')}")
            print(f"  Max Age: {rule.get('maxAgeSeconds')}초")
        
        print("\n⚠️  중요: 브라우저 캐시를 지워야 합니다!")
        print("   Chrome: Ctrl + Shift + Delete")
        print("   또는 시크릿 모드(Ctrl + Shift + N)로 테스트하세요.\n")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    set_bucket_cors("bob-sto")

    