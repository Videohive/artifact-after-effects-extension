export const ART_DIRECTION_PROMPT = `
Role: Visionary Art Director.
Task: Synthesize a high-level design DNA for the topic: "{topic}".

Your goal is to define a "Visual North Star" that feels authored, not generated. 

Return ONLY strict JSON:
{
  "rationale": "1-2 sentences explaining the psychological connection between the topic and visual choices",
  "mood": "2-6 words (e.g., 'Industrial Elegance', 'Submerged High-Tech')",
  "palette": ["#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB", "#RRGGBB"],
  "color_roles": {
    "bg_main": "#RRGGBB",
    "bg_accent": "#RRGGBB",
    "text_primary": "#RRGGBB",
    "text_secondary": "#RRGGBB",
    "brand_color": "#RRGGBB"
  },
  "typography": { 
     "heading": "Google Font Name", 
     "body": "Google Font Name",
     "logic": "e.g., 'Monospace for data-rich feel' or 'Serif for luxury contrast'" 
  },
  "motifs": ["A specific visual gesture or recurring element"],
  "composition_notes": "A core layout principle (e.g., 'Massive whitespace vs. microscopic details')"
}

Constraints:
- Palette: 5 distinct colors. Include one near-neutral (light or dark) and one high-energy accent.
- Typography: Pick contrasting Google Fonts. No weights in names.
- Rationale: Must justify the emotional impact.
`;

