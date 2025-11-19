# Backend - Error Handling & Stability Guide

## Architecture Overview

The backend is built with FastAPI and follows a layered architecture with comprehensive error handling at each layer.

## Error Handling Architecture

### 1. Exception Hierarchy

All custom exceptions inherit from `AppException`:

```python
AppException (Base)
├── ValidationError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ConflictError (409)
├── ExternalServiceError (502)
└── DatabaseError (500)
```

### 2. Error Flow

```
Request → Middleware → Route Handler → Exception Raised
                ↓
         Error Middleware
                ↓
    Structured Error Response
```

### 3. Error Response Format

All errors follow this structure:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {
      "key": "value"
    }
  }
}
```

## Usage Examples

### Raising Errors in Routes

```python
from app.exceptions import ValidationError, NotFoundError

@router.post("/users/")
async def create_user(user: UserCreate):
    # Check for duplicates
    if user_exists(user.email):
        raise ValidationError(
            message="Email already registered",
            details={"field": "email", "value": user.email}
        )

    # Get user
    user = get_user(user_id)
    if not user:
        raise NotFoundError(resource="User", resource_id=user_id)

    return user
```

### Database Error Handling

```python
from app.exceptions import DatabaseError
from app.logging_config import logger

try:
    result = await db.execute(query)
except SQLAlchemyError as exc:
    logger.error("Database query failed", query=str(query), error=str(exc))
    raise DatabaseError(
        message="Failed to fetch user data",
        details={"operation": "select"}
    )
```

### External Service Error Handling

```python
import httpx
from app.exceptions import ExternalServiceError

async def call_external_api():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get("https://api.example.com/data")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise ExternalServiceError(
            service="External API",
            message=str(exc),
            details={"endpoint": "https://api.example.com/data"}
        )
```

## Logging Best Practices

### Structured Logging

```python
from app.logging_config import logger

# Info level
logger.info(
    "User logged in",
    user_id=user.id,
    username=user.username,
    ip_address=request.client.host
)

# Warning level
logger.warning(
    "Rate limit exceeded",
    user_id=user.id,
    endpoint=request.url.path,
    attempts=attempts
)

# Error level with exception
try:
    risky_operation()
except Exception as exc:
    logger.exception(
        "Operation failed",
        operation="risky_operation",
        user_id=user.id
    )
```

### Correlation IDs

Every request gets a correlation ID for tracing:

```python
from fastapi import Request

def get_correlation_id(request: Request) -> str:
    return request.state.correlation_id
```

## Health Checks

### Implementing Custom Health Checks

```python
from app.health import router

async def check_redis() -> dict:
    """Check Redis connectivity."""
    try:
        await redis.ping()
        return {
            "status": "healthy",
            "message": "Redis connection successful"
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "message": f"Redis connection failed: {str(exc)}"
        }

# Add to health check
```

## Testing Error Scenarios

### Test Error Responses

```python
def test_validation_error():
    response = client.post("/api/v1/users/", json={
        "email": "invalid",
        "username": "test"
    })
    assert response.status_code == 422
    data = response.json()
    assert "error" in data
    assert data["error"]["code"] == "VALIDATION_ERROR"

def test_not_found_error():
    response = client.get("/api/v1/users/99999")
    assert response.status_code == 404
    data = response.json()
    assert data["error"]["code"] == "NOT_FOUND"
```

### Test Logging

```python
def test_request_logging(caplog):
    with caplog.at_level(logging.INFO):
        response = client.get("/health")
        assert "Request started" in caplog.text
        assert "Request completed" in caplog.text
```

## Performance Considerations

### Database Connection Pooling

```python
from sqlalchemy import create_engine

engine = create_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=3600,   # Recycle connections after 1 hour
)
```

### Request Timeout

```python
from fastapi import FastAPI
import asyncio

app = FastAPI()

@app.middleware("http")
async def timeout_middleware(request: Request, call_next):
    try:
        return await asyncio.wait_for(call_next(request), timeout=30.0)
    except asyncio.TimeoutError:
        raise AppException(
            message="Request timeout",
            status_code=504,
            error_code="TIMEOUT"
        )
```

## Production Checklist

- [ ] Enable JSON logging (`JSON_LOGS=true`)
- [ ] Set appropriate log level (`LOG_LEVEL=WARNING` or `ERROR`)
- [ ] Configure error tracking service (Sentry)
- [ ] Set up monitoring and alerting
- [ ] Enable request rate limiting
- [ ] Configure database connection pooling
- [ ] Set up health check monitoring
- [ ] Disable debug mode (`DEBUG=false`)
- [ ] Hide API documentation in production
- [ ] Configure CORS properly
- [ ] Set up HTTPS
- [ ] Enable request timeout middleware

## Common Patterns

### Retry Logic for Database Operations

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10)
)
async def save_to_database(data):
    # Database operation
    pass
```

### Transaction Management

```python
from sqlalchemy.ext.asyncio import AsyncSession

async def create_user_with_profile(session: AsyncSession, user_data, profile_data):
    try:
        async with session.begin():
            user = User(**user_data)
            session.add(user)
            await session.flush()

            profile = Profile(**profile_data, user_id=user.id)
            session.add(profile)

        return user
    except Exception as exc:
        await session.rollback()
        raise DatabaseError("Failed to create user with profile")
```

## Debugging Tips

1. **Check Correlation IDs**: Use `X-Correlation-ID` header to trace requests
2. **Review Structured Logs**: Filter logs by correlation ID or user ID
3. **Use Health Endpoints**: Monitor `/health` for dependency status
4. **Enable Debug Mode**: Set `DEBUG=true` in development for detailed errors
5. **Test Error Paths**: Always test error scenarios, not just happy paths
