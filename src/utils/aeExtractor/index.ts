/**
 * AE Layout Extractor - STABLE + SHAPES (Production)
 * HTML -> Semantic JSON for After Effects
 *
 * Goals:
 * - Keep original stable text extraction (Range-based wrapping, <br> respected)
 * - Fix swatch/grid/flex cases where text was skipped
 * - Preserve shapes (background/border/clip) for containers that have both shape + text
 *
 * Rules:
 * 1) IMG/SVG -> assets
 * 2) Text-only element -> type:'text' (no shape lost because there is no shape)
 * 3) Shape+Text element -> type:'group' + add text child layer (so shapes stay)
 */

import { DEFAULT_DURATION, DEFAULT_FPS, TARGET_H, TARGET_W } from './constants';
import {
  clampFinite,
  detectPrecomp,
  getName,
  hasVisualPaint,
  isTextLike,
  isVisible,
  extractBoxShadow,
  extractBackgroundGradients,
  safeBgUrl,
  scaleBounds,
  urlFromText
} from './helpers';
import { buildTextExtra } from './text';
import { extractBorder, extractOutline } from './border';
import { AEBounds, AENode, AERenderHints, AEExportOptions, AEArtifactExport } from './types';

const isHTMLElement = (el: Element, win: Window): el is HTMLElement =>
  el instanceof (win as Window & typeof globalThis).HTMLElement;

const parseMatrixTransform = (
  value: string
): { a: number; b: number; c: number; d: number; e: number; f: number } | null => {
  if (!value) return null;
  const match = value.match(/matrix\(([^)]+)\)/i);
  if (!match || !match[1]) return null;
  const nums = match[1]
    .split(/[, ]+/)
    .map(n => parseFloat(n))
    .filter(n => Number.isFinite(n));
  if (nums.length < 6) return null;
  return { a: nums[0], b: nums[1], c: nums[2], d: nums[3], e: nums[4], f: nums[5] };
};

const isPureRotationTransform = (value: string): boolean => {
  if (!value || value === 'none') return false;
  const m = parseMatrixTransform(value);
  if (!m) return false;
  const tol = 0.001;
  if (Math.abs(m.e) > tol || Math.abs(m.f) > tol) return false;
  const scaleX = Math.hypot(m.a, m.b);
  const scaleY = Math.hypot(m.c, m.d);
  if (Math.abs(scaleX - 1) > tol || Math.abs(scaleY - 1) > tol) return false;
  const det = m.a * m.d - m.b * m.c;
  if (Math.abs(det - 1) > tol) return false;
  return true;
};

const mergeBoundsRect = (base: AEBounds, next: AEBounds): AEBounds => {
  const minX = Math.min(base.x, next.x);
  const minY = Math.min(base.y, next.y);
  const maxX = Math.max(base.x + base.w, next.x + next.w);
  const maxY = Math.max(base.y + base.h, next.y + next.h);
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY)
  };
};

const parseTransformRotation = (value: string): number | null => {
  if (!value || value === 'none') return null;
  let rotation = 0;
  const matrixMatch = value.match(/matrix\(([^)]+)\)/i);
  if (matrixMatch && matrixMatch[1]) {
    const nums = matrixMatch[1].match(/-?[\d.]+/g);
    if (nums && nums.length >= 6) {
      const a = Number(nums[0]);
      const b = Number(nums[1]);
      if (!isNaN(a) && !isNaN(b)) {
        rotation += Math.atan2(b, a) * (180 / Math.PI);
      }
    }
  }
  const rotateMatch = value.match(/rotate\(([-\d.]+)(deg|rad)?\)/i);
  if (rotateMatch) {
    const v = Number(rotateMatch[1]);
    if (!isNaN(v)) {
      const unit = rotateMatch[2] || 'deg';
      rotation += unit === 'rad' ? (v * 180) / Math.PI : v;
    }
  }
  if (!rotation) return null;
  return rotation;
};

const parseTransformOriginValue = (
  origin: string | null | undefined,
  bbox: AEBounds
): { x: number; y: number } => {
  const w = bbox.w || 0;
  const h = bbox.h || 0;
  const def = { x: w / 2, y: h / 2 };
  if (!origin) return def;
  const tokens = origin.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return def;

  const isXKeyword = (value: string) => value === 'left' || value === 'right';
  const isYKeyword = (value: string) => value === 'top' || value === 'bottom';

  const resolveToken = (value: string, axis: 'x' | 'y'): number | null => {
    const v = value.toLowerCase();
    if (v === 'center') return axis === 'x' ? w / 2 : h / 2;
    if (axis === 'x' && isXKeyword(v)) return v === 'left' ? 0 : w;
    if (axis === 'y' && isYKeyword(v)) return v === 'top' ? 0 : h;
    if (v.endsWith('%')) {
      const pct = parseFloat(v);
      if (!Number.isFinite(pct)) return null;
      const size = axis === 'x' ? w : h;
      return (pct / 100) * size;
    }
    const num = parseFloat(v);
    return Number.isFinite(num) ? num : null;
  };

  let xToken = tokens[0];
  let yToken = tokens.length > 1 ? tokens[1] : null;

  if (yToken && isYKeyword(xToken.toLowerCase()) && !isYKeyword(yToken.toLowerCase())) {
    const tmp = xToken;
    xToken = yToken;
    yToken = tmp;
  }

  if (tokens.length === 1) {
    const x = resolveToken(xToken, 'x');
    const y = resolveToken(xToken, 'y');
    if (x !== null && y !== null) return { x, y };
    if (x !== null) return { x, y: def.y };
    if (y !== null) return { x: def.x, y };
    return def;
  }

  const x = resolveToken(xToken, 'x');
  const y = yToken ? resolveToken(yToken, 'y') : null;
  return {
    x: x !== null ? x : def.x,
    y: y !== null ? y : def.y
  };
};

const getTextLinesBounds = (node: AENode): AEBounds | null => {
  if (!node || !node.textLines || !node.textLines.length) return null;
  return getTextLinesBoundsFromLines(node.textLines);
};

