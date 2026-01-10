import {
  ADD_ARTIFACT_PROMPT,
  APPLY_MOTION_PROMPT,
  ART_DIRECTION_PROMPT,
  BASE_PROMPT,
  CACHE_PRIMER_CONTEXT,
  MOTION_CACHE_CONTEXT,
  REGENERATE_PROMPT,
  UPDATE_FROM_CONTEXT_PROMPT
} from "./aiPrompts";
import { getAuthToken } from "./authService";

export type AiProviderName = 'gemini' | 'openai' | 'claude';
export type ImageProviderName = 'random' | 'pexels' | 'unsplash' | 'pixabay' | 'placeholder';
export type MediaKind = 'image' | 'video' | 'random';
export type ImageDataInput = string | string[] | null | undefined;
export type ArtifactMode =
  | 'auto'
  | 'slides'
  | 'icons'
  | 'patterns'
  | 'textures'
  | 'type-specimen'
  | 'ui-modules'
  | 'covers'
  | 'posters'
  | 'grids'
  | 'dividers'
  | 'mixed';

const DEFAULT_API_BASE_URL = 'https://api.ae2authors.net';

// Helper: Exponential backoff for 429 errors
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, backoff = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.code === 429 || error.message?.includes('429'))) {
      console.warn(`Rate limited. Retrying in ${backoff}ms... (${retries} retries left)`);
      await wait(backoff);
      return callWithRetry(fn, retries - 1, backoff * 2);
    }
    throw error;
  }
}

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

const cleanResponseText = (text: string) =>
  text.replace(/```html/g, "").replace(/```/g, "");

type StreamEventHandler = (event: { type: string; [key: string]: any }) => void;

const normalizeImageData = (imageData?: ImageDataInput) => {
  if (!imageData) {
    return { imageData: null as string | null, imageDataList: [] as string[] };
  }
  if (Array.isArray(imageData)) {
    const compact = imageData.filter(Boolean);
    return { imageData: compact[0] ?? null, imageDataList: compact };
  }
  return { imageData, imageDataList: [imageData] };
};

const streamSseResponse = async (
  response: Response,
  onEvent?: StreamEventHandler
): Promise<{ finalHtml: string }> => {
  if (!response.body) {
    throw new Error('Stream response is empty.');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finalHtml = '';

  const processChunk = (chunk: string) => {
    buffer += chunk;
    let index;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const lines = rawEvent.split('\n');
      let eventName = 'message';
      const dataLines: string[] = [];
      lines.forEach(line => {
        if (line.startsWith('event:')) {
          eventName = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.replace('data:', '').trim());
        }
      });
      const dataRaw = dataLines.join('\n');
      if (!dataRaw) return;
      let parsed: any = dataRaw;
      try {
        parsed = JSON.parse(dataRaw);
      } catch {
        parsed = { message: dataRaw };
      }
      const event = { type: eventName, ...parsed };
      if (eventName === 'done' && typeof event.html === 'string') {
        finalHtml = event.html;
      }
      if (typeof onEvent === 'function') {
        onEvent(event);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    processChunk(decoder.decode(value, { stream: true }));
  }

  if (buffer.trim()) {
    processChunk('\n\n');
  }

  return { finalHtml };
};

const extractJsonCandidate = (text: string): string => {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return text.trim();
  return text.slice(start, end + 1).trim();
};

const normalizeArtDirectionJson = (text: string): string => {
  const trimmed = text.trim();
  if (!trimmed) return '{}';
  const candidate = extractJsonCandidate(trimmed);
  try {
    const parsed = JSON.parse(candidate);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return candidate;
  }
};

const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const isVideoUrl = (value?: string | null) => !!value && VIDEO_EXT_RE.test(value);

const createResponseText = async (
  provider: AiProviderName,
  prompt: string,
  temperature: number,
  imageData?: ImageDataInput,
  options?: { autoRefine?: boolean; extraBody?: Record<string, unknown> }
) => {
  return callWithRetry(async () => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) throw new Error(getApiError());
    const imagePayload = normalizeImageData(imageData);
    const token = getAuthToken();
    const response = await fetch(`${apiBaseUrl}/artifact/ai`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        provider,
        prompt,
        temperature,
        imageData: imagePayload.imageData,
        imageDataList: imagePayload.imageDataList.length > 0 ? imagePayload.imageDataList : undefined,
        autoRefine: options?.autoRefine ?? false,
        ...(options?.extraBody || {})
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const rawText = data?.text || data?.response || '';
    // console.log('[AI raw response]', { provider, rawText, responseData: data });
    if (!rawText) {
      // console.warn('[AI raw response] empty payload', { provider, responseData: data });
    }
    return cleanResponseText(rawText);
  });
};

