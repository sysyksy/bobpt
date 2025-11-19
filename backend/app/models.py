"""
Pydantic models for request/response validation.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    """Model for creating a new user."""

    email: EmailStr = Field(..., description="User email address")
    username: str = Field(..., min_length=3, max_length=50, description="Username")
    full_name: Optional[str] = Field(None, max_length=100, description="Full name")

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        """Validate that username is alphanumeric."""
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username must be alphanumeric (underscores and hyphens allowed)")
        return v


class UserResponse(BaseModel):
    """Model for user response."""

    id: int
    email: str
    username: str
    full_name: Optional[str]
    created_at: datetime
    is_active: bool = True

    model_config = {
        "from_attributes": True,  # Enable ORM mode for SQLAlchemy models
    }


class ErrorResponse(BaseModel):
    """Standard error response model."""

    error: "ErrorDetail"


class ErrorDetail(BaseModel):
    """Error detail structure."""

    code: str = Field(..., description="Error code for programmatic handling")
    message: str = Field(..., description="Human-readable error message")
    details: dict = Field(default_factory=dict, description="Additional error details")
