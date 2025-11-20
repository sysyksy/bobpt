"""
AI Thumbnail Generator Module
Extracts best frames from video and generates catchy text overlays using GPT-4o-mini
"""

import os
import cv2
import numpy as np
from typing import List, Dict, Tuple, Optional
from pathlib import Path
import tempfile
import logging
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter
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


class FrameAnalyzer:
    """비디오 프레임 분석 및 베스트 프레임 추출"""

    def __init__(self):
        self.blur_threshold = 100  # Laplacian variance threshold
        self.face_cascade = None
        self._load_face_detector()

    def _load_face_detector(self):
        """Haar Cascade 얼굴 감지기 로드"""
        try:
            cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
            self.face_cascade = cv2.CascadeClassifier(cascade_path)
            logger.info("Face detector loaded successfully")
        except Exception as e:
            logger.warning(f"Failed to load face detector: {e}")
            self.face_cascade = None

    def calculate_blur(self, image: np.ndarray) -> float:
        """
        이미지 블러 정도 계산 (Laplacian Variance)

        Args:
            image: OpenCV 이미지 (BGR)

        Returns:
            블러 점수 (높을수록 선명함)
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
        return laplacian_var

    def detect_faces(self, image: np.ndarray) -> List[Tuple[int, int, int, int]]:
        """
        이미지에서 얼굴 감지

        Args:
            image: OpenCV 이미지 (BGR)

        Returns:
            얼굴 영역 리스트 [(x, y, w, h), ...]
        """
        if self.face_cascade is None:
            return []

        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(30, 30)
        )
        return faces.tolist() if len(faces) > 0 else []

    def calculate_frame_score(self, image: np.ndarray) -> Dict:
        """
        프레임 점수 계산 (블러 + 얼굴 감지)

        Args:
            image: OpenCV 이미지 (BGR)

        Returns:
            {
                "blur_score": float,
                "face_count": int,
                "face_size": float,  # 얼굴 영역 비율 (0~1)
                "total_score": float
            }
        """
        # 블러 점수
        blur_score = self.calculate_blur(image)

        # 얼굴 감지
        faces = self.detect_faces(image)
        face_count = len(faces)

        # 얼굴 크기 비율 계산
        face_size = 0.0
        if face_count > 0:
            image_area = image.shape[0] * image.shape[1]
            total_face_area = sum(w * h for (x, y, w, h) in faces)
            face_size = total_face_area / image_area

        # 총점 계산
        # - 블러 점수: 0~1000 범위로 정규화
        # - 얼굴 크기: 0~1 (큰 얼굴일수록 높은 점수)
        # - 얼굴 개수: 1~2개가 이상적
        normalized_blur = min(blur_score / 500, 1.0)  # 500 이상이면 1.0
        face_bonus = face_size * 2.0  # 얼굴이 화면의 50%면 1.0
        face_count_bonus = 1.0 if face_count == 1 else (0.8 if face_count == 2 else 0.3)

        total_score = (
            normalized_blur * 0.5 +  # 블러 50%
            face_bonus * 0.3 +        # 얼굴 크기 30%
            face_count_bonus * 0.2    # 얼굴 개수 20%
        )

        return {
            "blur_score": blur_score,
            "face_count": face_count,
            "face_size": face_size,
            "total_score": total_score
        }

    def extract_best_frames(
        self,
        video_path: str,
        num_candidates: int = 10,
        top_n: int = 3
    ) -> List[Dict]:
        """
        비디오에서 베스트 프레임 추출

        Args:
            video_path: 비디오 파일 경로
            num_candidates: 후보 프레임 수 (균등 샘플링)
            top_n: 최종 선택할 프레임 수

        Returns:
            [
                {
                    "frame": numpy array,
                    "timestamp": float,
                    "scores": {...},
                    "path": str (임시 저장 경로)
                },
                ...
            ]
        """
        try:
            cap = cv2.VideoCapture(video_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)

            if total_frames == 0 or fps == 0:
                logger.error("Invalid video file")
                return []

            # 균등 간격으로 프레임 인덱스 계산
            frame_indices = np.linspace(
                total_frames * 0.1,  # 첫 10% 제외
                total_frames * 0.9,  # 마지막 10% 제외
                num_candidates,
                dtype=int
            )

            candidates = []

            for idx in frame_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ret, frame = cap.read()

                if not ret:
                    continue

                # 프레임 점수 계산
                scores = self.calculate_frame_score(frame)
                timestamp = idx / fps

                # 임시 파일로 저장
                temp_path = tempfile.mktemp(suffix=".jpg")
                cv2.imwrite(temp_path, frame)

                candidates.append({
                    "frame": frame,
                    "timestamp": timestamp,
                    "scores": scores,
                    "path": temp_path,
                    "frame_index": idx
                })

                logger.debug(
                    f"Frame {idx}: blur={scores['blur_score']:.1f}, "
                    f"faces={scores['face_count']}, score={scores['total_score']:.2f}"
                )

            cap.release()

            # 점수순으로 정렬
            candidates.sort(key=lambda x: x["scores"]["total_score"], reverse=True)

            # 상위 N개 선택
            best_frames = candidates[:top_n]

            # 나머지 후보 삭제
            for candidate in candidates[top_n:]:
                try:
                    os.remove(candidate["path"])
                except:
                    pass

            logger.info(f"Selected {len(best_frames)} best frames from {num_candidates} candidates")

            return best_frames

        except Exception as e:
            logger.error(f"Frame extraction error: {e}")
            return []


class ThumbnailTextGenerator:
    """GPT-4o-mini를 사용한 썸네일 텍스트 생성"""

    def generate_catchy_texts(
        self,
        transcript: str,
        num_texts: int = 3
    ) -> List[str]:
        """
        트랜스크립트를 분석하여 썸네일용 텍스트 생성

        Args:
            transcript: 영상 자막 텍스트
            num_texts: 생성할 텍스트 개수

        Returns:
            ["짧은 멘트1", "짧은 멘트2", ...]
        """
        try:
            openai_client = get_openai_client()
            if not openai_client:
                logger.error("OpenAI client not available")
                return ["놀라운 발견!", "꼭 보세요!", "이건 실화?"]

            # 트랜스크립트가 너무 길면 요약
            if len(transcript) > 3000:
                transcript = transcript[:3000] + "..."

            system_prompt = """당신은 유튜브 썸네일 전문가입니다.
