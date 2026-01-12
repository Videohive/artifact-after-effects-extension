import { INLINE_TEXT_TAGS, NON_TEXT_TAGS } from './constants';
import { getClampedBorderRadius, parseBorderRadius } from './border';
import { AEBounds, AEBoxShadow, AEClipPath } from './types';

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

const buildPointShape = (points: { x: number; y: number }[], closed: boolean) => {
  const vertices = points.map(p => ({ x: p.x, y: p.y }));
  const inTangents = points.map(() => ({ x: 0, y: 0 }));
  const outTangents = points.map(() => ({ x: 0, y: 0 }));
  return { vertices, inTangents, outTangents, closed };
};

const buildPolygonShape = (points: { x: number; y: number }[]) =>
  buildPointShape(points, true);

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

const parseSvgLength = (
  value: string | null,
  reference: number
): { value: number; isPercent: boolean } | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct)
      ? { value: (pct / 100) * reference, isPercent: true }
      : null;
  }
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? { value: num, isPercent: false } : null;
};

const parseSvgPointValue = (
  token: string,
  reference: number,
  units: 'objectBoundingBox' | 'userSpaceOnUse'
): number | null => {
  const trimmed = token.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    if (!Number.isFinite(pct)) return null;
    return units === 'objectBoundingBox' ? pct / 100 : (pct / 100) * reference;
  }
  const num = parseFloat(trimmed);
  return Number.isFinite(num) ? num : null;
};

const parseSvgPoints = (
  value: string,
  elementBox: { w: number; h: number },
  units: 'objectBoundingBox' | 'userSpaceOnUse',
  userSpaceBox: { w: number; h: number }
): { x: number; y: number }[] => {
  if (!value) return [];
  const parts = value.trim().split(/[\s,]+/).filter(Boolean);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < parts.length - 1; i += 2) {
    const refW = units === 'userSpaceOnUse' ? userSpaceBox.w : elementBox.w;
    const refH = units === 'userSpaceOnUse' ? userSpaceBox.h : elementBox.h;
    const x = parseSvgPointValue(parts[i], refW, units);
    const y = parseSvgPointValue(parts[i + 1], refH, units);
    if (x === null || y === null) continue;
    points.push({ x, y });
  }
  return points;
};

const mapClipValue = (
  value: string | null,
  reference: number,
  units: 'objectBoundingBox' | 'userSpaceOnUse',
  scale: number,
  userReference: number,
  userScale: number
): number | null => {
  const ref = units === 'userSpaceOnUse' ? userReference : reference;
  const raw = parseSvgLength(value, ref);
  if (!raw) return null;
  let base = raw.value;
  if (units === 'objectBoundingBox' && !raw.isPercent) {
    base = raw.value * reference;
  }
  const scaleFactor = units === 'userSpaceOnUse' ? userScale : scale;
  return base * scaleFactor;
};

const mapClipPoint = (
  point: { x: number; y: number },
  elementBox: { w: number; h: number },
  units: 'objectBoundingBox' | 'userSpaceOnUse',
  scale: number,
  userScale: { x: number; y: number }
) => {
  if (units === 'objectBoundingBox') {
    return { x: point.x * elementBox.w * scale, y: point.y * elementBox.h * scale };
  }
  return { x: point.x * userScale.x, y: point.y * userScale.y };
};

const sampleSvgPath = (
  pathEl: SVGPathElement,
  elementBox: { w: number; h: number },
  units: 'objectBoundingBox' | 'userSpaceOnUse',
  scale: number,
  userScale: { x: number; y: number }
) => {
  let length = 0;
  try {
    length = pathEl.getTotalLength();
  } catch {
    return null;
  }
  if (!Number.isFinite(length) || length <= 0) return null;

  const samples = Math.min(64, Math.max(8, Math.round(length / 20)));
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < samples; i += 1) {
    const t = samples === 1 ? 0 : (length * i) / (samples - 1);
    const p = pathEl.getPointAtLength(t);
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    points.push(mapClipPoint({ x: p.x, y: p.y }, elementBox, units, scale, userScale));
  }
  if (points.length < 3) return null;
  const d = pathEl.getAttribute('d') || '';
  const closed = /[zZ]/.test(d);
  return buildPointShape(points, closed);
};

const parseNumericList = (value: string): number[] => {
  const nums = value.match(/-?[\d.]+/g);
  if (!nums) return [];
  return nums.map(n => parseFloat(n)).filter(n => Number.isFinite(n));
};