const createStreamedResponseText = async (
  provider: AiProviderName,
  prompt: string,
  temperature: number,
  imageData?: ImageDataInput,
  onEvent?: StreamEventHandler,
  options?: { autoRefine?: boolean; extraBody?: Record<string, unknown> }
): Promise<{ text: string }> => {
  return callWithRetry(async () => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) throw new Error(getApiError());
    const imagePayload = normalizeImageData(imageData);
    const token = getAuthToken();
    const response = await fetch(`${apiBaseUrl}/artifact/ai/stream`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        provider,
        prompt,
        temperature,
        imageData: imagePayload.imageData,
        imageDataList: imagePayload.imageDataList.length > 0 ? imagePayload.imageDataList : undefined,
        autoRefine: options?.autoRefine ?? false,
        ...(options?.extraBody || {})
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }
    const { finalHtml } = await streamSseResponse(response, onEvent);
    return { text: cleanResponseText(finalHtml || '') };
  });
};

const createArtDirectionJson = async (
  provider: AiProviderName,
  topic: string,
  imageData?: ImageDataInput
): Promise<string> => {
  const artPrompt = ART_DIRECTION_PROMPT.replace(/{topic}/g, topic);
  const text = await createResponseText(provider, artPrompt, 0.6, imageData);
  return normalizeArtDirectionJson(text);
};

