from google.cloud import storage

def list_bucket_contents(bucket_name):
    """버킷의 모든 파일 목록 출력"""
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        
        print(f"📦 버킷 '{bucket_name}'의 파일 목록:\n")
        
        blobs = list(bucket.list_blobs())
        
        if not blobs:
            print("❌ 버킷이 비어있습니다!")
            return
        
        for blob in blobs:
            size_mb = blob.size / (1024 * 1024)  # 바이트를 MB로 변환
            print(f"📄 {blob.name}")
            print(f"   크기: {size_mb:.2f} MB")
            print(f"   타입: {blob.content_type}")
            print(f"   생성일: {blob.time_created}")
            print()
            
        print(f"✅ 총 {len(blobs)}개 파일 발견")
        
        # abc.mp4 파일이 있는지 확인
        abc_exists = any(blob.name == 'abc.mp4' for blob in blobs)
        if abc_exists:
            print("\n✅ abc.mp4 파일이 존재합니다!")
        else:
            print("\n❌ abc.mp4 파일이 없습니다!")
            print("💡 다음 파일들이 있습니다:")
            for blob in blobs:
                if blob.name.endswith(('.mp4', '.mov', '.avi')):
                    print(f"   - {blob.name}")
        
    except Exception as e:
        print(f"❌ 오류 발생: {e}")
        print("\n💡 해결 방법:")
        print("1. Google Cloud 인증 확인: gcloud auth application-default login")
        print("2. 프로젝트 ID 확인")
        print("3. 버킷 이름 확인: bob-sto")

if __name__ == "__main__":
    bucket_name = "bob-sto"
    list_bucket_contents(bucket_name)

    