from google.cloud import storage

def diagnose_bucket(bucket_name, video_file):
    """버킷 상태 전체 진단 (수정 버전)"""
    print("🔍 GCS 버킷 진단 시작...\n")
    
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        bucket.reload()
        
        # 1. 버킷 존재 확인
        print(f"✅ 1. 버킷 '{bucket_name}' 존재 확인\n")
        
        # 2. CORS 설정 확인
        print(f"📋 2. CORS 설정:")
        if bucket.cors:
            print("   ✅ CORS 설정됨")
            for rule in bucket.cors:
                print(f"      - Origin: {rule.get('origin')}")
                print(f"      - Methods: {rule.get('method')}")
        else:
            print("   ❌ CORS 설정 없음 → set_cors_fixed.py 실행 필요\n")
        
        # 3. 특정 비디오 파일 확인 (수정됨)
        print(f"\n🎥 3. '{video_file}' 파일 확인:")
        blob = bucket.blob(video_file)
        
        # blob.exists()로 먼저 확인
        if blob.exists():
            # 파일이 존재하면 메타데이터 새로고침
            blob.reload()
            
            size = blob.size if blob.size else 0
            size_mb = size / (1024 * 1024)
            
            print(f"   ✅ 파일 존재!")
            print(f"   📊 크기: {size_mb:.2f} MB ({size:,} bytes)")
            print(f"   📄 타입: {blob.content_type}")
            print(f"   📅 생성: {blob.time_created}")
            print(f"   🔗 경로: gs://{bucket_name}/{video_file}")
        else:
            print(f"   ❌ 파일이 존재하지 않습니다!")
            print(f"   💡 업로드 필요: python upload_video.py")
        
        # 4. 버킷의 모든 파일 목록
        print(f"\n📦 4. 버킷의 모든 파일 목록:")
        blobs = list(bucket.list_blobs(max_results=20))
        
        if not blobs:
            print("   ⚠️  버킷이 비어있습니다!")
            print("   💡 파일을 업로드해야 합니다.")
        else:
            print(f"   총 {len(blobs)}개 파일 발견:\n")
            
            for blob in blobs:
                size = blob.size if blob.size else 0
                size_mb = size / (1024 * 1024)
                file_type = "📹" if blob.name.endswith(('.mp4', '.mov', '.avi')) else "📄"
                print(f"   {file_type} {blob.name} ({size_mb:.2f} MB)")
        
        print("\n" + "="*60)
        print("🎯 진단 완료!")
        print("="*60)
        
    except Exception as e:
        print(f"\n❌ 오류 발생: {e}")
        print("\n💡 해결 방법:")
        print("1. 인증 확인: gcloud auth application-default login")
        print("2. 프로젝트 ID 확인")
        print(f"3. 버킷 이름 확인: {bucket_name}")
        
        import traceback
        print("\n📋 상세 에러:")
        traceback.print_exc()

if __name__ == "__main__":
    bucket_name = "bob-sto"
    video_file = "abc.mp4"
    
    diagnose_bucket(bucket_name, video_file)

    