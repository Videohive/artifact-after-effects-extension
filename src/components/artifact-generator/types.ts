import { ImageProviderName } from '../../services/aiService';

export type ViewMode = 'preview' | 'code';

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
