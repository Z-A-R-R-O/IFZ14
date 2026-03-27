import { buildApiHeaders } from './client';

export const AUTH_SESSION_TOKEN_KEY = 'ifz14-api-session-token';

type RemoteAuthUser = {
  id: string;
  email: string;
  name?: string;
};

type RemoteAuthResponse = {
  ok: boolean;
  user?: RemoteAuthUser;
  sessionToken?: string | null;
  message?: string;
};

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

export function isRemoteAuthEnabled() {
  return Boolean(getApiBaseUrl());
}

export function readSessionToken() {
  return localStorage.getItem(AUTH_SESSION_TOKEN_KEY);
}

export function writeSessionToken(token: string | null) {
  if (!token) {
    localStorage.removeItem(AUTH_SESSION_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_SESSION_TOKEN_KEY, token);
}

async function parseResponse<T>(response: Response) {
  const data = await response.json() as T;
  return data;
}

export async function fetchAuthConfig() {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return { sessionAuthEnabled: false };

  const response = await fetch(`${apiBaseUrl}/api/auth/config`, {
    headers: buildApiHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Failed to load auth config: ${response.status}`);
  }
  return parseResponse<{ ok: boolean; sessionAuthEnabled: boolean }>(response);
}

export async function remoteSignIn(email: string, password: string) {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/signin`, {
    method: 'POST',
    headers: buildApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ email, password }),
  });

  const data = await parseResponse<RemoteAuthResponse>(response);
  if (!response.ok || !data.ok || !data.user) {
    throw new Error(data.message || 'Failed to sign in');
  }
  return data;
}

export async function remoteSignUp(input: { name?: string; email: string; password: string }) {
  const apiBaseUrl = getApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/api/auth/signup`, {
    method: 'POST',
    headers: buildApiHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(input),
  });

  const data = await parseResponse<RemoteAuthResponse>(response);
  if (!response.ok || !data.ok || !data.user) {
    throw new Error(data.message || 'Failed to sign up');
  }
  return data;
}

export async function remoteGetMe() {
  const apiBaseUrl = getApiBaseUrl();
  const token = readSessionToken();
  if (!apiBaseUrl || !token) return null;

  const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
    headers: buildApiHeaders({
      Authorization: `Bearer ${token}`,
    }),
  });

  if (response.status === 401) {
    writeSessionToken(null);
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to resolve session: ${response.status}`);
  }

  const data = await parseResponse<{ ok: boolean; user?: RemoteAuthUser }>(response);
  return data.user || null;
}
