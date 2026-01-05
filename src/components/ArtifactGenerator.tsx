import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  generateArtifacts,
  generateArtifactsStream,
  generateArtifactsPersisted,
  regenerateArtifact,
  generateNewArtifact,
  applyMotionToHtml,
  updateArtifactsFromContext,
  updateArtifactsFromContextPersisted,
  AiProviderName,
  ImageProviderName,
  MediaKind,
  ArtifactMode
} from '../services/aiService';
import { extractSlideLayout as extractArtifactLayout } from '../utils/aeExtractor/index';
import { ArtifactPreview } from './artifact-generator/ArtifactPreview';
import { ArtifactToolbar } from './artifact-generator/ArtifactToolbar';
import { ArtifactHistoryPanel } from './artifact-generator/ArtifactHistoryPanel';
import { ExportControls } from './artifact-generator/ExportControls';
import { GeneratorInput } from './artifact-generator/GeneratorInput';
import { ProjectMetadataPanel } from './artifact-generator/ProjectMetadataPanel';
import { ImageProviderOption, MediaKindOption, ResolutionOption, ViewMode } from './artifact-generator/types';
import {
  listArtifactHistory,
  getArtifactHistory,
  createArtifactHistory,
  updateArtifactHistory,
  deleteArtifactHistory,
  ArtifactHistoryItem
} from '../services/artifactHistoryService';
import { getAuthToken } from '../services/authService';

type PreviewLayer = {
  id: string;
  children: PreviewLayer[];
};

const URL_TEXT_RE = /^https?:\/\/\S+$/i;

const LAST_ARTIFACT_KEY = 'ae2:lastArtifactId';
const LAST_ARTIFACT_INDEX_KEY = 'ae2:lastArtifactIndex';
const AUTO_REFINE_KEY = 'ae2:autoRefine';

const RESOLUTION_OPTIONS: ResolutionOption[] = [
  { id: '1080p', label: 'Full HD (1920x1080)', width: 1920, height: 1080 },
  { id: '2k', label: '2K (2560x1440)', width: 2560, height: 1440 },
  { id: '4k', label: '4K (3840x2160)', width: 3840, height: 2160 }
];

