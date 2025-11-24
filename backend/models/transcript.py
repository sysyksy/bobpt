"""통일된 트랜스크립트 모델"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, validator


class TranscriptSegment(BaseModel):
    """통일된 트랜스크립트 세그먼트 모델"""

    start: float = Field(..., description="시작 시간 (초)")
    end: float = Field(..., description="종료 시간 (초)")
    text: str = Field(..., description="텍스트 내용")

    @validator('start', 'end')
    def validate_time(cls, v):
        """시간 값 검증"""
        if v < 0:
            raise ValueError("Time must be non-negative")
        return v

    @validator('end')
    def validate_end_after_start(cls, v, values):
        """종료 시간이 시작 시간보다 뒤인지 검증"""
        if 'start' in values and v < values['start']:
            raise ValueError("End time must be after start time")
        return v

    @classmethod
    def from_firestore(cls, data: Dict[str, Any]) -> "TranscriptSegment":
        """
        Firestore 포맷에서 변환

        Args:
            data: Firestore 문서 데이터

        Returns:
            TranscriptSegment 인스턴스

        Raises:
            ValueError: 유효하지 않은 형식일 때
        """
        # 새 형식 (start, end, text)
        if "start" in data and "end" in data:
            return cls(
                start=float(data["start"]),
                end=float(data["end"]),
                text=data.get("text", data.get("word", ""))
            )
        # 구 형식 (start_time, end_time, word)
        elif "start_time" in data:
            return cls(
                start=float(data["start_time"]),
                end=float(data["end_time"]),
                text=data.get("word", data.get("text", ""))
            )
        else:
            raise ValueError(f"Invalid transcript format: {data}")

    def to_firestore(self) -> Dict[str, Any]:
        """
        Firestore 저장 포맷으로 변환

        Returns:
            Firestore 저장용 딕셔너리
        """
        return {
            "start_time": self.start,
            "end_time": self.end,
            "word": self.text
        }

    def to_srt_format(self, index: int) -> str:
        """
        SRT 자막 형식으로 변환

        Args:
            index: 자막 번호

        Returns:
            SRT 형식 문자열
        """
        start_time = self._format_srt_time(self.start)
        end_time = self._format_srt_time(self.end)
        return f"{index}\n{start_time} --> {end_time}\n{self.text}\n"

    def to_vtt_format(self) -> str:
        """
        WebVTT 자막 형식으로 변환

        Returns:
            VTT 형식 문자열
        """
        start_time = self._format_vtt_time(self.start)
        end_time = self._format_vtt_time(self.end)
        return f"{start_time} --> {end_time}\n{self.text}\n"

    @staticmethod
    def _format_srt_time(seconds: float) -> str:
        """SRT 시간 형식 (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    @staticmethod
    def _format_vtt_time(seconds: float) -> str:
        """VTT 시간 형식 (HH:MM:SS.mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


class Transcript(BaseModel):
    """트랜스크립트 컬렉션"""

    segments: List[TranscriptSegment] = Field(default_factory=list)

    @classmethod
    def from_firestore(cls, data: List[Dict[str, Any]]) -> "Transcript":
        """
        Firestore 리스트에서 변환

        Args:
            data: Firestore 트랜스크립트 리스트

        Returns:
            Transcript 인스턴스
        """
        segments = [TranscriptSegment.from_firestore(item) for item in data]
        return cls(segments=segments)

    def to_firestore(self) -> List[Dict[str, Any]]:
        """Firestore 저장용 리스트로 변환"""
        return [segment.to_firestore() for segment in self.segments]

    def to_text(self, separator: str = " ") -> str:
        """
        전체 텍스트 추출

        Args:
            separator: 세그먼트 구분자

        Returns:
            결합된 텍스트
        """
        return separator.join(segment.text for segment in self.segments)

    def to_srt(self) -> str:
        """SRT 자막 파일 형식으로 변환"""
        return "\n".join(
            segment.to_srt_format(i + 1)
            for i, segment in enumerate(self.segments)
        )

    def to_vtt(self) -> str:
        """WebVTT 자막 파일 형식으로 변환"""
        vtt_content = "WEBVTT\n\n"
        vtt_content += "\n".join(
            segment.to_vtt_format()
            for segment in self.segments
        )
        return vtt_content

    def get_duration(self) -> float:
        """전체 재생 시간 계산"""
        if not self.segments:
            return 0.0
        return max(segment.end for segment in self.segments)

    def filter_by_time(self, start: float, end: float) -> "Transcript":
        """
        시간 범위로 필터링

        Args:
            start: 시작 시간
            end: 종료 시간

        Returns:
            필터링된 Transcript
        """
        filtered_segments = [
            segment for segment in self.segments
            if segment.start >= start and segment.end <= end
        ]
        return Transcript(segments=filtered_segments)
