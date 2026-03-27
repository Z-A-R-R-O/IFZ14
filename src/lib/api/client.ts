function getApiAccessKey() {
  return (import.meta.env.VITE_API_ACCESS_KEY || '').trim();
}

function getSessionToken() {
  return localStorage.getItem('ifz14-api-session-token');
}

export function buildApiHeaders(extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    ...(extraHeaders || {}),
  };

  const apiAccessKey = getApiAccessKey();
  if (apiAccessKey) {
    headers['x-ifz14-api-key'] = apiAccessKey;
  }

  const sessionToken = getSessionToken();
  if (sessionToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${sessionToken}`;
  }

  return headers;
}
