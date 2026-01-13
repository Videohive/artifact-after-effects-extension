import React from 'react';
import { Ban, Loader2, Sparkles } from 'lucide-react';

type AnimationPanelProps = {
  onAnimateCurrent?: () => void;
  onAnimateAll?: () => void;
  onClearCurrent?: () => void;
  onClearAll?: () => void;
  animating?: boolean;
  animatingMode?: 'slide' | 'project' | null;
};

export const AnimationPanel: React.FC<AnimationPanelProps> = ({
  onAnimateCurrent,
  onAnimateAll,
  onClearCurrent,
  onClearAll,
  animating,
  animatingMode
}) => (
  <div className="w-full flex justify-center">
    <div className="flex w-full max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-2">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
        Animation
      </span>
      <button
        onClick={onAnimateCurrent}
        disabled={animating}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 transition-colors hover:text-white hover:bg-neutral-800 disabled:opacity-50"
        type="button"
        title="Animate current slide"
      >
        {animating && animatingMode === 'slide'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Sparkles className="w-4 h-4" />}
        Current
      </button>
      <button
        onClick={onAnimateAll}
        disabled={animating}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 transition-colors hover:text-white hover:bg-neutral-800 disabled:opacity-50"
        type="button"
        title="Animate all slides"
      >
        {animating && animatingMode === 'project'
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Sparkles className="w-4 h-4" />}
        All
      </button>
      <button
        onClick={onClearCurrent}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 transition-colors hover:text-white hover:bg-neutral-800 disabled:opacity-50"
        title="Remove animation from current slide"
        type="button"
      >
        <Ban className="w-4 h-4" />
        Clear current
      </button>
      <button
        onClick={onClearAll}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-neutral-300 transition-colors hover:text-white hover:bg-neutral-800 disabled:opacity-50"
        title="Remove animation from all slides"
        type="button"
      >
        <Ban className="w-4 h-4" />
        Clear all
      </button>
    </div>
  </div>
);
