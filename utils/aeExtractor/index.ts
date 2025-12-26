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
import { AEBounds, AENode, AERenderHints, AEExportOptions, AESlideExport } from './types';

const inlineSvgStyles = (svgEl: SVGElement, win: Window): string => {
  const clone = svgEl.cloneNode(true) as SVGElement;
  const selector = 'circle, rect, line, path, ellipse, polygon, polyline';
  const originals = Array.from(svgEl.querySelectorAll(selector));
  const copies = Array.from(clone.querySelectorAll(selector));

  originals.forEach((original, index) => {
    const copy = copies[index];
    if (!copy) return;

    const style = win.getComputedStyle(original);

    const stroke = style.getPropertyValue('stroke') || style.stroke;
    const fill = style.getPropertyValue('fill') || style.fill;
    const strokeWidth = style.getPropertyValue('stroke-width') || (style as any).strokeWidth;
    const opacity = style.getPropertyValue('opacity') || style.opacity;
    const strokeOpacity = style.getPropertyValue('stroke-opacity') || (style as any).strokeOpacity;
    const fillOpacity = style.getPropertyValue('fill-opacity') || (style as any).fillOpacity;

    const origStroke = copy.getAttribute('stroke');
    const origFill = copy.getAttribute('fill');
    const shouldOverrideStroke = !origStroke || origStroke.indexOf('var(') !== -1;
    const shouldOverrideFill = !origFill || origFill.indexOf('var(') !== -1;

    if (shouldOverrideStroke && stroke) copy.setAttribute('stroke', stroke);
    if (shouldOverrideFill && fill) copy.setAttribute('fill', fill);
    if (!copy.getAttribute('stroke-width') && strokeWidth)
      copy.setAttribute('stroke-width', strokeWidth);
    if (!copy.getAttribute('opacity') && opacity) copy.setAttribute('opacity', opacity);
    if (!copy.getAttribute('stroke-opacity') && strokeOpacity)
      copy.setAttribute('stroke-opacity', strokeOpacity);
    if (!copy.getAttribute('fill-opacity') && fillOpacity)
      copy.setAttribute('fill-opacity', fillOpacity);
  });

  return clone.outerHTML;
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

  const fontSet = Array.from(win.document.fonts as any);
  fontSet.forEach((font: FontFace) => {
    addPostName(font.family, font.weight, font.style);
  });

  const postNames = Array.from(postNameMap.entries()).map(([name, styles]) => ({
    name,
    styles: Array.from(styles)
  }));

  return { urls: Array.from(urls), postNames };
};

const resolveExportSize = (value: number | undefined, fallback: number) => {
  const v = clampFinite(value);
  return v > 0 ? v : fallback;
};

const resolveExportValue = (value: number | undefined, fallback: number) => {
  const v = clampFinite(value);
  return v > 0 ? v : fallback;
};

export const extractSlideLayout = async (
  slide: HTMLElement,
  win: Window,
  options: AEExportOptions = {}
): Promise<AESlideExport> => {
  await win.document.fonts.ready;

  const rootRect = slide.getBoundingClientRect();
  const sourceW = clampFinite(rootRect.width);
  const sourceH = clampFinite(rootRect.height);

  const targetW = resolveExportSize(options.targetWidth, TARGET_W);
  const targetH = resolveExportSize(options.targetHeight, TARGET_H);
  const fps = resolveExportValue(options.fps, DEFAULT_FPS);
  const duration = resolveExportValue(options.duration, DEFAULT_DURATION);

  const scaleX = sourceW > 0 ? targetW / sourceW : 1;
  const scaleY = sourceH > 0 ? targetH / sourceH : 1;
  const scale = clampFinite(Math.min(scaleX, scaleY)) || 1;

  const mergeBounds = (base: AEBounds, items: AENode[]): AEBounds => {
    let minX = base.x;
    let minY = base.y;
    let maxX = base.x + base.w;
    let maxY = base.y + base.h;

    for (const item of items) {
      const b = item.bbox;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }

    return {
      x: minX,
      y: minY,
      w: Math.max(0, maxX - minX),
      h: Math.max(0, maxY - minY)
    };
  };

  const process = (el: Element): AENode | null => {
    const rect = el.getBoundingClientRect();
    const style = win.getComputedStyle(el);
    const transformValue = style.transform;
    if (!isVisible(style, rect)) return null;

    const rawBBox: AEBounds = {
      x: rect.left - rootRect.left,
      y: rect.top - rootRect.top,
      w: rect.width,
      h: rect.height
    };

    const bbox = scaleBounds(rawBBox, scale);

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
    }

    const { needsPrecomp, clip } = detectPrecomp(el, style, rawBBox, scale);
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

    if (!bgUrl && el instanceof win.HTMLElement && el.children.length === 0) {
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
      type !== 'svg' && type !== 'image' && !handledTextUrl && el instanceof win.HTMLElement;
    const hasPaintedChild =
      canConsiderText &&
      el instanceof win.HTMLElement &&
      el.children.length > 0 &&
      Array.from(el.children).some(child => hasVisualPaint(win.getComputedStyle(child)));
    const textLike = canConsiderText && isTextLike(el, style) && !hasPaintedChild;

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

    if (textLike) {
      const paints = hasVisualPaint(style);

      if (!paints) {
        type = 'text';
        renderHints.isText = true;

        extra = {
          ...extra,
          ...buildTextExtra(win, el, style, rootRect, scale, bbox)
        };
      } else {
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
          ...buildTextExtra(win, el, style, rootRect, scale, bbox),
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
      }
    }

    if (canConsiderText && !textLike) {
      const directTextNodes = getDirectTextNodes(el as HTMLElement);
      if (directTextNodes.length) {
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
          ...buildTextExtra(win, el as HTMLElement, style, rootRect, scale, bbox, directTextNodes),
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
    }

    if (type !== 'svg' && type !== 'text' && !skipChildTraversal) {
      for (const c of Array.from(el.children)) {
        const child = process(c);
        if (child) children.push(child);
      }
    }

    const shouldExpandGroupBounds =
      type === 'group' && children.length > 0 && !clip?.enabled && el !== slide;
    const finalBBox = shouldExpandGroupBounds ? mergeBounds(bbox, children) : bbox;

    return {
      type,
      name: getName(el),
      bbox: finalBBox,
      bboxSpace: 'global',
      style: {
        backgroundColor: style.backgroundColor,
        backgroundGradients: extractBackgroundGradients(style.backgroundImage) || undefined,
        opacity: style.opacity,
        transform: transformValue,
        zIndex: style.zIndex,
        boxShadow: boxShadow || undefined
      },
      renderHints,
      children: children.length ? children : undefined,
      clip,
      border,
      outline,
      ...extra
    };
  };

  const root = process(slide);
  if (!root) throw new Error('extractSlideLayout: slide root is not visible or has zero size.');

  return {
    slideId: slide.id,
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
