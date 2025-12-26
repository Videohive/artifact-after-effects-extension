import { INLINE_TEXT_TAGS, NON_TEXT_TAGS } from './constants';
import { getClampedBorderRadius, parseBorderRadius } from './border';
import { AEBounds, AEBoxShadow } from './types';

export const clampFinite = (n: number) => (Number.isFinite(n) ? n : 0);

export const calculateTracking = (letterSpacing: string, fontSizePx: number): number => {
  if (!letterSpacing || letterSpacing === 'normal') return 0;
  const px = parseFloat(letterSpacing);
  return isNaN(px) || fontSizePx <= 0 ? 0 : (px / fontSizePx) * 1000;
};

const parseClipLength = (value: string, reference: number): number => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? (pct / 100) * reference : 0;
  }
  const px = parseFloat(trimmed);
  return Number.isFinite(px) ? px : 0;
};

const parseClipPosition = (value: string, reference: number): number => {
  const v = (value || '').trim().toLowerCase();
  if (!v) return reference / 2;
  if (v === 'left' || v === 'top') return 0;
  if (v === 'right' || v === 'bottom') return reference;
  if (v === 'center') return reference / 2;
  return parseClipLength(v, reference);
};

const toFourValues = (values: number[]): [number, number, number, number] => {
  if (values.length === 1) return [values[0], values[0], values[0], values[0]];
  if (values.length === 2) return [values[0], values[1], values[0], values[1]];
  if (values.length === 3) return [values[0], values[1], values[2], values[1]];
  return [values[0], values[1], values[2], values[3]];
};

const buildPolygonShape = (points: { x: number; y: number }[]) => {
  const vertices = points.map(p => ({ x: p.x, y: p.y }));
  const inTangents = points.map(() => ({ x: 0, y: 0 }));
  const outTangents = points.map(() => ({ x: 0, y: 0 }));
  return { vertices, inTangents, outTangents, closed: true };
};

const buildEllipseShape = (cx: number, cy: number, rx: number, ry: number) => {
  const k = 0.5522847498307936;
  const vertices = [
    { x: cx + rx, y: cy },
    { x: cx, y: cy + ry },
    { x: cx - rx, y: cy },
    { x: cx, y: cy - ry }
  ];
  const inTangents = [
    { x: 0, y: -ry * k },
    { x: rx * k, y: 0 },
    { x: 0, y: ry * k },
    { x: -rx * k, y: 0 }
  ];
  const outTangents = [
    { x: 0, y: ry * k },
    { x: -rx * k, y: 0 },
    { x: 0, y: -ry * k },
    { x: rx * k, y: 0 }
  ];
  return { vertices, inTangents, outTangents, closed: true };
};

const buildRoundedRectShape = (
  x: number,
  y: number,
  w: number,
  h: number,
  radii: {
    tl: { rx: number; ry: number };
    tr: { rx: number; ry: number };
    br: { rx: number; ry: number };
    bl: { rx: number; ry: number };
  }
) => {
  const k = 0.5522847498307936;
  const tlx = radii.tl.rx;
  const tly = radii.tl.ry;
  const trx = radii.tr.rx;
  const tryy = radii.tr.ry;
  const brx = radii.br.rx;
  const bry = radii.br.ry;
  const blx = radii.bl.rx;
  const bly = radii.bl.ry;

  const vertices = [
    { x: x + tlx, y },
    { x: x + w - trx, y },
    { x: x + w, y: y + tryy },
    { x: x + w, y: y + h - bry },
    { x: x + w - brx, y: y + h },
    { x: x + blx, y: y + h },
    { x, y: y + h - bly },
    { x, y: y + tly }
  ];

  const inTangents = [
    { x: -tlx * k, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: -tryy * k },
    { x: 0, y: 0 },
    { x: brx * k, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: bly * k },
    { x: 0, y: 0 }
  ];

  const outTangents = [
    { x: 0, y: 0 },
    { x: trx * k, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: bry * k },
    { x: 0, y: 0 },
    { x: -blx * k, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: -tly * k }
  ];

  return { vertices, inTangents, outTangents, closed: true };
};

const clampRadius = (value: number, max: number) =>
  Math.max(0, Math.min(Number.isFinite(value) ? value : 0, max));