const IMAGE_PROVIDER_OPTIONS: ImageProviderOption[] = [
  { id: 'placeholder', label: 'Placeholder' },
  { id: 'random', label: 'Random (All)' },
  { id: 'pexels', label: 'Pexels' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'pixabay', label: 'Pixabay' }
];
const MEDIA_KIND_OPTIONS: MediaKindOption[] = [
  { id: 'random', label: 'Random' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' }
];
const PREVIEW_BASE_WIDTH = 1280;
const PREVIEW_BASE_HEIGHT = 720;
const GRID_DIMENSION = 3;
const GRID_CELL_COUNT = GRID_DIMENSION * GRID_DIMENSION;
const GRID_SCALE = 1 / GRID_DIMENSION;
const HISTORY_PAGE_SIZE = 20;
const TEXT_PLACEHOLDER_TAGS = [
  'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'li', 'figcaption', 'label', 'button', 'a',
  'strong', 'em', 'small', 'blockquote', 'pre', 'code',
  'td', 'th'
];
const VIDEO_EXT_RE = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const PREVIEW_EDITOR_STYLE = `
  :root {
    --ae2-edit-outline: #4cc9ff;
    --ae2-edit-selected: #9ad8ff;
    --ae2-edit-handle: #ffffff;
    --ae2-edit-hover: #4cc9ff;
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
  #ae2-hover {
    position: absolute;
    border: 1px solid var(--ae2-edit-hover);
    box-sizing: border-box;
    pointer-events: none;
    z-index: 2147483645;
  }
  #ae2-toolbar {
    position: absolute;
    display: flex;
    gap: 6px;
    padding: 4px;
    background: rgba(11, 15, 20, 0.9);
    border: 1px solid rgba(76, 201, 255, 0.4);
    border-radius: 8px;
    z-index: 2147483647;
  }
  .ae2-tool {
    width: 26px;
    height: 26px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(0, 0, 0, 0.35);
    color: #9ad8ff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  .ae2-tool:hover {
    background: rgba(76, 201, 255, 0.15);
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
  .ae2-hidden {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
  .ae2-locked {
    pointer-events: none !important;
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
    var selected = [];
    var overlay = null;
    var hoverOverlay = null;
    var hoverMouse = null;
    var hoverPanel = null;
    var handles = {};
    var toolbar = null;
    var dragging = null;
    var dirty = false;
    var history = [];
    var historyIndex = -1;
    var restoring = false;
    var HISTORY_LIMIT = 50;
    var isTextEditing = false;
    var editingEl = null;
    var editingOriginalHtml = '';
    var editingBlurHandler = null;
    var hiddenIds = {};
    var lockedIds = {};
    var VOID_TAGS = {
      area: true,
      base: true,
      br: true,
      col: true,
      embed: true,
      hr: true,
      img: true,
      input: true,
      link: true,
      meta: true,
      param: true,
      source: true,
      track: true,
      wbr: true
    };
    var SVG_CONTAINER_TAGS = {
      svg: true,
      g: true,
      defs: true,
      symbol: true,
      mask: true,
      clippath: true,
      pattern: true,
      marker: true,
      lineargradient: true,
      radialgradient: true
    };

    function isUi(el) {
      var node = el;
      while (node && node !== body && node !== doc.documentElement) {
        if (node.getAttribute && node.getAttribute('data-ae2-ui') === 'true') return true;
        node = node.parentElement;
      }
      return false;
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

    function isEditableTextElement(el) {
      if (!el || !isHtmlElement(el)) return false;
      if (isUi(el) || isSvgElement(el)) return false;
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      var allowed = [
        'p', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'li', 'figcaption', 'label', 'button', 'a',
        'strong', 'em', 'small', 'blockquote', 'pre', 'code',
        'td', 'th'
      ];
      if (allowed.indexOf(tag) !== -1) return true;
      return el.children.length === 0 && !!(el.textContent || '').trim();
    }

    function findEditableTextElement(target) {
      var node = target;
      while (node && node !== body && node !== doc.documentElement) {
        if (isEditableTextElement(node)) return node;
        node = node.parentElement;
      }
      return null;
    }

    function endTextEdit(commit) {
      if (!isTextEditing || !editingEl) return;
      var el = editingEl;
      var original = editingOriginalHtml;
      if (editingBlurHandler) {
        el.removeEventListener('blur', editingBlurHandler, true);
      }
      el.removeAttribute('contenteditable');
      el.removeAttribute('data-ae2-editing');
      el.style.outline = '';
      var nextHtml = el.innerHTML;
      var changed = nextHtml !== original;
      editingEl = null;
      editingOriginalHtml = '';
      editingBlurHandler = null;
      isTextEditing = false;
      if (changed && commit) {
        postUpdate();
      }
    }

    function startTextEdit(target) {
      if (!target) return;
      if (isTextEditing) {
        if (editingEl === target) return;
        endTextEdit(true);
      }
      isTextEditing = true;
      editingEl = target;
      editingOriginalHtml = target.innerHTML;
      clearSelection();
      setOverlayVisible(false);
      target.setAttribute('contenteditable', 'true');
      target.setAttribute('data-ae2-editing', 'true');
      target.style.outline = '1px solid rgba(76, 201, 255, 0.6)';
      editingBlurHandler = function () {
        endTextEdit(true);
      };
      target.addEventListener('blur', editingBlurHandler, true);
      try {
        var range = doc.createRange();
        range.selectNodeContents(target);
        var selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      } catch (err) {}
      target.focus();
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
        if (isBlocked(node)) return null;
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
        if (isBlocked(node)) continue;
        node.classList.add('ae2-edit-target');
      }
    }

    function isBlocked(el) {
      var node = el;
      while (node && node !== body && node !== doc.documentElement) {
        if (node.id && (hiddenIds[node.id] || lockedIds[node.id])) return true;
        if (node.classList && (node.classList.contains('ae2-hidden') || node.classList.contains('ae2-locked'))) {
          return true;
        }
        if (node.getAttribute && node.getAttribute('data-ae2-blocked') === 'true') return true;
        node = node.parentElement;
      }
      return false;
    }

    function buildLayerTree(root) {
      if (!root || !root.querySelectorAll) return [];
      function collectChildren(el) {
        var nodes = [];
        var child = el.firstElementChild;
        while (child) {
          var childNodes = collect(child);
          for (var i = 0; i < childNodes.length; i += 1) {
            nodes.push(childNodes[i]);
          }
          child = child.nextElementSibling;
        }
        return nodes;
      }
      function collect(el) {
        if (!el || isUi(el)) return [];
        var nodes = collectChildren(el);
        if (el.id) {
          return [{ id: el.id, children: nodes }];
        }
        return nodes;
      }
      if (root.tagName && root.tagName.toLowerCase() === 'section') {
        return collectChildren(root);
      }
      return collect(root);
    }

    function canContainChildren(el) {
      if (!el || !el.tagName) return false;
      var tag = el.tagName.toLowerCase();
      if (VOID_TAGS[tag]) return false;
      if (isSvgElement(el) || isSvgGraphics(el)) {
        return !!SVG_CONTAINER_TAGS[tag];
      }
      return true;
    }

    function moveLayer(sourceId, targetId, position) {
      if (!sourceId || !targetId || sourceId === targetId) return false;
      var source = doc.getElementById(sourceId);
      var target = doc.getElementById(targetId);
      if (!source || !target) return false;
      if (source.contains(target)) return false;
      if (position === 'inside') {
        if (!canContainChildren(target)) return false;
        target.appendChild(source);
        return true;
      }
      var parent = target.parentElement;
      if (!parent) return false;
      if (position === 'before') {
        parent.insertBefore(source, target);
        return true;
      }
      if (position === 'after') {
        parent.insertBefore(source, target.nextSibling);
        return true;
      }
      return false;
    }

    function postLayers() {
      var root = getRoot();
      var layers = buildLayerTree(root);
      window.parent.postMessage({ source: 'ae2-preview-editor', type: 'layers', layers: layers }, '*');
    }

    function postSelection() {
      var ids = [];
      for (var i = 0; i < selected.length; i += 1) {
        if (selected[i] && selected[i].id) ids.push(selected[i].id);
      }
      window.parent.postMessage(
        { source: 'ae2-preview-editor', type: 'selection', ids: ids, id: ids[0] || null },
        '*'
      );
    }

    function applyLayerState() {
      var active = doc.querySelectorAll('.ae2-hidden, .ae2-locked');
      for (var i = 0; i < active.length; i += 1) {
        active[i].classList.remove('ae2-hidden', 'ae2-locked');
      }
      var blocked = doc.querySelectorAll('[data-ae2-blocked="true"]');
      for (var b = 0; b < blocked.length; b += 1) {
        blocked[b].removeAttribute('data-ae2-blocked');
      }
      var targets = doc.querySelectorAll('.ae2-edit-target');
      for (var t = 0; t < targets.length; t += 1) {
        targets[t].classList.remove('ae2-edit-target');
      }
      for (var id in hiddenIds) {
        if (!hiddenIds[id]) continue;
        var el = doc.getElementById(id);
        if (el && el.classList) {
          el.classList.add('ae2-hidden');
          el.setAttribute('data-ae2-blocked', 'true');
          var hiddenNodes = el.querySelectorAll ? el.querySelectorAll('*') : [];
          for (var h = 0; h < hiddenNodes.length; h += 1) {
            if (hiddenNodes[h].classList) {
              hiddenNodes[h].classList.add('ae2-hidden');
              hiddenNodes[h].setAttribute('data-ae2-blocked', 'true');
            }
          }
        }
      }
      for (var lockId in lockedIds) {
        if (!lockedIds[lockId]) continue;
        var lockEl = doc.getElementById(lockId);
        if (lockEl && lockEl.classList) {
          lockEl.classList.add('ae2-locked');
          lockEl.setAttribute('data-ae2-blocked', 'true');
          var lockedNodes = lockEl.querySelectorAll ? lockEl.querySelectorAll('*') : [];
          for (var l = 0; l < lockedNodes.length; l += 1) {
            if (lockedNodes[l].classList) {
              lockedNodes[l].classList.add('ae2-locked');
              lockedNodes[l].setAttribute('data-ae2-blocked', 'true');
            }
          }
        }
      }
      if (selected.length) {
        var nextSelection = [];
        for (var s = 0; s < selected.length; s += 1) {
          if (selected[s] && !isBlocked(selected[s])) nextSelection.push(selected[s]);
        }
        if (nextSelection.length !== selected.length) {
          setSelection(nextSelection);
        }
      }
      markTargets();
      updateOverlay();
      updateHoverOverlay();
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
      hoverOverlay = doc.createElement('div');
      hoverOverlay.id = 'ae2-hover';
      hoverOverlay.setAttribute('data-ae2-ui', 'true');
      hoverOverlay.style.display = 'none';
      body.appendChild(hoverOverlay);

      overlay = doc.createElement('div');
      overlay.id = 'ae2-selection';
      overlay.setAttribute('data-ae2-ui', 'true');
      body.appendChild(overlay);

      toolbar = doc.createElement('div');
      toolbar.id = 'ae2-toolbar';
      toolbar.setAttribute('data-ae2-ui', 'true');
      var toolDefs = [
        { id: 'move', label: 'Move', icon: 'M6 12h12M12 6v12' },
        { id: 'rotate', label: 'Rotate', icon: 'M12 4a8 8 0 1 1-7.5 5' },
        { id: 'scale', label: 'Scale', icon: 'M7 7l10 10M7 17h4M17 7v4' },
        { id: 'scale-x', label: 'Scale X', icon: 'M4 12h16M18 8v8' },
        { id: 'scale-y', label: 'Scale Y', icon: 'M12 4v16M8 6h8' }
      ];
      for (var t = 0; t < toolDefs.length; t += 1) {
        var tool = doc.createElement('button');
        tool.className = 'ae2-tool';
        tool.setAttribute('type', 'button');
        tool.setAttribute('data-ae2-ui', 'true');
        tool.setAttribute('data-ae2-handle', toolDefs[t].id);
        tool.setAttribute('title', toolDefs[t].label);
        tool.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' +
          toolDefs[t].icon +
          '"/></svg>';
        tool.addEventListener('mousedown', onHandleDown, true);
        toolbar.appendChild(tool);
      }
      body.appendChild(toolbar);

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

    }

    function setOverlayVisible(visible) {
      if (!overlay) return;
      overlay.style.display = visible ? 'block' : 'none';
      if (toolbar) {
        toolbar.style.display = visible ? 'flex' : 'none';
      }
      Object.keys(handles).forEach(function (key) {
        handles[key].style.display = visible ? 'block' : 'none';
      });
    }

    function setHoverOverlayVisible(visible) {
      if (!hoverOverlay) return;
      hoverOverlay.style.display = visible ? 'block' : 'none';
    }

    function getSelectionRectForList(list) {
      if (!list || !list.length) return null;
      var minLeft = Infinity;
      var minTop = Infinity;
      var maxRight = -Infinity;
      var maxBottom = -Infinity;
      for (var i = 0; i < list.length; i += 1) {
        var rect = getSelectionRect(list[i]);
        if (!rect) continue;
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

    function updateHoverOverlay() {
      if (!hoverOverlay) return;
      var target = hoverPanel || hoverMouse;
      if (!target || isBlocked(target) || isSelected(target)) {
        setHoverOverlayVisible(false);
        return;
      }
      var rect = getSelectionRect(target);
      if (!rect) {
        setHoverOverlayVisible(false);
        return;
      }
      var left = rect.left + window.scrollX;
      var top = rect.top + window.scrollY;
      hoverOverlay.style.left = left + 'px';
      hoverOverlay.style.top = top + 'px';
      hoverOverlay.style.width = rect.width + 'px';
      hoverOverlay.style.height = rect.height + 'px';
      setHoverOverlayVisible(true);
    }

    function updateOverlay() {
      if (!selected.length || !overlay) return;
      var rect = getSelectionRectForList(selected);
      if (!rect) return;
      var left = rect.left + window.scrollX;
      var top = rect.top + window.scrollY;
      overlay.style.left = left + 'px';
      overlay.style.top = top + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';

      if (toolbar) {
        var toolbarLeft = left + rect.width / 2;
        var toolbarTop = Math.max(8, top - 38);
        toolbar.style.left = toolbarLeft + 'px';
        toolbar.style.top = toolbarTop + 'px';
        toolbar.style.transform = 'translateX(-50%)';
      }

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
    }

    function setMouseHover(el) {
      if (hoverMouse === el) return;
      hoverMouse = el;
      updateHoverOverlay();
    }

    function updateHoverFromEvent(e) {
      if (isTextEditing) return;
      if (isUi(e.target)) {
        setMouseHover(null);
        return;
      }
      var target = getSelectable(e.target);
      if (target && isSvgElement(target) && svgHasSelectableChild(target)) {
        var under = getUnderlyingSelectable(e.clientX, e.clientY, target);
        if (under) target = under;
      }
      setMouseHover(target);
    }

    function isSelected(el) {
      if (!el) return false;
      for (var i = 0; i < selected.length; i += 1) {
        if (selected[i] === el) return true;
      }
      return false;
    }

    function setSelection(list) {
      var next = [];
      var seen = {};
      for (var i = 0; i < list.length; i += 1) {
        var el = list[i];
        if (!el || !el.id || isBlocked(el)) continue;
        if (seen[el.id]) continue;
        seen[el.id] = true;
        next.push(el);
      }
      var hasSelection = next.length > 0;
      for (var p = 0; p < selected.length; p += 1) {
        if (selected[p] && selected[p].classList && !seen[selected[p].id]) {
          selected[p].classList.remove('ae2-selected');
        }
      }
      for (var n = 0; n < next.length; n += 1) {
        if (next[n] && next[n].classList) {
          next[n].classList.add('ae2-selected');
          applyTransform(next[n]);
        }
      }
      selected = next;
      if (body) body.classList.toggle('ae2-has-selection', hasSelection);
      if (hasSelection) {
        ensureUi();
        setOverlayVisible(true);
        updateOverlay();
        if (body) body.focus();
      } else {
        setOverlayVisible(false);
      }
      updateHoverOverlay();
      postSelection();
    }

    function selectElement(el) {
      if (!el) return;
      setSelection([el]);
    }

    function toggleSelection(el) {
      if (!el) return;
      if (isSelected(el)) {
        var next = [];
        for (var i = 0; i < selected.length; i += 1) {
          if (selected[i] !== el) next.push(selected[i]);
        }
        setSelection(next);
      } else {
        var appended = selected.slice(0);
        appended.push(el);
        setSelection(appended);
      }
    }

    function clearSelection() {
      if (!selected.length) return;
      setSelection([]);
    }

    function buildDragItems(list) {
      var items = [];
      for (var i = 0; i < list.length; i += 1) {
        var el = list[i];
        if (!el) continue;
        var rect = getSelectionRect(el) || el.getBoundingClientRect();
        if (!rect) continue;
        items.push({
          el: el,
          tx: getNum(el, 'tx', 0),
          ty: getNum(el, 'ty', 0),
          sx: getNum(el, 'sx', 1),
          sy: getNum(el, 'sy', 1),
          rot: getNum(el, 'rot', 0),
          cx: rect.left + rect.width / 2,
          cy: rect.top + rect.height / 2
        });
      }
      return items;
    }

    function startMove(e) {
      if (!selected.length) return;
      var items = buildDragItems(selected);
      if (!items.length) return;
      var rect = getSelectionRectForList(selected);
      if (!rect) return;
      dragging = {
        type: 'move',
        startX: e.clientX,
        startY: e.clientY,
        rect: rect,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        items: items,
        started: false
      };
      dirty = false;
    }

    function startResize(e, handle) {
      if (!selected.length) return;
      var items = buildDragItems(selected);
      if (!items.length) return;
      var rect = getSelectionRectForList(selected);
      if (!rect) return;
      dragging = {
        type: 'resize',
        handle: handle,
        startX: e.clientX,
        startY: e.clientY,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        items: items
      };
      dirty = false;
    }

    function startScaleUniform(e) {
      if (!selected.length) return;
      var items = buildDragItems(selected);
      if (!items.length) return;
      var rect = getSelectionRectForList(selected);
      if (!rect) return;
      dragging = {
        type: 'scale',
        startX: e.clientX,
        startY: e.clientY,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        items: items
      };
      dirty = false;
    }

    function startScaleAxis(e, axis) {
      if (!selected.length) return;
      var items = buildDragItems(selected);
      if (!items.length) return;
      var rect = getSelectionRectForList(selected);
      if (!rect) return;
      dragging = {
        type: axis === 'x' ? 'scale-x' : 'scale-y',
        startX: e.clientX,
        startY: e.clientY,
        width: rect.width,
        height: rect.height,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        items: items
      };
      dirty = false;
    }

    function startRotate(e) {
      if (!selected.length) return;
      var items = buildDragItems(selected);
      if (!items.length) return;
      var rect = getSelectionRectForList(selected);
      if (!rect) return;
      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      dragging = {
        type: 'rotate',
        startAngle: Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI,
        items: items,
        centerX: cx,
        centerY: cy
      };
      dirty = false;
    }

    function onMouseMove(e) {
      if (!dragging) {
        updateHoverFromEvent(e);
        return;
      }
      if (!selected.length) return;
      if (dragging.type === 'move') {
        var dx = e.clientX - dragging.startX;
        var dy = e.clientY - dragging.startY;
        if (!dragging.started) {
          if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return;
          dragging.started = true;
        }
        for (var i = 0; i < dragging.items.length; i += 1) {
          var item = dragging.items[i];
          setNum(item.el, 'tx', item.tx + dx);
          setNum(item.el, 'ty', item.ty + dy);
          applyTransform(item.el);
        }
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
        for (var r = 0; r < dragging.items.length; r += 1) {
          var resizeItem = dragging.items[r];
          var nextSx = Math.max(0.05, resizeItem.sx * scaleX);
          var nextSy = Math.max(0.05, resizeItem.sy * scaleY);
          var nextCx = dragging.centerX + (resizeItem.cx - dragging.centerX) * scaleX;
          var nextCy = dragging.centerY + (resizeItem.cy - dragging.centerY) * scaleY;
          setNum(resizeItem.el, 'sx', nextSx);
          setNum(resizeItem.el, 'sy', nextSy);
          setNum(resizeItem.el, 'tx', resizeItem.tx + (nextCx - resizeItem.cx));
          setNum(resizeItem.el, 'ty', resizeItem.ty + (nextCy - resizeItem.cy));
          applyTransform(resizeItem.el);
        }
        updateOverlay();
        dirty = true;
        return;
      }
      if (dragging.type === 'scale-x') {
        var dxs = e.clientX - dragging.startX;
        var scaleXOnly = (dragging.width + dxs) / dragging.width;
        for (var sxIndex = 0; sxIndex < dragging.items.length; sxIndex += 1) {
          var scaleItemX = dragging.items[sxIndex];
          var nextSxOnly = Math.max(0.05, scaleItemX.sx * scaleXOnly);
          var nextCx = dragging.centerX + (scaleItemX.cx - dragging.centerX) * scaleXOnly;
          setNum(scaleItemX.el, 'sx', nextSxOnly);
          setNum(scaleItemX.el, 'tx', scaleItemX.tx + (nextCx - scaleItemX.cx));
          applyTransform(scaleItemX.el);
        }
        updateOverlay();
        dirty = true;
        return;
      }
      if (dragging.type === 'scale') {
        var dxu = e.clientX - dragging.startX;
        var dyu = e.clientY - dragging.startY;
        var delta = Math.abs(dxu) > Math.abs(dyu) ? dxu : dyu;
        var scaleUniform = (dragging.width + delta) / dragging.width;
        for (var su = 0; su < dragging.items.length; su += 1) {
          var scaleItemU = dragging.items[su];
          var nextSu = Math.max(0.05, scaleItemU.sx * scaleUniform);
          var nextCu = dragging.centerX + (scaleItemU.cx - dragging.centerX) * scaleUniform;
          var nextCv = dragging.centerY + (scaleItemU.cy - dragging.centerY) * scaleUniform;
          setNum(scaleItemU.el, 'sx', nextSu);
          setNum(scaleItemU.el, 'sy', nextSu);
          setNum(scaleItemU.el, 'tx', scaleItemU.tx + (nextCu - scaleItemU.cx));
          setNum(scaleItemU.el, 'ty', scaleItemU.ty + (nextCv - scaleItemU.cy));
          applyTransform(scaleItemU.el);
        }
        updateOverlay();
        dirty = true;
        return;
      }
      if (dragging.type === 'scale-y') {
        var dys = e.clientY - dragging.startY;
        var scaleYOnly = (dragging.height + dys) / dragging.height;
        for (var syIndex = 0; syIndex < dragging.items.length; syIndex += 1) {
          var scaleItemY = dragging.items[syIndex];
          var nextSyOnly = Math.max(0.05, scaleItemY.sy * scaleYOnly);
          var nextCy = dragging.centerY + (scaleItemY.cy - dragging.centerY) * scaleYOnly;
          setNum(scaleItemY.el, 'sy', nextSyOnly);
          setNum(scaleItemY.el, 'ty', scaleItemY.ty + (nextCy - scaleItemY.cy));
          applyTransform(scaleItemY.el);
        }
        updateOverlay();
        dirty = true;
        return;
      }
      if (dragging.type === 'rotate') {
        var angle = Math.atan2(e.clientY - dragging.centerY, e.clientX - dragging.centerX) * 180 / Math.PI;
        var delta = angle - dragging.startAngle;
        var rad = delta * Math.PI / 180;
        var cos = Math.cos(rad);
        var sin = Math.sin(rad);
        for (var ri = 0; ri < dragging.items.length; ri += 1) {
          var rotItem = dragging.items[ri];
          var vx = rotItem.cx - dragging.centerX;
          var vy = rotItem.cy - dragging.centerY;
          var nextRx = vx * cos - vy * sin;
          var nextRy = vx * sin + vy * cos;
          var nextCx = dragging.centerX + nextRx;
          var nextCy = dragging.centerY + nextRy;
          setNum(rotItem.el, 'rot', rotItem.rot + delta);
          setNum(rotItem.el, 'tx', rotItem.tx + (nextCx - rotItem.cx));
          setNum(rotItem.el, 'ty', rotItem.ty + (nextCy - rotItem.cy));
          applyTransform(rotItem.el);
        }
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
      var html = getCleanHtml(root);
      if (!restoring) {
        pushHistory(html);
      }
      window.parent.postMessage({ source: 'ae2-preview-editor', type: 'update', html: html }, '*');
      postLayers();
    }

    function onMouseDown(e) {
      var target = e.target;
      if (isTextEditing) {
        if (editingEl && editingEl.contains(target)) return;
        endTextEdit(true);
      }
      if (isUi(target)) return;
      var selectable = getSelectable(target);
      var svgRoot = getSvgRoot(target);
      if (svgRoot && !e.altKey) {
        var passthrough = getUnderlyingSelectable(e.clientX, e.clientY, svgRoot);
        if (passthrough) {
          selectable = passthrough;
        }
      }
      var isMulti = e.ctrlKey || e.metaKey;
      if (!selectable) {
        if (!isMulti) clearSelection();
        return;
      }
      if (isBlocked(selectable)) {
        if (!isMulti) clearSelection();
        return;
      }
      if (isMulti) {
        toggleSelection(selectable);
        if (body) body.focus();
        return;
      }
      if (!isSelected(selectable) || selected.length <= 1) {
        selectElement(selectable);
      }
      if (body) body.focus();
      body.style.userSelect = 'none';
      body.style.cursor = 'move';
      startMove(e);
      e.preventDefault();
    }

    function onHandleDown(e) {
      var handleEl = e.currentTarget && e.currentTarget.getAttribute ? e.currentTarget : null;
      if (!handleEl || !handleEl.getAttribute('data-ae2-handle')) {
        var target = e.target;
        handleEl = target && target.getAttribute ? target : null;
        if (handleEl && !handleEl.getAttribute('data-ae2-handle') && handleEl.closest) {
          handleEl = handleEl.closest('[data-ae2-handle]');
        }
      }
      var handle = handleEl && handleEl.getAttribute ? handleEl.getAttribute('data-ae2-handle') : null;
      if (!handle || !selected.length) return;
      body.style.userSelect = 'none';
      if (handle === 'rotate') {
        body.style.cursor = 'crosshair';
        startRotate(e);
      } else if (handle === 'move') {
        body.style.cursor = 'move';
        startMove(e);
      } else if (handle === 'scale') {
        body.style.cursor = 'nwse-resize';
        startScaleUniform(e);
      } else if (handle === 'scale-x') {
        body.style.cursor = 'ew-resize';
        startScaleAxis(e, 'x');
      } else if (handle === 'scale-y') {
        body.style.cursor = 'ns-resize';
        startScaleAxis(e, 'y');
      } else {
        body.style.cursor = handle + '-resize';
        startResize(e, handle);
      }
      e.preventDefault();
      e.stopPropagation();
    }

    function onKeyDown(e) {
      if (isTextEditing) {
        if (e.key === 'Escape') {
          if (editingEl) {
            editingEl.innerHTML = editingOriginalHtml;
          }
          endTextEdit(false);
          e.preventDefault();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          endTextEdit(true);
          e.preventDefault();
        }
        return;
      }
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
      if (!selected.length) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        for (var d = 0; d < selected.length; d += 1) {
          if (selected[d] && selected[d].parentElement) {
            selected[d].parentElement.removeChild(selected[d]);
          }
        }
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

    function stripEditClasses(el) {
      if (!el || !el.classList) return;
      el.classList.remove('ae2-edit-target', 'ae2-selected', 'ae2-hidden', 'ae2-locked');
      if (el.getAttribute('class') === '') {
        el.removeAttribute('class');
      }
    }

    function getCleanHtml(root) {
      var html = getRootHtml(root);
      if (!html) return html;
      var container = doc.createElement('div');
      container.innerHTML = html;
      var target = root === body ? container : container.firstElementChild;
      if (!target) return html;
      stripEditClasses(target);
      var nodes = target.querySelectorAll('.ae2-edit-target, .ae2-selected, .ae2-hidden, .ae2-locked');
      for (var i = 0; i < nodes.length; i += 1) {
        stripEditClasses(nodes[i]);
      }
      return root === body ? container.innerHTML : target.outerHTML;
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
      selected = [];
      hoverMouse = null;
      hoverPanel = null;
      ensureUi();
      markTargets();
      setOverlayVisible(false);
      setHoverOverlayVisible(false);
      postLayers();
      postSelection();
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

    function onDoubleClick(e) {
      if (isUi(e.target)) return;
      var editable = findEditableTextElement(e.target);
      if (!editable) return;
      startTextEdit(editable);
      e.preventDefault();
    }

    function onParentMessage(event) {
      var payload = event.data;
      if (!payload || payload.source !== 'ae2-layer-panel') return;
      if (payload.type === 'select') {
        if (payload.ids && payload.ids.length) {
          var next = [];
          for (var i = 0; i < payload.ids.length; i += 1) {
            var item = doc.getElementById(payload.ids[i]);
            if (item) next.push(item);
          }
          setSelection(next);
          updateOverlay();
          return;
        }
        var el = doc.getElementById(payload.id);
        if (!el) return;
        if (payload.mode === 'toggle') {
          toggleSelection(el);
        } else {
          selectElement(el);
        }
        updateOverlay();
        return;
      }
      if (payload.type === 'hover') {
        if (!payload.id) {
          hoverPanel = null;
          updateHoverOverlay();
          return;
        }
        var hoverEl = doc.getElementById(payload.id);
        hoverPanel = hoverEl || null;
        updateHoverOverlay();
        return;
      }
      if (payload.type === 'layer-state') {
        hiddenIds = payload.hidden || {};
        lockedIds = payload.locked || {};
        applyLayerState();
        return;
      }
      if (payload.type === 'request-layers') {
        postLayers();
        return;
      }
      if (payload.type === 'move-layer') {
        var moved = moveLayer(payload.id, payload.targetId, payload.position);
        if (moved) {
          selectElement(doc.getElementById(payload.id));
          updateOverlay();
          postUpdate();
        }
      }
    }

    markTargets();
    ensureUi();
    postLayers();
    postSelection();
    setOverlayVisible(false);
    setHoverOverlayVisible(false);
    pushHistory(getCleanHtml(getRoot()));

    doc.addEventListener('mousedown', onMouseDown, true);
    doc.addEventListener('dblclick', onDoubleClick, true);
    doc.addEventListener('mousemove', onMouseMove, true);
    doc.addEventListener('mouseleave', function () {
      setMouseHover(null);
    }, true);
    doc.addEventListener('mouseup', finishDrag, true);
    window.addEventListener('resize', updateOverlay);
    window.addEventListener('resize', updateHoverOverlay);
    window.addEventListener('scroll', updateOverlay, true);
    window.addEventListener('scroll', updateHoverOverlay, true);
    window.addEventListener('message', onParentMessage);
    doc.addEventListener('keydown', onKeyDown, true);

    Object.keys(handles).forEach(function (key) {
      handles[key].addEventListener('mousedown', onHandleDown, true);
    });
  })();
`;

const LOADER_STYLE = `
  @keyframes ae2-indeterminate {
    0% { left: -30%; }
    100% { left: 100%; }
  }
`;

const getArtifactIdFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const id = params.get('artifact');
  return id && id.trim() ? id.trim() : null;
};

