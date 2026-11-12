import { z } from 'zod';

export const SingleFileResultSchema = z.object({
  filePath: z.string(),
  code: z.string().describe('Complete, 100% valid TypeScript React source code for Remotion'),
  exportedSymbols: z.array(z.string()),
  notes: z.string(),
});

export type SingleFileResult = z.infer<typeof SingleFileResultSchema>;

export interface GeneratedFileManifest {
  path: string;
  exportedSymbols: string[];
}
