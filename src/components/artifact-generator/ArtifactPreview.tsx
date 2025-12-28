import React from 'react';
import { ViewMode } from './types';

type ArtifactPreviewProps = {
  previewStageRef: React.RefObject<HTMLDivElement>;
  previewSize: { width: number; height: number };
  previewScale: number;
  viewMode: ViewMode;
  codeDraft: string;
  baseWidth: number;
  baseHeight: number;
  iframeRef: React.RefObject<HTMLIFrameElement>;
  getCurrentFullHtml: () => string;
  onCodeChange: (value: string) => void;
};

export const ArtifactPreview: React.FC<ArtifactPreviewProps> = ({
  previewStageRef,
  previewSize,
  previewScale,
  viewMode,
  codeDraft,
  baseWidth,
  baseHeight,
  iframeRef,
  getCurrentFullHtml,
  onCodeChange
}) => {
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
          {viewMode === 'preview' ? (
            <div
              className="absolute left-1/2 top-1/2 origin-center"
              style={{
                width: baseWidth,
                height: baseHeight,
                transform: `translate(-50%, -50%) scale(${previewScale})`
              }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={getCurrentFullHtml()}
                title="Artifact Preview"
                className="border-0"
                style={{ width: baseWidth, height: baseHeight }}
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          ) : (
            <div className="w-full h-full bg-[#0d0d0d] p-4 text-sm font-mono text-neutral-300">
              <textarea
                value={codeDraft}
                onChange={(e) => onCodeChange(e.target.value)}
                className="w-full h-full bg-transparent text-neutral-300 resize-none focus:outline-none custom-scrollbar"
                spellCheck={false}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
