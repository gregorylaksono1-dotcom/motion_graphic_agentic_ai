/**
 * Generates `components/common/HeadlineCaptions.tsx`:
 * the narration itself becomes the top headline, typed word-by-word on the real word timings,
 * letters dropping in, numbers & key words painted with a marker block. Phrase chunks reset on
 * sentence ends or when the chunk gets too long (like viral "evidence" explainers).
 */
export function buildHeadlineCaptionsCode(): string {
  return `import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TOKENS } from '../../constants/genome';

export interface HeadlineWordTiming {
  word: string;
  startFrame: number;
  endFrame: number;
  clauseBreakAfter?: boolean;
}

export interface HeadlineCaptionsProps {
  wordTimings: HeadlineWordTiming[];
  highlightWords?: string[];
  theme?: 'dark' | 'light';
  markerColor?: string;
  top?: number;
  fontSize?: number;
}

const norm = (w: string) =>
  w.toLowerCase().replace(/(\\d)[.,](\\d)/g, '$1$2').replace(/[^\\p{L}\\p{N}%]/gu, '');

function buildChunks(timings: HeadlineWordTiming[]): HeadlineWordTiming[][] {
  const chunks: HeadlineWordTiming[][] = [];
  let buf: HeadlineWordTiming[] = [];
  let chars = 0;
  timings.forEach((wt, i) => {
    buf.push(wt);
    chars += wt.word.length + 1;
    const sentenceEnd = /[.!?…]$/.test(wt.word);
    const commaBreak = /[,;:]$/.test(wt.word) && buf.length >= 5;
    if (sentenceEnd || commaBreak || chars >= 40 || buf.length >= 7 || i === timings.length - 1) {
      chunks.push(buf);
      buf = [];
      chars = 0;
    }
  });
  return chunks;
}

export const HeadlineCaptions: React.FC<HeadlineCaptionsProps> = ({
  wordTimings,
  highlightWords = [],
  theme = 'dark',
  markerColor = TOKENS.palette.accent,
  top = 150,
  fontSize = 84,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const chunks = useMemo(() => buildChunks(wordTimings || []), [wordTimings]);
  const hl = useMemo(() => new Set(highlightWords.map(norm)), [highlightWords]);
  if (chunks.length === 0) return null;

  let active = -1;
  for (let i = 0; i < chunks.length; i++) if (chunks[i][0].startFrame - 1 <= frame) active = i;
  if (active < 0) return null;
  const chunk = chunks[active];

  const textColor = theme === 'dark' ? '#FFFFFF' : TOKENS.palette.deep;
  const shadow = theme === 'dark' ? '0 5px 0 rgba(8,10,30,0.55), 0 10px 26px rgba(0,0,0,0.35)' : '3px 4px 0 rgba(0,0,0,0.12)';
  const hlMode = TOKENS.caption.highlight;
  const markerText = hlMode === 'color' ? markerColor : TOKENS.palette.onAccent;

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          top,
          left: 56,
          right: 56,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: '4px 20px',
          fontFamily: TOKENS.fonts.display,
          fontWeight: TOKENS.fonts.displayWeight,
          textTransform: TOKENS.displayCase === 'upper' ? 'uppercase' : 'none',
          fontSize,
          lineHeight: 1.08,
          letterSpacing: '-0.015em',
        }}
      >
        {chunk.map((wt, i) => {
          if (frame < wt.startFrame - 1) return null;
          const isHl = /\\d/.test(wt.word) || hl.has(norm(wt.word));
          const letters = Array.from(wt.word);
          const marker = interpolate(frame, [wt.startFrame, wt.startFrame + 6], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <span key={active + '-' + i} style={{ position: 'relative', display: 'inline-block', padding: isHl ? '0 10px' : 0 }}>
              {isHl && hlMode !== 'color' && (
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '12%',
                    bottom: '-2%',
                    backgroundColor: markerColor,
                    transformOrigin: 'left center',
                    transform: 'scaleX(' + marker + ') skewX(' + (hlMode === 'box' ? 0 : -4) + 'deg)',
                    borderRadius: hlMode === 'box' ? Math.min(10, TOKENS.shape.radius) : 4,
                    border: hlMode === 'box' ? '4px solid #0B0F1A' : undefined,
                    boxShadow: hlMode === 'box' ? '6px 6px 0 #0B0F1A' : undefined,
                  }}
                />
              )}
              {letters.map((ch, j) => {
                const s = spring({
                  frame: Math.max(0, frame - wt.startFrame + 1 - j * 0.6),
                  fps,
                  config: { damping: 13, stiffness: 320, mass: 0.5 },
                });
                return (
                  <span
                    key={j}
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      color: isHl ? markerText : textColor,
                      textShadow: isHl && hlMode !== 'color' ? 'none' : shadow,
                      opacity: Math.min(1, s * 1.6),
                      transform: 'translateY(' + (1 - s) * -38 + 'px)',
                    }}
                  >
                    {ch}
                  </span>
                );
              })}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
`;
}