const normalizePair = (
  a: { rx: number; ry: number },
  b: { rx: number; ry: number },
  key: 'rx' | 'ry',
  limit: number
) => {
  const sum = a[key] + b[key];
  if (sum <= limit || sum === 0) return;
  const s = limit / sum;
  a[key] *= s;
  b[key] *= s;
};

const clampRadii = (
  r: {
    tl: { rx: number; ry: number };
    tr: { rx: number; ry: number };
    br: { rx: number; ry: number };
    bl: { rx: number; ry: number };
  },
  w: number,
  h: number
) => {
  r.tl.rx = clampRadius(r.tl.rx, w / 2);
  r.tr.rx = clampRadius(r.tr.rx, w / 2);
  r.br.rx = clampRadius(r.br.rx, w / 2);
  r.bl.rx = clampRadius(r.bl.rx, w / 2);

  r.tl.ry = clampRadius(r.tl.ry, h / 2);
  r.tr.ry = clampRadius(r.tr.ry, h / 2);
  r.br.ry = clampRadius(r.br.ry, h / 2);
  r.bl.ry = clampRadius(r.bl.ry, h / 2);

  normalizePair(r.tl, r.tr, 'rx', w);
  normalizePair(r.bl, r.br, 'rx', w);
  normalizePair(r.tl, r.bl, 'ry', h);
  normalizePair(r.tr, r.br, 'ry', h);
};

const parseRoundRadii = (value: string, w: number, h: number) => {
  const raw = (value || '').trim();
  if (!raw) {
    return {
      tl: { rx: 0, ry: 0 },
      tr: { rx: 0, ry: 0 },
      br: { rx: 0, ry: 0 },
      bl: { rx: 0, ry: 0 }
    };
  }

  const [hRaw, vRaw] = raw.split('/');
  const hTokens = hRaw.trim().split(/\s+/).filter(Boolean);
  const vTokens = (vRaw ? vRaw.trim() : hRaw.trim()).split(/\s+/).filter(Boolean);

  const hValues = toFourValues(hTokens.map(token => parseClipLength(token, w)));
  const vValues = toFourValues(vTokens.map(token => parseClipLength(token, h)));

  const radii = {
    tl: { rx: hValues[0], ry: vValues[0] },
    tr: { rx: hValues[1], ry: vValues[1] },
    br: { rx: hValues[2], ry: vValues[2] },
    bl: { rx: hValues[3], ry: vValues[3] }
  };

  clampRadii(radii, w, h);
  return radii;
};

const parseClipPathPolygon = (
  clipPath: string,
  elementBox: { w: number; h: number },
  scale: number
) => {
  const trimmed = (clipPath || '').trim();
  if (!trimmed || trimmed === 'none') return null;
  if (trimmed.indexOf('polygon(') !== 0) return null;

  const endIndex = trimmed.lastIndexOf(')');
  if (endIndex <= 8) return null;

  const inner = trimmed.slice(8, endIndex);
  const rawPoints = inner.split(',').map(p => p.trim()).filter(Boolean);
  if (rawPoints.length < 3) return null;

  const points = rawPoints
    .map(point => {
      const parts = point.split(/\s+/).filter(Boolean);
      if (parts.length < 2) return null;
      const x = parseClipLength(parts[0], elementBox.w) * scale;
      const y = parseClipLength(parts[1], elementBox.h) * scale;
      return { x, y };
    })
    .filter((p): p is { x: number; y: number } => !!p);

  if (points.length < 3) return null;
  return buildPolygonShape(points);
};

const parseClipPathInset = (
  clipPath: string,
  elementBox: { w: number; h: number },
  scale: number
) => {
  const trimmed = (clipPath || '').trim();
  if (!trimmed || trimmed === 'none') return null;
  if (trimmed.indexOf('inset(') !== 0) return null;

  const endIndex = trimmed.lastIndexOf(')');
  if (endIndex <= 6) return null;
  const inner = trimmed.slice(6, endIndex).trim();
  if (!inner) return null;

  const parts = inner.split(/\s+round\s+/i);
  const insetPart = parts[0];
  const roundPart = parts[1] || '';

  const tokens = insetPart.split(/\s+/).filter(Boolean);
  const t0 = tokens[0] || '0';
  const t1 = tokens[1] || t0;
  const t2 = tokens[2] || t0;
  const t3 = tokens[3] || t1;

  const topPx = parseClipLength(t0, elementBox.h);
  const rightPx = parseClipLength(t1, elementBox.w);
  const bottomPx = parseClipLength(t2, elementBox.h);
  const leftPx = parseClipLength(t3, elementBox.w);

  const w = Math.max(0, elementBox.w - leftPx - rightPx);
  const h = Math.max(0, elementBox.h - topPx - bottomPx);

  const radii = parseRoundRadii(roundPart, w, h);
  return buildRoundedRectShape(
    leftPx * scale,
    topPx * scale,
    w * scale,
    h * scale,
    {
      tl: { rx: radii.tl.rx * scale, ry: radii.tl.ry * scale },
      tr: { rx: radii.tr.rx * scale, ry: radii.tr.ry * scale },
      br: { rx: radii.br.rx * scale, ry: radii.br.ry * scale },
      bl: { rx: radii.bl.rx * scale, ry: radii.bl.ry * scale }
    }
  );
};

