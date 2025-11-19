"""
Example API routes demonstrating error handling and validation.
"""
from typing import List

from fastapi import APIRouter, HTTPException, Query, status

from app.exceptions import NotFoundError, ValidationError
from app.logging_config import logger
from app.models import UserCreate, UserResponse

router = APIRouter(prefix="/users", tags=["users"])

# In-memory storage for demonstration (replace with database in production)
users_db: List[dict] = []
user_id_counter = 1


@router.post(
    "/",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new user",
    description="Creates a new user with email and username validation",
)
async def create_user(user: UserCreate) -> UserResponse:
    """
    Create a new user.

    Args:
        user: User creation data

    Returns:
        Created user data

    Raises:
        ValidationError: If username already exists
    """
    global user_id_counter

    # Check if username already exists
    if any(u["username"] == user.username for u in users_db):
        logger.warning("Attempt to create user with existing username", username=user.username)
        raise ValidationError(
            message="Username already exists",
            details={"field": "username", "value": user.username}
        )

    # Check if email already exists
    if any(u["email"] == user.email for u in users_db):
        logger.warning("Attempt to create user with existing email", email=user.email)
        raise ValidationError(
            message="Email already exists",
            details={"field": "email", "value": user.email}
        )

    # Create user
    new_user = {
        "id": user_id_counter,
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "created_at": "2025-11-19T00:00:00",
        "is_active": True,
    }
    users_db.append(new_user)
    user_id_counter += 1

    logger.info("User created successfully", user_id=new_user["id"], username=user.username)

    return UserResponse(**new_user)


@router.get(
    "/{user_id}",
    response_model=UserResponse,
    summary="Get user by ID",
    description="Retrieves a user by their ID",
)
async def get_user(user_id: int) -> UserResponse:
    """
    Get a user by ID.

    Args:
        user_id: User ID

    Returns:
        User data

    Raises:
        NotFoundError: If user doesn't exist
    """
    user = next((u for u in users_db if u["id"] == user_id), None)

    if not user:
        logger.warning("User not found", user_id=user_id)
        raise NotFoundError(resource="User", resource_id=user_id)

    return UserResponse(**user)


@router.get(
    "/",
    response_model=List[UserResponse],
    summary="List all users",
    description="Retrieves all users with optional filtering",
)
async def list_users(
    is_active: bool = Query(True, description="Filter by active status"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of users to return"),
) -> List[UserResponse]:
    """
    List all users.

    Args:
        is_active: Filter by active status
        limit: Maximum number of users to return

    Returns:
        List of users
    """
    filtered_users = [u for u in users_db if u["is_active"] == is_active]
    limited_users = filtered_users[:limit]

    logger.info("Users listed", count=len(limited_users), is_active=is_active)

    return [UserResponse(**u) for u in limited_users]


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete user",
    description="Deletes a user by ID",
)
async def delete_user(user_id: int) -> None:
    """
    Delete a user.

    Args:
        user_id: User ID

    Raises:
        NotFoundError: If user doesn't exist
    """
    global users_db

    user = next((u for u in users_db if u["id"] == user_id), None)

    if not user:
        logger.warning("Attempt to delete non-existent user", user_id=user_id)
        raise NotFoundError(resource="User", resource_id=user_id)

    users_db = [u for u in users_db if u["id"] != user_id]

    logger.info("User deleted", user_id=user_id)


@router.get(
    "/test/error",
    summary="Test error handling",
    description="Endpoint to test error handling (development only)",
    include_in_schema=False,  # Hide from production docs
)
async def test_error() -> dict:
    """
    Test endpoint to trigger an error for testing error handling.

    DO NOT USE IN PRODUCTION.
    """
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="This is a test error",
    )
