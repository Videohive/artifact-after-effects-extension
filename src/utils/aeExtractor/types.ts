export type SemanticZ = 'background' | 'content' | 'overlay';

export interface AEBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AEBorderSide {
  widthPx: number;
  color: string;
  style: string;
}

export interface AEBorderCornerRadius {
  x: number;
  y: number;
}

export interface AEBorderRadius {
  topLeft: AEBorderCornerRadius;
  topRight: AEBorderCornerRadius;
  bottomRight: AEBorderCornerRadius;
  bottomLeft: AEBorderCornerRadius;
}

export interface AEBoxShadow {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadRadius: number;
  color: string;
  inset: boolean;
}

export type AEClipPath =
  | {
      vertices: { x: number; y: number }[];
      inTangents: { x: number; y: number }[];
      outTangents: { x: number; y: number }[];
      closed: boolean;
    }
  | {
      paths: Array<{
        vertices: { x: number; y: number }[];
        inTangents: { x: number; y: number }[];
        outTangents: { x: number; y: number }[];
        closed: boolean;
      }>;
    }
  | null;

export interface AEBorder {
  widthPx: number;
  color: string;
  style: string;
  radiusPx: number;
  isUniform: boolean;
  sides: {
    top: AEBorderSide;
    right: AEBorderSide;
    bottom: AEBorderSide;
    left: AEBorderSide;
  };
  radius: AEBorderRadius;
}

export interface AETextLineRange {
  lineIndex: number;
  x?: number;
  style: {
    color?: string;
    opacity?: number;
    fontWeight?: string;
    fontStyle?: string;
  };
}

export interface AERenderHints {
  needsPrecomp: boolean;
  isMask: boolean;
  isText: boolean;
  isAsset: boolean;
  isHidden: boolean;
  semanticZ?: SemanticZ;
}

export interface AEMotionTime {
  start: number;
  duration: number;
  delay: number;
  ease?: string;
  stagger?: number;
}

export interface AEMotionTimelineDefaults {
  ease?: string;
  duration?: number;
  delay?: number;
}

export interface AEMotionValue {
  type?: 'function';
  value: any;
}

export interface AEMotionTween {
  targets: string[];
  type: 'to' | 'from' | 'fromTo';
  time: AEMotionTime;
  props: Record<string, { from?: AEMotionValue; to?: AEMotionValue }>;
  splitText?: 'lines' | 'words' | 'chars';
  timelineId?: string;
  timelineDefaults?: AEMotionTimelineDefaults;
}

export interface AEExportSettings {
  fps: number;
  duration: number;
  resolution: {
    width: number;
    height: number;
    label?: string;
  };
}

export interface AEExportOptions {
  targetWidth?: number;
  targetHeight?: number;
  fps?: number;
  duration?: number;
  resolutionLabel?: string;
  useViewportScale?: boolean;
  motionCapture?: AEMotionTween[];
}

export interface AENode {
  type: 'group' | 'text' | 'image' | 'video' | 'svg';
  name: string;
  bbox: AEBounds;
  bboxSpace?: 'global';
  style: Record<string, any>;
  renderHints: AERenderHints;
  children?: AENode[];

  // text
  text?: string;
  lines?: string[];
  textLines?: AEBounds[];
  lineRanges?: AETextLineRange[];
  font?: {
    family: string;
    weight: string;
    sizePx: number;
    lineHeightPx: number;
    tracking: number;
    color: string;
    textAlign: string;
    textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
    writingMode?: string;
    strokeWidthPx?: number;
    strokeColor?: string;
  };

  // assets
  src?: string;
  assetType?: 'url' | 'svg-code';
  content?: string;

  // border
  border?: AEBorder | null;
  outline?: AEBorder | null;

  clip?: {
    enabled: boolean;
    borderRadius: AEBorderRadius;
    borderRadiusPx: number;
    overflow: string;
    path?: AEClipPath;
  };

  // motion
  motion?: AEMotionTween[];
  motionUnmapped?: AEMotionTween[];
}

export interface AEArtifactExport {
  artifactId: string;
  fonts?: {
    urls: string[];
    postNames: Array<{
      name: string;
      styles: string[];
    }>;
  };
  settings: AEExportSettings;
  viewport: {
    width: number;
    height: number;
    sourceWidth: number;
    sourceHeight: number;
    scale: number;
  };
  root: AENode;
}

export interface AEProjectExport {
  settings: AEExportSettings;
  name: string;
  description: string;
  tags: string;
  placeholders?: {
    media: number;
    text: number;
  };
  artifacts: AEArtifactExport[];
}
