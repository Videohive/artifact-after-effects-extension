import React from 'react';
import { AlertCircle, Image, Loader2, Send, X } from 'lucide-react';
import { AiProviderName, ImageProviderName, MediaKind } from '../../services/aiService';
import { ImageProviderOption, MediaKindOption } from './types';

type GeneratorInputProps = {
  errorMsg: string | null;
  provider: AiProviderName;
  onProviderChange: (value: AiProviderName) => void;
  imageProvider: ImageProviderName;
  imageProviderOptions: ImageProviderOption[];
  onImageProviderChange: (value: ImageProviderName) => void;
  mediaKind: MediaKind;
  mediaKindOptions: MediaKindOption[];
  onMediaKindChange: (value: MediaKind) => void;
  autoRefine: boolean;
  onAutoRefineChange: (value: boolean) => void;
  topic: string;
  onTopicChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
  onGenerate: () => void;
  loading: boolean;
  isEmpty: boolean;
  attachedImages: string[];
  maxImages?: number;
  onImagesAttach: (dataUrls: string[]) => void;
  onImageRemove: (index: number) => void;
};

export const GeneratorInput: React.FC<GeneratorInputProps> = ({
  errorMsg,
  provider,
  onProviderChange,
  imageProvider,
  imageProviderOptions,
  onImageProviderChange,
  mediaKind,
  mediaKindOptions,
  onMediaKindChange,
  autoRefine,
  onAutoRefineChange,
  topic,
  onTopicChange,
  onKeyDown,
  onGenerate,
  loading,
  isEmpty,
  attachedImages,
  maxImages = 5,
  onImagesAttach,
  onImageRemove
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const remainingSlots = Math.max(0, maxImages - attachedImages.length);

  const readFilesAsDataUrls = React.useCallback(
    (files: File[]) => {
      const tasks = files.map(file => new Promise<string | null>(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      }));
      Promise.all(tasks).then(results => {
        const dataUrls = results.filter((result): result is string => typeof result === 'string');
        if (dataUrls.length > 0) {
          onImagesAttach(dataUrls);
        }
      });
    },
    [onImagesAttach]
  );

  const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items || [];
    if (remainingSlots <= 0) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (!file) continue;
        files.push(file);
      }
    }
    if (files.length === 0) return;
    event.preventDefault();
    readFilesAsDataUrls(files.slice(0, remainingSlots));
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (remainingSlots <= 0) return;
    const files = Array.from(event.dataTransfer?.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    readFilesAsDataUrls(files.slice(0, remainingSlots));
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handlePickImage = () => {
    if (remainingSlots <= 0) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (remainingSlots <= 0) return;
    const files = Array.from(event.target.files || []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    readFilesAsDataUrls(files.slice(0, remainingSlots));
    event.target.value = '';
  };

  return (
    <div className={`shrink-0 w-full${isEmpty ? ' mt-auto' : ''}`}>
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg text-red-200 text-sm flex items-center gap-2 animate-in slide-in-from-bottom-2 fade-in">
          <AlertCircle className="w-4 h-4" />
          {errorMsg}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-end gap-2 px-1 text-xs text-neutral-400">
        <label className="flex items-center gap-2">
          <span className="font-medium">Provider</span>
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
        <label className="flex items-center gap-2">
          <span className="font-medium">Media</span>
          <select
            value={mediaKind}
            onChange={(e) => onMediaKindChange(e.target.value as MediaKind)}
            className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 focus:border-indigo-500 focus:outline-none"
          >
            {mediaKindOptions.map(option => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-medium">Auto refine</span>
          <input
            type="checkbox"
            checked={autoRefine}
            onChange={(e) => onAutoRefineChange(e.target.checked)}
            className="h-4 w-4 rounded border border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-2 focus:ring-indigo-500/40"
          />
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
            <button
              type="button"
              onClick={() => onProviderChange('claude')}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                provider === 'claude'
                  ? 'bg-indigo-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Claude
            </button>
          </div>
        </div> */}
      </div>

      <div
        className="relative bg-neutral-900 border border-neutral-800 rounded-2xl p-2 shadow-2xl focus-within:ring-2 focus-within:ring-indigo-500/50 focus-within:border-indigo-500 transition-all duration-300"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        {attachedImages.length > 0 ? (
          <div className="flex flex-wrap items-center gap-3 px-2 pt-2">
            {attachedImages.map((image, index) => (
              <div className="relative h-12 w-12" key={`attachment-${index}`}>
                <img
                  src={image}
                  alt={`Attachment preview ${index + 1}`}
                  className="h-12 w-12 rounded-lg object-cover border border-neutral-800"
                />
                <button
                  type="button"
                  onClick={() => onImageRemove(index)}
                  className="absolute -right-2 -top-2 rounded-full bg-neutral-950/90 p-1 text-neutral-300 hover:text-red-300 border border-neutral-800"
                  aria-label={`Remove image ${index + 1}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <span className="text-[11px] text-neutral-500 font-medium">
              {attachedImages.length}/{maxImages}
            </span>
          </div>
        ) : null}
        <textarea
          value={topic}
          onChange={(e) => onTopicChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder="Describe your artifacts... (attach up to 5 images)"
          className="w-full bg-transparent text-neutral-100 placeholder-neutral-500 focus:outline-none pl-14 pr-14 py-3 resize-none min-h-[60px] max-h-[200px] text-lg"
          rows={2}
        />
        <button
          type="button"
          onClick={handlePickImage}
          disabled={remainingSlots <= 0}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-3 text-neutral-300 hover:text-white hover:bg-neutral-800 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Attach image"
        >
          <Image className="w-5 h-5" />
        </button>
        <button
          onClick={onGenerate}
          disabled={loading || (!topic.trim() && attachedImages.length === 0)}
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