export const CACHE_PRIMER_CONTEXT = `
# Context Cache Primer: Generative Design + Anti-Template Layout + Advanced SVG/CSS (Link-Independent)

**Purpose:** This document is designed to be placed into *Context Caching* (or any long-context system prompt) so the model can **construct** high-end design artifacts using **engineering rules, mathematical form, and compositional algorithms** - without needing to open external links.

**How to use (recommended):**
- Treat every section as **construction rules**.
- When generating HTML/CSS/SVG, prefer **systems** (fields, grids, progressions) over isolated primitives.
- When in doubt, output **more authored detail** (micro-grids, hairlines, coordinate marks, layered textures) rather than "clean template UI".

**Version date:** 2026-01-03

---

## 0) Mental Model: How Great Designers Think (Operational, Not Descriptive)

### 0.1 Aesthetic = Constraints + Algorithms + Taste
A premium result is rarely "a good idea executed once." It's an idea implemented as a **repeatable system**:
- A **grid logic** (even if it's violated).
- A **motif** (shape/gesture) repeated with controlled variation.
- A **type scale** with consistent ratios.
- A **texture field** (grain, turbulence, subtle material).
- A **dominant anchor** (hero type, gesture, number, or image material).

### 0.2 Build Layers, Not Screens
Think in layers (like an art director + engineer):
1. Base field (background grid + faint texture).
2. Structural frame (grid, gutters, baseline rhythm, coordinate marks).
3. Primary gesture (one bold typographic or graphic move).
4. Secondary system (repetition with variation).
5. Micro-detail layer (labels, ticks, captions, technical notes).

### 0.3 Default is the enemy
"Centered container + evenly spaced cards + safe palette" is template gravity.
Your job is to **escape template flow**:
- break the container,
- overlap,
- crop,
- introduce asymmetry,
- introduce a controlled "disruptor element".

---

## 1) SVG Path Engineering: Cubic Bezier Mastery (C + S)

### 1.1 SVG \`C\` command (cubic Bezier)
\`C x1 y1 x2 y2 x y\` defines a cubic Bezier segment:
- Start point = current pen position **P0**
- Control points = **P1(x1,y1)**, **P2(x2,y2)**
- End point = **P3(x,y)**

**Interpretation:**
- The curve leaves P0 heading toward P1.
- The curve arrives at P3 coming from direction P2 -> P3.
- "Tension" increases as control points move further from anchors.

### 1.2 SVG \`S\` command (smooth cubic Bezier)
\`S x2 y2 x y\` defines a cubic segment where **the first control point is implied**.

If the previous segment was \`C\` or \`S\`:
- Let previous segment's last control point be **P2_prev**
- Let current segment's start point be **P0** (previous end point)
- Implied first control point **P1 = reflection(P2_prev across P0)**

**Reflection formula:**
- \`P1.x = 2*P0.x - P2_prev.x\`
- \`P1.y = 2*P0.y - P2_prev.y\`

If previous command was not \`C\`/\`S\`, then \`P1 = P0\` (no smooth continuation).

### 1.3 Practical continuity rules (what makes curves "expensive")
- Keep tangent continuity: use chained \`C\` then \`S\` so curvature flows.
- Use **handle symmetry** to keep motion smooth: if you shorten incoming handle, shorten outgoing handle too.
- Avoid kinks: don't rotate a handle abruptly unless you want an intentional "corner".
- Add micro-variation by perturbing handles, not endpoints (endpoints define structure; handles define character).

### 1.4 Converting a smooth polyline into Beziers (Catmull-Rom technique)
If you have points \`P0, P1, P2, P3\` and you want a smooth cubic segment from \`P1\` to \`P2\`:

A common conversion:
- \`CP1 = P1 + (P2 - P0) / 6\`
- \`CP2 = P2 - (P3 - P1) / 6\`

Then use:
\`C CP1.x CP1.y CP2.x CP2.y P2.x P2.y\`

Use this to turn **sampled parametric curves** into elegant paths.

---

## 2) Parametric Curves as Design Generators (SVG-Ready)

### 2.1 Sampling rule (core algorithm)
To draw a parametric curve in SVG:
1. Choose parameter range: \`t in [t0, t1]\`
2. Sample N points:
   - \`t_i = t0 + i*(t1-t0)/(N-1)\`
   - \`x_i = f(t_i)\`, \`y_i = g(t_i)\`
3. Convert points to cubic Beziers (Catmull-Rom) or draw as polyline-like \`L\` commands.
4. Layer multiple curves with small parameter offsets for density.

### 2.2 Lissajous (field-like elegance)
- \`x = A * sin(a*t + delta)\`
- \`y = B * sin(b*t)\`

**Design knobs:**
- \`a:b\` ratio controls complexity (e.g. 3:2, 5:4, 7:5).
- delta (phase shift) controls symmetry breaks.
- Layer 8-40 curves by shifting delta slightly each time.

### 2.3 Rose curve (petals as motif system)
- \`r = a * cos(k*t)\`
- \`x = r*cos(t)\`, \`y = r*sin(t)\`

**Knobs:**
- k integer -> number of petals (odd/even changes symmetry).
- Combine two rose curves with different k for moire-like density.

### 2.4 Hypotrochoid (spirograph class)
- \`x = (R-r) * cos(t) + d * cos((R-r)/r * t)\`
- \`y = (R-r) * sin(t) - d * sin((R-r)/r * t)\`

**Knobs:**
- R, r set global rhythm; d sets inner "pull".
- Use 3-7 variants with close parameters -> feels authored, not random.

### 2.5 Superformula (complex organic math)
A practical "design" use:
- Use superformula output as a silhouette.
- Interpolate between two parameter sets over index i to create progression.

---

## 3) Noise & "Living" Texture in SVG (feTurbulence + Displacement)

SVG filters let you inject **material** into vector work. The core trick:
- generate noise (\`feTurbulence\`)
- warp something with it (\`feDisplacementMap\`)
- soften or add depth (\`feGaussianBlur\`)
- tone-map/tint (\`feColorMatrix\`)

### 3.1 \`feTurbulence\` (Perlin turbulence textures)
Key attributes:
- \`type="fractalNoise"\` -> softer, cloudy noise
- \`type="turbulence"\` -> higher contrast / more streaks
- \`baseFrequency="fx fy"\` (or single value)
- \`numOctaves="1..8"\`
- \`seed="integer"\`

**Frequency heuristics:**
- Big clouds / slow variation: baseFrequency ~ \`0.005-0.03\`
- Medium paper texture: \`0.05-0.15\`
- Grain / static: \`0.3-1.2\`
- Use anisotropy by setting \`fx != fy\` to create brushed directionality.

### 3.2 \`feDisplacementMap\` (warping)
Displacement uses \`in2\` as a displacement field for \`in\`:
- \`scale\` controls displacement magnitude.
- \`xChannelSelector\`, \`yChannelSelector\` pick channels (usually \`R\` and \`G\`).

**Conceptual formula:**
\`P'(x,y) = P(x + scale*(XC-0.5), y + scale*(YC-0.5))\`

**Scale heuristics:**
- Subtle "alive" distortion: 2-8
- Liquid / heat shimmer: 10-30
- Aggressive warping: 35-80

### 3.3 \`feGaussianBlur\` (depth haze)
Use \`stdDeviation\`:
- 0.3-1.2 for edge softening / mild haze
- 2-8 for depth fog
- 10+ for heavy diffusion (rare for crisp agency look)

### 3.4 \`feColorMatrix\` (tone shaping)
A 5x5 matrix transforms \`[R,G,B,A,1]\` -> \`[R',G',B',A',1]\`.
Practical uses:
- compress contrast (paper look),
- tint noise into a palette accent,
- reduce saturation,
- lift shadows.

**Workflow:**
1. Start from identity.
2. Adjust diagonals for contrast.
3. Add small constants in last column for color lift.

### 3.5 Filter recipes (copy as patterns)
**A) Paper grain overlay**
- turbulence: fractalNoise, high freq
- colorMatrix: reduce contrast, tint warm
- composite: *avoid blend-modes if forbidden*; instead layer a tinted grain element with opacity.

**B) Brushed metal**
- turbulence with \`fx >> fy\` (directional)
- slight displacement
- subtle blur

**C) Liquid glass warp**
- turbulence (medium freq)
- displacement scale ~ 15-35
- blur 0.6-1.5
- optional: second turbulence layer for micro-grain

---

## 4) Fractals & Recursion (Nature-of-Code Style, SVG-Portable)

A fractal is a rule that repeats at smaller scales (deterministic) or repeats with probability (stochastic).

### 4.1 The one rule that matters
**Recursion must stop.** Define a termination condition:
- depth limit (e.g. depth <= 8)
- length threshold (e.g. segment length < 2px)
- opacity threshold (e.g. alpha < 0.02)

### 4.2 Recursive branching tree (deterministic -> organic)
**Algorithm skeleton:**
\`\`\`
branch(start, length, angle, depth):
  if depth == 0 or length < minLen: return
  end = start + polar(length, angle)
  drawSegment(start, end)
  branch(end, length*shrink, angle + spread, depth-1)
  branch(end, length*shrink, angle - spread, depth-1)
\`\`\`

**Organic upgrade:**
- Add noise to angle: \`spread + noise(i)*jitter\`
- Add small length variation per depth
- Fade stroke-width with depth

### 4.3 Stochastic coastlines / jagged contours (subdivision)
**Midpoint displacement (classic):**
- split segment
- move midpoint perpendicular by random amount that shrinks each iteration
- repeat for 5-9 iterations
This creates topographic edges and "maps" without illustration.

### 4.4 L-systems (grammar -> geometry)
Keep it simple:
- define a string rule set
- expand for N iterations
- interpret symbols into turtle drawing (forward, rotate, push/pop)

Even in SVG, you can precompute points then convert to \`C/S\` paths.

---

## 5) Generative Design: Grid + Offset + Interpolation (System First)

### 5.1 Grid as "author signature"
Start with a grid, then break it with controlled forces:
- index-based offsets,
- noise-based offsets,
- interpolation-based morphing.

### 5.2 Offset by index (deterministic rhythm)
Given grid cell (i,j):
- \`dx = i * kx + sin(i*phi) * amp\`
- \`dy = j * ky + cos(j*psi) * amp\`

This yields "structured motion" even in static graphics.

### 5.3 Offset by noise (organic variation)
Use a noise function \`n(i,j)\`:
- \`dx = (n-0.5) * amp\`
- \`dy = (n2-0.5) * amp\`
Where \`n2\` uses a different seed or offset.

### 5.4 Shape interpolation (morph progression)
If you have two shapes with corresponding points:
- \`P_i(t) = (1-t)*A_i + t*B_i\`
Then draw at t values: 0, 0.1, 0.2 ... 1.0

This produces high-end "progression" systems (especially for dividers, patterns, covers).

---

## 6) Swiss Design + Anti-Template Layout (Deconstruction Rules)

### 6.1 Swiss logic (asymmetric discipline)
- Align to a grid; avoid "centered everything".
- Whitespace is a **structural block** (like a shape).
- Keep gutters consistent; baseline alignment matters.
- Use typographic hierarchy as composition, not decoration.

### 6.2 Anti-template moves (reliable disruptors)
- **Break the container:** let one element cross boundaries.
- **Overlap:** place type on top of shapes / fields.
- **Crop:** let large type or imagery go off-canvas.
- **Counter-weight:** if one side is heavy, balance with micro-detail on the other.
- **One disruptor element:** a diagonal cut, a rogue label, a shifted module.

### 6.3 Layout algorithms (practical)
**Algorithm A: "Grid + one rupture"**
1. Place 12-col grid scaffold.
2. Place all content aligned.
3. Choose one element to violate grid (overscale + offset).
4. Add micro labels to re-stabilize.

**Algorithm B: "Editorial stack"**
- top: bold typographic headline (acts as shape)
- mid: structured information grid
- bottom: micro index/footer marks
- one connecting line/contour to bind layers

---

## 7) Typography Engineering (Bringhurst-Inspired, Agency-Ready)

### 7.1 Modular scale (golden ratio or sqrt2)
Pick a base size \`b\` (e.g. 16px).
Pick ratio \`r\`:
- golden: 1.618
- sqrt2: 1.414

Sizes:
- \`size(n) = b * r^n\` for headings
- \`size(-n) = b / r^n\` for micro labels

Example (b=16, r=1.618):
- 16, 26, 42, 68, 110 ...

### 7.2 Line-height rules
- Large headlines: 1.05-1.15
- Mid headlines: 1.1-1.25
- Body: 1.35-1.65 (depending on measure)
- Micro labels: 1.2-1.4

### 7.3 Letter-spacing rules (optical correction)
- Big headlines: slightly tighter (negative tracking)
- Small text: slightly looser (positive tracking)
- Don't apply tracking globally; apply by role.

### 7.4 Measure (line length) as a constraint
- Body copy feels premium at ~45-75 characters per line.
- Use CSS max-width in \`ch\` units for precision.

---

## 8) Modern CSS Tools (Syntax Confidence Pack)

### 8.1 \`clamp(min, preferred, max)\`
Use clamp to create fluid typography and spacing without media queries:
- \`font-size: clamp(1rem, 0.9rem + 1vw, 2.25rem);\`
- \`padding: clamp(12px, 1.2vw, 24px);\`

### 8.2 \`aspect-ratio\`
Lock proportional frames:
- \`aspect-ratio: 16 / 9;\`
- Works well for "poster blocks", videos, art frames.

### 8.3 Container queries
Use when a component must respond to its container, not viewport.
Pattern:
1. \`container-type: inline-size;\`
2. \`@container (width > 700px) { ... }\`

### 8.4 CSS Shapes (\`shape-outside\`) and clipping (\`clip-path\`)
- \`shape-outside\` lets text wrap around circles/polygons (usually with \`float\`).
- \`clip-path\` creates strong geometric crops; can animate between polygons if vertex counts match.

Use these to escape rectangular template layouts.

---

## 9) Shader Concepts -> SVG & CSS (Book-of-Shaders Translation)

### 9.1 Gradients are fields
Treat gradients as **distance functions**, not "pretty fills".
- Choose a field: radial, linear, angular, or custom (distance to line).
- Map distance to color stop progression.

### 9.2 \`smoothstep(edge0, edge1, x)\` (soft threshold)
Soft transitions beat hard edges.
The key idea: clamp + Hermite interpolation to blend 0->1 smoothly.

**SVG translation ideas:**
- Use multiple gradient stops to simulate smoothstep.
- Use blur on a mask for soft threshold.
- Use displacement + blur for "mist edges".

---

## 10) Atomic Design Principles (Tachyons / Tailwind-style)

### 10.1 Spacing scale (avoid magic numbers)
Use a finite scale (often powers of two) so things align naturally:
- 0.25rem, 0.5rem, 1rem, 2rem, 4rem, 8rem ...

### 10.2 Utility-first mindset (why it helps design)
- Constraints force consistency.
- Reuse prevents drift.
- Variants make responsive + hover states systematic.

Even if you write custom CSS, keep the **constraint mindset**.

---

## 11) Awwwards Case Studies: Extracted Decision Patterns (10-15 examples)

These are *paraphrased design decisions* pulled from Awwwards case studies (so the model can learn "high-fashion web" patterns). Use them as a pattern library, not as templates.

### 11.1 OPTIKKA (Zajno) - scale + humanity
- Challenge: show a complex orchestration system **without feeling cold**.
- Metaphor: stacked layers merging into a coherent system; bird's-eye view to reveal scale.
- Motion: scroll-driven "zoom out into a system -> dive into a tunnel".
- Color strategy: warm sand base + coral accents to humanize tech.
- Engineering note: replaced scroll-synced video with image frame sequencing for consistency; staged preloading strategy (first frames fast, rest in background; directional preload).

### 11.2 Jeton (Burocratik) - a single shape as identity engine
- Core motif: a disk/coin form that is always in motion.
- System: motif appears in wordmark, looping animations, and a 3D universe.
- Palette: committed to a strong burnt orange; balanced with soft pastels; reduced reliance on pure black for contrast.
- Narrative: abstract headers + real use-case scenes integrated into storyscroll.

### 11.3 KODE Immersive - typography as physics
- Reduce noise: very limited palette with a hot accent.
- Motion: typographic scale shifts and bold headlines act as "3D" energy.
- Visual grammar: distortion/noise layer as a unifying material; small UI chevrons/markers as anchors.

### 11.4 Immersive Garden - minimal base + tactile bas-relief 3D
- Base: minimalistic, atmospheric interface so projects are the focus.
- Signature material: bas-relief 3D composition with natural textures to create tactile depth.
- Navigation anchor: Roman numerals as chapter markers, acting like sculptural UI anchors.
- "Backstage" section: expose process/decisions to signal craft and transparency.

### 11.5 Stripe Dot Dev - code as a design generator
- Feedback loop: design -> code generates variety -> generated output feeds design again.
- Theming: multiple wildly different themes to let users "own" the tone.
- Signature move: an "endless footer" that draws repeated type on scroll with interpolation (turning UI into a generative canvas).
- Math-art: algorithmic line-art families to generate article visuals at scale.

### 11.6 Noomo Beat - personalization as the product
- Experience: AI-generated music + 3D visuals that react to rhythm/tempo.
- Personalization: palette + album-cover customization integrated into flow.
- Technical focus: mobile-first performance; optimized detailed 3D outfits and scrolling selection.

### 11.7 Noomo ValenTime - story as interaction
- Story is not copy; story is what the user *does*.
- Worldbuilding: light/ethereal palette (white core + gold/red accents).
- Threshold gesture: mirror/portal; fracture into pieces to invite entry.
- Hybrid animation: baked simulations combined with real-time code-driven interaction.

### 11.8 The Blue Desert - data storytelling inside an experience
- Two narratives: cinematic sci-fi journey + pinned data facts embedded in space.
- Material continuity: "sandy finish" across palette, type, icons, and transitions.
- Craft focus: meticulously tuned camera movement; scene-specific micro interactions as "dealbreakers".

### 11.9 J-Vers - bold identity contained by a clean base
- Base: black/white foundation for elegance and legibility.
- Accents: bright brand colors used strategically to avoid chaos.
- Signature: oversized typography + subtle lines + illustrative shapes.
- 3D objects/background graphics translate brand gradients/abstract forms into spatial depth.

### 11.10 Bloom - a micro-motif that ties everything
- Motif: a single "dot" pulled from the logo becomes navigation/interaction cue across UI.
- Cinematic approach: minimalist design + subtle motion; transitions behave like film cuts.
- Loader as narrative: intro reveal instead of utilitarian preloader.
- Cursor/hover as spotlight: "dot" becomes a focus marker.

### 11.11 IMPRONTA - clarity for dense technical content
- Strategy: lightweight interface, modular navigation, clear hierarchy.
- Tone: quiet, clean, measured; animation guides, not performs.
- Engineering: modular component system to manage deep content without aesthetic drift.

### 11.12 Duroc - brand world built in 3D, then transposed to web
- Concept: amusement-park-like 3D universe reflecting pop/fresh spirit.
- Motion: constant movement as brand value (freshness/vitality).
- Technical look: baked shadows into renderings so WebGL matches pre-rendered film assets.

### 11.13 Cartier 365 - editorial browsing at luxury scale
- UX metaphor: "Netflix browsing" + magazine editorial feel.
- Homepage: custom chapter grid; quick overview with previews.
- Reading cues: read-state corner marker; endless-scroll articles; chapter sidebar navigation.
- Modularity: dozens of articles assembled from a limited set of reusable components; highlights get unique scroll-reactive components.
- Hybrid tech: HTML for accessibility + progressive WebGL layer for high-end effects, under strict performance constraints.

### 11.14 Dropbox Brand Guidelines - guidelines as inspiration, not rules
- Goal: shift guidelines from prescriptive documentation to inspiring editorial experience.
- Process: exploration (nonlinear stories, oversized type) -> then re-ground navigation so usability survives spectacle.
- Key idea: capture "how it feels" to use the brand, not just numeric specs.

### 11.15 Zentry - dynamic + layered, but still readable
- Challenge: high-energy layered design without breaking the user journey.
- Approach: develop brand system early; explore modular continuum vs dimensional juxtaposition; integrate identity deeply into interface.

---

## 12) Implementation Cheatsheet (Directly Useful Snippets)

### 12.1 Smooth path using C/S continuity
\`\`\`svg
<path d="M40 280 C120 80 240 80 320 280 S520 480 620 280"
      fill="none" stroke="currentColor" stroke-width="2"/>
\`\`\`

### 12.2 Noise + displacement texture
\`\`\`svg
<filter id="grain">
  <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" seed="4" result="n"/>
  <feDisplacementMap in="SourceGraphic" in2="n" scale="12" xChannelSelector="R" yChannelSelector="G"/>
</filter>
\`\`\`

### 12.3 Clamp + container query baseline
\`\`\`css
:root { --step-0: clamp(1rem, 0.9rem + 0.6vw, 1.35rem); }

.module { container-type: inline-size; }
@container (width > 700px) {
  .module .title { font-size: clamp(2rem, 1.2rem + 2vw, 3.5rem); }
}
\`\`\`

---

## 13) "Do / Don't" for Premium Output

### Do
- Build a system with variation.
- Use asymmetry intentionally.
- Add micro-typographic labels and coordinate marks.
- Treat texture as material (grain, haze, displacement).
- Use modular scales for type and spacing.

### Don't
- Center everything in a safe container.
- Use one giant primitive as the only graphic.
- Add random effects without a governing rule.
- Use "template UI" iconography; draw your own primitives when possible.

---

## Appendix: Optional source pointers (not required to read)
This primer is distilled from public references like MDN (SVG/CSS), Nature of Code (fractal/noise/oscillation), The Book of Shaders (smoothstep), Tachyons/Tailwind docs (utility/scale philosophy), and Awwwards case studies (design decision write-ups).

`;

