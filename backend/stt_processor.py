"""
Speech-to-Text Processor
실제 음성 인식 처리 (로컬 Whisper 사용)
"""

import whisper
import os
import json
from pathlib import Path
from database import SessionLocal, Project
import datetime
from typing import List, Dict
from google.cloud import firestore
import re
from audio_separator import preprocess_audio

# Whisper 모델 (base = 빠름, large = 정확함)
MODEL_NAME = "base"
model = None

# Firestore 클라이언트 (선택사항)
try:
    firestore_db = firestore.Client()
except:
    firestore_db = None


def sanitize_file_path(file_path: str) -> str:
    """
    Sanitize and validate file paths to prevent path traversal and command injection.

    Args:
        file_path: File path to sanitize

    Returns:
        Sanitized absolute path

    Raises:
        ValueError: If path is invalid or contains dangerous patterns
    """
    if not file_path or not isinstance(file_path, str):
        raise ValueError("Invalid file path: path must be a non-empty string")

    # Check for null bytes (can be used for injection)
    if '\0' in file_path:
        raise ValueError("Invalid file path: contains null bytes")

    # Check for dangerous patterns
    dangerous_patterns = [
        r'\.\.',  # Path traversal
        r'[;&|`$]',  # Shell metacharacters (extra safety)
        r'\n',  # Newlines
        r'\r',  # Carriage returns
    ]

    for pattern in dangerous_patterns:
        if re.search(pattern, file_path):
            raise ValueError(f"Invalid file path: contains dangerous pattern '{pattern}'")

    # Convert to absolute path and resolve any symlinks
    try:
        abs_path = os.path.abspath(file_path)
        # Normalize the path (remove redundant separators, etc.)
        normalized_path = os.path.normpath(abs_path)

        # Verify the path doesn't try to escape expected directories
        # This is a safety check - adjust based on your needs
        if '..' in Path(normalized_path).parts:
            raise ValueError("Invalid file path: contains parent directory references")

        return normalized_path

    except Exception as e:
        raise ValueError(f"Invalid file path: {str(e)}")


def load_model():
    """Whisper 모델 로드 (처음 한 번만)"""
    global model
    if model is None:
        print("[INFO] Loading Whisper model...")
        model = whisper.load_model(MODEL_NAME)
        print(f"[OK] Whisper model '{MODEL_NAME}' loaded")
    return model


def extract_audio(video_path: str, audio_path: str) -> bool:
    """
    비디오 파일에서 오디오 추출
    ffmpeg 필요
    """
    try:
        import subprocess

        # Sanitize paths to prevent command injection and path traversal
        try:
            safe_video_path = sanitize_file_path(video_path)
            safe_audio_path = sanitize_file_path(audio_path)
        except ValueError as e:
            print(f"[ERROR] Path validation failed: {str(e)}")
            return False

        # Verify input file exists
        if not os.path.exists(safe_video_path):
            print(f"[ERROR] Video file not found: {safe_video_path}")
            return False

        # 오디오 파일 경로
        os.makedirs(os.path.dirname(safe_audio_path) or ".", exist_ok=True)

        # ffmpeg 명령어
        cmd = [
            "ffmpeg",
            "-i", safe_video_path,
            "-q:a", "9",  # 품질
            "-n",  # 존재하면 스킵
            safe_audio_path
        ]

        # 조용히 실행 (에러만 표시)
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=300
        )

        if result.returncode == 0 and os.path.exists(safe_audio_path):
            file_size = os.path.getsize(safe_audio_path)
            print(f"[OK] Audio extracted: {safe_audio_path} ({file_size} bytes)")
            return True
        else:
            print(f"[ERROR] Failed to extract audio from {safe_video_path}")
            return False

    except subprocess.TimeoutExpired:
        print(f"[ERROR] Audio extraction timeout")
        return False
    except Exception as e:
        print(f"[ERROR] Audio extraction failed: {str(e)}")
        return False


def transcribe(audio_path: str, language: str = None) -> Dict:
    """
    Whisper를 사용한 음성 인식

    Args:
        audio_path: 오디오 파일 경로
        language: 언어 코드 (ko, en, ja 등). None이면 자동 감지

    Returns:
        {
            "text": "전체 트랜스크립트",
            "segments": [
                {"start": 0.0, "end": 5.2, "text": "안녕하세요"},
                ...
            ],
            "detected_language": "ko"
        }
    """
    try:
        if not os.path.exists(audio_path):
            return {"error": f"Audio file not found: {audio_path}"}

        if language:
            print(f"[INFO] Transcribing {audio_path} (language: {language})...")
        else:
            print(f"[INFO] Transcribing {audio_path} (auto-detect language)...")

        model = load_model()

        # Whisper 처리 - language=None이면 자동 감지
        result = model.transcribe(
            audio_path,
            language=language,  # None이면 자동 감지
            verbose=False,
            temperature=0,  # 일관된 결과
            word_timestamps=True  # word_level_timings 대신 word_timestamps 사용
        )

        # 결과 정리
        transcript = result.get("text", "").strip()
        detected_language = result.get("language", "unknown")
        segments = []

        for segment in result.get("segments", []):
            segments.append({
                "start": round(segment["start"], 2),
                "end": round(segment["end"], 2),
                "text": segment["text"].strip()
            })

        word_count = len(transcript.split())

        print(f"[OK] Transcription complete: {word_count} words, {len(segments)} segments")
        print(f"[OK] Detected language: {detected_language}")

        return {
            "text": transcript,
            "segments": segments,
            "word_count": word_count,
            "detected_language": detected_language
        }

    except Exception as e:
        print(f"[ERROR] Transcription failed: {str(e)}")
        return {"error": str(e)}


