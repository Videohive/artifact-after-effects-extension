import { GoogleGenAI } from "@google/genai";

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

// Helper to safely extract section from AI response
const extractSection = (html: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const section = doc.querySelector('section');
    if (section) {
      if (!section.classList.contains('slide')) {
        section.classList.add('slide');
      }
      // CRITICAL: Strip any inline styles that might mess up fonts/layout consistency
      section.removeAttribute('style'); 
      return section.outerHTML;
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
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      if (import.meta.env.VITE_PEXELS_API_KEY) return import.meta.env.VITE_PEXELS_API_KEY;
      // @ts-ignore
      if (import.meta.env.PEXELS_API_KEY) return import.meta.env.PEXELS_API_KEY;
    }
  } catch (e) {}
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

// Pexels API Integration
async function fetchPexelsImage(term: string, usedUrls: Set<string>, color?: string): Promise<string> {
  const apiKey = getPexelsApiKey();
  let cleanTerm = term.trim();
  const fallbackUrl = `https://placehold.co/1920x1080/1a1a1a/666666?text=Image`;

  if (!apiKey) {
    console.warn("Pexels API Key not found. Using placeholder.");
    return fallbackUrl;
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

  const keywordList = cleanTerm
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const queries = keywordList.length > 0 ? keywordList : [cleanTerm];

  for (const q of queries) {
    if (q.split(' ').length <= 3) {
      const imageUrl = await searchPexels(q);
      if (imageUrl) return imageUrl;
    }
    const keywordQuery = extractKeywords(q);
    if (keywordQuery !== q.toLowerCase()) {
      const imageUrl = await searchPexels(keywordQuery);
      if (imageUrl) return imageUrl;
    }
    const words = q.split(/\s+/);
    const lastWord = words[words.length - 1];
    if (lastWord.length > 3 && lastWord !== keywordQuery) {
      const imageUrl = await searchPexels(lastWord);
      if (imageUrl) return imageUrl;
    }
  }
  
  // Fallback to abstract if specific fails
  const genericTerms = ["abstract texture", "minimal background", "light gradient"];
  const randomGeneric = genericTerms[Math.floor(Math.random() * genericTerms.length)];
  const genericImage = await searchPexels(randomGeneric);
  if (genericImage) return genericImage;

  return fallbackUrl;
}

const replaceImagePlaceholders = async (html: string, excludedUrls: string[] = [], paletteSource?: string): Promise<string> => {
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
    const url = await fetchPexelsImage(term, usedUrls, paletteColor);
    
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
Mindset: Think like a creative agency, not a template generator.
Task: Create a distinctive visual identity and a set of HTML slides for the User's Topic.

TOPIC: "{topic}"

==================================================
PHASE 1: ART DIRECTION (INTERNAL – THINK FIRST)
==================================================

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

==================================================
PHASE 2: NARRATIVE & STRUCTURE (INTERNAL)
==================================================

1. **CONSTRAINT CHECK**
   - Quantity:
     - If the user specifies number of slides → generate EXACTLY that number.
     - Otherwise → generate 5 slides.
   - Structure:
     - If slide types are specified → follow them STRICTLY.

2. **STORY FLOW**
   - If no structure is given:
     - Design the narrative yourself.
     - Choose a structure appropriate to the genre:
       - Pitch deck
       - Portfolio
       - Educational
       - Brand story
   - Each slide must have a clear purpose.

3. **LAYOUT VARIETY**
   - Every slide MUST use a different layout archetype.
   - Avoid repetition.
   - Layout must support the content:
     - Emotional → bold typography, minimal text
     - Informational → structured grids
     - Inspirational → image-led compositions

==================================================
PHASE 3: VISUAL DESIGN SYSTEM (CRITICAL)
==================================================

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
   - ::before and ::after pseudo-elements are encouraged.

3. **SVG DESIGN LAYER**
   - You MAY use inline SVG for:
     - Background shapes
     - Section dividers
     - Abstract patterns
     - Accent graphics
   - SVG colors MUST use CSS variables only.
   - SVG is a design tool, not decoration.

4. **IMAGES**
   - Use {{IMAGE:kw1, kw2, kw3, kw4, kw5, kw6, kw7, kw8, kw9, kw10}} for images.
   - Provide EXACTLY 10 concise, specific keywords/phrases (2-4 words each).
   - Prioritize precise, concrete descriptors over generic terms.
   - NO filters (no grayscale, opacity, blur).
   - Photography must stay clean and natural.

5. **IMAGE SHAPING (ADVANCED)**
   - You MAY use clip-path (polygon, circle, ellipse).
   - Use clip-path only when it strengthens storytelling.
   - Limit shaped images to 1–2 per deck.

6. **VISUAL ANCHORS**
   - Every slide MUST contain at least ONE strong visual anchor:
     - A large number
     - A bold keyword
     - A graphic element
     - A striking image shape

7. **DESIGN DISCIPLINE**
   - One strong idea per slide.

   ==================================================
HARD CONSTRAINT: TEXT ORIENTATION (NON-NEGOTIABLE)
==================================================

- writing-mode is STRICTLY FORBIDDEN.
- text-orientation is STRICTLY FORBIDDEN.

- Vertical or side-oriented text is allowed ONLY if:
  - The text remains technically horizontal
  - Visual orientation is achieved exclusively via:
    - transform: rotate(...)
    - transform-origin

- Any use of writing-mode or text-orientation
  is a critical violation and invalidates the output.

==================================================
PHASE 4: TECHNICAL EXECUTION
==================================================

1. **OUTPUT**
   - Return a SINGLE HTML block with embedded CSS.

2. **LAYOUT**
   - Width: 100vw
   - Height: 56.25vw (16:9)
   - Use CSS Grid and/or Flexbox.

3. **CREATIVE MODE**
   - If the topic allows:
     - Prefer bold compositions.
     - Slight asymmetry > perfect symmetry.
     - Avoid template-looking layouts.

==================================================
PHASE 5: GENERATION
==================================================

Generate the final HTML.
`;

const REGENERATE_PROMPT = `
Role: Senior Frontend Developer.
Task: Redesign this specific slide using the EXISTING visual identity.

CONTEXT:
Topic: {topic}
Existing CSS (Strictly Follow This): {cssContext}
Current Slide HTML: {currentSlide}

INSTRUCTIONS:
1. Return EXACTLY ONE \`<section class="slide">\` element.
2. **STRICTLY** use the CSS variables defined in \`Existing CSS\`. Do not invent new colors.
3. Change the layout structure (e.g., move text to the left, image to the right), but keep the fonts/colors identical.
4. Use \`{{IMAGE:kw1, kw2, kw3, kw4, kw5, kw6, kw7, kw8, kw9, kw10}}\` for images.
   Provide EXACTLY 10 concise, specific keywords/phrases (2-4 words each).

Return ONLY the HTML for the section.
`;

const ADD_SLIDE_PROMPT = `
Role: Senior Frontend Developer.
Task: Add a NEW slide to the deck.

CONTEXT:
Topic: {topic}
Existing CSS (Strictly Follow This): {cssContext}

INSTRUCTIONS:
1. Return EXACTLY ONE \`<section class="slide">\` element.
2. **STRICTLY** use the CSS variables defined in \`Existing CSS\`.
3. Create a layout type that isn't typically just "text + image" (e.g., a quote slide, a 3-column grid, a big number slide).
4. Use \`{{IMAGE:kw1, kw2, kw3, kw4, kw5, kw6, kw7, kw8, kw9, kw10}}\` for images.
   Provide EXACTLY 10 concise, specific keywords/phrases (2-4 words each).

Return ONLY the HTML for the section.
`;

export const generateSlides = async (topic: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We increase temperature to encourage unique Art Direction in Phase 1
    // But the prompt structure ensures Phase 2 (Consistency) is respected.
    const finalPrompt = BASE_PROMPT.replace(/{topic}/g, topic);

    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 1.4, // High temperature for creative font/color choices
        }
      });
      let text = response.text || '';
      text = text.replace(/```html/g, '').replace(/```/g, '');
      
      return await replaceImagePlaceholders(text);
    });

  } catch (error) {
    console.error("Error generating slides:", error);
    throw error;
  }
};