const getSlideIndexFromUrl = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('slide');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const setArtifactIdInUrl = (id: string | null) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set('artifact', id);
  } else {
    url.searchParams.delete('artifact');
  }
  window.history.replaceState({}, '', url.toString());
};

const setSlideIndexInUrl = (index: number | null) => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (index == null || Number.isNaN(index)) {
    url.searchParams.delete('slide');
  } else {
    url.searchParams.set('slide', String(index));
  }
  window.history.replaceState({}, '', url.toString());
};
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
      !/^slide-d+$/.test(cls) &&
      !/^artifact-d+$/.test(cls)
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
    const editNodes = root.querySelectorAll(
      '.ae2-edit-target, .ae2-selected, .ae2-has-selection, .ae2-hidden, .ae2-locked'
    );
    editNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      node.classList.remove('ae2-edit-target', 'ae2-selected', 'ae2-has-selection', 'ae2-hidden', 'ae2-locked');
      if (node.getAttribute('class') === '') {
        node.removeAttribute('class');
      }
    });
    if (root instanceof HTMLElement) {
      root.classList.remove('ae2-edit-target', 'ae2-selected', 'ae2-has-selection', 'ae2-hidden', 'ae2-locked');
      if (root.getAttribute('class') === '') {
        root.removeAttribute('class');
      }
    }
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
        text.includes("window.addEventListener('error'") ||
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

type ScenePaletteEntry = {
  name: string;
  color: string;
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
  return `:root {
${entries.join('\n')}
  }
`;
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
    targetStyle.textContent = `${styleText}
${buildRootBlock(null, updates)}`;
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

const isColorValue = (value: string, win: Window) => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !!normalizeHex(trimmed);
};

