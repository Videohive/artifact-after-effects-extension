import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export type AiProviderName = 'gemini' | 'openai';
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

const getGeminiApiKey = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    const fromProcess =
      process.env.GEMINI_API_KEY ||
      process.env.REACT_APP_GEMINI_API_KEY ||
      process.env.REACT_APP_API_KEY ||
      process.env.API_KEY;
    if (fromProcess && fromProcess.trim()) return fromProcess;
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      GEMINI_API_KEY?: string;
      REACT_APP_GEMINI_API_KEY?: string;
      __ENV__?: { GEMINI_API_KEY?: string; REACT_APP_GEMINI_API_KEY?: string };
    };
    const fromWindow =
      win.REACT_APP_GEMINI_API_KEY ||
      win.GEMINI_API_KEY ||
      win.__ENV__?.REACT_APP_GEMINI_API_KEY ||
      win.__ENV__?.GEMINI_API_KEY;
    if (fromWindow && fromWindow.trim()) return fromWindow;
  }
  return undefined;
};

const getOpenAiApiKey = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.REACT_APP_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      OPENAI_API_KEY?: string;
      REACT_APP_OPENAI_API_KEY?: string;
      __ENV__?: { OPENAI_API_KEY?: string; REACT_APP_OPENAI_API_KEY?: string };
    };
    const fromWindow =
      win.REACT_APP_OPENAI_API_KEY ||
      win.OPENAI_API_KEY ||
      win.__ENV__?.REACT_APP_OPENAI_API_KEY ||
      win.__ENV__?.OPENAI_API_KEY;
    if (fromWindow && fromWindow.trim()) return fromWindow;
  }
  return undefined;
};

const getProviderError = (provider: AiProviderName) => {
  if (provider === 'gemini') {
    return 'API key is missing. Set REACT_APP_GEMINI_API_KEY in .env.local and restart `npm start`.';
  }
  return 'API key is missing. Set REACT_APP_OPENAI_API_KEY in .env.local and restart `npm start`.';
};

const cleanResponseText = (text: string) =>
  text.replace(/```html/g, "").replace(/```/g, "");

const createResponseText = async (provider: AiProviderName, prompt: string, temperature: number) => {
  return callWithRetry(async () => {
    if (provider === 'gemini') {
      const apiKey = getGeminiApiKey();
      if (!apiKey) throw new Error(getProviderError(provider));
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature,
        }
      });
      return cleanResponseText(response.text || '');
    }

    const apiKey = getOpenAiApiKey();
    if (!apiKey) throw new Error(getProviderError(provider));
    const client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });
    const model: string = 'gpt-5-mini';
    const payload: {
      model: string;
      input: string;
      temperature?: number;
    } = {
      model,
      input: prompt,
    };
    if (model !== 'gpt-5-mini' && model !== 'gpt-5-nano') {
      payload.temperature = temperature;
    }
    const response = await client.responses.create(payload);
    return cleanResponseText(response.output_text || "");
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

// Robust API Key Retrieval for Pexels
const getPexelsApiKey = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.PEXELS_API_KEY) return process.env.PEXELS_API_KEY;
    if (process.env.VITE_PEXELS_API_KEY) return process.env.VITE_PEXELS_API_KEY;
    if (process.env.REACT_APP_PEXELS_API_KEY) return process.env.REACT_APP_PEXELS_API_KEY;
    if (process.env.NEXT_PUBLIC_PEXELS_API_KEY) return process.env.NEXT_PUBLIC_PEXELS_API_KEY;
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      PEXELS_API_KEY?: string;
      REACT_APP_PEXELS_API_KEY?: string;
      __ENV__?: { PEXELS_API_KEY?: string; REACT_APP_PEXELS_API_KEY?: string };
    };
    const fromWindow =
      win.REACT_APP_PEXELS_API_KEY ||
      win.PEXELS_API_KEY ||
      win.__ENV__?.REACT_APP_PEXELS_API_KEY ||
      win.__ENV__?.PEXELS_API_KEY;
    if (fromWindow && fromWindow.trim()) return fromWindow;
  }
  return undefined;
};

