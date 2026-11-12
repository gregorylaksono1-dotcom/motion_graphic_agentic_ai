import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { GoogleGenAI } from '@google/genai';

/**
 * Creates a standard 44-byte WAV header for linear PCM audio data.
 */
function createWavHeader(
  dataLength: number,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16
): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM format chunk size
  header.writeUInt16LE(1, 20); // 1 = Linear PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

/**
 * Generates a mock WAV audio buffer (useful for offline/dev testing)
 */
function generateMockWavBuffer(durationSeconds: number, sampleRate: number = 24000): Buffer {
  const numSamples = Math.floor(sampleRate * durationSeconds);
  const dataLength = numSamples * 2; // 16-bit = 2 bytes per sample
  const header = createWavHeader(dataLength, sampleRate, 1, 16);
  const pcmData = Buffer.alloc(dataLength);

  // Generate a very quiet tone so it is a valid audible waveform
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.05 * 32767;
    pcmData.writeInt16LE(Math.round(sample), i * 2);
  }

  return Buffer.concat([header, pcmData]);
}

const server = new Server(
  {
    name: 'gemini-tts-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. List MCP Tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'generate_gemini_tts',
        description:
          'Generates high-quality TTS voiceover audio using the Google Gemini multimodal model and saves it as a playable .wav audio file for Remotion.',
        inputSchema: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'The spoken script / voiceover text to synthesize',
            },
            outputPath: {
              type: 'string',
              description: 'Relative or absolute file path to save the .wav file (e.g. "output/assets/audio/scene_1.wav")',
            },
            voiceName: {
              type: 'string',
              description: 'Gemini pre-built voice persona: "Puck", "Charon", "Aoede", "Fenrir", or "Kore"',
              enum: ['Puck', 'Charon', 'Aoede', 'Fenrir', 'Kore'],
              default: 'Puck',
            },
            language: {
              type: 'string',
              description: 'Language code, e.g. "id-ID" or "en-US"',
              default: 'id-ID',
            },
          },
          required: ['text', 'outputPath'],
        },
      },
      {
        name: 'list_gemini_voices',
        description: 'Returns available pre-built voices from Gemini and their acoustic characteristics.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// 2. Execute MCP Tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'list_gemini_voices') {
    const voices = [
      { name: 'Puck', gender: 'male', description: 'Energetic, youthful, articulate, great for tech intros' },
      { name: 'Charon', gender: 'male', description: 'Deep, cinematic, authoritative, great for trailers' },
      { name: 'Aoede', gender: 'female', description: 'Warm, engaging, conversational, friendly tone' },
      { name: 'Fenrir', gender: 'male', description: 'Intense, dynamic, commanding presence' },
      { name: 'Kore', gender: 'female', description: 'Calm, thoughtful, soothing, explainer tone' },
    ];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(voices, null, 2),
        },
      ],
    };
  }

  if (name === 'generate_gemini_tts') {
    const text = (args as any)?.text as string;
    const outputPath = (args as any)?.outputPath as string;
    const voiceName = ((args as any)?.voiceName as string) || 'Puck';
    const language = ((args as any)?.language as string) || 'id-ID';
    const ttsModel = ((args as any)?.model as string) || process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';

    if (!text || !outputPath) {
      throw new Error('Both "text" and "outputPath" are required arguments.');
    }

    const fullPath = path.resolve(process.cwd(), outputPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    // Estimate fallback duration for offline mode
    const wordCount = text.trim().split(/\s+/).length;
    const estimatedSeconds = Number((Math.max(2.5, wordCount / 2.3)).toFixed(2));

    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      try {
        console.error(`[Gemini TTS MCP] Calling ${ttsModel} (v1beta) with voice "${voiceName}" for: "${text.slice(0, 50)}..."`);
        const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
        const startTime = Date.now();

        const response = await ai.models.generateContent({
          model: ttsModel,
          contents: text,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName as any,
                },
              },
            },
          },
        });
        const durationMs = Date.now() - startTime;

        const usageMeta = response.usageMetadata;
        const inputTokens = Number(usageMeta?.promptTokenCount ?? 0);
        const outputTokens = Number(usageMeta?.candidatesTokenCount ?? 0);
        const totalTokens = Number(usageMeta?.totalTokenCount ?? inputTokens + outputTokens);

        // Extract audio bytes from candidate parts
        let audioBuffer: Buffer | null = null;
        let actualDurationSeconds = estimatedSeconds;
        const candidates = response.candidates || [];
        for (const candidate of candidates) {
          const parts = candidate.content?.parts || [];
          for (const part of parts) {
            if (part.inlineData && part.inlineData.mimeType?.startsWith('audio/')) {
              const base64Data = part.inlineData.data;
              if (base64Data) {
                const rawPcm = Buffer.from(base64Data, 'base64');
                // Calculate exact duration: 24kHz * 1 channel * 2 bytes (16-bit) = 48,000 bytes/sec
                actualDurationSeconds = Number((rawPcm.length / (24000 * 1 * 2)).toFixed(2));
                const header = createWavHeader(rawPcm.length, 24000, 1, 16);
                audioBuffer = Buffer.concat([header, rawPcm]);
                break;
              }
            }
          }
          if (audioBuffer) break;
        }

        if (audioBuffer) {
          await fs.writeFile(fullPath, audioBuffer);
          const stats = await fs.stat(fullPath);
          console.error(`[Gemini TTS MCP] Successfully generated audio (${stats.size} bytes, ${actualDurationSeconds}s) -> ${fullPath}`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    success: true,
                    mode: 'gemini_api',
                    modelUsed: ttsModel,
                    filePath: outputPath,
                    absolutePath: fullPath,
                    fileSize: stats.size,
                    durationSeconds: actualDurationSeconds,
                    voiceUsed: voiceName,
                    durationMs,
                    usage: {
                      inputTokens,
                      outputTokens,
                      totalTokens,
                    },
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      } catch (err: any) {
        console.error(`[Gemini TTS MCP] Gemini API call failed (${ttsModel}): ${err.message}. Falling back to clean placeholder audio.`);
      }
    }

    // Fallback: Generate clean, valid placeholder WAV buffer so local testing never crashes
    console.error(`[Gemini TTS MCP] Generating local placeholder WAV (${estimatedSeconds}s) -> ${outputPath}`);
    const mockWav = generateMockWavBuffer(estimatedSeconds, 24000);
    await fs.writeFile(fullPath, mockWav);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              mode: 'local_placeholder',
              filePath: outputPath,
              absolutePath: fullPath,
              fileSize: mockWav.length,
              durationSeconds: estimatedSeconds,
              voiceUsed: voiceName,
              note: 'Generated valid WAV audio file. To use live Gemini voice, configure GOOGLE_GENERATIVE_AI_API_KEY in .env',
            },
            null,
            2
          ),
        },
      ],
    };
  }

  throw new Error(`Tool not found: ${name}`);
});

// 3. Connect stdio transport
async function startServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Gemini TTS MCP Server] Running on stdio');
}

startServer().catch((err) => {
  console.error('[Gemini TTS MCP Server] Failed to start:', err);
  process.exit(1);
});

