from fastapi import FastAPI, HTTPException, Body, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import List, Optional
from google.cloud import storage
from google.cloud import firestore
from google.cloud import translate
from google.cloud.translate_v3 import TranslationServiceClient
from google.cloud.translate_v3.types import TranslateTextRequest
import datetime
from datetime import timedelta
import os
import uuid
import asyncio
from export_manager import ExportManager
from dotenv import load_dotenv
from auth import (
    get_current_user,
    get_current_user_optional,
    create_access_token,
    get_password_hash,
    verify_password,
    TokenData
)

# .env 파일 로드
load_dotenv()

app = FastAPI()

# --- CORS 설정 ---
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Explicit methods only
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "X-Requested-With",
    ],  # Only allow specific headers
    max_age=600,  # Cache preflight requests for 10 minutes
)

# --- 클라이언트 초기화 ---
try:
    storage_client = storage.Client()
    db = firestore.Client()
    translate_client = TranslationServiceClient()
    print("[OK] Google Cloud clients initialized successfully")
except Exception as e:
    print(f"[WARN] Google Cloud client initialization failed: {str(e)}")
    print("[INFO] Running in dev mode - GCS/Firestore/Translation features disabled")
    storage_client = None
    db = None
    translate_client = None

# --- 설정 ---
BUCKET_NAME = "bob-sto"

# --- Pydantic Models ---

# Auth Models
class UserRegisterRequest(BaseModel):
    email: str
    password: str
    name: str