const getUnsplashApiKey = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.UNSPLASH_ACCESS_KEY ||
      process.env.UNSPLASH_API_KEY ||
      process.env.VITE_UNSPLASH_ACCESS_KEY ||
      process.env.VITE_UNSPLASH_API_KEY ||
      process.env.REACT_APP_UNSPLASH_ACCESS_KEY ||
      process.env.REACT_APP_UNSPLASH_API_KEY ||
      process.env.NEXT_PUBLIC_UNSPLASH_ACCESS_KEY
    );
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      UNSPLASH_ACCESS_KEY?: string;
      UNSPLASH_API_KEY?: string;
      REACT_APP_UNSPLASH_ACCESS_KEY?: string;
      REACT_APP_UNSPLASH_API_KEY?: string;
      __ENV__?: {
        UNSPLASH_ACCESS_KEY?: string;
        UNSPLASH_API_KEY?: string;
        REACT_APP_UNSPLASH_ACCESS_KEY?: string;
        REACT_APP_UNSPLASH_API_KEY?: string;
      };
    };
    const fromWindow =
      win.REACT_APP_UNSPLASH_API_KEY ||
      win.REACT_APP_UNSPLASH_ACCESS_KEY ||
      win.UNSPLASH_API_KEY ||
      win.UNSPLASH_ACCESS_KEY ||
      win.__ENV__?.REACT_APP_UNSPLASH_API_KEY ||
      win.__ENV__?.REACT_APP_UNSPLASH_ACCESS_KEY ||
      win.__ENV__?.UNSPLASH_API_KEY ||
      win.__ENV__?.UNSPLASH_ACCESS_KEY;
    if (fromWindow && fromWindow.trim()) return fromWindow;
  }
  return undefined;
};

const getPixabayApiKey = (): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return (
      process.env.PIXABAY_API_KEY ||
      process.env.VITE_PIXABAY_API_KEY ||
      process.env.REACT_APP_PIXABAY_API_KEY ||
      process.env.NEXT_PUBLIC_PIXABAY_API_KEY
    );
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as {
      PIXABAY_API_KEY?: string;
      REACT_APP_PIXABAY_API_KEY?: string;
      __ENV__?: { PIXABAY_API_KEY?: string; REACT_APP_PIXABAY_API_KEY?: string };
    };
    const fromWindow =
      win.REACT_APP_PIXABAY_API_KEY ||
      win.PIXABAY_API_KEY ||
      win.__ENV__?.REACT_APP_PIXABAY_API_KEY ||
      win.__ENV__?.PIXABAY_API_KEY;
    if (fromWindow && fromWindow.trim()) return fromWindow;
  }
  return undefined;
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

// Pexels API Integration
async function fetchPexelsImage(term: string, usedUrls: Set<string>, color?: string): Promise<string> {
  const apiKey = getPexelsApiKey();

  if (!apiKey) {
    console.warn("Pexels API Key not found. Using placeholder.");
    return FALLBACK_IMAGE_URL;
  }

  const searchPexels = async (query: string): Promise<string | null> => {
    try {
      const colorParam = color ? `&color=${encodeURIComponent(color)}` : '';
      const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40&orientation=landscape&size=large${colorParam}`, {
        headers: { Authorization: apiKey }
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (data.photos && data.photos.length > 0) {
        // Filter out photos that have already been used
        const availablePhotos = data.photos.filter((p: any) =>
          !usedUrls.has(p.src.large2x) && !usedUrls.has(p.src.large)
        );

        // If all photos for this term are used, we might have to reuse one,
        // or just pick from the full list to avoid breaking.
        // Let's prefer available, but fallback to any if pool is empty.
        const pool = availablePhotos.length > 0 ? availablePhotos : data.photos;

        const randomIndex = Math.floor(Math.random() * pool.length);
        const photo = pool[randomIndex];
        const url = photo.src.large2x || photo.src.large;

        usedUrls.add(url); // Mark as used
        return url;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const result = await searchWithVariants(term, searchPexels);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchUnsplashImage(term: string, usedUrls: Set<string>): Promise<string> {
  const apiKey = getUnsplashApiKey();
  if (!apiKey) {
    console.warn("Unsplash API Key not found. Using placeholder.");
    return FALLBACK_IMAGE_URL;
  }

  const searchUnsplash = async (query: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=30&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${apiKey}` } }
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const available = data.results.filter((p: any) =>
          !usedUrls.has(p.urls?.regular) && !usedUrls.has(p.urls?.full)
        );
        const pool = available.length > 0 ? available : data.results;
        const randomIndex = Math.floor(Math.random() * pool.length);
        const photo = pool[randomIndex];
        const url = photo.urls?.regular || photo.urls?.full;
        if (!url) return null;
        usedUrls.add(url);
        return url;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const result = await searchWithVariants(term, searchUnsplash);
  return result || FALLBACK_IMAGE_URL;
}

