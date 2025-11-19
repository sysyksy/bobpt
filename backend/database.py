"""
Database models and configuration for Project Brew
Using SQLAlchemy ORM with SQLite
"""

from sqlalchemy import create_engine, Column, String, DateTime, Boolean, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import datetime
import os

# Database configuration
DATABASE_URL = "sqlite:///./bobpt.db"

# Create engine
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    echo=False  # Set to True for SQL debugging
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


class Project(Base):
    """
    Project model - represents a video processing project
    """
    __tablename__ = "projects"

    # Primary key
    project_id = Column(String, primary_key=True, index=True)

    # File information
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=True)  # Local path to uploaded file
    file_size = Column(Integer, nullable=True)  # File size in bytes

    # Status tracking
    status = Column(String, default="processing", nullable=False)  # processing, transcribed, failed
    language = Column(String, default="ko-KR", nullable=False)

    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)

    # Content
    transcript = Column(Text, nullable=True)  # Raw transcript
    captions = Column(Text, nullable=True)  # JSON string of caption objects

    # Metadata
    transcript_length = Column(Integer, default=0)  # Word count
    has_transcript = Column(Boolean, default=False)

    # Source
    source = Column(String, default="local")  # local, youtube, url
    source_url = Column(String, nullable=True)  # YouTube URL if applicable

    # Processing
    error_message = Column(Text, nullable=True)  # If status is failed

    def to_dict(self):
        """Convert model to dictionary"""
        return {
            "projectId": self.project_id,
            "fileName": self.file_name,
            "filePath": self.file_path,
            "fileSize": self.file_size,
            "status": self.status,
            "language": self.language,
            "uploadedAt": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "completedAt": self.completed_at.isoformat() if self.completed_at else None,
            "transcript": self.transcript,
            "captions": self.captions,
            "transcriptLength": self.transcript_length,
            "hasTranscript": self.has_transcript,
            "source": self.source,
            "sourceUrl": self.source_url,
            "errorMessage": self.error_message,
        }


# Initialize database
def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
