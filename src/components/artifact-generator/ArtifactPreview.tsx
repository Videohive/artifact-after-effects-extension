import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ViewMode } from './types';

type ArtifactPreviewProps = {
  previewStageRef: React.RefObject<HTMLDivElement>;
  previewSize: { width: number; height: number };
  previewScale: number;
  viewMode: ViewMode;
  codeDraft: string;
  baseWidth: number;
  baseHeight: number;
  previewKey: string;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  getCurrentFullHtml: () => string;
  onCodeChange: (value: string) => void;
  activeArtifactIndex: number;
};

type ArtifactRange = {
  start: number;
  end: number;
};

type CodeBlock = {
  id: string;
  label: string;
  text: string;
  kind: 'all' | 'meta' | 'artifact' | 'post';
  index?: number;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const findArtifactRanges = (source: string): ArtifactRange[] => {
  const ranges: ArtifactRange[] = [];
  const stack: { start: number; isArtifact: boolean }[] = [];
  const tagRegex = /<\/?section\b[^>]*>/gi;
  let match: RegExpExecArray | null = tagRegex.exec(source);

  while (match) {
    const tag = match[0];
    const isClosing = tag.startsWith('</');
    if (!isClosing) {
      const classMatch = /class\s*=\s*(["'])(.*?)\1/i.exec(tag);
      const classValue = classMatch ? classMatch[2] : '';
      const classes = classValue.split(/\s+/);
      const isArtifact = classes.indexOf('artifact') !== -1;
      stack.push({ start: match.index, isArtifact });
    } else {
      const last = stack.pop();
      if (last && last.isArtifact) {
        ranges.push({ start: last.start, end: match.index + tag.length });
      }
    }
    match = tagRegex.exec(source);
  }

  return ranges.sort((a, b) => a.start - b.start);
};

const findDivRanges = (source: string): ArtifactRange[] => {
  const ranges: ArtifactRange[] = [];
  const stack: number[] = [];
  const tagRegex = /<\/?div\b[^>]*>/gi;
  let match: RegExpExecArray | null = tagRegex.exec(source);

  while (match) {
    const tag = match[0];
    const isClosing = tag.startsWith('</');
    if (!isClosing) {
      stack.push(match.index);
    } else {
      const start = stack.pop();
      if (start !== undefined) {
        ranges.push({ start, end: match.index + tag.length });
      }
    }
    match = tagRegex.exec(source);
  }

  return ranges.sort((a, b) => a.start - b.start);
};

const getDivHighlightStyle = (index: number) => {
  const hue = (index * 37) % 360;
  const bg = `hsla(${hue}, 65%, 26%, 0.25)`;
  const border = `hsla(${hue}, 70%, 55%, 0.4)`;
  return { bg, border };
};

const buildDivHighlightedHtml = (source: string) => escapeHtml(source || '');

const buildCodeBlocks = (source: string): CodeBlock[] => {
  if (!source) {
    return [
      {
        id: 'all',
        label: 'All Code',
        text: '',
        kind: 'all'
      },
      {
        id: 'meta',
        label: 'Document',
        text: '',
        kind: 'meta'
      }
    ];
  }

  const ranges = findArtifactRanges(source);
  const blocks: CodeBlock[] = [
    {
      id: 'all',
      label: 'All Code',
      text: source,
      kind: 'all'
    }
  ];
  if (ranges.length === 0) {
    blocks.push({
      id: 'meta',
      label: 'Document',
      text: source,
      kind: 'meta'
    });
    return blocks;
  }

  const firstStart = ranges[0].start;
  if (firstStart > 0) {
    blocks.push({
      id: 'meta',
      label: 'Head, Meta, Styles',
      text: source.slice(0, firstStart),
      kind: 'meta'
    });
  }

  ranges.forEach((range, index) => {
    blocks.push({
      id: `artifact-${index + 1}`,
      label: `Artifact ${index + 1}`,
      text: source.slice(range.start, range.end),
      kind: 'artifact',
      index
    });
  });

  const lastEnd = ranges[ranges.length - 1].end;
  if (lastEnd < source.length) {
    blocks.push({
      id: 'post',
      label: 'Trailing Markup',
      text: source.slice(lastEnd),
      kind: 'post'
    });
  }

  return blocks;
};

export const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({
  previewStageRef,
  previewSize,
  previewScale,
  viewMode,
  codeDraft,
  baseWidth,
  baseHeight,
  previewKey,
  iframeRef,
  getCurrentFullHtml,
  onCodeChange,
  activeArtifactIndex
}) => {
  const codeBlocks = useMemo(() => buildCodeBlocks(codeDraft), [codeDraft]);
  const defaultActiveIndex = useMemo(() => {
    const index = codeBlocks.findIndex(
      (block) => block.kind === 'artifact' && block.index === activeArtifactIndex
    );
    return index === -1 ? 0 : index;
  }, [codeBlocks, activeArtifactIndex]);

  const [openBlockIndex, setOpenBlockIndex] = useState<number | null>(defaultActiveIndex);

  useEffect(() => {
    setOpenBlockIndex(defaultActiveIndex);
  }, [defaultActiveIndex]);

  const activeBlock = openBlockIndex !== null ? codeBlocks[openBlockIndex] : undefined;
  const highlightedActive = useMemo(
    () => buildDivHighlightedHtml(activeBlock?.text || ''),
    [activeBlock?.text]
  );
  const overlayRef = useRef<HTMLPreElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!textareaRef.current) return;
    const containerHeight = scrollRef.current?.clientHeight || 0;
    const textarea = textareaRef.current;
    textarea.style.height = '0px';
    const targetHeight = Math.max(textarea.scrollHeight, containerHeight);
    textarea.style.height = `${targetHeight}px`;
  }, [highlightedActive]);
  const handleBlockChange = (blockIndex: number, value: string) => {
    const targetBlock = codeBlocks[blockIndex];
    if (targetBlock?.kind === 'all') {
      onCodeChange(value);
      return;
    }
    const parts = codeBlocks.map((block, index) => (index === blockIndex ? value : block.text));
    onCodeChange(parts.join(''));
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl flex items-center justify-center" ref={previewStageRef}>
        <div
          className="relative bg-neutral-950 rounded-xl border border-neutral-800 shadow-2xl overflow-hidden group"
          style={{
            width: previewSize.width || '100%',
            height: previewSize.height || '100%'
          }}
        >
          {viewMode === 'code' ? (
            <div className="w-full h-full bg-[#0d0d0d] text-sm font-mono text-neutral-300 overflow-hidden p-4">
              <div className="flex h-full min-h-0 flex-col gap-3">
                <div className="shrink-0 overflow-auto custom-scrollbar pr-1">
                  <div className="flex flex-wrap gap-2">
                  {codeBlocks.map((block, index) => {
                    const isActive = index === openBlockIndex;
                    return (
                      <button
                        key={block.id}
                        type="button"
                        onClick={() => setOpenBlockIndex((prev) => (prev === index ? null : index))}
                        className={`rounded-lg border bg-neutral-950/60 px-3 py-2 text-xs uppercase tracking-wider ${
                          isActive ? 'border-sky-400/40 text-sky-200' : 'border-neutral-800 text-neutral-400'
                        } text-left`}
                      >
                        {block.label}
                      </button>
                    );
                  })}
                  </div>
                </div>

                {activeBlock ? (
                  <div className="flex-1 min-h-0 rounded-lg border border-neutral-800 bg-neutral-950/60 flex flex-col">
                    <div className="px-3 py-2 text-xs uppercase tracking-wider text-neutral-400 shrink-0">
                      {activeBlock.label}
                    </div>
                    <div className="p-3 flex-1 min-h-0">
                      <div ref={scrollRef} className="relative h-full overflow-auto custom-scrollbar">
                        <div className="grid min-w-full">
                        <pre
                          ref={overlayRef}
                          className="col-start-1 row-start-1 whitespace-pre-wrap break-words pointer-events-none leading-5"
                          style={{ tabSize: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: highlightedActive || ' ' }}
                        />
                        <textarea
                          ref={textareaRef}
                          value={activeBlock.text}
                          onChange={(e) => {
                            if (openBlockIndex === null) return;
                            handleBlockChange(openBlockIndex, e.target.value);
                          }}
                          className="col-start-1 row-start-1 w-full bg-transparent text-transparent caret-neutral-200 resize-none focus:outline-none leading-5 whitespace-pre-wrap break-words"
                          style={{
                            tabSize: 2,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflow: 'hidden'
                          }}
                          spellCheck={false}
                        />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              className="absolute left-1/2 top-1/2 origin-center"
              style={{
                width: baseWidth,
                height: baseHeight,
                transform: `translate(-50%, -50%) scale(${previewScale})`
              }}
            >
              <iframe
                key={previewKey}
                ref={iframeRef}
                srcDoc={getCurrentFullHtml()}
                title={viewMode === 'grid' ? 'Artifact Grid' : 'Artifact Preview'}
                className="border-0"
                style={{ width: baseWidth, height: baseHeight }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
