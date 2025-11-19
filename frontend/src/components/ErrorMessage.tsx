/**
 * Reusable error message component for displaying errors to users.
 */
import React from 'react';
import { AppError } from '@/types/errors';

interface ErrorMessageProps {
  error: Error | AppError | null;
  onDismiss?: () => void;
}

/**
 * Display user-friendly error messages.
 */
export function ErrorMessage({ error, onDismiss }: ErrorMessageProps) {
  if (!error) return null;

  const isAppError = error instanceof AppError;
  const message = error.message;
  const code = isAppError ? error.code : 'ERROR';

  return (
    <div
      role="alert"
      style={{
        padding: '1rem',
        marginBottom: '1rem',
        backgroundColor: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontWeight: 600,
            color: '#dc2626',
            marginBottom: '0.25rem',
          }}
        >
          {code}
        </div>
        <div style={{ color: '#991b1b' }}>{message}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            marginLeft: '1rem',
            padding: '0.25rem 0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            color: '#dc2626',
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: 1,
          }}
          aria-label="Dismiss error"
        >
          ×
        </button>
      )}
    </div>
  );
}
