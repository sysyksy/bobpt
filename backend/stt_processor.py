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

# Whisper 모델 (base = 빠름, large = 정확함)
MODEL_NAME = "base"
model = None

# Firestore 클라이언트 (선택사항)
try:
    firestore_db = firestore.Client()
except:
    firestore_db = None


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

        # 오디오 파일 경로
        os.makedirs(os.path.dirname(audio_path) or ".", exist_ok=True)

        # ffmpeg 명령어
        cmd = [
            "ffmpeg",
            "-i", video_path,
            "-q:a", "9",  # 품질
            "-n",  # 존재하면 스킵
            audio_path
        ]

        # 조용히 실행 (에러만 표시)
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=300
        )

        if result.returncode == 0 and os.path.exists(audio_path):
            file_size = os.path.getsize(audio_path)
            print(f"[OK] Audio extracted: {audio_path} ({file_size} bytes)")
            return True
        else:
            print(f"[ERROR] Failed to extract audio from {video_path}")
            return False

    except subprocess.TimeoutExpired:
        print(f"[ERROR] Audio extraction timeout for {video_path}")
        return False
    except Exception as e:
        print(f"[ERROR] Audio extraction failed: {str(e)}")
        return False


def transcribe(audio_path: str, language: str = "ko") -> Dict:
    """
    Whisper를 사용한 음성 인식

    Args:
        audio_path: 오디오 파일 경로
        language: 언어 코드 (ko, en, ja 등)

    Returns:
        {
            "text": "전체 트랜스크립트",
            "segments": [
                {"start": 0.0, "end": 5.2, "text": "안녕하세요"},
                ...
            ]
        }
    """
    try:
        if not os.path.exists(audio_path):
            return {"error": f"Audio file not found: {audio_path}"}

        print(f"[INFO] Transcribing {audio_path} (language: {language})...")

        model = load_model()

        # Whisper 처리
        result = model.transcribe(
            audio_path,
            language=language,
            verbose=False,
            temperature=0,  # 일관된 결과
            word_level_timings=True
        )

        # 결과 정리
        transcript = result.get("text", "").strip()
        segments = []

        for segment in result.get("segments", []):
            segments.append({
                "start": round(segment["start"], 2),
                "end": round(segment["end"], 2),
                "text": segment["text"].strip()
            })

        word_count = len(transcript.split())

        print(f"[OK] Transcription complete: {word_count} words, {len(segments)} segments")

        return {
            "text": transcript,
            "segments": segments,
            "word_count": word_count
        }

    except Exception as e:
        print(f"[ERROR] Transcription failed: {str(e)}")
        return {"error": str(e)}


def process_video(project_id: str, video_path: str, language: str = "ko-KR") -> bool:
    """
    비디오 파일 전체 처리

    1. 음성 추출
    2. STT 처리
    3. 데이터베이스 저장
    """
    db = SessionLocal()

    try:
        print(f"\n{'='*60}")
        print(f"[START] Processing project: {project_id}")
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
        print(f"\n[1/3] Extracting audio...")
        if not extract_audio(video_path, audio_path):
            project.status = "failed"
            project.error_message = "Failed to extract audio"
            db.commit()
            return False

        # Step 2: STT 처리
        print(f"\n[2/3] Performing speech-to-text...")
        lang_code = language.split("-")[0].lower()  # "ko-KR" → "ko"
        result = transcribe(audio_path, lang_code)

        if "error" in result:
            project.status = "failed"
            project.error_message = result["error"]
            db.commit()
            return False

        # Step 3: 데이터베이스 저장
        print(f"\n[3/3] Saving to database...")
        project.status = "transcribed"
        project.has_transcript = True
        project.transcript = result["text"]
        project.transcript_length = result.get("word_count", 0)
        project.captions = json.dumps(result["segments"], ensure_ascii=False)
        project.completed_at = datetime.datetime.utcnow()
        db.commit()

        # Firestore로 동기화 (백업)
        try:
            if firestore_db:
                firestore_db.collection("projects").document(project_id).set({
                    "projectId": project_id,
                    "fileName": project.file_name,
                    "transcript": project.transcript,
                    "captions": project.captions,
                    "status": "transcribed",
                    "language": project.language,
                    "transcriptLength": project.transcript_length,
                    "uploadedAt": project.uploaded_at.isoformat() if project.uploaded_at else None,
                    "completedAt": project.completed_at.isoformat() if project.completed_at else None,
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
        except:
            pass

        return True

    except Exception as e:
        print(f"\n[ERROR] Project processing failed: {str(e)}")
        project.status = "failed"
        project.error_message = str(e)
        db.commit()
        return False

    finally:
        db.close()
