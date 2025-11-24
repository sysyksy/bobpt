# 🔍 코드 리뷰 및 개선 제안

## 📋 발견된 문제점

### 1. ⚠️ 중복된 App.tsx 파일
**위치**: `src/App.tsx` (1400줄)
- **문제**: Studio Episode UI로 전환했지만 기존 BobPT UI가 그대로 남아있음
- **영향**: 불필요한 코드 유지, 혼란 가능성
- **해결**: 
  - 백업이 필요하다면 `src/App.old.tsx`로 이름 변경
  - 또는 완전히 삭제 (Git 히스토리에 보존됨)

### 2. 🔄 중복된 폴링 로직
**위치**: `src/components/studio-episode/Editor.tsx`
- **문제**: `pollTranscript`와 `pollThumbnails`가 거의 동일한 패턴 반복
- **중복 코드**:
  ```typescript
  // pollTranscript (242-282줄)
  const pollTranscript = async (attempts = 0): Promise<void> => {
    if (attempts > 40) throw new Error("...");
    // ... 폴링 로직
    await new Promise(resolve => setTimeout(resolve, 5000));
    return pollTranscript(attempts + 1);
  };

  // pollThumbnails (467-496줄)
  const pollThumbnails = async (attempts = 0): Promise<void> => {
    if (attempts > 20) throw new Error("...");
    // ... 폴링 로직
    await new Promise(resolve => setTimeout(resolve, 3000));
    return pollThumbnails(attempts + 1);
  };
  ```
- **해결**: 공통 `pollUntilReady` 유틸리티 함수 생성

### 3. 🔄 중복된 타입 변환 로직
**위치**: `src/components/studio-episode/Editor.tsx`
- **문제**: BobPT 형식 → Studio Episode 형식 변환이 여러 곳에 중복
- **중복 위치**:
  1. `handleGenerateSubtitles` (259-265줄)
  2. `loadExistingProject` (유사한 변환 로직)
- **중복 코드**:
  ```typescript
  const convertedSubtitles: SubtitleBlock[] = transcriptData.transcript.map((item: any, index: number) => ({
    id: `subtitle-${index}-${Date.now()}`,
    startTime: item.start_time || item.start || 0,
    endTime: item.end_time || item.end || 0,
    text: item.word || item.text || '',
    speaker: 'Speaker 1'
  }));
  ```
- **해결**: `convertBobPTToSubtitleBlocks` 유틸리티 함수 생성

### 4. 🔄 중복된 에러 처리 패턴
**위치**: 여러 핸들러 함수들
- **문제**: try-catch + alert + fallback 패턴이 반복됨
- **중복 패턴**:
  ```typescript
  try {
    // BobPT API 호출
  } catch (error: any) {
    console.error("...", error);
    // Fallback: Gemini 사용
    try {
      await geminiFallback();
      alert("백엔드 실패, Gemini로 전환했습니다.");
    } catch (fallbackError) {
      alert("실패: " + error.message);
    }
  }
  ```
- **해결**: `withFallback` HOC 또는 유틸리티 함수 생성

### 5. 📁 불필요한 frontend 폴더
**위치**: `frontend/` 디렉토리
- **문제**: 실제로는 `src/`를 사용 중인데 `frontend/` 폴더가 존재
- **영향**: 혼란, 불필요한 디스크 공간
- **해결**: 
  - 사용 여부 확인 후 삭제 또는
  - `frontend-legacy/`로 이름 변경

### 6. 🔄 중복된 타입 정의
**위치**: 
- `src/App.tsx` (4-15줄): `Project`, `TranscriptItem`
- `src/types/studio-episode.ts`: `Project`, `SubtitleBlock`
- **문제**: 유사한 타입이 여러 곳에 정의됨
- **해결**: 공통 타입 파일로 통합

### 7. 🔄 중복된 언어 코드 매핑
**위치**: `src/components/studio-episode/Editor.tsx` (handleTranslate)
- **문제**: 언어 이름 → 코드 변환 로직이 하드코딩됨
- **해결**: `LANGUAGE_MAP` 상수로 추출

### 8. 🔄 중복된 프로젝트 ID 검증
**위치**: 여러 핸들러 함수들
- **문제**: `if (!currentProjectId) { alert(...); return; }` 패턴 반복
- **해결**: `useProjectGuard` 커스텀 훅 생성

## ✅ 개선 제안

### 1. 공통 유틸리티 함수 생성