export const regenerateSlide = async (topic: string, currentSlide: string, cssContext: string, excludedImages: string[] = []): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;

    const filledPrompt = REGENERATE_PROMPT
      .replace('{topic}', topic)
      .replace('{cssContext}', truncatedCss)
      .replace('{currentSlide}', currentSlide);

    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: filledPrompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.7, // Lower temperature to strictly adhere to existing CSS
        }
      });

      let text = response.text || '';
      text = text.replace(/```html/g, '').replace(/```/g, '');
      
      const sectionHtml = extractSection(text);
      return await replaceImagePlaceholders(sectionHtml, excludedImages, cssContext);
    });
  } catch (error) {
    console.error("Error regenerating slide:", error);
    throw error;
  }
};

export const generateNewSlide = async (topic: string, cssContext: string, excludedImages: string[] = []): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const truncatedCss = cssContext.length > 6000 ? cssContext.substring(0, 6000) + "..." : cssContext;
    
    const filledPrompt = ADD_SLIDE_PROMPT
      .replace('{topic}', topic)
      .replace('{cssContext}', truncatedCss);

    return await callWithRetry(async () => {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ role: 'user', parts: [{ text: filledPrompt }] }],
        config: {
          thinkingConfig: { thinkingBudget: 0 },
          temperature: 0.7, // Lower temperature to strictly adhere to existing CSS
        }
      });

      let text = response.text || '';
      text = text.replace(/```html/g, '').replace(/```/g, '');
      
      const sectionHtml = extractSection(text);
      return await replaceImagePlaceholders(sectionHtml, excludedImages, cssContext);
    });
  } catch (error) {
    console.error("Error adding slide:", error);
    throw error;
  }
};
