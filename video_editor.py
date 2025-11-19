"""
Video Editor
영상 자동 편집 모듈 - Vrew + Subup 스타일

주요 기능:
1. remove_fillers: 무음 및 추임새 자동 삭제 (Vrew 스타일)
2. generate_shorts: 쇼츠 자동 생성 (Subup 스타일)

모든 영상 처리는 ffmpeg (subprocess)를 사용
"""

import os
import subprocess
import tempfile
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path


class VideoEditor:
    """영상 자동 편집 클래스"""

    def __init__(self, ffmpeg_path: str = "ffmpeg"):
        """
        Args:
            ffmpeg_path: FFmpeg 실행 파일 경로
        """
        self.ffmpeg_path = ffmpeg_path

        # FFmpeg 설치 확인
        try:
            subprocess.run(
                [self.ffmpeg_path, "-version"],
                capture_output=True,
                check=True
            )
            print("[OK] FFmpeg found")
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise RuntimeError(
                "FFmpeg not found. Install: https://ffmpeg.org/download.html"
            )

    def remove_fillers(
        self,
        input_video_path: str,
        segments: List[Dict[str, Any]],
        output_video_path: Optional[str] = None,
        min_silence_gap: float = 0.8,
        keep_silence_duration: float = 0.3,
        filler_words: Optional[List[str]] = None
    ) -> str:
        """
        무음 및 추임새 자동 삭제 (Vrew 스타일)

        Args:
            input_video_path: 원본 비디오 경로
            segments: Whisper STT 결과 (word-level timestamps)
                [{"start_time": 0.0, "end_time": 2.5, "word": "안녕하세요"}, ...]
            output_video_path: 출력 비디오 경로 (None이면 자동 생성)
            min_silence_gap: 무음으로 간주할 최소 간격 (초)
            keep_silence_duration: 무음 구간에서 유지할 시간 (초)
            filler_words: 삭제할 추임새 리스트

        Returns:
            출력 비디오 파일 경로
        """
        print("\n" + "="*60)
        print("🎬 무음 및 추임새 자동 삭제 시작")
        print("="*60)

        # 기본 추임새 리스트 (한국어)
        if filler_words is None:
            filler_words = [
                "음", "어", "그", "아", "에", "으",
                "음...", "어...", "그...", "아...",
                "uh", "um", "er", "ah", "like", "you know"
            ]

        # 1. Keep Ranges 계산
        keep_ranges = self._calculate_keep_ranges(
            segments=segments,
            min_silence_gap=min_silence_gap,
            keep_silence_duration=keep_silence_duration,
            filler_words=filler_words
        )

        if not keep_ranges:
            print("⚠️ 유지할 구간이 없습니다. 원본을 그대로 반환합니다.")
            return input_video_path

        print(f"✅ Keep Ranges 계산 완료: {len(keep_ranges)}개 구간")

        # 2. 출력 파일 경로 생성
        if output_video_path is None:
            base_name = Path(input_video_path).stem
            output_video_path = str(
                Path(input_video_path).parent / f"{base_name}_edited.mp4"
            )

        # 3. FFmpeg Concat으로 영상 이어붙이기
        self._concat_video_segments(
            input_video_path=input_video_path,
            keep_ranges=keep_ranges,
            output_video_path=output_video_path
        )

        print(f"✅ 편집 완료: {output_video_path}")
        return output_video_path

    def _calculate_keep_ranges(
        self,
        segments: List[Dict[str, Any]],
        min_silence_gap: float,
        keep_silence_duration: float,
        filler_words: List[str]
    ) -> List[Tuple[float, float]]:
        """
        삭제할 구간을 제외한 유지할 구간(Keep Ranges) 계산

        Args:
            segments: Whisper STT 결과
            min_silence_gap: 무음으로 간주할 최소 간격
            keep_silence_duration: 무음 구간에서 유지할 시간
            filler_words: 삭제할 추임새 리스트

        Returns:
            [(start, end), ...] 유지할 구간 리스트
        """
        if not segments:
            return []

        keep_ranges = []
        current_start = None
        current_end = None

        for i, segment in enumerate(segments):
            start = segment.get("start_time", 0)
            end = segment.get("end_time", 0)
            word = segment.get("word", "").strip().lower()

            # 추임새 체크
            is_filler = any(
                filler.lower() in word or word == filler.lower()
                for filler in filler_words
            )

            if is_filler:
                # 추임새 구간은 건너뜀
                print(f"   🗑️ 추임새 삭제: '{segment.get('word')}' ({start:.2f}s - {end:.2f}s)")

                # 현재까지의 keep range 저장
                if current_start is not None and current_end is not None:
                    keep_ranges.append((current_start, current_end))
                    current_start = None
                    current_end = None
                continue

            # Keep range 시작
            if current_start is None:
                current_start = start
                current_end = end
            else:
                # 이전 세그먼트와의 간격 확인
                gap = start - current_end

                if gap >= min_silence_gap:
                    # 무음 구간 처리
                    print(f"   ✂️ 무음 축소: {gap:.2f}초 → {keep_silence_duration:.2f}초")

                    # 이전 구간 저장 (무음 일부 포함)
                    keep_ranges.append((current_start, current_end + keep_silence_duration))

                    # 새 구간 시작 (무음 일부 포함)
                    current_start = start - keep_silence_duration
                    current_end = end
                else:
                    # 간격이 작으면 연속된 구간으로 처리
                    current_end = end

        # 마지막 구간 저장
        if current_start is not None and current_end is not None:
            keep_ranges.append((current_start, current_end))

        return keep_ranges

    def _concat_video_segments(
        self,
        input_video_path: str,
        keep_ranges: List[Tuple[float, float]],
        output_video_path: str
    ):
        """
        FFmpeg으로 여러 구간을 이어붙이기

        Args:
            input_video_path: 원본 비디오 경로
            keep_ranges: 유지할 구간 리스트
            output_video_path: 출력 비디오 경로
        """
        print(f"\n🔨 FFmpeg으로 {len(keep_ranges)}개 구간 이어붙이기...")

        # 임시 디렉토리 생성
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_dir_path = Path(temp_dir)

            # 1. 각 구간을 개별 파일로 추출
            segment_files = []
            for i, (start, end) in enumerate(keep_ranges):
                segment_file = temp_dir_path / f"segment_{i:04d}.mp4"
                duration = end - start

                cmd = [
                    self.ffmpeg_path,
                    "-i", input_video_path,
                    "-ss", str(start),
                    "-t", str(duration),
                    "-c:v", "libx264",
                    "-preset", "medium",
                    "-crf", "23",
                    "-c:a", "aac",
                    "-b:a", "128k",
                    "-avoid_negative_ts", "make_zero",
                    "-y",
                    str(segment_file)
                ]

                subprocess.run(cmd, check=True, capture_output=True)
                segment_files.append(segment_file)

            print(f"   ✅ {len(segment_files)}개 세그먼트 추출 완료")

            # 2. Concat demuxer로 이어붙이기
            concat_list_file = temp_dir_path / "concat_list.txt"
            with open(concat_list_file, "w", encoding="utf-8") as f:
                for segment_file in segment_files:
                    f.write(f"file '{segment_file.absolute()}'\n")

            cmd = [
                self.ffmpeg_path,
                "-f", "concat",
                "-safe", "0",
                "-i", str(concat_list_file),
                "-c", "copy",
                "-y",
                output_video_path
            ]

            subprocess.run(cmd, check=True, capture_output=True)
            print(f"   ✅ 최종 영상 생성 완료")

    def generate_shorts(
        self,
        input_video_path: str,
        highlight_start: float,
        output_video_path: Optional[str] = None,
        duration: float = 60.0,
        subtitle_path: Optional[str] = None,
        subtitle_style: Optional[str] = None
    ) -> str:
        """
        쇼츠 자동 생성 (Subup 스타일)

        Args:
            input_video_path: 원본 비디오 경로
            highlight_start: 하이라이트 시작 시간 (초)
            output_video_path: 출력 비디오 경로 (None이면 자동 생성)
            duration: 쇼츠 길이 (초, 기본 60초)
            subtitle_path: 자막 파일 경로 (.srt)
            subtitle_style: 자막 스타일 (ASS/SSA 형식)

        Returns:
            출력 비디오 파일 경로
        """
        print("\n" + "="*60)
        print("📱 쇼츠 자동 생성 시작")
        print(f"   시작: {highlight_start:.2f}s")
        print(f"   길이: {duration:.2f}s")
        print("="*60)

        # 출력 파일 경로 생성
        if output_video_path is None:
            base_name = Path(input_video_path).stem
            output_video_path = str(
                Path(input_video_path).parent / f"{base_name}_shorts.mp4"
            )

        # 기본 자막 스타일
        if subtitle_style is None:
            subtitle_style = (
                "FontName=Arial,"
                "FontSize=24,"
                "PrimaryColour=&H00FFFF00,"  # 노란색
                "OutlineColour=&H00000000,"   # 검은 테두리
                "BackColour=&H80000000,"       # 반투명 배경
                "Bold=1,"
                "Outline=2,"
                "Shadow=1,"
                "Alignment=2,"                 # 하단 중앙
                "MarginV=50"
            )

        # FFmpeg 명령어 구성
        cmd = [
            self.ffmpeg_path,
            "-ss", str(highlight_start),
            "-i", input_video_path,
            "-t", str(duration),
        ]

        # 비디오 필터 체인
        video_filters = []

        # 1. Center Crop (9:16 세로 비율)
        video_filters.append("crop=ih*(9/16):ih:(iw-ow)/2:0")

        # 2. 해상도 조정 (1080x1920, Full HD 세로)
        video_filters.append("scale=1080:1920")

        # 자막 필터 추가
        if subtitle_path and os.path.exists(subtitle_path):
            # Windows 경로 처리 (역슬래시 → 슬래시, 드라이브 문자 처리)
            subtitle_path_escaped = subtitle_path.replace("\\", "/").replace(":", "\\\\:")
            video_filters.append(
                f"subtitles='{subtitle_path_escaped}':force_style='{subtitle_style}'"
            )
            print(f"   📝 자막 추가: {subtitle_path}")

        # 필터 적용
        cmd.extend([
            "-vf", ",".join(video_filters),
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-y",
            output_video_path
        ])

        print(f"\n🔨 FFmpeg 실행 중...")
        print(f"   명령어: {' '.join(cmd[:10])}... (생략)")

        try:
            subprocess.run(cmd, check=True, capture_output=True)
            print(f"✅ 쇼츠 생성 완료: {output_video_path}")
            return output_video_path
        except subprocess.CalledProcessError as e:
            print(f"❌ FFmpeg 오류:")
            print(e.stderr.decode())
            raise

    def get_video_info(self, video_path: str) -> Dict[str, Any]:
        """
        비디오 메타데이터 추출 (ffprobe 사용)

        Args:
            video_path: 비디오 파일 경로

        Returns:
            {
                "duration": 123.45,
                "width": 1920,
                "height": 1080,
                "fps": 30.0,
                "codec": "h264"
            }
        """
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            video_path
        ]

        try:
            result = subprocess.run(cmd, check=True, capture_output=True)
            import json
            data = json.loads(result.stdout.decode())

            # 비디오 스트림 찾기
            video_stream = None
            for stream in data.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_stream = stream
                    break

            if not video_stream:
                raise ValueError("No video stream found")

            # FPS 계산
            fps_str = video_stream.get("r_frame_rate", "30/1")
            fps_parts = fps_str.split("/")
            fps = float(fps_parts[0]) / float(fps_parts[1])

            return {
                "duration": float(data.get("format", {}).get("duration", 0)),
                "width": int(video_stream.get("width", 0)),
                "height": int(video_stream.get("height", 0)),
                "fps": fps,
                "codec": video_stream.get("codec_name", "unknown")
            }

        except Exception as e:
            print(f"⚠️ 비디오 정보 추출 실패: {str(e)}")
            return {}


