/**
 * User form component with validation using React Hook Form and Zod.
 */
import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CreateUserData } from '@/api/users';

// Validation schema using Zod
const userSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must not exceed 50 characters')
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      'Username can only contain letters, numbers, underscores, and hyphens'
    ),
  full_name: z.string().max(100).optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserFormProps {
  onSubmit: (data: CreateUserData) => Promise<void>;
  isSubmitting?: boolean;
}

/**
 * Form for creating a new user with client-side validation.
 */
export function UserForm({ onSubmit, isSubmitting = false }: UserFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const onSubmitHandler = async (data: UserFormData) => {
    await onSubmit(data);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmitHandler)} style={{ maxWidth: '400px' }}>
      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="email"
          style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
        >
          Email *
        </label>
        <input
          {...register('email')}
          type="email"
          id="email"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: errors.email ? '1px solid #dc2626' : '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
        {errors.email && (
          <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {errors.email.message}
          </p>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="username"
          style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
        >
          Username *
        </label>
        <input
          {...register('username')}
          type="text"
          id="username"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: errors.username ? '1px solid #dc2626' : '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
        {errors.username && (
          <p style={{ color: '#dc2626', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {errors.username.message}
          </p>
        )}
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label
          htmlFor="full_name"
          style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}
        >
          Full Name
        </label>
        <input
          {...register('full_name')}
          type="text"
          id="full_name"
          disabled={isSubmitting}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            fontSize: '1rem',
          }}
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: isSubmitting ? '#9ca3af' : '#2563eb',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: isSubmitting ? 'not-allowed' : 'pointer',
          fontWeight: 500,
        }}
      >
        {isSubmitting ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}