영상 내용을 분석하여 클릭을 유도하는 짧고 강렬한 썸네일 텍스트를 생성하세요.

규칙:
1. 5~8글자 이내 (한글 기준)
2. 호기심을 자극하는 표현 사용
3. 감탄사, 의문문, 명령문 활용
4. 숫자나 % 기호 사용 가능
5. 각 텍스트는 서로 다른 스타일이어야 함

좋은 예시:
- "이거 실화냐?"
- "수익 500% 공개"
- "절대 하지 마세요"
- "충격적 결과"
- "10분만 투자"

나쁜 예시:
- "영상을 시청해주셔서 감사합니다" (너무 김)
- "안녕하세요" (임팩트 없음)
"""

            user_prompt = f"""다음 영상 내용을 분석하여 썸네일에 들어갈 텍스트 {num_texts}개를 생성하세요.

영상 내용:
{transcript}

출력 형식: 각 줄마다 하나의 텍스트만 출력하세요.
"""

            logger.info("Requesting thumbnail texts from GPT-4o-mini...")

            response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.8,  # 창의성 높게
                max_tokens=200,
            )

            result = response.choices[0].message.content.strip()

            # 결과를 줄바꿈으로 분리
            texts = [line.strip() for line in result.split('\n') if line.strip()]

            # 빈 결과나 숫자만 있는 경우 필터링
            texts = [t for t in texts if t and not t.isdigit() and len(t) > 1]

            # 정확히 num_texts개가 아니면 조정
            if len(texts) < num_texts:
                default_texts = ["놀라운 발견!", "꼭 보세요!", "이건 대박!", "진짜 놀람", "충격 결과"]
                texts.extend(default_texts[:num_texts - len(texts)])

            texts = texts[:num_texts]

            logger.info(f"Generated thumbnail texts: {texts}")
            return texts

        except Exception as e:
            logger.error(f"Text generation error: {e}")
            return ["놀라운 발견!", "꼭 보세요!", "이건 실화?"]


class ThumbnailComposer:
    """이미지 + 텍스트 합성"""

    def __init__(self):
        self.font_size = 80
        self.font_color = (255, 255, 0)  # 노란색
        self.stroke_color = (0, 0, 0)     # 검은색 테두리
        self.stroke_width = 4
        self.font = self._load_font()

    def _load_font(self):
        """폰트 로드 (Bold)"""
        try:
            # 시스템 폰트 경로 시도
            font_paths = [
                "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "C:/Windows/Fonts/arialbd.ttf",
            ]

            for path in font_paths:
                if os.path.exists(path):
                    return ImageFont.truetype(path, self.font_size)

            # 기본 폰트 사용
            logger.warning("No bold font found, using default")
            return ImageFont.load_default()

        except Exception as e:
            logger.warning(f"Font loading error: {e}, using default")
            return ImageFont.load_default()

    def compose_thumbnail(
        self,
        image_path: str,
        text: str,
        output_path: Optional[str] = None
    ) -> str:
        """
        이미지에 텍스트 합성

        Args:
            image_path: 원본 이미지 경로
            text: 합성할 텍스트
            output_path: 저장 경로 (None이면 임시 파일)

        Returns:
            생성된 썸네일 경로
        """
        try:
            # 이미지 로드
            img = Image.open(image_path)

            # 크기 조정 (YouTube 썸네일 표준: 1280x720)
            target_size = (1280, 720)
            img = img.resize(target_size, Image.Resampling.LANCZOS)

            # 밝기 조정 (텍스트 가독성 확보)
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(0.7)  # 30% 어둡게

            # 약간의 블러 추가 (배경 효과)
            img = img.filter(ImageFilter.GaussianBlur(radius=1))

            # 드로잉 객체 생성
            draw = ImageDraw.Draw(img)

            # 텍스트 크기 계산
            bbox = draw.textbbox((0, 0), text, font=self.font, stroke_width=self.stroke_width)
            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]

            # 텍스트 위치 (중앙 하단)
            x = (target_size[0] - text_width) // 2
            y = target_size[1] - text_height - 100  # 하단에서 100px 위

            # 텍스트 배경 (반투명 검은색 박스)
            padding = 20
            bg_box = [
                x - padding,
                y - padding,
                x + text_width + padding,
                y + text_height + padding
            ]

            # 반투명 배경 레이어
            overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
            overlay_draw = ImageDraw.Draw(overlay)
            overlay_draw.rectangle(bg_box, fill=(0, 0, 0, 180))  # 70% 불투명

            # 배경 합성
            img = img.convert('RGBA')
            img = Image.alpha_composite(img, overlay)
            img = img.convert('RGB')

            # 다시 드로잉 객체 생성
            draw = ImageDraw.Draw(img)

            # 텍스트 그리기 (테두리 + 본문)
            draw.text(
                (x, y),
                text,
                font=self.font,
                fill=self.font_color,
                stroke_width=self.stroke_width,
                stroke_fill=self.stroke_color
            )

            # 저장
            if output_path is None:
                output_path = tempfile.mktemp(suffix=".jpg")

            img.save(output_path, "JPEG", quality=95)
            logger.info(f"Thumbnail composed: {output_path}")

            return output_path

        except Exception as e:
            logger.error(f"Thumbnail composition error: {e}")
            raise


class ThumbnailGenerator:
    """전체 썸네일 생성 파이프라인"""

    def __init__(self):
        self.frame_analyzer = FrameAnalyzer()
        self.text_generator = ThumbnailTextGenerator()
        self.composer = ThumbnailComposer()

    def generate_thumbnails(
        self,
        video_path: str,
        transcript: str,
        output_dir: Optional[str] = None,
        num_thumbnails: int = 3
    ) -> List[Dict]:
        """
        썸네일 생성 메인 함수

        Args:
            video_path: 비디오 파일 경로
            transcript: 영상 자막
            output_dir: 출력 디렉토리 (None이면 임시)
            num_thumbnails: 생성할 썸네일 개수

        Returns:
            [
                {
                    "thumbnail_path": str,
                    "frame_path": str,
                    "text": str,
                    "timestamp": float,
                    "scores": {...}
                },
                ...
            ]
        """
        logger.info(f"Starting thumbnail generation for {video_path}")

        # 1. 베스트 프레임 추출
        best_frames = self.frame_analyzer.extract_best_frames(
            video_path,
            num_candidates=10,
            top_n=num_thumbnails
        )

        if not best_frames:
            logger.error("No valid frames found")
            return []

        # 2. 텍스트 생성
        catchy_texts = self.text_generator.generate_catchy_texts(
            transcript,
            num_texts=num_thumbnails
        )

        # 3. 썸네일 합성
        thumbnails = []

        for i, (frame_data, text) in enumerate(zip(best_frames, catchy_texts)):
            try:
                # 출력 경로 설정
                if output_dir:
                    os.makedirs(output_dir, exist_ok=True)
                    thumbnail_path = os.path.join(output_dir, f"thumbnail_{i+1}.jpg")
                else:
                    thumbnail_path = None

                # 합성
                final_path = self.composer.compose_thumbnail(
                    frame_data["path"],
                    text,
                    thumbnail_path
                )

                thumbnails.append({
                    "thumbnail_path": final_path,
                    "frame_path": frame_data["path"],
                    "text": text,
                    "timestamp": frame_data["timestamp"],
                    "scores": frame_data["scores"]
                })

                logger.info(f"Thumbnail {i+1}/{num_thumbnails} created: {text}")

            except Exception as e:
                logger.error(f"Failed to create thumbnail {i+1}: {e}")
                continue

        logger.info(f"Generated {len(thumbnails)} thumbnails")
        return thumbnails


# 편의 함수
def generate_thumbnails_from_project(
    video_path: str,
    transcript: str,
    output_dir: Optional[str] = None
) -> List[Dict]:
    """
    프로젝트용 썸네일 생성 함수

    Args:
        video_path: 비디오 파일 경로
        transcript: 전체 자막 텍스트
        output_dir: 출력 디렉토리

    Returns:
        썸네일 정보 리스트
    """
    generator = ThumbnailGenerator()
    return generator.generate_thumbnails(video_path, transcript, output_dir)


if __name__ == "__main__":
    # 테스트
    logging.basicConfig(level=logging.INFO)

    print("Thumbnail Generator Module")
    print("- Frame extraction with blur detection")
    print("- Face detection for better composition")
    print("- GPT-4o-mini powered catchy text generation")
    print("- Professional text overlay with Pillow")
