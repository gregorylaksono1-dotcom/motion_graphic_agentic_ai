import { z } from 'zod';

// ============================================================================
// TTS Voiceover Detail Schema (Mapped to JSON)
// Note: Avoid `.default()` on Zod v4 fields used in OpenAI Strict JSON Schema,
// because Zod v4 emits `$ref` + sibling keywords (`default`, `description`) which OpenAI rejects.
// ============================================================================

export const TTSVoiceoverSchema = z.object({
  spokenText: z.string().describe('Pure spoken narration script to be synthesized by voiceover/TTS'),
  voiceGender: z.enum(['male', 'female']).describe('Narrator voice gender (default: male)'),
  voiceTone: z
    .enum(['enthusiastic', 'mysterious', 'authoritative', 'calm', 'cinematic'])
    .describe('Acoustic character and voice tone (default: cinematic)'),
  voiceSpeed: z.number().describe('Speaking pace: 0.8 = slow, 1.0 = normal, 1.2 = fast (default: 1.0)'),
  emotion: z.string().describe('Voice emotion, e.g., "inspiring", "urgent", "curious", "engaging"'),
  geminiVoiceName: z
    .enum(['Puck', 'Charon', 'Aoede', 'Fenrir', 'Kore'])
    .describe('Gemini pre-built voice persona (default: Puck)'),
  soundEffectsCue: z
    .array(z.string())
    .describe('SFX cues supporting the voiceover, e.g., ["woosh_transition", "digital_click"], or [] if none'),
});

export const SceneVisualStyleTagSchema = z.enum([
  'editorial-ui',
  'flat-vector',
  'soft-3d',
  'chalkboard',
  'comic-art',
  'glow-sketch',
  'dan-koe',
  'cgi-motion',
  'neo-brutal',
  'halftone-navy',
  'paper-file',
  'genome-base',
  'genome-alt',
]);

export type SceneVisualStyleTag = z.infer<typeof SceneVisualStyleTagSchema>;

export const SceneScriptSchema = z.object({
  sceneNumber: z.number().describe('Sequential scene number (1, 2, 3...)'),
  sceneTitle: z.string().describe('Short scene title, e.g., "Opening Hook"'),
  visualStyleTag: SceneVisualStyleTagSchema.describe(
    'Signature motion graphic aesthetic for this scene: editorial-ui (clean light UI hook/CTA), flat-vector (layered hills/trees/characters), soft-3d (soft shaded 3D props), chalkboard (green board self-drawing physics sketch), comic-art (halftone + ink + starburst), glow-sketch (dark gold/cyan dotted glow), dan-koe (high-contrast B&W minimal line art), cgi-motion (clean atmospheric horizon + reflections), neo-brutal (cream grid canvas, flat saturated blocks, thick black outlines, hard offset shadows), halftone-navy (deep navy halftone-dot canvas with vignette, evidence/data mood), paper-file (cream case-file paper with halftone edges, investigation/report mood), genome-base / genome-alt (the generated Style Genome background: main / contrasting alternate)'
  ),
  ttsVoiceover: TTSVoiceoverSchema.describe('Complete TTS voiceover specification mapped to JSON'),
  visualConcept: z.string().describe('Concrete, story-rich animated environment, characters, props, and visual narrative (NOT generic icon boxes)'),
  keyVisualAction: z.string().describe('Specific focal physical animation happening on screen '),
  visualBeats: z
    .array(z.string())
    .describe(
      'Ordered list of concrete on-screen visual moments, ONE per ~2 seconds of narration (≈ one per 5 spoken words; typically 3-5 per scene). Each must change something visible: a new prop enters, a number counts up, a character reacts, a diagram draws, a comparison splits, a burst pops.'
    ),
  characters: z
    .array(z.string())
    .describe('Characters, avatars, animals, trees, or hero visual subjects appearing in this scene, or [] if none'),
  requiredMcpTools: z
    .array(z.string())
    .describe('External MCP tools or data needed, e.g., ["gemini_tts", "gmaps_polygon", "lucide_icons"], or [] if none'),
  mood: z
    .enum(['energetic', 'calm', 'futuristic', 'serious', 'playful'])
    .describe('Overall visual/emotional mood of the scene (default: futuristic)'),
});

export const StoryboardPlanSchema = z.object({
  title: z.string().describe('Motion graphic video title'),
  synopsis: z.string().describe('Brief synopsis of the overall story flow'),
  visualStyle: z.string().describe('Global visual theme, e.g., "Dark Cyberpunk Neon", "Minimalist Clean Tech"'),
  targetAudience: z.string().describe('Target audience of the video'),
  chapterLabel: z
    .string()
    .describe('Short UPPERCASE series/chapter label shown top-left for the whole video, e.g. "SERIES NAME · EP 01" (max 28 chars)'),
  cornerLabel: z
    .string()
    .describe('One short UPPERCASE word shown top-right next to a blinking REC dot and scene counter, e.g. "DATA" (max 10 chars)'),
  scenes: z.array(SceneScriptSchema).describe('Ordered list of structured video scenes'),
});

export type TTSVoiceover = z.infer<typeof TTSVoiceoverSchema>;
export type SceneScript = z.infer<typeof SceneScriptSchema>;
export type StoryboardPlan = z.infer<typeof StoryboardPlanSchema>;