class UserLoginRequest(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

# Project Models
class ProjectInitRequest(BaseModel):
    fileName: str
    language: str = "ko-KR"

class TranscriptUpdateRequest(BaseModel):
    transcript: str
    captions: list

class TranslationRequest(BaseModel):
    captions: list
    targetLanguage: str

class OCRYouTubeRequest(BaseModel):
    url: str

class QuickSpellCheckRequest(BaseModel):
    text: str

class ExportRequest(BaseModel):
    format: str  # "srt", "vtt", "premiere", "fcpx"
    frameRate: int = 30
    videoWidth: int = 1920
    videoHeight: int = 1080

class YouTubeProcessRequest(BaseModel):
    url: str
    target_languages: Optional[List[str]] = ["en"]
    source_language: str = "ko"
    enable_ocr: bool = False

# --- Export Manager 초기화 ---
export_manager = ExportManager()

# --- YouTube Pipeline 초기화 (lazy loading) ---
youtube_pipeline = None

def get_youtube_pipeline():
    """YouTube Pipeline 인스턴스 가져오기 (싱글톤)"""
    global youtube_pipeline
    if youtube_pipeline is None:
        try:
            # youtube_pipeline.py import
            import sys
            sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
            from youtube_pipeline import YouTubePipeline

            openai_api_key = os.environ.get("OPENAI_API_KEY")
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY not configured")

            youtube_pipeline = YouTubePipeline(
                openai_api_key=openai_api_key,
                firestore_client=db
            )
            print("[OK] YouTubePipeline initialized")
        except Exception as e:
            print(f"[ERROR] YouTubePipeline initialization failed: {str(e)}")
            raise

    return youtube_pipeline

# --- API 엔드포인트 ---

@app.get("/")
def read_root():
    return {"Hello": "Project Brew Backend - Cloud Native"}

# --- Authentication Endpoints ---

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(request: UserRegisterRequest):
    """
    User registration endpoint.
    Creates a new user account with hashed password.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Authentication requires database."
        )

    try:
        # Check if user already exists
        users_ref = db.collection("users")
        existing_user = users_ref.where("email", "==", request.email).limit(1).get()

        if len(list(existing_user)) > 0:
            raise HTTPException(
                status_code=400,
                detail="Email already registered"
            )

        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = get_password_hash(request.password)

        user_data = {
            "id": user_id,
            "email": request.email,
            "name": request.name,
            "hashed_password": hashed_password,
            "created_at": firestore.SERVER_TIMESTAMP,
        }

        users_ref.document(user_id).set(user_data)

        # Create access token
        access_token = create_access_token(
            data={"sub": user_id, "email": request.email}
        )

        return AuthResponse(
            token=access_token,
            user=UserResponse(
                id=user_id,
                email=request.email,
                name=request.name
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Registration failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Registration failed")

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(request: UserLoginRequest):
    """
    User login endpoint.
    Validates credentials and returns JWT token.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured. Authentication requires database."
        )

    try:
        # Find user by email
        users_ref = db.collection("users")
        user_docs = users_ref.where("email", "==", request.email).limit(1).get()
        user_list = list(user_docs)

        if len(user_list) == 0:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        user_doc = user_list[0]
        user_data = user_doc.to_dict()

        # Verify password
        if not verify_password(request.password, user_data.get("hashed_password", "")):
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Create access token
        access_token = create_access_token(
            data={"sub": user_data["id"], "email": user_data["email"]}
        )

        return AuthResponse(
            token=access_token,
            user=UserResponse(
                id=user_data["id"],
                email=user_data["email"],
                name=user_data["name"]
            )
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Login failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")

@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: TokenData = Depends(get_current_user)):
    """
    Get current authenticated user information.
    Requires valid JWT token in Authorization header.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        # Get user from database
        user_doc = db.collection("users").document(current_user.user_id).get()

        if not user_doc.exists:
            raise HTTPException(
                status_code=404,
                detail="User not found"
            )

        user_data = user_doc.to_dict()

        return UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            name=user_data["name"]
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get user info: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get user information")

# --- Project Endpoints ---
# NOTE: Add authentication to protect these endpoints by adding:
#       current_user: TokenData = Depends(get_current_user)
# to the function parameters. Example:
#
# @app.post("/api/projects/init")
# def init_project(request: ProjectInitRequest, current_user: TokenData = Depends(get_current_user)):
#     ...

@app.post("/api/projects/init")
def init_project(request: ProjectInitRequest):
    """
    프로젝트 초기화 및 GCS Signed URL 생성

    프론트엔드가 직접 GCS에 업로드할 수 있도록 Signed URL을 제공합니다.
    """
    if storage_client is None or db is None:
        raise HTTPException(
            status_code=503,
            detail="GCS/Firestore not configured. Running in dev mode."
        )

    try:
        # 1. 프로젝트 ID 생성
        project_id = str(uuid.uuid4())

        # 2. GCS 파일명 생성 (project_id를 파일명으로 사용)
        file_extension = os.path.splitext(request.fileName)[1]
        gcs_file_name = f"{project_id}{file_extension}"

        # 3. Firestore에 초기 상태 저장
        doc_ref = db.collection("projects").document(project_id)
        doc_ref.set({
            "id": project_id,
            "fileName": request.fileName,
            "gcsFileName": gcs_file_name,
            "status": "uploading",
            "language": request.language,
            "created_at": firestore.SERVER_TIMESTAMP,
        })

        # 4. GCS PUT Signed URL 생성
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(gcs_file_name)

        upload_url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=15),
            method="PUT",
            content_type="video/mp4",
        )

        print(f"[OK] Project initialized: {project_id}")

        return {
            "projectId": project_id,
            "uploadUrl": upload_url,
            "gcsUri": f"gs://{BUCKET_NAME}/{gcs_file_name}",
            "fileName": request.fileName,
            "status": "uploading"
        }

    except Exception as e:
        print(f"[ERROR] Failed to initialize project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects")
def get_projects_list():
    """
    Firestore에서 프로젝트 목록을 조회합니다.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        projects_ref = db.collection("projects")
        docs = projects_ref.order_by("created_at", direction=firestore.Query.DESCENDING).stream()

        projects_list = []
        for doc in docs:
            data = doc.to_dict()
            projects_list.append({
                "projectId": data.get("id"),
                "fileName": data.get("fileName"),
                "status": data.get("status"),
                "language": data.get("language"),
                "uploadedAt": data.get("created_at"),
                "transcriptLength": len(data.get("transcript", [])) if isinstance(data.get("transcript"), list) else 0,
            })

        return {"projects": projects_list}

    except Exception as e:
        print(f"[ERROR] Failed to get projects: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}")
def get_project_data(project_id: str):
    """
    Firestore에서 프로젝트 데이터를 조회합니다.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        return {
            "projectId": data.get("id"),
            "fileName": data.get("fileName"),
            "status": data.get("status"),
            "language": data.get("language"),
            "transcript": data.get("transcript", []),
            "full_text": data.get("full_text", ""),
            "created_at": data.get("created_at"),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get project: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/project-status/{project_id}")
def get_project_status(project_id: str):
    """
    Firestore에서 프로젝트 상태를 조회합니다.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        transcript = data.get("transcript", [])

        return {
            "projectId": project_id,
            "status": data.get("status", "processing"),
            "fileName": data.get("fileName"),
            "language": data.get("language"),
            "hasTranscript": len(transcript) > 0 if isinstance(transcript, list) else False,
            "transcriptLength": len(transcript) if isinstance(transcript, list) else 0,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get project status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}/transcript")
