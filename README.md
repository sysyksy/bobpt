# BobPT - Full-Stack Application with Comprehensive Error Handling

A full-stack application demonstrating enterprise-grade stability and error handling patterns.

## 🌟 Features

### Backend (FastAPI + Python)
- **Structured Exception Handling**: Custom exception hierarchy for different error types
- **Structured Logging**: JSON-formatted logs with correlation IDs for request tracking
- **Health Check Endpoints**: Liveness, readiness, and comprehensive health checks
- **Request/Response Middleware**: Automatic error handling and request logging
- **Input Validation**: Pydantic models for type-safe request validation
- **API Documentation**: Auto-generated OpenAPI/Swagger docs

### Frontend (React + TypeScript)
- **Error Boundaries**: Graceful error handling for component failures
- **API Client with Retry Logic**: Exponential backoff for failed requests
- **Form Validation**: Client-side validation with Zod and React Hook Form
- **Type Safety**: Full TypeScript coverage for compile-time error detection
- **User-Friendly Error Messages**: Structured error display components
- **Request Tracking**: Correlation IDs for debugging

## 📁 Project Structure

```
bobpt/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI application
│   │   ├── config.py            # Application configuration
│   │   ├── exceptions.py        # Custom exception classes
│   │   ├── middleware.py        # Error handling & logging middleware
│   │   ├── logging_config.py    # Structured logging setup
│   │   ├── health.py            # Health check endpoints
│   │   ├── models.py            # Pydantic models
│   │   └── routes.py            # API routes
│   ├── tests/
│   │   ├── test_health.py
│   │   └── test_error_handling.py
│   ├── requirements.txt
│   ├── pytest.ini
│   └── .env.example
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   └── users.ts         # API endpoint functions
    │   ├── components/
    │   │   ├── ErrorBoundary.tsx
    │   │   ├── ErrorMessage.tsx
    │   │   └── UserForm.tsx
    │   ├── hooks/
    │   │   └── useApi.ts        # API request hook
    │   ├── lib/
    │   │   └── api-client.ts    # Axios client with retry
    │   ├── types/
    │   │   └── errors.ts        # Error type definitions
    │   ├── App.tsx
    │   ├── main.tsx
    │   └── index.css
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    └── .env.example
```

## 🚀 Quick Start

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
cp .env.example .env

# Run the server
python -m app.main
# Or using uvicorn directly:
uvicorn app.main:app --reload
```

The backend will be available at http://localhost:8000

- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run development server
npm run dev
```

The frontend will be available at http://localhost:3000

### Run Tests

**Backend:**
```bash
cd backend
pytest
```

**Frontend:**
```bash
cd frontend
npm test
```

## 📚 Error Handling Patterns

### Backend Error Handling

#### 1. Custom Exception Classes

```python
from app.exceptions import ValidationError, NotFoundError

# Raise structured errors
raise ValidationError(
    message="Username already exists",
    details={"field": "username", "value": username}
)

raise NotFoundError(resource="User", resource_id=user_id)
```

#### 2. Middleware for Global Error Handling

All exceptions are caught and transformed into consistent JSON responses:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Username already exists",
    "details": {
      "field": "username",
      "value": "testuser"
    }
  }
}
```

#### 3. Structured Logging

```python
from app.logging_config import logger

logger.info("User created", user_id=user.id, username=user.username)
logger.error("Database error", error=str(exc), operation="create_user")
```

#### 4. Health Checks

- **Liveness**: `/health/liveness` - Is the app running?
- **Readiness**: `/health/readiness` - Can the app handle requests?
- **Comprehensive**: `/health` - Detailed status of all dependencies

### Frontend Error Handling

#### 1. Error Boundaries

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

<ErrorBoundary>
  <YourComponent />
</ErrorBoundary>
```

#### 2. API Client with Retry

```typescript
import { apiRequest } from '@/lib/api-client';

// Automatically retries on network errors or 5xx responses
const user = await apiRequest<User>({
  method: 'POST',
  url: '/api/v1/users/',
  data: userData,
});
```

#### 3. Form Validation

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Invalid email'),
  username: z.string().min(3, 'Too short'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

#### 4. Custom API Hook

```typescript
import { useApi } from '@/hooks/useApi';
import { createUser } from '@/api/users';

const { data, loading, error, execute } = useApi(createUser);

// Execute the API call
const result = await execute(userData);
```

## 🔧 Configuration

### Backend Environment Variables

Create a `.env` file in the `backend/` directory:

```env
APP_NAME=BobPT API
ENVIRONMENT=development
LOG_LEVEL=INFO
JSON_LOGS=false
DATABASE_URL=sqlite:///./bobpt.db
```

### Frontend Environment Variables

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=30000
VITE_API_RETRY_ATTEMPTS=3
```

## 🧪 Testing Error Handling

### Try These Scenarios:

1. **Validation Errors**:
   - Submit form with invalid email
   - Use special characters in username
   - Create duplicate username

2. **Network Errors**:
   - Stop the backend server
   - Submit a form to see retry logic

3. **Runtime Errors**:
   - Check Error Boundary by forcing component error
   - Visit `/api/v1/users/test/error` endpoint

4. **Server Errors**:
   - Simulate database failures
   - Test timeout scenarios

## 📊 Monitoring & Debugging

### Request Tracking

Every request includes a correlation ID in headers:
- `X-Correlation-ID`: Unique request identifier
- `X-Process-Time`: Request processing time

### Logging

Backend logs include:
- Request/response details
- Error stack traces
- Performance metrics
- User actions

### Health Monitoring

Monitor application health at `/health`:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-19T00:00:00",
  "version": "1.0.0",
  "environment": "development",
  "checks": {
    "database": {"status": "healthy"},
    "external_services": {"status": "healthy"}
  }
}
```

## 🛡️ Security Considerations

- Input validation on both client and server
- CORS configuration
- Request rate limiting (TODO)
- SQL injection prevention via ORM
- XSS prevention via proper escaping
- Authentication/authorization (TODO)

## 📈 Production Deployment

### Backend

1. Set `ENVIRONMENT=production` in `.env`
2. Set `JSON_LOGS=true` for structured logging
3. Configure proper database URL
4. Set up monitoring (Prometheus, DataDog, etc.)
5. Enable HTTPS
6. Configure rate limiting

### Frontend

1. Build production bundle: `npm run build`
2. Serve static files from `dist/`
3. Configure proper API URL
4. Enable error tracking (Sentry, LogRocket)
5. Set up CDN for assets

## 🤝 Contributing

1. Follow existing error handling patterns
2. Add tests for error scenarios
3. Update documentation
4. Ensure type safety (TypeScript/Pydantic)

## 📝 License

MIT License - see LICENSE file for details

## 🔗 Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Zod Validation](https://zod.dev/)
- [Axios Retry](https://github.com/softonic/axios-retry)
- [Structlog](https://www.structlog.org/)