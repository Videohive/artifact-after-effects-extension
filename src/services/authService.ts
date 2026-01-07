type AuthUser = {
  _id?: string;
  email?: string;
  login?: string;
  name?: string;
  role?: string;
};

const DEFAULT_API_BASE_URL = 'https://api.ae2authors.net';

const getApiBaseUrl = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    const fromProcess = process.env.REACT_APP_API_BASE_URL || process.env.API_BASE_URL;
    if (fromProcess && fromProcess.trim()) return fromProcess.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      API_BASE_URL?: string;
      REACT_APP_API_BASE_URL?: string;
      __ENV__?: { API_BASE_URL?: string; REACT_APP_API_BASE_URL?: string };
    };
    const fromWindow =
      win.REACT_APP_API_BASE_URL ||
      win.API_BASE_URL ||
      win.__ENV__?.REACT_APP_API_BASE_URL ||
      win.__ENV__?.API_BASE_URL;
    if (fromWindow && fromWindow.trim()) return fromWindow.replace(/\/$/, '');
  }
  return DEFAULT_API_BASE_URL;
};

const getApiError = () =>
  'API base URL is missing. Set REACT_APP_API_BASE_URL in .env.local and restart `npm start`.';

export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('jwt');
};

export const setAuthToken = (token: string) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('jwt', token);
};

export const clearAuthToken = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('jwt');
};

export const login = async (email: string, password: string): Promise<string> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const response = await fetch(`${apiBaseUrl}/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || 'Login failed');
  }
  if (!data?.token) {
    throw new Error('JWT token is missing.');
  }
  setAuthToken(data.token);
  return data.token as string;
};

export const fetchCurrentUser = async (): Promise<AuthUser> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const token = getAuthToken();
  if (!token) {
    throw new Error('Not authenticated');
  }
  const response = await fetch(`${apiBaseUrl}/users/me`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || 'Failed to load user');
  }
  return data as AuthUser;
};