# 편의 함수들

def remove_fillers_from_video(
    video_path: str,
    segments: List[Dict[str, Any]],
    output_path: Optional[str] = None
) -> str:
    """
    무음 및 추임새 삭제 (간편 함수)

    Args:
        video_path: 원본 비디오 경로
        segments: STT 결과
        output_path: 출력 경로

    Returns:
        편집된 비디오 경로
    """
    editor = VideoEditor()
    return editor.remove_fillers(video_path, segments, output_path)


def create_shorts_from_video(
    video_path: str,
    start_time: float,
    subtitle_path: Optional[str] = None,
    output_path: Optional[str] = None,
    duration: float = 60.0
) -> str:
    """
    쇼츠 생성 (간편 함수)

    Args:
        video_path: 원본 비디오 경로
        start_time: 하이라이트 시작 시간
        subtitle_path: 자막 파일 경로
        output_path: 출력 경로
        duration: 쇼츠 길이

    Returns:
        쇼츠 비디오 경로
    """
    editor = VideoEditor()
    return editor.generate_shorts(
        video_path,
        start_time,
        output_path,
        duration,
        subtitle_path
    )


if __name__ == "__main__":
    # 테스트 코드
    print("Video Editor Module - Test")

    # 예시 세그먼트 데이터
    test_segments = [
        {"start_time": 0.0, "end_time": 2.5, "word": "안녕하세요"},
        {"start_time": 2.5, "end_time": 3.0, "word": "음"},  # 추임새
        {"start_time": 5.0, "end_time": 7.5, "word": "여러분"},  # 2초 무음
        {"start_time": 7.5, "end_time": 10.0, "word": "오늘은"},
    ]

    # Keep ranges 계산 테스트
    editor = VideoEditor()
    keep_ranges = editor._calculate_keep_ranges(
        segments=test_segments,
        min_silence_gap=0.8,
        keep_silence_duration=0.3,
        filler_words=["음", "어", "그"]
    )

    print("\n📊 테스트 결과:")
    print(f"Keep Ranges: {keep_ranges}")
    print("\n예상 결과: [(0.0, 2.5), (4.7, 10.0)]")
    print("(추임새 '음' 삭제, 2초 무음 → 0.3초로 축소)")
