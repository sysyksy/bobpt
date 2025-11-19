from google.cloud import storage

def diagnose_bucket(bucket_name, video_file):
    print("🔍 GCS 버킷 진단 시작...\n")
    
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        bucket.reload()
        
        print(f"✅ 1. 버킷 '{bucket_name}' 존재 확인")
        
        print(f"\n📋 2. CORS 설정:")
        if bucket.cors:
            print("   ✅ CORS 설정됨")
        else:
            print("   ❌ CORS 설정 없음")
        
        print(f"\n🎥 3. '{video_file}' 파일 확인:")
        blob = bucket.blob(video_file)
        if blob.exists():
            print(f"   ✅ 파일 존재 ({blob.size / (1024*1024):.2f} MB)")
        else:
            print(f"   ❌ 파일 없음")
        
    except Exception as e:
        print(f"❌ 오류: {e}")

if __name__ == "__main__":
    diagnose_bucket("bob-sto", "abc.mp4")

    