"""
Highlight Detector
LLM을 활용한 하이라이트 구간 자동 추출

GPT-4o-mini를 사용하여 트랜스크립트에서 가장 재미있거나 중요한 구간을 찾음
"""

import os
import json
from typing import List, Dict, Any, Optional
from openai import OpenAI


class HighlightDetector:
    """LLM 기반 하이라이트 구간 검출기"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: OpenAI API Key (None이면 환경변수에서 가져옴)
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

        self.client = OpenAI(api_key=self.api_key)
        self.model = "gpt-4o-mini"

    def find_highlights(
        self,
        full_transcript: str,
        segments: List[Dict[str, Any]],
        num_highlights: int = 3,
        highlight_duration: float = 60.0,
        video_genre: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        트랜스크립트에서 하이라이트 구간 추출

        Args:
            full_transcript: 전체 트랜스크립트 텍스트
            segments: 타임스탬프가 포함된 세그먼트 리스트
            num_highlights: 추출할 하이라이트 개수
            highlight_duration: 하이라이트 길이 (초)
            video_genre: 영상 장르 (게임, 브이로그, 교육 등)

        Returns:
            [
                {
                    "start_time": 45.0,
                    "end_time": 105.0,
                    "reason": "보스전 클라이맥스 장면",
                    "score": 9.5,
                    "keywords": ["보스", "승리", "감동"]
                },
                ...
            ]
        """
        print("\n" + "="*60)
        print("🎯 LLM 기반 하이라이트 구간 검출 시작")
        print(f"   트랜스크립트 길이: {len(full_transcript)}자")
        print(f"   세그먼트 수: {len(segments)}개")
        print("="*60)

        # 타임스탬프가 있는 트랜스크립트 생성
        timestamped_transcript = self._create_timestamped_transcript(segments)

        # LLM 프롬프트 구성
        system_prompt = self._build_system_prompt(video_genre)
        user_prompt = self._build_user_prompt(
            timestamped_transcript=timestamped_transcript,
            num_highlights=num_highlights,
            highlight_duration=highlight_duration
        )

        # GPT-4o-mini 호출
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.5,
                max_tokens=2000
            )

            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            highlights = result.get("highlights", [])
            print(f"\n✅ {len(highlights)}개 하이라이트 구간 발견")

            for i, hl in enumerate(highlights, 1):
                print(f"\n   {i}. {hl.get('reason', 'N/A')}")
                print(f"      시간: {hl.get('start_time', 0):.1f}s - {hl.get('end_time', 0):.1f}s")
                print(f"      점수: {hl.get('score', 0)}/10")

            return highlights

        except json.JSONDecodeError as e:
            print(f"⚠️ JSON 파싱 오류: {str(e)}")
            print(f"   응답: {result_text[:200]}...")
            return []
        except Exception as e:
            print(f"❌ 하이라이트 검출 실패: {str(e)}")
            return []

    def _create_timestamped_transcript(
        self,
        segments: List[Dict[str, Any]]
    ) -> str:
        """
        타임스탬프가 포함된 트랜스크립트 생성

        Args:
            segments: 세그먼트 리스트

        Returns:
            "[0.0s] 안녕하세요 [2.5s] 여러분 [5.0s] 오늘은..."
        """
        lines = []
        for seg in segments:
            start = seg.get("start_time", 0)
            word = seg.get("word", "")
            lines.append(f"[{start:.1f}s] {word}")

        return " ".join(lines)

    def _build_system_prompt(self, video_genre: Optional[str]) -> str:
        """
        시스템 프롬프트 구성

        Args:
            video_genre: 영상 장르

        Returns:
            시스템 프롬프트 텍스트
        """
        genre_context = ""
        if video_genre:
            genre_context = f"\n영상 장르: {video_genre}"

        return f"""당신은 영상 편집 전문가입니다. 트랜스크립트를 분석하여 가장 흥미롭고 공유 가치가 높은 구간(하이라이트)을 찾아내는 것이 목표입니다.{genre_context}

하이라이트 선정 기준:
1. **감정적 고조**: 흥분, 웃음, 감동, 긴장감이 높은 순간
2. **정보 가치**: 핵심 정보, 중요한 팁, 놀라운 사실
3. **스토리 완결성**: 시작-중간-결말이 있는 독립적인 에피소드
4. **쇼츠 적합성**: 60초 안에 완결되며, 처음 3초가 시선을 끌 수 있는 구간
5. **바이럴 가능성**: SNS에 공유하고 싶은 명장면, 명대사

반드시 JSON 형식으로만 답변하세요."""

    def _build_user_prompt(
        self,
        timestamped_transcript: str,
        num_highlights: int,
        highlight_duration: float
    ) -> str:
        """
        사용자 프롬프트 구성

        Args:
            timestamped_transcript: 타임스탬프가 있는 트랜스크립트
            num_highlights: 하이라이트 개수
            highlight_duration: 하이라이트 길이

        Returns:
            사용자 프롬프트 텍스트
        """
        return f"""다음 트랜스크립트에서 가장 재미있고 공유 가치가 높은 구간 {num_highlights}개를 찾아주세요.
각 하이라이트는 약 {highlight_duration:.0f}초 길이여야 합니다.

트랜스크립트:
{timestamped_transcript}

JSON 형식으로 답변:
{{
    "highlights": [
        {{
            "start_time": 45.0,
            "end_time": 105.0,
            "reason": "왜 이 구간이 하이라이트인지 설명 (1-2문장)",
            "score": 9.5,
            "keywords": ["키워드1", "키워드2", "키워드3"]
        }}
    ]
}}

주의사항:
- start_time과 end_time은 트랜스크립트의 타임스탬프를 참고하세요
- 하이라이트 구간이 겹치지 않도록 하세요
- score는 1~10 사이의 숫자입니다
- keywords는 이 구간을 대표하는 3~5개의 단어입니다"""

    def find_best_highlight(
        self,
        full_transcript: str,
        segments: List[Dict[str, Any]],
        highlight_duration: float = 60.0,
        video_genre: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        가장 좋은 하이라이트 1개 찾기 (간편 함수)

        Args:
            full_transcript: 전체 트랜스크립트
            segments: 세그먼트 리스트
            highlight_duration: 하이라이트 길이
            video_genre: 영상 장르

        Returns:
            {
                "start_time": 45.0,
                "end_time": 105.0,
                "reason": "...",
                "score": 9.5
            }
        """
        highlights = self.find_highlights(
            full_transcript=full_transcript,
            segments=segments,
            num_highlights=1,
            highlight_duration=highlight_duration,
            video_genre=video_genre
        )

        return highlights[0] if highlights else None


# 편의 함수

def detect_highlights(
    transcript: str,
    segments: List[Dict[str, Any]],
    num_highlights: int = 3
) -> List[Dict[str, Any]]:
    """
    하이라이트 구간 검출 (간편 함수)

    Args:
        transcript: 전체 트랜스크립트
        segments: 세그먼트 리스트
        num_highlights: 하이라이트 개수

    Returns:
        하이라이트 리스트
    """
    detector = HighlightDetector()
    return detector.find_highlights(transcript, segments, num_highlights)


def find_best_60s_clip(
    transcript: str,
    segments: List[Dict[str, Any]]
) -> Optional[Dict[str, Any]]:
    """
    가장 좋은 60초 클립 찾기 (간편 함수)

    Args:
        transcript: 전체 트랜스크립트
        segments: 세그먼트 리스트

    Returns:
        하이라이트 정보 (또는 None)
    """
    detector = HighlightDetector()
    return detector.find_best_highlight(transcript, segments, 60.0)


if __name__ == "__main__":
    # 테스트 코드
    print("Highlight Detector Module - Test")

    test_transcript = """
    안녕하세요 여러분! 오늘은 정말 어려운 게임을 가져왔어요.
    이 보스는 진짜 미쳤어요. 벌써 10번 넘게 죽었습니다.
    자, 이제 다시 도전해볼게요. 준비... 시작!
    와! 피했어요! 완벽한 타이밍이었어요!
    이제 거의 다 왔어요... 마지막 한 방!
    야호! 드디어 이겼어요! 너무 기뻐요!
    """

    test_segments = [
        {"start_time": 0.0, "end_time": 3.0, "word": "안녕하세요 여러분!"},
        {"start_time": 3.0, "end_time": 6.0, "word": "오늘은 정말 어려운 게임을 가져왔어요."},
        {"start_time": 45.0, "end_time": 48.0, "word": "자, 이제 다시 도전해볼게요."},
        {"start_time": 50.0, "end_time": 53.0, "word": "와! 피했어요! 완벽한 타이밍이었어요!"},
        {"start_time": 100.0, "end_time": 103.0, "word": "야호! 드디어 이겼어요!"},
    ]

    print(f"\n트랜스크립트: {test_transcript[:100]}...")
    print(f"세그먼트 수: {len(test_segments)}개")
    print("\n(실제 실행하려면 OPENAI_API_KEY 설정 필요)")
