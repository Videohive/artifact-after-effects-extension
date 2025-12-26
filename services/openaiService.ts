import OpenAI from "openai";

// The universal prompt template provided by the user
const BASE_PROMPT = `
Role
You are a senior UI/UX designer and frontend developer, focused on high-end static presentation layouts.

Goal
Generate a professional HTML design layout in the form of slides, based on the user's request.
The result should look like a motion-style template, but without any animations or transitions.

📐 SLIDE FORMAT (CRITICAL)

Each slide must keep a strict 16:9 aspect ratio.
Layout logic:
- width: 100vw
- height: calc(100vw * 9 / 16)
- max-height: 100vh
- Slides must be centered horizontally and vertically
- Layout must scale responsively while preserving 16:9

🎨 DESIGN REQUIREMENTS

Style: modern, professional, premium, minimal
Visual direction: startup / SaaS / digital agency
Strong typography and clear hierarchy
Clean grid, balanced spacing
Slides should visually feel like motion templates, even without animation

⚠️ CSS BEST PRACTICES (MANDATORY)

1. GLOBAL RESET: Include * { box-sizing: border-box; margin: 0; padding: 0; }
2. CONTAINER: section.slide { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: flex; flex-direction: column; }
3. TYPOGRAPHY: Use viewport units (vw, vh) or clamp() for font sizes to ensure they scale perfectly with the 16:9 ratio.
4. IMAGES: Use object-fit: cover for all background images. Ensure text contrast (use overlays if needed).
5. CONTENT: Ensure content fits within the slide. Do not allow scrolling.
6. UTILITIES: Include generic helper classes in your CSS for grids (e.g., .grid-2, .grid-3) and flex layouts to make future slide additions easier.

🎞️ SLIDE STRUCTURE

Each slide is a <section class="slide">
Each slide represents a single screen
Consistent design system across all slides
Content structure:
- Headline (large)
- Subheadline or short paragraph
- CTA (optional)
- Background image or visual block

🖼️ IMAGES

You MUST use real, high-quality image URLs from Unsplash or Pexels.
Examples:
- Unsplash: https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=1600&q=80
- Pexels: https://images.pexels.com/photos/3183150/pexels-photo-3183150.jpeg?auto=compress&cs=tinysrgb&w=1600

CRITICAL: Every slide MUST use a different image URL. No duplicates.
ABSOLUTELY NO placeholders like picsum.photos or placeholder.com.
Images must be visually stunning and relevant to the content.
Use full-bleed backgrounds or structured image blocks.

🛠️ TECHNICAL REQUIREMENTS

Output pure HTML + CSS only
NO animations
NO transitions
NO JavaScript
No external frameworks (except Google Fonts)
Use Flexbox or CSS Grid
Google Fonts allowed (Inter, Manrope, Poppins, etc.)
IMPORTANT: Include the CSS in a <style> tag within the HTML.

📦 OUTPUT FORMAT

Return ONLY the raw HTML code starting with <!DOCTYPE html>. 
Do not wrap it in markdown code blocks (\`\`\`html). 
Do not include any explanation text.
`;

const REGENERATE_PROMPT = `
Role: Senior UI/UX Designer.
Task: Redesign/Regenerate a specific slide for a presentation.

CONTEXT:
Topic: {topic}
Existing Design System (CSS): 
{cssContext}

Current Slide HTML: 
{currentSlide}

EXCLUDED IMAGES (DO NOT USE THESE):
{excludedImages}

REQUIREMENTS:
1. Output exactly one <section class="slide"> element.
2. STRICTLY follow the visual style defined in the provided CSS (fonts, colors, spacing).
3. Maintain the strict 16:9 aspect ratio logic.
4. Improve the layout or content variation while keeping consistency.
5. IMAGES: Use only Unsplash or Pexels URLs. No placeholders. 
   CRITICAL: You MUST use a different image than the ones listed in "EXCLUDED IMAGES". Find a fresh, relevant image.
6. Return ONLY the HTML code for the section. No markdown, no explanations.
`;

