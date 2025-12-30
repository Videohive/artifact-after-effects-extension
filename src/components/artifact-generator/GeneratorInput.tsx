import React from 'react';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import { AiProviderName, ImageProviderName } from '../../services/aiService';
import { ImageProviderOption } from './types';

type GeneratorInputProps = {
  errorMsg: string | null;
  provider: AiProviderName;
  onProviderChange: (value: AiProviderName) => void;
  imageProvider: ImageProviderName;
  imageProviderOptions: ImageProviderOption[];
  onImageProviderChange: (value: ImageProviderName) => void;
  topic: string;
  onTopicChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onGenerate: () => void;
  loading: boolean;
  isEmpty: boolean;
};

export const GeneratorInput: React.FC<GeneratorInputProps> = ({
  errorMsg,
  provider,
  onProviderChange,
  imageProvider,
  imageProviderOptions,
  onImageProviderChange,
  topic,
  onTopicChange,
  onKeyDown,
  onGenerate,
  loading,
  isEmpty
}) => {
  return (
    <div className={`shrink-0 max-w-4xl mx-auto w-full${isEmpty ? ' mt-auto' : ''}`}>
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-200 text-sm flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 px-1 text-xs text-neutral-400">
        <label className="flex items-center gap-2">
          <span className="font-medium">Image source</span>
          <select
            value={imageProvider}
            onChange={(e) => onImageProviderChange(e.target.value as ImageProviderName)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none"
          >
            {imageProviderOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {/* <div className="flex items-center gap-2">
          <span className="font-medium">AI</span>
          <div className="flex items-center gap-1 rounded-md border border-neutral-800 bg-neutral-900 p-0.5">
            <button
              type="button"
              onClick={() => onProviderChange('gemini')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                provider === 'gemini'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Gemini
            </button>
            <button
              type="button"
              onClick={() => onProviderChange('openai')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                provider === 'openai'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              ChatGPT
            </button>
          </div>
        </div> */}
      </div>

      <div className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-2 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all duration-300">
        <textarea
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Describe your artifacts... (e.g. 'A futuristic identity kit for a quantum computing startup with dark aesthetic')"
          className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 focus:outline-none px-4 py-3 pr-14 resize-none min-h-[60px] max-h-[200px] text-lg"
          rows={2}
        />
        <button
          onClick={onGenerate}
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
  );
};
