import type { ModelConfig } from '../../llm/provider.js';
import type { LlmClient } from '../../llm/types.js';
import { createStageLlm } from '../../llm/factory.js';
import { StoryboardPlanSchema, type StoryboardPlan } from '../../types/story.js';
import { promptLoader } from '../../core/prompt-loader.js';
import { describeStyleForPrompt, type StyleProfile } from '../../styles/presets.js';

export class ScriptwriterAgent {
  private llm: LlmClient;

  constructor(modelConfig?: ModelConfig) {
    this.llm = createStageLlm('stage1-scriptwriter', modelConfig);
  }

  /**
   * LLM 1: Mengubah ide/cerita menjadi naskah storyboard terstruktur dengan prompt eksternal YAML,
   * dibatasi oleh StyleProfile global (Stage 0).
   */
  async generateStoryboard(userStory: string, style: StyleProfile, userAssetsBrief = ''): Promise<StoryboardPlan> {
    console.log(`\n🎭 [LLM 1: Scriptwriter] Drafting storyboard & scene script (via prompts/stage1-scriptwriter.yml)...`);

    const promptConfig = promptLoader.load('stage1-scriptwriter');
    const userPrompt = promptLoader.interpolate(
      promptConfig.user_prompt_template || 'Create a motion graphic storyboard based on: {{userStory}}',
      {
        userStory,
        styleBrief: describeStyleForPrompt(style),
        allowedStyles: style.sceneStyles.join(', '),
        beatIntervalSec: style.pacing.beatIntervalSec,
        userAssetsBrief: userAssetsBrief || 'User-provided images: none. User-provided facts: none.',
      }
    );

    const response = await this.llm.generateStructured({
      system: promptConfig.system_prompt,
      user: userPrompt,
      schema: StoryboardPlanSchema,
      schemaName: 'storyboard_decomposer',
    });

    return enforceStyleOnStoryboard(response, style);
  }
}

/**
 * Deterministic guardrails after LLM 1:
 * - every scene's visualStyleTag must belong to the chosen preset
 * - ONE consistent narrator voice across all scenes (mixed voices sound broken on social)
 * - scenes renumbered sequentially, visualBeats never empty
 */
export function enforceStyleOnStoryboard(plan: StoryboardPlan, style: StyleProfile): StoryboardPlan {
  const allowed = style.sceneStyles;
  let remapped = 0;

  const scenes = plan.scenes.map((scene, idx) => {
    let tag = scene.visualStyleTag;
    if (!allowed.includes(tag)) {
      tag = idx === 0 ? allowed[0] : allowed[idx % allowed.length];
      remapped++;
    }
    const visualBeats =
      Array.isArray(scene.visualBeats) && scene.visualBeats.length > 0
        ? scene.visualBeats
        : [scene.keyVisualAction || scene.visualConcept];

    return {
      ...scene,
      sceneNumber: idx + 1,
      visualStyleTag: tag,
      visualBeats,
      ttsVoiceover: {
        ...scene.ttsVoiceover,
        geminiVoiceName: style.voice.geminiVoiceName,
        voiceTone: scene.ttsVoiceover.voiceTone || style.voice.voiceTone,
        voiceSpeed: clamp(scene.ttsVoiceover.voiceSpeed || style.voice.voiceSpeed, 0.95, 1.18),
      },
    };
  });

  if (remapped > 0) {
    console.log(`  🎨 ${remapped} scene(s) remapped to a world matching preset "${style.id}".`);
  }

  return {
    ...plan,
    chapterLabel: (plan.chapterLabel || plan.title || '').toUpperCase().slice(0, 32),
    cornerLabel: (plan.cornerLabel || 'LIVE').toUpperCase().replace(/\s+/g, ' ').slice(0, 12),
    visualStyle: `${style.label}${style.customStyleNotes ? ' — ' + style.customStyleNotes : ''}`,
    scenes,
  };
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
