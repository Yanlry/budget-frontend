import axios from 'axios';
import Constants from 'expo-constants';

const PRODUCTION_API_URL = 'https://api.simplyrich.app';

function resolveApiUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (envUrl) {
    return envUrl;
  }

  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as unknown as { manifest2?: { extra?: { expoClient?: { hostUri?: string } } } })
      .manifest2?.extra?.expoClient?.hostUri;

  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host) {
      return `http://${host}:3000`;
    }
  }

  return 'http://localhost:3000';
}

export const API_URL = resolveApiUrl();

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.message === 'Network Error') {
      return `Connexion impossible a l'API (${API_URL}). Verifie que le backend tourne et que l'URL API est correcte.`;
    }

    return (
      (error.response?.data as { message?: string })?.message ??
      error.message ??
      'Une erreur est survenue.'
    );
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Une erreur est survenue.';
}
