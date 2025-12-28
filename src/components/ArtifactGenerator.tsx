import React, { useState, useRef, useEffect } from 'react';
import {
  generateArtifacts,
  regenerateArtifact,
  generateNewArtifact,
  ImageProviderName,
  ArtifactMode
} from '../services/aiService';
import { extractSlideLayout as extractArtifactLayout } from '../utils/aeExtractor/index';
import { Loader2, Sparkles, Code, Play, RefreshCw, ChevronLeft, ChevronRight, Plus, Trash2, AlertCircle, Send, Presentation, FileJson, Check, Copy } from 'lucide-react';

const URL_TEXT_RE = /^https?:\/\/\S+$/i;

const RESOLUTION_OPTIONS = [
  { id: '1080p', label: 'Full HD (1920x1080)', width: 1920, height: 1080 },
  { id: '2k', label: '2K (2560x1440)', width: 2560, height: 1440 },
  { id: '4k', label: '4K (3840x2160)', width: 3840, height: 2160 }
];

const FPS_OPTIONS = [30, 60];
const IMAGE_PROVIDER_OPTIONS: { id: ImageProviderName; label: string }[] = [
  { id: 'random', label: 'Random (All)' },
  { id: 'pexels', label: 'Pexels' },
  { id: 'unsplash', label: 'Unsplash' },
  { id: 'pixabay', label: 'Pixabay' }
];
const PREVIEW_BASE_WIDTH = 1280;
const PREVIEW_BASE_HEIGHT = 720;

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
  sanitizeImageAlts(root);
  fixTextUrlBlocks(root);
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

