import { ADD_ARTIFACT_PROMPT, BASE_PROMPT, REGENERATE_PROMPT, UPDATE_FROM_CONTEXT_PROMPT } from "./aiPrompts";

export type AiProviderName = 'gemini' | 'openai' | 'claude';
export type ImageProviderName = 'random' | 'pexels' | 'unsplash' | 'pixabay';
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

const createResponseText = async (
  provider: AiProviderName,
  prompt: string,
  temperature: number,
  imageData?: string | null
) => {
  return callWithRetry(async () => {
    const apiBaseUrl = getApiBaseUrl();
    if (!apiBaseUrl) throw new Error(getApiError());
    const response = await fetch(`${apiBaseUrl}/artifact/ai`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider, prompt, temperature, imageData })
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
const extractKeywords = (sentence: string): string => {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'with', 'by', 'of', 'for', 'to', 'from',
    'view', 'shot', 'detail', 'macro', 'close-up', 'closeup', 'portrait', 'landscape',
    'image', 'photo', 'picture', 'background', 'texture', 'pattern', 'concept',
    'showing', 'looking', 'wearing', 'standing', 'sitting', 'walking', 'running',
    'beautiful', 'amazing', 'style', 'illustration', 'vector', 'graphic'
  ]);
  const words = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => !stopWords.has(w) && w.length > 2);
  if (words.length === 0) return sentence.split(/\s+/).slice(0, 2).join(' ');
  return words.slice(0, 3).join(' ');
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
  searchFn: (query: string) => Promise<string | null>
): Promise<string | null> => {
  const cleanTerm = term.trim();
  const keywordList = cleanTerm
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const queries = keywordList.length > 0 ? keywordList : [cleanTerm];

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

const searchImageProvider = async (
  provider: 'pexels' | 'unsplash' | 'pixabay',
  query: string,
  usedUrls: Set<string>,
  color?: string
): Promise<string | null> => {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl) return null;
  try {
    const response = await fetch(`${apiBaseUrl}/artifact/images/search`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider,
        query,
        color,
        excludeUrls: Array.from(usedUrls)
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
async function fetchPexelsImage(term: string, usedUrls: Set<string>, color?: string): Promise<string> {
  const searchPexels = async (query: string): Promise<string | null> => {
    return await searchImageProvider('pexels', query, usedUrls, color);
  };

  const result = await searchWithVariants(term, searchPexels);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchUnsplashImage(term: string, usedUrls: Set<string>): Promise<string> {
  const searchUnsplash = async (query: string): Promise<string | null> => {
    return await searchImageProvider('unsplash', query, usedUrls);
  };

  const result = await searchWithVariants(term, searchUnsplash);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchPixabayImage(term: string, usedUrls: Set<string>): Promise<string> {
  const searchPixabay = async (query: string): Promise<string | null> => {
    return await searchImageProvider('pixabay', query, usedUrls);
  };

  const result = await searchWithVariants(term, searchPixabay);
  return result || FALLBACK_IMAGE_URL;
}

const getAvailableImageProviders = (): ImageProviderName[] => {
  return ['pexels', 'unsplash', 'pixabay'];
};

const pickImageProvider = (provider: ImageProviderName): ImageProviderName => {
  if (provider !== 'random') return provider;
  const available = getAvailableImageProviders();
  if (available.length === 0) return 'pexels';
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
};

async function fetchImageByProvider(
  provider: ImageProviderName,
  term: string,
  usedUrls: Set<string>,
  color?: string
): Promise<string> {
  const resolved = pickImageProvider(provider);
  if (resolved === 'unsplash') return await fetchUnsplashImage(term, usedUrls);
  if (resolved === 'pixabay') return await fetchPixabayImage(term, usedUrls);
  return await fetchPexelsImage(term, usedUrls, color);
}

const replaceImagePlaceholders = async (
  html: string,
  excludedUrls: string[] = [],
  paletteSource?: string,
  imageProvider: ImageProviderName = 'pexels'
): Promise<string> => {
  const usedUrls = new Set<string>(excludedUrls);
  const regex = /{{IMAGE:(.*?)}}/g;
  const matches = [...html.matchAll(regex)];
  if (matches.length === 0) return html;

  let newHtml = html;
  const paletteColor = extractPaletteColor(paletteSource || html);

  // Process sequentially to ensure we track used URLs effectively within this batch
  for (const match of matches) {
    const term = match[1];
    // We pass the Set by reference, so it gets updated inside (or we update it here)
    // fetchPexelsImage updates the set inside.
    const url = await fetchImageByProvider(imageProvider, term, usedUrls, paletteColor);

    // Replace ONLY the first occurrence of this specific match string in the current html state
    // This handles cases where {{IMAGE:cat}} appears twice; the first loop replaces the first one,
    // the second loop replaces the second one (which is now the first one remaining).
    newHtml = newHtml.replace(match[0], url);
  }

  return newHtml;
};

export const generateArtifacts = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  contextHtml?: string,
  imageData?: string | null
): Promise<string> => {
  try {
    const finalPrompt = BASE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode);
    const promptWithContext = contextHtml
      ? `${finalPrompt}\n\nCONTEXT_HTML:\n${contextHtml}`
      : finalPrompt;
    const text = await createResponseText(provider, promptWithContext, 1.5, imageData);
    return await replaceImagePlaceholders(text, [], undefined, imageProvider);
  } catch (error) {
    console.error("Error generating artifacts:", error);
    throw error;
  }
};

export const updateArtifactsFromContext = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  contextHtml: string,
  imageProvider: ImageProviderName,
  imageData?: string | null
): Promise<string> => {
  try {
    const finalPrompt = UPDATE_FROM_CONTEXT_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode)
      .replace(/{contextHtml}/g, contextHtml);
    const text = await createResponseText(provider, finalPrompt, 0.7, imageData);
    return await replaceImagePlaceholders(text, [], undefined, imageProvider);
  } catch (error) {
    console.error("Error updating artifacts:", error);
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
  imageData?: string | null
): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = REGENERATE_PROMPT
      .replace('{topic}', topic)
      .replace('{artifact_mode}', artifactMode)
      .replace('{cssContext}', truncatedCss)
      .replace('{currentArtifact}', currentArtifact);

    const text = await createResponseText(provider, filledPrompt, 0.7, imageData);
    const sectionHtml = extractArtifactSection(text, artifactMode);
    return await replaceImagePlaceholders(sectionHtml, excludedImages, cssContext, imageProvider);
  } catch (error) {
    console.error("Error regenerating artifact:", error);
    throw error;
  }
};

export const generateNewArtifact = async (
  provider: AiProviderName,
  topic: string,
  cssContext: string,
  excludedImages: string[] = [],
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName,
  imageData?: string | null
): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = ADD_ARTIFACT_PROMPT
      .replace('{topic}', topic)
      .replace('{artifact_mode}', artifactMode)
      .replace('{cssContext}', truncatedCss);

    const text = await createResponseText(provider, filledPrompt, 0.7, imageData);
    const sectionHtml = extractArtifactSection(text, artifactMode);
    return await replaceImagePlaceholders(sectionHtml, excludedImages, cssContext, imageProvider);
  } catch (error) {
    console.error("Error adding artifact:", error);
    throw error;
  }
};










