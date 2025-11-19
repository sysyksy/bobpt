# ⚡ BobPT 빠른 시작 가이드

최소한의 단계로 BobPT를 로컬에서 실행하는 방법입니다.

---

## 📋 필수 사항

1. **Node.js 18+** - [다운로드](https://nodejs.org/)
2. **Python 3.9+** - (Cloud Function용, 배포 시에만)
3. **OpenAI API 키** - 이미 적용됨 ✅
4. **Google Cloud 프로젝트** - (배포 시에만)

---

## 🚀 로컬 개발 시작 (5분)

### 1단계: 백엔드 시작

```bash
cd backend
npm install
npm start

# 출력 확인:
# 🚀 백엔드 서버 실행 중 http://localhost:5001
```

**터미널을 열린 상태로 두세요!**

### 2단계: 프론트엔드 시작 (새 터미널)

```bash
# 프로젝트 루트 디렉토리에서
npm install
npm run dev

# 출력 확인:
# VITE v... ready in ... ms
# http://localhost:5173/
```

### 3단계: 브라우저에서 테스트

```
http://localhost:5173 접속
```

---

## ✅ 테스트 체크리스트

### 인증 테스트
- [ ] "회원가입" 클릭
- [ ] 이메일, 비밀번호, 이름 입력
- [ ] 회원가입 성공
- [ ] 로그인되어 탭 메뉴 보임

### 업로드 테스트
- [ ] "📹 로컬 업로드" 탭 클릭
- [ ] 비디오 파일 선택 (또는 드래그)
- [ ] 언어 선택 (한국어 권장)
- [ ] "🚀 업로드 & STT 시작" 클릭
- [ ] 업로드 진행률 표시
- [ ] "⏳ STT 처리 중..." 표시
- [ ] 5초마다 상태 업데이트

### 자막 표시 테스트
- [ ] 약 20-30초 후 "✅ STT 처리 완료!" 표시
- [ ] 자막이 여러 줄 표시됨
- [ ] "📝 자막 편집하러 가기" 버튼 클릭

### 번역 테스트
- [ ] 언어 선택 (예: 영어)
- [ ] "🌐 번역" 클릭
- [ ] "번역 중..." 표시
- [ ] 영어 번역 표시

### YouTube 자막 테스트
- [ ] "📺 YouTube 자막" 탭 클릭
- [ ] YouTube URL 입력 (자막이 있는 영상)
- [ ] "📥 자막 추출" 클릭
- [ ] 자막 미리보기
- [ ] "💾 SRT 파일 다운로드" 클릭

---

## 🔧 환경 변수 설정 (이미 완료됨)

### backend/.env
```env
PORT=5001
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
GCS_BUCKET=bob-sto
OPENAI_API_KEY=sk-svcacct-... ✅ (적용됨)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRY=7d
ENABLE_AUDIO_ENHANCEMENT=true
```

**모두 설정되어 있습니다!** ✅

---

## 🐛 자주 발생하는 문제 및 해결법

### 1️⃣ "포트 5001이 이미 사용 중입니다"
```bash
# 해결:
# Windows
netstat -ano | findstr :5001
taskkill /PID 12345 /F

# Mac/Linux
lsof -i :5001
kill -9 12345
```

### 2️⃣ "프론트엔드가 백엔드와 연결 안 됨"
```bash
# 확인:
# 1. 백엔드가 실행 중인지 확인
curl http://localhost:5001/api/health

# 2. 응답이 안 나면 백엔드 재시작
npm start

# 3. CORS 설정 확인 (backend/.env)
CORS_ORIGIN=http://localhost:5173
```

### 3️⃣ "npm install 중 에러"
```bash
# 해결:
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 4️⃣ "회원가입/로그인 실패"
```bash
# 1. 브라우저 콘솔에서 에러 확인 (F12)
# 2. 백엔드 로그 확인
# 3. 다음 항목 확인:
#    - 이메일 형식 (예: test@example.com)
#    - 비밀번호 8자 이상
#    - 프로젝트 이름 입력됨
```

### 5️⃣ "자막이 안 나옴"
```bash
# 1. 테스트 비디오 확인 (MP4, MOV, AVI, MKV)
# 2. 파일 크기 (500MB 이하)
# 3. 충분한 시간 대기 (비디오 길이 × 약 2배)
# 4. 백엔드 로그 확인 (에러 있으면 표시됨)
```

---

## 📊 테스트용 영상 추천

### 무료 다운로드 사이트
- [Pixabay Videos](https://pixabay.com/videos/) - 무료 동영상
- [Pexels Videos](https://www.pexels.com/videos/) - 무료 라이선스
- [Coverr](https://coverr.co/) - 프리미엄 품질

### 추천 영상 속성
- **해상도**: 720p 이상
- **길이**: 30초 ~ 5분
- **파일 크기**: 50MB 이하 (테스트용)
- **형식**: MP4 (권장)
- **음성**: 명확한 음성 포함

---

## 💡 개발 팁

### 백엔드 디버깅
```bash
# 상세 로그 보기
NODE_ENV=development npm start

# 특정 API 테스트
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'
```

### 프론트엔드 디버깅
```bash
# React DevTools 사용 (F12 → Components 탭)
# Redux DevTools 사용 (필요시 설치)
# Network 탭에서 API 요청 확인
```

---

## 🎉 축하합니다!

BobPT가 완벽하게 작동합니다! 🚀

**현재 상태:**
- ✅ 백엔드 API 서버 실행 중
- ✅ 프론트엔드 개발 서버 실행 중
- ✅ JWT 인증 시스템 작동 중
- ✅ OpenAI Whisper API 연동됨
- ✅ 모든 기본 기능 작동 중

---

**더 자세한 정보는 다음 문서를 참조하세요:**
- `SETUP_CHECKLIST.md` - 전체 설정 목록
- `PRODUCTION_DEPLOYMENT.md` - 배포 가이드

**문제가 있으면 언제든지 연락하세요!** 😊
