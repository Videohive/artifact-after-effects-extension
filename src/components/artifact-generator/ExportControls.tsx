import React from 'react';
import { Check, FileJson } from 'lucide-react';
import { ResolutionOption } from './types';

type ExportControlsProps = {
  copiedJsonArtifact: boolean;
  copiedJsonProject: boolean;
  onExportArtifact: () => void;
  onExportProject: () => void;
  exportFps: number;
  onExportFpsChange: (value: number) => void;
  exportResolution: ResolutionOption;
  resolutionOptions: ResolutionOption[];
  onExportResolutionChange: (value: ResolutionOption) => void;
  exportDuration: number;
  onExportDurationChange: (value: number) => void;
};

const FPS_OPTIONS = [30, 60];

export const ExportControls: React.FC<ExportControlsProps> = ({
  copiedJsonArtifact,
  copiedJsonProject,
  onExportArtifact,
  onExportProject,
  exportFps,
  onExportFpsChange,
  exportResolution,
  resolutionOptions,
  onExportResolutionChange,
  exportDuration,
  onExportDurationChange
}) => {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-xl border border-neutral-800 bg-neutral-950/60 p-3 sm:grid-cols-4">
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
        <label className="mb-2 block text-xs font-medium text-neutral-400">Resolution</label>
        <select
          value={exportResolution.id}
          onChange={(e) => {
            const next = resolutionOptions.find(option => option.id === e.target.value);
            if (next) onExportResolutionChange(next);
          }}
          className="w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-200 focus:border-indigo-500 focus:outline-none"
        >
          {resolutionOptions.map(option => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
        <label className="mb-2 block text-xs font-medium text-neutral-400">FPS</label>
        <div className="inline-flex w-full rounded-md border border-neutral-800 bg-neutral-900 p-1">
          {FPS_OPTIONS.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => onExportFpsChange(option)}
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
        <label className="mb-2 block text-xs font-medium text-neutral-400">
          Duration: {exportDuration}s
        </label>
        <input
          type="range"
          min={3}
          max={15}
          step={1}
          value={exportDuration}
          onChange={(e) => onExportDurationChange(Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
        <div className="mt-1 flex justify-between text-[11px] text-neutral-500">
          <span>3s</span>
          <span>15s</span>
        </div>
      </div>
      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 p-3">
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={onExportArtifact}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all border whitespace-nowrap ${
                copiedJsonArtifact
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800 border-transparent'
              }`}
              title={copiedJsonArtifact ? 'Copied JSON Artifact' : 'Copy JSON Artifact'}
              aria-label={copiedJsonArtifact ? 'Copied JSON Artifact' : 'Copy JSON Artifact'}
            >
              {copiedJsonArtifact ? <Check className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
              <span className="text-xs">Artifact</span>
            </button>
            <button
              onClick={onExportProject}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-all border whitespace-nowrap ${
                copiedJsonProject
                  ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800 border-transparent'
              }`}
              title={copiedJsonProject ? 'Copied JSON Project' : 'Copy JSON Project'}
              aria-label={copiedJsonProject ? 'Copied JSON Project' : 'Copy JSON Project'}
            >
              {copiedJsonProject ? <Check className="w-4 h-4" /> : <FileJson className="w-4 h-4" />}
              <span className="text-xs">Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