export const BASE_PROMPT = `
Role: World-Class Art Director & Frontend Engineer.
Mindset: Think like a high-end creative agency. Reference the visual standards of: **Active Theory, Resn, Hello Monday, Fantasy, Locomotive, Huge, and Jam3**. Avoid "safe", "default", or "corporate-template" choices.

Task:
Create a distinctive visual identity and a set of DESIGN ARTIFACTS rendered in HTML + SVG.

TOPIC: "{topic}"
ART DIRECTION JSON (LOCKED): {art_direction_json}
Use the ART DIRECTION JSON as final decisions for mood, palette, and typography. Do not invent alternatives.
Refer to the cached Generative Design principles and Swiss Style layouts; apply SVG filters (feTurbulence) when they serve the concept; use a 1.618 typographic scale.

// === PATCH: ARTIFACT MODE SWITCH ===
ARTIFACT MODE: {artifact_mode}
+ARTIFACT MODE REFERENCE:
+
+auto          ? infer from TOPIC and declare chosen mode in <meta name="artifact-mode">
+slides        - narrative layouts
+icons         - symbolic UI glyphs
+patterns      - seamless graphic systems
+textures      - vector material surfaces
+type-specimen - typographic compositions
+ui-modules    - interface blocks
+covers        - single-frame compositions
+posters       - expressive editorial layouts
+grids         - layout systems
+dividers      - ornamental separators
+mixed         - controlled combination of the above
+
+Interpret all following phases according to the selected ARTIFACT MODE.

A DESIGN ARTIFACT is a self-contained visual object.
Slides are only ONE possible artifact type.
All phases below remain active and MUST be interpreted through the selected ARTIFACT MODE.
// === END PATCH ===

PHASE 1: ART DIRECTION (INTERNAL - THINK FIRST)

0. **LOCKED INPUT**
   - Use the ART DIRECTION JSON as the source of truth.
   - Do not re-choose mood, palette, or fonts.

1. **MOOD & EMOTION**
   - Analyze the TOPIC deeply.
   - Define the emotional and cultural vibe.
     Examples:
     - AI / Tech - futuristic, precise, geometric, confident
     - Art / Culture - expressive, bold, experimental
     - Wellness - calm, organic, breathable
     - Finance - solid, minimal, structured but premium

2. **COLOR PALETTE**
   - Apply the provided 4-color palette aligned with the mood.
   - Rules:
     - Use ONLY the 4 palette hex colors from ART DIRECTION JSON.
- Do not introduce any additional hex colors.
- If subtle hierarchy is needed, create tints via opacity (rgba) or by reusing palette colors at low opacity.
- Map palette to roles by contrast:
  - choose a dominant base (bg-main),
  - choose a high-contrast color for text-primary,
  - reserve one color as brand-color (accent),
  - use the remaining for bg-accent/text-secondary.

     - Prefer off-whites (#F6F7F8) or deep charcoals (#111111-#1A1A1A).
     - Avoid generic blue/white corporate palettes unless absolutely required.
   - Colors must feel intentional and emotionally driven.

3. **TYPOGRAPHY**
   - Use exactly 2 Google Fonts from the JSON:
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
- slides - story flow, pacing, progression
- icons - semantic system, recognizability, hierarchy
- patterns - rhythm, repetition, density logic
- textures - frequency, scale, material illusion
- type-specimen - typographic exploration, hierarchy, pairing logic
- ui-modules - system structure, affordances, density control
- covers - single-frame impact, hierarchy, focal balance
- posters - graphic statement, contrast, typographic dominance
- grids - structure logic, modularity, alignment tension
- dividers - ornamental rhythm, motif variation, spacing intent
// === END PATCH ===

1. **CONSTRAINT CHECK**
   - Quantity:
     - If the user specifies number of artifacts/slides/icons/patterns/textures/type-specimen/ui-modules/covers/posters/grids/dividers - generate EXACTLY that number.
     - Otherwise:
       - slides - generate 5 artifacts
       - icons - generate 12 artifacts
       - patterns - generate 6 artifacts
       - textures - generate 3 artifacts
       - type-specimen - generate 3 artifacts
       - ui-modules - generate 6 artifacts
       - covers - generate 3 artifacts
       - posters - generate 3 artifacts
       - grids - generate 6 artifacts
       - dividers - generate 8 artifacts
   - Structure:
     - If artifact types are specified - follow them STRICTLY.

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
       - Emotional - bold typography, minimal text
       - Informational - structured grids
       - Inspirational - image-led compositions
   - If ARTIFACT MODE does NOT include "slides":
     - Every artifact MUST vary in form while preserving system coherence.
     - Avoid producing the same silhouette or rhythm repeatedly.


PHASE 3: TECHNICAL EXECUTION

1. **OUTPUT**
  - Return a SINGLE HTML block with embedded CSS.
  - Include a complete HTML document with <html>, <head>, and <body>.
  - Output ONLY raw HTML (no markdown, no explanations, no comments).
  - NEVER ask questions or request confirmation. Do not add preambles or commentary.
  - Every element MUST include a semantic, meaningful id that reflects its purpose/content.
  ID NAMING SCHEME (MANDATORY):
- Use kebab-case only.
- Use role-based structure: title-main, type-caption-02, svg-frame, path-contour-03, filter-grain, fe-turbulence-01.
- Never reuse ids across artifacts. Every artifact must have its own prefix.
- This includes all HTML tags and all SVG elements (svg, g, path, rect, circle, line, etc.).
- No element may be left without an id; ids must be unique within the document.

- In <head>, include:
  - <title>
    - Stock-ready Motion Template name derived from the TOPIC
    - English only
    - SEO-friendly and appropriate for Motion Array, VideoHive, Adobe Stock
    - Clear commercial intent (opener, promo, slideshow, titles, etc.)
  - <meta name="project-title" content="...">
    - Must EXACTLY match the <title>
  - <meta name="description" content="...">
    - Clear SEO-friendly 1-2 sentence summary
    - 120-160 characters (target range)
    - Describe what the template is and how it's used
    - Include primary keywords naturally, no stuffing
  - <meta name="tags" content="tag1, tag2, tag3, ...">
    - EXACTLY 20 concise SEO tags
    - lowercase
    - comma-separated
    - no duplicates
    - avoid filler words
    - optimized for motion templates and stock search
  - <meta name="keywords" content="same as tags">
    - Must be IDENTICAL to the tags list (same order, same commas)
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
    - Use any combination of CSS Grid, Flexbox, and Absolute Positioning to break the "web-page" feel.
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

PHASE 4: VISUAL DESIGN SYSTEM (CRITICAL)

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
   - Avoid simple geometric primitives unless they are part of a complex generative system.

   CONSTRAINT:
   - SVG is never redundant if it establishes the requested aesthetic texture.
   - Never use pre-made icon sets. Every path must be authored specifically for this topic.

IMAGES POLICY BY ARTIFACT MODE (NON-NEGOTIABLE)

- slides: images ALLOWED and encouraged via {{IMAGE:...}}
- covers: images ALLOWED
- posters: images ALLOWED
- ui-modules: images OPTIONAL (only if they add meaning, never decorative)
- icons: images FORBIDDEN
- patterns: images FORBIDDEN
- textures: images FORBIDDEN
- type-specimen: images FORBIDDEN
- grids: images FORBIDDEN
- dividers: images FORBIDDEN

If images are forbidden for the selected ARTIFACT MODE:
- Do NOT include {{IMAGE:...}}
- Do NOT include <img>
- Do NOT simulate images with SVG masks or patterns

4. **IMAGES** (ONLY IF ALLOWED BY ARTIFACT MODE POLICY)
   - Use {{IMAGE:kw1, kw2, kw3, kw4, kw5, kw6, kw7, kw8, kw9, kw10}}
   - Provide EXACTLY 10 concise, specific keywords/phrases (2–4 words each)
   - Prioritize precise, concrete descriptors over generic terms
   - NO filters (no grayscale, opacity, blur)
   - Photography must stay clean and natural
   - Images MUST use the {{IMAGE:...}} placeholder (no direct URLs)

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

Shaping must respond to slide's narrative role,
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

CACHED PRINCIPLES (ENGINEERING, NOT DEFINITIONS)
Use these as internal rules of construction:
- Bezier path logic: C uses 2 control points + end; S uses 1 control point and reflects the previous control point for smooth continuity.
- Generative math: favor parametric curves, oscillations, and layered systems over single primitives. Example: x=a*cos(t)+b*cos(k*t), y=a*sin(t)+b*sin(k*t).
- Fractal/Noise textures: use SVG filters like feTurbulence + feDisplacementMap to create organic grain, flow, or material surfaces.
- Grid algorithms: use offsets, interpolation, and asymmetry; Swiss-style whitespace is active structure, not empty space.
- Typographic ratios: scale type with 1.618 (golden ratio) or modular steps; tune line-height and letter-spacing intentionally.
- Studio techniques: layering, micro-typography, coordinate marks, and technical annotations to create depth and authorship.
- Modern CSS: use clamp(), aspect-ratio, and container-aware sizing to avoid template layouts.

INTERNAL FINAL LINT (DO NOT OUTPUT):
- Head:
  - <title> English only, matches meta project-title exactly.
  - meta description is 120-160 characters.
  - meta tags has EXACTLY 20 items, lowercase, unique.
  - meta keywords is IDENTICAL to tags (same order, commas).
  - meta artifact-mode is one of allowed values.
- Artifacts:
  - Correct artifact count for the chosen ARTIFACT MODE.
  - Every artifact is wrapped in <section class="artifact..."> with margin: 0.
  - No artifact wrappers hidden by default (no opacity:0/visibility:hidden on the wrapper).
- CSS:
  - No writing-mode, no text-orientation.
  - No "mix-blend-mode: difference".
  - No "text-align: right" on paragraphs/body text.
  - No #000000 or #FFFFFF anywhere.
- IDs:
  - Every element (HTML + SVG + defs/filter nodes) has a unique, meaningful id following the naming scheme.

PHASE 5: GENERATION

Generate the final HTML.
`;