const parseClipPathCircle = (
  clipPath: string,
  elementBox: { w: number; h: number },
  scale: number
) => {
  const trimmed = (clipPath || '').trim();
  if (!trimmed || trimmed === 'none') return null;
  if (trimmed.indexOf('circle(') !== 0) return null;

  const endIndex = trimmed.lastIndexOf(')');
  if (endIndex <= 7) return null;
  const inner = trimmed.slice(7, endIndex).trim();
  if (!inner) return null;

  const parts = inner.split(/\s+at\s+/i);
  const radiusPart = parts[0] || '';
  const posPart = parts[1] || '';

  let cx = elementBox.w / 2;
  let cy = elementBox.h / 2;
  if (posPart) {
    const posTokens = posPart.split(/\s+/).filter(Boolean);
    if (posTokens.length >= 1) cx = parseClipPosition(posTokens[0], elementBox.w);
    if (posTokens.length >= 2) cy = parseClipPosition(posTokens[1], elementBox.h);
  }

  const minRef = Math.min(elementBox.w, elementBox.h);
  let radius = minRef / 2;
  let radiusMode = '';
  if (!radiusPart) {
    radiusMode = 'closest-side';
  } else if (radiusPart === 'closest-side' || radiusPart === 'farthest-side') {
    radiusMode = radiusPart;
  } else if (radiusPart.endsWith('%')) {
    const pct = parseFloat(radiusPart);
    radius = Number.isFinite(pct) ? (pct / 100) * minRef : radius;
  } else {
    const px = parseFloat(radiusPart);
    if (Number.isFinite(px)) radius = px;
  }

  if (radiusMode) {
    const dxLeft = cx;
    const dxRight = elementBox.w - cx;
    const dyTop = cy;
    const dyBottom = elementBox.h - cy;
    if (radiusMode === 'closest-side') {
      radius = Math.min(dxLeft, dxRight, dyTop, dyBottom);
    } else if (radiusMode === 'farthest-side') {
      radius = Math.max(dxLeft, dxRight, dyTop, dyBottom);
    }
  }

  return buildEllipseShape(cx * scale, cy * scale, radius * scale, radius * scale);
};

const parseClipPathEllipse = (
  clipPath: string,
  elementBox: { w: number; h: number },
  scale: number
) => {
  const trimmed = (clipPath || '').trim();
  if (!trimmed || trimmed === 'none') return null;
  if (trimmed.indexOf('ellipse(') !== 0) return null;

  const endIndex = trimmed.lastIndexOf(')');
  if (endIndex <= 8) return null;
  const inner = trimmed.slice(8, endIndex).trim();
  if (!inner) return null;

  const parts = inner.split(/\s+at\s+/i);
  const radiusPart = parts[0] || '';
  const posPart = parts[1] || '';

  const radiusTokens = radiusPart.split(/\s+/).filter(Boolean);
  if (radiusTokens.length < 2) return null;

  const rx = parseClipLength(radiusTokens[0], elementBox.w);
  const ry = parseClipLength(radiusTokens[1], elementBox.h);

  let cx = elementBox.w / 2;
  let cy = elementBox.h / 2;
  if (posPart) {
    const posTokens = posPart.split(/\s+/).filter(Boolean);
    if (posTokens.length >= 1) cx = parseClipPosition(posTokens[0], elementBox.w);
    if (posTokens.length >= 2) cy = parseClipPosition(posTokens[1], elementBox.h);
  }

  return buildEllipseShape(cx * scale, cy * scale, rx * scale, ry * scale);
};

