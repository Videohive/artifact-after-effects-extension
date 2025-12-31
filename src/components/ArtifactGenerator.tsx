import React, { useState, useRef, useEffect } from 'react';
import {
  generateArtifacts,
  regenerateArtifact,
  generateNewArtifact,
  updateArtifactsFromContext,
  AiProviderName,
  ImageProviderName,
  ArtifactMode
} from '../services/aiService';
import { extractSlideLayout as extractArtifactLayout } from '../utils/aeExtractor/index';
import { ArtifactPreview } from './artifact-generator/ArtifactPreview';
import { ArtifactToolbar } from './artifact-generator/ArtifactToolbar';
import { ArtifactHistoryPanel } from './artifact-generator/ArtifactHistoryPanel';
import { EmptyState } from './artifact-generator/EmptyState';
import { ExportControls } from './artifact-generator/ExportControls';
import { GeneratorInput } from './artifact-generator/GeneratorInput';
import { ProjectMetadataPanel } from './artifact-generator/ProjectMetadataPanel';
import { ImageProviderOption, ResolutionOption, ViewMode } from './artifact-generator/types';
import {
  listArtifactHistory,
  getArtifactHistory,
  createArtifactHistory,
  updateArtifactHistory,
  deleteArtifactHistory,
  ArtifactHistoryItem
} from '../services/artifactHistoryService';
import { getAuthToken } from '../services/authService';

const URL_TEXT_RE = /^https?:\/\/\S+$/i;

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { id: '1080p', label: 'Full HD (1920x1080)', width: 1920, height: 1080 },
  { id: '2k', label: '2K (2560x1440)', width: 2560, height: 1440 },
  { id: '4k', label: '4K (3840x2160)', width: 3840, height: 2160 }
];

const IMAGE_PROVIDER_OPTIONS: ImageProviderOption[] = [
  { id: 'random', label: 'Random (All)' },
  { id: 'pexels', label: 'Pexels' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'pixabay', label: 'Pixabay' }
];
const PREVIEW_BASE_WIDTH = 1280;
const PREVIEW_BASE_HEIGHT = 720;
const PREVIEW_EDITOR_STYLE = `
  :root {
    --ae2-edit-outline: #4cc9ff;
    --ae2-edit-selected: #9ad8ff;
    --ae2-edit-handle: #ffffff;
  }
  .ae2-edit-target {
    outline: 1px solid transparent;
    outline-offset: 0;
  }
  .ae2-edit-target:hover {
    outline-color: var(--ae2-edit-outline);
  }
  .ae2-has-selection .ae2-edit-target:hover {
    outline-color: transparent;
  }
  .ae2-edit-target.ae2-selected {
    outline: 2px solid var(--ae2-edit-selected);
  }
  #ae2-selection {
    position: absolute;
    border: 1px solid var(--ae2-edit-outline);
    box-sizing: border-box;
    pointer-events: none;
    z-index: 2147483646;
  }
  .ae2-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background: var(--ae2-edit-handle);
    border: 1px solid var(--ae2-edit-outline);
    box-sizing: border-box;
    border-radius: 2px;
    z-index: 2147483647;
  }
  .ae2-handle-rotate {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #0b0f14;
  }
  svg.ae2-edit-target,
  svg.ae2-edit-target * {
    pointer-events: auto !important;
  }
  .svg-overlay {
    pointer-events: none !important;
  }
  .svg-overlay * {
    pointer-events: auto !important;
  }
`;

