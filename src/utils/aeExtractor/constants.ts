export const TARGET_W = 3840;
export const TARGET_H = 2160;
export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION = 10;

export const INLINE_TEXT_TAGS = new Set([
  'br',
  'span',
  'b',
  'strong',
  'i',
  'em',
  'u',
  's',
  'a',
  'small',
  'mark',
  'sup',
  'sub',
  'code'
]);

export const NON_TEXT_TAGS = new Set([
  'img',
  'svg',
  'video',
  'canvas',
  'iframe',
  'input',
  'textarea',
  'select',
  'button',
  'picture',
  'audio'
]);
