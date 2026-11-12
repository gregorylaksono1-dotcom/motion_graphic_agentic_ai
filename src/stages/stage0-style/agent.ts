import fs from 'node:fs';
import path from 'node:path';
import type { ModelConfig } from '../../llm/provider.js';
import { createStageLlm } from '../../llm/factory.js';
import { promptLoader } from '../../core/prompt-loader.js';
import {
  STYLE_PRESETS,
  buildStyleProfile,
  matchPresetExact,
  pickPresetHeuristically,
  presetToGenome,
  profileFromGenome,
  type StyleProfile,
} from '../../styles/presets.js';
import {
  BODY_FONTS,
  DISPLAY_FONTS,
  MONO_FONTS,
  StyleGenomeSchema,
  applyBrandKit,
  fingerprint,
  mutateGenome,
  sanitizeGenome,
  similarity,
  type BrandKit,
  type GenomeFingerprint,
  type StyleGenome,
} from '../../styles/genome.js';

export interface StyleResolveOptions {
  /** Creative seed (default: random). Same seed + same inputs => reproducible mutation */
  seed?: number;
  brandKit?: BrandKit;
  /** Anti-repetition memory (default: library/style-history.json) */
  historyPath?: string;
}

const SIMILARITY_LIMIT = 0.6;
const HISTORY_SIZE = 30;

function readHistory(file: string): GenomeFingerprint[] {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

function writeHistory(file: string, history: GenomeFingerprint[]) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(history.slice(-HISTORY_SIZE), null, 2));
}

/**
 * Stage 0: Art Director.
 * - exact preset id/label            -> preset look (no LLM)
 * - anything else (free text / none) -> LLM designs a unique Style Genome
 * Then: brand locks applied, readability guardrails, anti-repetition check vs recent looks
 * (seeded mutation if too similar), and the look is recorded in the style history.
 */
export class StyleAnalystAgent {
  constructor(private modelConfig?: ModelConfig) {}

  async resolveStyle(userStory: string, userStyle?: string, opts: StyleResolveOptions = {}): Promise<StyleProfile> {
    const requested = userStyle?.trim();
    const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000);
    const kit = opts.brandKit || {};
    const historyPath = opts.historyPath || path.resolve(process.cwd(), 'library', 'style-history.json');
    const history = readHistory(historyPath);

    if (requested && requested.toLowerCase() !== 'auto') {
      const exact = matchPresetExact(requested);
      if (exact) {
        console.log(`\n🎨 [Stage 0: Style] User-selected preset: ${exact}`);
        return buildStyleProfile(exact, { source: 'user', reasoning: 'Explicitly selected by user.' });
      }
    }

    console.log(
      `\n🎨 [Stage 0: Art Director] Designing Style Genome ${requested ? `from direction "${requested}"` : 'automatically from theme'} (seed ${seed})...`
    );

    let genome: StyleGenome;
    let source: StyleProfile['source'];
    try {
      genome = await this.askLlm(userStory, requested, kit, history, seed);
      source = kit.palette || kit.fonts ? 'brand' : requested ? 'user-freeform' : 'auto';
    } catch (err: any) {
      const h = pickPresetHeuristically(`${userStory} ${requested || ''}`);
      console.warn(`  ⚠️ Art Director LLM failed (${err.message}). Fallback: genome from preset ${h.id} + seed mutation.`);
      genome = mutateGenome(presetToGenome(STYLE_PRESETS[h.id]), seed, kit);
      source = 'heuristic';
    }

    // brand colors/fonts stay EXACT: sanitize around them, then re-apply the locks
    const lockBrand = (g: StyleGenome) => applyBrandKit(sanitizeGenome(applyBrandKit(g, kit)), kit);
    genome = lockBrand(genome);

    // Anti-repetition: mutate (seeded) until it is clearly different from recent looks
    for (let attempt = 0; attempt < 4; attempt++) {
      const fp = fingerprint(genome);
      const closest = history.reduce((m, h) => Math.max(m, similarity(fp, h)), 0);
      if (closest < SIMILARITY_LIMIT) break;
      console.log(`  🔁 Too similar to previous look (similarity ${closest.toFixed(2)}) → mutation #${attempt + 1}`);
      genome = lockBrand(mutateGenome(genome, seed + attempt * 7919, kit, history.slice(-8).map((h) => h.primaryHue)));
    }

    writeHistory(historyPath, [...history, fingerprint(genome)]);
    console.log(`  ✅ Genome "${genome.name}" | ${genome.fonts.display} + ${genome.fonts.body} | ${genome.backdrop.pattern}/${genome.backdrop.decor} | ${genome.layoutMode}`);
    console.log(`  💡 ${genome.rationale}`);
    return profileFromGenome(genome, { source, customStyleNotes: requested || '' });
  }

  private async askLlm(userStory: string, userStyle: string | undefined, kit: BrandKit, history: GenomeFingerprint[], seed: number): Promise<StyleGenome> {
    const promptConfig = promptLoader.load('stage0-style-analyst');
    const llm = createStageLlm('stage0-style-analyst', this.modelConfig);
    const system = promptLoader.interpolate(promptConfig.system_prompt, {
      displayFonts: DISPLAY_FONTS.join(', '),
      bodyFonts: BODY_FONTS.join(', '),
      monoFonts: MONO_FONTS.join(', '),
    });
    const recent = history.slice(-8);
    const user = promptLoader.interpolate(promptConfig.user_prompt_template || '{{userStory}}', {
      userStory,
      userStyle: userStyle ? `"${userStyle}"` : '(none — design the best look for this topic)',
      brandLocks:
        kit.palette || kit.fonts || kit.avoid
          ? JSON.stringify({ palette: kit.palette || {}, fonts: kit.fonts || {}, avoid: kit.avoid || [] })
          : '(none)',
      recentLooks:
        recent.length > 0
          ? recent
              .map((h) => `- "${h.name}": primary hue ${h.primaryHue}°, ${h.bgLight ? 'light' : 'dark'} bg, display ${h.display}, pattern ${h.pattern}, decor ${h.decor}, sticker ${h.sticker}, captions ${h.caption}`)
              .join('\n')
          : '(none yet)',
      seed,
    });
    return llm.generateStructured({ system, user, schema: StyleGenomeSchema, schemaName: 'style_genome' });
  }
}
