"""
Translation Agent
초월 번역(Localization) 에이전트 - Subup 스타일

OpenAI GPT-4o-mini를 활용하여 영상의 맥락과 톤앤매너를 살린 번역 제공

주요 기능:
1. Context Extraction: 영상의 장르, 화자 성격, 타겟 시청자 분석
2. Subtitle Localization: 문맥 기반 자막 번역 (타임스탬프 유지)
3. Metadata Translation: SEO 최적화된 제목/설명 번역
"""

import os
import json
from typing import List, Dict, Any, Optional
from openai import OpenAI


class TranslationAgent:
    """문맥 기반 초월 번역 에이전트"""

    def __init__(self, api_key: Optional[str] = None):
        """
        Args:
            api_key: OpenAI API Key (None이면 환경변수에서 가져옴)
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
        if not self.api_key:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")

        self.client = OpenAI(api_key=self.api_key)
        self.model = "gpt-4o-mini"  # 비용 효율적인 모델

    def analyze_context(self, full_transcript: str, source_language: str = "ko") -> Dict[str, str]:
        """
        영상의 맥락 분석 (Context Extraction)

        Args:
            full_transcript: 전체 트랜스크립트 텍스트
            source_language: 원본 언어 코드 (ko, en, ja 등)

        Returns:
            {
                "genre": "게임 리뷰",
                "tone": "캐주얼하고 텐션 높은 톤",
                "target_audience": "20대 게이머",
                "key_themes": "액션 게임, 난이도, 보스전",
                "style_notes": "밈과 게임 용어 사용, 반말 사용"
            }
        """
        print(f"📊 문맥 분석 시작... (길이: {len(full_transcript)} 자)")

        system_prompt = """당신은 영상 콘텐츠 분석 전문가입니다.
주어진 트랜스크립트를 분석하여 다음을 파악하세요:
1. 영상의 장르 (예: 게임 리뷰, 교육, 브이로그, 뉴스 등)
2. 화자의 톤앤매너 (예: 격식있는, 캐주얼한, 유머러스한 등)
3. 주요 타겟 시청자 (예: 20대 게이머, 주부, 학생 등)
4. 핵심 주제 및 키워드
5. 스타일 특징 (예: 밈 사용, 존댓말/반말, 전문 용어 등)

반드시 JSON 형식으로만 답변하세요. 다른 텍스트는 포함하지 마세요."""

        user_prompt = f"""다음 트랜스크립트를 분석하세요:

---
{full_transcript[:3000]}
---

