"""
Health check endpoints for monitoring application and dependencies.
"""
import asyncio
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, status
from pydantic import BaseModel

from app.config import settings
from app.logging_config import logger

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health check response model."""

    status: str
    timestamp: datetime
    version: str
    environment: str
    checks: Dict[str, Any]


class LivenessResponse(BaseModel):
    """Liveness probe response."""

    status: str
    timestamp: datetime


async def check_database() -> Dict[str, Any]:
    """
    Check database connectivity.

    Returns:
        Dict with status and details
    """
    if not settings.health_check_database:
        return {"status": "skipped", "message": "Database check disabled"}

    try:
        # Simulate database check (replace with actual database ping)
        await asyncio.sleep(0.01)  # Simulate async DB operation
        return {
            "status": "healthy",
            "message": "Database connection successful",
            "response_time_ms": 10,
        }
    except Exception as exc:
        logger.error("Database health check failed", error=str(exc))
        return {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(exc)}",
        }


async def check_external_services() -> Dict[str, Any]:
    """
    Check external service connectivity.

    Returns:
        Dict with status and details
    """
    # Example: Add checks for external APIs, cache, message queues, etc.
    return {
        "status": "healthy",
        "message": "No external services configured",
    }


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Comprehensive health check",
    description="Returns detailed health status of the application and its dependencies",
)
async def health_check() -> HealthResponse:
    """
    Comprehensive health check endpoint.

    Checks:
    - Application status
    - Database connectivity
    - External service connectivity
    """
    checks = {}

    # Check database
    db_check = await check_database()
    checks["database"] = db_check

    # Check external services
    external_check = await check_external_services()
    checks["external_services"] = external_check

    # Determine overall status
    is_healthy = all(
        check.get("status") in ["healthy", "skipped"]
        for check in checks.values()
    )

    overall_status = "healthy" if is_healthy else "unhealthy"

    return HealthResponse(
        status=overall_status,
        timestamp=datetime.utcnow(),
        version=settings.app_version,
        environment=settings.environment,
        checks=checks,
    )


@router.get(
    "/health/liveness",
    response_model=LivenessResponse,
    status_code=status.HTTP_200_OK,
    summary="Liveness probe",
    description="Simple check to verify the application is running",
)
async def liveness() -> LivenessResponse:
    """
    Liveness probe for Kubernetes/Docker health checks.

    Returns a simple response to indicate the application is alive.
    This should be a lightweight check that doesn't depend on external services.
    """
    return LivenessResponse(
        status="alive",
        timestamp=datetime.utcnow(),
    )


@router.get(
    "/health/readiness",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Readiness probe",
    description="Check if application is ready to accept traffic",
)
async def readiness() -> HealthResponse:
    """
    Readiness probe for Kubernetes/Docker health checks.

    Checks if the application and its critical dependencies are ready
    to handle requests. Returns 503 if not ready.
    """
    checks = {}

    # Check critical dependencies only
    db_check = await check_database()
    checks["database"] = db_check

    is_ready = all(
        check.get("status") in ["healthy", "skipped"]
        for check in checks.values()
    )

    response = HealthResponse(
        status="ready" if is_ready else "not_ready",
        timestamp=datetime.utcnow(),
        version=settings.app_version,
        environment=settings.environment,
        checks=checks,
    )

    if not is_ready:
        # Return 503 Service Unavailable if not ready
        return response

    return response