const PREVIEW_EDITOR_SCRIPT = `
  (function () {
    if (window.__ae2PreviewEditor) return;
    window.__ae2PreviewEditor = true;

    var doc = document;
    var body = doc.body;
    if (body) {
      body.setAttribute('tabindex', '0');
    }
    var selected = null;
    var overlay = null;
    var handles = {};
    var dragging = null;
    var dirty = false;
    var history = [];
    var historyIndex = -1;
    var restoring = false;
    var HISTORY_LIMIT = 50;

    function isUi(el) {
      return !!(el && el.getAttribute && el.getAttribute('data-ae2-ui') === 'true');
    }

    function isSvgElement(el) {
      return !!(el && el.tagName && el.tagName.toLowerCase() === 'svg');
    }

    function isSvgGraphics(el) {
      if (!el) return false;
      if (typeof SVGGraphicsElement !== 'undefined') {
        return el instanceof SVGGraphicsElement;
      }
      return typeof SVGElement !== 'undefined' && el instanceof SVGElement;
    }

    function getSvgRoot(el) {
      if (!el) return null;
      if (isSvgElement(el)) return el;
      if (isSvgGraphics(el)) return el.ownerSVGElement || el.closest('svg');
      return null;
    }

    function isHtmlElement(el) {
      if (!el) return false;
      if (typeof HTMLElement !== 'undefined') {
        return el instanceof HTMLElement;
      }
      return !!el.style;
    }

    function svgHasSelectableChild(svgEl) {
      if (!svgEl || !svgEl.querySelectorAll) return false;
      var nodes = svgEl.querySelectorAll('[id]');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (node === svgEl) continue;
        if (isSvgGraphics(node)) return true;
      }
      return false;
    }

    function getSelectable(el) {
      var node = el;
      while (node && node !== body && node !== doc.documentElement) {
        if (isUi(node)) return null;
        if (isSvgElement(node)) {
          if (node.id) return node;
          return null;
        }
        if (node.id) return node;
        node = node.parentElement;
      }
      return null;
    }

    function getUnderlyingSelectable(x, y, svgEl) {
      if (!svgEl || !svgEl.style) return null;
      var nodes = [svgEl];
      try {
        var descendants = svgEl.querySelectorAll ? svgEl.querySelectorAll('*') : [];
        for (var i = 0; i < descendants.length; i += 1) {
          nodes.push(descendants[i]);
        }
      } catch (err) {}
      var prev = [];
      for (var j = 0; j < nodes.length; j += 1) {
        prev.push(nodes[j].style ? nodes[j].style.pointerEvents : '');
        if (nodes[j].style) nodes[j].style.pointerEvents = 'none';
      }
      var under = doc.elementFromPoint(x, y);
      for (var k = 0; k < nodes.length; k += 1) {
        if (nodes[k].style) nodes[k].style.pointerEvents = prev[k] || '';
      }
      if (!under || under === svgEl) return null;
      if (getSvgRoot(under) === svgEl) return null;
      return getSelectable(under);
    }

    function markTargets() {
      var nodes = body.querySelectorAll('[id]');
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || node === body || node === doc.documentElement) continue;
        if (isUi(node)) continue;
        node.classList.add('ae2-edit-target');
      }
    }

    function getNum(el, key, fallback) {
      var raw = el.getAttribute('data-ae2-' + key);
      if (raw == null) return fallback;
      var num = parseFloat(raw);
      return isNaN(num) ? fallback : num;
    }

    function setNum(el, key, value) {
      el.setAttribute('data-ae2-' + key, String(value));
    }

    function getBaseTransform(el) {
      var base = el.getAttribute('data-ae2-base-transform');
      if (base == null) {
        var computed = window.getComputedStyle(el).transform;
        base = computed && computed !== 'none' ? computed : '';
        el.setAttribute('data-ae2-base-transform', base);
      }
      return base;
    }

    function applyTransform(el) {
      var base = getBaseTransform(el);
      var tx = getNum(el, 'tx', 0);
      var ty = getNum(el, 'ty', 0);
      var rot = getNum(el, 'rot', 0);
      var sx = getNum(el, 'sx', 1);
      var sy = getNum(el, 'sy', 1);
      setTransformOrigin(el);
      var baseTransform = base ? base + ' ' : '';
      var tail = 'rotate(' + rot + 'deg) scale(' + sx + ',' + sy + ')';
      var translate = 'translate(' + tx + 'px,' + ty + 'px)';
      var transform = '';
      if (base && base.indexOf('matrix') === 0) {
        transform = translate + ' ' + baseTransform + tail;
      } else {
        transform = baseTransform + translate + ' ' + tail;
      }
      el.style.transform = transform;
    }

    function ensureUi() {
      if (overlay) return;
      overlay = doc.createElement('div');
      overlay.id = 'ae2-selection';
      overlay.setAttribute('data-ae2-ui', 'true');
      body.appendChild(overlay);

      var names = ['nw', 'ne', 'sw', 'se'];
      for (var i = 0; i < names.length; i += 1) {
        var name = names[i];
        var handle = doc.createElement('div');
        handle.className = 'ae2-handle ae2-handle-' + name;
        handle.setAttribute('data-ae2-ui', 'true');
        handle.setAttribute('data-ae2-handle', name);
        body.appendChild(handle);
        handles[name] = handle;
      }

      var rotate = doc.createElement('div');
      rotate.className = 'ae2-handle ae2-handle-rotate';
      rotate.setAttribute('data-ae2-ui', 'true');
      rotate.setAttribute('data-ae2-handle', 'rotate');
      body.appendChild(rotate);
      handles.rotate = rotate;
    }

    function setOverlayVisible(visible) {
      if (!overlay) return;
      overlay.style.display = visible ? 'block' : 'none';
      Object.keys(handles).forEach(function (key) {
        handles[key].style.display = visible ? 'block' : 'none';
      });
    }

    function updateOverlay() {
      if (!selected || !overlay) return;
      var rect = getSelectionRect(selected);
      if (!rect) return;
      var left = rect.left + window.scrollX;
      var top = rect.top + window.scrollY;
      overlay.style.left = left + 'px';
      overlay.style.top = top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';

      var half = 5;
      if (handles.nw) {
        handles.nw.style.left = (left - half) + 'px';
        handles.nw.style.top = (top - half) + 'px';
      }
      if (handles.ne) {
        handles.ne.style.left = (left + rect.width - half) + 'px';
        handles.ne.style.top = (top - half) + 'px';
      }
      if (handles.sw) {
        handles.sw.style.left = (left - half) + 'px';
        handles.sw.style.top = (top + rect.height - half) + 'px';
      }
      if (handles.se) {
        handles.se.style.left = (left + rect.width - half) + 'px';
        handles.se.style.top = (top + rect.height - half) + 'px';
      }
      if (handles.rotate) {
        handles.rotate.style.left = (left + rect.width / 2 - 6) + 'px';
        handles.rotate.style.top = (top - 26) + 'px';
      }
    }

    function selectElement(el) {
      if (selected === el) return;
      if (selected) {
        selected.classList.remove('ae2-selected');
      }
      selected = el;
      if (selected) {
        selected.classList.add('ae2-selected');
        if (body) body.classList.add('ae2-has-selection');
        ensureUi();
        setOverlayVisible(true);
        applyTransform(selected);
        updateOverlay();
        if (body) body.focus();
      } else {
        setOverlayVisible(false);
      }
    }

    function clearSelection() {
      if (!selected) return;
      selected.classList.remove('ae2-selected');
      selected = null;
      if (body) body.classList.remove('ae2-has-selection');
      setOverlayVisible(false);
    }

    function startMove(e) {
      if (!selected) return;
      dragging = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        tx: getNum(selected, 'tx', 0),
        ty: getNum(selected, 'ty', 0),
        started: false
      };
      dirty = false;
    }

    function startResize(e, handle) {
      if (!selected) return;
      var rect = getSelectionRect(selected) || selected.getBoundingClientRect();
      dragging = {
        type: 'resize',
        handle: handle,
        startX: e.clientX,
        startY: e.clientY,
        width: rect.width,
        height: rect.height,
        sx: getNum(selected, 'sx', 1),
        sy: getNum(selected, 'sy', 1)
      };
      dirty = false;
    }

    function startRotate(e) {
      if (!selected) return;
      var rect = getSelectionRect(selected) || selected.getBoundingClientRect();
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      dragging = {
        type: 'rotate',
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI,
        rot: getNum(selected, 'rot', 0),
        centerX: cx,
        centerY: cy
      };
      dirty = false;
    }

    function onMouseMove(e) {
      if (!dragging || !selected) return;
      if (dragging.type === 'move') {
        var dx = e.clientX - dragging.startX;
        var dy = e.clientY - dragging.startY;
        if (!dragging.started) {
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
          dragging.started = true;
        }
        setNum(selected, 'tx', dragging.tx + dx);
        setNum(selected, 'ty', dragging.ty + dy);
        applyTransform(selected);
        updateOverlay();
        dirty = true;
        return;
      }
      if (dragging.type === 'resize') {
        var dxr = e.clientX - dragging.startX;
        var dyr = e.clientY - dragging.startY;
        var scaleX = 1;
        var scaleY = 1;
        if (dragging.handle.indexOf('e') !== -1) {
          scaleX = (dragging.width + dxr) / dragging.width;
        }
        if (dragging.handle.indexOf('w') !== -1) {
          scaleX = (dragging.width - dxr) / dragging.width;
        }
        if (dragging.handle.indexOf('s') !== -1) {
          scaleY = (dragging.height + dyr) / dragging.height;
        }
        if (dragging.handle.indexOf('n') !== -1) {
          scaleY = (dragging.height - dyr) / dragging.height;
        }
        var nextSx = Math.max(0.05, dragging.sx * scaleX);
        var nextSy = Math.max(0.05, dragging.sy * scaleY);
        setNum(selected, 'sx', nextSx);
        setNum(selected, 'sy', nextSy);
        applyTransform(selected);
        updateOverlay();
        dirty = true;
        return;
      }
      if (dragging.type === 'rotate') {
        var angle = Math.atan2(e.clientY - dragging.centerY, e.clientX - dragging.centerX) * 180 / Math.PI;
        var delta = angle - dragging.startAngle;
        setNum(selected, 'rot', dragging.rot + delta);
        applyTransform(selected);
        updateOverlay();
        dirty = true;
      }
    }

    function finishDrag() {
      if (dragging && dragging.type === 'move' && !dragging.started) {
        dragging = null;
        body.style.userSelect = '';
        body.style.cursor = '';
        return;
      }
      dragging = null;
      body.style.userSelect = '';
      body.style.cursor = '';
      if (dirty) {
        dirty = false;
        postUpdate();
      }
    }

    function postUpdate() {
      var root = getRoot();
      var html = getRootHtml(root);
      if (!restoring) {
        pushHistory(html);
      }
      window.parent.postMessage({ source: 'ae2-preview-editor', type: 'update', html: html }, '*');
    }

    function onMouseDown(e) {
      var target = e.target;
      if (isUi(target)) return;
      var selectable = getSelectable(target);
      var svgRoot = getSvgRoot(target);
      if (svgRoot && !e.altKey) {
        var passthrough = getUnderlyingSelectable(e.clientX, e.clientY, svgRoot);
        if (passthrough) {
          selectable = passthrough;
        }
      }
      if (!selectable) {
        clearSelection();
        return;
      }
      selectElement(selectable);
      if (body) body.focus();
      body.style.userSelect = 'none';
      body.style.cursor = 'move';
      startMove(e);
      e.preventDefault();
    }

    function onHandleDown(e) {
      var handle = e.target.getAttribute('data-ae2-handle');
      if (!handle || !selected) return;
      body.style.userSelect = 'none';
      if (handle === 'rotate') {
        body.style.cursor = 'crosshair';
        startRotate(e);
      } else {
        body.style.cursor = handle + '-resize';
        startResize(e, handle);
      }
      e.preventDefault();
      e.stopPropagation();
    }

    function onKeyDown(e) {
      var isUndo =
        (e.ctrlKey || e.metaKey) &&
        !e.shiftKey &&
        (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ');
      var isRedo =
        (e.ctrlKey || e.metaKey) &&
        ((e.shiftKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ')) ||
          e.key === 'y' ||
          e.key === 'Y' ||
          e.code === 'KeyY');
      if (isUndo || isRedo) {
        window.parent.postMessage(
          { source: 'ae2-preview-editor', type: isUndo ? 'undo' : 'redo' },
          '*'
        );
        e.preventDefault();
        return;
      }
      if (!selected) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        selected.parentElement.removeChild(selected);
        clearSelection();
        markTargets();
        postUpdate();
      }
    }

    function getSelectionRect(el) {
      if (!el) return null;
      if (el.tagName && el.tagName.toLowerCase() === 'svg') {
        var svgRect = getSvgContentsRect(el);
        if (svgRect) return svgRect;
      }
      return el.getBoundingClientRect();
    }

    function setTransformOrigin(el) {
      if (!el) return;
      if (isSvgGraphics(el)) {
        el.style.transformBox = 'fill-box';
        el.style.transformOrigin = 'center';
        return;
      }

      if (isHtmlElement(el)) {
        var computed = window.getComputedStyle(el);
        if (computed && computed.display === 'inline') {
          if (!el.getAttribute('data-ae2-display')) {
            el.setAttribute('data-ae2-display', 'inline');
          }
          el.style.display = 'inline-block';
        }
      }

      var base = getBaseTransform(el);
      if (base && base.indexOf('matrix') === 0) {
        var saved = el.getAttribute('data-ae2-origin');
        var computedOrigin = '';
        try {
          computedOrigin = window.getComputedStyle(el).transformOrigin || '';
        } catch (err) {}
        if (!saved) {
          saved = el.style.transformOrigin || computedOrigin;
          if (saved) {
            el.setAttribute('data-ae2-origin', saved);
          }
        }
        if (saved) {
          el.style.transformOrigin = saved;
        } else if (computedOrigin) {
          el.style.transformOrigin = computedOrigin;
        }
        return;
      }

      var rect = getSelectionRect(el);
      if (!rect) return;
      var elRect = el.getBoundingClientRect();
      if (!elRect || (!elRect.width && !elRect.height)) return;
      var originX = rect.left - elRect.left + rect.width / 2;
      var originY = rect.top - elRect.top + rect.height / 2;
      if (isSvgElement(el)) {
        el.style.transformBox = 'fill-box';
      }
      el.style.transformOrigin = originX + 'px ' + originY + 'px';
    }

    function getRoot() {
      return doc.querySelector('.artifact') || doc.querySelector('.slide') || body;
    }

    function getRootHtml(root) {
      return root === body ? body.innerHTML : root.outerHTML;
    }

    function pushHistory(html) {
      if (historyIndex >= 0 && history[historyIndex] === html) return;
      history = history.slice(0, historyIndex + 1);
      history.push(html);
      historyIndex = history.length - 1;
      if (history.length > HISTORY_LIMIT) {
        history.shift();
        historyIndex = history.length - 1;
      }
    }

    function restoreHtml(html) {
      var root = getRoot();
      if (root === body) {
        body.innerHTML = html;
      } else {
        var container = doc.createElement('div');
        container.innerHTML = html;
        var next = container.firstElementChild;
        if (next && root.parentElement) {
          root.parentElement.replaceChild(next, root);
        }
      }
      selected = null;
      ensureUi();
      markTargets();
      setOverlayVisible(false);
    }

    function getSvgContentsRect(svgEl) {
      if (!svgEl || !svgEl.querySelectorAll) return null;
      var nodes = svgEl.querySelectorAll('*');
      var minLeft = Infinity;
      var minTop = Infinity;
      var maxRight = -Infinity;
      var maxBottom = -Infinity;
      for (var i = 0; i < nodes.length; i += 1) {
        var node = nodes[i];
        if (!node || !node.getBoundingClientRect) continue;
        if (node.tagName && node.tagName.toLowerCase() === 'svg') continue;
        if (!isSvgGraphics(node)) continue;
        var rect = node.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) continue;
        minLeft = Math.min(minLeft, rect.left);
        minTop = Math.min(minTop, rect.top);
        maxRight = Math.max(maxRight, rect.right);
        maxBottom = Math.max(maxBottom, rect.bottom);
      }
      if (minLeft === Infinity) return null;
      return {
        left: minLeft,
        top: minTop,
        width: Math.max(0, maxRight - minLeft),
        height: Math.max(0, maxBottom - minTop),
        right: maxRight,
        bottom: maxBottom
      };
    }

    markTargets();
    ensureUi();
    setOverlayVisible(false);
    pushHistory(getRootHtml(getRoot()));

    doc.addEventListener('mousedown', onMouseDown, true);
    doc.addEventListener('mousemove', onMouseMove, true);
    doc.addEventListener('mouseup', finishDrag, true);
    window.addEventListener('resize', updateOverlay);
    window.addEventListener('scroll', updateOverlay, true);
    doc.addEventListener('keydown', onKeyDown, true);

    Object.keys(handles).forEach(function (key) {
      handles[key].addEventListener('mousedown', onHandleDown, true);
    });
  })();
`;

