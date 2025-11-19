"""
Tests for error handling and validation.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_create_user_success():
    """Test successful user creation."""
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "test@example.com",
            "username": "testuser",
            "full_name": "Test User"
        }
    )
    assert response.status_code == 201

    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["username"] == "testuser"
    assert data["full_name"] == "Test User"


def test_create_user_invalid_email():
    """Test user creation with invalid email."""
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "invalid-email",
            "username": "testuser",
        }
    )
    assert response.status_code == 422  # Validation error


def test_create_user_duplicate_username():
    """Test user creation with duplicate username."""
    # Create first user
    client.post(
        "/api/v1/users/",
        json={
            "email": "user1@example.com",
            "username": "duplicate",
        }
    )

    # Try to create second user with same username
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "user2@example.com",
            "username": "duplicate",
        }
    )
    assert response.status_code == 400

    data = response.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"
    assert "already exists" in data["error"]["message"].lower()


def test_get_nonexistent_user():
    """Test getting a user that doesn't exist."""
    response = client.get("/api/v1/users/99999")
    assert response.status_code == 404

    data = response.json()
    assert data["error"]["code"] == "NOT_FOUND"


def test_username_validation():
    """Test username validation rules."""
    # Invalid username with special characters
    response = client.post(
        "/api/v1/users/",
        json={
            "email": "test@example.com",
            "username": "invalid@user!",
        }
    )
    assert response.status_code == 422


def test_list_users():
    """Test listing users."""
    response = client.get("/api/v1/users/")
    assert response.status_code == 200

    data = response.json()
    assert isinstance(data, list)


def test_correlation_id_in_response():
    """Test that correlation ID is included in response headers."""
    response = client.get("/health")
    assert "X-Correlation-ID" in response.headers
    assert "X-Process-Time" in response.headers
