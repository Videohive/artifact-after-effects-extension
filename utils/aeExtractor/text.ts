import { AEBounds, AETextLineRange } from './types';
import { calculateTracking } from './helpers';

type Token =
  | { kind: 'br' }
  | {
      kind: 'text';
      text: string;
      parentStyle: { color: string; fontWeight: string; fontStyle: string };
      rect: DOMRect | null;
    };

const splitWordsWithSpaces = (s: string): string[] => {
  return s.match(/\S+\s*/g) ?? [];
};

const collectTextTokens = (
  win: Window,
  el: HTMLElement,
  textNodes?: Text[]
): Token[] => {
  const tokens: Token[] = [];

  const addTextNodeTokens = (textNode: Text) => {
    const raw = textNode.data ?? '';
    if (!raw) return;

    const parts = splitWordsWithSpaces(raw);
    if (!parts.length) return;

    const parentEl = textNode.parentElement as HTMLElement | null;
    const cs = parentEl ? win.getComputedStyle(parentEl) : win.getComputedStyle(el);
    const parentStyle = {
      color: cs.color,
      fontWeight: cs.fontWeight,
      fontStyle: cs.fontStyle
    };

    let offset = 0;
    for (const part of parts) {
      const r = win.document.createRange();
      const start = offset;
      const end = offset + part.length;
      offset = end;

      const safeStart = Math.max(0, Math.min(start, textNode.length));
      const safeEnd = Math.max(safeStart, Math.min(end, textNode.length));
      if (safeEnd === safeStart) continue;

      r.setStart(textNode, safeStart);
      r.setEnd(textNode, safeEnd);

      const rect = r.getClientRects()[0] ?? null;

      tokens.push({
        kind: 'text',
        text: part,
        parentStyle,
        rect
      });
    }
  };

  if (textNodes && textNodes.length) {
    for (const node of textNodes) addTextNodeTokens(node);
    return tokens;
  }

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const e = node as HTMLElement;
      const tag = e.tagName.toLowerCase();

      if (tag === 'br') {
        tokens.push({ kind: 'br' });
        return;
      }

      for (const child of Array.from(e.childNodes)) walk(child);
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      addTextNodeTokens(node as Text);
    }
  };

  walk(el);
  return tokens;
};