const VAR_REF_RE = /var\(\s*--([a-z0-9-]+)\s*(?:,[^)]+)?\)/gi;

const collectVarRefs = (source: string, out: Set<string>) => {
  if (!source) return;
  VAR_REF_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = VAR_REF_RE.exec(source)) !== null) {
    if (match[1]) out.add(match[1]);
  }
};

const collectVarRefsFromAttributes = (el: Element, out: Set<string>) => {
  for (const attr of Array.from(el.attributes)) {
    collectVarRefs(attr.value, out);
  }
};

const collectVarRefsFromElementTree = (root: Element, out: Set<string>) => {
  collectVarRefsFromAttributes(root, out);
  root.querySelectorAll('*').forEach(el => collectVarRefsFromAttributes(el, out));
};

const stripPseudoSelectors = (selector: string) =>
  selector.replace(
    /:{1,2}(before|after|first-letter|first-line|selection|placeholder|marker|backdrop|file-selector-button|cue|cue-region|part\([^)]+\)|slotted\([^)]+\))/gi,
    ''
  );

const selectorMatchesArtifact = (selector: string, artifactEl: Element) => {
  const cleaned = stripPseudoSelectors(selector).trim();
  if (!cleaned) return false;
  if (cleaned === ':root' || cleaned === 'html' || cleaned === 'body') return true;
  try {
    if (artifactEl.matches(cleaned)) return true;
    return !!artifactEl.querySelector(cleaned);
  } catch {
    return false;
  }
};

const collectVarRefsFromRules = (
  rules: CSSRuleList,
  win: Window,
  artifactEl: Element,
  out: Set<string>
) => {
  for (const rule of Array.from(rules)) {
    if (rule.type === CSSRule.STYLE_RULE) {
      const styleRule = rule as CSSStyleRule;
      const selectors = styleRule.selectorText
        .split(',')
        .map(sel => sel.trim())
        .filter(Boolean);
      const matches = selectors.some(sel => selectorMatchesArtifact(sel, artifactEl));
      if (matches) collectVarRefs(styleRule.style.cssText, out);
      continue;
    }

    if (rule.type === CSSRule.MEDIA_RULE) {
      const mediaRule = rule as CSSMediaRule;
      const matches = win.matchMedia ? win.matchMedia(mediaRule.media.mediaText).matches : true;
      if (matches) collectVarRefsFromRules(mediaRule.cssRules, win, artifactEl, out);
      continue;
    }

    if (rule.type === CSSRule.SUPPORTS_RULE) {
      const supportsRule = rule as CSSSupportsRule;
      collectVarRefsFromRules(supportsRule.cssRules, win, artifactEl, out);
    }
  }
};

const collectVarRefsFromStyleSheets = (win: Window, artifactEl: Element, out: Set<string>) => {
  const sheets = Array.from(win.document.styleSheets || []);
  for (const sheet of sheets) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    if (!rules) continue;
    collectVarRefsFromRules(rules, win, artifactEl, out);
  }
};

const extractScenePalette = (
  headHtml: string,
  win: Window,
  artifactEl: Element
): ScenePaletteEntry[] => {
  const rootVars = extractRootVariables(headHtml);
  const rootMap = new Map(rootVars.map(entry => [entry.name, entry.value]));
  const used = new Set<string>();
  collectVarRefsFromElementTree(artifactEl, used);
  collectVarRefsFromStyleSheets(win, artifactEl, used);
  return Array.from(used)
    .sort()
    .map(name => {
      const value = rootMap.get(name);
      if (!value) return null;
      if (!isColorValue(value, win)) return null;
      const color = normalizeColorToHex(value) || value;
      return color ? { name, color } : null;
    })
    .filter((entry): entry is ScenePaletteEntry => !!entry);
};

const collectUsedHexColors = (node: any, out: Set<string>) => {
  if (!node) return;
  const pushColor = (value?: string | null) => {
    if (!value) return;
    const hex = normalizeColorToHex(value);
    if (hex) out.add(hex);
  };

  if (node.style) {
    pushColor(node.style.backgroundColor);
    if (node.style.backgroundGradients && node.style.backgroundGradients.length) {
      node.style.backgroundGradients.forEach((gradient: any) => {
        if (!gradient || !gradient.stops) return;
        gradient.stops.forEach((stop: any) => pushColor(stop && stop.color));
      });
    }
    if (node.style.boxShadow && node.style.boxShadow.length) {
      node.style.boxShadow.forEach((shadow: any) => pushColor(shadow && shadow.color));
    }
  }

  if (node.font) {
    pushColor(node.font.color);
    pushColor(node.font.strokeColor);
  }

  if (node.border) {
    pushColor(node.border.color);
    if (node.border.sides) {
      Object.values(node.border.sides).forEach((side: any) => pushColor(side && side.color));
    }
  }

  if (node.outline) {
    pushColor(node.outline.color);
    if (node.outline.sides) {
      Object.values(node.outline.sides).forEach((side: any) => pushColor(side && side.color));
    }
  }

  if (node.children && node.children.length) {
    node.children.forEach((child: any) => collectUsedHexColors(child, out));
  }
};

const filterPaletteByUsedColors = (
  palette: ScenePaletteEntry[],
  usedHex: Set<string>
) => {
  const byColor = new Map<string, ScenePaletteEntry>();
  palette.forEach(entry => {
    const color = normalizeHex(entry.color) || entry.color;
    if (!color) return;
    if (!usedHex.has(color)) return;
    if (!byColor.has(color)) byColor.set(color, entry);
  });
  return Array.from(byColor.values());
};

const countPlaceholders = (artifactHtmls: string[]) => {
  if (typeof DOMParser === 'undefined') {
    return { media: 0, text: 0 };
  }
  const parser = new DOMParser();
  const textSelector = TEXT_PLACEHOLDER_TAGS.join(',');
  let mediaCount = 0;
  let textCount = 0;
  artifactHtmls.forEach(html => {
    const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
    const root = doc.body;
    if (!root) return;
    mediaCount += root.querySelectorAll('img, video').length;
    Array.from(root.querySelectorAll(textSelector)).forEach(node => {
      if ((node.textContent || '').trim()) {
        textCount += 1;
      }
    });
    Array.from(root.querySelectorAll('[style]')).forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      const bg = node.style.backgroundImage || '';
      if (bg && bg !== 'none' && /url\(/i.test(bg)) {
        mediaCount += 1;
      }
    });
  });
  return { media: mediaCount, text: textCount };
};

const convertVideoImages = (doc: Document) => {
  const images = Array.from(doc.querySelectorAll('img'));
  images.forEach(img => {
    const src = img.getAttribute('src');
    if (!src || !VIDEO_EXT_RE.test(src)) return;
    const video = doc.createElement('video');
    Array.from(img.attributes).forEach(attr => {
      const name = attr.name.toLowerCase();
      if (name === 'src' || name === 'srcset') return;
      video.setAttribute(attr.name, attr.value);
    });
    if (img.getAttribute('alt') && !video.getAttribute('aria-label')) {
      video.setAttribute('aria-label', img.getAttribute('alt') || '');
    }
    video.setAttribute('src', src);
    video.setAttribute('autoplay', 'true');
    video.setAttribute('loop', 'true');
    video.setAttribute('muted', 'true');
    video.setAttribute('playsinline', 'true');
    video.style.width = img.style.width || '100%';
    video.style.height = img.style.height || '100%';
    video.style.objectFit = img.style.objectFit || 'cover';
    video.style.display = img.style.display || 'block';
    img.replaceWith(video);
  });
};


type HistorySnapshot = {
  headContent: string;
  artifacts: string[];
  currentArtifactIndex: number;
  artifactMode: ArtifactMode;
};

type ArtifactGeneratorProps = {
  historyOverlayOpen?: boolean;
  onHistoryOverlayClose?: () => void;
};