def get_transcript(project_id: str):
    """
    Firestore에서 프로젝트의 트랜스크립트를 조회합니다.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            return JSONResponse(
                status_code=404,
                content={"error": "Project not found"}
            )

        data = doc.to_dict()
        transcript = data.get("transcript", [])

        if not transcript or len(transcript) == 0:
            return JSONResponse(
                status_code=202,
                content={"error": "Transcript not available yet", "status": "processing"}
            )

        # Captions 형식 변환
        # 새 형식: [{"start": 0.0, "end": 5.2, "text": "..."}]
        # 구 형식: [{"start_time": 0.0, "end_time": 5.2, "word": "..."}]
        captions = []
        for item in transcript:
            # 새 형식 확인 (start, end, text)
            if "start" in item and "end" in item:
                captions.append({
                    "start": item.get("start", 0),
                    "end": item.get("end", 0),
                    "text": item.get("text", ""),
                })
            # 구 형식 (start_time, end_time, word)
            elif "start_time" in item:
                captions.append({
                    "start": item.get("start_time", 0),
                    "end": item.get("end_time", 0),
                    "text": item.get("word", ""),
                })

        return {
            "projectId": project_id,
            "fileName": data.get("fileName"),
            "status": data.get("status"),
            "language": data.get("language"),
            "transcript": data.get("full_text", ""),
            "captions": captions,
            "word_count": len(transcript),
            "completed_at": data.get("created_at"),
        }

    except Exception as e:
        print(f"[ERROR] Failed to get transcript: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/transcript/update")
def update_transcript(project_id: str, data: TranscriptUpdateRequest):
    """
    Firestore의 트랜스크립트를 업데이트합니다.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        # Firestore 업데이트
        doc_ref.update({
            "full_text": data.transcript,
            "transcript": [
                {
                    "start_time": caption.get("start", 0),
                    "end_time": caption.get("end", 0),
                    "word": caption.get("text", ""),
                }
                for caption in data.captions
            ],
            "last_updated": firestore.SERVER_TIMESTAMP,
        })

        print(f"[OK] Transcript updated for project {project_id}")

        return {
            "projectId": project_id,
            "status": "updated",
            "message": "Transcript has been updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to update transcript: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/generate-read-url/{file_name}")
