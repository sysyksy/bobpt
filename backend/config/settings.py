"""환경 변수 기반 설정"""
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """환경 변수 기반 애플리케이션 설정"""

    # Google Cloud
    gcp_project_id: Optional[str] = None
    gcp_bucket_name: str = "bob-sto"
    google_application_credentials: Optional[str] = None

    # CORS
    cors_origins: List[str] = [
        "http://localhost:5173",
        "http://localhost:5174",
    ]

    # API Keys
    openai_api_key: str

    # Database
    firestore_collection: str = "projects"
    database_url: str = "bobpt.db"

    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/bobpt.log"

    # JWT
    jwt_secret: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 60 * 24  # 24시간

    # File Upload
    upload_dir: str = "uploads"
    max_upload_size: int = 100 * 1024 * 1024  # 100MB

    # OCR & STT
    ocr_language: str = "kor+eng"
    stt_model: str = "whisper-1"

    # Chapter Generation
    chapter_model: str = "gpt-4o-mini"
    chapter_max_tokens: int = 1000

    # Thumbnail Generation
    thumbnail_model: str = "gpt-4o-mini"
    thumbnail_size: str = "1024x1024"

    # Environment
    environment: str = "development"
    debug: bool = True

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "allow"  # 추가 환경 변수 허용

    @property
    def is_production(self) -> bool:
        """프로덕션 환경 여부"""
        return self.environment.lower() == "production"

    @property
    def is_development(self) -> bool:
        """개발 환경 여부"""
        return self.environment.lower() == "development"

    @property
    def cors_allow_credentials(self) -> bool:
        """CORS 자격증명 허용 여부"""
        return True

    @property
    def cors_allow_methods(self) -> List[str]:
        """허용된 HTTP 메서드"""
        return ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"]

    @property
    def cors_allow_headers(self) -> List[str]:
        """허용된 헤더"""
        return ["*"]


# 싱글톤 인스턴스
_settings = None


def get_settings() -> Settings:
    """설정 인스턴스 가져오기 (싱글톤)"""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings


# 기본 export
settings = get_settings()
