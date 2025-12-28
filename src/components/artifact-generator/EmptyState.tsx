import React from 'react';
import { Presentation } from 'lucide-react';

export const EmptyState: React.FC = () => {
  return (
    <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center p-8 text-neutral-400 bg-neutral-900/20 border border-neutral-800/50 rounded-2xl border-dashed">
      <div className="w-20 h-20 bg-neutral-900 rounded-3xl flex items-center justify-center mb-6 ring-1 ring-neutral-800 shadow-xl shadow-black/50">
        <Presentation className="w-10 h-10 text-indigo-500" />
      </div>
      <h2 className="text-2xl font-bold text-neutral-200 mb-3">
        Artifact from spark to structure.
      </h2>
      <p className="max-w-md text-neutral-500 text-lg leading-relaxed">
        Capture ideas, shape them, and make them instantly legible.
      </p>
    </div>
  );
};