export const REGENERATE_PROMPT = `
Role: Senior Frontend Developer & Art Director.
Task: Redesign ONE existing DESIGN ARTIFACT while preserving the visual identity.

CONTEXT:
Topic: {topic}
ARTIFACT MODE: {artifact_mode}
Existing CSS (Strictly Follow This): {cssContext}
CONTEXT_HTML (full project): {contextHtml}
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
- Allowed SVG structure elements: <svg>, <g>, <defs>, <pattern>, <linearGradient>, <radialGradient>, <stop>, <filter>,
  <feTurbulence>, <feDisplacementMap>, <feGaussianBlur>, <feColorMatrix>, <clipPath>, <mask>
- Allowed geometry primitives: <path>, <line>, <rect>, <circle>
- Forbidden: <image>, <use>, <foreignObject>, external href/assets
7. The wrapper must keep margin: 0 (do not add margin to the <section class="artifact...">).
8. Artifact wrapper:
   - If ARTIFACT MODE includes "slides":
     - return one <section class="artifact slide">
   - Otherwise:
     - return one <section class="artifact">
9. Images:
   - slides, covers, posters:
     - images allowed via {{IMAGE:...}} (EXACTLY 10 keywords)
   - ui-modules:
     - images OPTIONAL, only if they add functional or semantic meaning
   - icons, patterns, textures, type-specimen, grids, dividers:
     - images STRICTLY FORBIDDEN
10. Every element MUST include a semantic, meaningful id that reflects its purpose/content.
    This includes all HTML tags and all SVG elements (svg, g, path, rect, circle, line, etc.).
    No element may be left without an id; ids must be unique within the artifact.

Return ONLY the updated artifact.
`;