const inferClipPathUnits = (clipEl: Element): 'objectBoundingBox' | 'userSpaceOnUse' => {
  const attr = clipEl.getAttribute('clipPathUnits');
  if (attr) {
    return attr.toLowerCase() === 'userspaceonuse' ? 'userSpaceOnUse' : 'objectBoundingBox';
  }

  const candidates = Array.from(
    clipEl.querySelectorAll('rect,circle,ellipse,polygon,polyline,path')
  ) as Element[];
  for (const child of candidates) {
    const attrs = ['x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry'];
    for (const key of attrs) {
      const raw = child.getAttribute(key);
      if (!raw) continue;
      const nums = parseNumericList(raw);
      if (nums.some(num => Math.abs(num) > 1.01)) return 'userSpaceOnUse';
    }
    const points = child.getAttribute('points');
    if (points) {
      const nums = parseNumericList(points);
      if (nums.some(num => Math.abs(num) > 1.01)) return 'userSpaceOnUse';
    }
    const d = child.getAttribute('d');
    if (d) {
      const nums = parseNumericList(d);
      if (nums.some(num => Math.abs(num) > 1.01)) return 'userSpaceOnUse';
    }
  }

  return 'objectBoundingBox';
};

const getSvgUserSpaceBox = (clipEl: Element): { w: number; h: number } | null => {
  const svg = (clipEl as SVGElement).ownerSVGElement;
  if (!svg) return null;
  const viewBox = svg.viewBox?.baseVal;
  if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
    return { w: viewBox.width, h: viewBox.height };
  }
  const widthAttr = svg.getAttribute('width');
  const heightAttr = svg.getAttribute('height');
  const w = widthAttr ? parseFloat(widthAttr) : NaN;
  const h = heightAttr ? parseFloat(heightAttr) : NaN;
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return { w, h };
  }
  return null;
};