#### `src/utils/polling.ts`
```typescript
export interface PollOptions {
  maxAttempts?: number;
  intervalMs?: number;
  checkCondition: (data: any) => boolean;
  fetchData: () => Promise<any>;
  onSuccess: (data: any) => void;
  onError?: (error: any) => void;
}

export const pollUntilReady = async (options: PollOptions): Promise<void> => {
  const { maxAttempts = 40, intervalMs = 5000, checkCondition, fetchData, onSuccess, onError } = options;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await fetchData();
      if (checkCondition(data)) {
        onSuccess(data);
        return;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    } catch (error: any) {
      if (error.response?.status === 202 || error.response?.status === 202) {
        // 처리 중 - 계속 폴링
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        continue;
      }
      if (onError) onError(error);
      throw error;
    }
  }
  throw new Error("처리 시간이 너무 오래 걸립니다.");
};
```

#### `src/utils/subtitleConverter.ts`
```typescript
import { SubtitleBlock } from '../types/studio-episode';

export interface BobPTTranscriptItem {
  start_time?: number;
  start?: number;
  end_time?: number;
  end?: number;
  word?: string;
  text?: string;
}

export const convertBobPTToSubtitleBlocks = (
  transcript: BobPTTranscriptItem[]
): SubtitleBlock[] => {
  return transcript.map((item, index) => ({
    id: `subtitle-${index}-${Date.now()}`,
    startTime: item.start_time || item.start || 0,
    endTime: item.end_time || item.end || 0,
    text: item.word || item.text || '',
    speaker: 'Speaker 1'
  }));
};
```

#### `src/utils/errorHandler.ts`
```typescript
export const withFallback = async <T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>,
  errorMessage: string = "작업 실패"
): Promise<T> => {
  try {
    return await primaryFn();
  } catch (error: any) {
    console.error(errorMessage, error);
    try {
      const result = await fallbackFn();
      alert(`백엔드 실패, Gemini로 전환했습니다.`);
      return result;
    } catch (fallbackError) {
      alert(`${errorMessage}: ${error.message || "Unknown error"}`);
      throw fallbackError;
    }
  }
};
```

### 2. 커스텀 훅 생성

#### `src/hooks/useProjectGuard.ts`
```typescript
import { useCallback } from 'react';

export const useProjectGuard = (projectId: string | null) => {
  return useCallback((action: string) => {
    if (!projectId) {
      alert(`프로젝트가 없습니다. 먼저 ${action}하세요.`);
      return false;
    }
    return true;
  }, [projectId]);
};
```

### 3. 상수 파일 생성

#### `src/constants/languages.ts`
```typescript
export const LANGUAGE_MAP: { [key: string]: string } = {
  'English': 'en',
  'Spanish': 'es',
  'Korean': 'ko',
  'Japanese': 'ja',
  'Chinese': 'zh',
  'French': 'fr'
};

export const getLanguageCode = (languageName: string): string => {
  return LANGUAGE_MAP[languageName] || languageName.toLowerCase();
};
```

### 4. 타입 통합

#### `src/types/common.ts`
```typescript
// 공통 타입 정의
export interface TranscriptItem {
  start: number;
  end: number;
  text: string;
}

export interface Project {
  projectId: string;
  fileName: string;
  status: string;
  created_at: string;
}
```

## 📊 개선 효과

### 코드 라인 수 감소
- **폴링 로직**: ~60줄 → ~30줄 (50% 감소)
- **타입 변환**: ~20줄 × 2 → ~10줄 (75% 감소)
- **에러 처리**: ~15줄 × 5 → ~5줄 × 5 (67% 감소)

### 유지보수성 향상
- 폴링 로직 변경 시 한 곳만 수정
- 타입 변환 로직 일관성 보장
- 에러 처리 패턴 통일

### 테스트 용이성
- 유틸리티 함수 단위 테스트 가능
- Mock 데이터로 쉽게 테스트

## 🎯 우선순위

1. **높음**: 폴링 로직 통합 (즉시 적용 가능)
2. **높음**: 타입 변환 로직 통합 (즉시 적용 가능)
3. **중간**: 에러 처리 패턴 통합
4. **중간**: 불필요한 파일 정리
5. **낮음**: 커스텀 훅 생성 (선택사항)

## 📝 다음 단계

1. `src/utils/` 폴더 생성
2. 공통 유틸리티 함수 구현
3. Editor.tsx 리팩토링
4. 테스트 및 검증
5. 불필요한 파일 정리

