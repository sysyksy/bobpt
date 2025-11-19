# Frontend - Error Handling & Stability Guide

## Architecture Overview

The frontend uses React with TypeScript, implementing multiple layers of error handling from component errors to network failures.

## Error Handling Layers

```
User Action
    ↓
Form Validation (Zod)
    ↓
API Request (Axios)
    ↓
Automatic Retry
    ↓
Error Transformation
    ↓
UI Error Display
    ↓
Error Boundary (Last Resort)
```

## Key Components

### 1. Error Boundaries

Catch React component errors and prevent app crashes:

```tsx
import { ErrorBoundary } from '@/components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Send to error tracking service
        console.error('Error caught:', error, errorInfo);
      }}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### 2. API Client with Retry Logic

Automatic retry with exponential backoff:

```typescript
import { apiRequest } from '@/lib/api-client';

// Automatically retries failed requests
const user = await apiRequest<User>({
  method: 'POST',
  url: '/api/v1/users/',
  data: userData,
});
```

**Retry Strategy:**
- Retries network errors automatically
- Retries 5xx server errors
- Uses exponential backoff (2s, 4s, 8s...)
- Configurable retry attempts

### 3. Form Validation

Client-side validation with Zod:

```typescript
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid characters'),
});

const { register, handleSubmit, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});
```

### 4. API State Management Hook

Custom hook for API request state:

```typescript
import { useApi } from '@/hooks/useApi';

function MyComponent() {
  const { data, loading, error, execute, reset } = useApi(createUser);

  const handleSubmit = async (formData) => {
    const result = await execute(formData);
    if (result) {
      // Success
    }
  };

  return (
    <>
      {error && <ErrorMessage error={error} onDismiss={reset} />}
      {loading && <LoadingSpinner />}
      {data && <SuccessMessage data={data} />}
    </>
  );
}
```

## Error Types

### Custom Error Classes

```typescript
import {
  AppError,
  NetworkError,
  ValidationError,
  UnauthorizedError,
  NotFoundError
} from '@/types/errors';

// Network error
throw new NetworkError();

// Validation error
throw new ValidationError('Invalid input', { field: 'email' });

// Not found error
throw new NotFoundError('User', userId);
```

### Error Response Structure

All API errors follow this format:

```typescript
interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
}
```

## Best Practices

### 1. Always Handle Errors

```typescript
// ✅ Good
try {
  const data = await apiRequest({ ... });
  return data;
} catch (error) {
  if (error instanceof ValidationError) {
    // Handle validation error
  } else if (error instanceof NetworkError) {
    // Handle network error
  } else {
    // Handle unexpected error
  }
}

// ❌ Bad
const data = await apiRequest({ ... }); // Unhandled errors
```

### 2. Use Error Boundaries for Component Errors

```tsx
// ✅ Good - Wrap risky components
<ErrorBoundary>
  <ComplexComponent />
</ErrorBoundary>

// ❌ Bad - No error boundary
<ComplexComponent /> // Can crash entire app
```

### 3. Provide User-Friendly Messages

```typescript
// ✅ Good
if (error instanceof NetworkError) {
  setMessage('Unable to connect. Please check your internet.');
}

// ❌ Bad
setMessage(error.toString()); // Shows technical details
```

### 4. Show Loading States

```tsx
// ✅ Good
{loading && <LoadingSpinner />}
{!loading && data && <UserList users={data} />}

// ❌ Bad
<UserList users={data} /> // Undefined data during loading
```

### 5. Validate Early

```typescript
// ✅ Good - Validate before API call
const validation = schema.safeParse(formData);
if (!validation.success) {
  showErrors(validation.error);
  return;
}
await apiRequest({ data: validation.data });

// ❌ Bad - No client-side validation
await apiRequest({ data: formData }); // Wasted network request
```

## Common Patterns

### Optimistic Updates with Rollback

```typescript
function useOptimisticUpdate() {
  const [users, setUsers] = useState<User[]>([]);

  const deleteUser = async (userId: number) => {
    // Optimistic update
    const previous = users;
    setUsers(users.filter(u => u.id !== userId));

    try {
      await apiRequest({
        method: 'DELETE',
        url: `/api/v1/users/${userId}`
      });
    } catch (error) {
      // Rollback on error
      setUsers(previous);
      throw error;
    }
  };

  return { users, deleteUser };
}
```

### Debounced API Calls

```typescript
import { useMemo, useState } from 'react';
import { debounce } from 'lodash';

function useSearch() {
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const search = useMemo(
    () => debounce(async (query: string) => {
      try {
        const data = await apiRequest({
          url: '/api/v1/search',
          params: { q: query }
        });
        setResults(data);
        setError(null);
      } catch (err) {
        setError(err);
        setResults([]);
      }
    }, 300),
    []
  );

  return { results, error, search };
}
```

### Request Cancellation

```typescript
import { useEffect, useRef } from 'react';
import axios from 'axios';

function useCancellableRequest() {
  const cancelTokenRef = useRef<CancelTokenSource>();

  useEffect(() => {
    // Cancel on unmount
    return () => {
      cancelTokenRef.current?.cancel('Component unmounted');
    };
  }, []);

  const fetchData = async () => {
    // Cancel previous request
    cancelTokenRef.current?.cancel('New request started');

    // Create new cancel token
    cancelTokenRef.current = axios.CancelToken.source();

    try {
      const data = await apiRequest({
        url: '/api/v1/data',
        cancelToken: cancelTokenRef.current.token,
      });
      return data;
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log('Request cancelled');
      } else {
        throw error;
      }
    }
  };

  return fetchData;
}
```

## Testing

### Test Error Handling

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('shows validation error for invalid email', async () => {
  render(<UserForm />);

  const emailInput = screen.getByLabelText(/email/i);
  await userEvent.type(emailInput, 'invalid-email');

  const submitButton = screen.getByRole('button', { name: /submit/i });
  await userEvent.click(submitButton);

  expect(await screen.findByText(/invalid email/i)).toBeInTheDocument();
});

test('shows network error when API fails', async () => {
  // Mock API failure
  jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

  render(<UserList />);

  expect(await screen.findByText(/unable to connect/i)).toBeInTheDocument();
});
```

### Test Error Boundaries

```typescript
test('error boundary catches component error', () => {
  const ThrowError = () => {
    throw new Error('Test error');
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
});
```

## Production Checklist

- [ ] Add error tracking service (Sentry, LogRocket)
- [ ] Configure proper API URL
- [ ] Enable production build optimizations
- [ ] Remove console.logs or use proper logger
- [ ] Add performance monitoring
- [ ] Set up error alerting
- [ ] Test all error scenarios
- [ ] Implement analytics for errors
- [ ] Add user feedback mechanism
- [ ] Configure retry strategies
- [ ] Set appropriate timeouts
- [ ] Implement request cancellation
- [ ] Add loading skeletons
- [ ] Handle offline scenarios

## Debugging Tips

1. **Check Network Tab**: Inspect failed requests in browser DevTools
2. **Review Console Logs**: API client logs all requests/responses
3. **Use Correlation IDs**: Match frontend errors with backend logs
4. **Test Error States**: Use browser DevTools to throttle network
5. **Error Tracking**: Use Sentry/LogRocket to capture production errors

## Resources

- [React Error Boundaries](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Axios Retry](https://github.com/softonic/axios-retry)
- [Zod Documentation](https://zod.dev/)
- [React Hook Form](https://react-hook-form.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