const resolveSvgClipPath = (
  clipPathValue: string,
  element: Element,
  elementBox: { w: number; h: number },
  scale: number,
  win: Window
) => {
  const trimmed = (clipPathValue || '').trim();
  if (!trimmed || trimmed === 'none') return null;
  if (trimmed.toLowerCase().indexOf('url(') !== 0) return null;

  const urlMatch = trimmed.match(/url\((['"]?)(.*?)\1\)/i);
  const url = urlMatch?.[2] ? urlMatch[2] : '';
  if (!url) return null;
  const hashIndex = url.indexOf('#');
  const id = hashIndex >= 0 ? url.slice(hashIndex + 1) : url.replace(/^#/, '');
  if (!id) return null;

  const doc = element.ownerDocument || win.document;
  const clipEl = doc.getElementById(id);
  if (!clipEl || clipEl.tagName.toLowerCase() !== 'clippath') return null;

  const units = inferClipPathUnits(clipEl);
  const userSpace = getSvgUserSpaceBox(clipEl) || { w: elementBox.w, h: elementBox.h };
  const userScale = {
    x: userSpace.w > 0 ? (elementBox.w / userSpace.w) * scale : scale,
    y: userSpace.h > 0 ? (elementBox.h / userSpace.h) * scale : scale
  };

  const children = Array.from(
    clipEl.querySelectorAll('rect,circle,ellipse,polygon,polyline,path')
  ) as Element[];
  const shapes: Array<{
    vertices: { x: number; y: number }[];
    inTangents: { x: number; y: number }[];
    outTangents: { x: number; y: number }[];
    closed: boolean;
  }> = [];
  for (const child of children) {
    const tag = child.tagName.toLowerCase();
    if (tag === 'rect') {
      const w = mapClipValue(
        child.getAttribute('width'),
        elementBox.w,
        units,
        scale,
        userSpace.w,
        userScale.x
      );
      const h = mapClipValue(
        child.getAttribute('height'),
        elementBox.h,
        units,
        scale,
        userSpace.h,
        userScale.y
      );
      if (!w || !h) continue;
      const x =
        mapClipValue(
          child.getAttribute('x'),
          elementBox.w,
          units,
          scale,
          userSpace.w,
          userScale.x
        ) || 0;
      const y =
        mapClipValue(
          child.getAttribute('y'),
          elementBox.h,
          units,
          scale,
          userSpace.h,
          userScale.y
        ) || 0;
      const rx =
        mapClipValue(
          child.getAttribute('rx'),
          elementBox.w,
          units,
          scale,
          userSpace.w,
          userScale.x
        ) || 0;
      const ry =
        mapClipValue(
          child.getAttribute('ry'),
          elementBox.h,
          units,
          scale,
          userSpace.h,
          userScale.y
        ) || rx;
      if (rx > 0 || ry > 0) {
        shapes.push(
          buildRoundedRectShape(x, y, w, h, {
            tl: { rx, ry },
            tr: { rx, ry },
            br: { rx, ry },
            bl: { rx, ry }
          })
        );
        continue;
      }
      shapes.push(
        buildPolygonShape([
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h }
        ])
      );
      continue;
    }
    if (tag === 'circle') {
      const cx = mapClipValue(
        child.getAttribute('cx'),
        elementBox.w,
        units,
        scale,
        userSpace.w,
        userScale.x
      );
      const cy = mapClipValue(
        child.getAttribute('cy'),
        elementBox.h,
        units,
        scale,
        userSpace.h,
        userScale.y
      );
      const r = mapClipValue(
        child.getAttribute('r'),
        Math.min(elementBox.w, elementBox.h),
        units,
        scale,
        Math.min(userSpace.w, userSpace.h),
        Math.min(userScale.x, userScale.y)
      );
      if (cx === null || cy === null || r === null) continue;
      shapes.push(buildEllipseShape(cx, cy, r, r));
      continue;
    }
    if (tag === 'ellipse') {
      const cx = mapClipValue(
        child.getAttribute('cx'),
        elementBox.w,
        units,
        scale,
        userSpace.w,
        userScale.x
      );
      const cy = mapClipValue(
        child.getAttribute('cy'),
        elementBox.h,
        units,
        scale,
        userSpace.h,
        userScale.y
      );
      const rx = mapClipValue(
        child.getAttribute('rx'),
        elementBox.w,
        units,
        scale,
        userSpace.w,
        userScale.x
      );
      const ry = mapClipValue(
        child.getAttribute('ry'),
        elementBox.h,
        units,
        scale,
        userSpace.h,
        userScale.y
      );
      if (cx === null || cy === null || rx === null || ry === null) continue;
      shapes.push(buildEllipseShape(cx, cy, rx, ry));
      continue;
    }
    if (tag === 'polygon' || tag === 'polyline') {
      const points = parseSvgPoints(
        child.getAttribute('points') || '',
        elementBox,
        units,
        userSpace
      );
      if (points.length < 3) continue;
      const mapped = points.map(point =>
        mapClipPoint(point, elementBox, units, scale, userScale)
      );
      shapes.push(tag === 'polyline' ? buildPointShape(mapped, false) : buildPolygonShape(mapped));
      continue;
    }
    if (tag === 'path') {
      const pathEl = child as SVGPathElement;
      const sampled = sampleSvgPath(pathEl, elementBox, units, scale, userScale);
      if (sampled) shapes.push(sampled);
      continue;
    }
  }

  if (!shapes.length) return null;
  if (shapes.length === 1) return shapes[0];
  return { paths: shapes };
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

const isTransparentCss = (color: string): boolean => {
  if (!color) return true;
  const s = color.trim().toLowerCase();
  if (s === 'transparent') return true;
  const m = s.match(/rgba\(([^)]+)\)/i);
  if (!m || !m[1]) return false;
  const parts = m[1].split(',').map(part => parseFloat(part.trim()));
  if (parts.length < 4) return false;
  return !Number.isFinite(parts[3]) || parts[3] === 0;
};

const parseLength = (value: string, reference: number): number | null => {
  const v = (value || '').trim().toLowerCase();
  if (!v || v === 'auto') return null;
  if (v.endsWith('%')) {
    const pct = parseFloat(v);
    if (!Number.isFinite(pct)) return null;
    return (pct / 100) * reference;
  }
  const num = parseFloat(v);
  return Number.isFinite(num) ? num : null;
};

const parseBackgroundSizeList = (
  value: string,
  elementBox: { w: number; h: number },
  scale: number
): Array<{ w: number; h: number } | null> | null => {
  if (!value || value === 'none') return null;
  const parts = splitTopLevelCommas(value);
  if (!parts.length) return null;

  return parts.map(part => {
    const tokens = part
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    if (!tokens.length) return null;
    if (tokens.length === 1 && tokens[0] === 'auto') return null;

    const w = parseLength(tokens[0], elementBox.w);
    const h = parseLength(tokens[1] || tokens[0], elementBox.h);
    if (w === null || h === null) return null;
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { w: w * scale, h: h * scale };
  });
};

const parseBackgroundPositionList = (
  value: string,
  elementBox: { w: number; h: number },
  scale: number
): Array<{ x: number; y: number }> | null => {
  if (!value) return null;
  const parts = splitTopLevelCommas(value);
  if (!parts.length) return null;

  const resolveToken = (token: string, axis: 'x' | 'y'): number | null => {
    const t = token.trim().toLowerCase();
    if (!t) return null;
    if (t === 'center') return axis === 'x' ? elementBox.w / 2 : elementBox.h / 2;
    if (axis === 'x' && t === 'left') return 0;
    if (axis === 'x' && t === 'right') return elementBox.w;
    if (axis === 'y' && t === 'top') return 0;
    if (axis === 'y' && t === 'bottom') return elementBox.h;
    const len = parseLength(t, axis === 'x' ? elementBox.w : elementBox.h);
    return len === null ? null : len;
  };

  return parts.map(part => {
    const tokens = part
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);
    if (!tokens.length) return { x: 0, y: 0 };

    if (tokens.length === 1) {
      const x = resolveToken(tokens[0], 'x');
      const y = resolveToken(tokens[0], 'y');
      if (x !== null && y !== null) return { x: x * scale, y: y * scale };
      if (x !== null) return { x: x * scale, y: 0 };
      if (y !== null) return { x: 0, y: y * scale };
      return { x: 0, y: 0 };
    }

    const x = resolveToken(tokens[0], 'x');
    const y = resolveToken(tokens[1], 'y');
    return {
      x: (x !== null ? x : 0) * scale,
      y: (y !== null ? y : 0) * scale
    };
  });
};

const parseBackgroundRepeatList = (value: string): Array<{ x: boolean; y: boolean }> | null => {
  if (!value) return null;
  const parts = splitTopLevelCommas(value);
  if (!parts.length) return null;

  return parts.map(part => {
    const tokens = part
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .split(' ')
      .filter(Boolean);
    if (!tokens.length) return { x: true, y: true };
    if (tokens.length === 1) {
      if (tokens[0] === 'repeat-x') return { x: true, y: false };
      if (tokens[0] === 'repeat-y') return { x: false, y: true };
      if (tokens[0] === 'no-repeat') return { x: false, y: false };
      return { x: true, y: true };
    }
    return {
      x: tokens[0] !== 'no-repeat',
      y: tokens[1] !== 'no-repeat'
    };
  });
};

const parseGradientAxis = (gradientArgs: string): 'x' | 'y' | null => {
  const parts = splitTopLevelCommas(gradientArgs);
  const first = parts.length ? parts[0].trim().toLowerCase() : '';
  if (!first) return 'y';

  if (first.indexOf('to ') === 0) {
    if (first.indexOf('right') !== -1 || first.indexOf('left') !== -1) return 'x';
    if (first.indexOf('bottom') !== -1 || first.indexOf('top') !== -1) return 'y';
  }

  const angleMatch = first.match(/-?[\d.]+(deg|turn|rad|grad)/i);
  if (angleMatch) {
    let angle = parseFloat(angleMatch[0]);
    const unit = angleMatch[1].toLowerCase();
    if (unit === 'turn') angle *= 360;
    if (unit === 'rad') angle = (angle * 180) / Math.PI;
    if (unit === 'grad') angle *= 0.9;
    const norm = ((angle % 360) + 360) % 360;
    if (Math.abs(norm - 90) < 10 || Math.abs(norm - 270) < 10) return 'x';
    if (Math.abs(norm - 0) < 10 || Math.abs(norm - 180) < 10) return 'y';
  }

  if (
    /(rgba?\(|hsla?\(|#|var\(|transparent|currentcolor)/i.test(first) ||
    /(?:^|[\s(])\d/.test(first)
  ) {
    return 'y';
  }

  return null;
};

const parseStopPositionPx = (position: string, length: number): number | null => {
  if (!position) return null;
  const pos = position.trim().toLowerCase();
  if (pos.endsWith('%')) {
    const pct = parseFloat(pos);
    if (!Number.isFinite(pct)) return null;
    return (pct / 100) * length;
  }
  const num = parseFloat(pos);
  return Number.isFinite(num) ? num : null;
};

const extractGridLine = (
  gradient: { stops: { color: string; position?: string }[]; args?: string },
  axis: 'x' | 'y',
  elementBox: { w: number; h: number },
  scale: number
) => {
  const length = axis === 'x' ? elementBox.w : elementBox.h;
  if (!length || !gradient.stops || !gradient.stops.length) return null;

  const stops = gradient.stops;
  let colorStopIndex = -1;
  for (let i = 0; i < stops.length; i += 1) {
    const stop = stops[i];
    if (!stop || !stop.color || isTransparentCss(stop.color)) continue;
    if (!stop.position) continue;
    colorStopIndex = i;
    break;
  }
  if (colorStopIndex < 0) return null;

  const colorStop = stops[colorStopIndex];
  const posPx = parseStopPositionPx(colorStop.position || '', length);
  if (posPx === null) return null;
  if (!Number.isFinite(posPx)) return null;

  const nextStop = stops[colorStopIndex + 1];
  if (!nextStop || !nextStop.color || !isTransparentCss(nextStop.color)) return null;
  if (nextStop.position && nextStop.position !== colorStop.position) return null;

  return {
    color: colorStop.color,
    lineWidthPx: posPx * scale
  };
};

export const extractBackgroundGrid = (
  style: CSSStyleDeclaration,
  elementBox: { w: number; h: number },
  scale: number
): {
  x?: { spacingPx: number; lineWidthPx: number; offsetPx: number; color: string };
  y?: { spacingPx: number; lineWidthPx: number; offsetPx: number; color: string };
} | null => {
  const backgroundImage = style.backgroundImage || '';
  if (!backgroundImage || backgroundImage === 'none') return null;

  const gradients = findGradientFunctions(backgroundImage);
  if (!gradients.length) return null;

  const sizeList = parseBackgroundSizeList(style.backgroundSize, elementBox, scale);
  const posList = parseBackgroundPositionList(style.backgroundPosition, elementBox, scale);
  const repeatList = parseBackgroundRepeatList(style.backgroundRepeat);

  const gradientStops = extractBackgroundGradients(backgroundImage) || [];
  let gridX: { spacingPx: number; lineWidthPx: number; offsetPx: number; color: string } | null =
    null;
  let gridY: { spacingPx: number; lineWidthPx: number; offsetPx: number; color: string } | null =
    null;

  for (let i = 0; i < gradients.length; i += 1) {
    const grad = gradients[i];
    if (!grad || grad.type !== 'linear') continue;
    const axis = parseGradientAxis(grad.args);
    if (!axis) continue;

    const stopInfo = extractGridLine(gradientStops[i] || grad, axis, elementBox, scale);
    if (!stopInfo) continue;

    const size = sizeList && sizeList.length ? sizeList[Math.min(i, sizeList.length - 1)] : null;
    if (!size) continue;
    const spacingPx = axis === 'x' ? size.w : size.h;
    if (!Number.isFinite(spacingPx) || spacingPx <= 0.01) continue;

    const pos = posList && posList.length ? posList[Math.min(i, posList.length - 1)] : null;
    const offsetPx = pos ? (axis === 'x' ? pos.x : pos.y) : 0;

    const repeat = repeatList && repeatList.length ? repeatList[Math.min(i, repeatList.length - 1)] : null;
    if (repeat && ((axis === 'x' && !repeat.x) || (axis === 'y' && !repeat.y))) continue;

    const entry = {
      spacingPx,
      lineWidthPx: stopInfo.lineWidthPx,
      offsetPx,
      color: stopInfo.color
    };

    if (axis === 'x' && !gridX) gridX = entry;
    if (axis === 'y' && !gridY) gridY = entry;
  }

  if (!gridX && !gridY) return null;
  return {
    x: gridX || undefined,
    y: gridY || undefined
  };
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
  scale: number,
  clipPathOverride?: AEClipPath
) => {
  const radius = parseBorderRadius(style.borderRadius, elementBox, scale);
  const borderRadiusPx = getClampedBorderRadius(radius, elementBox, scale);
  const clipPath =
    clipPathOverride ||
    parseClipPathPolygon(style.clipPath, elementBox, scale) ||
    parseClipPathInset(style.clipPath, elementBox, scale) ||
    parseClipPathCircle(style.clipPath, elementBox, scale) ||
    parseClipPathEllipse(style.clipPath, elementBox, scale);
  const clips = style.overflow === 'hidden' || !!clipPath;

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

export { resolveSvgClipPath };

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

export const isTextLike = (el: Element, style: CSSStyleDeclaration, win: Window): boolean => {
  const txt = (el.textContent ?? '').trim();
  if (!txt) return false;

  const tag = el.tagName.toLowerCase();
  if (NON_TEXT_TAGS.has(tag)) return false;

  for (const child of Array.from(el.children)) {
    const ct = child.tagName.toLowerCase();
    if (NON_TEXT_TAGS.has(ct)) return false;
    if (!INLINE_TEXT_TAGS.has(ct)) return false;
    if (win) {
      const cs = win.getComputedStyle(child);
      if (cs.position && cs.position !== 'static') return false;
      if (cs.transform && cs.transform !== 'none') return false;
    }
  }

  return true;
};