export const ArtifactGenerator: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [headContent, setHeadContent] = useState<string>('');
  const [artifacts, setArtifacts] = useState<string[]>([]);
  const [currentArtifactIndex, setCurrentArtifactIndex] = useState(0);
  const [animationsEnabled, setAnimationsEnabled] = useState(false);
  const provider = 'gemini' as const;
  
  const [loading, setLoading] = useState(false);
  const [regeneratingArtifact, setRegeneratingArtifact] = useState(false);
  const [addingArtifact, setAddingArtifact] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
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
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const exportIframeRef = useRef<HTMLIFrameElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const prevViewModeRef = useRef<'preview' | 'code'>(viewMode);

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
    style.innerHTML = `
      html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; }
      body { background: #000; display: flex; align-items: center; justify-content: center; }
      /* Ensure artifacts fit the iframe bounds (container already keeps 16:9). */
      .artifact, .slide { width: 100% !important; height: 100% !important; overflow: hidden; position: relative; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
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
      setHeadContent(doc.head.innerHTML);
      const artifactHtmls = sections.map((section, i) => {
        normalizeArtifactClassOrder(section, i + 1, resolvedIncludeSlides);
        return section.outerHTML;
      });
      setArtifacts(artifactHtmls);
      setCurrentArtifactIndex(nextIndex);
      setArtifactMode(resolvedMode);
    } else {
      setHeadContent(doc.head.innerHTML);
      setArtifacts([doc.body.innerHTML]);
      setCurrentArtifactIndex(0);
      setArtifactMode(resolvedMode);
    }
  };

  const getUsedImageUrls = () => {
    if (artifacts.length === 0) return [];
    const allHtml = artifacts.join('');
    const parser = new DOMParser();
    const doc = parser.parseFromString(allHtml, 'text/html');
    const imgs = Array.from(doc.querySelectorAll('img')).map(img => img.src);
    const elementsWithStyle = doc.querySelectorAll('[style*="background-image"]');
    const bgImages = Array.from(elementsWithStyle).map(el => {
       const style = el.getAttribute('style');
       const match = style?.match(/url\(['"]?(.*?)['"]?\)/);
       return match ? match[1] : null;
    }).filter(Boolean) as string[];
    return [...new Set([...imgs, ...bgImages])];
  };

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!topic.trim()) return;

    const requestedMode = inferArtifactModeFromTopic(topic);
    setArtifactMode(requestedMode);
    setLoading(true);
    setArtifacts([]);
    setHeadContent('');
    setErrorMsg(null);
    try {
      const generatedHtml = await generateArtifacts(provider, topic, requestedMode, imageProvider);
      parseAndSetHtml(generatedHtml);
    } catch (error: any) {
      console.error(error);
      if (error?.status === 429 || error?.message?.includes('429')) {
        setErrorMsg("We're experiencing high traffic. Please wait a moment and try again.");
      } else {
        setErrorMsg("Failed to generate artifacts. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const handleRegenerateCurrentArtifact = async () => {
    if (artifacts.length === 0) return;
    setRegeneratingArtifact(true);
    try {
      const currentContent = artifacts[currentArtifactIndex];
      const excluded = getUsedImageUrls();
      const styleMatch = headContent.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      const cssContext = styleMatch ? styleMatch[1] : '';
      
      const newArtifactHtml = await regenerateArtifact(
        provider,
        topic,
        currentContent,
        cssContext,
        excluded,
        artifactMode,
        imageProvider
      );
      const newArtifacts = [...artifacts];
      newArtifacts[currentArtifactIndex] = newArtifactHtml;
      // Simple sanitization
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newArtifactHtml;
      sanitizeLayout(tempDiv);
      newArtifacts[currentArtifactIndex] = tempDiv.innerHTML;
      
      setArtifacts(reindexArtifactClasses(newArtifacts, includeSlideClass));
    } catch (error) {
      console.error(error);
    } finally {
      setRegeneratingArtifact(false);
    }
  };

  const handleAddArtifact = async () => {
    if (artifacts.length === 0) return;
    setAddingArtifact(true);
    try {
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
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = newArtifactHtml;
      sanitizeLayout(tempDiv);
      
      const newArtifacts = reindexArtifactClasses(
        [...artifacts, tempDiv.innerHTML],
        includeSlideClass
      );
      setArtifacts(newArtifacts);
      setCurrentArtifactIndex(newArtifacts.length - 1);
      
    } catch (error) {
      console.error(error);
    } finally {
      setAddingArtifact(false);
    }
  };

  const handleDeleteArtifact = () => {
    if (artifacts.length <= 1) return;
    const newArtifacts = reindexArtifactClasses(
      artifacts.filter((_, i) => i !== currentArtifactIndex),
      includeSlideClass
    );
    setArtifacts(newArtifacts);
    if (currentArtifactIndex >= newArtifacts.length) {
      setCurrentArtifactIndex(newArtifacts.length - 1);
    }
  };

  const getHeadHtml = (headOverride = headContent) => {
    const base = headOverride.trim();
    if (!animationsEnabled) {
      return `${base}<style>
            /* FORCE DISABLE ANIMATIONS - STRICT STATIC MODE */
            *, *::before, *::after {
              animation: none !important;
              transition: none !important;
            }
          </style>`;
    }
    return base;
  };

  const getArtifactHtmlByIndex = (index: number) => {
    if (artifacts.length === 0) return '';
    return `
      <!DOCTYPE html>
      <html>
        <head>${getHeadHtml()}</head>
        <body>
          ${artifacts[index]}
        </body>
      </html>
    `;
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

      const jsonString = JSON.stringify(results, null, 2);
      await navigator.clipboard.writeText(jsonString);

      setCopiedJsonProject(true);
      setTimeout(() => setCopiedJsonProject(false), 2000);
    } catch (err) {
      console.error("Export failed:", err);
      setErrorMsg("Failed to export JSON project.");
    }
  };

  const getCurrentFullHtml = () => {
    return getArtifactHtmlByIndex(currentArtifactIndex);
  };

  const getAllArtifactsHtml = (headOverride = headContent) => {
     return `
      <!DOCTYPE html>
      <html>
        <head>${getHeadHtml(headOverride)}</head>
        <body>
          ${artifacts.join('\n')}
        </body>
      </html>
    `;
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

  const handleCopyHtml = async () => {
    const html = getAllArtifactsHtml();
    await navigator.clipboard.writeText(html);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const applyHeadUpdates = (nextTitle: string, nextTags: string, nextDescription: string) => {
    const newHead = updateHeadMetadata(headContent, nextTitle, nextTags, nextDescription);
    setHeadContent(newHead);
    if (viewMode === 'code' && !isCodeDirty) {
      setCodeDraft(getAllArtifactsHtml(newHead));
    }
  };

  const saveProjectTitle = () => {
    const nextTitle = titleDraft.trim();
    setEditingTitle(false);
    setProjectTitle(nextTitle);
    applyHeadUpdates(nextTitle, projectTags, projectDescription);
  };

  const saveProjectTags = () => {
    const nextTags = normalizeTags(tagsDraft);
    setEditingTags(false);
    setProjectTags(nextTags);
    applyHeadUpdates(projectTitle, nextTags, projectDescription);
  };

  const saveProjectDescription = () => {
    const nextDescription = descriptionDraft.trim();
    setEditingDescription(false);
    setProjectDescription(nextDescription);
    applyHeadUpdates(projectTitle, projectTags, nextDescription);
  };

  const isEmpty = artifacts.length === 0;

  return (
    <div className={`flex flex-col gap-4${isEmpty ? ' min-h-[calc(100vh-7rem)]' : ''}`}>
      {/* Main Content Area */}
      {artifacts.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="shrink-0 w-full flex justify-center px-4">
            <div
              className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-4"
              style={{ width: previewSize.width || '100%' }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Project</div>
              <div className="mt-2">
                {editingTitle ? (
                  <input
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    onBlur={saveProjectTitle}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        setTitleDraft(projectTitle);
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-lg font-semibold text-white focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTitleDraft(projectTitle);
                      setEditingTitle(true);
                    }}
                    className="text-left text-lg font-semibold text-white hover:text-indigo-300"
                  >
                    {projectTitle || 'Untitled Project'}
                  </button>
                )}
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</div>
              <div className="mt-1">
                {editingDescription ? (
                  <textarea
                    value={descriptionDraft}
                    onChange={(e) => setDescriptionDraft(e.target.value)}
                    onBlur={saveProjectDescription}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.currentTarget.blur();
                      }
                      if (e.key === 'Escape') {
                        setDescriptionDraft(projectDescription);
                        setEditingDescription(false);
                      }
                    }}
                    rows={3}
                    placeholder="Short SEO description for stock listing"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDescriptionDraft(projectDescription);
                      setEditingDescription(true);
                    }}
                    className="text-left text-sm text-neutral-300 hover:text-indigo-300"
                  >
                    {projectDescription || 'Add description'}
                  </button>
                )}
              </div>
              <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">Tags</div>
              <div className="mt-1">
                {editingTags ? (
                  <input
                    value={tagsDraft}
                    onChange={(e) => setTagsDraft(e.target.value)}
                    onBlur={saveProjectTags}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        setTagsDraft(projectTags);
                        setEditingTags(false);
                      }
                    }}
                    placeholder="tag1, tag2, tag3"
                    className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTagsDraft(projectTags);
                      setEditingTags(true);
                    }}
                    className="text-left text-sm text-neutral-300 hover:text-indigo-300"
                  >
                    {projectTags || 'Add tags'}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col items-center justify-center p-4">
            {/* Artifact Preview - Centered */}
            <div className="w-full max-w-6xl flex items-center justify-center" ref={previewStageRef}>
              <div
                className="relative bg-neutral-950 rounded-xl border border-neutral-800 shadow-2xl overflow-hidden group"
                style={{
                  width: previewSize.width || '100%',
                  height: previewSize.height || '100%'
                }}
              >
                {viewMode === 'preview' ? (
                  <div
                    className="absolute left-1/2 top-1/2 origin-center"
                    style={{
                      width: PREVIEW_BASE_WIDTH,
                      height: PREVIEW_BASE_HEIGHT,
                      transform: `translate(-50%, -50%) scale(${previewScale})`
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={getCurrentFullHtml()}
                      title="Artifact Preview"
                      className="border-0"
                      style={{ width: PREVIEW_BASE_WIDTH, height: PREVIEW_BASE_HEIGHT }}
                      sandbox="allow-scripts allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="w-full h-full bg-[#0d0d0d] p-4 text-sm font-mono text-neutral-300">
                    <textarea
                      value={codeDraft}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className="w-full h-full bg-transparent text-neutral-300 resize-none focus:outline-none custom-scrollbar"
                      spellCheck={false}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 w-full flex justify-center px-4 pb-4">
            <div
              className="flex flex-col gap-3"
              style={{ width: previewSize.width || '100%' }}
            >
              {/* Toolbar - Grid Layout for Center Alignment */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-3 shrink-0 w-full">
                
                {/* Left: View Mode */}
                <div className="flex items-center gap-3 justify-self-start">
                  <div className="flex items-center gap-2 bg-neutral-950 rounded-lg p-1 border border-neutral-800">
                    <button
                      onClick={() => setViewMode('preview')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Play className="w-4 h-4" /> Preview
                    </button>
                    <button
                      onClick={() => setViewMode('code')}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        viewMode === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Code className="w-4 h-4" /> Code
                    </button>
                  </div>
                  <button
                    onClick={handleCopyHtml}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border border-neutral-800 bg-neutral-950 ${
                      copiedHtml
                        ? 'text-emerald-400'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                    title="Copy HTML"
                  >
                    {copiedHtml ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedHtml ? 'Copied' : 'Copy HTML'}
                  </button>
                  {/* <button
                    onClick={() => setAnimationsEnabled(prev => !prev)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      animationsEnabled ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
                    }`}
                    title="Toggle animations"
                  >
                    <Sparkles className="w-4 h-4" /> {animationsEnabled ? 'Anim On' : 'Anim Off'}
                  </button> */}
                </div>

                {/* Center: Navigation Controls */}
                <div className="flex items-center gap-4 px-4 py-2 bg-neutral-950 rounded-lg border border-neutral-800 justify-self-center w-full sm:w-auto justify-center">
                   <button
                      onClick={() => setCurrentArtifactIndex(prev => (prev === 0 ? artifacts.length - 1 : prev - 1))}
                      disabled={artifacts.length <= 1}
                      className="p-1.5 rounded-full hover:bg-neutral-800 disabled:opacity-30 text-white transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="text-sm font-medium text-white min-w-[3rem] text-center select-none">
                      {currentArtifactIndex + 1} / {artifacts.length}
                    </span>
                    <button
                      onClick={() => setCurrentArtifactIndex(prev => (prev === artifacts.length - 1 ? 0 : prev + 1))}
                      disabled={artifacts.length <= 1}
                      className="p-1.5 rounded-full hover:bg-neutral-800 disabled:opacity-30 text-white transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 justify-self-end w-full sm:w-auto justify-end">
                  <button
                    onClick={handleRegenerateCurrentArtifact}
                    disabled={regeneratingArtifact}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {regeneratingArtifact ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Regenerate
                  </button>
                  <button
                    onClick={handleAddArtifact}
                    disabled={addingArtifact}
                    className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {addingArtifact ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Artifact
                  </button>
                  
                  <div className="h-6 w-px bg-neutral-800 mx-2" />
                  
                  <button
                    onClick={handleDeleteArtifact}
                    disabled={artifacts.length <= 1}
                    className="p-2 text-red-400 hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete Artifact"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 sm:grid-cols-[auto_1fr] sm:items-center">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleExportArtifactJSON}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all border ${
                      copiedJsonArtifact 
                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' 
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-800 border-transparent'
                    }`}
                    title="Copy AE JSON to Clipboard"
                  >
                    {copiedJsonArtifact ? <Check className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
                    {copiedJsonArtifact ? 'Copied' : 'JSON Artifact'}
                  </button>
                  <button
                    onClick={handleExportProjectJSON}
                    className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all border ${
                      copiedJsonProject 
                        ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' 
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-800 border-transparent'
                    }`}
                    title="Copy AE JSON Project to Clipboard"
                  >
                    {copiedJsonProject ? <Check className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
                    {copiedJsonProject ? 'Copied' : 'JSON Project'}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                    <label className="mb-2 block text-xs font-medium text-neutral-400">FPS</label>
                    <div className="inline-flex w-full rounded-md border border-neutral-800 bg-neutral-900 p-1">
                      {FPS_OPTIONS.map(option => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setExportFps(option)}
                          className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
                            exportFps === option
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-neutral-300 hover:text-white'
                          }`}
                        >
                          {option} fps
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                    <label className="mb-2 block text-xs font-medium text-neutral-400">Resolution</label>
                    <select
                      value={exportResolution.id}
                      onChange={(e) => {
                        const next = RESOLUTION_OPTIONS.find(option => option.id === e.target.value);
                        if (next) setExportResolution(next);
                      }}
                      className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
                    >
                      {RESOLUTION_OPTIONS.map(option => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
                    <label className="mb-2 block text-xs font-medium text-neutral-400">
                      Duration: {exportDuration}s
                    </label>
                    <input
                      type="range"
                      min={5}
                      max={15}
                      step={1}
                      value={exportDuration}
                      onChange={(e) => setExportDuration(Number(e.target.value))}
                      className="w-full accent-indigo-500"
                    />
                    <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
                      <span>5s</span>
                      <span>15s</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-8 text-neutral-400 bg-neutral-900/20 border border-neutral-800/50 rounded-2xl border-dashed">
            <div className="w-20 h-20 bg-neutral-900 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-neutral-800 shadow-xl shadow-black/50">
              <Presentation className="w-10 h-10 text-indigo-500" />
            </div>
            <h2 className="text-2xl font-bold text-neutral-200 mb-3">
              Artifact — from spark to structure.
            </h2>
            <p className="max-w-md text-neutral-500 text-lg leading-relaxed">
              Capture ideas, shape them, and make them instantly legible.
            </p>
          </div>
      )}
      <iframe
        ref={exportIframeRef}
        title="AE Export Frame"
        className="absolute -left-[10000px] top-0 w-[1280px] h-[720px] opacity-0 pointer-events-none"
        sandbox="allow-scripts allow-same-origin"
      />

      {/* Input Area (Bottom) */}
      <div className={`shrink-0 max-w-4xl mx-auto w-full${isEmpty ? ' mt-auto' : ''}`}>
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-200 text-sm flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}

        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-neutral-400">
          <label className="flex items-center gap-2">
            <span className="font-medium">Image source</span>
            <select
              value={imageProvider}
              onChange={(e) => setImageProvider(e.target.value as ImageProviderName)}
              className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none"
            >
              {IMAGE_PROVIDER_OPTIONS.map(option => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-2 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all duration-300">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your artifacts... (e.g. 'A futuristic identity kit for a quantum computing startup with dark aesthetic')"
            className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 focus:outline-none px-4 py-3 pr-14 resize-none min-h-[60px] max-h-[200px] text-lg"
            rows={2}
          />
          <button
            onClick={() => handleGenerate()}
            disabled={loading || !topic.trim()}
            className="absolute right-2 bottom-2 p-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 text-white rounded-xl transition-all shadow-lg hover:shadow-indigo-500/20"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
        <div className="text-center mt-3 text-xs text-neutral-500 font-medium">
          Press <span className="text-neutral-400 font-bold">Enter</span> to generate
        </div>
      </div>
    </div>
  );
};