export const isVisible = (style: CSSStyleDeclaration, rect: DOMRect): boolean => {
  if (style.display === 'none') return false;
  if (style.visibility === 'hidden') return false;
  if (parseFloat(style.opacity) === 0) return false;
  if (rect.width === 0 || rect.height === 0) return false;
  return true;
};

export const scaleBounds = (b: AEBounds, s: number): AEBounds => ({
  x: b.x * s,
  y: b.y * s,
  w: b.w * s,
  h: b.h * s
});

export const safeBgUrl = (backgroundImage: string): string | null => {
  if (!backgroundImage || backgroundImage === 'none') return null;
  const m = backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
  return m?.[2] ? m[2] : null;
};

const splitTopLevelCommas = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
};

const findGradientFunctions = (value: string) => {
  const results: { type: string; repeating: boolean; raw: string; args: string }[] = [];
  if (!value || value === 'none') return results;

  for (let i = 0; i < value.length; i += 1) {
    if (value[i] !== '(') continue;
    let nameEnd = i;
    let nameStart = nameEnd - 1;
    while (nameStart >= 0 && /[a-zA-Z-]/.test(value[nameStart])) {
      nameStart -= 1;
    }
    nameStart += 1;
    if (nameStart >= nameEnd) continue;
    const name = value.slice(nameStart, nameEnd);
    const match = name.match(/^(?:-webkit-|-moz-)?(repeating-)?(linear|radial|conic)-gradient$/i);
    if (!match) continue;

    let depth = 1;
    let j = i + 1;
    for (; j < value.length; j += 1) {
      const ch = value[j];
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      if (depth === 0) break;
    }
    if (depth !== 0) continue;

    const args = value.slice(i + 1, j).trim();
    const raw = value.slice(nameStart, j + 1);
    results.push({
      type: match[2].toLowerCase(),
      repeating: !!match[1],
      raw,
      args
    });
    i = j;
  }

  return results;
};

const extractGradientColor = (segment: string): string | null => {
  const s = segment.trim();
  if (!s) return null;
  const funcRe =
    /(rgba?\([^)]+\)|hsla?\([^)]+\)|#(?:[0-9a-fA-F]{3,8})\b|var\([^)]+\)|\btransparent\b|\bcurrentcolor\b)/i;
  const match = s.match(funcRe);
  if (match) return match[0];

  const word = s.split(/\s+/)[0];
  if (!word) return null;
  const lower = word.toLowerCase();
  if (
    [
      'to',
      'left',
      'right',
      'top',
      'bottom',
      'center',
      'circle',
      'ellipse',
      'closest-side',
      'farthest-side',
      'contain',
      'cover',
      'at',
      'from'
    ].includes(lower)
  )
    return null;
  if (/^\d/.test(lower)) return null;
  if (/(deg|rad|turn|grad)$/.test(lower)) return null;
  if (/(%|px|em|rem|vw|vh)$/.test(lower)) return null;
  return word;
};

const parseGradientStop = (segment: string) => {
  const color = extractGradientColor(segment);
  if (!color) return null;
  const rest = segment.replace(color, ' ').trim();
  if (!rest) return { color };
  const tokens = rest.split(/\s+/).filter(Boolean);
  return tokens.length ? { color, position: tokens[0] } : { color };
};

export const extractBackgroundGradients = (
  backgroundImage: string
): { type: string; repeating: boolean; raw: string; stops: { color: string; position?: string }[] }[] | null => {
  const gradients = findGradientFunctions(backgroundImage);
  if (!gradients.length) return null;

  const output = gradients.map(gradient => {
    const segments = splitTopLevelCommas(gradient.args);
    const stops = segments
      .map(segment => parseGradientStop(segment))
      .filter((stop): stop is { color: string; position?: string } => !!stop);
    return {
      type: gradient.type,
      repeating: gradient.repeating,
      raw: gradient.raw,
      stops
    };
  });

  return output.length ? output : null;
};

const splitBoxShadow = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
};

const parseShadowColor = (value: string): string | null => {
  const cleaned = value.replace(/\binset\b/gi, ' ');
  const colorRe =
    /(rgba?\([^)]+\)|hsla?\([^)]+\)|#[0-9a-fA-F]{3,8}|\btransparent\b|\bcurrentcolor\b)/i;
  const match = cleaned.match(colorRe);
  if (match) return match[0];

  const tokens = cleaned
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i -= 1) {
    const token = tokens[i];
    if (!token) continue;
    if (/[\d.-]/.test(token)) continue;
    if (/px$/i.test(token)) continue;
    if (token.toLowerCase() === 'inset') continue;
    return token;
  }

  return null;
};

