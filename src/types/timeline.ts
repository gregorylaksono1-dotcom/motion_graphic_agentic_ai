import type { SceneScript } from './story.js';
import type { WordTiming } from './asset.js';

/** A slot on the scene's beat grid: "something must visibly change at this local frame" */
export interface BeatSlot {
  index: number;
  /** LOCAL frame inside the scene (0..durationInFrames) */
  localFrame: number;
  /** The spoken word the beat is snapped to (or "" for scene entry / unsnapped beats) */
  anchorWord: string;
  /** Narration heard from this beat until the next one */
  phrase: string;
  /** The storyboard visual beat idea suggested for this slot (from LLM 1), if any */
  suggestedVisual: string;
}

export interface TimedScene extends SceneScript {
  startFrame: number;
  endFrame: number;
  durationInFrames: number;
  durationSeconds: number;
  wordCount: number;
  wordTimings?: WordTiming[];
  landmarkCues?: string;
  beatSlots: BeatSlot[];
}

export interface TimedStoryboard {
  title: string;
  synopsis: string;
  visualStyle: string;
  targetAudience: string;
  fps: number;
  totalDurationInFrames: number;
  totalDurationSeconds: number;
  timedScenes: TimedScene[];
}
