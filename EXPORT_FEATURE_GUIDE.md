# Export Feature Guide

## 📥 내보내기 기능 가이드

Project Brew에서 완성된 자막을 다양한 형식으로 내보낼 수 있습니다.

---

## 🎯 지원 형식

### 1. **SRT (SubRip)**
- **확장자**: `.srt`
- **용도**: 범용 자막 파일 형식
- **호환성**: 거의 모든 비디오 플레이어 및 편집 소프트웨어
- **특징**:
  - 가장 널리 사용되는 자막 포맷
  - YouTube, Netflix, VLC 등 대부분의 플랫폼 지원
  - 타임스탬프 + 텍스트 형식

**예시:**
```srt
1
00:00:00,000 --> 00:00:02,500
안녕하세요

2
00:00:02,500 --> 00:00:05,000
반갑습니다
```

---

### 2. **VTT (WebVTT)**
- **확장자**: `.vtt`
- **용도**: 웹 표준 자막 파일 형식
- **호환성**: 웹 브라우저, HTML5 비디오
- **특징**:
  - W3C 표준 형식
  - 웹 기반 비디오 플레이어에 최적화
  - 스타일링 및 메타데이터 지원

**예시:**
```vtt
WEBVTT

00:00:00.000 --> 00:00:02.500
안녕하세요

00:00:02.500 --> 00:00:05.000
반갑습니다
```

---

### 3. **Adobe Premiere Pro XML**
- **확장자**: `.xml`
- **용도**: Premiere Pro 프로젝트 파일
- **호환성**: Adobe Premiere Pro, Final Cut Pro 7
- **특징**:
  - **Vrew와 동일한 방식**으로 마커 기반 자막 생성
  - 비디오 클립과 함께 자막 마커 포함
  - 프리미어 프로에서 바로 편집 가능
  - 컷 편집 정보 포함

**사용 방법:**
1. Premiere Pro 실행
2. File → Import → 생성된 XML 파일 선택
3. 타임라인에 자동으로 비디오 + 마커 추가됨
4. 마커를 자막으로 변환하거나 그대로 사용

**구조:**
- 비디오 클립 정보
- 타임라인 마커 (각 자막의 시작 시간)
- 오디오 트랙
- 프로젝트 메타데이터

---

### 4. **Final Cut Pro X XML**
- **확장자**: `.fcpxml`
- **용도**: Final Cut Pro X 프로젝트 파일
- **호환성**: Final Cut Pro X (10.0 이상)
- **특징**:
  - FCPXML 1.9 표준 사용
  - 마커 기반 자막
  - 비디오 + 오디오 클립 포함

**사용 방법:**
1. Final Cut Pro X 실행
2. File → Import → XML → 생성된 FCPXML 파일 선택
3. 타임라인에 자동으로 추가됨

---

## 🚀 사용 방법

### 1. 프론트엔드 (Editor UI)

```typescript
import { exportProject } from './apiClient';

// SRT 내보내기
await exportProject(projectId, { format: 'srt' });

// Premiere Pro XML 내보내기 (옵션 포함)
await exportProject(projectId, {
  format: 'premiere',
  frameRate: 30,
  videoWidth: 1920,
  videoHeight: 1080,
});
```

### 2. Backend API

#### 엔드포인트: `POST /api/projects/{project_id}/export`

**Request:**
```json
{
  "format": "premiere",
  "frameRate": 30,
  "videoWidth": 1920,
  "videoHeight": 1080
}
```

**Response:**
- Content-Type: `application/xml` (premiere, fcpx) 또는 `text/plain` (srt, vtt)
- Content-Disposition: `attachment; filename="project-id.xml"`
- Body: 파일 내용

#### 사용 가능한 형식 조회: `GET /api/projects/{project_id}/export/formats`

**Response:**
```json
{
  "formats": [
    {
      "id": "srt",
      "name": "SubRip (.srt)",
      "description": "범용 자막 파일 형식",
      "extension": ".srt",
      "icon": "📄"
    },
    {
      "id": "vtt",
      "name": "WebVTT (.vtt)",
      "description": "웹 표준 자막 파일 형식",
      "extension": ".vtt",
      "icon": "🌐"
    },
    {
      "id": "premiere",
      "name": "Adobe Premiere Pro (.xml)",
      "description": "프리미어 프로 프로젝트 파일 (마커 포함)",
      "extension": ".xml",
      "icon": "🎬"
    },
    {
      "id": "fcpx",
      "name": "Final Cut Pro X (.fcpxml)",
      "description": "파이널 컷 프로 X 프로젝트 파일",
      "extension": ".fcpxml",
      "icon": "🎞️"
    }
  ]
}
```