const ADD_SLIDE_PROMPT = `
Role: Senior UI/UX Designer.
Task: Create a NEW additional slide for an existing presentation that looks DISTINCT from previous ones.

CONTEXT:
Topic: {topic}
Existing Design System (CSS): 
{cssContext}

EXCLUDED IMAGES (DO NOT USE THESE):
{excludedImages}

OBJECTIVE:
The user wants to avoid repetitive layouts (e.g., avoiding just "Title + Text").
You MUST generate a slide using one of these specific structures (randomly select one):

A. **Metric/Stat Focus**: Large typography for numbers (e.g., "95%", "10k+"), minimal text.
B. **Grid/Gallery Layout**: 3 or 4 columns for features, team members, or services.
C. **Visual Split**: 50% Image / 50% Text (ensure it looks different from the cover).
D. **Quote/Statement**: Minimalist, centered large text, high contrast background.
E. **Timeline/Steps**: A structured horizontal or vertical list (1, 2, 3).

INSTRUCTIONS:
1. Output exactly one <section class="slide"> element.
2. STRICTLY follow the visual style (fonts, colors) defined in the provided CSS.
3. Use **inline styles** (style="...") for specific layout adjustments (like grid columns) if the global CSS doesn't have the classes you need.
4. Create new, realistic content relevant to the topic.
5. IMAGES: Use only high-quality Unsplash or Pexels URLs. DO NOT use picsum.photos.
   CRITICAL: You MUST use a different image than the ones listed in "EXCLUDED IMAGES".
6. Return ONLY the HTML code for the section. No markdown, no explanations.
`;

const MODEL = "gpt-4o";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

const cleanResponseText = (text: string) =>
  text.replace(/```html/g, "").replace(/```/g, "");

const createResponseText = async (prompt: string, temperature: number) => {
  const response = await client.responses.create({
    model: MODEL,
    input: prompt,
    temperature,
  });

  return cleanResponseText(response.output_text || "");
};

export const generateSlides = async (topic: string): Promise<string> => {
  try {
    const prompt = `${BASE_PROMPT}\n\nGenerate a presentation for the following topic: ${topic}`;
    return await createResponseText(prompt, 0.4);
  } catch (error) {
    console.error("Error generating slides:", error);
    throw error;
  }
};

export const regenerateSlide = async (topic: string, currentSlide: string, cssContext: string, excludedImages: string[] = []): Promise<string> => {
  try {
    // Truncate CSS context if it's too long to avoid token limits, though usually fine for slides
    const truncatedCss = cssContext.length > 5000 ? cssContext.substring(0, 5000) + "..." : cssContext;
    const excludedStr = excludedImages.join(', ');

    const filledPrompt = REGENERATE_PROMPT
      .replace('{topic}', topic)
      .replace('{cssContext}', truncatedCss)
      .replace('{currentSlide}', currentSlide)
      .replace('{excludedImages}', excludedStr);

    return await createResponseText(filledPrompt, 0.6); // Increased slightly to encourage image variety
  } catch (error) {
    console.error("Error regenerating slide:", error);
    throw error;
  }
};

export const generateNewSlide = async (topic: string, cssContext: string, excludedImages: string[] = []): Promise<string> => {
  try {
    const truncatedCss = cssContext.length > 5000 ? cssContext.substring(0, 5000) + "..." : cssContext;
    const excludedStr = excludedImages.join(', ');

    const filledPrompt = ADD_SLIDE_PROMPT
      .replace('{topic}', topic)
      .replace('{cssContext}', truncatedCss)
      .replace('{excludedImages}', excludedStr);

    return await createResponseText(filledPrompt, 0.85);
  } catch (error) {
    console.error("Error adding slide:", error);
    throw error;
  }
};
