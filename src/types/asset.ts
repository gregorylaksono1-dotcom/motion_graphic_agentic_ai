export interface WordTiming {
  word: string;
  startSec: number;
  endSec: number;
  startFrame: number;
  endFrame: number;
  clauseBreakAfter?: boolean;
}

export interface GeneratedAudioAsset {
  sceneNumber: number;
  filePath: string;
  absolutePath: string;
  durationSeconds: number;
  durationInFrames: number;
  voiceUsed: string;
  fileSize: number;
  speechStartSec?: number;
  speechEndSec?: number;
  wordTimings?: WordTiming[];
}

export interface GeneratedDataAsset {
  id: string;
  filePath: string;
  type: 'polygon' | 'chart' | 'json';
  data: any;
}

export interface GeneratedVisualAsset {
  id: string;
  filePath: string;
  type: 'icon' | 'image' | 'svg';
  hasTransparency: boolean;
}

export interface AssetManifest {
  audioTracks: GeneratedAudioAsset[];
  dataAssets: GeneratedDataAsset[];
  visualAssets: GeneratedVisualAsset[];
  totalAudioDurationFrames: number;
}

