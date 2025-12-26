import React, { useState } from 'react';
import { SlideGenerator } from './components/SlideGenerator';
import { Presentation } from 'lucide-react';

export default function App() {
  return (
    <div className="h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col overflow-hidden">
      <header className="shrink-0 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-md z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <Presentation className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Muse</h1>
          </div>
          <div className="text-sm text-neutral-400 hidden sm:block">
            Powered by AE2
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <SlideGenerator />
        </div>
      </main>
    </div>
  );
}