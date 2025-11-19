"""
Middleware for error handling, logging, and request tracking.
"""
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.exceptions import AppException
from app.logging_config import logger


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware to catch and handle exceptions globally."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        try:
            response = await call_next(request)
            return response
        except AppException as exc:
            logger.error(
                "Application error occurred",
                error_code=exc.error_code,
                status_code=exc.status_code,
                message=exc.message,
                details=exc.details,
                path=request.url.path,
                method=request.method,
            )
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "code": exc.error_code,
                        "message": exc.message,
                        "details": exc.details,
                    }
                },
            )
        except ValueError as exc:
            logger.error(
                "Value error occurred",
                error=str(exc),
                path=request.url.path,
                method=request.method,
            )
            return JSONResponse(
                status_code=400,
                content={
                    "error": {
                        "code": "INVALID_VALUE",
                        "message": str(exc),
                        "details": {},
                    }
                },
            )
        except Exception as exc:
            logger.exception(
                "Unexpected error occurred",
                error=str(exc),
                error_type=type(exc).__name__,
                path=request.url.path,
                method=request.method,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": {
                        "code": "INTERNAL_SERVER_ERROR",
                        "message": "An unexpected error occurred. Please try again later.",
                        "details": {},
                    }
                },
            )


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Middleware to log all requests and responses with correlation ID."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate correlation ID for request tracking
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        start_time = time.time()

        logger.info(
            "Request started",
            method=request.method,
            path=request.url.path,
            correlation_id=correlation_id,
            client_host=request.client.host if request.client else None,
        )

        response = await call_next(request)

        process_time = time.time() - start_time

        logger.info(
            "Request completed",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(process_time * 1000, 2),
            correlation_id=correlation_id,
        )

        # Add correlation ID to response headers
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Process-Time"] = str(process_time)

        return response