const getTextLinesBoundsFromLines = (lines?: AEBounds[]): AEBounds | null => {
  if (!lines || !lines.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    if (!line || !isFinite(line.w) || !isFinite(line.h)) continue;
    if (line.w <= 0 || line.h <= 0) continue;
    minX = Math.min(minX, line.x);
    minY = Math.min(minY, line.y);
    maxX = Math.max(maxX, line.x + line.w);
    maxY = Math.max(maxY, line.y + line.h);
  }
  if (minX === Infinity) return null;
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY)
  };
};

const getVisualBBox = (node: AENode): AEBounds => {
  if (!node || !node.bbox) return node.bbox;
  const transform = node.style && typeof node.style.transform === 'string' ? node.style.transform : '';
  const hasRotation = !!transform && isPureRotationTransform(transform);
  if (node.type === 'text' && !hasRotation) {
    const textBounds = getTextLinesBounds(node);
    if (textBounds) return mergeBoundsRect(node.bbox, textBounds);
  }
  if (!hasRotation) return node.bbox;
  const rotation = parseTransformRotation(transform);
  if (!rotation) return node.bbox;

  const origin = parseTransformOriginValue(
    node.style && node.style.transformOrigin ? String(node.style.transformOrigin) : '',
    node.bbox
  );
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: 0, y: 0 },
    { x: node.bbox.w, y: 0 },
    { x: node.bbox.w, y: node.bbox.h },
    { x: 0, y: node.bbox.h }
  ];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const corner of corners) {
    const dx = corner.x - origin.x;
    const dy = corner.y - origin.y;
    const rx = cos * dx - sin * dy + origin.x;
    const ry = sin * dx + cos * dy + origin.y;
    const gx = node.bbox.x + rx;
    const gy = node.bbox.y + ry;
    minX = Math.min(minX, gx);
    minY = Math.min(minY, gy);
    maxX = Math.max(maxX, gx);
    maxY = Math.max(maxY, gy);
  }

  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
    return node.bbox;
  }
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY)
  };
};

const getVideoSrc = (videoEl: HTMLVideoElement): string | null => {
  const direct = videoEl.currentSrc || videoEl.src || videoEl.getAttribute('src');
  if (direct) return direct;
  const source = videoEl.querySelector('source');
  if (!source) return null;
  return source.getAttribute('src') || (source as HTMLSourceElement).src || null;
};

const getSvgViewport = (svgEl: SVGElement): { width: number; height: number } | null => {
  const viewBox = (svgEl as SVGSVGElement).viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const widthAttr = svgEl.getAttribute('width');
  const heightAttr = svgEl.getAttribute('height');
  const width = widthAttr ? parseFloat(widthAttr) : NaN;
  const height = heightAttr ? parseFloat(heightAttr) : NaN;
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    return { width, height };
  }

  const rect = svgEl.getBoundingClientRect();
  if (rect.width > 0 && rect.height > 0) {
    return { width: rect.width, height: rect.height };
  }

  try {
    const bbox = (svgEl as SVGGraphicsElement).getBBox();
    if (bbox.width > 0 && bbox.height > 0) {
      return { width: bbox.width, height: bbox.height };
    }
  } catch {
    // Ignore getBBox failures on detached or non-rendered SVGs.
  }

  return null;
};

const sanitizePathPercentages = (d: string, width: number, height: number): string => {
  if (!/%/.test(d) || !(width > 0) || !(height > 0)) return d;

  const commandMap: Record<string, Array<'x' | 'y' | 'none'>> = {
    M: ['x', 'y'],
    L: ['x', 'y'],
    T: ['x', 'y'],
    S: ['x', 'y', 'x', 'y'],
    Q: ['x', 'y', 'x', 'y'],
    C: ['x', 'y', 'x', 'y', 'x', 'y'],
    H: ['x'],
    V: ['y'],
    A: ['x', 'y', 'none', 'none', 'none', 'x', 'y']
  };

  const tokens: string[] = [];
  const re = /([a-zA-Z])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?%?)/g;
  let match: RegExpExecArray | null;
  let cmd = '';
  let paramIndex = 0;

  while ((match = re.exec(d)) !== null) {
    if (match[1]) {
      cmd = match[1];
      paramIndex = 0;
      tokens.push(cmd);
      continue;
    }

    const raw = match[2];
    if (!raw) continue;

    let value = raw;
    if (raw.endsWith('%')) {
      const pct = parseFloat(raw);
      const pattern = commandMap[cmd.toUpperCase()] || [];
      const axis = pattern.length ? pattern[paramIndex % pattern.length] : 'none';
      const basis = axis === 'x' ? width : axis === 'y' ? height : 1;
      if (Number.isFinite(pct)) {
        value = String((pct / 100) * basis);
      } else {
        value = String(parseFloat(raw));
      }
    }

    tokens.push(value);
    paramIndex += 1;
  }

  return tokens.join(' ');
};