const sanitizeImageAlts = (root: ParentNode) => {
  const images = root.querySelectorAll('img');
  images.forEach(img => {
    if (img.alt && (img.alt.includes('http') || img.alt.includes('/') || img.alt.length > 20)) {
      img.alt = '';
    }
  });
};

const fixTextUrlBlocks = (root: ParentNode) => {
  const elements = Array.from(root.querySelectorAll('*'));
  elements.forEach(el => {
    if (!(el instanceof HTMLElement)) return;
    if (el.children.length > 0) return;
    if (el.tagName.toLowerCase() === 'a') return;

    const text = (el.textContent || '').trim();
    if (!URL_TEXT_RE.test(text)) return;

    const style = el.style;
    const hasBgImage = style.backgroundImage && style.backgroundImage !== 'none';

    if (!hasBgImage) {
      style.backgroundImage = `url("${text}")`;
      style.backgroundSize = 'cover';
      style.backgroundPosition = 'center';
      style.backgroundRepeat = 'no-repeat';
    }

    el.textContent = '';
  });
};

const parseArtifactMode = (value?: string | null): ArtifactMode | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase() as ArtifactMode;
  const allowed: ArtifactMode[] = [
    'auto',
    'slides',
    'icons',
    'patterns',
    'textures',
    'type-specimen',
    'ui-modules',
    'covers',
    'posters',
    'grids',
    'dividers',
    'mixed'
  ];
  return allowed.includes(normalized) ? normalized : null;
};

const inferArtifactModeFromTopic = (topic: string): ArtifactMode => {
  const normalized = topic.toLowerCase();
  if (/(slide|slides|storyboard|story board|title sequence|frame|frames|sequence)/i.test(normalized)) {
    return 'slides';
  }
  return 'auto';
};

const normalizeArtifactClassOrder = (
  root: HTMLElement,
  index: number,
  includeSlideClass: boolean
) => {
  const keptClasses = Array.from(root.classList).filter(
    cls =>
      cls !== 'slide' &&
      cls !== 'artifact' &&
      !/^slide-\d+$/.test(cls) &&
      !/^artifact-\d+$/.test(cls)
  );
  const hasSlideClass = includeSlideClass || root.classList.contains('slide');
  const classes = [
    ...(hasSlideClass ? [`slide-${index}`, 'slide'] : []),
    `artifact-${index}`,
    'artifact',
    ...keptClasses
  ];
  root.setAttribute('class', classes.join(' '));
};

const applyArtifactIndexClass = (html: string, index: number, includeSlideClass: boolean) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const root =
    doc.querySelector('.artifact') ||
    doc.querySelector('.slide') ||
    doc.body.firstElementChild;
  if (!root || !(root instanceof HTMLElement)) return html;

  normalizeArtifactClassOrder(root, index, includeSlideClass);
  return root.outerHTML;
};

const collectArtifactElements = (doc: Document) => {
  const body = doc.body;
  const bodyArtifacts = Array.from(body.children).filter(
    child => child instanceof HTMLElement && child.classList.contains('artifact')
  ) as HTMLElement[];
  if (bodyArtifacts.length > 0) return bodyArtifacts;

  const allArtifacts = Array.from(body.querySelectorAll('.artifact')) as HTMLElement[];
  if (allArtifacts.length > 0) return allArtifacts;

  const bodySlides = Array.from(body.children).filter(
    child => child instanceof HTMLElement && child.classList.contains('slide')
  ) as HTMLElement[];
  if (bodySlides.length > 0) return bodySlides;

  const allSlides = Array.from(body.querySelectorAll('.slide')) as HTMLElement[];
  if (allSlides.length > 0) return allSlides;

  const container = body.querySelector('.presentation-container');
  if (container) {
    const containerSections = Array.from(container.children).filter(
      child => child instanceof HTMLElement && child.tagName.toLowerCase() === 'section'
    ) as HTMLElement[];
    if (containerSections.length > 0) return containerSections;
  }

  const directSections = Array.from(body.children).filter(
    child => child instanceof HTMLElement && child.tagName.toLowerCase() === 'section'
  ) as HTMLElement[];
  if (directSections.length > 0) return directSections;

  const allSections = Array.from(body.querySelectorAll('section')) as HTMLElement[];
  if (allSections.length > 0) return allSections;

  const idSlides = Array.from(body.querySelectorAll('[id^="slide-"]')) as HTMLElement[];
  if (idSlides.length > 0) return idSlides;

  return [];
};

const reindexArtifactClasses = (artifactHtmls: string[], includeSlideClass: boolean) => {
  return artifactHtmls.map((html, i) => applyArtifactIndexClass(html, i + 1, includeSlideClass));
};

  const sanitizeLayout = (root: ParentNode) => {
    const uiNodes = root.querySelectorAll('[data-ae2-ui="true"]');
    uiNodes.forEach(node => {
      if (node.parentElement) {
        node.parentElement.removeChild(node);
      }
    });
    const scripts = root.querySelectorAll('script');
    scripts.forEach(script => {
      const text = script.textContent || '';
      if (text.includes('__ae2PreviewEditor') || text.includes('ae2-preview-editor')) {
        if (script.parentElement) {
          script.parentElement.removeChild(script);
        }
      }
    });
    sanitizeImageAlts(root);
    fixTextUrlBlocks(root);
    const artifacts = root.querySelectorAll('.artifact, .slide');
    artifacts.forEach(el => {
      if (!(el instanceof HTMLElement)) return;
    if (el.style.transform) {
      el.style.transform = '';
    }
    if (el.style.transformOrigin) {
      el.style.transformOrigin = '';
    }
  });
};

const normalizeTags = (value: string) => {
  const parts = value
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
  return parts.join(', ');
};

