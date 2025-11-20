"""
Auto Chapters Generation Module
Uses GPT-4o-mini to generate YouTube-style chapters from transcript
"""

import os
import json
import logging
from typing import List, Dict, Optional
from openai import OpenAI

logger = logging.getLogger(__name__)

# OpenAI 클라이언트 초기화
client = None

def get_openai_client():
    """OpenAI 클라이언트 초기화 (싱글톤 패턴)"""
    global client
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OPENAI_API_KEY environment variable not set")
            return None
        client = OpenAI(api_key=api_key)
    return client


def format_timestamp(seconds: float) -> str:
    """
    초 단위 시간을 YouTube 챕터 형식(MM:SS or HH:MM:SS)으로 변환

    Args:
        seconds: 시간 (초)

    Returns:
        포맷된 시간 문자열 (예: "02:15" 또는 "1:02:15")
    """
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)

    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def generate_youtube_chapters(
    transcript_segments: List[Dict],
    target_chapters: int = 6,
    model: str = "gpt-4o-mini"
) -> Optional[str]:
    """
    자막 데이터로부터 YouTube 챕터 자동 생성

    Args:
        transcript_segments: 자막 세그먼트 리스트
            [{"start": 0.0, "end": 2.5, "text": "..."}, ...]
        target_chapters: 생성할 챕터 수 (기본 6개, 범위 5-8개)
        model: 사용할 OpenAI 모델 (기본 gpt-4o-mini)

    Returns:
        YouTube 챕터 문자열 (예: "00:00 Intro\\n02:15 Main Topic\\n...")
        실패 시 None 반환
    """
    try:
        openai_client = get_openai_client()
        if not openai_client:
            logger.error("OpenAI client not available")
            return None

        # 전체 자막 텍스트 생성
        full_transcript = []
        for segment in transcript_segments:
            timestamp = format_timestamp(segment.get("start", 0))
            text = segment.get("text", "")
            full_transcript.append(f"[{timestamp}] {text}")

        transcript_text = "\n".join(full_transcript)

        # 너무 긴 자막은 잘라내기 (GPT-4o-mini 토큰 제한 고려)
        # 약 10000 글자까지만 사용 (한글 기준)
        if len(transcript_text) > 10000:
            logger.warning(f"Transcript too long ({len(transcript_text)} chars), truncating to 10000")
            transcript_text = transcript_text[:10000] + "\\n... (truncated)"

        # GPT-4o-mini에게 챕터 생성 요청
        system_prompt = """You are a YouTube video chapter generator.
Analyze the transcript and identify 5-8 key topic changes or sections.
Generate chapter markers with timestamps in the format:

00:00 Chapter Title
02:15 Another Chapter Title
10:30 Final Chapter

Rules:
1. Use concise, descriptive chapter titles (3-5 words)
2. Ensure chapters are evenly distributed throughout the video
3. First chapter MUST start at 00:00
4. Identify clear topic transitions
5. Use Korean for titles if transcript is in Korean
6. Output ONLY the chapter markers, nothing else"""

        user_prompt = f"""Here is the video transcript with timestamps:

{transcript_text}

Generate {target_chapters} YouTube chapter markers for this video."""

        logger.info(f"Requesting chapter generation from {model}...")

        response = openai_client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,  # Lower temperature for consistent output
            max_tokens=500,
        )

        chapters = response.choices[0].message.content.strip()

        logger.info(f"Generated chapters:\\n{chapters}")

        # 기본 검증: 첫 챕터가 00:00으로 시작하는지 확인
        if not chapters.startswith("00:00") and not chapters.startswith("0:00"):
            logger.warning("Generated chapters don't start with 00:00, adding intro")
            chapters = "00:00 Intro\\n" + chapters

        return chapters

    except Exception as e:
        logger.error(f"Chapter generation error: {e}")
        return None


def generate_chapters_from_text(full_text: str, duration_seconds: float) -> Optional[str]:
    """
    전체 텍스트만 있을 때 (타임스탬프 없음) 챕터 생성

    Args:
        full_text: 전체 자막 텍스트
        duration_seconds: 영상 총 길이 (초)

    Returns:
        YouTube 챕터 문자열
    """
    try:
        openai_client = get_openai_client()
        if not openai_client:
            return None

        # 텍스트를 6등분하여 대략적인 챕터 생성
        system_prompt = """You are a YouTube video chapter generator.
Analyze the text and generate 6 chapter titles that represent the main topics.
Also estimate timestamps assuming the content is evenly distributed.

Output format:
00:00 First Topic
02:30 Second Topic
...

Use Korean for titles if text is in Korean."""

        user_prompt = f"""Video duration: {duration_seconds} seconds
Full transcript:

{full_text[:5000]}

Generate 6 chapter markers with estimated timestamps."""

        response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=500,
        )

        chapters = response.choices[0].message.content.strip()
        logger.info(f"Generated chapters from text:\\n{chapters}")

        return chapters

    except Exception as e:
        logger.error(f"Chapter generation from text error: {e}")
        return None


if __name__ == "__main__":
    # Test
    logging.basicConfig(level=logging.INFO)

    test_segments = [
        {"start": 0.0, "end": 5.0, "text": "안녕하세요 오늘은 파이썬 기초에 대해 알아보겠습니다"},
        {"start": 5.0, "end": 60.0, "text": "먼저 변수와 데이터 타입부터 시작하죠"},
        {"start": 60.0, "end": 120.0, "text": "다음으로 조건문과 반복문을 배워봅시다"},
        {"start": 120.0, "end": 180.0, "text": "함수는 코드를 재사용하는 중요한 개념입니다"},
        {"start": 180.0, "end": 240.0, "text": "마지막으로 클래스와 객체지향에 대해 알아보겠습니다"},
        {"start": 240.0, "end": 300.0, "text": "오늘 배운 내용을 정리하면서 마치겠습니다"},
    ]

    chapters = generate_youtube_chapters(test_segments, target_chapters=6)
    print(f"\\nGenerated Chapters:\\n{chapters}")