JSON 형식으로 답변하세요:
{{
    "genre": "영상 장르",
    "tone": "화자의 톤앤매너",
    "target_audience": "타겟 시청자",
    "key_themes": "핵심 주제",
    "style_notes": "스타일 특징"
}}"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,  # 일관성 있는 분석
                response_format={"type": "json_object"}  # JSON 모드 강제
            )

            context = json.loads(response.choices[0].message.content)
            print(f"✅ 문맥 분석 완료: {context.get('genre', 'Unknown')}")
            return context

        except json.JSONDecodeError as e:
            print(f"❌ JSON 파싱 오류: {str(e)}")
            # Fallback: 기본 문맥 반환
            return {
                "genre": "일반 영상",
                "tone": "중립적인 톤",
                "target_audience": "일반 시청자",
                "key_themes": "분석 실패",
                "style_notes": "표준 번역 사용"
            }
        except Exception as e:
            print(f"❌ 문맥 분석 실패: {str(e)}")
            raise

    def translate_captions(
        self,
        captions: List[Dict[str, Any]],
        target_language: str,
        context: Optional[Dict[str, str]] = None,
        source_language: str = "ko"
    ) -> List[Dict[str, Any]]:
        """
        자막 번역 (Subtitle Localization)

        Args:
            captions: 원본 자막 리스트 [{"start": 0.0, "end": 2.0, "text": "안녕하세요"}, ...]
            target_language: 타겟 언어 (en, ja, zh, es 등)
            context: 문맥 정보 (analyze_context의 결과)
            source_language: 원본 언어 코드

        Returns:
            번역된 자막 리스트 (타임스탬프 구조 유지)
        """
        if not captions:
            return []

        print(f"🌐 자막 번역 시작... ({len(captions)}개 자막, {source_language} → {target_language})")

        # 언어 이름 매핑
        language_names = {
            "en": "영어 (미국)",
            "ja": "일본어",
            "zh": "중국어 (간체)",
            "es": "스페인어",
            "fr": "프랑스어",
            "de": "독일어",
            "ko": "한국어",
        }

        target_lang_name = language_names.get(target_language, target_language)

        # System Prompt에 문맥 정보 주입
        context_info = ""
        if context:
            context_info = f"""
영상 정보:
- 장르: {context.get('genre', 'Unknown')}
- 톤: {context.get('tone', 'Neutral')}
- 타겟 시청자: {context.get('target_audience', 'General')}
- 핵심 주제: {context.get('key_themes', 'N/A')}
- 스타일: {context.get('style_notes', 'Standard')}

이 정보를 바탕으로 번역하되, 타겟 언어권 시청자에게 자연스럽게 전달될 수 있도록 의역하세요.
"""

        system_prompt = f"""당신은 전문 자막 번역가입니다. 단순 기계번역이 아닌, 영상의 맥락과 톤을 살린 초월 번역(Localization)을 제공하세요.

{context_info}

번역 원칙:
1. 원본의 의미와 뉘앙스를 정확히 전달
2. 타겟 언어권의 문화와 표현 방식에 맞게 의역
3. 화면 자막임을 고려하여 간결하게 (한 줄당 최대 40자)
4. 밈(Meme)이나 속어는 타겟 언어권에 맞는 표현으로 변환
5. 존댓말/반말 톤을 유지
6. 타임스탬프는 절대 변경하지 말 것

반드시 JSON 배열 형식으로만 답변하세요. 다른 텍스트는 포함하지 마세요."""

        # Batch 처리 (한 번에 너무 많으면 나눔)
        batch_size = 50
        translated_captions = []

        for i in range(0, len(captions), batch_size):
            batch = captions[i:i + batch_size]

            user_prompt = f"""다음 자막을 {target_lang_name}로 번역하세요.

원본 자막:
{json.dumps(batch, ensure_ascii=False, indent=2)}

번역된 자막을 동일한 JSON 배열 형식으로 반환하세요. start, end는 절대 변경하지 말고, text만 번역하세요.
"""

            try:
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.5,  # 창의적인 의역
                    response_format={"type": "json_object"}  # JSON 모드
                )

                # JSON 파싱
                result_text = response.choices[0].message.content

                # JSON 추출 (혹시 배열이 아닌 객체로 래핑된 경우 대비)
                try:
                    result = json.loads(result_text)
                    # 배열인지 확인
                    if isinstance(result, list):
                        batch_translated = result
                    elif isinstance(result, dict):
                        # {"captions": [...]} 형식일 경우
                        batch_translated = result.get("captions", result.get("result", []))
                    else:
                        raise ValueError("Unexpected JSON structure")
                except json.JSONDecodeError:
                    print(f"⚠️ JSON 파싱 오류, 원본 유지")
                    batch_translated = batch

                translated_captions.extend(batch_translated)
                print(f"   ✅ {i + len(batch)}/{len(captions)} 자막 번역 완료")

            except Exception as e:
                print(f"❌ 배치 번역 실패 ({i}-{i + len(batch)}): {str(e)}")
                # Fallback: 원본 유지
                translated_captions.extend(batch)

        print(f"✅ 자막 번역 완료: 총 {len(translated_captions)}개")
        return translated_captions

    def translate_metadata(
        self,
        title: str,
        description: str,
        target_language: str,
        context: Optional[Dict[str, str]] = None,
        source_language: str = "ko"
    ) -> Dict[str, str]:
        """
        메타데이터 번역 (SEO Optimization)

        Args:
            title: 원본 제목
            description: 원본 설명
            target_language: 타겟 언어
            context: 문맥 정보
            source_language: 원본 언어

        Returns:
            {
                "title": "Translated Title (CTR 최적화)",
                "description": "Translated Description"
            }
        """
        print(f"📝 메타데이터 번역 시작... ({source_language} → {target_language})")

        language_names = {
            "en": "영어",
            "ja": "일본어",
            "zh": "중국어",
            "es": "스페인어",
        }
        target_lang_name = language_names.get(target_language, target_language)

        context_info = ""
        if context:
            context_info = f"""
영상 정보:
- 장르: {context.get('genre', 'Unknown')}
- 타겟 시청자: {context.get('target_audience', 'General')}
"""

        system_prompt = f"""당신은 YouTube SEO 및 콘텐츠 마케팅 전문가입니다.

{context_info}

번역 원칙:
1. 제목(Title): 타겟 언어권 YouTube 트렌드에 맞춰 **클릭률(CTR)이 높은 스타일**로 번역
   - 감정적 어휘 사용 (예: Amazing, Shocking, Incredible)
   - 숫자 활용 (예: Top 5, #1)
   - 호기심 유발 (예: You Won't Believe...)
   - 최대 60자 이내

2. 설명(Description): 검색 최적화를 고려하여 키워드를 자연스럽게 포함
   - 핵심 내용 요약 (첫 2-3줄)
   - 타임스탬프 챕터 포함 가능
   - 최대 500자

반드시 JSON 형식으로만 답변하세요."""

        user_prompt = f"""다음 메타데이터를 {target_lang_name}로 번역하세요:

제목: {title}
설명: {description}

JSON 형식으로 답변하세요:
{{
    "title": "번역된 제목 (CTR 최적화)",
    "description": "번역된 설명"
}}"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.7,  # 창의적인 제목 생성
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            print(f"✅ 메타데이터 번역 완료")
            print(f"   제목: {result.get('title', 'N/A')}")
            return result

        except Exception as e:
            print(f"❌ 메타데이터 번역 실패: {str(e)}")
            # Fallback
            return {
                "title": title,
                "description": description
            }

    def translate_project(
        self,
        full_transcript: str,
        captions: List[Dict[str, Any]],
        title: str,
        description: str,
        target_languages: List[str],
        source_language: str = "ko"
    ) -> Dict[str, Any]:
        """
        전체 프로젝트 번역 (올인원 메서드)

        Args:
            full_transcript: 전체 트랜스크립트
            captions: 원본 자막 리스트
            title: 원본 제목
            description: 원본 설명
            target_languages: 타겟 언어 리스트 ["en", "ja", "zh"]
            source_language: 원본 언어

        Returns:
            {
                "context": {...},
                "translations": {
                    "en": {"title": "...", "description": "...", "captions": [...]},
                    "ja": {...}
                }
            }
        """
        print(f"\n{'='*60}")
        print(f"🌍 전체 프로젝트 번역 시작")
        print(f"   원본 언어: {source_language}")
        print(f"   타겟 언어: {', '.join(target_languages)}")
        print(f"{'='*60}\n")

        # 1. 문맥 분석
        context = self.analyze_context(full_transcript, source_language)

        # 2. 각 언어별 번역
        translations = {}

        for target_lang in target_languages:
            print(f"\n--- {target_lang.upper()} 번역 시작 ---")

            # 자막 번역
            translated_captions = self.translate_captions(
                captions=captions,
                target_language=target_lang,
                context=context,
                source_language=source_language
            )

            # 메타데이터 번역
            translated_metadata = self.translate_metadata(
                title=title,
                description=description,
                target_language=target_lang,
                context=context,
                source_language=source_language
            )

            translations[target_lang] = {
                "title": translated_metadata.get("title", title),
                "description": translated_metadata.get("description", description),
                "captions": translated_captions
            }

            print(f"--- {target_lang.upper()} 번역 완료 ---\n")

        print(f"{'='*60}")
        print(f"✅ 전체 프로젝트 번역 완료!")
        print(f"{'='*60}\n")

        return {
            "context": context,
            "translations": translations
        }


# 사용 예시
if __name__ == "__main__":
    # 테스트 데이터
    test_transcript = """
    안녕하세요 여러분! 오늘은 정말 재미있는 게임을 가져왔어요.
    이 게임은 난이도가 정말 높은데, 보스전이 진짜 미쳤습니다.
    저도 10번 넘게 죽었어요 ㅋㅋㅋ
    그래도 결국 클리어했으니까 여러분도 한번 도전해보세요!
    """

    test_captions = [
        {"start": 0.0, "end": 2.5, "text": "안녕하세요 여러분!"},
        {"start": 2.5, "end": 5.0, "text": "오늘은 정말 재미있는 게임을 가져왔어요."},
        {"start": 5.0, "end": 8.0, "text": "이 게임은 난이도가 정말 높은데"},
        {"start": 8.0, "end": 10.5, "text": "보스전이 진짜 미쳤습니다."},
    ]

    # TranslationAgent 초기화
    agent = TranslationAgent()

    # 전체 프로젝트 번역
    result = agent.translate_project(
        full_transcript=test_transcript,
        captions=test_captions,
        title="[게임 리뷰] 역대급 난이도의 액션 게임!",
        description="이 게임은 정말 어려웠습니다. 10번 넘게 죽었지만 결국 클리어했어요!",
        target_languages=["en", "ja"],
        source_language="ko"
    )

    print("\n=== 결과 ===")
    print(json.dumps(result, ensure_ascii=False, indent=2))