const createPersistedResponseText = async (
  provider: AiProviderName,
  prompt: string,
  temperature: number,
  imageData?: ImageDataInput,
  options?: {
    historyId?: string | null;
    name?: string | null;
    autoRefine?: boolean;
    extraBody?: Record<string, unknown>;
  }
): Promise<{ text: string; artifact: any | null }> => {
  return callWithRetry(async () => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) throw new Error(getApiError());
    const token = getAuthToken();
    if (!token) {
      throw new Error('Please sign in to save artifacts.');
    }
    const imagePayload = normalizeImageData(imageData);
    const response = await fetch(`${apiBaseUrl}/artifact/ai/history`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        provider,
        prompt,
        temperature,
        imageData: imagePayload.imageData,
        imageDataList: imagePayload.imageDataList.length > 0 ? imagePayload.imageDataList : undefined,
        autoRefine: options?.autoRefine ?? false,
        historyId: options?.historyId || null,
        name: options?.name,
        ...(options?.extraBody || {})
      })
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI API error (${response.status}): ${errorText}`);
    }
    const data = await response.json();
    const artifact = data?.artifact || null;
    const rawText = artifact?.response || data?.text || data?.response || '';
    return { text: cleanResponseText(rawText), artifact };
  });
};
const FALLBACK_IMAGE_URL = 'https://placehold.co/1920x1080/1a1a1a/666666?text=Image';

const shouldIncludeSlides = (artifactMode: ArtifactMode) =>
  artifactMode === 'slides' || artifactMode === 'mixed';

// Helper to safely extract a single artifact wrapper from AI response
const extractArtifactSection = (html: string, artifactMode: ArtifactMode): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const section = doc.querySelector('section');
    if (section) {
      section.classList.add('artifact');
      if (shouldIncludeSlides(artifactMode)) section.classList.add('slide');
      // CRITICAL: Strip any inline styles that might mess up fonts/layout consistency
      section.removeAttribute('style');
      return section.outerHTML;
    }
    const root = doc.body.firstElementChild;
    if (root && root instanceof HTMLElement) {
      root.classList.add('artifact');
      if (shouldIncludeSlides(artifactMode)) root.classList.add('slide');
      root.removeAttribute('style');
      return root.outerHTML;
    }
    const match = html.match(/<section[\s\S]*?<\/section>/i);
    return match ? match[0] : html;
  } catch (e) {
    return html;
  }
};

// Smart keyword extraction
const extractKeywords = (sentence: string, maxWords = 3): string => {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'with', 'by', 'of', 'for', 'to', 'from',
    'view', 'shot', 'detail', 'macro', 'close-up', 'closeup', 'portrait', 'landscape',
    'image', 'photo', 'picture', 'background', 'texture', 'pattern', 'concept',
    'showing', 'looking', 'wearing', 'standing', 'sitting', 'walking', 'running',
    'beautiful', 'amazing', 'style', 'illustration', 'vector', 'graphic'
  ]);
  const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  if (words.length === 0) return sentence.split(/\s+/).slice(0, maxWords).join(' ');
  return words.slice(0, maxWords).join(' ');
};

const buildSearchQueries = (term: string, contextHint?: string): string[] => {
  const cleanTerm = term.trim();
  const keywordList = cleanTerm
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const queries: string[] = [];
  const pushUnique = (value: string) => {
    const next = value.trim();
    if (!next) return;
    if (!queries.includes(next)) queries.push(next);
  };
  const compactContext = contextHint ? extractKeywords(contextHint, 4) : '';

  if (keywordList.length > 0) {
    pushUnique(keywordList.slice(0, 3).join(' '));
    keywordList.forEach(pushUnique);
  } else {
    pushUnique(cleanTerm);
  }

  if (compactContext) {
    if (keywordList.length > 0) {
      const primary = keywordList[0];
      const combo = keywordList.slice(0, 2).join(' ');
      pushUnique(`${primary} ${compactContext}`);
      if (combo && combo !== primary) pushUnique(`${combo} ${compactContext}`);
    } else {
      pushUnique(`${cleanTerm} ${compactContext}`);
    }
    pushUnique(compactContext);
  }

  return queries;
};

const extractDocumentContext = (source?: string): string => {
  if (!source) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(source, 'text/html');
    const parts: string[] = [];
    if (doc.title) parts.push(doc.title);
    const metaNames = ['tags', 'keywords', 'description', 'project-title'];
    metaNames.forEach(name => {
      const content = doc.querySelector(`meta[name="${name}"]`)?.getAttribute('content');
      if (content) parts.push(content);
    });
    const heading = doc.querySelector('h1,h2');
    if (heading?.textContent) parts.push(heading.textContent);
    if (parts.length === 0) parts.push(source);
    return extractKeywords(parts.join(' '), 4);
  } catch {
    return extractKeywords(source, 4);
  }
};

const extractElementContext = (element: Element): string => {
  const parts: string[] = [];
  const push = (value?: string | null) => {
    if (value && value.trim()) parts.push(value.trim());
  };
  push(element.getAttribute('id'));
  push(element.getAttribute('aria-label'));
  push(element.getAttribute('alt'));
  push(element.getAttribute('title'));
  const container = element.closest('section, article, figure, header, main') || element.parentElement;
  if (container) {
    push(container.getAttribute('id'));
    const heading = container.querySelector('h1,h2,h3,figcaption');
    if (heading?.textContent) push(heading.textContent);
  }
  return parts.length > 0 ? extractKeywords(parts.join(' '), 4) : '';
};

const extractImageUrlsFromHtml = (html: string): string[] => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgs = Array.from(doc.querySelectorAll('img')).map(img => img.src).filter(Boolean);
    const elementsWithStyle = doc.querySelectorAll('[style*="background-image"]');
    const bgImages = Array.from(elementsWithStyle)
      .map(el => {
        const style = el.getAttribute('style');
        const match = style?.match(/url\(['"]?(.*?)['"]?\)/);
        return match ? match[1] : null;
      })
      .filter(Boolean) as string[];
    return [...new Set([...imgs, ...bgImages])];
  } catch {
    return [];
  }
};

// Extract a usable palette color (hex) from generated HTML/CSS
const extractPaletteColor = (html: string): string | undefined => {
  const rootMatch = html.match(/:root\s*{([\s\S]*?)}/i);
  if (!rootMatch) return undefined;
  const rootContent = rootMatch[1];
  const pickVar = (name: string): string | undefined => {
    const re = new RegExp(`${name}\\s*:\\s*([^;]+);`, 'i');
    const m = rootContent.match(re);
    return m ? m[1].trim() : undefined;
  };
  const candidates = [
    pickVar('--brand-color'),
    pickVar('--bg-accent'),
    pickVar('--bg-main'),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    const hexMatch = c.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
    if (hexMatch) return `#${hexMatch[1]}`;
  }
  return undefined;
};

