import { AEBorder, AEBorderRadius, AEBorderSide } from './types';

const parseLength = (value: string, reference: number): number => {
  const trimmed = (value || '').trim();
  if (!trimmed) return 0;
  if (trimmed.endsWith('%')) {
    const pct = parseFloat(trimmed);
    return Number.isFinite(pct) ? (pct / 100) * reference : 0;
  }
  const px = parseFloat(trimmed);
  return Number.isFinite(px) ? px : 0;
};

const parseBorderSide = (
  width: string,
  style: string,
  color: string,
  scale: number,
  reference: number
): AEBorderSide => {
  const widthPx = parseLength(width, reference);
  return {
    widthPx: widthPx * scale,
    style: style || 'none',
    color: color || 'transparent'
  };
};

const isTransparentColor = (color: string): boolean => {
  if (!color) return true;
  const lower = color.trim().toLowerCase();
  if (lower === 'transparent') return true;

  const rgba = lower.match(/rgba?\(([^)]+)\)/);
  if (rgba) {
    const parts = rgba[1].split(',').map(part => part.trim());
    if (parts.length === 4) return parseFloat(parts[3]) === 0;
    return false;
  }

  const hsla = lower.match(/hsla?\(([^)]+)\)/);
  if (hsla) {
    const parts = hsla[1].split(',').map(part => part.trim());
    if (parts.length === 4) return parseFloat(parts[3]) === 0;
    return false;
  }

  return false;
};

const isVisibleSide = (side: AEBorderSide): boolean => {
  if (side.widthPx <= 0) return false;
  if (side.style === 'none' || side.style === 'hidden') return false;
  if (isTransparentColor(side.color)) return false;
  return true;
};

const toFourValues = (values: number[]): [number, number, number, number] => {
  if (values.length === 1) return [values[0], values[0], values[0], values[0]];
  if (values.length === 2) return [values[0], values[1], values[0], values[1]];
  if (values.length === 3) return [values[0], values[1], values[2], values[1]];
  return [values[0], values[1], values[2], values[3]];
};

export const parseBorderRadius = (
  radius: string,
  elementBox: { w: number; h: number },
  scale: number
): AEBorderRadius => {
  const raw = (radius || '').trim();
  if (!raw) {
    return {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 0, y: 0 },
      bottomRight: { x: 0, y: 0 },
      bottomLeft: { x: 0, y: 0 }
    };
  }

  const [hRaw, vRaw] = raw.split('/');
  const hTokens = hRaw.trim().split(/\s+/).filter(Boolean);
  const vTokens = (vRaw ? vRaw.trim() : hRaw.trim()).split(/\s+/).filter(Boolean);

  const hValues = toFourValues(hTokens.map(token => parseLength(token, elementBox.w)));
  const vValues = toFourValues(vTokens.map(token => parseLength(token, elementBox.h)));

  return {
    topLeft: { x: hValues[0] * scale, y: vValues[0] * scale },
    topRight: { x: hValues[1] * scale, y: vValues[1] * scale },
    bottomRight: { x: hValues[2] * scale, y: vValues[2] * scale },
    bottomLeft: { x: hValues[3] * scale, y: vValues[3] * scale }
  };
};

export const getMaxBorderRadius = (radius: AEBorderRadius): number => {
  const values = [
    radius.topLeft.x,
    radius.topLeft.y,
    radius.topRight.x,
    radius.topRight.y,
    radius.bottomRight.x,
    radius.bottomRight.y,
    radius.bottomLeft.x,
    radius.bottomLeft.y
  ];
  return Math.max(...values);
};

export const getClampedBorderRadius = (
  radius: AEBorderRadius,
  elementBox: { w: number; h: number },
  scale: number
): number => {
  const maxRadius = getMaxBorderRadius(radius);
  const maxAllowed = Math.min(elementBox.w, elementBox.h) * scale * 0.5;
  return Math.min(maxRadius, maxAllowed);
};

const getFirstVisibleSide = (sides: {
  top: AEBorderSide;
  right: AEBorderSide;
  bottom: AEBorderSide;
  left: AEBorderSide;
}): AEBorderSide => {
  if (isVisibleSide(sides.top)) return sides.top;
  if (isVisibleSide(sides.right)) return sides.right;
  if (isVisibleSide(sides.bottom)) return sides.bottom;
  if (isVisibleSide(sides.left)) return sides.left;
  return sides.top;
};

const isUniformSides = (sides: {
  top: AEBorderSide;
  right: AEBorderSide;
  bottom: AEBorderSide;
  left: AEBorderSide;
}): boolean => {
  const { top, right, bottom, left } = sides;
  return (
    top.widthPx === right.widthPx &&
    top.widthPx === bottom.widthPx &&
    top.widthPx === left.widthPx &&
    top.style === right.style &&
    top.style === bottom.style &&
    top.style === left.style &&
    top.color === right.color &&
    top.color === bottom.color &&
    top.color === left.color
  );
};

export const extractBorder = (
  style: CSSStyleDeclaration,
  scale: number,
  elementBox: { w: number; h: number }
): AEBorder | null => {
  const sides = {
    top: parseBorderSide(
      style.borderTopWidth,
      style.borderTopStyle,
      style.borderTopColor,
      scale,
      elementBox.h
    ),
    right: parseBorderSide(
      style.borderRightWidth,
      style.borderRightStyle,
      style.borderRightColor,
      scale,
      elementBox.w
    ),
    bottom: parseBorderSide(
      style.borderBottomWidth,
      style.borderBottomStyle,
      style.borderBottomColor,
      scale,
      elementBox.h
    ),
    left: parseBorderSide(
      style.borderLeftWidth,
      style.borderLeftStyle,
      style.borderLeftColor,
      scale,
      elementBox.w
    )
  };

  if (
    !isVisibleSide(sides.top) &&
    !isVisibleSide(sides.right) &&
    !isVisibleSide(sides.bottom) &&
    !isVisibleSide(sides.left)
  ) {
    return null;
  }

  const radius = parseBorderRadius(style.borderRadius, elementBox, scale);
  const radiusPx = getClampedBorderRadius(radius, elementBox, scale);
  const uniformRadius =
    radius.topLeft.x === radius.topLeft.y &&
    radius.topLeft.x === radius.topRight.x &&
    radius.topLeft.x === radius.topRight.y &&
    radius.topLeft.x === radius.bottomRight.x &&
    radius.topLeft.x === radius.bottomRight.y &&
    radius.topLeft.x === radius.bottomLeft.x &&
    radius.topLeft.x === radius.bottomLeft.y;

  const uniformSides = isUniformSides(sides);
  const representative = uniformSides ? sides.top : getFirstVisibleSide(sides);

  return {
    widthPx: representative.widthPx,
    color: representative.color,
    style: representative.style,
    radiusPx,
    isUniform: uniformSides,
    sides,
    radius
  };
};

export const extractOutline = (
  style: CSSStyleDeclaration,
  scale: number,
  elementBox: { w: number; h: number }
): AEBorder | null => {
  const side = parseBorderSide(
    style.outlineWidth,
    style.outlineStyle,
    style.outlineColor,
    scale,
    Math.min(elementBox.w, elementBox.h)
  );

  if (!isVisibleSide(side)) return null;

  const radius = parseBorderRadius(style.borderRadius, elementBox, scale);
  const radiusPx = getClampedBorderRadius(radius, elementBox, scale);

  const sides = {
    top: side,
    right: side,
    bottom: side,
    left: side
  };

  return {
    widthPx: side.widthPx,
    color: side.color,
    style: side.style,
    radiusPx,
    isUniform: true,
    sides,
    radius
  };
};
