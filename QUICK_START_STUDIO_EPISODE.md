# ⚡ Studio Episode 빠른 시작 가이드

## 🎯 통합 완료!

Studio Episode가 BobPT 프로젝트에 성공적으로 통합되었습니다.

## 📦 설치

```bash
# 의존성 설치
npm install
```

## 🔑 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```env
VITE_GEMINI_API_KEY=your-gemini-api-key-here
```

**Gemini API 키 발급:**
- https://aistudio.google.com/app/apikey

## 🚀 사용 방법

### 방법 1: 독립 앱으로 사용

```tsx
// src/main.tsx 또는 원하는 위치
import App from './components/studio-episode/App';

// Studio Episode 앱 렌더링
<App />
```

### 방법 2: 개별 컴포넌트 사용

```tsx
import Dashboard from './components/studio-episode/Dashboard';
import Editor from './components/studio-episode/Editor';
import Login from './components/studio-episode/Login';
```

## 📁 통합된 파일 위치

```
src/
├── components/studio-episode/    # 모든 컴포넌트
├── services/studio-episode/       # 서비스 (인증, Gemini)
└── types/studio-episode.ts       # 타입 정의
```

## ✅ 완료된 통합 사항

- ✅ 컴포넌트 복사 및 경로 수정
- ✅ 인증 시스템을 BobPT 백엔드와 연결
- ✅ Tailwind CSS에 episode 색상 추가
- ✅ 패키지 의존성 추가 (`@google/genai`)
- ✅ 타입 정의 통합

## 🎨 주요 기능

1. **자동 자막 생성** - Gemini AI로 자막 자동 생성
2. **번역** - 다국어 자막 번역
3. **맞춤법 검사** - AI 기반 맞춤법 교정
4. **하이라이트 분석** - 바이럴 가능성 높은 구간 추출
5. **썸네일 생성** - AI로 썸네일 자동 생성 및 편집

## 🔧 다음 단계

1. `.env.local`에 Gemini API 키 추가
2. `npm install` 실행
3. 앱에서 Studio Episode 컴포넌트 사용

## 📚 자세한 내용

`STUDIO_EPISODE_INTEGRATION.md` 파일 참고

---

**통합 완료!** 🎉