const searchWithVariants = async (
  term: string,
  searchFn: (query: string) => Promise<string | null>,
  contextHint?: string
): Promise<string | null> => {
  const queries = buildSearchQueries(term, contextHint);

  for (const q of queries) {
    if (q.split(' ').length <= 3) {
      const imageUrl = await searchFn(q);
      if (imageUrl) return imageUrl;
    }
    const keywordQuery = extractKeywords(q);
    if (keywordQuery !== q.toLowerCase()) {
      const imageUrl = await searchFn(keywordQuery);
      if (imageUrl) return imageUrl;
    }
    const words = q.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.length > 3 && lastWord !== keywordQuery) {
      const imageUrl = await searchFn(lastWord);
      if (imageUrl) return imageUrl;
    }
  }

  const genericTerms = ['abstract texture', 'minimal background', 'light gradient'];
  const randomGeneric = genericTerms[Math.floor(Math.random() * genericTerms.length)];
  return await searchFn(randomGeneric);
};

const searchMediaProvider = async (
  provider: 'pexels' | 'unsplash' | 'pixabay',
  query: string,
  usedUrls: Set<string>,
  color?: string,
  type: 'image' | 'video' = 'image'
): Promise<string | null> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return null;
  try {
    const token = getAuthToken();
    const response = await fetch(`${apiBaseUrl}/artifact/images/search`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        provider,
        query,
        color,
        excludeUrls: Array.from(usedUrls),
        type
      })
    });
    if (!response.ok) return null;
    const data = await response.json();
    const url = data?.url || null;
    if (url) usedUrls.add(url);
    return url;
  } catch (e) {
    return null;
  }
};

