from google.cloud import storage

def check_bucket_cors(bucket_name):
    """현재 CORS 설정 확인"""
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    
    print(f"📋 {bucket_name} 버킷의 CORS 설정:\n")
    
    if bucket.cors:
        for i, cors_rule in enumerate(bucket.cors, 1):
            print(f"규칙 {i}:")
            print(f"  Origin: {cors_rule.get('origin')}")
            print(f"  Method: {cors_rule.get('method')}")
            print(f"  Response Headers: {cors_rule.get('responseHeader')}")
            print(f"  Max Age: {cors_rule.get('maxAgeSeconds')}초\n")
    else:
        print("❌ CORS 설정이 없습니다.")

if __name__ == "__main__":
    check_bucket_cors("bob-sto")

    