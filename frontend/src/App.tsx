/**
 * Main application component demonstrating error handling and API integration.
 */
import React, { useState } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorMessage } from '@/components/ErrorMessage';
import { UserForm } from '@/components/UserForm';
import { useApi } from '@/hooks/useApi';
import { createUser, CreateUserData, User } from '@/api/users';

function App() {
  const [createdUser, setCreatedUser] = useState<User | null>(null);
  const { data, loading, error, execute, reset } = useApi(createUser);

  const handleCreateUser = async (formData: CreateUserData) => {
    const result = await execute(formData);
    if (result) {
      setCreatedUser(result);
    }
  };

  const handleDismissError = () => {
    reset();
  };

  return (
    <ErrorBoundary>
      <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '2rem' }}>BobPT - Error Handling Demo</h1>

        <div
          style={{
            padding: '1.5rem',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h2 style={{ marginTop: 0 }}>Features Demonstrated:</h2>
          <ul style={{ marginBottom: 0 }}>
            <li>React Error Boundaries for runtime error catching</li>
            <li>Client-side form validation with Zod</li>
            <li>API client with automatic retry logic</li>
            <li>Structured error handling and user feedback</li>
            <li>TypeScript for type safety</li>
            <li>Loading states and optimistic updates</li>
          </ul>
        </div>

        <ErrorMessage error={error} onDismiss={handleDismissError} />

        {createdUser && (
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: '#ecfdf5',
              border: '1px solid #6ee7b7',
              borderRadius: '6px',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#065f46' }}>Success!</h3>
            <p style={{ margin: 0, color: '#047857' }}>
              User created: {createdUser.username} ({createdUser.email})
            </p>
          </div>
        )}

        <h2>Create New User</h2>
        <UserForm onSubmit={handleCreateUser} isSubmitting={loading} />

        <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#6b7280' }}>
          <p>
            <strong>Try these to see error handling:</strong>
          </p>
          <ul>
            <li>Submit without filling required fields</li>
            <li>Enter an invalid email</li>
            <li>Use a username with special characters</li>
            <li>Create a user twice with the same username</li>
          </ul>
        </div>
      </div>
    </ErrorBoundary>
  );
}

export default App;