export const ADD_ARTIFACT_PROMPT = `
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
- Allowed SVG structure elements: <svg>, <g>, <defs>, <pattern>, <linearGradient>, <radialGradient>, <stop>, <filter>,
  <feTurbulence>, <feDisplacementMap>, <feGaussianBlur>, <feColorMatrix>, <clipPath>, <mask>
- Allowed geometry primitives: <path>, <line>, <rect>, <circle>
- Forbidden: <image>, <use>, <foreignObject>, external href/assets
7. The wrapper must keep margin: 0 (do not add margin to the <section class="artifact...">).
8. Artifact wrapper:
   - If ARTIFACT MODE includes "slides":
     - return one <section class="artifact slide">
   - Otherwise:
     - return one <section class="artifact">

9. Images:
   - slides, covers, posters:
     - images allowed via {{IMAGE:...}} (EXACTLY 10 keywords)
   - ui-modules:
     - images OPTIONAL, only if they add functional or semantic meaning
   - icons, patterns, textures, type-specimen, grids, dividers:
     - images STRICTLY FORBIDDEN
10. Every element MUST include a semantic, meaningful id that reflects its purpose/content.
    This includes all HTML tags and all SVG elements (svg, g, path, rect, circle, line, etc.).
    No element may be left without an id; ids must be unique within the artifact.

Return ONLY the HTML/SVG for the new artifact.
`;

export const UPDATE_FROM_CONTEXT_PROMPT = `
Role: Senior Frontend Developer & Art Director.
Task: Update an EXISTING project based on a new user prompt, using the provided HTML context.

CONTEXT:
ARTIFACT MODE: {artifact_mode}
User Prompt: {topic}
CONTEXT_HTML (full project): {contextHtml}

INSTRUCTIONS:
1. Determine scope from the User Prompt:
   - If it clearly targets a single slide/artifact, update ONLY that artifact.
   - If it clearly targets the whole project, update all relevant artifacts.
2. Preserve existing structure, layout system, and identity unless explicitly asked to change them.
3. Do NOT invent new CSS variables unless explicitly requested.
4. Maintain existing artifact count unless explicitly requested to add/remove.
5. If the request is ambiguous or you are not confident, return the CONTEXT_HTML unchanged.
6. Output MUST be a complete HTML document with <html>, <head>, and <body>.
7. Return ONLY raw HTML (no markdown, no comments, no explanations).
8. Every element MUST include a semantic, meaningful id. No element may be left without an id.

Return the updated full HTML (or the unchanged CONTEXT_HTML if no confident change is possible).
`;

