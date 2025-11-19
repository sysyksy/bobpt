"""
OCR과 한국어 맞춤법 검사 통합 모듈

기능:
1. YouTube URL에서 비디오 다운로드
2. 비디오 프레임 OCR 분석 (Google Cloud Vision API)
3. 한국어 맞춤법 검사 (Google Cloud NLP + Naver API)
"""

import os
import json
import asyncio
import subprocess
import tempfile
from pathlib import Path
from typing import List, Dict, Optional
from google.cloud import vision
import requests
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# ========== CONFIG ==========
TEMP_VIDEO_DIR = "/tmp/video_uploads"
NAVER_SPELL_CHECK_URL = "https://openapi.naver.com/v1/LanguageCheck"

# 임시 디렉토리 생성
Path(TEMP_VIDEO_DIR).mkdir(parents=True, exist_ok=True)


class VideoDownloader:
    """YouTube 및 로컬 파일 비디오 처리"""

    @staticmethod
    async def download_youtube(url: str) -> str:
        """YouTube URL에서 비디오 다운로드"""
        try:
            output_path = os.path.join(TEMP_VIDEO_DIR, "%(title)s.mp4")

            process = await asyncio.create_subprocess_exec(
                "yt-dlp",
                "-f", "best[ext=mp4]",
                "-o", output_path,
                url,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                raise Exception(f"YouTube 다운로드 실패: {stderr.decode()}")

            # 다운로드된 파일 찾기
            files = list(Path(TEMP_VIDEO_DIR).glob("*.mp4"))
            if not files:
                raise Exception("다운로드된 파일을 찾을 수 없습니다")

            return str(files[-1])

        except Exception as e:
            logger.error(f"YouTube 다운로드 오류: {e}")
            raise


class OCRProcessor:
    """Google Cloud Vision을 사용한 OCR 처리"""

    def __init__(self):
        self.client = vision.ImageAnnotatorClient()

    @staticmethod
    def extract_frames(video_path: str, interval_seconds: int = 2) -> List[str]:
        """비디오에서 프레임 추출"""
        temp_dir = tempfile.mkdtemp()
        frame_pattern = os.path.join(temp_dir, "frame_%04d.jpg")

        # FFmpeg로 프레임 추출
        fps = 1 / interval_seconds
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-vf", f"fps={fps}",
            "-q:v", "2",
            frame_pattern,
        ]

        try:
            subprocess.run(cmd, check=True, capture_output=True)
            frames = sorted(Path(temp_dir).glob("frame_*.jpg"))
            return [str(f) for f in frames]
        except subprocess.CalledProcessError as e:
            logger.error(f"프레임 추출 실패: {e}")
            raise

    def ocr_from_file(self, image_path: str) -> str:
        """단일 이미지에서 OCR 수행"""
        with open(image_path, "rb") as image_file:
            content = image_file.read()

        image = vision.Image(content=content)
        response = self.client.document_text_detection(image=image)

        # 감지된 텍스트 추출
        texts = []
        for page in response.full_text_annotation.pages:
            for block in page.blocks:
                for paragraph in block.paragraphs:
                    for word in paragraph.words:
                        word_text = "".join([symbol.text for symbol in word.symbols])
                        texts.append(word_text)

        return " ".join(texts)

    async def process_video(self, video_path: str, interval_seconds: int = 5) -> str:
        """전체 비디오에서 OCR 텍스트 추출"""
        try:
            frames = self.extract_frames(video_path, interval_seconds)

            all_texts = []
            for frame_path in frames:
                try:
                    text = self.ocr_from_file(frame_path)
                    if text.strip():
                        all_texts.append(text)
                except Exception as e:
                    logger.warning(f"프레임 OCR 실패: {e}")
                    continue

            # 임시 파일 정리
            for frame in frames:
                try:
                    os.remove(frame)
                except:
                    pass

            return "\n".join(all_texts)

        except Exception as e:
            logger.error(f"비디오 OCR 처리 오류: {e}")
            raise


