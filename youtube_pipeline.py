"""
YouTube 통합 파이프라인
YouTube URL → STT → Translation → Firestore

유튜브 링크 하나만 주면 번역된 자막까지 자동 생성

주요 기능:
1. YouTube 다운로드 (yt-dlp)
   - 기존 자막 확인 (있으면 STT 스킵)
   - 없으면 오디오만 다운로드
2. STT (Whisper API)
3. OCR (Placeholder, 현재 스킵)
4. Translation (TranslationAgent)
5. Firestore 저장
"""

import os
import tempfile
import subprocess
import asyncio
import json
import uuid
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()  # .env 파일 로드
except ImportError:
    print("[INFO] python-dotenv not installed. Using system environment variables.")

try:
    from openai import OpenAI
    from google.cloud import firestore
    from translation_agent import TranslationAgent
except ImportError as e:
    print(f"[WARN] Missing dependencies: {str(e)}")
    print("Install: pip install openai google-cloud-firestore yt-dlp")


class YouTubePipeline:
    """YouTube 비디오 처리 통합 파이프라인"""

    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        firestore_client: Optional[firestore.Client] = None,
        temp_dir: Optional[str] = None
    ):
        """
        Args:
            openai_api_key: OpenAI API Key
            firestore_client: Firestore Client
            temp_dir: 임시 파일 저장 디렉토리
        """
        self.openai_api_key = openai_api_key or os.environ.get("OPENAI_API_KEY")
        if not self.openai_api_key:
            raise ValueError("OPENAI_API_KEY가 필요합니다.")

        self.openai_client = OpenAI(api_key=self.openai_api_key)
        self.translation_agent = TranslationAgent(api_key=self.openai_api_key)
        self.db = firestore_client or firestore.Client()
        self.temp_dir = temp_dir or tempfile.gettempdir()

        print("[OK] YouTubePipeline initialized")

    async def process_youtube_url(
        self,
        url: str,
        target_languages: List[str] = None,
        source_language: str = "ko",
        enable_ocr: bool = False,
        project_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        YouTube URL 통합 처리

        Args:
            url: YouTube URL
            target_languages: 번역 타겟 언어 리스트 (기본값: ["en"])
            source_language: 원본 언어 (기본값: "ko")
            enable_ocr: OCR 활성화 여부 (기본값: False, MVP 단계에서는 스킵)
            project_id: Firestore 프로젝트 ID (None이면 자동 생성)

        Returns:
            {
                "project_id": "uuid",
                "status": "completed",
                "source_url": "...",
                "video_info": {...},
                "original_transcript": [...],
                "translations": {...}
            }
        """
        if target_languages is None:
            target_languages = ["en"]

        project_id = project_id or str(uuid.uuid4())

        print("\n" + "="*80)
        print(f"🎬 YouTube 통합 파이프라인 시작")
        print(f"   Project ID: {project_id}")
        print(f"   URL: {url}")
        print(f"   타겟 언어: {', '.join(target_languages)}")
        print("="*80 + "\n")

        try:
            # 1. YouTube 다운로드 및 검사
            print("=" * 60)
            print("[1/5] YouTube 다운로드 및 검사")
            print("=" * 60)
            video_info, subtitle_path, audio_path = await self._download_youtube(
                url, source_language
            )

            # 2. STT 실행 (자막이 없는 경우만)
            print("\n" + "=" * 60)
            print("[2/5] STT 실행")
            print("=" * 60)
            korean_transcript = await self._process_stt(
                subtitle_path, audio_path, source_language
            )

            # 3. OCR 실행 (선택적, 현재는 스킵)
            print("\n" + "=" * 60)
            print("[3/5] OCR 실행 (현재 스킵)")
            print("=" * 60)
            if enable_ocr:
                print("⚠️ OCR 기능은 현재 개발 중입니다.")
                # ocr_text = await self._process_ocr(video_path)
            else:
                print("ℹ️ OCR 비활성화 (enable_ocr=False)")

            # 4. AI 번역
            print("\n" + "=" * 60)
            print("[4/5] AI 번역")
            print("=" * 60)
            translation_result = await self._process_translation(
                korean_transcript,
                video_info,
                target_languages,
                source_language
            )

            # 5. Firestore 저장
            print("\n" + "=" * 60)
            print("[5/5] Firestore 저장")
            print("=" * 60)
            await self._save_to_firestore(
                project_id,
                url,
                video_info,
                korean_transcript,
                translation_result
            )

            # 임시 파일 정리
            self._cleanup_temp_files([subtitle_path, audio_path])

            print("\n" + "="*80)
            print("✅ 파이프라인 완료!")
            print(f"   Project ID: {project_id}")
            print(f"   원본 자막: {len(korean_transcript)} 줄")
            print(f"   번역 언어: {len(translation_result['translations'])}개")
            print("="*80 + "\n")

            return {
                "project_id": project_id,
                "status": "completed",
                "source_url": url,
                "video_info": video_info,
                "original_transcript": korean_transcript,
                "translations": translation_result["translations"],
                "context": translation_result.get("context", {}),
            }

        except Exception as e:
            error_msg = f"파이프라인 실패: {str(e)}"
            print(f"\n❌ {error_msg}")

            # 실패한 정보도 Firestore에 저장
            try:
                await self._save_error_to_firestore(project_id, url, error_msg)
            except:
                pass

            raise

    async def _download_youtube(
        self, url: str, source_language: str
    ) -> Tuple[Dict[str, Any], Optional[str], Optional[str]]:
        """
        YouTube 비디오 다운로드 및 자막 확인

        Returns:
            (video_info, subtitle_path, audio_path)
            - subtitle_path: 기존 자막이 있으면 경로, 없으면 None
            - audio_path: 오디오 파일 경로 (자막이 없을 때만)
        """
        print(f"📥 YouTube 정보 가져오는 중...")

        # 1. 비디오 정보 가져오기
        video_info = await self._get_youtube_info(url)
        print(f"   제목: {video_info['title']}")
        print(f"   길이: {video_info['duration']}초")

        # 2. 자막 확인
        subtitle_path = await self._check_and_download_subtitle(url, source_language)

        if subtitle_path:
            print(f"✅ 기존 {source_language} 자막 발견! STT 생략")
            return video_info, subtitle_path, None
        else:
            print(f"ℹ️ 기존 자막 없음. 오디오 다운로드 시작...")
            audio_path = await self._download_audio(url)
            print(f"✅ 오디오 다운로드 완료: {audio_path}")
            return video_info, None, audio_path

    async def _get_youtube_info(self, url: str) -> Dict[str, Any]:
        """YouTube 비디오 정보 가져오기"""
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-playlist",
            url
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise Exception(f"yt-dlp 정보 조회 실패: {stderr.decode()}")

        info = json.loads(stdout.decode())

        return {
            "title": info.get("title", "Unknown"),
            "description": info.get("description", ""),
            "duration": info.get("duration", 0),
            "uploader": info.get("uploader", "Unknown"),
            "upload_date": info.get("upload_date", ""),
            "thumbnail": info.get("thumbnail", ""),
            "video_id": info.get("id", ""),
        }

    async def _check_and_download_subtitle(
        self, url: str, lang: str
    ) -> Optional[str]:
        """
        기존 자막 확인 및 다운로드

        Returns:
            자막 파일 경로 (없으면 None)
        """
        temp_path = os.path.join(self.temp_dir, f"subtitle_{uuid.uuid4()}")

        cmd = [
            "yt-dlp",
            "--write-sub",
            "--write-auto-sub",  # 자동 생성 자막도 포함
            "--sub-lang", lang,
            "--skip-download",  # 비디오는 다운로드하지 않음
            "--output", temp_path,
            url
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            await process.communicate()

            # .vtt 또는 .srt 파일 찾기
            subtitle_file = None
            for ext in ['.vtt', f'.{lang}.vtt', '.srt', f'.{lang}.srt']:
                potential_file = temp_path + ext
                if os.path.exists(potential_file):
                    subtitle_file = potential_file
                    break

            return subtitle_file

        except Exception as e:
            print(f"   ⚠️ 자막 확인 실패: {str(e)}")
            return None

    async def _download_audio(self, url: str) -> str:
        """오디오만 다운로드 (가볍고 빠르게)"""
        output_path = os.path.join(self.temp_dir, f"audio_{uuid.uuid4()}.mp3")

        cmd = [
            "yt-dlp",
            "-f", "bestaudio",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "5",  # 0 (최고) ~ 9 (최저), 5는 적당한 품질
            "--output", output_path,
            url
        ]

        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0:
            raise Exception(f"오디오 다운로드 실패: {stderr.decode()}")

        return output_path

    async def _process_stt(
        self, subtitle_path: Optional[str], audio_path: Optional[str], language: str
    ) -> List[Dict[str, Any]]:
        """
        STT 처리

        Args:
            subtitle_path: 기존 자막 경로 (있으면 이걸 사용)
            audio_path: 오디오 파일 경로
            language: 언어 코드

        Returns:
            [{"start": 0.0, "end": 2.5, "text": "안녕하세요"}, ...]
        """
        # 1. 기존 자막이 있으면 파싱
        if subtitle_path:
            print(f"📄 기존 자막 파싱 중... ({subtitle_path})")
            return await self._parse_subtitle_file(subtitle_path)

        # 2. 기존 자막이 없으면 Whisper API 호출
        if not audio_path:
            raise ValueError("자막과 오디오 모두 없습니다.")

        print(f"🎙️ Whisper API로 음성 인식 중... (언어: {language})")

        # FFmpeg 오디오 전처리 (선택적)
        # enhanced_audio = await self._enhance_audio_ffmpeg(audio_path)

        # Whisper API 호출 (동기 함수를 비동기로 실행)
        transcript = await asyncio.to_thread(
            self._call_whisper_api, audio_path, language
        )

        print(f"✅ STT 완료: {len(transcript)} 줄")
        return transcript

    def _call_whisper_api(self, audio_path: str, language: str) -> List[Dict[str, Any]]:
        """Whisper API 호출 (동기 함수)"""
        with open(audio_path, 'rb') as audio_file:
            transcription = self.openai_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-1",
                language=language,
                temperature=0,
                response_format="verbose_json",  # 타임스탬프 포함
            )

        # 결과 파싱
        transcript = []
        if hasattr(transcription, 'segments') and transcription.segments:
            for segment in transcription.segments:
                transcript.append({
                    "start": segment.get("start", 0),
                    "end": segment.get("end", 0),
                    "text": segment.get("text", "").strip(),
                })
        elif hasattr(transcription, 'words') and transcription.words:
            for word in transcription.words:
                transcript.append({
                    "start": word.start,
                    "end": word.end,
                    "text": word.word.strip(),
                })
        else:
            # Fallback: 전체 텍스트를 하나의 자막으로
            transcript.append({
                "start": 0,
                "end": 0,
                "text": transcription.text.strip(),
            })

        return transcript

    async def _parse_subtitle_file(self, subtitle_path: str) -> List[Dict[str, Any]]:
        """VTT 또는 SRT 자막 파일 파싱"""
        # 간단한 VTT/SRT 파서
        # 실제 프로덕션에서는 webvtt-py 또는 pysrt 사용 권장

        def parse_vtt_timestamp(timestamp: str) -> float:
            """00:00:02.500 → 2.5"""
            parts = timestamp.strip().split(':')
            hours = float(parts[0]) if len(parts) > 2 else 0
            minutes = float(parts[-2]) if len(parts) > 1 else 0
            seconds = float(parts[-1].replace(',', '.'))
            return hours * 3600 + minutes * 60 + seconds

        transcript = []

        with open(subtitle_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        current_start = None
        current_end = None
        current_text = []

        for line in lines:
            line = line.strip()

            # 타임스탬프 라인
            if '-->' in line:
                if current_start and current_text:
                    transcript.append({
                        "start": current_start,
                        "end": current_end,
                        "text": " ".join(current_text).strip(),
                    })
                    current_text = []

                parts = line.split('-->')
                current_start = parse_vtt_timestamp(parts[0])
                current_end = parse_vtt_timestamp(parts[1]) if len(parts) > 1 else current_start

            # 텍스트 라인
            elif line and not line.isdigit() and line != 'WEBVTT':
                current_text.append(line)

        # 마지막 자막 추가
        if current_start and current_text:
            transcript.append({
                "start": current_start,
                "end": current_end,
                "text": " ".join(current_text).strip(),
            })

        return transcript

    async def _process_translation(
        self,
        transcript: List[Dict[str, Any]],
        video_info: Dict[str, Any],
        target_languages: List[str],
        source_language: str
    ) -> Dict[str, Any]:
        """번역 처리 (TranslationAgent 사용)"""
        # 전체 텍스트 추출
        full_text = " ".join([t["text"] for t in transcript])

        # TranslationAgent 호출 (동기 함수를 비동기로 실행)
        result = await asyncio.to_thread(
            self.translation_agent.translate_project,
            full_transcript=full_text,
            captions=transcript,
            title=video_info["title"],
            description=video_info["description"][:500],  # 설명은 500자로 제한
            target_languages=target_languages,
            source_language=source_language
        )

        return result

    async def _save_to_firestore(
        self,
        project_id: str,
        url: str,
        video_info: Dict[str, Any],
        transcript: List[Dict[str, Any]],
        translation_result: Dict[str, Any]
    ):
        """Firestore에 결과 저장"""
        print(f"💾 Firestore에 저장 중... (Project ID: {project_id})")

        # Firestore 형식으로 변환
        firestore_transcript = [
            {
                "start_time": t["start"],
                "end_time": t["end"],
                "word": t["text"],
            }
            for t in transcript
        ]

        # 번역 데이터 변환
        translations_data = {}
        for lang, trans in translation_result["translations"].items():
            translated_words = [
                {
                    "start_time": c.get("start", 0),
                    "end_time": c.get("end", 0),
                    "word": c.get("text", ""),
                }
                for c in trans["captions"]
            ]

            translations_data[lang] = {
                "title": trans["title"],
                "description": trans["description"],
                "captions": translated_words,
                "full_text": " ".join([c.get("text", "") for c in trans["captions"]]),
            }

        # Firestore 저장
        doc_ref = self.db.collection("projects").document(project_id)
        await asyncio.to_thread(
            doc_ref.set,
            {
                "id": project_id,
                "source": "youtube",
                "source_url": url,
                "video_info": video_info,
                "status": "completed",
                "language": "ko",  # 원본 언어
                "transcript": firestore_transcript,
                "full_text": " ".join([t["text"] for t in transcript]),
                "translations": translations_data,
                "context": translation_result.get("context", {}),
                "translation_status": "completed",
                "created_at": firestore.SERVER_TIMESTAMP,
                "updated_at": firestore.SERVER_TIMESTAMP,
            }
        )

        print(f"✅ Firestore 저장 완료")

    async def _save_error_to_firestore(
        self, project_id: str, url: str, error_msg: str
    ):
        """에러 정보 저장"""
        doc_ref = self.db.collection("projects").document(project_id)
        await asyncio.to_thread(
            doc_ref.set,
            {
                "id": project_id,
                "source": "youtube",
                "source_url": url,
                "status": "failed",
                "error_message": error_msg,
                "created_at": firestore.SERVER_TIMESTAMP,
            }
        )

    def _cleanup_temp_files(self, file_paths: List[Optional[str]]):
        """임시 파일 정리"""
        for path in file_paths:
            if path and os.path.exists(path):
                try:
                    os.remove(path)
                    print(f"🧹 임시 파일 삭제: {path}")
                except Exception as e:
                    print(f"⚠️ 파일 삭제 실패 ({path}): {str(e)}")


# 사용 예시
async def main():
    """테스트 실행"""
    pipeline = YouTubePipeline()

    result = await pipeline.process_youtube_url(
        url="https://www.youtube.com/watch?v=VIDEO_ID",
        target_languages=["en", "ja"],
        source_language="ko",
        enable_ocr=False
    )

    print("\n=== 최종 결과 ===")
    print(f"Project ID: {result['project_id']}")
    print(f"원본 자막: {len(result['original_transcript'])} 줄")
    print(f"번역 언어: {list(result['translations'].keys())}")


if __name__ == "__main__":
    asyncio.run(main())