const extractWrappedTextAndLineStyles = (
  win: Window,
  el: HTMLElement,
  rootRect: DOMRect,
  scale: number,
  textNodes?: Text[]
): {
  text: string;
  lines: string[];
  lineBounds: AEBounds[];
  lineRanges: AETextLineRange[];
} => {
  const cs = win.getComputedStyle(el);
  const fontSize = parseFloat(cs.fontSize) || 16;
  const tolerance = fontSize * 0.35;

  const prevTransform = el.style.transform;
  const prevTransformOrigin = el.style.transformOrigin;

  // Temporarily neutralize local transform so client rects reflect unrotated layout.
  if (cs.transform && cs.transform !== 'none') {
    el.style.transform = 'none';
    el.style.transformOrigin = '0 0';
  }

  let tokens: Token[] = [];
  try {
    tokens = collectTextTokens(win, el, textNodes);
  } finally {
    if (cs.transform && cs.transform !== 'none') {
      el.style.transform = prevTransform;
      el.style.transformOrigin = prevTransformOrigin;
    }
  }

  const lines: string[] = [];
  const lineRanges: AETextLineRange[] = [];
  const lineBoundsRaw: Array<{ left: number; top: number; right: number; bottom: number } | null> = [];

  let currentText = '';
  let currentStyle: AETextLineRange['style'] | null = null;
  let currentBounds: { left: number; top: number; right: number; bottom: number } | null = null;

  let prevTop: number | null = null;

  const flushLine = () => {
    const txt = currentText.trimEnd();
    if (txt.length > 0) {
      const idx = lines.length;
      lines.push(txt);
      lineRanges.push({
        lineIndex: idx,
        style:
          currentStyle ?? {
            color: cs.color,
            fontWeight: cs.fontWeight,
            fontStyle: cs.fontStyle
          }
      });
      lineBoundsRaw.push(currentBounds);
    }
    currentText = '';
    currentStyle = null;
    currentBounds = null;
    prevTop = null;
  };

  const updateBounds = (r: DOMRect) => {
    if (!currentBounds) {
      currentBounds = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      return;
    }
    currentBounds.left = Math.min(currentBounds.left, r.left);
    currentBounds.top = Math.min(currentBounds.top, r.top);
    currentBounds.right = Math.max(currentBounds.right, r.right);
    currentBounds.bottom = Math.max(currentBounds.bottom, r.bottom);
  };

  for (const tok of tokens) {
    if (tok.kind === 'br') {
      flushLine();
      continue;
    }

    const piece = tok.text;

    if (!currentStyle && piece.trim().length > 0) {
      currentStyle = {
        color: tok.parentStyle.color,
        fontWeight: tok.parentStyle.fontWeight,
        fontStyle: tok.parentStyle.fontStyle
      };
    }

    if (tok.rect) {
      if (prevTop === null) {
        prevTop = tok.rect.top;
      } else if (Math.abs(tok.rect.top - prevTop) > tolerance && currentText.trim().length > 0) {
        flushLine();
        prevTop = tok.rect.top;
      }

      updateBounds(tok.rect);
    }

    currentText += piece;
  }

  flushLine();

  if (!lines.length) {
    const fallback = el.innerText?.trim() ?? '';
    const flines = fallback ? fallback.split('\n') : [];
    return {
      text: flines.join('\n'),
      lines: flines,
      lineBounds: flines.map(() => ({ x: 0, y: 0, w: 0, h: 0 })),
      lineRanges: flines.map((_, i) => ({
        lineIndex: i,
        style: { color: cs.color, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle }
      }))
    };
  }

  const lineBounds: AEBounds[] = lineBoundsRaw.map(b => {
    if (!b) return { x: 0, y: 0, w: 0, h: 0 };
    return {
      x: (b.left - rootRect.left) * scale,
      y: (b.top - rootRect.top) * scale,
      w: (b.right - b.left) * scale,
      h: (b.bottom - b.top) * scale
    };
  });

  return { text: lines.join('\n'), lines, lineBounds, lineRanges };
};

export const buildTextExtra = (
  win: Window,
  el: HTMLElement,
  style: CSSStyleDeclaration,
  rootRect: DOMRect,
  scale: number,
  elementBBox: AEBounds,
  textNodes?: Text[]
) => {
  const fontSize = parseFloat(style.fontSize);
  const fontSizeSafe = Number.isFinite(fontSize) ? fontSize : 16;

  const wrapped = extractWrappedTextAndLineStyles(win, el, rootRect, scale, textNodes);

  const computedLineHeight =
    style.lineHeight === 'normal'
      ? (() => {
          if (wrapped.lineBounds.length >= 2) return wrapped.lineBounds[1].y - wrapped.lineBounds[0].y;
          if (wrapped.lineBounds.length === 1) return wrapped.lineBounds[0].h || fontSizeSafe * 1.2 * scale;
          return fontSizeSafe * 1.2 * scale;
        })()
      : (parseFloat(style.lineHeight) || fontSizeSafe * 1.2) * scale;

  const fixedTextLines =
    wrapped.lineBounds.some(b => b.w > 0 && b.h > 0)
      ? wrapped.lineBounds
      : wrapped.lines.map(() => ({ ...elementBBox }));

  return {
    text: wrapped.text,
    lines: wrapped.lines,
    textLines: fixedTextLines,
    lineRanges: wrapped.lineRanges,
    textTransform: style.textTransform,
    font: {
      family: style.fontFamily.replace(/['"]/g, ''),
      fontStyle: style.fontStyle,
      weight: style.fontWeight,
      sizePx: fontSizeSafe * scale,
      lineHeightPx: computedLineHeight,
      tracking: calculateTracking(style.letterSpacing, fontSizeSafe),
      color: style.color,
      textAlign: style.textAlign
    }
  } as const;
};
