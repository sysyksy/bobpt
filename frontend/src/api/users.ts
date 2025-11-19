/**
 * User API endpoints with type-safe requests.
 */
import { apiRequest } from '@/lib/api-client';

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string | null;
  created_at: string;
  is_active: boolean;
}

export interface CreateUserData {
  email: string;
  username: string;
  full_name?: string;
}

/**
 * Create a new user.
 */
export async function createUser(data: CreateUserData): Promise<User> {
  return apiRequest<User>({
    method: 'POST',
    url: '/api/v1/users/',
    data,
  });
}

/**
 * Get user by ID.
 */
export async function getUser(id: number): Promise<User> {
  return apiRequest<User>({
    method: 'GET',
    url: `/api/v1/users/${id}`,
  });
}

/**
 * List all users.
 */
export async function listUsers(params?: {
  is_active?: boolean;
  limit?: number;
}): Promise<User[]> {
  return apiRequest<User[]>({
    method: 'GET',
    url: '/api/v1/users/',
    params,
  });
}

/**
 * Delete user by ID.
 */
export async function deleteUser(id: number): Promise<void> {
  return apiRequest<void>({
    method: 'DELETE',
    url: `/api/v1/users/${id}`,
  });
}
