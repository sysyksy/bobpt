"""
Video Pipeline Manager
영상 처리 통합 파이프라인

STT → 추임새 제거 → 하이라이트 검출 → 쇼츠 생성
"""

import os
import tempfile
from typing import List, Dict, Any, Optional
from pathlib import Path
from google.cloud import firestore

from video_editor import VideoEditor
from highlight_detector import HighlightDetector
from export_manager import ExportManager


class VideoPipelineManager:
    """영상 처리 통합 파이프라인 매니저"""

    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        firestore_client: Optional[firestore.Client] = None
    ):
        """
        Args:
            openai_api_key: OpenAI API Key
            firestore_client: Firestore Client (결과 저장용)
        """
        self.openai_api_key = openai_api_key or os.environ.get("OPENAI_API_KEY")
        self.firestore_client = firestore_client

        # 모듈 초기화
        self.video_editor = VideoEditor()
        self.highlight_detector = HighlightDetector(api_key=self.openai_api_key)
        self.export_manager = ExportManager()

        print("[OK] Video Pipeline Manager initialized")

    def process_full_pipeline(
        self,
        video_path: str,
        segments: List[Dict[str, Any]],
        full_transcript: str,
        project_id: Optional[str] = None,
        video_genre: Optional[str] = None,
        enable_filler_removal: bool = True,
        enable_shorts_generation: bool = True,
        num_shorts: int = 3
    ) -> Dict[str, Any]:
        """
        전체 비디오 처리 파이프라인 실행

        Pipeline:
        1. STT (이미 완료된 상태)
        2. 추임새 및 무음 제거 → edited_video.mp4
        3. 하이라이트 구간 검출 (LLM)
        4. 쇼츠 생성 (각 하이라이트마다)
        5. Firestore 저장

        Args:
            video_path: 원본 비디오 경로
            segments: STT 결과 (word-level timestamps)
            full_transcript: 전체 트랜스크립트 텍스트
            project_id: Firestore 프로젝트 ID
            video_genre: 영상 장르
            enable_filler_removal: 추임새 제거 활성화
            enable_shorts_generation: 쇼츠 생성 활성화
            num_shorts: 생성할 쇼츠 개수

        Returns:
            {
                "edited_video": "path/to/edited.mp4",
                "highlights": [...],
                "shorts": [
                    {"path": "path/to/short_1.mp4", "start": 45.0, "end": 105.0},
                    ...
                ]
            }
        """
        print("\n" + "="*70)
        print("🎬 전체 비디오 처리 파이프라인 시작")
        print("="*70)

        result = {
            "edited_video": None,
            "highlights": [],
            "shorts": []
        }

        # 1. 추임새 및 무음 제거
        if enable_filler_removal:
            print("\n[1/4] 추임새 및 무음 제거...")
            try:
                edited_video = self.video_editor.remove_fillers(
                    input_video_path=video_path,
                    segments=segments
                )
                result["edited_video"] = edited_video
                print(f"✅ 편집 완료: {edited_video}")
            except Exception as e:
                print(f"⚠️ 편집 실패 (원본 유지): {str(e)}")
                result["edited_video"] = video_path
        else:
            result["edited_video"] = video_path
            print("\n[1/4] 추임새 제거 비활성화 (건너뜀)")

        # 2. 하이라이트 구간 검출
        if enable_shorts_generation:
            print("\n[2/4] 하이라이트 구간 검출...")
            try:
                highlights = self.highlight_detector.find_highlights(
                    full_transcript=full_transcript,
                    segments=segments,
                    num_highlights=num_shorts,
                    highlight_duration=60.0,
                    video_genre=video_genre
                )
                result["highlights"] = highlights
                print(f"✅ {len(highlights)}개 하이라이트 발견")
            except Exception as e:
                print(f"⚠️ 하이라이트 검출 실패: {str(e)}")
                highlights = []
        else:
            print("\n[2/4] 쇼츠 생성 비활성화 (건너뜀)")
            highlights = []

        # 3. 각 하이라이트마다 SRT 자막 생성
        print("\n[3/4] 자막 파일 생성...")
        subtitle_files = []
        for i, highlight in enumerate(highlights):
            try:
                subtitle_file = self._generate_subtitle_for_highlight(
                    segments=segments,
                    highlight_start=highlight.get("start_time", 0),
                    highlight_end=highlight.get("end_time", 60),
                    video_path=video_path,
                    index=i
                )
                subtitle_files.append(subtitle_file)
                print(f"   ✅ 자막 {i+1}/{len(highlights)}: {subtitle_file}")
            except Exception as e:
                print(f"   ⚠️ 자막 생성 실패: {str(e)}")
                subtitle_files.append(None)

        # 4. 쇼츠 생성
        if enable_shorts_generation and highlights:
            print(f"\n[4/4] {len(highlights)}개 쇼츠 생성...")
            for i, highlight in enumerate(highlights):
                try:
                    start_time = highlight.get("start_time", 0)
                    end_time = highlight.get("end_time", 60)
                    duration = end_time - start_time

                    # 쇼츠 생성
                    shorts_path = self.video_editor.generate_shorts(
                        input_video_path=result["edited_video"],
                        highlight_start=start_time,
                        duration=duration,
                        subtitle_path=subtitle_files[i] if i < len(subtitle_files) else None,
                        output_video_path=str(
                            Path(video_path).parent / f"{Path(video_path).stem}_shorts_{i+1}.mp4"
                        )
                    )

                    result["shorts"].append({
                        "path": shorts_path,
                        "start": start_time,
                        "end": end_time,
                        "reason": highlight.get("reason", ""),
                        "score": highlight.get("score", 0),
                        "subtitle": subtitle_files[i] if i < len(subtitle_files) else None
                    })

                    print(f"   ✅ 쇼츠 {i+1}/{len(highlights)}: {shorts_path}")

                except Exception as e:
                    print(f"   ⚠️ 쇼츠 생성 실패: {str(e)}")
        else:
            print("\n[4/4] 쇼츠 생성 건너뜀")

        # 5. Firestore 저장
        if self.firestore_client and project_id:
            print("\n[추가] Firestore 저장...")
            try:
                self._save_to_firestore(project_id, result)
                print("✅ Firestore 저장 완료")
            except Exception as e:
                print(f"⚠️ Firestore 저장 실패: {str(e)}")

        print("\n" + "="*70)
        print("🎉 전체 파이프라인 완료")
        print("="*70)
        print(f"\n📊 결과 요약:")
        print(f"   편집 영상: {result['edited_video']}")
        print(f"   하이라이트: {len(result['highlights'])}개")
        print(f"   쇼츠: {len(result['shorts'])}개")

        return result

    def _generate_subtitle_for_highlight(
        self,
        segments: List[Dict[str, Any]],
        highlight_start: float,
        highlight_end: float,
        video_path: str,
        index: int
    ) -> str:
        """
        하이라이트 구간의 자막 파일(.srt) 생성

        Args:
            segments: 전체 세그먼트 리스트
            highlight_start: 하이라이트 시작 시간
            highlight_end: 하이라이트 종료 시간
            video_path: 원본 비디오 경로 (출력 경로 생성용)
            index: 하이라이트 인덱스

        Returns:
            생성된 SRT 파일 경로
        """
        # 하이라이트 구간의 세그먼트만 필터링
        highlight_segments = []
        for seg in segments:
            seg_start = seg.get("start_time", 0)
            seg_end = seg.get("end_time", 0)

            # 구간 내에 있는 세그먼트만 포함
            if seg_end > highlight_start and seg_start < highlight_end:
                # 타임스탬프를 하이라이트 시작 기준으로 조정
                adjusted_seg = {
                    "start": max(0, seg_start - highlight_start),
                    "end": min(highlight_end - highlight_start, seg_end - highlight_start),
                    "text": seg.get("word", "")
                }
                highlight_segments.append(adjusted_seg)

        # SRT 생성
        srt_content = self.export_manager.generate_srt(highlight_segments)

        # 파일 저장
        output_path = str(
            Path(video_path).parent / f"{Path(video_path).stem}_shorts_{index+1}.srt"
        )
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        return output_path

    def _save_to_firestore(self, project_id: str, result: Dict[str, Any]):
        """
        결과를 Firestore에 저장

        Args:
            project_id: Firestore 프로젝트 ID
            result: 파이프라인 결과
        """
        if not self.firestore_client:
            return

        doc_ref = self.firestore_client.collection("projects").document(project_id)

        # 업데이트 데이터 준비
        update_data = {
            "video_editing": {
                "edited_video_path": result.get("edited_video", ""),
                "highlights": result.get("highlights", []),
                "shorts": [
                    {
                        "path": short.get("path", ""),
                        "start": short.get("start", 0),
                        "end": short.get("end", 0),
                        "reason": short.get("reason", ""),
                        "score": short.get("score", 0)
                    }
                    for short in result.get("shorts", [])
                ],
                "status": "completed"
            }
        }

        doc_ref.update(update_data)

    def generate_single_short(
        self,
        video_path: str,
        segments: List[Dict[str, Any]],
        full_transcript: str,
        project_id: Optional[str] = None,
        video_genre: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        단일 쇼츠 빠르게 생성 (하이라이트 1개만)

        Args:
            video_path: 비디오 경로
            segments: STT 결과
            full_transcript: 전체 트랜스크립트
            project_id: Firestore 프로젝트 ID
            video_genre: 영상 장르

        Returns:
            {
                "path": "path/to/short.mp4",
                "start": 45.0,
                "end": 105.0,
                "reason": "...",
                "score": 9.5
            }
        """
        print("\n🚀 단일 쇼츠 빠른 생성 모드")

        # 1. 최고의 하이라이트 1개 찾기
        highlight = self.highlight_detector.find_best_highlight(
            full_transcript=full_transcript,
            segments=segments,
            highlight_duration=60.0,
            video_genre=video_genre
        )

        if not highlight:
            print("⚠️ 하이라이트를 찾지 못했습니다.")
            return None

        start_time = highlight.get("start_time", 0)
        end_time = highlight.get("end_time", 60)

        # 2. 자막 생성
        subtitle_file = self._generate_subtitle_for_highlight(
            segments=segments,
            highlight_start=start_time,
            highlight_end=end_time,
            video_path=video_path,
            index=0
        )

        # 3. 쇼츠 생성
        shorts_path = self.video_editor.generate_shorts(
            input_video_path=video_path,
            highlight_start=start_time,
            duration=end_time - start_time,
            subtitle_path=subtitle_file
        )

        result = {
            "path": shorts_path,
            "start": start_time,
            "end": end_time,
            "reason": highlight.get("reason", ""),
            "score": highlight.get("score", 0),
            "subtitle": subtitle_file
        }

        # Firestore 저장
        if self.firestore_client and project_id:
            doc_ref = self.firestore_client.collection("projects").document(project_id)
            doc_ref.update({
                "quick_short": result
            })

        print(f"✅ 쇼츠 생성 완료: {shorts_path}")
        return result


# 편의 함수들

def process_video_with_editing(
    video_path: str,
    segments: List[Dict[str, Any]],
    full_transcript: str,
    enable_filler_removal: bool = True,
    enable_shorts: bool = True
) -> Dict[str, Any]:
    """
    비디오 처리 + 편집 (간편 함수)

    Args:
        video_path: 비디오 경로
        segments: STT 결과
        full_transcript: 전체 트랜스크립트
        enable_filler_removal: 추임새 제거
        enable_shorts: 쇼츠 생성

    Returns:
        처리 결과
    """
    manager = VideoPipelineManager()
    return manager.process_full_pipeline(
        video_path=video_path,
        segments=segments,
        full_transcript=full_transcript,
        enable_filler_removal=enable_filler_removal,
        enable_shorts_generation=enable_shorts
    )


def create_quick_short(
    video_path: str,
    segments: List[Dict[str, Any]],
    full_transcript: str
) -> Optional[Dict[str, Any]]:
    """
    빠른 쇼츠 생성 (간편 함수)

    Args:
        video_path: 비디오 경로
        segments: STT 결과
        full_transcript: 전체 트랜스크립트

    Returns:
        쇼츠 정보
    """
    manager = VideoPipelineManager()
    return manager.generate_single_short(
        video_path=video_path,
        segments=segments,
        full_transcript=full_transcript
    )


if __name__ == "__main__":
    print("Video Pipeline Manager - Test")
    print("\n이 모듈은 다음 기능을 통합합니다:")
    print("1. 추임새 및 무음 제거 (VideoEditor)")
    print("2. 하이라이트 구간 검출 (HighlightDetector)")
    print("3. 쇼츠 자동 생성 (VideoEditor)")
    print("4. 자막 파일 생성 (ExportManager)")
    print("\n실제 실행하려면 OPENAI_API_KEY 및 비디오 파일이 필요합니다.")