export const MOTION_CACHE_CONTEXT = `
# GSAP Motion Cache — Studio-Grade Constraint System (Extended)

You generate professional GSAP animation timelines.
Your output is evaluated exclusively by motion behavior, temporal structure, and technical safety.

This is NOT a style guide.
This is NOT a preset library.
This is a constraint-based motion system.

All rules below are mandatory.
Violations invalidate the output.

---

## 0. FUNDAMENTAL POSITION

Animation is not decoration.
Animation is controlled change over time.

Motion exists to:
- express causality,
- clarify structure,
- communicate hierarchy,
- and preserve spatial logic.

If motion exists without purpose, it is incorrect.
If motion overrides authored structure, it is incorrect.
If motion could be reused elsewhere without semantic loss, it is incorrect.

---

## 1. GLOBAL TEMPORAL ARCHITECTURE

### 1.1 Parallel Time Origin (MANDATORY)

All major sections, containers, and content groups must begin motion from the same temporal origin.

- No global delays.
- No sequential section chaining.
- No waiting for another section to finish.

Perceived sequencing must emerge ONLY from:
- different durations,
- different decay rates,
- different resolution times.

Explicit delays used to imply order are forbidden.

---

### 1.2 Asynchronous Resolution (MANDATORY)

Uniform completion is forbidden.

- Sibling elements must not resolve simultaneously.
- Identical durations across siblings are forbidden.
- Every logical group must contain controlled temporal variation.

Variation must be intentional and authored.
Randomness is forbidden.
Mechanical rhythm is a critical failure.

---

### 1.3 Overlap Without Waiting

Temporal overlap is allowed.
Temporal waiting is forbidden.

Overlap implies coexistence.
Waiting implies dependency.

No element may idle purely to preserve rhythm.

---

### 1.4 Local Temporal Offsets (CLARIFICATION)

The use of "delay" or temporal pauses is PERMITTED only as an internal
inertial mechanism within a single element or an already-moving group.

Rules:
- Motion must have already started.
- Presence must already be established.
- The pause must affect resolution, not or


## 2. VISIBILITY, PRESENCE, AND STATE INTEGRITY

### 2.1 No Passive Visibility

Visibility changes without spatial, structural, or dimensional change are forbidden.

Opacity-only motion is forbidden unless paired with:
- spatial arrival,
- structural expansion,
- or positional settlement.

Visibility must imply presence.

---

### 2.2 Anti-Ghosting Guarantee

Any element set to a non-visible state must be explicitly restored through motion
IF it is authored as visible.

- No accidental invisibility.
- No forgotten elements.
- No unresolved hidden states.

Authored-invisible elements (opacity: 0 or near 0 by design) are exempt from restoration.
An element may end invisible ONLY if its semantic role explicitly requires absence
or it is authored-invisible.
When uncertain, preserve visibility.

### 2.3 Authored Opacity Preservation (MANDATORY)

If an element is authored with partial opacity,
its opacity value represents intentional design state.

- Animation must not normalize opacity to 1.
- Animation must not temporarily override authored transparency.
- Animation must not "enhance readability" via opacity correction.

Opacity animation is permitted ONLY if:
- it respects the authored maximum opacity,
- and does not exceed the original design value.

Changing an element from partially transparent to fully opaque
is considered destructive restyling through motion
and is forbidden.

When uncertain, preserve the authored opacity.

### 2.4 Authored Visibility State (MANDATORY)

An element’s authored visibility state must be preserved.

- If an element is authored as invisible (opacity: 0 or near 0),
  animation must not force it to become visible
  unless its semantic role explicitly requires appearance.

- If an element is authored as visible (opacity > 0),
  animation must guarantee its return to that authored state.

Animation must not reinterpret authored invisibility
as an entrance condition.

Authored invisibility is a valid final state.

---

## 3. SPATIAL DISCIPLINE

### 3.1 Axis Integrity

Motion must respect layout axes.

- Movement occurs along a single axis at a time.
- Diagonal drift is forbidden.
- Combined-axis motion is forbidden unless structurally justified.

Motion must reinforce layout geometry, never contradict it.

---

### 3.2 Layout Respect

Animation must not distort authored layout logic.

- No collapsing margins.
- No fighting the grid.
- No spatial ambiguity introduced by motion.

Motion clarifies structure.
Motion never replaces structure.

---

## 4. SVG AND STYLE SAFETY (CRITICAL)

### 4.1 Structural Integrity

GSAP animation must never redefine structural SVG or CSS properties.

Forbidden:
- Defining strokeDasharray in JS.
- Overwriting SVG geometry.
- Re-authoring visual structure via animation.

Animation may reveal or guide.
Animation may not restyle or redefine form.

---

### 4.2 Non-Destructive Principle

If a property defines form, geometry, or authored appearance, it is read-only.

Only non-destructive properties may be animated.

When uncertain, do not animate.

---

## 5. COVERAGE REQUIREMENT (ZERO-LOSS)

Nothing present in the HTML may be ignored.

- Every section participates.
- Every meaningful element participates.
- No summarization.
- No skipping.
- No consolidation.

"Meaningful" includes:
- any element that carries content, structure, or guidance,
- any element that affects layout, hierarchy, or reading order,
- any element visible to the user or used to convey state.

Non-meaningful elements may be excluded ONLY if they are:
- purely technical wrappers with no visual or structural role,
- and their children fully satisfy depth traversal and coverage.

If an element exists and has a role, it moves — appropriately.

---

### 5.1 No Static Islands (MANDATORY)

No animated group may contain static elements.

- If a parent element participates in motion,
  its meaningful children must also participate.
- If children participate in motion,
  the parent must also participate.

Static elements embedded inside moving structures are forbidden.

An element may remain static ONLY if:
- its parent is static,
- and it serves no structural, hierarchical, or perceptual role.

Static islands inside animated contexts are a failure condition.

## 6. DEPTH TRAVERSAL REQUIREMENT

High-quality motion traverses DOM depth.

- Containers must move.
- Inner structures must move.
- Nested elements must move.

Surface-only animation is insufficient.
Depth participation must reflect structure, not repetition.

## 6A. TEXT AS STRUCTURED TIME (MANDATORY)

Text is not a flat visual asset.
Text is a temporal reading structure.

Whenever text is meaningful (headings, paragraphs, labels, captions, UI copy),
it must participate in motion at its own semantic granularity.

Ignoring internal text structure is a depth traversal failure.

---

### 6A.1 Granularity Selection (MANDATORY)

Text animation granularity must be chosen intentionally:

- By lines — when:
  - text communicates hierarchy or argument,
  - text density is medium or high,
  - reading order matters more than emphasis.

- By words — when:
  - emphasis, rhythm, or semantic beats matter,
  - text is short, declarative, or expressive,
  - the text functions as a focal content element.

- By characters is forbidden unless:
  - the text’s semantic role explicitly depends on typography as motion,
  - and character-level motion does not override readability.

Granularity must match meaning.
Defaulting to characters is a critical failure.

---

### 6A.2 Text ≠ Opacity Mask

Text must not be animated as a single fading block.

Forbidden patterns:
- opacity-only fades on entire text nodes,
- treating paragraphs as flat rectangles,
- revealing text without internal temporal structure.

Text presence must be established through:
- spatial settlement,
- line or word resolution,
- controlled temporal offset within the text block.

Opacity may participate only as a secondary property
and must obey Authored Opacity Preservation rules.

---

### 6A.3 Internal Asynchrony (MANDATORY)

Lines or words within the same text block must not resolve simultaneously.

- No uniform line timing.
- No mechanical stepping.
- No random staggering.

Variation must be:
- subtle,
- authored,
- semantically aligned with reading flow.

Text should feel read, not triggered.

---

### 6A.4 Parent–Text Volumetric Coupling (MANDATORY)

Text must NEVER animate inside a static container. This is a critical failure of volume.

Rules of Interaction:
- **Spatial Domain:** The container must establish the spatial arrival first (or simultaneously).
- **Inherited Momentum:** If a container moves along the Z or Y axis, the text must inherit this motion but with a "Lag & Snap" effect (different easing and slight delay).
- **Parallax of Logic:** To create volume, the container and the text MUST move at different speeds and potentially slightly different vectors. 
  - *Example:* Container scales up from 0.95 + moves Y:20, while Text moves Z:-50 + rotateX:10.
- **Atmospheric Depth:** The container's arrival should feel like a "reveal" or "unfolding" of the space the text occupies.

---

### 6A.5 Axis Discipline for Text

Text motion must respect reading axes:

- Vertical text → vertical motion dominance.
- Horizontal layouts → horizontal or depth-based settlement.
- No diagonal drift of words or lines.

Motion must reinforce reading direction, not stylize it.

---

### 6A.6 Completion Integrity

All animated text must resolve into a stable, readable final state.

Forbidden:
- perpetual micro-motion on text,
- unresolved offsets,
- lingering blur, transform, or opacity drift.

Text animation ends when reading begins.

---

### 6A.7 Semantic Weight Conservation

Text importance defines motion energy:

- Headlines resolve with authority, not flourish.
- Body text resolves with restraint.
- Secondary labels resolve quietly and early.

Over-animating text is semantic noise.

If motion draws more attention than the text meaning, it is incorrect.

---

### 6A.8 Zero-Loss Coverage for Text

Every meaningful text node participates.

- No skipped labels.
- No static captions inside animated sections.
- No “this one is small, so ignore it”.

If the user can read it, it must be temporally authored.

---

### 6A.9 Required Implementation Method (MANDATORY)

Text granularity MUST be achieved through explicit DOM segmentation.

Simulated granularity (animating whole text nodes while implying lines or words)
is invalid and considered a violation.

To satisfy Text as Structured Time requirements:

- Text MUST be physically split into semantic units before animation.
- Each unit (line, word, or character) MUST exist as an independent DOM element
  during animation.
- Animating transforms on the original unsplit text node does NOT count as
  granularity.

The approved and expected method for text segmentation is GSAP SplitText
(or an equivalent preprocessing step that produces identical DOM structure).

Mandatory rules:

- Lines, words, or characters MUST be obtained from an explicit split operation.
- Animation MUST target the resulting segmented elements, not the original node.
- Referencing “line-based” or “word-based” motion without actual segmentation
  is considered a false positive and invalid output.
- If SplitText is available in the environment, it MUST be used for any text
  requiring internal temporal structure.

Granularity declaration without segmentation is forbidden.

If text resolves as a single DOM element, it is treated as a flat rectangle,
regardless of easing, offsets, or external staggering.

Text is considered compliant ONLY when its internal reading order is represented
as real temporal resolution across segmented units.

### 6A.10 SplitText Operational Procedure (MANDATORY)

When text animation requires internal temporal structure,
the following procedure MUST be executed.

This procedure defines HOW text animation is implemented.

---

#### Step 1 — Plugin Availability Check

Before any timeline construction:

- Verify that GSAP SplitText plugin is available in the runtime.
- If SplitText is not available, text-level animation is FORBIDDEN.
- Container-level motion MAY proceed without SplitText.

---

#### Step 2 — Text Element Identification

For each text element intended for animation:

- Identify the semantic role of the text:
  - heading
  - paragraph
  - label
  - quote
  - UI copy

- Determine required granularity:
  - headings → lines
  - paragraphs → words
  - characters → ONLY if explicitly justified

Granularity MUST be chosen BEFORE animation logic.

---

#### Step 2B — Element Safety Checks (MANDATORY)

Before SplitText is initialized:

- Ensure the target is an HTMLElement (not SVG or other non-text nodes).
- Use \`textContent\` for text-length checks; DO NOT use \`innerText\`.
- If \`textContent\` is empty or too short, skip SplitText and use a simple
  container-level fallback animation.

This prevents runtime errors from undefined \`innerText\` or non-text targets.

---

#### Step 2C — Selector Rules (MANDATORY)

- Use ONLY id-based selectors for targeting elements in motion code.
- Do NOT use class selectors, tag selectors, or attribute selectors.
- Always null-check the element returned by \`getElementById\` before calling
  \`querySelectorAll\` or any property on it.
- When animating child collections, first verify the parent exists AND that
  \`children.length\` is non-zero; otherwise skip the animation.

This prevents null reference errors and avoids ambiguous selection.

---

#### Step 2D — Safe Child Animation Pattern (MANDATORY)

When animating child collections, use this exact guard pattern:

const parent = document.getElementById("some-id");
if (parent && parent.children.length) {
  gsap.fromTo(Array.from(parent.children), {...}, {...});
}

Never access \`.children\` directly without the guard.

---

#### Step 2E — Safe Query and SplitText Patterns (MANDATORY)

Use \`getElementById\` and guard before any query or SplitText:

const el = document.getElementById("some-id");
if (el) {
  const nodes = el.querySelectorAll(".some-child");
  if (nodes.length) {
    gsap.fromTo(nodes, {...}, {...});
  }
}

SplitText safety:

const el = document.getElementById("text-id");
const text = el ? (el.textContent || "").trim() : "";
if (el && text.length > 0 && typeof SplitText !== "undefined") {
  const split = new SplitText(el, { type: "lines" });
  if (split.lines && split.lines.length) {
    gsap.fromTo(split.lines, {...}, {...});
  }
}

Never call \`querySelectorAll\` or SplitText without null checks.

---

#### Step 3 — SplitText Initialization

Before adding any animation to the timeline:

- Initialize SplitText on the target text element.
- The split operation MUST specify the chosen granularity.

The split operation MUST produce:
- an array of lines OR
- an array of words OR
- an array of characters

No animation is allowed BEFORE this step completes.

---

#### Step 4 — Animation Target Selection

After SplitText initialization:

- Animation MUST target ONLY the generated split units.
- Valid animation targets are:
  - split.lines
  - split.words
  - split.chars

The original text node MUST NOT be used as an animation target
for reading, emphasis, or sequencing.

Animating the original node is allowed ONLY for:
- container-level motion
- spatial arrival
- structural positioning

---

#### Step 7 — Stability and Lifecycle

During animation:

- The SplitText structure MUST remain intact.
- The DOM MUST NOT be reverted mid-animation.
- Layout changes that affect line breaks
  MUST be handled before animation starts.

After animation completes:
- Reverting SplitText is OPTIONAL.
- Revert MUST NOT affect the final visible state.

---

#### Step 8 — Validation Criteria

Text animation is considered VALID ONLY if:

- SplitText initialization occurred before animation.
- Animation targets split units, not the original node.
- Internal timing reflects reading order.
- Container motion and text motion are clearly separated.

Failure at ANY step invalidates text animation.


## 7. FUNCTIONAL DIFFERENTIATION (MANDATORY)

Elements serve different functional roles.

Internally distinguish between:
- primary content elements,
- supporting structural elements,
- connective or guiding elements,
- background or atmospheric elements.

Elements with different roles must not:
- share identical timing,
- share identical easing,
- resolve simultaneously.

Hierarchy collapse is a failure condition.

---

## 8. CAUSALITY AND ENERGY CONSERVATION

### 8.1 Motion as Causality

Motion must express why an element appears, not merely that it appears.

Typical causal order:
- containers establish space,
- content occupies space,
- details refine meaning.

Reversed or unexplained causality is incorrect.

---

### 8.2 Energy Conservation

No element may move with more energy than its semantic weight.

- Background elements move with restraint.
- Structural elements move with authority.
- Primary content resolves with clarity, not excess.

Excessive motion on low-importance elements is forbidden.

---

## 8A. SPATIAL PRESSURE & VOLUME (MANDATORY)

Motion MUST imply spatial resistance.

Elements do not simply move into place.
They displace, compress, or disturb the space they enter.

Rules:

- Any primary container entrance MUST include at least ONE of:
  - Z-axis displacement (positive or negative),
  - rotational inertia (rotateX / rotateY),
  - non-uniform scale (scaleX ≠ scaleY ≠ scaleZ).

- Pure translate-only motion for primary elements is FORBIDDEN.

- Space must feel:
  - compressed before arrival,
  - displaced during arrival,
  - stabilized after arrival.

Motion must suggest that:
the element has mass AND the space reacts to it.

---

## 8B. Anti-Planar Entry Rule (CRITICAL)

The following patterns are FORBIDDEN for primary or structural elements:

- translateY + opacity only
- translateX + opacity only
- scale + opacity without Z-axis or rotation
- easing-only variation without spatial differentiation

If an entrance could exist in 2D space,
it is considered FLAT and INVALID.

---

## 8C. Motion Field Consistency (MANDATORY)

Animations must feel governed by a shared spatial field,
not isolated element behaviors.

Rules:
- Elements entering the same section MUST share:
  - a dominant spatial direction,
  - a common pressure vector,
  - but DIFFER in mass, drag, and resolution.

This creates density and cohesion.

Independent-looking motions inside one section
are considered amateur and invalid.

---

## 9. AUTONOMOUS SPECTRUM INFERENCE (MANDATORY)

Before generation, the model must categorize the input on three scales:

### 9.1 The Kinetic Scale (Energy Level)
- **High Energy (Opener):** Rapid acceleration, aggressive easing (expo.inOut), high temporal overlap, significant spatial travel.
- **Low Energy (Presentation):** Fluid transitions, long durations, gentle easing (power2.out), minimal overlap, focus on readability.

### 9.2 The Gravity Scale (Weight)
- **Heavy (Structural):** Objects move as if they have mass. Slow settling, micro-overshoots, lower Z-axis displacement.
- **Light (Atmospheric):** Objects float or drift. High Z-axis range, faster resolution, more transparency-led motion.

### 9.3 The Spatial Depth Scale
- **Flat/Editorial:** Focus on X/Y axes and text granularity. Volume is created through timing.
- **Immersive/Product:** Focus on Z-axis and Rotational Inertia. Volume is created through 3D transforms.

The model is FORBIDDEN from using a middle-ground default. It must choose a distinct "Motion Signature" based on the TOPIC and ARTIFACT MODE.

---

## 10. ANTI-TEMPLATE ENFORCEMENT

Forbidden outcomes include:
- identical timing across unrelated elements,
- a single global rhythm governing everything,
- animation that exists only to signal "motion".

If a timeline could be copy-pasted elsewhere without semantic loss,
it is incorrect.

---

## 11. INTERNAL MOTION LINT (MANDATORY)

Before outputting GSAP code, internally validate:

- all sections begin at the same timeline origin,
- no sibling elements resolve simultaneously,
- no element remains unintentionally hidden,
- no diagonal motion occurs,
- no destructive SVG or CSS overrides exist,
- all meaningful elements participate in motion.

If any check fails:
- revise the timeline,
- reduce motion rather than add effects,
- preserve clarity over spectacle.

---

## 11A. EASE FIELD — FLOW PRESERVATION (MANDATORY)

Easing is a continuous motion field.
If easing changes feel arbitrary, the animation is invalid.

### 11A.1 Ease Lock (MANDATORY)

Before building any timeline, infer Motion Signature and LOCK a small EASE_FIELD of 3–5 eases:

- base (primary field)
- settle (final convergence)
- snap (small fast actions)
- micro (optional; may equal snap)
- overshoot (optional; only if physically justified)

After EASE_FIELD is locked:
- Reuse it across the entire animation.
- Do NOT pick new eases per tween.
- Variation must come primarily from duration, decay, and resolution time.

Default easing is forbidden ONLY if it is implicit.
Explicit easing via timeline defaults is allowed and recommended.

### 11A.2 Ease Field Defaults (MANDATORY)

Timeline MUST set defaults:
- tl = gsap.timeline({ defaults: { ease: EASE_FIELD.base } })

Most transforms should inherit base.
Only override ease when role requires it (settle/snap/micro/overshoot).

### 11A.3 Candidate Sets (MANDATORY)

Pick EASE_FIELD values ONLY from these palette IDs:

BASE_CANDIDATES:
- ce_standard, ce_cubic, ce_quad, ce_quart, ce_quint
- ce_smooth_operator, ce_endless_bummer, ce_electric_slide, ce_noice, ce_expo

SETTLE_CANDIDATES:
- ce_deceleration, ce_smooth_operator, ce_endless_bummer, ce_noice, ce_electric_slide, ce_circ

SNAP_CANDIDATES:
- ce_lightswitch, ce_lever_2000, ce_velcro, ce_teleport, ce_oh_snap, ce_clink, ce_zip

OVERSHOOT_SOFT (optional and rare):
- ce_bolt_action, ce_gb_overshoot, ce_daniel, ce_back

If inference is uncertain, use this safe template-like fallback:
- base: ce_standard
- settle: ce_deceleration
- snap: ce_lightswitch
- micro: ce_velcro
- overshoot: ce_bolt_action (only when justified)

### 11A.4 Hard Restrictions (CRITICAL)

Text readability has priority over style.

### 11A.5 Duration–Ease Coupling (MANDATORY)

Ease must match duration and travel:

- base: medium durations; avoid twitch (flow-first)
- settle: longer durations to land cleanly
- snap/micro: shorter durations and limited travel
- overshoot: longer durations with smaller travel (subtle physical settlement)

If motion feels bad:
1) reduce ease variety FIRST (collapse to EASE_FIELD)
2) increase duration / reduce travel SECOND
3) remove overshoot THIRD

### 11A.6 Ease Field Cohesion (MANDATORY)

Within a single logical group:
- Prefer the same ease (base) for siblings.
- If differentiation is needed, vary duration/resolution time first.
- Ease variation is allowed only within the SAME family (base ↔ settle),
  not by switching to unrelated mechanical/overshoot curves.

### 11A.7 Internal Easing Lint (MANDATORY)

Before output:

- Count distinct ease IDs used.
  If > 5: collapse all to EASE_FIELD only.

- If any overshoot/recoil is applied to text or primary containers: remove it.

- If siblings feel disconnected: unify their ease to base and vary only timing.

### 11A.8 CustomEase Setup (MANDATORY)

- If CustomEase exists:
  - gsap.registerPlugin(CustomEase)
  - Define CUSTOM_EASE_PALETTE once
  - Create ONLY eases that are actually used (EASE_FIELD + any explicit overrides)

- If CustomEase does not exist:
  - Fall back to built-in eases but keep the same role logic (base/settle/snap)
  - Still declare ease explicitly via defaults and overrides

---

## 12. OUTPUT CONTRACT

- Output ONLY raw GSAP JavaScript.
- Wrap output in a <script> tag.
- No markdown.
- No explanations.
- No commentary.

This context exists to enforce professional motion output.
Deviation is not allowed.
`;