const parseHeadMetadata = (headHtml: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<html><head>${headHtml}</head><body></body></html>`,
    'text/html'
  );
  const metaTitle = doc.querySelector('meta[name="project-title"]') as HTMLMetaElement | null;
  const metaTags = doc.querySelector('meta[name="tags"]') as HTMLMetaElement | null;
  const metaDescription = doc.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  const metaArtifactMode = doc.querySelector('meta[name="artifact-mode"]') as HTMLMetaElement | null;
  const titleEl = doc.querySelector('title');
  const title = (metaTitle?.content || titleEl?.textContent || '').trim();
  const tags = (metaTags?.content || '').trim();
  const description = (metaDescription?.content || '').trim();
  const artifactMode = parseArtifactMode(metaArtifactMode?.content);
  return { title, tags, description, artifactMode };
};

const stripRuntimeHead = (headHtml: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<html><head>${headHtml}</head><body></body></html>`,
    'text/html'
  );
  const head = doc.head;
  const nodes = Array.from(head.querySelectorAll('style, script'));
  nodes.forEach(node => {
    const marker = node.getAttribute('data-ae2-runtime');
    const text = node.textContent || '';
    const isRuntimeStyle =
      node.tagName.toLowerCase() === 'style' &&
      (marker === 'true' ||
        text.includes('html, body { width: 100%; height: 100%;') ||
        text.includes('.artifact, .slide {overflow: hidden') ||
        text.includes('FALLBACK'));
    const isRuntimeScript =
      node.tagName.toLowerCase() === 'script' &&
      (marker === 'true' ||
        text.includes('window.addEventListener(\'error\'') ||
        text.includes('data:image/svg+xml'));
    if (isRuntimeStyle || isRuntimeScript) {
      node.parentElement?.removeChild(node);
    }
  });
  return head.innerHTML;
};

const buildPersistedHtml = (headHtml: string, artifactHtmls: string[]) => {
  const cleanHead = stripRuntimeHead(headHtml);
  return `<!DOCTYPE html>
      <html>
        <head>${cleanHead}</head>
        <body>
          ${artifactHtmls.join('\n')}
        </body>
      </html>
    `;
};

const hashString = (value: string) => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return hash >>> 0;
};

const updateHeadMetadata = (headHtml: string, title: string, tags: string, description: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<html><head>${headHtml}</head><body></body></html>`,
    'text/html'
  );
  const head = doc.head;
  const titleValue = title.trim();
  const tagsValue = normalizeTags(tags);
  const descriptionValue = description.trim();
  const titleEl = head.querySelector('title') || head.appendChild(doc.createElement('title'));
  titleEl.textContent = titleValue;

  const ensureMeta = (name: string, content: string) => {
    let meta = head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
    if (!meta) {
      meta = doc.createElement('meta');
      meta.setAttribute('name', name);
      head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  ensureMeta('project-title', titleValue);
  ensureMeta('tags', tagsValue);
  ensureMeta('keywords', tagsValue);
  ensureMeta('description', descriptionValue);
  return head.innerHTML;
};

type RootVarEntry = {
  name: string;
  value: string;
};

const extractRootVariables = (headHtml: string): RootVarEntry[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<html><head>${headHtml}</head><body></body></html>`,
    'text/html'
  );
  const styles = Array.from(doc.head.querySelectorAll('style'));
  const css = styles.map(style => style.textContent || '').join('\n');
  const rootBlocks = css.match(/:root\s*{[\s\S]*?}/gi) || [];
  const entries: RootVarEntry[] = [];
  rootBlocks.forEach(block => {
    const content = block.replace(/:root\s*{|}$/gi, '');
    const varRe = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m: RegExpExecArray | null;
    while ((m = varRe.exec(content))) {
      entries.push({ name: m[1], value: m[2].trim() });
    }
  });
  return entries;
};

const buildRootBlock = (rootContent: string | null, updates: Record<string, string>) => {
  const entries: string[] = [];
  const used = new Set<string>();
  if (rootContent) {
    const varRe = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m: RegExpExecArray | null;
    while ((m = varRe.exec(rootContent))) {
      const name = m[1];
      const value = updates[name] ?? m[2].trim();
      entries.push(`  --${name}: ${value};`);
      used.add(name);
    }
  }
  Object.entries(updates).forEach(([name, value]) => {
    if (used.has(name)) return;
    entries.push(`  --${name}: ${value};`);
  });
  return `:root {\n${entries.join('\n')}\n}\n`;
};