// Pexels API Integration
async function fetchPexelsImage(
  term: string,
  usedUrls: Set<string>,
  color?: string,
  contextHint?: string
): Promise<string> {
  const searchPexels = async (query: string): Promise<string | null> => {
    return await searchMediaProvider('pexels', query, usedUrls, color);
  };

  const result = await searchWithVariants(term, searchPexels, contextHint);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchUnsplashImage(
  term: string,
  usedUrls: Set<string>,
  contextHint?: string
): Promise<string> {
  const searchUnsplash = async (query: string): Promise<string | null> => {
    return await searchMediaProvider('unsplash', query, usedUrls);
  };

  const result = await searchWithVariants(term, searchUnsplash, contextHint);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchPixabayImage(
  term: string,
  usedUrls: Set<string>,
  contextHint?: string
): Promise<string> {
  const searchPixabay = async (query: string): Promise<string | null> => {
    return await searchMediaProvider('pixabay', query, usedUrls);
  };

  const result = await searchWithVariants(term, searchPixabay, contextHint);
  return result || FALLBACK_IMAGE_URL;
}

const getAvailableImageProviders = (): Array<'pexels' | 'unsplash' | 'pixabay'> => {
  return ['pexels', 'unsplash', 'pixabay'];
};

const getAvailableVideoProviders = (): Array<'pexels' | 'pixabay'> => {
  return ['pexels', 'pixabay'];
};

const pickImageProvider = (
  provider: ImageProviderName
): 'pexels' | 'unsplash' | 'pixabay' => {
  if (provider === 'pexels' || provider === 'unsplash' || provider === 'pixabay') {
    return provider;
  }
  const available = getAvailableImageProviders();
  if (available.length === 0) return 'pexels';
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
};

const pickVideoProvider = (provider: ImageProviderName): 'pexels' | 'pixabay' => {
  if (provider === 'pexels' || provider === 'pixabay') {
    return provider;
  }
  const available = getAvailableVideoProviders();
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
};

const pickMediaKind = (kind: MediaKind): 'image' | 'video' => {
  if (kind === 'video') return 'video';
  if (kind === 'image') return 'image';
  return Math.random() < 0.5 ? 'image' : 'video';
};

async function fetchVideoAsset(
  provider: 'pexels' | 'pixabay',
  term: string,
  usedUrls: Set<string>,
  contextHint?: string
): Promise<string> {
  const searchVideo = async (query: string): Promise<string | null> => {
    return await searchMediaProvider(provider, query, usedUrls, undefined, 'video');
  };
  const result = await searchWithVariants(term, searchVideo, contextHint);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchImageByProvider(
  provider: ImageProviderName,
  term: string,
  usedUrls: Set<string>,
  color?: string,
  contextHint?: string,
  mediaKind: MediaKind = 'image'
): Promise<string> {
  if (provider === 'placeholder') return FALLBACK_IMAGE_URL;
  const media = pickMediaKind(mediaKind);
  if (media === 'video') {
    const resolvedProvider = pickVideoProvider(provider);
    return await fetchVideoAsset(resolvedProvider, term, usedUrls, contextHint);
  }
  const resolved = pickImageProvider(provider);
  if (resolved === 'unsplash') return await fetchUnsplashImage(term, usedUrls, contextHint);
  if (resolved === 'pixabay') return await fetchPixabayImage(term, usedUrls, contextHint);
  return await fetchPexelsImage(term, usedUrls, color, contextHint);
}

const replaceImagePlaceholders = async (
  html: string,
  excludedUrls: string[] = [],
  paletteSource?: string,
  imageProvider: ImageProviderName = 'pexels',
  contextHint?: string,
  mediaKind: MediaKind = 'image'
): Promise<string> => {
  const usedUrls = new Set<string>(excludedUrls);
  const regex = /{{IMAGE:(.*?)}}/g;
  const matches = [...html.matchAll(regex)];
  if (matches.length === 0) return html;
  if (imageProvider === 'placeholder') {
    return html.replace(regex, FALLBACK_IMAGE_URL);
  }

  let newHtml = html;
  const paletteColor = extractPaletteColor(paletteSource || html);
  const globalContext = extractDocumentContext(contextHint || html);
  const tokens = matches.map((_, index) => `__AE2_IMAGE_TOKEN_${index}__`);
  let tokenizedHtml = html;
  matches.forEach((match, index) => {
    tokenizedHtml = tokenizedHtml.replace(match[0], tokens[index]);
  });
  const tokenContextMap = new Map<string, string>();
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(tokenizedHtml, 'text/html');
    const elements = Array.from(doc.querySelectorAll('*'));
    elements.forEach(element => {
      const elementContext = extractElementContext(element);
      if (!elementContext) return;
      Array.from(element.attributes).forEach(attr => {
        const value = attr.value;
        tokens.forEach(token => {
          if (value.includes(token) && !tokenContextMap.has(token)) {
            tokenContextMap.set(token, elementContext);
          }
        });
      });
    });
  } catch {
    // No-op: fallback to global context only.
  }

  // Process sequentially to ensure we track used URLs effectively within this batch
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    const term = match[1];
    const token = tokens[i];
    const localContext = tokenContextMap.get(token);
    const combinedContext = [localContext, globalContext].filter(Boolean).join(' ');
    // We pass the Set by reference, so it gets updated inside (or we update it here)
    // fetchPexelsImage updates the set inside.
    const url = await fetchImageByProvider(
      imageProvider,
      term,
      usedUrls,
      paletteColor,
      combinedContext,
      mediaKind
    );
    if (mediaKind !== 'image') {
      console.log('[media] placeholder resolved', {
        mediaKind,
        provider: imageProvider,
        term,
        url
      });
    }

    // Replace ONLY the first occurrence of this specific match string in the current html state
    // This handles cases where {{IMAGE:cat}} appears twice; the first loop replaces the first one,
    // the second loop replaces the second one (which is now the first one remaining).
    newHtml = newHtml.replace(match[0], url);
  }

  if (!VIDEO_EXT_RE.test(newHtml)) {
    return newHtml;
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<body>${newHtml}</body>`, 'text/html');
    const body = doc.body;

    const setVideoDefaults = (video: HTMLVideoElement) => {
      video.autoplay = true;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      if (!video.style.width) video.style.width = '100%';
      if (!video.style.height) video.style.height = '100%';
      if (!video.style.objectFit) video.style.objectFit = 'cover';
      if (!video.style.display) video.style.display = 'block';
    };

    const copyAttributes = (from: Element, to: Element, skip: Record<string, boolean>) => {
      Array.from(from.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        if (skip[name]) return;
        to.setAttribute(attr.name, attr.value);
      });
    };

    Array.from(body.querySelectorAll('img')).forEach(img => {
      const src = img.getAttribute('src');
      if (!isVideoUrl(src)) return;
      const video = doc.createElement('video');
      copyAttributes(img, video, { src: true, srcset: true });
      if (img.getAttribute('alt') && !video.getAttribute('aria-label')) {
        video.setAttribute('aria-label', img.getAttribute('alt') || '');
      }
      video.setAttribute('src', src || '');
      setVideoDefaults(video);
      img.replaceWith(video);
    });

    Array.from(body.querySelectorAll('video')).forEach(video => {
      const src = video.getAttribute('src') || video.querySelector('source')?.getAttribute('src');
      if (!isVideoUrl(src)) return;
      setVideoDefaults(video);
    });

    Array.from(body.querySelectorAll('[style]')).forEach(el => {
      if (!(el instanceof HTMLElement)) return;
      const styleValue = el.getAttribute('style') || '';
      if (!/background-image/i.test(styleValue)) return;
      const match = styleValue.match(/background-image\s*:\s*url\(['"]?(.*?)['"]?\)/i);
      const bgUrl = match ? match[1] : null;
      if (!isVideoUrl(bgUrl)) return;
      if (el.children.length > 0) return;
      const video = doc.createElement('video');
      copyAttributes(el, video, {});
      video.setAttribute('src', bgUrl || '');
      if (video.style.backgroundImage) video.style.backgroundImage = 'none';
      setVideoDefaults(video);
      el.replaceWith(video);
    });

    return body.innerHTML;
  } catch {
    return newHtml;
  }
};

export const generateArtifacts = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  contextHtml?: string,
  imageData?: ImageDataInput,
  options?: { autoRefine?: boolean }
): Promise<string> => {
  try {
    const autoRefine = options?.autoRefine ?? false;
    const artDirectionJson = await createArtDirectionJson(provider, topic, imageData);
    const basePrompt = BASE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{art_direction_json}/g, artDirectionJson);
    const finalPrompt = `${CACHE_PRIMER_CONTEXT}\n\n${basePrompt}`;
    const promptWithContext = contextHtml
      ? `${finalPrompt}\n\nCONTEXT_HTML:\n${contextHtml}`
      : finalPrompt;
    const text = await createResponseText(provider, promptWithContext, 1.5, imageData, {
      autoRefine,
      extraBody: autoRefine
        ? {
            perSectionRefine: true,
            refineAllSections: true,
            regeneratePromptTemplate: REGENERATE_PROMPT,
            artifactMode,
            topic
          }
        : { artifactMode, topic }
    });
    return await replaceImagePlaceholders(text, [], undefined, imageProvider, topic, mediaKind);
  } catch (error) {
    console.error("Error generating artifacts:", error);
    throw error;
  }
};

export const generateArtifactsStream = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  onEvent?: StreamEventHandler,
  imageData?: ImageDataInput,
  options?: { autoRefine?: boolean }
): Promise<string> => {
  try {
    const autoRefine = options?.autoRefine ?? false;
    const artDirectionJson = await createArtDirectionJson(provider, topic, imageData);
    const basePrompt = BASE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{art_direction_json}/g, artDirectionJson);
    const finalPrompt = `${CACHE_PRIMER_CONTEXT}\n\n${basePrompt}`;
    const response = await createStreamedResponseText(
      provider,
      finalPrompt,
      1.5,
      imageData,
      onEvent,
      {
        autoRefine,
        extraBody: autoRefine
          ? {
              perSectionRefine: true,
              refineAllSections: true,
              regeneratePromptTemplate: REGENERATE_PROMPT,
              artifactMode,
              topic
            }
          : { artifactMode, topic }
      }
    );
    if (typeof onEvent === 'function') {
      onEvent({ type: 'images' });
    }
    const text = await replaceImagePlaceholders(response.text, [], undefined, imageProvider, topic, mediaKind);
    return text;
  } catch (error) {
    console.error("Error generating artifacts (stream):", error);
    throw error;
  }
};

export const generateArtifactsPersisted = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  options?: {
    contextHtml?: string;
    imageData?: ImageDataInput;
    historyId?: string | null;
    name?: string | null;
    autoRefine?: boolean;
  }
): Promise<{ text: string; artifact: any | null }> => {
  try {
    const autoRefine = options?.autoRefine ?? false;
    const artDirectionJson = await createArtDirectionJson(provider, topic, options?.imageData);
    const basePrompt = BASE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{art_direction_json}/g, artDirectionJson);
    const finalPrompt = `${CACHE_PRIMER_CONTEXT}\n\n${basePrompt}`;
    const promptWithContext = options?.contextHtml
      ? `${finalPrompt}\n\nCONTEXT_HTML:\n${options.contextHtml}`
      : finalPrompt;
    const response = await createPersistedResponseText(
      provider,
      promptWithContext,
      1.5,
      options?.imageData,
      {
        historyId: options?.historyId,
        name: options?.name,
        autoRefine,
        extraBody: autoRefine
          ? {
              perSectionRefine: true,
              refineAllSections: true,
              regeneratePromptTemplate: REGENERATE_PROMPT,
              artifactMode,
              topic
            }
          : { artifactMode, topic }
      }
    );
    const text = await replaceImagePlaceholders(response.text, [], undefined, imageProvider, topic, mediaKind);
    return { text, artifact: response.artifact };
  } catch (error) {
    console.error('Error generating artifacts:', error);
    throw error;
  }
};
export const updateArtifactsFromContext = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  contextHtml: string,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  imageData?: ImageDataInput
): Promise<string> => {
  try {
    const finalPrompt = UPDATE_FROM_CONTEXT_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{contextHtml}/g, contextHtml);
    const text = await createResponseText(provider, finalPrompt, 0.7, imageData);
    const excluded = extractImageUrlsFromHtml(contextHtml);
    return await replaceImagePlaceholders(
      text,
      excluded,
      undefined,
      imageProvider,
      `${topic}\n${contextHtml}`,
      mediaKind
    );
  } catch (error) {
    console.error("Error updating artifacts:", error);
    throw error;
  }
};

export const updateArtifactsFromContextPersisted = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  contextHtml: string,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  options?: {
    imageData?: ImageDataInput;
    historyId?: string | null;
    name?: string | null;
  }
): Promise<{ text: string; artifact: any | null }> => {
  try {
    const finalPrompt = UPDATE_FROM_CONTEXT_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{contextHtml}/g, contextHtml);
    const response = await createPersistedResponseText(
      provider,
      finalPrompt,
      0.7,
      options?.imageData,
      { historyId: options?.historyId, name: options?.name }
    );
    const excluded = extractImageUrlsFromHtml(contextHtml);
    const text = await replaceImagePlaceholders(
      response.text,
      excluded,
      undefined,
      imageProvider,
      `${topic}\n${contextHtml}`,
      mediaKind
    );
    return { text, artifact: response.artifact };
  } catch (error) {
    console.error('Error updating artifacts:', error);
    throw error;
  }
};
export const regenerateArtifact = async (
  provider: AiProviderName,
  topic: string,
  currentArtifact: string,
  cssContext: string,
  excludedImages: string[] = [],
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  imageData?: ImageDataInput,
  contextHtml?: string
): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = REGENERATE_PROMPT
      .replace('{topic}', topic)
      .replace('{artifact_mode}', artifactMode)
      .replace('{cssContext}', truncatedCss)
      .replace('{contextHtml}', contextHtml || '')
      .replace('{currentArtifact}', currentArtifact);

    const text = await createResponseText(provider, filledPrompt, 0.7, imageData);
    const sectionHtml = extractArtifactSection(text, artifactMode);
    return await replaceImagePlaceholders(
      sectionHtml,
      excludedImages,
      cssContext,
      imageProvider,
      topic,
      mediaKind
    );
  } catch (error) {
    console.error("Error regenerating artifact:", error);
    throw error;
  }
};

export const generateNewArtifact = async (
  provider: AiProviderName,
  topic: string,
  cssContext: string,
  contextHtml: string,
  excludedImages: string[] = [],
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  mediaKind: MediaKind,
  imageData?: ImageDataInput
): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = ADD_ARTIFACT_PROMPT
      .replace('{topic}', topic)
      .replace('{artifact_mode}', artifactMode)
      .replace('{cssContext}', truncatedCss)
      .replace('{contextHtml}', contextHtml);

    const text = await createResponseText(provider, filledPrompt, 0.7, imageData);
    const sectionHtml = extractArtifactSection(text, artifactMode);
    return await replaceImagePlaceholders(
      sectionHtml,
      excludedImages,
      cssContext,
      imageProvider,
      topic,
      mediaKind
    );
  } catch (error) {
    console.error("Error adding artifact:", error);
    throw error;
  }
};

export const applyMotionToHtml = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  html: string,
  css: string
): Promise<string> => {
  try {
    const prompt = APPLY_MOTION_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{html}/g, html)
      .replace(/{css}/g, css);
    const finalPrompt = `${MOTION_CACHE_CONTEXT}\n\n${prompt}`;
    return await createResponseText(provider, finalPrompt, 0.6);
  } catch (error) {
    console.error('Error applying motion to html:', error);
    throw error;
  }
};

export const getContextCachePrimer = (): string => CACHE_PRIMER_CONTEXT;