async function fetchPixabayImage(term: string, usedUrls: Set<string>): Promise<string> {
  const apiKey = getPixabayApiKey();
  if (!apiKey) {
    console.warn("Pixabay API Key not found. Using placeholder.");
    return FALLBACK_IMAGE_URL;
  }

  const searchPixabay = async (query: string): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://pixabay.com/api/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&per_page=40&safesearch=true`
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (data.hits && data.hits.length > 0) {
        const available = data.hits.filter((p: any) =>
          !usedUrls.has(p.largeImageURL) && !usedUrls.has(p.webformatURL)
        );
        const pool = available.length > 0 ? available : data.hits;
        const randomIndex = Math.floor(Math.random() * pool.length);
        const photo = pool[randomIndex];
        const url = photo.largeImageURL || photo.webformatURL;
        if (!url) return null;
        usedUrls.add(url);
        return url;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const result = await searchWithVariants(term, searchPixabay);
  return result || FALLBACK_IMAGE_URL;
}

const getAvailableImageProviders = (): ImageProviderName[] => {
  const providers: ImageProviderName[] = [];
  if (getPexelsApiKey()) providers.push('pexels');
  if (getUnsplashApiKey()) providers.push('unsplash');
  if (getPixabayApiKey()) providers.push('pixabay');
  return providers;
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

// --- ART DIRECTOR PROMPT ---

const BASE_PROMPT = `
Role: World-Class Art Director & Frontend Engineer.
Mindset: Think like a high-end creative agency. Reference the visual standards of: **Active Theory, Resn, Hello Monday, Fantasy, Locomotive, Huge, and Jam3**. Avoid "safe", "default", or "corporate-template" choices.

Task:
Create a distinctive visual identity and a set of DESIGN ARTIFACTS rendered in HTML + SVG.

TOPIC: "{topic}"

// === PATCH: ARTIFACT MODE SWITCH ===
ARTIFACT MODE: {artifact_mode}
+ARTIFACT MODE REFERENCE:
+
+auto          ? infer from TOPIC and declare chosen mode in <meta name="artifact-mode">
+slides        – narrative layouts
+icons         – symbolic UI glyphs
+patterns      – seamless graphic systems
+textures      – vector material surfaces
+type-specimen – typographic compositions
+ui-modules    – interface blocks
+covers        – single-frame compositions
+posters       – expressive editorial layouts
+grids         – layout systems
+dividers      – ornamental separators
+mixed         – controlled combination of the above
+
+Interpret all following phases according to the selected ARTIFACT MODE.

A DESIGN ARTIFACT is a self-contained visual object.
Slides are only ONE possible artifact type.
All phases below remain active and MUST be interpreted through the selected ARTIFACT MODE.
// === END PATCH ===

PHASE 1: ART DIRECTION (INTERNAL – THINK FIRST)

1. **MOOD & EMOTION**
   - Analyze the TOPIC deeply.
   - Define the emotional and cultural vibe.
     Examples:
     - AI / Tech → futuristic, precise, geometric, confident
     - Art / Culture → expressive, bold, experimental
     - Wellness → calm, organic, breathable
     - Finance → solid, minimal, structured but premium

2. **COLOR PALETTE**
   - Create a UNIQUE 4-color palette aligned with the mood.
   - Rules:
     - NEVER use pure #000000 or #FFFFFF.
     - Prefer off-whites (#F6F7F8) or deep charcoals (#111111–#1A1A1A).
     - Avoid generic blue/white corporate palettes unless absolutely required.
   - Colors must feel intentional and emotionally driven.

3. **TYPOGRAPHY**
   - Select exactly 2 Google Fonts:
     - One for headlines
     - One for body text
   - Typography must be expressive.
   - Headlines may:
     - Break into multiple lines
     - Use dramatic scale
     - Act as graphic elements, not just readable text

PHASE 2: NARRATIVE & STRUCTURE (INTERNAL)

// === PATCH: INTERPRETATION RULE ===
Interpret "narrative" based on ARTIFACT MODE:
- slides → story flow, pacing, progression
- icons → semantic system, recognizability, hierarchy
- patterns → rhythm, repetition, density logic
- textures → frequency, scale, material illusion
- type-specimen → typographic exploration, hierarchy, pairing logic
- ui-modules → system structure, affordances, density control
- covers → single-frame impact, hierarchy, focal balance
- posters → graphic statement, contrast, typographic dominance
- grids → structure logic, modularity, alignment tension
- dividers → ornamental rhythm, motif variation, spacing intent
// === END PATCH ===

1. **CONSTRAINT CHECK**
   - Quantity:
     - If the user specifies number of artifacts/slides/icons/patterns/textures/type-specimen/ui-modules/covers/posters/grids/dividers → generate EXACTLY that number.
     - Otherwise:
       - slides → generate 5 artifacts
       - icons → generate 12 artifacts
       - patterns → generate 6 artifacts
       - textures → generate 3 artifacts
       - type-specimen → generate 3 artifacts
       - ui-modules → generate 6 artifacts
       - covers → generate 3 artifacts
       - posters → generate 3 artifacts
       - grids → generate 6 artifacts
       - dividers → generate 8 artifacts
   - Structure:
     - If artifact types are specified → follow them STRICTLY.

2. **STORY FLOW**
   - If no structure is given:
     - If ARTIFACT MODE includes "slides":
       - Design the narrative yourself.
       - Choose a structure appropriate to the genre:
         - Pitch deck
         - Portfolio
         - Educational
         - Brand story
     - If ARTIFACT MODE does NOT include "slides":
       - Do NOT create slide-like story flow.
       - Design a system progression (variation, density, hierarchy) appropriate to the artifact type.

3. **LAYOUT VARIETY**
   - If ARTIFACT MODE includes "slides":
     - Every slide MUST use a different layout archetype.
     - Avoid repetition.
     - Layout must support the content:
       - Emotional → bold typography, minimal text
       - Informational → structured grids
       - Inspirational → image-led compositions
   - If ARTIFACT MODE does NOT include "slides":
     - Every artifact MUST vary in form while preserving system coherence.
     - Avoid producing the same silhouette or rhythm repeatedly.

PHASE 3: VISUAL DESIGN SYSTEM (CRITICAL)

1. **CSS VARIABLES**
   - Define ALL colors and fonts in :root.
   - Required variables:
     --bg-main
     --bg-accent
     --text-primary
     --text-secondary
     --brand-color
     --font-heading
     --font-body

2. **DEPTH & LAYERS**
   - Design with layers.
   - Use:
     - Background shapes
     - Large typographic elements
     - Overlapping sections
   - Prefer scale, positioning, and contrast over heavy shadows.
   - ::before and ::after are encouraged for "fine details" (hairlines, coordinates, UI markers).

3. SVG DESIGN LAYER (MEANING-DRIVEN EXECUTION)

SVG is the functional and symbolic skeleton of the artifact(s). It must be authored as a semantic layer that directly responds to the User's input.

LOGIC FLOW:
1. EXPLICIT SPECIFICATIONS: If the User's prompt contains any descriptions of visual forms, patterns, behaviors, or graphic elements, you MUST translate them into SVG code with absolute fidelity. Their intent is your primary technical constraint. 
2. INFERRED SYSTEM: If no visual descriptions are provided, you must independently engineer an SVG system that reflects the underlying logic, rhythm, and "physics" of the TOPIC.

AUTHORING PROTOCOLS:
- ARCHITECTURAL ROLE: SVG must be used as a primary design element: a complex background texture, a sophisticated frame, or an overlaying 'engraving' layer.
- COMPLEXITY ENCOURAGED: For ornamental or technical topics, you are expected to use multiple SVG elements (paths, patterns, lines) to create visual density. High-end design requires detail.
- PRIMITIVE CONSTRUCTION: Build from raw <path>, <line>, <rect>, <circle>, and <pattern>.

CONSTRAINT:
- SVG is never redundant if it establishes the requested aesthetic texture.
- Never use pre-made icon sets. Every path must be authored specifically for this topic.

4. **IMAGES**
   - Use {{IMAGE:kw1, kw2, kw3, kw4, kw5, kw6, kw7, kw8, kw9, kw10}} for images.
   - Provide EXACTLY 10 concise, specific keywords/phrases (2-4 words each).
   - Prioritize precise, concrete descriptors over generic terms.
   - NO filters (no grayscale, opacity, blur).
   - Photography must stay clean and natural.

5. **IMAGE SHAPING (ADVANCED)**
Image shaping is a semantic action, not a stylistic choice.

Any form may be used if it emerges from the meaning of the slide
and strengthens how the idea is perceived.

Before shaping an image, internally determine:
- What aspect of the idea requires visual constraint, focus, or framing?
- What would be lost if the image remained unshaped?
- How does the shape alter attention, proximity, or rhythm?

Shaping should originate from context:
- narrowing attention
- marking a threshold or transition
- introducing tension or pause
- isolating presence
- expressing partiality or incompleteness

If the image communicates the same meaning without shaping,
shaping must not be applied.

Shaping must respond to slide’s narrative role,
not to visual balance or decoration.

6. **VISUAL ANCHORS**
   - Every artifact MUST contain at least ONE strong visual anchor:
     - A large number
     - A bold keyword
     - A graphic element
     - A striking image shape
   - If ARTIFACT MODE does NOT include "slides": interpret anchors as dominant gesture, density break, or signature form.

7. **DESIGN DISCIPLINE**
   - One strong idea per artifact.

HARD CONSTRAINT: TEXT ORIENTATION (NON-NEGOTIABLE)

1. **TEXT ORIENTATION**
   - writing-mode is STRICTLY FORBIDDEN.
   - text-orientation is STRICTLY FORBIDDEN.
   - For vertical text, use ONLY: transform: rotate(...) and transform-origin.
   - text-align: right; is STRICTLY FORBIDDEN for paragraphs and body text. Use left alignment or sophisticated centered compositions.

2. **BLEND MODES**
   - mix-blend-mode: difference; is STRICTLY FORBIDDEN.
   - Contrast must be achieved through color selection and spatial layering, not blending effects.

3. **VIOLATION POLICY**
   - Any use of forbidden properties invalidates the output.

PHASE 4: TECHNICAL EXECUTION

1. **OUTPUT**
- Return a SINGLE HTML block with embedded CSS.
- Include a complete HTML document with <html>, <head>, and <body>.
- Output ONLY raw HTML (no markdown, no explanations, no comments).

- In <head>, include:
  - <title>
    • Stock-ready Motion Template name derived from the TOPIC
    • English only
    • SEO-friendly and appropriate for Motion Array, VideoHive, Adobe Stock
    • Clear commercial intent (opener, promo, slideshow, titles, etc.)
  - <meta name="project-title" content="...">
    • Must EXACTLY match the <title>
  - <meta name="description" content="...">
    • Clear SEO-friendly 1–2 sentence summary
    • 120–160 characters (target range)
    • Describe what the template is and how it’s used
    • Include primary keywords naturally, no stuffing
  - <meta name="tags" content="tag1, tag2, tag3, ...">
    • EXACTLY 20 concise SEO tags
    • lowercase
    • comma-separated
    • no duplicates
    • avoid filler words
    • optimized for motion templates and stock search
  - <meta name="keywords" content="same as tags">
    • Must be IDENTICAL to the tags list (same order, same commas)
  - <meta name="artifact-mode" content="...">
    ? Must be one of: slides, icons, patterns, textures, type-specimen, ui-modules, covers, posters, grids, dividers, mixed
    ? If ARTIFACT MODE is "auto", choose the correct mode and set it here

2. **LAYOUT**
- If ARTIFACT MODE includes "slides":
  - Width: 100vw
  - Height: 56.25vw (16:9)
- If ARTIFACT MODE does NOT include "slides":
  - The canvas may be any proportion, but must present artifacts clearly and beautifully in a curated layout.

  - Artifacts must be visible by default with no user interaction.
  - Do NOT use radio inputs or CSS that hides artifacts by default (no opacity: 0 or visibility: hidden on the main artifact blocks).
  - The main <section class="artifact"> / <section class="artifact slide"> wrapper MUST have no margin (margin: 0).

  - **PRO DIRECTION:**
    - Do not feel constrained by standard flow.
    - Use any combination of CSS Grid, Flexbox, and Absolute Positioning to break the “web-page” feel.
    - Negative margins/calc offsets are allowed on inner elements only, NEVER on the artifact/slide wrapper.

3. **CREATIVE MODE**
- Bolder is better.
- Aim for a layout that looks like a custom-coded site, not a CMS template.
- If the topic allows:
  - Prefer bold compositions.
  - Slight asymmetry > perfect symmetry.
  - Avoid template-looking layouts.

4. **ARTIFACT WRAPPERS**
- Every artifact MUST be wrapped in <section class="artifact">.
- If ARTIFACT MODE includes "slides": use <section class="artifact slide"> for each artifact.

Do not fear long HTML files. Complex SVG paths and detailed geometric patterns are encouraged to achieve the visual standards of the referenced agencies.

PHASE 5: GENERATION

Generate the final HTML.
`;

const REGENERATE_PROMPT = `
Role: Senior Frontend Developer & Art Director.
Task: Redesign ONE existing DESIGN ARTIFACT while preserving the visual identity.

CONTEXT:
Topic: {topic}
ARTIFACT MODE: {artifact_mode}
Existing CSS (Strictly Follow This): {cssContext}
Artifact to Update (HTML/SVG): {currentArtifact}

INSTRUCTIONS:
1. Update EXACTLY ONE artifact.
2. Preserve:
   - colors
   - fonts
   - stroke logic
   - overall visual language
3. Change:
   - geometry
   - composition
   - rhythm
   - density or hierarchy
4. Do NOT invent new CSS variables.
5. The artifact MUST:
   - introduce a new variation
   - avoid repeating silhouettes or compositions
6. SVG rules:
   - primitives only (<path>, <line>, <rect>, <circle>, <pattern>)
   - no external assets
7. The wrapper must keep margin: 0 (do not add margin to the <section class="artifact...">).
8. If ARTIFACT MODE includes "slides":
   - return one <section class="artifact slide">
   - images allowed via {{IMAGE:...}} (10 keywords)
9. If ARTIFACT MODE != slides:
   - return one <section class="artifact">
   - no narrative, no images

Return ONLY the updated artifact.
`;


const ADD_ARTIFACT_PROMPT = `
Role: Senior Frontend Developer & Art Director.
Task: Add a NEW DESIGN ARTIFACT using the EXISTING visual identity.

CONTEXT:
Topic: {topic}
ARTIFACT MODE: {artifact_mode}
Existing CSS (Strictly Follow This): {cssContext}

INSTRUCTIONS:
1. Add EXACTLY ONE new artifact.
2. The artifact type MUST match ARTIFACT MODE.
3. STRICTLY use the existing CSS variables and visual language.
4. Do NOT modify existing artifacts.
5. The new artifact MUST:
   - introduce a new variation
   - avoid repeating silhouettes or compositions
6. SVG rules:
   - primitives only (<path>, <line>, <rect>, <circle>, <pattern>)
   - no external assets
7. The wrapper must keep margin: 0 (do not add margin to the <section class="artifact...">).
8. If ARTIFACT MODE includes "slides":
   - return one <section class="artifact slide">
   - images allowed via {{IMAGE:...}} (10 keywords)
9. If ARTIFACT MODE != slides:
   - return one <section class="artifact">
   - no narrative, no images

Return ONLY the HTML/SVG for the new artifact.
`;

export const generateArtifacts = async (
  provider: AiProviderName,
  topic: string,
  artifactMode: ArtifactMode,
  imageProvider: ImageProviderName
): Promise<string> => {
  try {
    const finalPrompt = BASE_PROMPT
      .replace(/{topic}/g, topic)
      .replace(/{artifact_mode}/g, artifactMode);
    const text = await createResponseText(provider, finalPrompt, 1.5);
    return await replaceImagePlaceholders(text, [], undefined, imageProvider);
  } catch (error) {
    console.error("Error generating artifacts:", error);
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
  imageProvider: ImageProviderName
): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = REGENERATE_PROMPT
      .replace('{topic}', topic)
      .replace('{artifact_mode}', artifactMode)
      .replace('{cssContext}', truncatedCss)
      .replace('{currentArtifact}', currentArtifact);

    const text = await createResponseText(provider, filledPrompt, 0.7);
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
  imageProvider: ImageProviderName
): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = ADD_ARTIFACT_PROMPT
      .replace('{topic}', topic)
      .replace('{artifact_mode}', artifactMode)
      .replace('{cssContext}', truncatedCss);

    const text = await createResponseText(provider, filledPrompt, 0.7);
    const sectionHtml = extractArtifactSection(text, artifactMode);
    return await replaceImagePlaceholders(sectionHtml, excludedImages, cssContext, imageProvider);
  } catch (error) {
    console.error("Error adding artifact:", error);
    throw error;
  }
};
