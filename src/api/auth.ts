import {
  AuthResponse,
  ChangePasswordPayload,
  LoginPayload,
  RegisterPayload,
  UpdateMePayload,
  User,
} from '../types/api';
import { apiClient } from './client';

export async function register(payload: RegisterPayload) {
  const { data } = await apiClient.post<AuthResponse>('/auth/register', payload);
  return data;
}

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<AuthResponse>('/auth/login', payload);
  return data;
}

export async function me() {
  const { data } = await apiClient.get<User>('/auth/me');
  return data;
}

export async function updateMe(payload: UpdateMePayload) {
  const { data } = await apiClient.patch<User>('/auth/me', payload);
  return data;
}

export async function changePassword(payload: ChangePasswordPayload) {
  const { data } = await apiClient.patch<{ success: boolean }>(
    '/auth/password',
    payload,
  );
  return data;
}