const updateRootVariablesInHead = (headHtml: string, updates: Record<string, string>) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<html><head>${headHtml}</head><body></body></html>`,
    'text/html'
  );
  const styles = Array.from(doc.head.querySelectorAll('style'));
  let targetStyle = styles.find(style => /:root\s*{[\s\S]*?}/i.test(style.textContent || ''));
  if (!targetStyle) {
    targetStyle = doc.createElement('style');
    targetStyle.textContent = buildRootBlock(null, updates);
    doc.head.appendChild(targetStyle);
    return doc.head.innerHTML;
  }
  const styleText = targetStyle.textContent || '';
  const rootMatch = styleText.match(/:root\s*{([\s\S]*?)}/i);
  if (!rootMatch) {
    targetStyle.textContent = `${styleText}\n${buildRootBlock(null, updates)}`;
    return doc.head.innerHTML;
  }
  const updatedRoot = buildRootBlock(rootMatch[1], updates).trim();
  targetStyle.textContent = styleText.replace(/:root\s*{[\s\S]*?}/i, updatedRoot);
  return doc.head.innerHTML;
};

const normalizeHex = (value: string) => {
  const match = value.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i);
  if (!match) return null;
  const hex = match[0];
  if (hex.length === 4) {
    const r = hex[1];
    const g = hex[2];
    const b = hex[3];
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return hex.toLowerCase();
};

const normalizeColorToHex = (value?: string | null) => {
  if (!value) return null;
  const hex = normalizeHex(value);
  if (hex) return hex;
  const rgbMatch = value.match(
    /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)/i
  );
  if (!rgbMatch) return null;
  const clamp = (n: number) => Math.min(255, Math.max(0, n));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0');
  const r = Number(rgbMatch[1]);
  const g = Number(rgbMatch[2]);
  const b = Number(rgbMatch[3]);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const LAST_ARTIFACT_KEY = 'ae2:lastArtifactId';

type HistorySnapshot = {
  headContent: string;
  artifacts: string[];
  currentArtifactIndex: number;
  artifactMode: ArtifactMode;
};

export const ArtifactGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [headContent, setHeadContent] = useState<string>('');
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0);
  const [animationsEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProviderName>('gemini');
  
  const [loading, setLoading] = useState(false);
  const [regeneratingArtifact, setRegeneratingArtifact] = useState(false);
  const [addingArtifact, setAddingArtifact] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [regenerateMode, setRegenerateMode] = useState<'slide' | 'project'>('slide');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedJsonArtifact, setCopiedJsonArtifact] = useState(false);
  const [copiedJsonProject, setCopiedJsonProject] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [imageProvider, setImageProvider] = useState<ImageProviderName>('random');
  const [artifactMode, setArtifactMode] = useState<ArtifactMode>('slides');
  const includeSlideClass = artifactMode === 'slides' || artifactMode === 'mixed';
  const [codeDraft, setCodeDraft] = useState('');
  const [isCodeDirty, setIsCodeDirty] = useState(false);
  const [exportResolution, setExportResolution] = useState(RESOLUTION_OPTIONS[2]);
  const [exportFps, setExportFps] = useState<number>(30);
  const [exportDuration, setExportDuration] = useState<number>(10);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectTags, setProjectTags] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [descriptionDraft, setDescriptionDraft] = useState('');
  const [previewSize, setPreviewSize] = useState({
    width: PREVIEW_BASE_WIDTH,
    height: PREVIEW_BASE_HEIGHT
  });
  const [previewScale, setPreviewScale] = useState(1);
  const [previewHtml, setPreviewHtml] = useState('');
  const [historyItems, setHistoryItems] = useState<ArtifactHistoryItem[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const exportIframeRef = useRef<HTMLIFrameElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const prevViewModeRef = useRef<ViewMode>(viewMode);
  const suppressPreviewReloadRef = useRef(false);
  const historySkipCountRef = useRef(0);
  const historyUpdateTimerRef = useRef<number | null>(null);
  const pendingSaveDelayRef = useRef<number | null>(null);
  const lastSavedHashRef = useRef<number | null>(null);
  const suppressAutoSelectRef = useRef(false);
  const historyRef = useRef<{ past: HistorySnapshot[]; future: HistorySnapshot[] }>({
    past: [],
    future: []
  });
  const historyTimerRef = useRef<number | null>(null);
  const applyingHistoryRef = useRef(false);
  const historyImmediateNextRef = useRef(false);
  const historySuspendUntilRef = useRef(0);
  const historyLastHashRef = useRef<number | null>(null);
  const generateRequestIdRef = useRef(0);
  const regenerateRequestIdRef = useRef(0);
  const addArtifactRequestIdRef = useRef(0);

  useEffect(() => {
    const container = previewStageRef.current;
    if (!container) return;

    const updateScale = () => {
      const { width } = container.getBoundingClientRect();
      if (width <= 0) return;
      const nextScale = Math.min(width / PREVIEW_BASE_WIDTH, 1);
      setPreviewScale(nextScale);
      setPreviewSize({
        width: PREVIEW_BASE_WIDTH * nextScale,
        height: PREVIEW_BASE_HEIGHT * nextScale
      });
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    return () => observer.disconnect();
  }, [artifacts.length]);

  useEffect(() => {
    loadHistory();
  }, []);


  useEffect(() => {
    const { title, tags, description, artifactMode: headMode } = parseHeadMetadata(headContent);
    if (!editingTitle) {
      setProjectTitle(title);
      setTitleDraft(title);
    }
    if (!editingTags) {
      setProjectTags(tags);
      setTagsDraft(tags);
    }
    if (!editingDescription) {
      setProjectDescription(description);
      setDescriptionDraft(description);
    }
    if (headMode && headMode !== 'auto' && headMode !== artifactMode) {
      setArtifactMode(headMode);
    }
  }, [headContent, editingTitle, editingTags, editingDescription, artifactMode]);

  const getHistoryHash = (snapshot: HistorySnapshot) =>
    hashString(
      `${snapshot.headContent}::${snapshot.artifacts.join('')}::${snapshot.currentArtifactIndex}::${snapshot.artifactMode}`
    );

  const applyHistorySnapshot = (snapshot: HistorySnapshot) => {
    applyingHistoryRef.current = true;
    historySuspendUntilRef.current = Date.now() + 80;
    historyLastHashRef.current = getHistoryHash(snapshot);
    setHeadContent(snapshot.headContent);
    setArtifacts(snapshot.artifacts);
    setCurrentArtifactIndex(snapshot.currentArtifactIndex);
    setArtifactMode(snapshot.artifactMode);
    if (viewMode === 'code' && !isCodeDirty) {
      setCodeDraft(buildAllArtifactsHtml(snapshot.headContent, snapshot.artifacts));
    }
  };

  const queueHistorySnapshot = (snapshot: HistorySnapshot, immediate = false) => {
    if (applyingHistoryRef.current) return;
    if (Date.now() < historySuspendUntilRef.current) return;
    const hash = getHistoryHash(snapshot);
    if (historyLastHashRef.current === hash) return;

    if (historyTimerRef.current) {
      window.clearTimeout(historyTimerRef.current);
    }

    const commit = () => {
      const history = historyRef.current;
      const last = history.past[history.past.length - 1];
      const lastHash = last ? getHistoryHash(last) : null;
      if (lastHash === hash) return;
      history.past.push(snapshot);
      if (history.past.length > 60) {
        history.past.shift();
      }
      history.future = [];
      historyLastHashRef.current = hash;
    };

    if (immediate) {
      commit();
    } else {
      historyTimerRef.current = window.setTimeout(commit, 150);
    }
  };

  const performUndo = () => {
    const history = historyRef.current;
    if (history.past.length <= 1) return;
    const current = history.past.pop() as HistorySnapshot;
    history.future.push(current);
    const previous = history.past[history.past.length - 1];
    applyHistorySnapshot(previous);
  };

  const performRedo = () => {
    const history = historyRef.current;
    if (history.future.length === 0) return;
    const next = history.future.pop() as HistorySnapshot;
    history.past.push(next);
    applyHistorySnapshot(next);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isEditable) return;

      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        (event.code === 'KeyZ' || String(event.key).toLowerCase() === 'z');
      const isRedo =
        (event.ctrlKey || event.metaKey) &&
        ((event.shiftKey && (event.code === 'KeyZ' || String(event.key).toLowerCase() === 'z')) ||
          event.code === 'KeyY');

      if (!isUndo && !isRedo) return;

      if (isUndo) {
        event.preventDefault();
        performUndo();
        return;
      }

      event.preventDefault();
      performRedo();
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isCodeDirty, viewMode]);

  useEffect(() => {
    if (!headContent && artifacts.length === 0) return;

    const snapshot: HistorySnapshot = {
      headContent,
      artifacts,
      currentArtifactIndex,
      artifactMode
    };
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      historySuspendUntilRef.current = Date.now() + 80;
      return;
    }
    const immediate = historyImmediateNextRef.current;
    historyImmediateNextRef.current = false;
    queueHistorySnapshot(snapshot, immediate);

    return () => {
      if (historyTimerRef.current) {
        window.clearTimeout(historyTimerRef.current);
      }
    };
  }, [headContent, artifacts, currentArtifactIndex, artifactMode]);

  useEffect(() => {
    if (!currentHistoryId || artifacts.length === 0) return;
    if (!getAuthToken()) return;
    if (historySkipCountRef.current > 0) {
      historySkipCountRef.current -= 1;
      return;
    }

    const name = (projectTitle || '').trim() || 'Untitled Project';
    const responseHtml = buildPersistedHtml(headContent, artifacts);
    const responseHash = hashString(responseHtml);
    if (lastSavedHashRef.current === responseHash) {
      return;
    }

    if (historyUpdateTimerRef.current) {
      window.clearTimeout(historyUpdateTimerRef.current);
    }

    const delay = pendingSaveDelayRef.current ?? 1200;
    pendingSaveDelayRef.current = null;
    historyUpdateTimerRef.current = window.setTimeout(async () => {
      try {
        const updated = await updateArtifactHistory(currentHistoryId, {
          name,
          response: responseHtml
        });
        lastSavedHashRef.current = responseHash;
        setHistoryItems(prev =>
          prev.map(item =>
            item.id === updated.id
              ? {
                  ...item,
                  name: updated.name,
                  updatedAt: updated.updatedAt
                }
              : item
          )
        );
      } catch (error) {
        console.error(error);
      }
    }, 1200);

    return () => {
      if (historyUpdateTimerRef.current) {
        window.clearTimeout(historyUpdateTimerRef.current);
      }
    };
  }, [headContent, artifacts, projectTitle, currentHistoryId]);

  const parseAndSetHtml = (html: string, preserveIndex = false) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    sanitizeLayout(doc);

    const sections = collectArtifactElements(doc);
    const { artifactMode: headMode } = parseHeadMetadata(doc.head.innerHTML);
    const hasSlideClass = sections.some(section => section.classList.contains('slide'));
    const resolvedMode = hasSlideClass
      ? 'slides'
      : headMode && headMode !== 'auto'
        ? headMode
        : 'mixed';
    const resolvedIncludeSlides = resolvedMode === 'slides' || resolvedMode === 'mixed';
    
    // Inject global reset for strict 16:9
    const style = doc.createElement('style');
    style.setAttribute('data-ae2-runtime', 'true');
    style.innerHTML = `
      html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
      body { background: #000; display: flex; align-items: center; justify-content: center; }
      /* Ensure artifacts fit the iframe bounds (container already keeps 16:9). */
      .artifact, .slide {overflow: hidden; position: relative; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; margin-bottom: 0 !important; transform: none !important; transform-origin: initial !important; }
      /* Fallback styling for images */
      img {
        /* Hide alt text by making it transparent */
        color: transparent; 
        /* Ensure there is a background if image fails to load immediately */
        background-color: #262626;
        /* Hide the broken image icon in some browsers */
        text-indent: -10000px;
      }
    `;
    doc.head.appendChild(style);

    // Inject error handling script for images (Runtime fallback)
    const script = doc.createElement('script');
    script.setAttribute('data-ae2-runtime', 'true');
    script.innerHTML = `
      // Capture error events on images during the loading phase
      window.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG') {
          // Prevent infinite loop if the placeholder fails (unlikely for data URI)
          e.target.onerror = null;
          
          // Replace source with a generated SVG placeholder
          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100%25" height="100%25" preserveAspectRatio="none"%3E%3Crect width="100%25" height="100%25" fill="%23262626"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" fill="%23525252" font-size="14" font-weight="bold"%3EIMAGE%3C/text%3E%3C/svg%3E';
          
          // Ensure styles match a "filled" block
          e.target.style.display = 'block';
          e.target.style.objectFit = 'cover';
          e.target.style.width = '100%';
          e.target.style.height = '100%';
          e.target.style.minHeight = '100%';
          
          // Clear alt text to ensure no text overlay
          e.target.alt = '';
        }
      }, true);
    `;
    doc.head.appendChild(script);

    const nextIndex = preserveIndex
      ? Math.min(currentArtifactIndex, Math.max(0, sections.length - 1))
      : 0;

      if (sections.length > 0) {
        const nextHead = doc.head.innerHTML;
        const artifactHtmls = sections.map((section, i) => {
          normalizeArtifactClassOrder(section, i + 1, resolvedIncludeSlides);
          return section.outerHTML;
        });
        historyRef.current = { past: [], future: [] };
        historyLastHashRef.current = null;
        setHeadContent(nextHead);
        setArtifacts(artifactHtmls);
        setCurrentArtifactIndex(nextIndex);
        setArtifactMode(resolvedMode);
        return { headHtml: nextHead, artifacts: artifactHtmls, resolvedMode };
      } else {
        const nextHead = doc.head.innerHTML;
        const fallbackHtml = doc.body.innerHTML.trim();
        const wrapped = `<section class="artifact">${fallbackHtml || ''}</section>`;
        historyRef.current = { past: [], future: [] };
        historyLastHashRef.current = null;
        setHeadContent(nextHead);
        setArtifacts([wrapped]);
        setCurrentArtifactIndex(0);
        setArtifactMode(resolvedMode);
        return { headHtml: nextHead, artifacts: [wrapped], resolvedMode };
      }
  };

  const extractImageUrlsFromHtml = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const imgs = Array.from(doc.querySelectorAll('img')).map(img => img.src);
    const elementsWithStyle = doc.querySelectorAll('[style*="background-image"]');
    const bgImages = Array.from(elementsWithStyle).map(el => {
       const style = el.getAttribute('style');
       const match = style?.match(/url\(['"]?(.*?)['"]?\)/);
       return match ? match[1] : null;
    }).filter(Boolean) as string[];
    return [...new Set([...imgs, ...bgImages])];
  };

  const getUsedImageUrls = () => {
    if (artifacts.length === 0) return [];
    const allHtml = artifacts.join('');
    return extractImageUrlsFromHtml(allHtml);
  };

  const getCssContext = () => {
    const styleMatch = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
    return styleMatch ? styleMatch[1] : '';
  };

  const loadHistory = async () => {
    if (!getAuthToken()) {
      setHistoryItems([]);
      setHistoryError('Sign in to load artifacts.');
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const items = await listArtifactHistory(50);
      setHistoryItems(items);
      if (suppressAutoSelectRef.current) {
        suppressAutoSelectRef.current = false;
        return;
      }
      if (!currentHistoryId && items.length > 0) {
        const savedId =
          typeof window !== 'undefined' ? window.localStorage.getItem(LAST_ARTIFACT_KEY) : null;
        const candidate = savedId && items.some(item => item.id === savedId) ? savedId : items[0].id;
        if (candidate) {
          await handleHistorySelect(candidate);
        }
      }
    } catch (error: any) {
      console.error(error);
      setHistoryError('Failed to load saved artifacts.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveHistorySnapshot = async (
    nextArtifacts: string[] = artifacts,
    nextHead: string = headContent,
    nameOverride?: string
  ) => {
    if (!currentHistoryId || nextArtifacts.length === 0) return;
    if (!getAuthToken()) return;
    const nameSource = nameOverride != null ? nameOverride : (projectTitle || '');
    const name = nameSource.trim() || 'Untitled Project';
    const responseHtml = buildPersistedHtml(nextHead, nextArtifacts);
    const responseHash = hashString(responseHtml);
    if (lastSavedHashRef.current === responseHash) return;

    try {
      const updated = await updateArtifactHistory(currentHistoryId, {
        name,
        response: responseHtml
      });
      lastSavedHashRef.current = responseHash;
      setHistoryItems(prev =>
        prev.map(item =>
          item.id === updated.id
            ? {
                ...item,
                name: updated.name,
                updatedAt: updated.updatedAt
              }
            : item
        )
      );
    } catch (error) {
      console.error(error);
      setHistoryError('Failed to update artifact.');
    }
  };

  const handleHistorySelect = async (id: string) => {
    if (!id || id === currentHistoryId) return;
    setHistoryError(null);
    try {
      const detail = await getArtifactHistory(id);
      if (!detail?.response) return;
      historySkipCountRef.current = 3;
      setCurrentHistoryId(id);
      historyRef.current = { past: [], future: [] };
      historyLastHashRef.current = null;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(LAST_ARTIFACT_KEY, id);
      }
      lastSavedHashRef.current = hashString(detail.response);
      parseAndSetHtml(detail.response);
      setTopic(detail.prompt || '');
      setProvider(detail.provider);
    } catch (error: any) {
      console.error(error);
      setHistoryError('Failed to load selected artifact.');
    }
  };

  const handleHistoryDelete = async (id: string) => {
    if (!id) return;
    const confirmed = window.confirm('Delete this saved artifact?');
    if (!confirmed) return;
    try {
      await deleteArtifactHistory(id);
      setHistoryItems(prev => prev.filter(item => item.id !== id));
      if (currentHistoryId === id) {
        handleNewChat();
      }
    } catch (error: any) {
      console.error(error);
      setHistoryError('Failed to delete artifact.');
    }
  };

  const handleNewChat = () => {
    suppressAutoSelectRef.current = true;
    setCurrentHistoryId(null);
    lastSavedHashRef.current = null;
    historyRef.current = { past: [], future: [] };
    historyLastHashRef.current = null;
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(LAST_ARTIFACT_KEY);
    }
    setArtifacts([]);
    setHeadContent('');
    setCurrentArtifactIndex(0);
    setProjectTitle('');
    setProjectTags('');
    setProjectDescription('');
    setTitleDraft('');
    setTagsDraft('');
    setDescriptionDraft('');
    setTopic('');
    setChatImage(null);
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim() && !chatImage) return;

    const requestId = ++generateRequestIdRef.current;
    const promptText =
      topic.trim() ||
      'Use the attached image as the primary reference. If no confident change is possible, return the HTML unchanged.';
    const requestedMode = inferArtifactModeFromTopic(promptText);
    if (!currentHistoryId) {
      setArtifactMode(requestedMode);
    }
    setTopic('');
    const imageData = chatImage;
    setChatImage(null);
    setLoading(true);
    if (!currentHistoryId) {
      setArtifacts([]);
      setHeadContent('');
    }
    setErrorMsg(null);
    try {
      const contextHtml =
        currentHistoryId && artifacts.length > 0
          ? buildPersistedHtml(headContent, artifacts)
          : undefined;
      const generatedHtml = contextHtml
        ? await updateArtifactsFromContext(
            provider,
            promptText,
            artifactMode,
            contextHtml,
            imageProvider,
            imageData
          )
        : await generateArtifacts(
            provider,
            promptText,
            requestedMode,
            imageProvider,
            undefined,
            imageData
          );
      if (requestId !== generateRequestIdRef.current) return;
      historyImmediateNextRef.current = true;
      const parsed = parseAndSetHtml(generatedHtml, Boolean(contextHtml));
      if (parsed && getAuthToken()) {
        const { title } = parseHeadMetadata(parsed.headHtml);
        const name = (title || projectTitle || promptText).trim() || 'Untitled Project';
        const responseHtml = buildPersistedHtml(parsed.headHtml, parsed.artifacts);

        if (!currentHistoryId) {
          const created = await createArtifactHistory({
            name,
            provider,
            prompt: promptText,
            response: responseHtml
          });
          historySkipCountRef.current = 1;
          setCurrentHistoryId(created.id);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(LAST_ARTIFACT_KEY, created.id);
          }
          lastSavedHashRef.current = hashString(responseHtml);
          setHistoryItems(prev => {
            const next = [created, ...prev.filter(item => item.id !== created.id)];
            return next;
          });
        } else {
          const updated = await updateArtifactHistory(currentHistoryId, {
            name,
            provider,
            prompt: promptText,
            response: responseHtml
          });
          lastSavedHashRef.current = hashString(responseHtml);
          setHistoryItems(prev =>
            prev.map(item =>
              item.id === updated.id
                ? {
                    ...item,
                    name: updated.name,
                    prompt: updated.prompt,
                    updatedAt: updated.updatedAt,
                    provider: updated.provider
                  }
                : item
            )
          );
        }
      }
    } catch (error: any) {
      console.error(error);
      if (error?.status === 429 || error?.message?.includes('429')) {
        setErrorMsg("We're experiencing high traffic. Please wait a moment and try again.");
      } else {
        setErrorMsg("Failed to generate artifacts. Please try again.");
      }
    } finally {
      if (requestId === generateRequestIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const regenerateSingleArtifact = async (index: number, excludedImages: string[], cssContext: string) => {
    const currentContent = artifacts[index];
    const newArtifactHtml = await regenerateArtifact(
      provider,
      topic,
      currentContent,
      cssContext,
      excludedImages,
      artifactMode,
      imageProvider
    );
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newArtifactHtml;
    sanitizeLayout(tempDiv);
    return tempDiv.innerHTML;
  };

  const handleRegenerateCurrentArtifact = async () => {
    if (artifacts.length === 0) return;
    const requestId = ++regenerateRequestIdRef.current;
    setRegeneratingArtifact(true);
    try {
      pendingSaveDelayRef.current = 200;
      if (regenerateMode === 'project') {
        const cssContext = getCssContext();
        const nextArtifacts = [...artifacts];
        const used = new Set<string>();

        for (let i = 0; i < artifacts.length; i += 1) {
          const excluded = Array.from(used);
          const regenerated = await regenerateSingleArtifact(i, excluded, cssContext);
          if (requestId !== regenerateRequestIdRef.current) return;
          nextArtifacts[i] = regenerated;
          extractImageUrlsFromHtml(regenerated).forEach(url => used.add(url));
        }

        historyImmediateNextRef.current = true;
        setArtifacts(reindexArtifactClasses(nextArtifacts, includeSlideClass));
        await saveHistorySnapshot(reindexArtifactClasses(nextArtifacts, includeSlideClass));
        return;
      }

      const excluded = getUsedImageUrls();
      const cssContext = getCssContext();
      const regenerated = await regenerateSingleArtifact(currentArtifactIndex, excluded, cssContext);
      if (requestId !== regenerateRequestIdRef.current) return;
      const newArtifacts = [...artifacts];
      newArtifacts[currentArtifactIndex] = regenerated;
      const reindexed = reindexArtifactClasses(newArtifacts, includeSlideClass);
      historyImmediateNextRef.current = true;
      setArtifacts(reindexed);
      await saveHistorySnapshot(reindexed);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === regenerateRequestIdRef.current) {
        setRegeneratingArtifact(false);
      }
    }
  };

  const handleAddArtifact = async () => {
    if (artifacts.length === 0) return;
    const requestId = ++addArtifactRequestIdRef.current;
    setAddingArtifact(true);
    try {
      pendingSaveDelayRef.current = 200;
      const excluded = getUsedImageUrls();
      const styleMatch = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      const cssContext = styleMatch ? styleMatch[1] : '';

      const newArtifactHtml = await generateNewArtifact(
        provider,
        topic,
        cssContext,
        excluded,
        artifactMode,
        imageProvider
      );
      if (requestId !== addArtifactRequestIdRef.current) return;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newArtifactHtml;
      sanitizeLayout(tempDiv);
      
      const newArtifacts = reindexArtifactClasses(
        [...artifacts, tempDiv.innerHTML],
        includeSlideClass
      );
      historyImmediateNextRef.current = true;
      setArtifacts(newArtifacts);
      setCurrentArtifactIndex(newArtifacts.length - 1);
      await saveHistorySnapshot(newArtifacts);
      
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === addArtifactRequestIdRef.current) {
        setAddingArtifact(false);
      }
    }
  };

  const handleDeleteArtifact = () => {
    if (artifacts.length <= 1) return;
    pendingSaveDelayRef.current = 200;
    const newArtifacts = reindexArtifactClasses(
      artifacts.filter((_, i) => i !== currentArtifactIndex),
      includeSlideClass
    );
    setArtifacts(newArtifacts);
    void saveHistorySnapshot(newArtifacts);
    if (currentArtifactIndex >= newArtifacts.length) {
      setCurrentArtifactIndex(newArtifacts.length - 1);
    }
  };

  const handlePrevArtifact = () => {
    setCurrentArtifactIndex(prev => (prev === 0 ? artifacts.length - 1 : prev - 1));
  };

  const handleNextArtifact = () => {
    setCurrentArtifactIndex(prev => (prev === artifacts.length - 1 ? 0 : prev + 1));
  };

  const getHeadHtml = (headOverride = headContent) => {
    const base = headOverride.trim();
    const forceArtifactMarginReset = `<style>
      .artifact, .slide { margin-bottom: 0 !important; }
    </style>`;
    if (!animationsEnabled) {
      return `${base}<style>
            /* FORCE DISABLE ANIMATIONS - STRICT STATIC MODE */
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
          </style>${forceArtifactMarginReset}`;
    }
    return `${base}${forceArtifactMarginReset}`;
  };

  const buildArtifactHtml = (headHtml: string, artifactHtml: string) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>${headHtml}</head>
        <body>
          ${artifactHtml}
        </body>
      </html>
    `;
  };

  const buildPreviewHtml = (headHtml: string, artifactHtml: string, index: number) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${headHtml}
          <style>${PREVIEW_EDITOR_STYLE}</style>
        </head>
        <body data-ae2-artifact-index="${index}">
          ${artifactHtml}
          <script>${PREVIEW_EDITOR_SCRIPT}</script>
        </body>
      </html>
    `;
  };

  const getArtifactHtmlByIndex = (index: number) => {
    if (artifacts.length === 0) return '';
    return buildArtifactHtml(getHeadHtml(), artifacts[index]);
  };

  const loadArtifactIntoExportIframe = (index: number) => {
    return new Promise<Window>((resolve, reject) => {
      const iframe = exportIframeRef.current;
      if (!iframe) {
        reject(new Error('Missing export iframe.'));
        return;
      }

      const handleLoad = () => {
        iframe.removeEventListener('load', handleLoad);
        if (!iframe.contentWindow) {
          reject(new Error('Missing iframe contentWindow.'));
          return;
        }

        requestAnimationFrame(() => {
          resolve(iframe.contentWindow as Window);
        });
      };

      iframe.addEventListener('load', handleLoad);
      const html = `
        <!DOCTYPE html>
        <html>
          <head>${getHeadHtml()}</head>
          <body>
            ${artifacts[index]}
          </body>
        </html>
      `;
      iframe.srcdoc = html;
    });
  };

  const extractJsonFromIframe = async (win: Window) => {
    const doc = win.document;
    const artifactElement = doc.querySelector('.artifact') || doc.querySelector('.slide') || doc.body;

    if (!artifactElement) {
      throw new Error('Could not find artifact content to export.');
    }

    sanitizeLayout(artifactElement);
    return extractArtifactLayout(artifactElement as HTMLElement, win, {
      targetWidth: exportResolution.width,
      targetHeight: exportResolution.height,
      fps: exportFps,
      duration: exportDuration,
      useViewportScale: artifactMode !== 'slides',
      resolutionLabel: exportResolution.label
    });
  };

  const handleExportArtifactJSON = async () => {
    if (artifacts.length === 0) return;
    
    try {
      const win = await loadArtifactIntoExportIframe(currentArtifactIndex);
      const jsonStructure = await extractJsonFromIframe(win);

      const jsonString = JSON.stringify(jsonStructure, null, 2);
      await navigator.clipboard.writeText(jsonString);
      
      setCopiedJsonArtifact(true);
      setTimeout(() => setCopiedJsonArtifact(false), 2000);
    } catch (err) {
      console.error("Export failed:", err);
      setErrorMsg("Failed to export JSON structure.");
    }
  };

  const handleExportProjectJSON = async () => {
    if (artifacts.length === 0) return;

    try {
      const results = [];
      for (let i = 0; i < artifacts.length; i += 1) {
        const win = await loadArtifactIntoExportIframe(i);
        const jsonStructure = await extractJsonFromIframe(win);
        results.push(jsonStructure);
      }

      const settings = {
        fps: exportFps,
        duration: exportDuration,
        resolution: {
          width: exportResolution.width,
          height: exportResolution.height,
          label: exportResolution.label
        }
      };
      const artifactsPayload = results.map(result => {
        const artifactId =
          (result as { artifactId?: string; slideId?: string }).artifactId ||
          (result as { slideId?: string }).slideId ||
          '';
        const { settings: _settings, ...rest } = result as Record<string, any>;
        return {
          ...rest,
          artifactId
        };
      });

      const projectPayload = {
        name: projectTitle.trim(),
        description: projectDescription.trim(),
        tags: projectTags.trim(),
        settings,
        artifacts: artifactsPayload
      };

      const jsonString = JSON.stringify(projectPayload, null, 2);
      await navigator.clipboard.writeText(jsonString);

      setCopiedJsonProject(true);
      setTimeout(() => setCopiedJsonProject(false), 2000);
    } catch (err) {
      console.error("Export failed:", err);
      setErrorMsg("Failed to export JSON project.");
    }
  };

  const getCurrentFullHtml = () => {
    if (viewMode === 'preview' && artifacts.length > 0) {
      return previewHtml || buildPreviewHtml(getHeadHtml(), artifacts[currentArtifactIndex], currentArtifactIndex);
    }
    return previewHtml || getArtifactHtmlByIndex(currentArtifactIndex);
  };

  const buildAllArtifactsHtml = (nextHead: string, nextArtifacts: string[]) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>${getHeadHtml(nextHead)}</head>
        <body>
          ${nextArtifacts.join('\n')}
        </body>
      </html>
    `;
  };

  const getAllArtifactsHtml = (headOverride = headContent) => {
    return buildAllArtifactsHtml(headOverride, artifacts);
  };

  useEffect(() => {
    if (viewMode !== 'code') return;
    if (prevViewModeRef.current !== 'code') {
      setCodeDraft(getAllArtifactsHtml());
      setIsCodeDirty(false);
      return;
    }
    if (!isCodeDirty) {
      setCodeDraft(getAllArtifactsHtml());
    }
  }, [viewMode, headContent, artifacts, animationsEnabled, isCodeDirty]);

  useEffect(() => {
    if (viewMode !== 'preview') return;
    if (artifacts.length === 0) {
      setPreviewHtml('');
      return;
    }
    if (suppressPreviewReloadRef.current) {
      suppressPreviewReloadRef.current = false;
      return;
    }
    const html = buildPreviewHtml(getHeadHtml(), artifacts[currentArtifactIndex], currentArtifactIndex);
    setPreviewHtml(html);
  }, [viewMode, headContent, artifacts, currentArtifactIndex, animationsEnabled]);

  useEffect(() => {
    if (prevViewModeRef.current === 'code' && viewMode === 'preview') {
      if (codeDraft.trim()) {
        parseAndSetHtml(codeDraft, true);
      }
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, codeDraft]);

  const handleCodeChange = (value: string) => {
    setCodeDraft(value);
    setIsCodeDirty(true);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const payload = event.data as { source?: string; type?: string; html?: string };
      if (!payload || payload.source !== 'ae2-preview-editor') return;
      if (payload.type === 'undo') {
        performUndo();
        return;
      }
      if (payload.type === 'redo') {
        performRedo();
        return;
      }
      if (payload.type !== 'update') return;
      if (!payload.html || artifacts.length === 0) return;

      suppressPreviewReloadRef.current = true;
      historyImmediateNextRef.current = true;
      setArtifacts(prev => {
        if (prev.length === 0) return prev;
        const next = [...prev];
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = payload.html as string;
        sanitizeLayout(tempDiv);
        next[currentArtifactIndex] = tempDiv.innerHTML;
        return reindexArtifactClasses(next, includeSlideClass);
      });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentArtifactIndex, includeSlideClass, artifacts.length]);

  const handleCopyHtml = async () => {
    const html = getAllArtifactsHtml();
    await navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const applyTemplateContent = (nextHead: string, nextArtifacts: string[]) => {
    setHeadContent(nextHead);
    setArtifacts(nextArtifacts);
    if (viewMode === 'code' && !isCodeDirty) {
      setCodeDraft(buildAllArtifactsHtml(nextHead, nextArtifacts));
    }
  };

  const applyHeadUpdates = (nextTitle: string, nextTags: string, nextDescription: string) => {
    const newHead = updateHeadMetadata(headContent, nextTitle, nextTags, nextDescription);
    applyTemplateContent(newHead, artifacts);
  };

  const saveProjectTitle = () => {
    const nextTitle = titleDraft.trim();
    const updatedHead = updateHeadMetadata(headContent, nextTitle, projectTags, projectDescription);
    setEditingTitle(false);
    setProjectTitle(nextTitle);
    applyTemplateContent(updatedHead, artifacts);
    setHistoryItems(prev =>
      prev.map(item =>
        item.id === currentHistoryId
          ? {
              ...item,
              name: nextTitle || 'Untitled Project'
            }
          : item
      )
    );
    void saveHistorySnapshot(artifacts, updatedHead, nextTitle);
  };

  const saveProjectTags = () => {
    const nextTags = normalizeTags(tagsDraft);
    const updatedHead = updateHeadMetadata(headContent, projectTitle, nextTags, projectDescription);
    setEditingTags(false);
    setProjectTags(nextTags);
    applyTemplateContent(updatedHead, artifacts);
    void saveHistorySnapshot(artifacts, updatedHead);
  };

  const saveProjectDescription = () => {
    const nextDescription = descriptionDraft.trim();
    const updatedHead = updateHeadMetadata(headContent, projectTitle, projectTags, nextDescription);
    setEditingDescription(false);
    setProjectDescription(nextDescription);
    applyTemplateContent(updatedHead, artifacts);
    void saveHistorySnapshot(artifacts, updatedHead);
  };

  const startTitleEdit = () => {
    setTitleDraft(projectTitle);
    setEditingTitle(true);
  };

  const startTagsEdit = () => {
    setTagsDraft(projectTags);
    setEditingTags(true);
  };

  const startDescriptionEdit = () => {
    setDescriptionDraft(projectDescription);
    setEditingDescription(true);
  };

  const cancelTitleEdit = () => {
    setTitleDraft(projectTitle);
    setEditingTitle(false);
  };

  const cancelTagsEdit = () => {
    setTagsDraft(projectTags);
    setEditingTags(false);
  };

  const cancelDescriptionEdit = () => {
    setDescriptionDraft(projectDescription);
    setEditingDescription(false);
  };

  const paletteEntries = (() => {
    const deduped = new Map<string, string>();
    extractRootVariables(headContent).forEach(entry => {
      deduped.set(entry.name, entry.value);
    });
    return Array.from(deduped.entries())
      .map(([name, value]) => ({
        id: name,
        label: `--${name}`,
        value,
        hex: normalizeColorToHex(value)
      }))
      .filter(entry => entry.hex);
  })();

  const handlePaletteColorChange = (id: string, nextColor: string) => {
    const toHex = normalizeHex(nextColor);
    if (!toHex) return;
    const updatedHead = updateRootVariablesInHead(headContent, { [id]: toHex });
    suppressPreviewReloadRef.current = true;
    setHeadContent(updatedHead);
    pendingSaveDelayRef.current = 400;
    if (viewMode === 'code' && !isCodeDirty) {
      setCodeDraft(buildAllArtifactsHtml(updatedHead, artifacts));
    }
    const iframeRoot = iframeRef.current?.contentDocument?.documentElement;
    if (iframeRoot) {
      iframeRoot.style.setProperty(`--${id}`, toHex);
    }
  };

  const isEmpty = artifacts.length === 0;

  return (
    <div className={`flex flex-col gap-4${isEmpty ? ' min-h-[calc(100vh-7rem)]' : ''}`}>
      <div className="flex flex-col gap-4 lg:flex-row">
        <ArtifactHistoryPanel
          items={historyItems}
          loading={historyLoading}
          selectedId={currentHistoryId}
          error={historyError}
          onSelect={handleHistorySelect}
          onDelete={handleHistoryDelete}
          onRefresh={loadHistory}
          onNewChat={handleNewChat}
        />
        <div className={`flex min-w-0 flex-1 flex-col gap-4${isEmpty ? ' min-h-[calc(100vh-7rem)]' : ''}`}>
          {artifacts.length > 0 ? (
            <div className="flex flex-col gap-4">
              <ProjectMetadataPanel
                previewWidth={previewSize.width}
                projectTitle={projectTitle}
                projectTags={projectTags}
                projectDescription={projectDescription}
                editingTitle={editingTitle}
                editingTags={editingTags}
                editingDescription={editingDescription}
                titleDraft={titleDraft}
                tagsDraft={tagsDraft}
                descriptionDraft={descriptionDraft}
                onTitleDraftChange={setTitleDraft}
                onTagsDraftChange={setTagsDraft}
                onDescriptionDraftChange={setDescriptionDraft}
                onTitleEditStart={startTitleEdit}
                onTagsEditStart={startTagsEdit}
                onDescriptionEditStart={startDescriptionEdit}
                onTitleEditCancel={cancelTitleEdit}
                onTagsEditCancel={cancelTagsEdit}
                onDescriptionEditCancel={cancelDescriptionEdit}
                onTitleSave={saveProjectTitle}
                onTagsSave={saveProjectTags}
                onDescriptionSave={saveProjectDescription}
              />

              <ArtifactPreview
                previewStageRef={previewStageRef}
                previewSize={previewSize}
                previewScale={previewScale}
                viewMode={viewMode}
                codeDraft={codeDraft}
                baseWidth={PREVIEW_BASE_WIDTH}
                baseHeight={PREVIEW_BASE_HEIGHT}
                iframeRef={iframeRef}
                getCurrentFullHtml={getCurrentFullHtml}
                onCodeChange={handleCodeChange}
              />

              <div className="shrink-0 w-full flex justify-center px-4 pb-4">
                <div className="flex flex-col gap-3" style={{ width: previewSize.width || '100%' }}>
                  <ArtifactToolbar
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onCopyHtml={handleCopyHtml}
                    copiedHtml={copiedHtml}
                    currentIndex={currentArtifactIndex}
                    totalCount={artifacts.length}
                    onPrev={handlePrevArtifact}
                    onNext={handleNextArtifact}
                    onRegenerate={handleRegenerateCurrentArtifact}
                    regenerateMode={regenerateMode}
                    onRegenerateModeChange={setRegenerateMode}
                    regenerating={regeneratingArtifact}
                    onAdd={handleAddArtifact}
                    adding={addingArtifact}
                    onDelete={handleDeleteArtifact}
                    canDelete={artifacts.length > 1}
                    paletteEntries={paletteEntries}
                    onPaletteColorChange={handlePaletteColorChange}
                  />

                  <ExportControls
                    copiedJsonArtifact={copiedJsonArtifact}
                    copiedJsonProject={copiedJsonProject}
                    onExportArtifact={handleExportArtifactJSON}
                    onExportProject={handleExportProjectJSON}
                    exportFps={exportFps}
                    onExportFpsChange={setExportFps}
                    exportResolution={exportResolution}
                    resolutionOptions={RESOLUTION_OPTIONS}
                    onExportResolutionChange={setExportResolution}
                    exportDuration={exportDuration}
                    onExportDurationChange={setExportDuration}
                  />
                </div>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
          <div className={`flex justify-center px-4 pb-2${isEmpty ? ' mt-auto' : ''}`}>
            <div style={{ width: isEmpty ? '100%' : previewSize.width, maxWidth: '100%' }}>
              <GeneratorInput
                errorMsg={errorMsg}
                provider={provider}
                onProviderChange={setProvider}
                imageProvider={imageProvider}
                imageProviderOptions={IMAGE_PROVIDER_OPTIONS}
                onImageProviderChange={setImageProvider}
                topic={topic}
                onTopicChange={setTopic}
                onKeyDown={handleKeyDown}
                onGenerate={handleGenerate}
                loading={loading}
                isEmpty={isEmpty}
                attachedImage={chatImage}
                onImageAttach={setChatImage}
                onImageClear={() => setChatImage(null)}
              />
            </div>
          </div>
        </div>
      </div>

      <iframe
        ref={exportIframeRef}
        title="AE Export Frame"
        className="absolute -left-[10000px] top-0 w-[1280px] h-[720px] opacity-0 pointer-events-none"
        sandbox="allow-scripts allow-same-origin"
      />

    </div>
  );
};