export const ArtifactGenerator: React.FC<ArtifactGeneratorProps> = ({
  historyOverlayOpen = false,
  onHistoryOverlayClose
}) => {
  const [topic, setTopic] = useState('');
  const [chatImage, setChatImage] = useState<string | null>(null);
  const [headContent, setHeadContent] = useState<string>('');
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0);
  const [animationsEnabled] = useState(false);
  const [provider, setProvider] = useState<AiProviderName>('gemini');
  
  const [loading, setLoading] = useState(false);
  const [streamProgress, setStreamProgress] = useState({
    active: false,
    text: '',
    total: 0
  });
  const [regeneratingArtifact, setRegeneratingArtifact] = useState(false);
  const [animatingArtifact, setAnimatingArtifact] = useState(false);
  const [addingArtifact, setAddingArtifact] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedJsonArtifact, setCopiedJsonArtifact] = useState(false);
  const [copiedJsonProject, setCopiedJsonProject] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);
  const [imageProvider, setImageProvider] = useState<ImageProviderName>('random');
  const [mediaKind, setMediaKind] = useState<MediaKind>('random');
  const [autoRefine, setAutoRefine] = useState(() => {
    if (typeof window === 'undefined') return false;
    const stored = window.localStorage.getItem(AUTO_REFINE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return false;
  });
  const [artifactMode, setArtifactMode] = useState<ArtifactMode>('slides');
  const includeSlideClass = artifactMode === 'slides' || artifactMode === 'mixed';
  const [codeDraft, setCodeDraft] = useState('');
  const [isCodeDirty, setIsCodeDirty] = useState(false);
  const [exportResolution, setExportResolution] = useState(RESOLUTION_OPTIONS[2]);
  const [exportFps, setExportFps] = useState<number>(30);
  const [exportDuration, setExportDuration] = useState<number>(10);
  const [timelinePlaying, setTimelinePlaying] = useState(false);
  const [timelineTime, setTimelineTime] = useState(0);
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
  const [previewRevision, setPreviewRevision] = useState(0);
  const [previewLayers, setPreviewLayers] = useState<PreviewLayer[]>([]);
  const [previewSelectionIds, setPreviewSelectionIds] = useState<string[]>([]);
  const [previewLayerExpanded, setPreviewLayerExpanded] = useState<Record<string, boolean>>({});
  const [previewHidden, setPreviewHidden] = useState<Record<string, boolean>>({});
  const [previewLocked, setPreviewLocked] = useState<Record<string, boolean>>({});
  const [previewDragId, setPreviewDragId] = useState<string | null>(null);
  const [previewDropTarget, setPreviewDropTarget] = useState<{
    id: string;
    position: 'before' | 'after' | 'inside';
  } | null>(null);
  const timelineTimeRef = useRef(0);
  const timelinePlayingRef = useRef(false);
  const timelineRafRef = useRef<number | null>(null);
  const timelineStartRef = useRef(0);
  const timelineStartTimeRef = useRef(0);
  const timelineAppliedOffsetRef = useRef<string | null>(null);
  const timelineUiTickRef = useRef(0);
  const timelineRootRef = useRef<HTMLElement | null>(null);
  const artifactsRef = useRef<string[]>([]);
  const [historyItems, setHistoryItems] = useState<ArtifactHistoryItem[]>([]);
  const [historyPolling, setHistoryPolling] = useState(false);
  const historyPollTimerRef = useRef<number | null>(null);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const restoredArtifactIndexRef = useRef<string | null>(null);
  const desiredArtifactIndexRef = useRef<number | null>(null);
  
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
  const animateRequestIdRef = useRef(0);
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
    const clamped = Math.min(Math.max(0, timelineTimeRef.current), Math.max(exportDuration, 0));
    if (clamped !== timelineTimeRef.current) {
      timelineTimeRef.current = clamped;
      setTimelineTime(clamped);
    }
  }, [exportDuration]);

  useEffect(() => {
    if (!timelinePlaying) {
      timelinePlayingRef.current = false;
      if (timelineRafRef.current) {
        window.cancelAnimationFrame(timelineRafRef.current);
        timelineRafRef.current = null;
      }
      setTimelinePlayState(false);
      setTimelineTime(timelineTimeRef.current);
      return;
    }

    timelinePlayingRef.current = true;
    setTimelinePlayState(true);
    timelineStartRef.current = performance.now();
    timelineStartTimeRef.current = timelineTimeRef.current;
    timelineUiTickRef.current = performance.now();

    const tick = (now: number) => {
      if (!timelinePlayingRef.current) return;
      const duration = Math.max(exportDuration, 0.01);
      const elapsed = (now - timelineStartRef.current) / 1000;
      const next = timelineStartTimeRef.current + elapsed;
      if (next >= duration) {
        timelineStartRef.current = now;
        timelineStartTimeRef.current = 0;
        timelineTimeRef.current = 0;
        setTimelineTime(0);
        applyTimelineOffset(0);
      } else {
        timelineTimeRef.current = next;
        if (now - timelineUiTickRef.current > 100) {
          timelineUiTickRef.current = now;
          setTimelineTime(next);
        }
      }
      timelineRafRef.current = window.requestAnimationFrame(tick);
    };

    timelineRafRef.current = window.requestAnimationFrame(tick);
    return () => {
      timelinePlayingRef.current = false;
      if (timelineRafRef.current) {
        window.cancelAnimationFrame(timelineRafRef.current);
        timelineRafRef.current = null;
      }
    };
  }, [timelinePlaying, exportDuration]);

  useEffect(() => {
    const root = iframeRef.current?.contentDocument?.documentElement as HTMLElement | null;
    timelineRootRef.current = root;
    if (root) {
      timelineAppliedOffsetRef.current = null;
      root.style.setProperty('--ae2-anim-offset', `${timelineTimeRef.current}s`);
    }
  }, [previewRevision]);


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

  useEffect(() => {
    if (artifacts.length === 0) return;
    if (typeof window === 'undefined') return;
    if (!currentHistoryId) return;
    if (restoredArtifactIndexRef.current === currentHistoryId) return;
    const slideFromUrl = getSlideIndexFromUrl();
    if (slideFromUrl != null) {
      const clamped = Math.min(Math.max(0, slideFromUrl), Math.max(0, artifacts.length - 1));
      setCurrentArtifactIndex(clamped);
    }
    restoredArtifactIndexRef.current = currentHistoryId;
  }, [artifacts.length, currentHistoryId]);

  useEffect(() => {
    if (artifacts.length === 0) return;
    if (typeof window === 'undefined') return;
    if (!currentHistoryId) return;
    if (restoredArtifactIndexRef.current !== currentHistoryId) return;
    setSlideIndexInUrl(currentArtifactIndex);
  }, [currentArtifactIndex, artifacts.length, currentHistoryId]);

  useEffect(() => {
    const root = iframeRef.current?.contentDocument?.documentElement as HTMLElement | null;
    if (!root) return;
    timelineRootRef.current = root;
    timelineAppliedOffsetRef.current = null;
    root.style.setProperty('--ae2-anim-offset', `${timelineTimeRef.current}s`);
    root.setAttribute('data-ae2-play', timelinePlaying ? 'true' : 'false');
  }, [previewRevision]);

  const getHistoryHash = (snapshot: HistorySnapshot) =>
    hashString(
      `${snapshot.headContent}::${snapshot.artifacts.join('')}::${snapshot.artifactMode}`
    );

  const stopHistoryPolling = () => {
    if (historyPollTimerRef.current) {
      window.clearTimeout(historyPollTimerRef.current);
      historyPollTimerRef.current = null;
    }
    setHistoryPolling(false);
  };

  const scheduleHistoryPolling = (historyId: string) => {
    if (!historyId || !getAuthToken()) return;
    if (historyPollTimerRef.current) {
      window.clearTimeout(historyPollTimerRef.current);
    }
    setHistoryPolling(true);
    const poll = async () => {
      try {
        const detail = await getArtifactHistory(historyId);
        if (detail?.status === 'done' && detail?.response) {
          stopHistoryPolling();
          historySkipCountRef.current = 1;
          lastSavedHashRef.current = hashString(detail.response);
          parseAndSetHtml(detail.response, true);
          setHistoryItems(prev =>
            prev.map(item =>
              item.id === detail.id
                ? {
                    ...item,
                    status: detail.status,
                    errorMessage: detail.errorMessage,
                    updatedAt: detail.updatedAt,
                    name: detail.name || item.name,
                    provider: detail.provider
                  }
                : item
            )
          );
          return;
        }
        if (detail?.status === 'error') {
          stopHistoryPolling();
          setHistoryItems(prev =>
            prev.map(item =>
              item.id === detail.id
                ? {
                    ...item,
                    status: detail.status,
                    errorMessage: detail.errorMessage,
                    updatedAt: detail.updatedAt
                  }
                : item
            )
          );
          return;
        }
      } catch (error) {
        stopHistoryPolling();
        return;
      }
      historyPollTimerRef.current = window.setTimeout(poll, 1200);
    };
    historyPollTimerRef.current = window.setTimeout(poll, 1200);
  };
  useEffect(() => {
    return () => {
      stopHistoryPolling();
    };
  }, []);

  const applyHistorySnapshot = (snapshot: HistorySnapshot, preserveIndex = false) => {
    applyingHistoryRef.current = true;
    historySuspendUntilRef.current = Date.now() + 80;
    historyLastHashRef.current = getHistoryHash(snapshot);
    suppressPreviewReloadRef.current = false;
    setPreviewRevision(prev => prev + 1);
    setHeadContent(snapshot.headContent);
    setArtifacts(snapshot.artifacts);
    if (!preserveIndex) {
      setCurrentArtifactIndex(snapshot.currentArtifactIndex);
    }
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
    applyHistorySnapshot(previous, true);
  };

  const performRedo = () => {
    const history = historyRef.current;
    if (history.future.length === 0) return;
    const next = history.future.pop() as HistorySnapshot;
    history.past.push(next);
    applyHistorySnapshot(next, true);
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
    convertVideoImages(doc);

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
      :root {
        --ae2-anim-offset: 0s;
      }
      .artifact, .slide,
      .artifact *, .slide *,
      .artifact *::before, .artifact *::after,
      .slide *::before, .slide *::after {
        animation-delay: calc(var(--ae2-anim-offset, 0s) * -1) !important;
        animation-play-state: paused !important;
        animation-iteration-count: 1 !important;
        animation-fill-mode: both !important;
      }
      :root[data-ae2-play="true"] .artifact,
      :root[data-ae2-play="true"] .slide,
      :root[data-ae2-play="true"] .artifact *,
      :root[data-ae2-play="true"] .slide *,
      :root[data-ae2-play="true"] .artifact *::before,
      :root[data-ae2-play="true"] .artifact *::after,
      :root[data-ae2-play="true"] .slide *::before,
      :root[data-ae2-play="true"] .slide *::after {
        animation-play-state: running !important;
      }
      :root[data-ae2-restart="true"] .artifact,
      :root[data-ae2-restart="true"] .slide,
      :root[data-ae2-restart="true"] .artifact *,
      :root[data-ae2-restart="true"] .slide *,
      :root[data-ae2-restart="true"] .artifact *::before,
      :root[data-ae2-restart="true"] .artifact *::after,
      :root[data-ae2-restart="true"] .slide *::before,
      :root[data-ae2-restart="true"] .slide *::after {
        animation: none !important;
      }
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

    const maxIndex = Math.max(0, sections.length - 1);
    const urlIndex = getSlideIndexFromUrl();
    const forcedIndex =
      desiredArtifactIndexRef.current != null
        ? Math.min(Math.max(0, desiredArtifactIndexRef.current), maxIndex)
        : urlIndex != null
          ? Math.min(Math.max(0, urlIndex), maxIndex)
          : null;
    const nextIndex =
      forcedIndex != null
        ? forcedIndex
        : preserveIndex
          ? Math.min(currentArtifactIndex, maxIndex)
          : 0;
    desiredArtifactIndexRef.current = null;

      if (sections.length > 0) {
        const nextHead = doc.head.innerHTML;
        const artifactHtmls = sections.map((section, i) => {
          normalizeArtifactClassOrder(section, i + 1, resolvedIncludeSlides);
          return section.outerHTML;
        });
        historyImmediateNextRef.current = true;
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
        historyImmediateNextRef.current = true;
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
       const match = style?.match(/url(['"]?(.*?)['"]?)/);
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

  const formatTimecode = (value: number) => {
    const safe = Math.max(0, value);
    const fps = Math.max(1, Math.round(exportFps));
    const totalFrames = Math.floor(safe * fps);
    const frames = totalFrames % fps;
    const seconds = Math.floor(safe) % 60;
    const minutes = Math.floor(safe / 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
  };

  const restartAnimations = () => {
    let root = timelineRootRef.current;
    if (!root) {
      root = iframeRef.current?.contentDocument?.documentElement as HTMLElement | null;
      if (root) {
        timelineRootRef.current = root;
        timelineAppliedOffsetRef.current = null;
      }
    }
    if (!root) return;
    root.setAttribute('data-ae2-restart', 'true');
    window.requestAnimationFrame(() => {
      root?.removeAttribute('data-ae2-restart');
    });
  };

  const setTimelinePlayState = (isPlaying: boolean) => {
    let root = timelineRootRef.current;
    if (!root) {
      root = iframeRef.current?.contentDocument?.documentElement as HTMLElement | null;
      if (root) {
        timelineRootRef.current = root;
      }
    }
    if (!root) return;
    root.setAttribute('data-ae2-play', isPlaying ? 'true' : 'false');
  };

  const applyTimelineOffset = (nextTime: number) => {
    const duration = Math.max(exportDuration, 0);
    const clamped = Math.min(Math.max(nextTime, 0), duration);
    let root = timelineRootRef.current;
    if (!root) {
      root = iframeRef.current?.contentDocument?.documentElement as HTMLElement | null;
      if (root) {
        timelineRootRef.current = root;
        timelineAppliedOffsetRef.current = null;
      }
    }
    if (root) {
      const nextOffset = `${clamped}s`;
      if (timelineAppliedOffsetRef.current !== nextOffset) {
        root.style.setProperty('--ae2-anim-offset', nextOffset);
        timelineAppliedOffsetRef.current = nextOffset;
      }
    }
    restartAnimations();
    timelineTimeRef.current = clamped;
    setTimelineTime(clamped);
  };

  const updateTimelineTime = (nextTime: number) => {
    applyTimelineOffset(nextTime);
    timelineStartRef.current = performance.now();
    timelineStartTimeRef.current = timelineTimeRef.current;
  };

  const loadHistory = async () => {
    if (!getAuthToken()) {
      setHistoryItems([]);
      setHistoryError('Sign in to load artifacts.');
      setHistoryCursor(null);
      setHistoryHasMore(false);
      return;
    }
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryCursor(null);
    setHistoryHasMore(false);
    try {
      const { items, nextCursor, hasMore } = await listArtifactHistory({ limit: HISTORY_PAGE_SIZE });
      setHistoryItems(items);
      setHistoryCursor(nextCursor);
      setHistoryHasMore(hasMore);
      if (suppressAutoSelectRef.current) {
        suppressAutoSelectRef.current = false;
        return;
      }
      if (!currentHistoryId && items.length > 0) {
        const urlId = getArtifactIdFromUrl();
        const candidate = urlId && items.some(item => item.id === urlId) ? urlId : null;
        if (candidate) {
          const slideFromUrl = getSlideIndexFromUrl();
          if (slideFromUrl != null) {
            desiredArtifactIndexRef.current = slideFromUrl;
          }
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

  const loadHistoryMore = async () => {
    if (!getAuthToken()) return;
    if (historyLoading || historyLoadingMore) return;
    if (!historyHasMore || !historyCursor) return;
    setHistoryLoadingMore(true);
    setHistoryError(null);
    try {
      const { items, nextCursor, hasMore } = await listArtifactHistory({
        limit: HISTORY_PAGE_SIZE,
        cursor: historyCursor
      });
      setHistoryItems(prev => {
        if (items.length === 0) return prev;
        const seen = new Set(prev.map(item => item.id));
        const merged = [...prev];
        items.forEach(item => {
          if (!seen.has(item.id)) merged.push(item);
        });
        return merged;
      });
      setHistoryCursor(nextCursor);
      setHistoryHasMore(hasMore);
    } catch (error) {
      console.error(error);
      setHistoryError('Failed to load more artifacts.');
    } finally {
      setHistoryLoadingMore(false);
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
    stopHistoryPolling();
    setHistoryError(null);
    try {
      const slideFromUrl = getSlideIndexFromUrl();
      if (slideFromUrl != null) {
        desiredArtifactIndexRef.current = slideFromUrl;
      }
      const detail = await getArtifactHistory(id);
      if (!detail?.response) {
        setCurrentHistoryId(id);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(LAST_ARTIFACT_KEY, id);
        }
        if (detail?.status === 'pending') {
          scheduleHistoryPolling(id);
        }
        setHistoryItems(prev =>
          prev.map(item =>
            item.id === id
              ? {
                  ...item,
                  status: detail.status,
                  errorMessage: detail.errorMessage,
                  updatedAt: detail.updatedAt
                }
              : item
          )
        );
        return;
      }
      historySkipCountRef.current = 3;
      setCurrentHistoryId(id);
      historyRef.current = { past: [], future: [] };
      historyLastHashRef.current = null;
      setArtifactIdInUrl(id);
      lastSavedHashRef.current = hashString(detail.response);
      parseAndSetHtml(detail.response);
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
    stopHistoryPolling();
    suppressAutoSelectRef.current = true;
    setCurrentHistoryId(null);
    lastSavedHashRef.current = null;
    historyRef.current = { past: [], future: [] };
    historyLastHashRef.current = null;
    setArtifactIdInUrl(null);
    setArtifacts([]);
    setHeadContent('');
    setCurrentArtifactIndex(0);
    restoredArtifactIndexRef.current = null;
    if (typeof window !== 'undefined') {
      Object.keys(window.localStorage)
        .filter(key => key.startsWith(`${LAST_ARTIFACT_INDEX_KEY}:`))
        .forEach(key => window.localStorage.removeItem(key));
    }
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
    const hasContext = artifacts.length > 0;
    if (!currentHistoryId && !hasContext) {
      setArtifactMode(requestedMode);
    }
    setTopic('');
    const imageData = chatImage;
    setChatImage(null);
    setLoading(true);
    if (!currentHistoryId && !hasContext) {
      setArtifacts([]);
      setHeadContent('');
    }
    setErrorMsg(null);
        setStreamProgress({ active: true, text: 'Starting generation', total: 0 });
    try {
      const authToken = getAuthToken();
      const contextHtml = hasContext ? buildPersistedHtml(headContent, artifacts) : undefined;
      let generatedHtml = '';
      let persistedArtifact: any | null = null;
      const persistedName = (projectTitle || promptText).trim() || undefined;

      if (contextHtml) {
        if (authToken) {
          const result = await updateArtifactsFromContextPersisted(
            provider,
            promptText,
            artifactMode,
            contextHtml,
            imageProvider,
            mediaKind,
            {
              imageData,
              historyId: currentHistoryId,
              name: persistedName
            }
          );
          generatedHtml = result.text;
          persistedArtifact = result.artifact;
        } else {
          generatedHtml = await updateArtifactsFromContext(
            provider,
            promptText,
            artifactMode,
            contextHtml,
            imageProvider,
            mediaKind,
            imageData
          );
        }
      } else {
        generatedHtml = await generateArtifactsStream(
          provider,
          promptText,
          requestedMode,
          imageProvider,
          mediaKind,
          (event) => {
            if (requestId !== generateRequestIdRef.current) return;
            if (event.type === 'base') {
              const total = Number(event.total) || 0;
              setStreamProgress(prev => ({
                active: true,
                text: 'Preparing layout',
                total: total || prev.total
              }));
              return;
            }
            if (event.type === 'section' && typeof event.html === 'string') {
              const index = Number(event.index);
              if (!Number.isFinite(index)) return;
              if (event.head && typeof event.head === 'string') {
                setHeadContent(event.head);
              }
              setStreamProgress(prev => ({
                active: true,
                text: 'Refining artifacts',
                total: Number(event.total) || prev.total
              }));
              setArtifacts(prev => {
                const next = [...prev];
                if (index < 0) return prev;
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = event.html as string;
                sanitizeLayout(tempDiv);
                if (index >= next.length) {
                  while (next.length < index) {
                    next.push('');
                  }
                  next.push(tempDiv.innerHTML);
                } else {
                  next[index] = tempDiv.innerHTML;
                }
                return reindexArtifactClasses(next, includeSlideClass);
              });
              return;
            }
            if (event.type === 'images') {
              setStreamProgress(prev => ({
                active: true,
                text: 'Loading images',
                total: prev.total
              }));
              return;
            }
            if (event.type === 'done') {
              setStreamProgress(prev => ({
                ...prev,
                active: true,
                text: 'Finalizing'
              }));
            }
          },
          imageData,
          { autoRefine }
        );
      }
      if (requestId !== generateRequestIdRef.current) return;
      historyImmediateNextRef.current = true;
      const parsed = parseAndSetHtml(generatedHtml, Boolean(contextHtml));
      if (parsed && getAuthToken()) {
        const { title } = parseHeadMetadata(parsed.headHtml);
        const name = (title || projectTitle || promptText).trim() || 'Untitled Project';
        const responseHtml = buildPersistedHtml(parsed.headHtml, parsed.artifacts);
        const persistedId = persistedArtifact?._id || persistedArtifact?.id;
        const resolvedId = persistedId || currentHistoryId;

        if (persistedArtifact?.status === 'pending') {
          const pollTarget = resolvedId || persistedArtifact?._id || persistedArtifact?.id;
          if (pollTarget) {
            scheduleHistoryPolling(pollTarget);
          }
        }

        if (!resolvedId) {
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
          if (!currentHistoryId) {
            setCurrentHistoryId(resolvedId);
            if (typeof window !== 'undefined') {
              window.localStorage.setItem(LAST_ARTIFACT_KEY, resolvedId);
            }
          }
          const updated = await updateArtifactHistory(resolvedId, {
            name,
            provider,
            prompt: promptText,
            response: responseHtml
          });
          lastSavedHashRef.current = hashString(responseHtml);
          setHistoryItems(prev => {
            const nextItem = {
              ...updated,
              id: updated.id
            };
            const filtered = prev.filter(item => item.id !== updated.id);
            return [nextItem, ...filtered];
          });
        }
      }
    } catch (error: any) {
      console.error(error);
      setStreamProgress({ active: false, text: '', total: 0 });
      if (error?.status === 429 || error?.message?.includes('429')) {
        setErrorMsg("We're experiencing high traffic. Please wait a moment and try again.");
      } else {
        setErrorMsg("Failed to generate artifacts. Please try again.");
      }
    } finally {
      if (requestId === generateRequestIdRef.current) {
        setLoading(false);
        setStreamProgress(prev => (prev.active ? { active: false, text: prev.text, total: prev.total } : prev));
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const regenerateSingleArtifact = async (
    index: number,
    excludedImages: string[],
    cssContext: string,
    contextHtml?: string
  ) => {
    const currentContent = artifacts[index];
    const newArtifactHtml = await regenerateArtifact(
      provider,
      topic,
      currentContent,
      cssContext,
      excludedImages,
      artifactMode,
      imageProvider,
      mediaKind,
      undefined,
      contextHtml
    );
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newArtifactHtml;
    sanitizeLayout(tempDiv);
    return tempDiv.innerHTML;
  };

  const extractAnimatedArtifact = (html: string, index: number) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    sanitizeLayout(doc);
    convertVideoImages(doc);
    const sections = collectArtifactElements(doc);
    if (sections.length > 0) {
      normalizeArtifactClassOrder(sections[0], index + 1, includeSlideClass);
      return { headHtml: doc.head.innerHTML, artifactHtml: sections[0].outerHTML };
    }
    const fallback = doc.body.innerHTML.trim();
    const wrapperClass = includeSlideClass ? 'artifact slide' : 'artifact';
    return {
      headHtml: doc.head.innerHTML,
      artifactHtml: `<section class="${wrapperClass}">${fallback || ''}</section>`
    };
  };

  const handleRegenerateCurrentArtifact = async (mode: 'slide' | 'project') => {
    if (artifacts.length === 0) return;
    const requestId = ++regenerateRequestIdRef.current;
    setRegeneratingArtifact(true);
    try {
      pendingSaveDelayRef.current = 200;
      if (mode === 'project') {
        const cssContext = getCssContext();
        const nextArtifacts = [...artifacts];
        const used = new Set<string>();

        for (let i = 0; i < artifacts.length; i += 1) {
          const excluded = Array.from(used);
          const contextHtml = i > 0 ? buildPersistedHtml(headContent, nextArtifacts.slice(0, i)) : '';
          const regenerated = await regenerateSingleArtifact(i, excluded, cssContext, contextHtml);
          if (requestId !== regenerateRequestIdRef.current) return;
          nextArtifacts[i] = regenerated;
          extractImageUrlsFromHtml(regenerated).forEach(url => used.add(url));
        }

        historyImmediateNextRef.current = true;
        setArtifacts(reindexArtifactClasses(nextArtifacts, includeSlideClass));
        await saveHistorySnapshot(reindexArtifactClasses(nextArtifacts, includeSlideClass));
        return ;
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

  const handleAnimateArtifacts = async (mode: 'slide' | 'project' = 'slide') => {
    if (artifacts.length === 0) return;
    const requestId = ++animateRequestIdRef.current;
    setAnimatingArtifact(true);
    try {
      pendingSaveDelayRef.current = 200;
      const cssContext = getCssContext();

      if (mode === 'project') {
        const contextHtml = buildPersistedHtml(headContent, artifacts);
        const animatedHtml = await applyMotionToHtml(
          provider,
          topic,
          artifactMode,
          contextHtml,
          cssContext
        );
        if (requestId !== animateRequestIdRef.current) return;
        const parsed = parseAndSetHtml(animatedHtml, true);
        if (parsed) {
          await saveHistorySnapshot(parsed.artifacts, parsed.headHtml);
        }
        return;
      }

      const cleanHead = stripRuntimeHead(headContent);
      const singleHtml = buildArtifactHtml(cleanHead, artifacts[currentArtifactIndex]);
      const animatedHtml = await applyMotionToHtml(
        provider,
        topic,
        artifactMode,
        singleHtml,
        cssContext
      );
      if (requestId !== animateRequestIdRef.current) return;
      const parsed = extractAnimatedArtifact(animatedHtml, currentArtifactIndex);
      const nextArtifacts = [...artifacts];
      nextArtifacts[currentArtifactIndex] = parsed.artifactHtml;
      const reindexed = reindexArtifactClasses(nextArtifacts, includeSlideClass);
      historyImmediateNextRef.current = true;
      setHeadContent(parsed.headHtml);
      setArtifacts(reindexed);
      await saveHistorySnapshot(reindexed, parsed.headHtml);
    } catch (error) {
      console.error(error);
    } finally {
      if (requestId === animateRequestIdRef.current) {
        setAnimatingArtifact(false);
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
      const contextHtml = buildPersistedHtml(headContent, artifacts);

      const newArtifactHtml = await generateNewArtifact(
        provider,
        topic,
        cssContext,
        contextHtml,
        excluded,
        artifactMode,
        imageProvider,
        mediaKind
      );
      if (requestId !== addArtifactRequestIdRef.current) return;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newArtifactHtml;
      sanitizeLayout(tempDiv);
      
      const insertIndex = Math.min(currentArtifactIndex + 1, artifacts.length);
      const nextArtifacts = [...artifacts];
      nextArtifacts.splice(insertIndex, 0, tempDiv.innerHTML);
      const newArtifacts = reindexArtifactClasses(nextArtifacts, includeSlideClass);
      historyImmediateNextRef.current = true;
      setArtifacts(newArtifacts);
      setCurrentArtifactIndex(insertIndex);
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

  const buildPreviewHtml = (headHtml: string, artifactHtml: string, index: number, revision: number) => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${headHtml}
          <style>${PREVIEW_EDITOR_STYLE}</style>
          <meta name="ae2-preview-rev" content="${revision}">
        </head>
        <body data-ae2-artifact-index="${index}">
          ${artifactHtml}
          <script>${PREVIEW_EDITOR_SCRIPT}</script>
        </body>
      </html>
    `;
  };

  const buildGridHtml = (headHtml: string, artifactHtmls: string[]) => {
    const cells = Array.from({ length: GRID_CELL_COUNT }, (_, index) => {
      const artifactHtml = artifactHtmls[index];
      if (!artifactHtml) {
        return '<div class="ae2-grid-cell ae2-grid-empty"></div>';
      }
      const artifactDoc = buildArtifactHtml(headHtml, artifactHtml);
      const artifactSrc = `data:text/html;charset=utf-8,${encodeURIComponent(artifactDoc)}`;
      return `
        <div class="ae2-grid-cell">
          <div class="ae2-grid-scale">
            <iframe
              class="ae2-grid-frame"
              src="${artifactSrc}"
              title="Artifact Grid Item"
              sandbox="allow-same-origin"
            ></iframe>
          </div>
        </div>
      `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          ${headHtml}
          <style>
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              background: #0b0f14;
            }
            .ae2-grid {
              width: 100%;
              height: 100%;
              display: grid;
              gap: 3px;
              grid-template-columns: repeat(${GRID_DIMENSION}, 1fr);
              grid-template-rows: repeat(${GRID_DIMENSION}, 1fr);
            }
            .ae2-grid-cell {
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
              border: 1px solid rgba(255, 255, 255, 0.04);
            }
            .ae2-grid-empty {
              background: #0b0f14;
            }
            .ae2-grid-scale {
              position: absolute;
              left: 50%;
              top: 50%;
              width: ${PREVIEW_BASE_WIDTH}px;
              height: ${PREVIEW_BASE_HEIGHT}px;
              transform: translate(-50%, -50%) scale(${GRID_SCALE});
              transform-origin: center;
            }
            .ae2-grid-frame {
              width: 100%;
              height: 100%;
              border: 0;
              display: block;
              pointer-events: none;
            }
          </style>
        </head>
        <body>
          <div class="ae2-grid">
            ${cells}
          </div>
        </body>
      </html>
    `;
  };

  const getArtifactHtmlByIndex = (index: number) => {
    if (artifacts.length === 0) return'';
    return buildArtifactHtml(getHeadHtml(), artifacts[index]);
  };

  const loadArtifactIntoExportIframe = (index: number) => {
    return new Promise<Window>((resolve, reject) => {
      const iframe = exportIframeRef.current;
      if (!iframe) {
        reject(new Error('Missing export iframe.'));
        return ;
      }

      const handleLoad = () => {
        iframe.removeEventListener('load', handleLoad);
        if (!iframe.contentWindow) {
          reject(new Error('Missing iframe contentWindow.'));
          return ;
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

  const stabilizeLayout = async (win: Window) => {
    const doc = win.document as Document & { fonts?: FontFaceSet };
    const fonts = doc.fonts;
    if (fonts && typeof fonts.ready?.then === 'function') {
      try {
        await fonts.ready;
      } catch (err) {
        console.warn('Font loading wait failed:', err);
      }
    }
    await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
    await new Promise<void>(resolve => win.requestAnimationFrame(() => resolve()));
  };

  const getArtifactElement = (doc: Document) =>
    doc.querySelector('.artifact') || doc.querySelector('.slide') || doc.body;

  const extractJsonFromIframe = async (win: Window) => {
    const doc = win.document;
    const artifactElement = getArtifactElement(doc);

    if (!artifactElement) {
      throw new Error('Could not find artifact content to export.');
    }

    await stabilizeLayout(win);
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
      const artifactElement = getArtifactElement(win.document);
      if (!artifactElement) {
        throw new Error('Could not find artifact content to export.');
      }
      const pallete = extractScenePalette(headContent, win, artifactElement);
      const jsonStructure = await extractJsonFromIframe(win);
      const usedHex = new Set<string>();
      collectUsedHexColors((jsonStructure as any).root, usedHex);
      const filteredPallete = filterPaletteByUsedColors(pallete, usedHex);

      const jsonString = JSON.stringify({ ...jsonStructure, pallete: filteredPallete }, null, 2);
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
      const results: Array<{ jsonStructure: any; pallete: ScenePaletteEntry[] }> = [];
      for (let i = 0; i < artifacts.length; i += 1) {
        const win = await loadArtifactIntoExportIframe(i);
        const artifactElement = getArtifactElement(win.document);
        if (!artifactElement) {
          throw new Error('Could not find artifact content to export.');
        }
        const pallete = extractScenePalette(headContent, win, artifactElement);
        const jsonStructure = await extractJsonFromIframe(win);
        const usedHex = new Set<string>();
        collectUsedHexColors((jsonStructure as any).root, usedHex);
        const filteredPallete = filterPaletteByUsedColors(pallete, usedHex);
        results.push({ jsonStructure, pallete: filteredPallete });
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
      const artifactsPayload = results.map(({ jsonStructure, pallete }) => {
        const artifactId =
          (jsonStructure as { artifactId?: string; slideId?: string }).artifactId ||
          (jsonStructure as { slideId?: string }).slideId ||
          '';
        const { settings: _settings, ...rest } = jsonStructure as Record<string, any>;
        return {
          ...rest,
          artifactId,
          pallete
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
      return previewHtml || buildPreviewHtml(getHeadHtml(), artifacts[currentArtifactIndex], currentArtifactIndex, previewRevision);
    }
    if (viewMode === 'grid') {
      return buildGridHtml(getHeadHtml(), artifacts);
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
      return ;
    }
    if (!isCodeDirty) {
      setCodeDraft(getAllArtifactsHtml());
    }
  }, [viewMode, headContent, artifacts, animationsEnabled, isCodeDirty]);

  useEffect(() => {
    if (viewMode !== 'preview') return;
    if (artifacts.length === 0) {
      setPreviewHtml('');
      return ;
    }
    if (suppressPreviewReloadRef.current) {
      suppressPreviewReloadRef.current = false;
      return ;
    }
    const html = buildPreviewHtml(getHeadHtml(), artifacts[currentArtifactIndex], currentArtifactIndex, previewRevision);
    setPreviewHtml(html);
  }, [viewMode, headContent, artifacts, currentArtifactIndex, animationsEnabled, previewRevision]);

  useEffect(() => {
    artifactsRef.current = artifacts;
  }, [artifacts]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUTO_REFINE_KEY, autoRefine ? 'true' : 'false');
  }, [autoRefine]);

  useEffect(() => {
    if (viewMode !== 'preview') return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'ae2-layer-panel', type: 'request-layers' }, '*');
  }, [viewMode, previewHtml, currentArtifactIndex]);

  useEffect(() => {
    if (viewMode !== 'preview') return;
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    const postState = () => {
      win.postMessage(
        { source: 'ae2-layer-panel', type: 'layer-state', hidden: previewHidden, locked: previewLocked },
        '*'
      );
    };
    postState();
    const timer = window.setTimeout(postState, 60);
    return () => window.clearTimeout(timer);
  }, [viewMode, previewHidden, previewLocked, previewHtml, currentArtifactIndex]);

  useEffect(() => {
    if (prevViewModeRef.current === 'code' && viewMode !== 'code') {
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
      const payload = event.data as {
        source?: string;
        type?: string;
        html?: string;
        layers?: PreviewLayer[];
        id?: string | null;
        ids?: string[];
      };
      if (!payload || payload.source !== 'ae2-preview-editor') return;
      if (payload.type === 'layers') {
        setPreviewLayers(Array.isArray(payload.layers) ? payload.layers : []);
        return;
      }
      if (payload.type === 'selection') {
        if (Array.isArray(payload.ids)) {
          const nextIds = payload.ids.filter((id): id is string => !!id);
          setPreviewSelectionIds(nextIds);
        } else if (payload.id) {
          const id = typeof payload.id === 'string' ? payload.id : '';
          if (id) {
            setPreviewSelectionIds([id]);
          }
        } else {
          setPreviewSelectionIds([]);
        }
        return;
      }
      if (payload.type === 'undo') {
        performUndo();
        return ;
      }
      if (payload.type === 'redo') {
        performRedo();
        return ;
      }
      if (payload.type !== 'update') return;
      if (!payload.html) return;

      suppressPreviewReloadRef.current = true;
      historySkipCountRef.current = 0;
      pendingSaveDelayRef.current = 400;
      const currentArtifacts = artifactsRef.current;
      if (currentArtifacts.length === 0) return;
      queueHistorySnapshot(
        {
          headContent,
          artifacts: currentArtifacts,
          currentArtifactIndex,
          artifactMode
        },
        true
      );
      const next = [...currentArtifacts];
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = payload.html as string;
      sanitizeLayout(tempDiv);
      next[currentArtifactIndex] = tempDiv.innerHTML;
      const reindexed = reindexArtifactClasses(next, includeSlideClass);
      queueHistorySnapshot(
        {
          headContent,
          artifacts: reindexed,
          currentArtifactIndex,
          artifactMode
        },
        true
      );
      setArtifacts(reindexed);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentArtifactIndex, includeSlideClass, headContent, artifactMode]);

  useEffect(() => {
    if (!historyOverlayOpen) return;
    if (!shouldAutoCloseOverlay()) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [historyOverlayOpen]);

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

  const handleLayerToggle = (id: string) => {
    setPreviewLayerExpanded(prev => ({
      ...prev,
      [id]: !(prev[id] ?? false)
    }));
  };

  const handleLayerVisibilityToggle = (id: string) => {
    setPreviewHidden(prev => ({
      ...prev,
      [id]: !(prev[id] ?? false)
    }));
  };

  const handleLayerLockToggle = (id: string) => {
    setPreviewLocked(prev => ({
      ...prev,
      [id]: !(prev[id] ?? false)
    }));
  };

  const handleLayerHover = (id: string | null) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ source: 'ae2-layer-panel', type: 'hover', id }, '*');
  };

  const handleLayerSelect = (id: string, event?: React.MouseEvent<HTMLDivElement>) => {
    if (previewHidden[id] || previewLocked[id]) return;
    const isMulti = !!(event && (event.ctrlKey || event.metaKey));
    setPreviewSelectionIds(prev => {
      if (!isMulti) return [id];
      if (prev.includes(id)) {
        return prev.filter(item => item !== id);
      }
      return [...prev, id];
    });
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        { source: 'ae2-layer-panel', type: 'select', id, mode: isMulti ? 'toggle' : 'replace' },
        '*'
      );
    }
  };

  const getDropPosition = (event: React.DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    const ratio = rect.height ? offset / rect.height : 0;
    if (ratio < 0.25) return 'before';
    if (ratio > 0.75) return 'after';
    return 'inside';
  };

  const handleLayerDragStart = (id: string, event: React.DragEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target && target.closest('button')) {
      event.preventDefault();
      return;
    }
    setPreviewDragId(id);
    setPreviewDropTarget(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', id);
  };

  const handleLayerDragOver = (id: string, event: React.DragEvent<HTMLDivElement>) => {
    if (!previewDragId) return;
    event.preventDefault();
    if (id === previewDragId) return;
    const position = getDropPosition(event);
    setPreviewDropTarget(prev => {
      if (prev && prev.id === id && prev.position === position) return prev;
      return { id, position };
    });
  };

  const handleLayerDrop = (id: string, event: React.DragEvent<HTMLDivElement>) => {
    if (!previewDragId) return;
    event.preventDefault();
    const dragId = previewDragId || event.dataTransfer.getData('text/plain');
    const position = getDropPosition(event);
    setPreviewDragId(null);
    setPreviewDropTarget(null);
    if (!dragId || dragId === id) return;
    const win = iframeRef.current?.contentWindow;
    if (win) {
      win.postMessage(
        { source: 'ae2-layer-panel', type: 'move-layer', id: dragId, targetId: id, position },
        '*'
      );
    }
  };

  const handleLayerDragEnd = () => {
    setPreviewDragId(null);
    setPreviewDropTarget(null);
  };

  const renderLayerTree = (nodes: PreviewLayer[], depth = 0): React.ReactNode[] => {
    if (!nodes.length) return [];
    return nodes.flatMap(node => {
      if (!node || !node.id) return [];
      const expanded = previewLayerExpanded[node.id] ?? false;
      const isHidden = !!previewHidden[node.id];
      const isLocked = !!previewLocked[node.id];
      const hasChildren = !!(node.children && node.children.length);
      const dropPosition = previewDropTarget?.id === node.id ? previewDropTarget.position : null;
      const row = (
        <div
          key={`layer-${node.id}`}
          className={`flex items-center gap-2 px-3 py-1 text-xs cursor-pointer ${
            previewSelectionIds.includes(node.id) ? 'bg-sky-500/20 text-white' : 'text-white/80'
          }${dropPosition === 'inside' ? ' bg-sky-500/10' : ''}${
            dropPosition === 'before' ? ' border-t border-sky-400/70' : ''
          }${dropPosition === 'after' ? ' border-b border-sky-400/70' : ''}`}
          style={{ paddingLeft: 12 + depth * 16 }}
          onClick={(event) => handleLayerSelect(node.id, event)}
          onMouseEnter={() => {
            if (!isHidden && !isLocked) handleLayerHover(node.id);
          }}
          onMouseLeave={() => handleLayerHover(null)}
          draggable
          onDragStart={(event) => handleLayerDragStart(node.id, event)}
          onDragOver={(event) => handleLayerDragOver(node.id, event)}
          onDrop={(event) => handleLayerDrop(node.id, event)}
          onDragEnd={handleLayerDragEnd}
        >
          <span className="flex items-center gap-2">
            <button
              type="button"
              className={`w-5 h-5 flex items-center justify-center rounded border ${
                isHidden ? 'border-sky-400 text-sky-200' : 'border-white/15 text-white/40'
              }`}
              title={isHidden ? 'Show layer' : 'Hide layer'}
              onClick={(e) => {
                e.stopPropagation();
                handleLayerVisibilityToggle(node.id);
              }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                {isHidden ? (
                  <>
                    <path d="M4 12c2.5-4 5.8-6 8-6s5.5 2 8 6c-2.5 4-5.8 6-8 6s-5.5-2-8-6z" />
                    <path d="M4 4l16 16" />
                  </>
                ) : (
                  <>
                    <path d="M4 12c2.5-4 5.8-6 8-6s5.5 2 8 6c-2.5 4-5.8 6-8 6s-5.5-2-8-6z" />
                    <circle cx="12" cy="12" r="2.5" />
                  </>
                )}
              </svg>
            </button>
            <button
              type="button"
              className={`w-5 h-5 flex items-center justify-center rounded border ${
                isLocked ? 'border-sky-400 text-sky-200' : 'border-white/15 text-white/40'
              }`}
              title={isLocked ? 'Unlock layer' : 'Lock layer'}
              onClick={(e) => {
                e.stopPropagation();
                handleLayerLockToggle(node.id);
              }}
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.6">
                {isLocked ? (
                  <>
                    <rect x="6" y="10" width="12" height="10" rx="2" />
                    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
                  </>
                ) : (
                  <>
                    <rect x="6" y="10" width="12" height="10" rx="2" />
                    <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0" />
                  </>
                )}
              </svg>
            </button>
          </span>
          {hasChildren ? (
            <button
              type="button"
              className="w-4 h-4 text-[10px] flex items-center justify-center border border-white/20 rounded bg-black/30 text-sky-200 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                handleLayerToggle(node.id);
              }}
            >
              {expanded ? 'v' : '>'}
            </button>
          ) : (
            <span className="inline-block w-4 h-4 shrink-0" />
          )}
          <span className="truncate">{node.id}</span>
        </div>
      );
      const children = hasChildren && expanded ? renderLayerTree(node.children, depth + 1) : [];
      return [row, ...children];
    });
  };

  const isEmpty = artifacts.length === 0;
  const placeholderCounts = useMemo(() => countPlaceholders(artifacts), [artifacts]);
  const shouldAutoCloseOverlay = () =>
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(max-width: 1023px)').matches;
  const isOverlayModal = shouldAutoCloseOverlay();

  return (
    <div className={`flex flex-col gap-4${isEmpty ? ' min-h-[calc(100vh-7rem)]' : ''}`}>
      <style>{LOADER_STYLE}</style>
      {historyOverlayOpen ? (
        <div className={`fixed inset-0 z-[60]${isOverlayModal ? '' : ' pointer-events-none'}`}>
          {isOverlayModal ? (
            <button
              type="button"
              className="absolute inset-0 bg-transparent"
              onClick={onHistoryOverlayClose}
              aria-label="Close artifacts overlay"
            />
          ) : null}
          <div className="absolute left-0 top-0 h-full w-[85vw] max-w-xs sm:max-w-sm p-0 pointer-events-auto">
            <ArtifactHistoryPanel
              items={historyItems}
              loading={historyLoading}
              loadingMore={historyLoadingMore}
              hasMore={historyHasMore}
              selectedId={currentHistoryId}
              error={historyError}
              onSelect={(id) => {
                handleHistorySelect(id);
                if (shouldAutoCloseOverlay()) {
                  onHistoryOverlayClose?.();
                }
              }}
              onDelete={handleHistoryDelete}
              onRefresh={loadHistory}
              onLoadMore={loadHistoryMore}
              onNewChat={() => {
                handleNewChat();
                if (shouldAutoCloseOverlay()) {
                  onHistoryOverlayClose?.();
                }
              }}
              onClose={onHistoryOverlayClose}
              variant="overlay"
            />
          </div>
        </div>
      ) : null}
      <div className="flex flex-col gap-4">
        <div className={`flex min-w-0 flex-1 flex-col gap-4${isEmpty ? ' min-h-[calc(100vh-7rem)]' : ''}`}>
          {artifacts.length > 0 ? (
            <div className="flex flex-col gap-4">
              <ProjectMetadataPanel
                previewWidth={previewSize.width}
                projectTitle={projectTitle}
                projectTags={projectTags}
                projectDescription={projectDescription}
                mediaPlaceholderCount={placeholderCounts.media}
                textPlaceholderCount={placeholderCounts.text}
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

              <div className="flex flex-col items-center gap-4">
                {streamProgress.active ? (
                  <div
                    className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/80"
                    style={{ width: previewSize.width, maxWidth: '100%' }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{streamProgress.text || 'Generating artifacts'}</span>
                    </div>
                    <div className="h-1 w-full overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full rounded"
                        style={{
                          width: '30%',
                          backgroundColor: 'rgba(255,255,255,0.7)',
                          animation: 'ae2-indeterminate 2.6s linear infinite',
                          position: 'relative',
                          willChange: 'left'
                        }}
                      />
                    </div>
                  </div>
                ) : null}

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

                {viewMode === 'preview' ? (
                  <div className="w-full max-w-6xl px-4">
                    <div className="rounded-xl border border-white/10 bg-neutral-950/80">
                      <div className="px-4 py-2 text-[11px] uppercase tracking-[0.12em] text-sky-200 border-b border-white/10 flex items-center justify-between">
                        <span>Timeline</span>
                        <span className="text-[10px] text-white/40">
                          {formatTimecode(timelineTime)} / {formatTimecode(exportDuration)}
                        </span>
                      </div>
                      {/*
                      <div className="px-4 py-3 border-b border-white/10 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (timelinePlaying) {
                                setTimelinePlaying(false);
                                return;
                              }
                              applyTimelineOffset(timelineTimeRef.current);
                              setTimelinePlaying(true);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] rounded border border-white/15 text-white/80 hover:text-white hover:border-white/30"
                          >
                            {timelinePlaying ? 'Pause' : 'Play'}
                          </button>
                          <div className="text-[11px] text-white/50">Loop</div>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(exportDuration, 0)}
                          step={1 / Math.max(1, Math.round(exportFps))}
                          value={timelineTime}
                          onChange={(event) => updateTimelineTime(Number(event.target.value))}
                          className="w-full"
                          aria-label="Timeline position"
                        />
                      </div>
                      */}
                      <div className="h-32 overflow-auto py-1">
                        {previewLayers.length > 0 ? (
                          renderLayerTree(previewLayers)
                        ) : (
                          <div className="px-4 py-2 text-xs text-white/50">
                            No layers with id.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

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
                    onRegenerateCurrent={() => handleRegenerateCurrentArtifact('slide')}
                    onRegenerateAll={() => handleRegenerateCurrentArtifact('project')}
                    regenerating={regeneratingArtifact}
                    // onAnimate={handleAnimateArtifacts}
                    // animating={animatingArtifact}
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
            <div className="flex flex-1 items-center justify-center px-4 pb-2">
              <div style={{ width: '100%', maxWidth: 720 }}>
                {streamProgress.active ? (
                  <div className="mb-4 flex justify-center">
                    <div
                      className="mx-auto flex flex-col gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/80"
                      style={{ width: previewSize.width, maxWidth: '100%' }}
                    >
                      <div className="flex items-center justify-between">
                        <span>{streamProgress.text || 'Generating artifacts'}</span>
                      </div>
                    <div className="h-1 w-full overflow-hidden rounded bg-white/10">
                      <div
                        className="h-full rounded"
                        style={{
                          width: '30%',
                          backgroundColor: 'rgba(255,255,255,0.7)',
                          animation: 'ae2-indeterminate 2.6s linear infinite',
                          position: 'relative',
                          willChange: 'left'
                        }}
                      />
                    </div>
                    </div>
                  </div>
                ) : null}
                <GeneratorInput
                  errorMsg={errorMsg}
                  provider={provider}
                  onProviderChange={setProvider}
                  imageProvider={imageProvider}
                  imageProviderOptions={IMAGE_PROVIDER_OPTIONS}
                  onImageProviderChange={setImageProvider}
                  mediaKind={mediaKind}
                  mediaKindOptions={MEDIA_KIND_OPTIONS}
                  onMediaKindChange={setMediaKind}
                  autoRefine={autoRefine}
                  onAutoRefineChange={setAutoRefine}
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
          )}
          {artifacts.length > 0 ? (
            <div className="flex justify-center px-4 pb-2">
              <div style={{ width: previewSize.width, maxWidth: '100%' }}>
                <GeneratorInput
                  errorMsg={errorMsg}
                  provider={provider}
                  onProviderChange={setProvider}
                  imageProvider={imageProvider}
                  imageProviderOptions={IMAGE_PROVIDER_OPTIONS}
                  onImageProviderChange={setImageProvider}
                  mediaKind={mediaKind}
                  mediaKindOptions={MEDIA_KIND_OPTIONS}
                  onMediaKindChange={setMediaKind}
                  autoRefine={autoRefine}
                  onAutoRefineChange={setAutoRefine}
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
          ) : null}
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























