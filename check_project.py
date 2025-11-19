from google.cloud import firestore

db = firestore.Client()

# 업로드 후 나온 프로젝트 ID로 변경하세요!
project_id = input("프로젝트 ID를 입력하세요: ")

print(f"\n🔍 프로젝트 '{project_id}' 조회 중...")

doc = db.collection('projects').document(project_id).get()

if doc.exists:
    data = doc.to_dict()
    print(f"\n✅ 프로젝트 발견!")
    print(f"📋 상태: {data.get('status')}")
    print(f"📝 파일명: {data.get('fileName', 'N/A')}")
    print(f"📄 자막 줄 수: {len(data.get('transcript', []))}")
    
    if data.get('full_text'):
        print(f"\n📖 전체 텍스트 일부:")
        print(data.get('full_text')[:200] + "...")
    else:
        print("\n⚠️  full_text가 없습니다.")
    
    if data.get('transcript'):
        print(f"\n🎯 첫 5줄 자막:")
        for i, word in enumerate(data.get('transcript')[:5]):
            print(f"  {i+1}. [{word.get('start_time'):.1f}s] {word.get('word')}")
else:
    print("\n❌ 프로젝트를 찾을 수 없습니다.")
    print("💡 업로드 후 백엔드 터미널에서 프로젝트 ID를 확인하세요.")

print("\n✅ 조회 완료")

