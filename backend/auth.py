"""
JWT Authentication Module for BobPT Backend
Handles user authentication, JWT token creation and validation.
"""

from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

# --- Configuration ---
SECRET_KEY = os.getenv("JWT_SECRET", "your-secret-key-here-CHANGE-IN-PRODUCTION")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# HTTP Bearer token scheme
security = HTTPBearer()

# --- Pydantic Models ---
class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None

class User(BaseModel):
    id: str
    email: str
    name: str

class UserInDB(User):
    hashed_password: str

# --- Password Hashing ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password."""
    return pwd_context.hash(password)

# --- JWT Token Functions ---
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token.

    Args:
        data: Dictionary containing user data to encode
        expires_delta: Optional expiration time delta

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> TokenData:
    """
    Decode and validate a JWT token.

    Args:
        token: JWT token string

    Returns:
        TokenData object with user information

    Raises:
        HTTPException: If token is invalid or expired
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        email: str = payload.get("email")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return TokenData(user_id=user_id, email=email)

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

# --- Authentication Dependency ---
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> TokenData:
    """
    FastAPI dependency to get the current authenticated user.

    Usage in route:
        @app.get("/protected")
        async def protected_route(current_user: TokenData = Depends(get_current_user)):
            return {"user_id": current_user.user_id}

    Args:
        credentials: HTTP Bearer token from request header

    Returns:
        TokenData with current user information

    Raises:
        HTTPException: If authentication fails
    """
    token = credentials.credentials
    return decode_token(token)

# --- Optional: Make authentication optional for certain routes ---
class OptionalHTTPBearer(HTTPBearer):
    async def __call__(self, request):
        try:
            return await super().__call__(request)
        except HTTPException:
            return None

optional_security = OptionalHTTPBearer()

async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(optional_security)
) -> Optional[TokenData]:
    """
    Optional authentication dependency - returns None if no valid token provided.
    Useful for routes that work with or without authentication.
    """
    if credentials is None:
        return None

    try:
        token = credentials.credentials
        return decode_token(token)
    except HTTPException:
        return None
