"""
Tests for health check endpoints.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check():
    """Test comprehensive health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] in ["healthy", "unhealthy"]
    assert "timestamp" in data
    assert "version" in data
    assert "environment" in data
    assert "checks" in data


def test_liveness_probe():
    """Test liveness probe endpoint."""
    response = client.get("/health/liveness")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "alive"
    assert "timestamp" in data


def test_readiness_probe():
    """Test readiness probe endpoint."""
    response = client.get("/health/readiness")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] in ["ready", "not_ready"]
    assert "checks" in data