class SpellChecker:
    """한국어 맞춤법 검사 (Google NLP + Naver API)"""

    def __init__(self, naver_client_id: Optional[str] = None, naver_secret: Optional[str] = None):
        """
        Args:
            naver_client_id: Naver API 클라이언트 ID
            naver_secret: Naver API 시크릿 키
        """
        self.naver_client_id = naver_client_id or os.getenv("NAVER_CLIENT_ID")
        self.naver_secret = naver_secret or os.getenv("NAVER_CLIENT_SECRET")
        self.vision_client = vision.ImageAnnotatorClient()

    def check_with_naver(self, text: str) -> List[Dict]:
        """Naver API를 사용한 맞춤법 검사"""
        if not self.naver_client_id or not self.naver_secret:
            logger.warning("Naver API 자격증명이 없습니다")
            return []

        try:
            headers = {
                "X-Naver-Client-Id": self.naver_client_id,
                "X-Naver-Client-Secret": self.naver_secret,
            }

            response = requests.post(
                NAVER_SPELL_CHECK_URL,
                headers=headers,
                data={"text": text},
                timeout=10,
            )

            if response.status_code == 200:
                result = response.json()
                corrections = []

                for item in result.get("result", {}).get("grammaticalErrors", []):
                    corrections.append({
                        "type": "grammatical",
                        "original": text[item["start"]:item["end"]],
                        "suggestions": item.get("suggestions", []),
                        "start": item["start"],
                        "end": item["end"],
                    })

                return corrections
            else:
                logger.error(f"Naver API 오류: {response.status_code}")
                return []

        except Exception as e:
            logger.error(f"Naver 맞춤법 검사 오류: {e}")
            return []

    def check_with_google_nlp(self, text: str) -> List[Dict]:
        """Google Cloud Natural Language API를 사용한 맞춤법/문법 검사"""
        try:
            from google.cloud import language_v2

            client = language_v2.LanguageServiceClient()

            document = language_v2.Document(
                content=text,
                type_=language_v2.Document.Type.PLAIN_TEXT,
                language_code="ko",
            )

            response = client.analyze_syntax(request={"document": document})

            # 구문 분석 결과 처리
            corrections = []
            for token in response.tokens:
                if token.part_of_speech.tag in [
                    language_v2.PartOfSpeech.Tag.UNKNOWN,
                ]:
                    corrections.append({
                        "type": "syntax",
                        "text": token.text.content,
                        "position": token.text.begin_offset,
                    })

            return corrections

        except Exception as e:
            logger.error(f"Google NLP 분석 오류: {e}")
            return []

    def check_spelling(self, text: str) -> Dict:
        """종합 맞춤법 검사 (Naver + Google)"""
        naver_results = self.check_with_naver(text)
        google_results = self.check_with_google_nlp(text)

        return {
            "original_text": text,
            "naver_corrections": naver_results,
            "google_corrections": google_results,
            "total_issues": len(naver_results) + len(google_results),
            "timestamp": datetime.utcnow().isoformat(),
        }


class OCRSpellCheckPipeline:
    """OCR + 맞춤법 검사 통합 파이프라인"""

    def __init__(self):
        self.ocr_processor = OCRProcessor()
        self.spell_checker = SpellChecker()

    async def process_youtube_video(self, url: str) -> Dict:
        """YouTube 영상 처리"""
        logger.info(f"YouTube 영상 처리 시작: {url}")

        # 1. YouTube 다운로드
        downloader = VideoDownloader()
        video_path = await downloader.download_youtube(url)

        # 2. OCR 처리
        ocr_text = await self.ocr_processor.process_video(video_path, interval_seconds=5)

        # 3. 맞춤법 검사
        spell_check_result = self.spell_checker.check_spelling(ocr_text)

        # 4. 결과 조합
        result = {
            "source": "youtube",
            "url": url,
            "ocr_text": ocr_text,
            "spell_check": spell_check_result,
            "status": "completed",
        }

        # 임시 비디오 파일 정리
        try:
            os.remove(video_path)
        except:
            pass

        return result

    async def process_local_video(self, video_path: str) -> Dict:
        """로컬 비디오 파일 처리"""
        logger.info(f"로컬 비디오 처리 시작: {video_path}")

        # 1. OCR 처리
        ocr_text = await self.ocr_processor.process_video(video_path, interval_seconds=5)

        # 2. 맞춤법 검사
        spell_check_result = self.spell_checker.check_spelling(ocr_text)

        # 3. 결과 조합
        result = {
            "source": "local",
            "file_path": video_path,
            "ocr_text": ocr_text,
            "spell_check": spell_check_result,
            "status": "completed",
        }

        return result


# ========== 글로벌 인스턴스 ==========
pipeline = OCRSpellCheckPipeline()
