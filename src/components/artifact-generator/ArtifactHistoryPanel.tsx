import React from 'react';
import { Trash2, X } from 'lucide-react';
import { ArtifactHistoryItem } from '../../services/artifactHistoryService';

type ArtifactHistoryPanelProps = {
  items: ArtifactHistoryItem[];
  loading: boolean;
  selectedId: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onNewChat: () => void;
  onClose?: () => void;
  variant?: 'default' | 'overlay';
};

const formatTimestamp = (value: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
};

export const ArtifactHistoryPanel: React.FC<ArtifactHistoryPanelProps> = ({
  items,
  loading,
  selectedId,
  error,
  onSelect,
  onDelete,
  onRefresh,
  onNewChat,
  onClose,
  variant = 'default'
}) => {
  const wrapperClassName =
    variant === 'overlay'
      ? 'w-full max-w-xs sm:max-w-sm h-full'
      : 'w-full lg:w-80 shrink-0 -ml-4 sm:-ml-6 lg:-ml-8 h-full';
  return (
    <div className={wrapperClassName}>
      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Artifacts</div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNewChat}
              className="text-xs font-semibold text-neutral-400 hover:text-indigo-300"
            >
              New chat
            </button>
            <button
              type="button"
              onClick={onRefresh}
              className="text-xs font-semibold text-neutral-400 hover:text-indigo-300"
            >
              Refresh
            </button>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-400 hover:text-white"
                aria-label="Close artifacts"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        {error ? (
          <div className="mt-3 text-xs text-red-300">{error}</div>
        ) : null}
        {loading ? (
          <div className="mt-3 text-xs text-neutral-400">Loading...</div>
        ) : items.length === 0 ? (
          <div className="mt-3 text-xs text-neutral-500">No saved artifacts yet.</div>
        ) : (
          <div className="mt-3 flex flex-1 flex-col gap-2 overflow-auto pr-1">
            {items.map(item => {
              const active = item.id === selectedId;
              const displayName = (item.name || 'Untitled Project').replace(/\s+/g, ' ').trim();
              const maxName = 36;
              const shownName =
                displayName.length > maxName
                  ? `${displayName.slice(0, maxName)} ...`
                  : displayName;
              return (
                <div
                  key={item.id}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    active
                      ? 'border-indigo-500/80 bg-indigo-500/10'
                      : 'border-neutral-800 bg-neutral-900/40 hover:border-indigo-500/50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onSelect(item.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate text-sm font-semibold text-white">
                        {shownName || 'Untitled Project'}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDelete(item.id);
                      }}
                      className="shrink-0 text-neutral-500 hover:text-red-300"
                      aria-label="Delete artifact"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
