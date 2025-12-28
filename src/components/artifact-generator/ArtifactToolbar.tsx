import React, { useEffect } from 'react';
import { Check, Code, Copy, Loader2, Play, Plus, RefreshCw, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ViewMode } from './types';

type ArtifactToolbarProps = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCopyHtml: () => void;
  copiedHtml: boolean;
  currentIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
  onRegenerate: () => void;
  regenerating: boolean;
  onAdd: () => void;
  adding: boolean;
  onDelete: () => void;
  canDelete: boolean;
};

export const ArtifactToolbar: React.FC<ArtifactToolbarProps> = ({
  viewMode,
  onViewModeChange,
  onCopyHtml,
  copiedHtml,
  currentIndex,
  totalCount,
  onPrev,
  onNext,
  onRegenerate,
  regenerating,
  onAdd,
  adding,
  onDelete,
  canDelete
}) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (totalCount <= 1) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditable) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrev();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrev, totalCount]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-4 bg-neutral-900 border border-neutral-800 rounded-xl p-3 shrink-0 w-full">
      <div className="flex items-center gap-3 justify-self-start">
        <div className="flex items-center gap-2 bg-neutral-950 rounded-lg p-1 border border-neutral-800">
          <button
            onClick={() => onViewModeChange('preview')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'preview' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Play className="w-4 h-4" /> Preview
          </button>
          <button
            onClick={() => onViewModeChange('code')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'code' ? 'bg-indigo-600 text-white shadow-sm' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Code className="w-4 h-4" /> Code
          </button>
        </div>
        <button
          onClick={onCopyHtml}
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
      </div>

      <div className="flex items-center gap-4 px-4 py-2 bg-neutral-950 rounded-lg border border-neutral-800 justify-self-center w-full sm:w-auto justify-center">
        <button
          onClick={onPrev}
          disabled={totalCount <= 1}
          className="p-1.5 rounded-full hover:bg-neutral-800 disabled:opacity-30 text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="text-sm font-medium text-white min-w-[3rem] text-center select-none">
          {currentIndex + 1} / {totalCount}
        </span>
        <button
          onClick={onNext}
          disabled={totalCount <= 1}
          className="p-1.5 rounded-full hover:bg-neutral-800 disabled:opacity-30 text-white transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="flex items-center gap-2 justify-self-end w-full sm:w-auto justify-end">
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Regenerate
        </button>
        <button
          onClick={onAdd}
          disabled={adding}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add Artifact
        </button>

        <div className="h-6 w-px bg-neutral-800 mx-2" />

        <button
          onClick={onDelete}
          disabled={!canDelete}
          className="p-2 text-red-400 hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
          title="Delete Artifact"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
