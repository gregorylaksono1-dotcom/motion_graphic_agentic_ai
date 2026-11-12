import { z } from 'zod';
import { SceneVisualStyleTagSchema } from './story.js';

export const BEAT_ACTIONS = [
  'element-enter',
  'visual-swap',
  'text-slam',
  'counter',
  'highlight',
  'reveal',
  'burst',
  'character-react',
  'camera-punch',
  'shake',
] as const;

export const SFX_IDS = ['whoosh', 'pop', 'click', 'impact', 'riser', 'ding', 'swoosh-soft', 'none'] as const;

export type BeatAction = (typeof BEAT_ACTIONS)[number];
export type SfxId = (typeof SFX_IDS)[number];

export const DirectorBeatSchema = z.object({
  localFrame: z.number().describe('LOCAL frame of the beat (use the provided beat slot frame, or the frame of the anchor word)'),
  anchorWord: z
    .string()
    .describe('The exact spoken word (copied from the narration) this beat must land on, The engine snaps the beat to that word\'s real audio timing. "" to use localFrame as-is.'),
  action: z
    .enum(BEAT_ACTIONS)
    .describe(
      'Kind of visual change: element-enter (new prop/character/card pops in), visual-swap (hero visual replaced), text-slam (big keyword), counter (number counts up), highlight (underline/glow on detail), reveal (mask/zoom reveals detail), burst (comic/particle burst), character-react (pose/expression change), camera-punch (punch-in reframe), shake (impact shake)'
    ),
  visual: z.string().describe('Concrete description of what visibly changes on screen at this beat'),
  onScreenText: z
    .string()
    .describe('1-3 word kinetic sticker text (a number, key term or punchline) or "" for none. Use on roughly every other beat at most.'),
  emphasis: z.enum(['low', 'medium', 'high']).describe('How hard the camera/FX layer should hit this beat'),
  sfx: z.enum(SFX_IDS).describe('Sound effect landing on this beat'),
  avatarPose: z
    .string()
    .describe('Presenter avatar pose to switch to on this beat (one of the provided avatar pose ids), or "" to keep the current pose / when no avatar is used'),
});

export type DirectorBeat = z.infer<typeof DirectorBeatSchema>;

export const ChoreographedScenePlanSchema = z.object({
  sceneNumber: z.number().describe('Sequential scene number'),
  componentName: z.string().describe('React component name for this scene, e.g., "Scene1Intro"'),
  filePath: z.string().describe('File path for this scene, e.g., "components/scenes/Scene1Intro.tsx"'),
  visualStyleTag: SceneVisualStyleTagSchema.describe('Signature motion graphic aesthetic for this scene'),
  transitionIn: z
    .enum(['wipe-right', 'wipe-left', 'zoom-focus', 'fade'])
    .describe('Dynamic transition style entering this scene'),
  captionTheme: z
    .enum(['light-pill', 'dark-pill', 'brutal-pill'])
    .describe('Subtitle pill theme: "light-pill" for dark/saturated scenes, "dark-pill" for light editorial scenes, "brutal-pill" for neo-brutal scenes'),
  startFrame: z.number().describe('Start frame on the master timeline'),
  durationInFrames: z.number().describe('Duration in frames for this scene'),
  captionText: z.string().describe('Exact spoken voiceover text for this scene to display as animated kinetic captions'),
  expectedPropsInterface: z.string().describe('Interface name in types.ts that this component implements, or "none"'),
  keyframeEvents: z.array(z.string()).describe('Internal animation schedule using LOCAL frame numbers (0..durationInFrames) synced to the voiceover landmarks'),
  visualElements: z.array(z.string()).describe('Concrete scene composition layers: SceneBackdrop, characters/trees/props, animated SVGs, physics arrows, bursts, or editorial UI cards'),
  beats: z
    .array(DirectorBeatSchema)
    .describe('At least one entry per provided BEAT SLOT, plus extra word-anchored beats for every key entity/number mentioned. Every beat must visibly change the frame.'),
  highlightWords: z
    .array(z.string())
    .describe('Key spoken words of this scene to paint with a marker highlight in the kinetic headline (numbers, names, punchline words), copied exactly from the narration'),
});

export const DirectorBlueprintSchema = z.object({
  projectName: z.string().describe('PascalCase project name, e.g., "FintechExplainerVideo"'),
  mainCompositionName: z.string().describe('Master composition component name (default: "MainComposition")'),
  mainFilePath: z.string().describe('Master composition file path (default: "components/MainComposition.tsx")'),
  width: z.number().describe('Video width in pixels (default: 1080 for 9:16 vertical short-form video)'),
  height: z.number().describe('Video height in pixels (default: 1920 for 9:16 vertical short-form video)'),
  fps: z.number().describe('Frames per second (default: 30)'),
  totalDurationInFrames: z.number().describe('Total video duration in frames'),
  sharedTypesCode: z.string().describe('TypeScript code for types.ts containing prop interfaces for each scene and shared data'),
  sharedThemeCode: z.string().describe('TypeScript code for constants/theme.ts built from the Style Brief palette, typography sizes for 1080x1920, and surface tokens'),
  backgroundComponent: z.object({
    componentName: z.string().describe('Ambient background component name (default: "BackgroundLayer")'),
    filePath: z.string().describe('Background component file path (default: "components/common/BackgroundLayer.tsx")'),
    description: z.string().describe('Visual description of the rich multi-layered ambient background (gradient meshes, glowing orbs, moving grid)'),
  }),
  scenes: z.array(ChoreographedScenePlanSchema).describe('Detailed per-scene animation choreography with exact frame durations'),
  directorNotes: z.string().describe('Art direction and scene transition notes for the Remotion engineer'),
});

export type ChoreographedScenePlan = z.infer<typeof ChoreographedScenePlanSchema>;
export type DirectorBlueprint = z.infer<typeof DirectorBlueprintSchema>;