export const extractBoxShadow = (
  style: CSSStyleDeclaration,
  scale: number
): AEBoxShadow[] | null => {
  const raw = (style.boxShadow || '').trim();
  if (!raw || raw === 'none') return null;

  const shadows: AEBoxShadow[] = [];
  const parts = splitBoxShadow(raw);

  for (const part of parts) {
    const inset = /\binset\b/i.test(part);
    const color = parseShadowColor(part) || 'rgba(0,0,0,1)';
    const cleaned = part
      .replace(/\binset\b/gi, ' ')
      .replace(color, ' ')
      .trim();
    const nums = cleaned.match(/-?\d*\.?\d+(?:px)?/gi) || [];
    const values = nums.map(n => parseFloat(n));

    const offsetX = (values[0] || 0) * scale;
    const offsetY = (values[1] || 0) * scale;
    const blurRadius = (values[2] || 0) * scale;
    const spreadRadius = (values[3] || 0) * scale;

    shadows.push({
      offsetX,
      offsetY,
      blurRadius,
      spreadRadius,
      color,
      inset
    });
  }

  return shadows.length ? shadows : null;
};

export const urlFromText = (text: string): string | null => {
  const t = (text || '').trim();
  if (!t) return null;
  const m = t.match(/^https?:\/\/\S+$/i);
  return m ? m[0] : null;
};

export const getName = (el: Element): string => {
  const h = el as HTMLElement;
  if (h.id) return h.id;
  if (h.classList && h.classList.length === 1) return h.classList[0];
  return el.tagName.toLowerCase();
};

export const detectPrecomp = (
  el: Element,
  style: CSSStyleDeclaration,
  elementBox: { w: number; h: number },
  scale: number
) => {
  const radius = parseBorderRadius(style.borderRadius, elementBox, scale);
  const borderRadiusPx = getClampedBorderRadius(radius, elementBox, scale);
  const clipPath =
    parseClipPathPolygon(style.clipPath, elementBox, scale) ||
    parseClipPathInset(style.clipPath, elementBox, scale) ||
    parseClipPathCircle(style.clipPath, elementBox, scale) ||
    parseClipPathEllipse(style.clipPath, elementBox, scale);
  const clips = style.overflow === 'hidden' || !!clipPath || borderRadiusPx > 0;

  return {
    needsPrecomp:
      clips ||
      style.transform !== 'none' ||
      parseFloat(style.opacity) < 1 ||
      el.children.length > 0,
    clip: {
      enabled: clips,
      borderRadius: radius,
      borderRadiusPx,
      overflow: style.overflow,
      path: clipPath
    }
  };
};

export const hasVisualPaint = (style: CSSStyleDeclaration): boolean => {
  const bgc = style.backgroundColor;
  const hasBg =
    !!bgc && bgc !== 'transparent' && bgc !== 'rgba(0, 0, 0, 0)';

  const hasBgImg = style.backgroundImage && style.backgroundImage !== 'none';

  const hasBorder =
    (parseFloat(style.borderTopWidth) || 0) > 0 ||
    (parseFloat(style.borderRightWidth) || 0) > 0 ||
    (parseFloat(style.borderBottomWidth) || 0) > 0 ||
    (parseFloat(style.borderLeftWidth) || 0) > 0;

  const hasOutline = (parseFloat(style.outlineWidth) || 0) > 0;

  const hasShadow = style.boxShadow && style.boxShadow !== 'none';

  return !!hasBg || !!hasBgImg || !!hasBorder || !!hasOutline || !!hasShadow;
};

export const isTextLike = (el: Element, style: CSSStyleDeclaration): boolean => {
  const txt = (el.textContent ?? '').trim();
  if (!txt) return false;

  const tag = el.tagName.toLowerCase();
  if (NON_TEXT_TAGS.has(tag)) return false;

  for (const child of Array.from(el.children)) {
    const ct = child.tagName.toLowerCase();
    if (NON_TEXT_TAGS.has(ct)) return false;
    if (!INLINE_TEXT_TAGS.has(ct)) return false;
  }

  return true;
};
