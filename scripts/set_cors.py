from google.cloud import storage

def set_bucket_cors(bucket_name):
    """버킷에 CORS 설정 적용"""
    try:
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        
        # CORS 설정
        bucket.cors = [
            {
                "origin": ["*"],
                "method": ["GET", "HEAD"],
                "responseHeader": [
                    "Content-Type", 
                    "Content-Length", 
                    "Content-Range", 
                    "Range"
                ],
                "maxAgeSeconds": 3600
            }
        ]
        
        bucket.patch()
        
        print(f"✅ CORS 설정 완료: {bucket_name}")
        print(f"\n현재 CORS 설정:")
        for cors_rule in bucket.cors:
            print(f"  - Origin: {cors_rule.get('origin')}")
            print(f"  - Methods: {cors_rule.get('method')}")
            print(f"  - Headers: {cors_rule.get('responseHeader')}")
            print(f"  - Max Age: {cors_rule.get('maxAgeSeconds')}초\n")
            
    except Exception as e:
        print(f"❌ 오류 발생: {e}")

if __name__ == "__main__":
    bucket_name = "bob-sto"  # 본인의 버킷 이름
    set_bucket_cors(bucket_name)

    