const inlineSvgStyles = (svgEl: SVGElement, win: Window): string => {
  const clone = svgEl.cloneNode(true) as SVGElement;
  const selector = 'circle, rect, line, path, ellipse, polygon, polyline, text';
  const originals = Array.from(svgEl.querySelectorAll(selector));
  const copies = Array.from(clone.querySelectorAll(selector));

  const viewport = getSvgViewport(svgEl);
  if (viewport) {
    const paths = Array.from(clone.querySelectorAll('path'));
    for (const path of paths) {
      const d = path.getAttribute('d');
      if (!d || d.indexOf('%') === -1) continue;
      path.setAttribute('d', sanitizePathPercentages(d, viewport.width, viewport.height));
    }
  }

  originals.forEach((original, index) => {
    const copy = copies[index];
    if (!copy) return;

    const style = win.getComputedStyle(original);

    const stroke = style.getPropertyValue('stroke') || style.stroke;
    const fill = style.getPropertyValue('fill') || style.fill;
    const strokeWidth = style.getPropertyValue('stroke-width') || (style as any).strokeWidth;
    const strokeDasharray =
      style.getPropertyValue('stroke-dasharray') || (style as any).strokeDasharray;
    const strokeDashoffset =
      style.getPropertyValue('stroke-dashoffset') || (style as any).strokeDashoffset;
    const strokeLinecap = style.getPropertyValue('stroke-linecap') || (style as any).strokeLinecap;
    const strokeLinejoin = style.getPropertyValue('stroke-linejoin') || (style as any).strokeLinejoin;
    const strokeMiterlimit =
      style.getPropertyValue('stroke-miterlimit') || (style as any).strokeMiterlimit;
    const opacity = style.getPropertyValue('opacity') || style.opacity;
    const strokeOpacity = style.getPropertyValue('stroke-opacity') || (style as any).strokeOpacity;
    const fillOpacity = style.getPropertyValue('fill-opacity') || (style as any).fillOpacity;
    const fontFamily = style.getPropertyValue('font-family') || style.fontFamily;
    const fontSize = style.getPropertyValue('font-size') || style.fontSize;
    const fontWeight = style.getPropertyValue('font-weight') || style.fontWeight;
    const fontStyle = style.getPropertyValue('font-style') || style.fontStyle;
    const letterSpacing = style.getPropertyValue('letter-spacing') || style.letterSpacing;
    const textAnchor = style.getPropertyValue('text-anchor') || (style as any).textAnchor;
    const dominantBaseline =
      style.getPropertyValue('dominant-baseline') || (style as any).dominantBaseline;

    if (stroke) copy.setAttribute('stroke', stroke);
    if (fill) copy.setAttribute('fill', fill);
    if (!copy.getAttribute('stroke-width') && strokeWidth)
      copy.setAttribute('stroke-width', strokeWidth);
    if (!copy.getAttribute('stroke-dasharray') && strokeDasharray && strokeDasharray !== 'none')
      copy.setAttribute('stroke-dasharray', strokeDasharray);
    if (!copy.getAttribute('stroke-dashoffset') && strokeDashoffset && strokeDashoffset !== '0')
      copy.setAttribute('stroke-dashoffset', strokeDashoffset);
    if (!copy.getAttribute('stroke-linecap') && strokeLinecap)
      copy.setAttribute('stroke-linecap', strokeLinecap);
    if (!copy.getAttribute('stroke-linejoin') && strokeLinejoin)
      copy.setAttribute('stroke-linejoin', strokeLinejoin);
    if (!copy.getAttribute('stroke-miterlimit') && strokeMiterlimit)
      copy.setAttribute('stroke-miterlimit', strokeMiterlimit);
    if (!copy.getAttribute('opacity') && opacity) copy.setAttribute('opacity', opacity);
    if (!copy.getAttribute('stroke-opacity') && strokeOpacity)
      copy.setAttribute('stroke-opacity', strokeOpacity);
    if (!copy.getAttribute('fill-opacity') && fillOpacity)
      copy.setAttribute('fill-opacity', fillOpacity);

    const existingFamily = copy.getAttribute('font-family');
    if (
      fontFamily &&
      (!existingFamily || /var\(/i.test(existingFamily) || existingFamily === 'inherit')
    ) {
      copy.setAttribute('font-family', fontFamily);
    }
    if (!copy.getAttribute('font-size') && fontSize) copy.setAttribute('font-size', fontSize);
    if (!copy.getAttribute('font-weight') && fontWeight)
      copy.setAttribute('font-weight', fontWeight);
    if (!copy.getAttribute('font-style') && fontStyle)
      copy.setAttribute('font-style', fontStyle);
    if (!copy.getAttribute('letter-spacing') && letterSpacing)
      copy.setAttribute('letter-spacing', letterSpacing);
    if (!copy.getAttribute('text-anchor') && textAnchor)
      copy.setAttribute('text-anchor', textAnchor);
    if (!copy.getAttribute('dominant-baseline') && dominantBaseline)
      copy.setAttribute('dominant-baseline', dominantBaseline);
  });

  return clone.outerHTML;
};

const normalizeTransformOrigin = (
  origin: string | null | undefined,
  rawBox: AEBounds,
  scaledBox: AEBounds
): string => {
  if (!origin) return '';
  const tokens = origin.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return '';

  const rawW = rawBox.w || 0;
  const rawH = rawBox.h || 0;
  const scaledW = scaledBox.w || 0;
  const scaledH = scaledBox.h || 0;

  const isYKeyword = (value: string) => value === 'top' || value === 'bottom';
  const isXKeyword = (value: string) => value === 'left' || value === 'right';

  const resolveToken = (value: string, axis: 'x' | 'y'): number | null => {
    const v = value.toLowerCase();
    if (v === 'center') return axis === 'x' ? scaledW / 2 : scaledH / 2;
    if (axis === 'x' && isXKeyword(v)) return v === 'left' ? 0 : scaledW;
    if (axis === 'y' && isYKeyword(v)) return v === 'top' ? 0 : scaledH;
    if (v.endsWith('%')) {
      const pct = parseFloat(v);
      if (!Number.isFinite(pct)) return null;
      const size = axis === 'x' ? scaledW : scaledH;
      return (pct / 100) * size;
    }

    const num = parseFloat(v);
    if (!Number.isFinite(num)) return null;
    const rawSize = axis === 'x' ? rawW : rawH;
    const scaledSize = axis === 'x' ? scaledW : scaledH;
    if (rawSize > 0) {
      return (num / rawSize) * scaledSize;
    }
    return num;
  };

  let xToken = tokens[0];
  let yToken = tokens.length > 1 ? tokens[1] : null;

  if (yToken && isYKeyword(xToken.toLowerCase()) && !isYKeyword(yToken.toLowerCase())) {
    const tmp = xToken;
    xToken = yToken;
    yToken = tmp;
  }

  if (tokens.length === 1) {
    const x = resolveToken(xToken, 'x');
    const y = resolveToken(xToken, 'y');
    if (x !== null && y !== null) return `${x}px ${y}px`;
    if (x !== null) return `${x}px ${scaledH / 2}px`;
    if (y !== null) return `${scaledW / 2}px ${y}px`;
    return `${scaledW / 2}px ${scaledH / 2}px`;
  }

  const x = resolveToken(xToken, 'x');
  const y = yToken ? resolveToken(yToken, 'y') : null;
  const finalX = x !== null ? x : scaledW / 2;
  const finalY = y !== null ? y : scaledH / 2;
  return `${finalX}px ${finalY}px`;
};

const parsePseudoContent = (content: string): string | null => {
  const raw = (content || '').trim();
  if (!raw || raw === 'none' || raw === 'normal') return null;
  if (/^attr\(/i.test(raw)) return null;
  if (/^url\(/i.test(raw)) return null;
  if (raw === '""' || raw === "''") return '';

  const unquoted = raw.replace(/^['"]|['"]$/g, '');
  return unquoted
    .replace(/\\00000a/gi, '\n')
    .replace(/\\a/gi, '\n')
    .replace(/\\A/g, '\n');
};

const parsePseudoLength = (value: string, reference: number): number | null => {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === 'auto' || trimmed === 'none') return null;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? (pct / 100) * reference : null;
  }
  const px = parseFloat(trimmed);
  return Number.isFinite(px) ? px : null;
};

const resolvePseudoBox = (
  win: Window,
  pseudoStyle: CSSStyleDeclaration,
  hostRect: DOMRect,
  rootRect: DOMRect
): { x: number; y: number; w: number; h: number } => {
  const pos = pseudoStyle.position;
  const baseW = pos === 'fixed' ? win.innerWidth : hostRect.width;
  const baseH = pos === 'fixed' ? win.innerHeight : hostRect.height;
  const baseX = pos === 'fixed' ? -rootRect.left : hostRect.left - rootRect.left;
  const baseY = pos === 'fixed' ? -rootRect.top : hostRect.top - rootRect.top;

  const left = parsePseudoLength(pseudoStyle.left, baseW);
  const right = parsePseudoLength(pseudoStyle.right, baseW);
  const top = parsePseudoLength(pseudoStyle.top, baseH);
  const bottom = parsePseudoLength(pseudoStyle.bottom, baseH);

  let w = parsePseudoLength(pseudoStyle.width, baseW) ?? 0;
  let h = parsePseudoLength(pseudoStyle.height, baseH) ?? 0;

  if (w <= 0 && left !== null && right !== null) w = Math.max(0, baseW - left - right);
  if (h <= 0 && top !== null && bottom !== null) h = Math.max(0, baseH - top - bottom);

  let x = baseX + (left !== null ? left : 0);
  let y = baseY + (top !== null ? top : 0);

  if (left === null && right !== null && w > 0) x = baseX + baseW - right - w;
  if (top === null && bottom !== null && h > 0) y = baseY + baseH - bottom - h;

  return { x, y, w, h };
};

const createPseudoTextElement = (
  doc: Document,
  content: string,
  pseudoStyle: CSSStyleDeclaration,
  rootRect: DOMRect,
  rawBox: { x: number; y: number; w: number; h: number }
) => {
  const el = doc.createElement('span');
  el.textContent = content;

  const s = el.style;
  s.position = 'fixed';
  s.left = `${rootRect.left + rawBox.x}px`;
  s.top = `${rootRect.top + rawBox.y}px`;
  s.display = pseudoStyle.display === 'none' ? 'inline-block' : pseudoStyle.display;
  s.whiteSpace = pseudoStyle.whiteSpace;
  s.fontFamily = pseudoStyle.fontFamily;
  s.fontSize = pseudoStyle.fontSize;
  s.fontWeight = pseudoStyle.fontWeight;
  s.fontStyle = pseudoStyle.fontStyle;
  s.letterSpacing = pseudoStyle.letterSpacing;
  s.lineHeight = pseudoStyle.lineHeight;
  s.textAlign = pseudoStyle.textAlign;
  s.textTransform = pseudoStyle.textTransform as string;
  s.color = pseudoStyle.color;
  s.boxSizing = pseudoStyle.boxSizing;
  s.padding = pseudoStyle.padding;
  s.margin = '0';
  if (rawBox.w > 0) s.width = `${rawBox.w}px`;
  if (rawBox.h > 0) s.height = `${rawBox.h}px`;
  s.visibility = 'hidden';
  s.pointerEvents = 'none';
  s.zIndex = '-9999';

  doc.body.appendChild(el);
  return () => {
    if (el.parentNode) el.parentNode.removeChild(el);
  };
};

const extractFontData = (
  doc: Document,
  win: Window
): { urls: string[]; postNames: Array<{ name: string; styles: string[] }> } => {
  const urls = new Set<string>();
  const postNameMap = new Map<string, Set<string>>();

  const addUrl = (value: string | null) => {
    if (!value) return;
    const cleaned = value.trim();
    if (!cleaned || cleaned.startsWith('data:')) return;
    urls.add(cleaned);
  };

  const normalizeFamily = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const cleaned = value.replace(/['"]/g, '').trim();
    if (!cleaned) return null;
    return cleaned.split(',')[0].trim();
  };

  const parseWeight = (value: string | number | null | undefined): number => {
    if (typeof value === 'number' && isFinite(value)) return value;
    if (!value) return 400;
    const raw = String(value).trim().toLowerCase();
    if (raw === 'normal') return 400;
    if (raw === 'bold' || raw === 'bolder') return 700;
    const num = parseInt(raw.split(/\s+/)[0], 10);
    return isFinite(num) ? num : 400;
  };

  const weightToName = (w: number): string => {
    if (w >= 900) return 'Black';
    if (w >= 800) return 'ExtraBold';
    if (w >= 700) return 'Bold';
    if (w >= 600) return 'SemiBold';
    if (w >= 500) return 'Medium';
    return 'Regular';
  };

  const toPostScriptInfo = (
    family: string | null | undefined,
    weight: string | number | null | undefined,
    style: string | null | undefined
  ): { name: string; style: string } | null => {
    const base = normalizeFamily(family);
    if (!base) return null;
    const baseNoSpaces = base.replace(/\s+/g, '');
    const isItalic = !!style && /italic|oblique/i.test(style);
    const weightName = weightToName(parseWeight(weight));
    const suffix = isItalic ? (weightName === 'Regular' ? 'Italic' : weightName + 'Italic') : weightName;
    return { name: baseNoSpaces, style: suffix };
  };

  const addPostName = (
    family: string | null | undefined,
    weight: string | number | null | undefined,
    style: string | null | undefined
  ) => {
    const post = toPostScriptInfo(family, weight, style);
    if (!post) return;
    if (!postNameMap.has(post.name)) postNameMap.set(post.name, new Set<string>());
    postNameMap.get(post.name)!.add(post.style);
  };

  const linkEls = Array.from(doc.querySelectorAll('link[rel~="stylesheet"]'));
  linkEls.forEach(link => {
    const href = link.getAttribute('href') || (link as HTMLLinkElement).href;
    addUrl(href);
  });

  const styleEls = Array.from(doc.querySelectorAll('style'));
  const importRe = /@import\s+url\((['"]?)([^'")]+)\1\)/gi;
  const fontFaceRe = /@font-face[\s\S]*?}/gi;
  const urlRe = /url\((['"]?)([^'")]+)\1\)/gi;
  const familyRe = /font-family\s*:\s*([^;]+);?/i;
  const weightRe = /font-weight\s*:\s*([^;]+);?/i;
  const styleRe = /font-style\s*:\s*([^;]+);?/i;

  styleEls.forEach(styleEl => {
    const css = styleEl.textContent || '';

    let match: RegExpExecArray | null;
    while ((match = importRe.exec(css)) !== null) {
      addUrl(match[2]);
    }

    const fontFaceBlocks = css.match(fontFaceRe) || [];
    fontFaceBlocks.forEach(block => {
      while ((match = urlRe.exec(block)) !== null) {
        addUrl(match[2]);
      }
      const familyMatch = familyRe.exec(block);
      const weightMatch = weightRe.exec(block);
      const styleMatch = styleRe.exec(block);
      addPostName(
        familyMatch ? familyMatch[1] : null,
        weightMatch ? weightMatch[1] : null,
        styleMatch ? styleMatch[1] : null
      );
    });
  });

  const fontSet = Array.from(win.document.fonts as unknown as Iterable<FontFace>);
  fontSet.forEach((font: FontFace) => {
    addPostName(font.family, font.weight, font.style);
  });

  // Fallback: collect used fonts from computed styles (helps when FontFaceSet is empty).
  const root = doc.body || doc.documentElement;
  if (root) {
    const els = Array.from(root.querySelectorAll('*'));
    els.forEach(el => {
      if (!isHTMLElement(el, win)) return;
      const text = (el.textContent || '').trim();
      if (!text) return;
      const style = win.getComputedStyle(el);
      addPostName(style.fontFamily, style.fontWeight, style.fontStyle);
    });
  }

  const postNames = Array.from(postNameMap.entries()).map(([name, styles]) => ({
    name,
    styles: Array.from(styles)
  }));

  return { urls: Array.from(urls), postNames };
};

const resolveExportSize = (value: number | undefined, fallback: number) => {
  const v = clampFinite(value ?? 0);
  return v > 0 ? v : fallback;
};

const resolveExportValue = (value: number | undefined, fallback: number) => {
  const v = clampFinite(value ?? 0);
  return v > 0 ? v : fallback;
};

export const extractSlideLayout = async (
  slide: HTMLElement,
  win: Window,
  options: AEExportOptions = {}
): Promise<AEArtifactExport> => {
  await win.document.fonts.ready;

  const rootRect = slide.getBoundingClientRect();
  const docEl = win.document.documentElement;
  const viewportW = clampFinite(docEl.clientWidth || win.innerWidth);
  const viewportH = clampFinite(docEl.clientHeight || win.innerHeight);
  const baseSourceW = clampFinite(rootRect.width);
  const baseSourceH = clampFinite(rootRect.height);

  const targetW = resolveExportSize(options.targetWidth, TARGET_W);
  const targetH = resolveExportSize(options.targetHeight, TARGET_H);
  const fps = resolveExportValue(options.fps, DEFAULT_FPS);
  const duration = resolveExportValue(options.duration, DEFAULT_DURATION);

  const useViewportScale =
    options.useViewportScale === true ||
    (viewportW > 0 &&
      viewportH > 0 &&
      (baseSourceW < viewportW * 0.98 || baseSourceH < viewportH * 0.98));
  const sourceW = useViewportScale ? viewportW : baseSourceW;
  const sourceH = useViewportScale ? viewportH : baseSourceH;

  const scaleX = sourceW > 0 ? targetW / sourceW : 1;
  const scaleY = sourceH > 0 ? targetH / sourceH : 1;
  const scale = clampFinite(Math.min(scaleX, scaleY)) || 1;

  const coordRootRect =
    useViewportScale && viewportW > 0 && viewportH > 0
      ? new DOMRect(0, 0, viewportW, viewportH)
      : rootRect;


  const process = (el: Element): AENode | null => {
    const style = win.getComputedStyle(el);
    const computedTransformOrigin = style.transformOrigin;
    let transformValue = style.transform;
    const isHtmlEl = isHTMLElement(el, win);
    const overrideOrigin = isHtmlEl ? (el as HTMLElement).getAttribute('data-ae2-origin') : null;
    const inlineOrigin = isHtmlEl ? (el as HTMLElement).style.transformOrigin : '';
    const editorBaseTransform = isHtmlEl
      ? (el as HTMLElement).getAttribute('data-ae2-base-transform')
      : null;
    const editorTxRaw = isHtmlEl ? (el as HTMLElement).getAttribute('data-ae2-tx') : null;
    const editorTyRaw = isHtmlEl ? (el as HTMLElement).getAttribute('data-ae2-ty') : null;
    const editorRotRaw = isHtmlEl ? (el as HTMLElement).getAttribute('data-ae2-rot') : null;
    const editorSxRaw = isHtmlEl ? (el as HTMLElement).getAttribute('data-ae2-sx') : null;
    const editorSyRaw = isHtmlEl ? (el as HTMLElement).getAttribute('data-ae2-sy') : null;
    const hasEditorTransform =
      isHtmlEl &&
      (editorBaseTransform !== null ||
        editorTxRaw !== null ||
        editorTyRaw !== null ||
        editorRotRaw !== null ||
        editorSxRaw !== null ||
        editorSyRaw !== null);

    const parseEditorNumber = (value: string | null, fallback = 0): number => {
      if (value === null || value === undefined || value === '') return fallback;
      const num = parseFloat(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const editorTx = hasEditorTransform ? parseEditorNumber(editorTxRaw, 0) : 0;
    const editorTy = hasEditorTransform ? parseEditorNumber(editorTyRaw, 0) : 0;
    const editorRot = hasEditorTransform ? parseEditorNumber(editorRotRaw, 0) : 0;
    const editorSx = hasEditorTransform ? parseEditorNumber(editorSxRaw, 1) : 1;
    const editorSy = hasEditorTransform ? parseEditorNumber(editorSyRaw, 1) : 1;

    if (hasEditorTransform) {
      const base = editorBaseTransform && editorBaseTransform !== 'none' ? editorBaseTransform : '';
      const parts: string[] = [];
      const translate =
        Math.abs(editorTx) > 0.0001 || Math.abs(editorTy) > 0.0001
          ? `translate(${editorTx}px, ${editorTy}px)`
          : '';
      const rotate = Math.abs(editorRot) > 0.0001 ? `rotate(${editorRot}deg)` : '';
      const scale =
        Math.abs(editorSx - 1) > 0.0001 || Math.abs(editorSy - 1) > 0.0001
          ? `scale(${editorSx}, ${editorSy})`
          : '';

      if (base) parts.push(base);
      if (base && base.indexOf('matrix') === 0) {
        if (translate) parts.unshift(translate);
      } else if (translate) {
        parts.push(translate);
      }
      if (rotate) parts.push(rotate);
      if (scale) parts.push(scale);
      transformValue = parts.length ? parts.join(' ') : 'none';
    }

    const shouldNeutralizeTransform =
      isHtmlEl && (isPureRotationTransform(transformValue) || hasEditorTransform);
    let restoreTransform: (() => void) | null = null;

    if (shouldNeutralizeTransform) {
      const htmlEl = el as HTMLElement;
      const prevTransform = htmlEl.style.transform;
      const prevTransformOrigin = htmlEl.style.transformOrigin;
      htmlEl.style.transform = 'none';
      htmlEl.style.transformOrigin = '0 0';
      restoreTransform = () => {
        htmlEl.style.transform = prevTransform;
        htmlEl.style.transformOrigin = prevTransformOrigin;
      };
    }

    const finalize = <T,>(value: T): T => {
      if (restoreTransform) restoreTransform();
      return value;
    };

    const rect = el.getBoundingClientRect();
    if (!isVisible(style, rect)) return finalize(null);

    const rawBBox: AEBounds = {
      x: rect.left - coordRootRect.left,
      y: rect.top - coordRootRect.top,
      w: rect.width,
      h: rect.height
    };
    let bbox = scaleBounds(rawBBox, scale);
    const originSource =
      overrideOrigin ||
      inlineOrigin ||
      (shouldNeutralizeTransform ? computedTransformOrigin : style.transformOrigin);
    let transformOriginValue = normalizeTransformOrigin(originSource, rawBBox, bbox);

    const renderHints: AERenderHints = {
      needsPrecomp: false,
      isMask: false,
      isText: false,
      isAsset: false,
      isHidden: false
    };

    let type: AENode['type'] = 'group';
    let extra: Partial<AENode> = {};

    if (el.tagName.toLowerCase() === 'svg') {
      type = 'svg';
      renderHints.isAsset = true;
      extra = {
        assetType: 'svg-code',
        content: inlineSvgStyles(el as SVGElement, win)
      };
    } else if (el.tagName.toLowerCase() === 'img') {
      type = 'image';
      renderHints.isAsset = true;
      extra = { src: (el as HTMLImageElement).src, assetType: 'url' };
    } else if (el.tagName.toLowerCase() === 'video') {
      type = 'video';
      renderHints.isAsset = true;
      extra = { src: getVideoSrc(el as HTMLVideoElement) || '', assetType: 'url' };
    }

    const styleForDetect = {
      borderRadius: style.borderRadius,
      clipPath: style.clipPath,
      overflow: style.overflow,
      transform: transformValue,
      opacity: style.opacity
    } as CSSStyleDeclaration;

    const { needsPrecomp, clip } = detectPrecomp(el, styleForDetect, rawBBox, scale);
    if (needsPrecomp) renderHints.needsPrecomp = true;

    const border = extractBorder(style, scale, rawBBox);
    const outline = extractOutline(style, scale, rawBBox);
    const boxShadow = extractBoxShadow(style, scale);

    let skipChildTraversal = false;
    let handledTextUrl = false;
    const children: AENode[] = [];

    const bgUrl = safeBgUrl(style.backgroundImage);
    if (bgUrl) {
      children.push({
        type: 'image',
        name: 'Background Image',
        bbox: { ...bbox },
        bboxSpace: 'global',
        style: {},
        renderHints: {
          needsPrecomp: false,
          isAsset: true,
          isText: false,
          isMask: false,
          isHidden: false
        },
        src: bgUrl,
        assetType: 'url',
        border: null,
        outline: null,
        clip: {
          enabled: false,
          borderRadius: {
            topLeft: { x: 0, y: 0 },
            topRight: { x: 0, y: 0 },
            bottomRight: { x: 0, y: 0 },
            bottomLeft: { x: 0, y: 0 }
          },
          borderRadiusPx: 0,
          overflow: 'visible'
        }
      });
    }

    const buildPseudoNode = (which: '::before' | '::after'): AENode | null => {
      const pseudoStyle = win.getComputedStyle(el, which as any);
      const contentText = parsePseudoContent(pseudoStyle.content);
      const hasPaint = hasVisualPaint(pseudoStyle) || !!safeBgUrl(pseudoStyle.backgroundImage);

      if (!contentText && !hasPaint) return null;
      if (!isVisible(pseudoStyle, rect)) return null;

      let rawBox = resolvePseudoBox(win, pseudoStyle, rect, coordRootRect);

      if ((rawBox.w <= 0 || rawBox.h <= 0) && contentText) {
        const cleanup = createPseudoTextElement(
          win.document,
          contentText,
          pseudoStyle,
          coordRootRect,
          rawBox
        );
        try {
          const measureEl = win.document.body.lastElementChild as HTMLElement;
          const m = measureEl.getBoundingClientRect();
          if (rawBox.w <= 0) rawBox.w = m.width;
          if (rawBox.h <= 0) rawBox.h = m.height;
        } finally {
          cleanup();
        }
      }

      const pseudoBBox = scaleBounds(rawBox, scale);
      const pseudoBorder = extractBorder(pseudoStyle, scale, rawBox);
      const pseudoOutline = extractOutline(pseudoStyle, scale, rawBox);
      const pseudoShadow = extractBoxShadow(pseudoStyle, scale);

      const { clip } = detectPrecomp(el, pseudoStyle, rawBox, scale);
      const zFallback = which === '::before' ? -1 : 1;
      const zValue = Number.isFinite(parseFloat(pseudoStyle.zIndex))
        ? parseFloat(pseudoStyle.zIndex)
        : zFallback;

      const baseNode: Omit<AENode, 'type'> = {
        name: `${getName(el)}${which}`,
        bbox: pseudoBBox,
        bboxSpace: 'global',
        style: {
          backgroundColor: pseudoStyle.backgroundColor,
          backgroundGradients: extractBackgroundGradients(pseudoStyle.backgroundImage) || undefined,
          opacity: pseudoStyle.opacity,
          transform: pseudoStyle.transform,
          transformOrigin: normalizeTransformOrigin(pseudoStyle.transformOrigin, rawBox, pseudoBBox),
          zIndex: zValue,
          boxShadow: pseudoShadow || undefined
        },
        renderHints: {
          needsPrecomp:
            clip.enabled || pseudoStyle.transform !== 'none' || parseFloat(pseudoStyle.opacity) < 1,
          isMask: false,
          isText: false,
          isAsset: false,
          isHidden: false,
          semanticZ: which === '::before' ? 'background' : 'overlay'
        },
        border: pseudoBorder,
        outline: pseudoOutline,
        clip
      };

      const bgUrl = safeBgUrl(pseudoStyle.backgroundImage);
      const pseudoChildren: AENode[] = [];
      if (bgUrl) {
        pseudoChildren.push({
          type: 'image',
          name: `${getName(el)}${which}__bg`,
          bbox: { ...pseudoBBox },
          bboxSpace: 'global',
          style: {},
          renderHints: {
            needsPrecomp: false,
            isAsset: true,
            isText: false,
            isMask: false,
            isHidden: false
          },
          src: bgUrl,
          assetType: 'url',
          border: null,
          outline: null,
          clip: {
            enabled: false,
            borderRadius: {
              topLeft: { x: 0, y: 0 },
              topRight: { x: 0, y: 0 },
              bottomRight: { x: 0, y: 0 },
              bottomLeft: { x: 0, y: 0 }
            },
            borderRadiusPx: 0,
            overflow: 'visible'
          }
        });
      }

      if (contentText) {
        const cleanup = createPseudoTextElement(win.document, contentText, pseudoStyle, rootRect, rawBox);
        let textExtra: ReturnType<typeof buildTextExtra> | null = null;
        try {
          const textEl = win.document.body.lastElementChild as HTMLElement;
          textExtra = buildTextExtra(
            win,
            textEl,
            win.getComputedStyle(textEl),
            coordRootRect,
            scale,
            pseudoBBox
          );
        } finally {
          cleanup();
        }

        if (textExtra) {
          if (hasPaint) {
            pseudoChildren.push({
              type: 'text',
              name: `${getName(el)}${which}__text`,
              bbox: { ...pseudoBBox },
              bboxSpace: 'global',
              style: {},
              renderHints: {
                needsPrecomp: false,
                isMask: false,
                isText: true,
                isAsset: false,
                isHidden: false
              },
              ...textExtra,
              border: null,
              outline: null,
              clip: {
                enabled: false,
                borderRadius: {
                  topLeft: { x: 0, y: 0 },
                  topRight: { x: 0, y: 0 },
                  bottomRight: { x: 0, y: 0 },
                  bottomLeft: { x: 0, y: 0 }
                },
                borderRadiusPx: 0,
                overflow: 'visible'
              }
            });
          } else {
            const textNode: AENode = {
              type: 'text',
              ...baseNode,
              renderHints: { ...baseNode.renderHints, isText: true },
              ...textExtra
            };
            return textNode;
          }
        }
      }

      const groupNode: AENode = {
        type: 'group',
        ...baseNode,
        children: pseudoChildren.length ? pseudoChildren : undefined
      };
      return groupNode;
    };

    const beforeNode = isHtmlEl ? buildPseudoNode('::before') : null;
    const afterNode = isHtmlEl ? buildPseudoNode('::after') : null;
    let beforeAdded = false;
    let afterAdded = false;

    const pushBefore = () => {
      if (beforeNode && !beforeAdded) {
        children.push(beforeNode);
        beforeAdded = true;
      }
    };
    const pushAfter = () => {
      if (afterNode && !afterAdded) {
        children.push(afterNode);
        afterAdded = true;
      }
    };

    if (!bgUrl && isHtmlEl && el.children.length === 0) {
      const textUrl = urlFromText(el.textContent || '');
      if (textUrl && type === 'group') {
        const paints = hasVisualPaint(style);
        if (!paints) {
          type = 'image';
          renderHints.isAsset = true;
          extra = { ...extra, src: textUrl, assetType: 'url' };
          skipChildTraversal = true;
          handledTextUrl = true;
        } else {
          children.push({
            type: 'image',
            name: 'Image',
            bbox: { ...bbox },
            bboxSpace: 'global',
            style: {},
            renderHints: {
              needsPrecomp: false,
              isAsset: true,
              isText: false,
              isMask: false,
              isHidden: false
            },
            src: textUrl,
            assetType: 'url',
            border: null,
            outline: null,
            clip: {
              enabled: false,
              borderRadius: {
                topLeft: { x: 0, y: 0 },
                topRight: { x: 0, y: 0 },
                bottomRight: { x: 0, y: 0 },
                bottomLeft: { x: 0, y: 0 }
              },
              borderRadiusPx: 0,
              overflow: 'visible'
            }
          });
          skipChildTraversal = true;
          handledTextUrl = true;
        }
      }
    }

    const canConsiderText =
      type !== 'svg' && type !== 'image' && type !== 'video' && !handledTextUrl && isHtmlEl;
    const hasPaintedChild =
      canConsiderText &&
      el.children.length > 0 &&
      Array.from(el.children).some(child => hasVisualPaint(win.getComputedStyle(child)));
    const textChildElements = canConsiderText
      ? Array.from(el.children).filter(child => {
          if (!isHTMLElement(child, win)) return false;
          const childText = (child.textContent || '').trim();
          return !!childText;
        })
      : [];
    const hasMultipleTextChildren = textChildElements.length > 1;
    const textLike =
      canConsiderText && isTextLike(el, style) && !hasPaintedChild && !hasMultipleTextChildren;

    const getDirectTextNodes = (host: HTMLElement): Text[] => {
      const out: Text[] = [];
      for (const node of Array.from(host.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const content = node.textContent || '';
        if (!content.trim()) continue;
        out.push(node as Text);
      }
      return out;
    };

    const hasPseudo = !!beforeNode || !!afterNode;
    if (textLike && isHtmlEl) {
      const pickInlineTextStyle = (
        host: HTMLElement,
        hostStyle: CSSStyleDeclaration
      ): CSSStyleDeclaration => {
        if (!host.children || host.children.length === 0) return hostStyle;
        for (const child of Array.from(host.children)) {
          if (!isHTMLElement(child, win)) continue;
          if (!child.textContent || !child.textContent.trim()) continue;
          return win.getComputedStyle(child);
        }
        return hostStyle;
      };
      const paints = hasVisualPaint(style);
      const textStyle = pickInlineTextStyle(el, style);
      const textTransformValue =
        textStyle && textStyle.transform && textStyle.transform !== 'none'
          ? textStyle.transform
          : '';
      const textTransformOrigin = normalizeTransformOrigin(
        textStyle && textStyle.transformOrigin ? textStyle.transformOrigin : '',
        rawBBox,
        bbox
      );

      if (!paints && !hasPseudo) {
        type = 'text';
        renderHints.isText = true;
        if (textTransformValue) {
          transformValue = textTransformValue;
          if (textTransformOrigin) transformOriginValue = textTransformOrigin;
        }

        extra = {
          ...extra,
          ...buildTextExtra(win, el, textStyle, coordRootRect, scale, bbox)
        };
      } else {
        const textChildTransform = textTransformValue;
        pushBefore();
        children.push({
          type: 'text',
          name: `${getName(el)}__text`,
          bbox: { ...bbox },
          bboxSpace: 'global',
          style: textChildTransform
            ? {
                transform: textChildTransform,
                transformOrigin: textTransformOrigin || undefined
              }
            : {},
          renderHints: {
            needsPrecomp: false,
            isMask: false,
            isText: true,
            isAsset: false,
            isHidden: false
          },
          ...buildTextExtra(win, el, textStyle, coordRootRect, scale, bbox),
          border: null,
          outline: null,
          clip: {
            enabled: false,
            borderRadius: {
              topLeft: { x: 0, y: 0 },
              topRight: { x: 0, y: 0 },
              bottomRight: { x: 0, y: 0 },
              bottomLeft: { x: 0, y: 0 }
            },
            borderRadiusPx: 0,
            overflow: 'visible'
          }
        });
        pushAfter();
        skipChildTraversal = true;
      }
    }

    if (canConsiderText && isHtmlEl && !textLike) {
      const directTextNodes = getDirectTextNodes(el);
      if (directTextNodes.length) {
        pushBefore();
        children.push({
          type: 'text',
          name: `${getName(el)}__text`,
          bbox: { ...bbox },
          bboxSpace: 'global',
          style: {},
          renderHints: {
            needsPrecomp: false,
            isMask: false,
            isText: true,
            isAsset: false,
            isHidden: false
          },
          ...buildTextExtra(win, el, style, coordRootRect, scale, bbox, directTextNodes),
          border: null,
          outline: null,
          clip: {
            enabled: false,
            borderRadius: {
              topLeft: { x: 0, y: 0 },
              topRight: { x: 0, y: 0 },
              bottomRight: { x: 0, y: 0 },
              bottomLeft: { x: 0, y: 0 }
            },
            borderRadiusPx: 0,
            overflow: 'visible'
          }
        });
        pushAfter();
      }
    }

    if (type !== 'svg' && type !== 'text' && !skipChildTraversal) {
      pushBefore();
      for (const c of Array.from(el.children)) {
        const child = process(c);
        if (child) children.push(child);
      }
      pushAfter();
    }

    const shouldExpandGroupBounds =
      type === 'group' && children.length > 0 && !clip?.enabled && el !== slide;
    const hasPaint = type === 'group' && hasVisualPaint(style);
    const hasDecorations = hasPaint || !!border || !!outline;
    let finalBBox = bbox;
    if (shouldExpandGroupBounds) {
      let childBounds: AEBounds | null = null;
      for (const child of children) {
        const b = getVisualBBox(child);
        childBounds = childBounds ? mergeBoundsRect(childBounds, b) : { ...b };
      }
      if (childBounds) {
        finalBBox = hasDecorations ? mergeBoundsRect({ ...bbox }, childBounds) : childBounds;
      }
    }

    return finalize({
      type,
      name: getName(el),
      bbox: finalBBox,
      bboxSpace: 'global',
      style: {
        backgroundColor: style.backgroundColor,
        backgroundGradients: extractBackgroundGradients(style.backgroundImage) || undefined,
        opacity: style.opacity,
        transform: transformValue,
        transformOrigin: transformOriginValue,
        zIndex: style.zIndex,
        boxShadow: boxShadow || undefined
      },
      renderHints,
      children: children.length ? children : undefined,
      clip,
      border,
      outline,
      ...extra
    });
  };

  const root = process(slide);
  if (!root) throw new Error('extractSlideLayout: slide root is not visible or has zero size.');

  return {
    artifactId: slide.id,
    fonts: extractFontData(win.document, win),
    settings: {
      fps,
      duration,
      resolution: {
        width: targetW,
        height: targetH,
        label: options.resolutionLabel
      }
    },
    viewport: {
      width: targetW,
      height: targetH,
      sourceWidth: sourceW,
      sourceHeight: sourceH,
      scale
    },
    root
  };
};
