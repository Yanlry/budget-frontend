import {
  AuthResponse,
  ChangePasswordPayload,
  ExportMyDataResponse,
  LoginApplePayload,
  LoginPayload,
  RegisterPushTokenPayload,
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

export async function loginWithApple(payload: LoginApplePayload) {
  const { data } = await apiClient.post<AuthResponse>('/auth/apple', payload);
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

export async function registerPushToken(payload: RegisterPushTokenPayload) {
  const { data } = await apiClient.post<{ success: boolean }>(
    '/auth/push-token',
    payload,
  );
  return data;
}

export async function exportMyData() {
  const { data } = await apiClient.get<ExportMyDataResponse>('/auth/export');
  return data;
}

export async function deleteMyAccount() {
  const { data } = await apiClient.delete<{ success: boolean }>('/auth/me');
  return data;
}