def process_video(
    project_id: str,
    video_path: str,
    language: str = "ko-KR",
    audio_preprocess_mode: str = "highpass",
    enable_audio_preprocess: bool = True
) -> bool:
    """
    비디오 파일 전체 처리

    1. 음성 추출
    2. 오디오 전처리 (선택적)
    3. STT 처리
    4. 데이터베이스 저장

    Args:
        project_id: 프로젝트 ID
        video_path: 비디오 파일 경로
        language: 언어 코드 (기본값: "ko-KR")
        audio_preprocess_mode: "highpass" 또는 "vocal_separation"
        enable_audio_preprocess: 오디오 전처리 활성화 여부
    """
    db = SessionLocal()

    try:
        print(f"\n{'='*60}")
        print(f"[START] Processing project: {project_id}")
        print(f"[AUDIO PREPROCESS] Mode: {audio_preprocess_mode}, Enabled: {enable_audio_preprocess}")
        print(f"{'='*60}")

        # 프로젝트 조회
        project = db.query(Project).filter(Project.project_id == project_id).first()
        if not project:
            print(f"[ERROR] Project not found: {project_id}")
            return False

        # 오디오 파일 경로
        audio_path = video_path.replace(
            os.path.splitext(video_path)[1],
            ".m4a"
        )

        # Step 1: 오디오 추출
        print(f"\n[1/4] Extracting audio...")
        if not extract_audio(video_path, audio_path):
            project.status = "failed"
            project.error_message = "Failed to extract audio"
            db.commit()
            return False

        # Step 2: 오디오 전처리 (선택적)
        print(f"\n[2/4] Preprocessing audio...")
        processed_audio_dir = os.path.join(os.path.dirname(video_path), "processed_audio")
        processed_audio_path = preprocess_audio(
            audio_path,
            processed_audio_dir,
            mode=audio_preprocess_mode,
            enable=enable_audio_preprocess
        )
        print(f"[INFO] Processed audio: {processed_audio_path}")

        # Step 3: STT 처리 (자동 언어 감지)
        print(f"\n[3/4] Performing speech-to-text (auto-detect language)...")
        # language 파라미터를 None으로 전달하여 Whisper가 자동으로 언어 감지
        result = transcribe(processed_audio_path, language=None)

        if "error" in result:
            project.status = "failed"
            project.error_message = result["error"]
            db.commit()
            return False

        # Step 4: 데이터베이스 저장
        print(f"\n[4/4] Saving to database...")
        detected_lang = result.get("detected_language", "unknown")
        print(f"[INFO] Detected language: {detected_lang}")

        project.status = "transcribed"
        project.has_transcript = True
        project.transcript = result["text"]
        project.transcript_length = result.get("word_count", 0)
        project.captions = json.dumps(result["segments"], ensure_ascii=False)
        project.language = detected_lang  # 감지된 언어로 업데이트
        project.completed_at = datetime.datetime.utcnow()
        db.commit()

        # Firestore로 동기화 (백업)
        try:
            if firestore_db:
                # captions를 JSON 문자열에서 객체로 파싱
                captions_data = json.loads(project.captions) if isinstance(project.captions, str) else project.captions

                firestore_db.collection("projects").document(project_id).set({
                    "projectId": project_id,
                    "fileName": project.file_name,
                    "full_text": project.transcript,
                    "transcript": captions_data,  # 배열로 저장
                    "captions": captions_data,     # 호환성을 위해 두 필드 모두 저장
                    "status": "transcribed",
                    "language": detected_lang,  # 감지된 언어
                    "transcriptLength": project.transcript_length,
                    "uploadedAt": project.uploaded_at.isoformat() if project.uploaded_at else None,
                    "completedAt": project.completed_at.isoformat() if project.completed_at else None,
                    "created_at": project.completed_at.isoformat() if project.completed_at else None,
                    "lastUpdated": datetime.datetime.utcnow().isoformat(),
                })
                print(f"[OK] Project {project_id} backed up to Firestore")
        except Exception as e:
            print(f"[WARN] Firestore backup failed: {str(e)}")

        print(f"\n[OK] Project processing complete!")
        print(f"{'='*60}\n")

        # 임시 오디오 파일 삭제
        try:
            if os.path.exists(audio_path):
                os.remove(audio_path)
            # 전처리된 오디오 파일 삭제
            if processed_audio_path != audio_path and os.path.exists(processed_audio_path):
                os.remove(processed_audio_path)
            # 전처리 디렉토리 삭제 (비어있으면)
            if os.path.exists(processed_audio_dir):
                import shutil
                shutil.rmtree(processed_audio_dir, ignore_errors=True)
        except Exception as e:
            print(f"[WARN] Failed to cleanup temp files: {e}")

        return True

    except Exception as e:
        print(f"\n[ERROR] Project processing failed: {str(e)}")
        project.status = "failed"
        project.error_message = str(e)
        db.commit()
        return False

    finally:
        db.close()