---

## 🔧 Export Manager 사용법

### Python 코드에서 직접 사용

```python
from export_manager import ExportManager

manager = ExportManager()

# 자막 데이터
captions = [
    {"start": 0.0, "end": 2.5, "text": "안녕하세요"},
    {"start": 2.5, "end": 5.0, "text": "반갑습니다"},
]

# SRT 생성
srt_content = manager.generate_srt(captions)
print(srt_content)

# VTT 생성
vtt_content = manager.generate_vtt(captions)

# Premiere Pro XML 생성
xml_content = manager.generate_premiere_xml(
    project_name="My Project",
    video_file_path="/path/to/video.mp4",
    captions=captions,
    frame_rate=30,
    video_width=1920,
    video_height=1080,
)

# FCPX XML 생성
fcpxml_content = manager.generate_fcpxml(
    project_name="My Project",
    video_file_path="/path/to/video.mp4",
    captions=captions,
    frame_rate=30,
)
```

---

## 🎬 Premiere Pro 통합 가이드

### Vrew와 동일한 워크플로우

1. **Project Brew에서 자막 작업**
   - STT로 자막 생성
   - 편집기에서 자막 수정
   - Premiere Pro XML로 내보내기

2. **Premiere Pro에서 불러오기**
   ```
   File → Import → [생성된 XML 파일]
   ```

3. **타임라인 확인**
   - 비디오 클립이 자동으로 추가됨
   - 각 자막의 시작 시간에 **마커** 생성
   - 마커에 자막 텍스트 포함

4. **자막으로 변환 (옵션)**
   - 마커를 선택하여 자막 트랙으로 변환
   - 또는 Essential Graphics Panel에서 텍스트 레이어로 변환

### 파일 경로 처리

- **GCS URI**: `gs://bucket-name/video.mp4`
  - Premiere Pro는 로컬 파일 경로 필요
  - GCS에서 다운로드 후 경로 수정 필요

- **로컬 경로**: `/absolute/path/to/video.mp4`
  - 절대 경로 권장
  - 상대 경로도 지원 (프로젝트 폴더 기준)

---

## ⚙️ 설정 옵션

### Frame Rate (프레임 레이트)
- **기본값**: 30fps
- **옵션**: 24, 25, 30, 60 등
- **용도**: 비디오의 프레임 레이트와 일치시켜야 함

### Video Resolution (해상도)
- **기본값**: 1920x1080 (Full HD)
- **옵션**:
  - 1280x720 (HD)
  - 1920x1080 (Full HD)
  - 3840x2160 (4K UHD)

### Audio Sample Rate (오디오 샘플레이트)
- **기본값**: 48000Hz
- **옵션**: 44100Hz, 48000Hz

---

## 🐛 트러블슈팅

### 1. Premiere Pro에서 파일을 불러올 수 없음
**원인**: 비디오 파일 경로가 잘못됨

**해결**:
- XML 파일을 텍스트 에디터로 열기
- `<pathurl>` 태그의 경로를 실제 비디오 파일 경로로 수정
- 절대 경로 사용 권장

### 2. 마커가 표시되지 않음
**원인**: Premiere Pro 버전 호환성 문제

**해결**:
- Premiere Pro CC 2018 이상 사용
- Final Cut Pro 7 XML 형식 지원 확인

### 3. 자막 타이밍이 맞지 않음
**원인**: 프레임 레이트 불일치

**해결**:
- 비디오의 실제 프레임 레이트 확인
- 내보내기 시 동일한 프레임 레이트 설정

### 4. 한글이 깨짐
**원인**: 인코딩 문제

**해결**:
- 파일을 UTF-8 BOM 없이 저장
- 텍스트 에디터에서 인코딩 확인

---

## 📚 참고 자료

- [Final Cut Pro 7 XML Interchange Format](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/FinalCutPro_XML/AboutThisDoc/AboutThisDoc.html)
- [FCPXML Documentation](https://developer.apple.com/documentation/professional_video_applications/fcpxml_reference)
- [WebVTT Specification](https://www.w3.org/TR/webvtt1/)
- [SubRip Format](https://en.wikipedia.org/wiki/SubRip)

---

## ✨ 향후 추가 예정 기능

- [ ] DaVinci Resolve EDL 내보내기
- [ ] Avid Media Composer AAF 내보내기
- [ ] YouTube SBV 형식 내보내기
- [ ] 자막 스타일링 옵션 (색상, 폰트, 크기)
- [ ] 멀티 트랙 자막 지원
- [ ] 배치 내보내기 (여러 프로젝트 동시 처리)

---

**Made with ❤️ by Project Brew Team**
