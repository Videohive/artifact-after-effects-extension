import { ImageProviderName, MediaKind } from '../../services/aiService';

export type ViewMode = 'preview' | 'grid' | 'code';

export type ResolutionOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

export type ImageProviderOption = {
  id: ImageProviderName;
  label: string;
};

export type MediaKindOption = {
  id: MediaKind;
  label: string;
};
