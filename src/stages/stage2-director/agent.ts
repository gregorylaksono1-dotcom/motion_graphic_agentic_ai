import type { ModelConfig } from '../../llm/provider.js';
import type { LlmClient } from '../../llm/types.js';
import { createStageLlm } from '../../llm/factory.js';
import type { TimedStoryboard } from '../../types/timeline.js';
import { DirectorBlueprintSchema, type DirectorBlueprint } from '../../types/director.js';
import { promptLoader } from '../../core/prompt-loader.js';
import { formatBeatSlots } from '../bridge/beat-grid.js';
import { enforceBlueprint } from './beat-enforcer.js';
import { describeStyleForPrompt, type StyleProfile } from '../../styles/presets.js';
import { describePosesForPrompt, type AvatarPack } from '../../avatar/avatar-pack.js';

export interface DirectorExtras {
  avatar?: AvatarPack | null;
  userAssetsBrief?: string;
}

export class MotionDirectorAgent {
  private llm: LlmClient;

  constructor(modelConfig?: ModelConfig) {
    this.llm = createStageLlm('stage2-director', modelConfig);
  }

  /**
   * LLM 2: Mengubah TimedStoryboard menjadi Blueprint Koreografi & Kontrak Teknis
   * Menggunakan prompt eksternal dari prompts/stage2-director.yml
   */
  async choreographTimeline(timedStoryboard: TimedStoryboard, style: StyleProfile, extras: DirectorExtras = {}): Promise<DirectorBlueprint> {
    console.log(`\n🎬 [LLM 2: Motion Director] Orchestrating timeline & choreography (via prompts/stage2-director.yml)...`);

    const promptConfig = promptLoader.load('stage2-director');

    const sceneDetails = timedStoryboard.timedScenes
      .map(
        (s) =>
          `Scene ${s.sceneNumber}: "${s.sceneTitle}" [Style: ${s.visualStyleTag || 'flat-vector'}]
  - Timeline: Global Frame ${s.startFrame} to ${s.endFrame} (LOCAL Scene Frames: 0 to ${s.durationInFrames}, Duration: ${s.durationSeconds}s)
  - Voiceover Script (TTS): "${s.ttsVoiceover.spokenText}"
  - Audio Word/Phrase Landmarks (LOCAL frames): ${s.landmarkCues || 'None'}
  - BEAT SLOTS (fill EVERY slot with one beat, same localFrame):
${formatBeatSlots(s.beatSlots, timedStoryboard.fps)}
  - Visual Story Concept: ${s.visualConcept}
  - Key Visual Action: ${s.keyVisualAction || s.visualConcept}
  - Characters/Subjects: ${s.characters.length > 0 ? s.characters.join(', ') : 'None'}
  - Voice Persona: ${s.ttsVoiceover.geminiVoiceName} (${s.ttsVoiceover.voiceGender}, tone: ${s.ttsVoiceover.voiceTone}, speed: ${s.ttsVoiceover.voiceSpeed})
  - Required Tools/Data: ${s.requiredMcpTools.length > 0 ? s.requiredMcpTools.join(', ') : 'None'}
  - SFX Cues: ${s.ttsVoiceover.soundEffectsCue.length > 0 ? s.ttsVoiceover.soundEffectsCue.join(', ') : 'None'}`
      )
      .join('\n\n');

    const userPrompt = promptLoader.interpolate(
      promptConfig.user_prompt_template || 'Choreograph video {{title}}',
      {
        title: timedStoryboard.title,
        visualStyle: timedStoryboard.visualStyle,
        totalDurationSeconds: timedStoryboard.totalDurationSeconds,
        totalDurationInFrames: timedStoryboard.totalDurationInFrames,
        fps: timedStoryboard.fps,
        sceneDetails,
        styleBrief: describeStyleForPrompt(style),
        beatIntervalSec: style.pacing.beatIntervalSec,
        avatarBrief: extras.avatar
          ? `A presenter avatar sits bottom-right and switches pose on beats. Set 'avatarPose' on beats where the gesture should change (hold each pose ≥ 1s, ~1 change per 2–3s). Available poses:\n${describePosesForPrompt(extras.avatar)}`
          : `No presenter avatar: set 'avatarPose' to "" on every beat.`,
        userAssetsBrief: extras.userAssetsBrief || 'User-provided images: none. User-provided facts: none.',
      }
    );

    const response = await this.llm.generateStructured({
      system: promptConfig.system_prompt,
      user: userPrompt,
      schema: DirectorBlueprintSchema,
      schemaName: 'motion_director_choreographer',
    });

    return enforceBlueprint(response as DirectorBlueprint, timedStoryboard, style, {
      avatarPoses: extras.avatar ? extras.avatar.poses.map((p) => ({ id: p.id, hint: p.hint })) : undefined,
    });
  }
}
