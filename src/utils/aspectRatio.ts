export type AspectRatioPreset = {
  id: string;
  width: number;
  height: number;
  baseWidth: number;
  baseHeight: number;
};

export type ResolutionOption = {
  id: string;
  label: string;
  width: number;
  height: number;
};

const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { id: '16:9', width: 16, height: 9, baseWidth: 1920, baseHeight: 1080 },
  { id: '1:1', width: 1, height: 1, baseWidth: 1080, baseHeight: 1080 },
  { id: '9:16', width: 9, height: 16, baseWidth: 1080, baseHeight: 1920 },
  { id: '4:5', width: 4, height: 5, baseWidth: 1080, baseHeight: 1350 }
];

export const DEFAULT_ASPECT_RATIO = ASPECT_RATIO_PRESETS[0];

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
};

export const parseAspectRatioFromText = (text: string | undefined): AspectRatioPreset => {
  if (!text) return DEFAULT_ASPECT_RATIO;
  const matches = text.matchAll(/(\d+)\s*[:x]\s*(\d+)/gi);
  for (const match of matches) {
    const rawW = Number(match[1]);
    const rawH = Number(match[2]);
    if (!rawW || !rawH) continue;
    const divisor = gcd(rawW, rawH);
    const w = rawW / divisor;
    const h = rawH / divisor;
    const preset = ASPECT_RATIO_PRESETS.find(item => item.width === w && item.height === h);
    if (preset) return preset;
  }
  return DEFAULT_ASPECT_RATIO;
};

export const buildResolutionOptions = (preset: AspectRatioPreset): ResolutionOption[] => {
  if (preset.id === '16:9') {
    return [
      { id: '1080p', label: 'Full HD (1920x1080)', width: 1920, height: 1080 },
      { id: '2k', label: '2K (2560x1440)', width: 2560, height: 1440 },
      { id: '4k', label: '4K (3840x2160)', width: 3840, height: 2160 }
    ];
  }

  const baseW = preset.baseWidth;
  const baseH = preset.baseHeight;
  const scale2k = 4 / 3;
  const scale4k = 2;
  const w2k = Math.round(baseW * scale2k);
  const h2k = Math.round(baseH * scale2k);
  const w4k = Math.round(baseW * scale4k);
  const h4k = Math.round(baseH * scale4k);

  return [
    { id: '1080p', label: `1080 (${baseW}x${baseH})`, width: baseW, height: baseH },
    { id: '2k', label: `2K (${w2k}x${h2k})`, width: w2k, height: h2k },
    { id: '4k', label: `4K (${w4k}x${h4k})`, width: w4k, height: h4k }
  ];
};