def generate_read_url(file_name: str):
    """
    GCS 객체에 접근할 수 있는 임시 읽기용(GET) URL을 생성합니다.
    """
    if storage_client is None:
        raise HTTPException(
            status_code=503,
            detail="GCS not configured. Running in dev mode."
        )

    try:
        # GCS URI 형식에서 파일 경로만 추출
        if file_name.startswith("gs://"):
            file_name = "/".join(file_name.split("/")[3:])

        blob = storage_client.bucket(BUCKET_NAME).blob(file_name)

        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(hours=1),
            method="GET",
        )
        return {"read_url": url}

    except Exception as e:
        print(f"[ERROR] Failed to generate read URL: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- 번역 API ---

def normalize_language_code(lang_code: str) -> str:
    """언어 코드 정규화: ko-KR -> ko"""
    if not lang_code:
        return "ko"
    return lang_code.split("-")[0].lower()

@app.post("/api/translate-captions")
def translate_captions(data: TranslationRequest):
    """
    Google Cloud Translation API를 사용하여 자막을 번역합니다.
    """
    captions = data.captions
    targetLanguage = data.targetLanguage

    if not captions:
        raise HTTPException(status_code=400, detail="captions are required")

    try:
        if not translate_client:
            # Fallback 모드
            translated = []
            for caption in captions:
                translated.append({
                    "start": caption.get("start", 0),
                    "end": caption.get("end", 0),
                    "text": caption.get("text", ""),
                    "original": caption.get("text", "")
                })
            return {
                "projectId": str(uuid.uuid4()),
                "targetLanguage": targetLanguage,
                "translated": translated,
                "count": len(translated),
                "mode": "fallback",
                "warning": "Translation client not initialized"
            }

        texts_to_translate = [caption.get("text", "") for caption in captions]
        target_lang = normalize_language_code(targetLanguage)
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "")

        if not project_id:
            raise HTTPException(
                status_code=503,
                detail="GOOGLE_CLOUD_PROJECT not configured"
            )

        print(f"[INFO] Translating {len(texts_to_translate)} captions to {target_lang}")

        parent = f"projects/{project_id}/locations/global"

        request = TranslateTextRequest(
            parent=parent,
            contents=texts_to_translate,
            target_language_code=target_lang
        )

        response = translate_client.translate_text(request=request)

        translated = []
        for i, caption in enumerate(captions):
            translated_text = response.translations[i].translated_text if i < len(response.translations) else caption.get("text", "")
            translated.append({
                "start": caption.get("start", 0),
                "end": caption.get("end", 0),
                "text": translated_text,
                "original": caption.get("text", "")
            })

        print(f"[OK] Translation complete: {len(translated)} captions translated")

        return {
            "projectId": str(uuid.uuid4()),
            "targetLanguage": targetLanguage,
            "translated": translated,
            "count": len(translated),
            "mode": "online"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Translation failed: {str(e)}")
        # Fallback
        translated = []
        for caption in captions:
            translated.append({
                "start": caption.get("start", 0),
                "end": caption.get("end", 0),
                "text": caption.get("text", ""),
                "original": caption.get("text", "")
            })
        return {
            "projectId": str(uuid.uuid4()),
            "targetLanguage": targetLanguage,
            "translated": translated,
            "count": len(translated),
            "mode": "fallback",
            "error": str(e)
        }

# --- OCR & 맞춤법 검사 API ---
# (기존 코드 유지 - OCR 기능은 그대로 사용)

@app.post("/api/ocr-spellcheck/youtube")
async def ocr_spellcheck_youtube(request: OCRYouTubeRequest):
    """
    YouTube 영상 OCR + 맞춤법 검사
    """
    try:
        url = request.url
        if not url:
            return JSONResponse(
                status_code=400,
                content={"error": "YouTube URL이 필요합니다"}
            )

        if "youtube.com" not in url and "youtu.be" not in url:
            return JSONResponse(
                status_code=400,
                content={"error": "올바른 YouTube URL이 아닙니다"}
            )

        request_id = str(uuid.uuid4())

        # TODO: OCR 처리 로직 구현

        return {
            "request_id": request_id,
            "status": "processing",
            "source": "youtube",
            "url": url,
            "message": "YouTube 영상 분석이 시작되었습니다."
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"서버 오류: {str(e)}"}
        )

@app.post("/api/ocr-spellcheck/quick-check")
async def ocr_spellcheck_quick_check(request: QuickSpellCheckRequest):
    """
    빠른 맞춤법 검사 (텍스트만)
    """
    try:
        text = request.text

        if not text:
            return JSONResponse(
                status_code=400,
                content={"error": "텍스트가 필요합니다"}
            )

        # TODO: 맞춤법 검사 로직 구현
        return {
            "status": "completed",
            "text_length": len(text),
            "corrections": []
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"맞춤법 검사 오류: {str(e)}"}
        )

# --- 내보내기(Export) API ---

