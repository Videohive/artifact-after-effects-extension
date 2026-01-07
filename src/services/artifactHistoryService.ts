import { AiProviderName } from './aiService';
import { getAuthToken } from './authService';

export type ArtifactHistoryItem = {
  id: string;
  name: string;
  provider?: AiProviderName;
  prompt?: string;
  createdAt: string;
  updatedAt: string;
  status?: 'pending' | 'done' | 'error';
  errorMessage?: string;
};

export type ArtifactHistoryPage = {
  items: ArtifactHistoryItem[];
  nextCursor: string | null;
  hasMore: boolean;
};

export type ArtifactHistoryDetail = ArtifactHistoryItem & {
  response: string;
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

const getAuthHeader = () => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('Please sign in to access artifacts.');
  }
  return { authorization: `Bearer ${token}` };
};

const mapHistoryItem = (item: any): ArtifactHistoryItem => {
  const mapped: ArtifactHistoryItem = {
    id: item?._id || item?.id || '',
    name: item?.name || '',
    createdAt: item?.createdAt || '',
    updatedAt: item?.updatedAt || '',
    status: item?.status || undefined,
    errorMessage: item?.errorMessage || undefined,
  };
  return mapped;
};

export const listArtifactHistory = async (
  options: { limit?: number; cursor?: string | null } = {}
): Promise<ArtifactHistoryPage> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const authHeader = getAuthHeader();
  const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 50;
  const cursor = options.cursor ? options.cursor.trim() : '';
  const url = new URL(`${apiBaseUrl}/artifact/history`);
  url.searchParams.set('limit', String(limit));
  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: authHeader,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`History API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const items = Array.isArray(data?.items) ? data.items.map(mapHistoryItem) : [];
  const serverCursor =
    typeof data?.nextCursor === 'string' && data.nextCursor.trim() ? data.nextCursor : null;
  const serverHasMore = typeof data?.hasMore === 'boolean' ? data.hasMore : null;
  const fallbackCursor =
    items.length > 0 ? `${items[items.length - 1].updatedAt}|${items[items.length - 1].id}` : null;
  const hasMore = serverHasMore ?? (items.length === limit);
  const nextCursor = serverCursor ?? (hasMore ? fallbackCursor : null);
  return { items, nextCursor, hasMore };
};

export const getArtifactHistory = async (id: string): Promise<ArtifactHistoryDetail> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const authHeader = getAuthHeader();
  const response = await fetch(`${apiBaseUrl}/artifact/history/${id}`, {
    method: 'GET',
    headers: authHeader,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`History API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const artifact = data?.artifact || {};
  return {
    ...mapHistoryItem(artifact),
    response: artifact?.response || '',
  };
};

export const createArtifactHistory = async (payload: {
  name?: string;
  provider: AiProviderName;
  prompt: string;
  response?: string;
}): Promise<ArtifactHistoryDetail> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const authHeader = getAuthHeader();
  const response = await fetch(`${apiBaseUrl}/artifact/history`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeader },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`History API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const artifact = data?.artifact || {};
  return {
    ...mapHistoryItem(artifact),
    response: artifact?.response || '',
  };
};

export const updateArtifactHistory = async (
  id: string,
  payload: { name?: string; response?: string; prompt?: string; provider?: AiProviderName }
): Promise<ArtifactHistoryDetail> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const authHeader = getAuthHeader();
  const response = await fetch(`${apiBaseUrl}/artifact/history/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', ...authHeader },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`History API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const artifact = data?.artifact || {};
  return {
    ...mapHistoryItem(artifact),
    response: artifact?.response || '',
  };
};

export const deleteArtifactHistory = async (id: string): Promise<void> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) throw new Error(getApiError());
  const authHeader = getAuthHeader();
  const response = await fetch(`${apiBaseUrl}/artifact/history/${id}`, {
    method: 'DELETE',
    headers: authHeader,
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`History API error (${response.status}): ${errorText}`);
  }
};