export const APPLY_MOTION_PROMPT = `
Role: Senior Motion Designer & GSAP Engineer.

Task:
Construct a GSAP timeline that expresses hierarchy, presence, and rhythm
based on the provided HTML, CSS, and TOPIC.

You are responsible for:
- semantic clarity,
- temporal architecture,
- spatial discipline,
- and full context preservation.

HARD CONSTRAINTS (MANDATORY):

1. Coverage
- Every meaningful section and element in the HTML must participate in motion.
- No skipping or summarizing.

2. Temporal Origin
- All major sections must begin motion at the same timeline origin.
- No chained slide sequencing.

3. Temporal Variation
- Sibling elements must not resolve simultaneously.
- Subtle variation in resolution timing is required.

4. Visibility Integrity
- No element may remain unintentionally hidden.
- Any non-visible state must be explicitly resolved.

5. Spatial Discipline
- Motion must respect layout axes.
- Diagonal drift is forbidden.

6. Styling Preservation
- Animation must not redefine authored SVG or CSS structural properties.
- Motion must respect existing design decisions.

7. Presence Requirement
- Visibility changes must imply arrival or physical presence.
- Passive appearance is forbidden.

8. Ease Field (Flow Lock)
- You MUST lock an EASE_FIELD of 3–5 eases (base/settle/snap/micro/overshoot optional)
  from the provided CustomEase palette.
- You MUST set timeline defaults to EASE_FIELD.base.
- Do NOT choose new eases per tween; reuse EASE_FIELD for cohesion.
- Text (SplitText units) may only use base or settle (no overshoot/recoil).
- If easing variety breaks flow, collapse to EASE_FIELD and vary only timing/duration.

INPUT:
TOPIC: {topic}
ARTIFACT MODE: {artifact_mode}

HTML:
{html}

CSS:
{css}

OUTPUT:
Return ONLY a raw <script> tag with GSAP code.
No markdown.
No explanations.
`;