@app.post("/api/projects/{project_id}/export")
def export_project(project_id: str, request: ExportRequest):
    """
    프로젝트를 다양한 형식으로 내보내기

    지원 형식:
    - srt: SubRip 자막 파일
    - vtt: WebVTT 자막 파일
    - premiere: Adobe Premiere Pro XML
    - fcpx: Final Cut Pro X XML

    Returns:
        파일 내용 (text/plain 또는 application/xml)
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        # 1. Firestore에서 프로젝트 데이터 조회
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        transcript = data.get("transcript", [])

        if not transcript or len(transcript) == 0:
            raise HTTPException(
                status_code=400,
                detail="No transcript available for export"
            )

        # 2. 자막 데이터를 export 형식으로 변환
        captions = []
        for word_info in transcript:
            captions.append({
                "start": word_info.get("start_time", 0),
                "end": word_info.get("end_time", 0),
                "text": word_info.get("word", ""),
            })

        # 3. 형식에 따라 내보내기
        export_format = request.format.lower()

        if export_format == "srt":
            content = export_manager.generate_srt(captions)
            media_type = "text/plain; charset=utf-8"
            filename = f"{project_id}.srt"

        elif export_format == "vtt":
            content = export_manager.generate_vtt(captions)
            media_type = "text/plain; charset=utf-8"
            filename = f"{project_id}.vtt"

        elif export_format == "premiere":
            project_name = data.get("fileName", "Untitled")
            gcs_file_name = data.get("gcsFileName", "video.mp4")
            video_file_path = f"gs://{BUCKET_NAME}/{gcs_file_name}"

            content = export_manager.generate_premiere_xml(
                project_name=project_name,
                video_file_path=video_file_path,
                captions=captions,
                frame_rate=request.frameRate,
                video_width=request.videoWidth,
                video_height=request.videoHeight,
            )
            media_type = "application/xml; charset=utf-8"
            filename = f"{project_id}.xml"

        elif export_format == "fcpx":
            project_name = data.get("fileName", "Untitled")
            gcs_file_name = data.get("gcsFileName", "video.mp4")
            video_file_path = f"gs://{BUCKET_NAME}/{gcs_file_name}"

            content = export_manager.generate_fcpxml(
                project_name=project_name,
                video_file_path=video_file_path,
                captions=captions,
                frame_rate=request.frameRate,
            )
            media_type = "application/xml; charset=utf-8"
            filename = f"{project_id}.fcpxml"

        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported format: {export_format}"
            )

        # 4. 파일로 반환
        return Response(
            content=content,
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Export failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}/export/formats")
def get_export_formats(project_id: str):
    """
    프로젝트에서 사용 가능한 내보내기 형식 목록 반환

    Returns:
        지원되는 형식 리스트
    """
    return {
        "formats": [
            {
                "id": "srt",
                "name": "SubRip (.srt)",
                "description": "범용 자막 파일 형식",
                "extension": ".srt",
                "icon": "📄",
            },
            {
                "id": "vtt",
                "name": "WebVTT (.vtt)",
                "description": "웹 표준 자막 파일 형식",
                "extension": ".vtt",
                "icon": "🌐",
            },
            {
                "id": "premiere",
                "name": "Adobe Premiere Pro (.xml)",
                "description": "프리미어 프로 프로젝트 파일 (마커 포함)",
                "extension": ".xml",
                "icon": "🎬",
            },
            {
                "id": "fcpx",
                "name": "Final Cut Pro X (.fcpxml)",
                "description": "파이널 컷 프로 X 프로젝트 파일",
                "extension": ".fcpxml",
                "icon": "🎞️",
            },
        ]
    }

# --- 번역(Translation) API ---

@app.get("/api/projects/{project_id}/translations")
def get_translations(project_id: str):
    """
    프로젝트의 모든 번역 데이터 조회

    Returns:
        {
            "context": {...},
            "translations": {
                "en": {"title": "...", "description": "...", "captions": [...]},
                "ja": {...}
            }
        }
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        translations = data.get("translations", {})
        context = data.get("context", {})
        translation_status = data.get("translation_status", "not_started")

        return {
            "projectId": project_id,
            "status": translation_status,
            "context": context,
            "translations": translations,
            "available_languages": list(translations.keys()) if translations else []
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get translations: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/projects/{project_id}/translations/{language}")
def get_translation_by_language(project_id: str, language: str):
    """
    특정 언어의 번역 데이터 조회

    Args:
        language: 언어 코드 (en, ja, zh, es 등)

    Returns:
        {
            "title": "Translated Title",
            "description": "Translated Description",
            "captions": [...],
            "full_text": "Full transcript"
        }
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        translations = data.get("translations", {})

        if language not in translations:
            raise HTTPException(
                status_code=404,
                detail=f"Translation for language '{language}' not found"
            )

        translation = translations[language]

        # 자막을 프론트엔드 형식으로 변환
        captions = []
        for word_info in translation.get("captions", []):
            captions.append({
                "start": word_info.get("start_time", 0),
                "end": word_info.get("end_time", 0),
                "text": word_info.get("word", ""),
            })

        return {
            "projectId": project_id,
            "language": language,
            "title": translation.get("title", ""),
            "description": translation.get("description", ""),
            "captions": captions,
            "full_text": translation.get("full_text", ""),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get translation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/translate")
def trigger_translation(project_id: str, target_languages: List[str] = Body(...)):
    """
    프로젝트에 대한 번역 작업 트리거 (수동 실행)

    Request Body:
        ["en", "ja", "zh"]

    Note: Cloud Functions에서 자동으로 번역하지만,
          필요시 수동으로 번역을 다시 요청할 수 있습니다.
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        # 번역 상태 업데이트
        doc_ref.update({
            "translation_status": "pending",
            "translation_requested_languages": target_languages,
        })

        # TODO: Cloud Functions 또는 백그라운드 작업 큐에 번역 작업 추가
        # 현재는 상태만 업데이트하고, Cloud Functions가 다시 실행될 때 번역

        return {
            "projectId": project_id,
            "status": "pending",
            "target_languages": target_languages,
            "message": "Translation request submitted. Processing will start shortly."
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to trigger translation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- YouTube Pipeline API ---

@app.post("/api/youtube/process")
async def process_youtube_video(
    request: YouTubeProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    YouTube 비디오 처리 (백그라운드 작업)

    Request:
        {
            "url": "https://youtube.com/watch?v=...",
            "target_languages": ["en", "ja"],
            "source_language": "ko",
            "enable_ocr": false
        }

    Returns:
        {
            "project_id": "uuid",
            "status": "processing",
            "message": "YouTube processing started"
        }
    """
    try:
        # YouTube Pipeline 인스턴스 가져오기
        pipeline = get_youtube_pipeline()

        # 프로젝트 ID 생성
        project_id = str(uuid.uuid4())

        print(f"[INFO] YouTube processing started: {project_id}")
        print(f"       URL: {request.url}")
        print(f"       Target Languages: {request.target_languages}")

        # Firestore에 초기 상태 저장
        if db:
            doc_ref = db.collection("projects").document(project_id)
            doc_ref.set({
                "id": project_id,
                "source": "youtube",
                "url": request.url,
                "status": "processing",
                "language": request.source_language,
                "target_languages": request.target_languages,
                "created_at": firestore.SERVER_TIMESTAMP,
            })

        # 백그라운드 작업 함수
        async def process_video_task():
            try:
                print(f"[INFO] Processing YouTube video: {project_id}")

                result = await pipeline.process_youtube_url(
                    url=request.url,
                    target_languages=request.target_languages,
                    source_language=request.source_language,
                    enable_ocr=request.enable_ocr,
                    project_id=project_id
                )

                print(f"[OK] YouTube processing completed: {project_id}")
                print(f"     Title: {result.get('title', 'N/A')}")
                print(f"     Languages: {len(result.get('translations', {}))} translations")

            except Exception as e:
                print(f"[ERROR] YouTube processing failed: {project_id}")
                print(f"        Error: {str(e)}")

                # Firestore에 실패 상태 저장
                if db:
                    doc_ref = db.collection("projects").document(project_id)
                    doc_ref.update({
                        "status": "failed",
                        "error": str(e),
                    })

        # 백그라운드 태스크 추가
        background_tasks.add_task(process_video_task)

        return {
            "project_id": project_id,
            "status": "processing",
            "url": request.url,
            "target_languages": request.target_languages,
            "message": "YouTube processing started in background. Use /api/project-status/{project_id} to check progress."
        }

    except ValueError as e:
        # OPENAI_API_KEY 미설정 등
        raise HTTPException(
            status_code=503,
            detail=f"YouTube pipeline not available: {str(e)}"
        )
    except Exception as e:
        print(f"[ERROR] Failed to start YouTube processing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/youtube/status/{project_id}")
def get_youtube_processing_status(project_id: str):
    """
    YouTube 처리 상태 조회

    Returns:
        {
            "project_id": "uuid",
            "status": "processing" | "completed" | "failed",
            "progress": {...},
            "result": {...} (if completed)
        }
    """
    if db is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore not configured."
        )

    try:
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        status = data.get("status", "unknown")

        response = {
            "project_id": project_id,
            "status": status,
            "source": data.get("source", "unknown"),
            "url": data.get("url", ""),
            "created_at": data.get("created_at"),
        }

        # 상태별 추가 정보
        if status == "completed" or status == "transcribed":
            response["result"] = {
                "title": data.get("fileName", ""),
                "full_text": data.get("full_text", ""),
                "transcript_length": len(data.get("transcript", [])),
                "available_translations": list(data.get("translations", {}).keys()),
            }
        elif status == "failed":
            response["error"] = data.get("error", "Unknown error")

        return response

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to get YouTube status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Video Editing API ---

class VideoEditRequest(BaseModel):
    enable_filler_removal: bool = True
    enable_shorts_generation: bool = True
    num_shorts: int = 3
    video_genre: Optional[str] = None

class QuickShortRequest(BaseModel):
    video_genre: Optional[str] = None

# Video Pipeline Manager 초기화 (lazy loading)
video_pipeline_manager = None

def get_video_pipeline_manager():
    """Video Pipeline Manager 인스턴스 가져오기 (싱글톤)"""
    global video_pipeline_manager
    if video_pipeline_manager is None:
        try:
            import sys
            sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
            from video_pipeline_manager import VideoPipelineManager

            openai_api_key = os.environ.get("OPENAI_API_KEY")
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY not configured")

            video_pipeline_manager = VideoPipelineManager(
                openai_api_key=openai_api_key,
                firestore_client=db
            )
            print("[OK] VideoPipelineManager initialized")
        except Exception as e:
            print(f"[ERROR] VideoPipelineManager initialization failed: {str(e)}")
            raise

    return video_pipeline_manager

@app.post("/api/projects/{project_id}/edit")
async def edit_video(
    project_id: str,
    request: VideoEditRequest,
    background_tasks: BackgroundTasks
):
    """
    영상 자동 편집 (추임새 제거 + 쇼츠 생성)

    Request:
        {
            "enable_filler_removal": true,
            "enable_shorts_generation": true,
            "num_shorts": 3,
            "video_genre": "게임 리뷰"
        }

    Returns:
        {
            "project_id": "uuid",
            "status": "processing",
            "message": "Video editing started"
        }
    """
    if db is None or storage_client is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore/GCS not configured."
        )

    try:
        # 프로젝트 데이터 조회
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()

        # STT 결과 확인
        segments = data.get("transcript", [])
        full_text = data.get("full_text", "")

        if not segments or not full_text:
            raise HTTPException(
                status_code=400,
                detail="No transcript available. Please complete STT first."
            )

        # GCS에서 원본 비디오 다운로드
        gcs_file_name = data.get("gcsFileName")
        if not gcs_file_name:
            raise HTTPException(
                status_code=400,
                detail="No video file found in project"
            )

        print(f"[INFO] Video editing started: {project_id}")
        print(f"       Filler Removal: {request.enable_filler_removal}")
        print(f"       Shorts Generation: {request.enable_shorts_generation}")

        # 상태 업데이트
        doc_ref.update({
            "video_editing_status": "processing"
        })

        # 백그라운드 작업
        async def edit_video_task():
            try:
                import tempfile
                from pathlib import Path

                # 임시 디렉토리에 비디오 다운로드
                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_video_path = Path(temp_dir) / gcs_file_name

                    bucket = storage_client.bucket(BUCKET_NAME)
                    blob = bucket.blob(gcs_file_name)
                    blob.download_to_filename(str(temp_video_path))

                    print(f"[INFO] Video downloaded: {temp_video_path}")

                    # Video Pipeline Manager 실행
                    manager = get_video_pipeline_manager()

                    # 세그먼트 형식 변환 (Firestore → VideoEditor)
                    video_segments = [
                        {
                            "start_time": seg.get("start_time", 0),
                            "end_time": seg.get("end_time", 0),
                            "word": seg.get("word", "")
                        }
                        for seg in segments
                    ]

                    # 파이프라인 실행
                    result = manager.process_full_pipeline(
                        video_path=str(temp_video_path),
                        segments=video_segments,
                        full_transcript=full_text,
                        project_id=project_id,
                        video_genre=request.video_genre,
                        enable_filler_removal=request.enable_filler_removal,
                        enable_shorts_generation=request.enable_shorts_generation,
                        num_shorts=request.num_shorts
                    )

                    # 편집된 비디오를 GCS에 업로드
                    edited_files = []

                    if result.get("edited_video"):
                        edited_blob_name = f"edited/{project_id}_edited.mp4"
                        edited_blob = bucket.blob(edited_blob_name)
                        edited_blob.upload_from_filename(result["edited_video"])
                        edited_files.append({
                            "type": "edited",
                            "gcs_path": f"gs://{BUCKET_NAME}/{edited_blob_name}"
                        })

                    # 쇼츠 업로드
                    for i, short in enumerate(result.get("shorts", [])):
                        short_blob_name = f"shorts/{project_id}_short_{i+1}.mp4"
                        short_blob = bucket.blob(short_blob_name)
                        short_blob.upload_from_filename(short["path"])
                        edited_files.append({
                            "type": "short",
                            "gcs_path": f"gs://{BUCKET_NAME}/{short_blob_name}",
                            "start": short["start"],
                            "end": short["end"],
                            "reason": short["reason"],
                            "score": short["score"]
                        })

                    # Firestore 업데이트
                    doc_ref.update({
                        "video_editing_status": "completed",
                        "edited_files": edited_files,
                        "highlights": result.get("highlights", [])
                    })

                    print(f"[OK] Video editing completed: {project_id}")

            except Exception as e:
                print(f"[ERROR] Video editing failed: {project_id}")
                print(f"        Error: {str(e)}")

                doc_ref.update({
                    "video_editing_status": "failed",
                    "video_editing_error": str(e)
                })

        # 백그라운드 태스크 추가
        background_tasks.add_task(edit_video_task)

        return {
            "project_id": project_id,
            "status": "processing",
            "message": "Video editing started in background. Use /api/projects/{project_id} to check progress."
        }

    except ValueError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Video pipeline not available: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Failed to start video editing: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/projects/{project_id}/quick-short")
async def create_quick_short(
    project_id: str,
    request: QuickShortRequest,
    background_tasks: BackgroundTasks
):
    """
    빠른 쇼츠 생성 (하이라이트 1개만)

    Request:
        {
            "video_genre": "게임 리뷰"
        }

    Returns:
        {
            "project_id": "uuid",
            "status": "processing",
            "message": "Quick short generation started"
        }
    """
    if db is None or storage_client is None:
        raise HTTPException(
            status_code=503,
            detail="Firestore/GCS not configured."
        )

    try:
        # 프로젝트 데이터 조회
        doc_ref = db.collection("projects").document(project_id)
        doc = doc_ref.get()

        if not doc.exists:
            raise HTTPException(status_code=404, detail="Project not found")

        data = doc.to_dict()
        segments = data.get("transcript", [])
        full_text = data.get("full_text", "")
        gcs_file_name = data.get("gcsFileName")

        if not segments or not full_text:
            raise HTTPException(
                status_code=400,
                detail="No transcript available"
            )

        print(f"[INFO] Quick short generation started: {project_id}")

        # 백그라운드 작업
        async def quick_short_task():
            try:
                import tempfile
                from pathlib import Path

                with tempfile.TemporaryDirectory() as temp_dir:
                    temp_video_path = Path(temp_dir) / gcs_file_name

                    bucket = storage_client.bucket(BUCKET_NAME)
                    blob = bucket.blob(gcs_file_name)
                    blob.download_to_filename(str(temp_video_path))

                    manager = get_video_pipeline_manager()

                    video_segments = [
                        {
                            "start_time": seg.get("start_time", 0),
                            "end_time": seg.get("end_time", 0),
                            "word": seg.get("word", "")
                        }
                        for seg in segments
                    ]

                    result = manager.generate_single_short(
                        video_path=str(temp_video_path),
                        segments=video_segments,
                        full_transcript=full_text,
                        project_id=project_id,
                        video_genre=request.video_genre
                    )

                    if result:
                        # GCS 업로드
                        short_blob_name = f"shorts/{project_id}_quick_short.mp4"
                        short_blob = bucket.blob(short_blob_name)
                        short_blob.upload_from_filename(result["path"])

                        doc_ref.update({
                            "quick_short": {
                                "gcs_path": f"gs://{BUCKET_NAME}/{short_blob_name}",
                                "start": result["start"],
                                "end": result["end"],
                                "reason": result["reason"],
                                "score": result["score"]
                            },
                            "quick_short_status": "completed"
                        })

                        print(f"[OK] Quick short completed: {project_id}")

            except Exception as e:
                print(f"[ERROR] Quick short failed: {str(e)}")
                doc_ref.update({
                    "quick_short_status": "failed",
                    "quick_short_error": str(e)
                })

        background_tasks.add_task(quick_short_task)

        return {
            "project_id": project_id,
            "status": "processing",
            "message": "Quick short generation started"
        }

    except Exception as e:
        print(f"[ERROR] Failed to start quick short: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
