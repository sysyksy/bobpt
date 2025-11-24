# Studio Episode 통합 가이드

## 📋 개요

`studio-episode`는 AI Studio에서 만든 비디오 편집 앱으로, Gemini API를 사용하여 자동 자막 생성, 번역, 썸네일 생성 등의 기능을 제공합니다. 이 가이드는 BobPT 프로젝트에 통합하는 방법을 설명합니다.

## ✅ 완료된 작업

1. ✅ 컴포넌트 복사 (`src/components/studio-episode/`)
2. ✅ 서비스 복사 (`src/services/studio-episode/`)
3. ✅ 타입 정의 추가 (`src/types/studio-episode.ts`)
4. ✅ 인증 시스템을 BobPT 백엔드와 통합
5. ✅ 패키지 의존성 추가 (`@google/genai`)

## 📁 파일 구조

```
src/
├── components/
│   └── studio-episode/
│       ├── Dashboard.tsx
│       ├── Editor.tsx
│       ├── Login.tsx
│       ├── Logo.tsx
│       ├── Sidebar.tsx
│       ├── SubtitleList.tsx
│       └── VideoPlayer.tsx
├── services/
│   └── studio-episode/
│       ├── authService.ts (BobPT 백엔드와 통합됨)
│       └── geminiService.ts
└── types/
    └── studio-episode.ts
```

## 🔧 설정 방법

### 1. 패키지 설치

```bash
npm install @google/genai
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 Gemini API 키를 추가:

```env
VITE_GEMINI_API_KEY=your-gemini-api-key-here
```

**Gemini API 키 발급:**
- https://aistudio.google.com/app/apikey 에서 발급
- 또는 Google AI Studio에서 생성

### 3. 컴포넌트 사용

Studio Episode 컴포넌트를 BobPT 앱에서 사용하려면:

```tsx
import { App } from './components/studio-episode/App';
// 또는 개별 컴포넌트
import Dashboard from './components/studio-episode/Dashboard';
import Editor from './components/studio-episode/Editor';
```

## 🔄 통합 상태

### ✅ 완료
- 인증 시스템: BobPT 백엔드 API와 연결됨
- 컴포넌트 구조: 복사 완료
- 타입 정의: 통합 완료

### ⚠️ 수정 필요
- **Gemini 서비스**: 현재는 Gemini API를 직접 호출하지만, 필요시 BobPT 백엔드 API로 변경 가능
- **스타일**: Tailwind CSS 설정에 `episode` 색상 추가 필요
- **경로 참조**: 컴포넌트 내부의 import 경로 수정 필요

## 🎨 Tailwind 설정

`tailwind.config.js`에 다음 색상을 추가:

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        episode: {
          400: '#FF704D',
          500: '#FF4D22',
          600: '#E0411B',
          900: '#1a0a06',
        }
      }
    }
  }
}
```

## 🔌 API 통합 옵션

### 옵션 1: Gemini API 직접 사용 (현재)
- 프론트엔드에서 직접 Gemini API 호출
- 빠른 프로토타이핑에 적합
- API 키가 프론트엔드에 노출됨 (보안 주의)

### 옵션 2: BobPT 백엔드 API 사용 (권장)
- 백엔드에서 Gemini API 호출
- API 키 보안 유지
- 백엔드에 Gemini 서비스 엔드포인트 추가 필요

## 📝 다음 단계

1. **경로 수정**: 컴포넌트 내부의 import 경로를 상대 경로로 수정
2. **스타일 통합**: Tailwind 설정에 episode 색상 추가
3. **백엔드 통합**: Gemini 서비스를 백엔드 API로 이동 (선택사항)
4. **테스트**: 각 기능 테스트 및 버그 수정

## 🚀 사용 예시

### 기본 사용

```tsx
import App from './components/studio-episode/App';

function MyApp() {
  return <App />;
}
```

### 개별 컴포넌트 사용

```tsx
import Dashboard from './components/studio-episode/Dashboard';
import Editor from './components/studio-episode/Editor';

function MyApp() {
  const [view, setView] = useState('dashboard');
  
  return (
    <>
      {view === 'dashboard' && <Dashboard onNewProject={handleNewProject} />}
      {view === 'editor' && <Editor />}
    </>
  );
}
```

## ⚠️ 주의사항

1. **API 키 보안**: Gemini API 키를 `.env.local`에 저장하고 Git에 커밋하지 마세요
2. **의존성 충돌**: `@google/genai` 패키지가 다른 패키지와 충돌할 수 있으니 주의
3. **타입 호환성**: Studio Episode의 타입과 BobPT의 타입이 다를 수 있으니 필요시 변환 함수 추가

## 📚 참고 자료

- [Gemini API 문서](https://ai.google.dev/docs)
- [Studio Episode 원본](https://ai.studio/apps/drive/1TunjxzAHFELMf6_rLf3XmkiLWGoK6Wpz)

---

**마지막 업데이트**: 2024년 1월


