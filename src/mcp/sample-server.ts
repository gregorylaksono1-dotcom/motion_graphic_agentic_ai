import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Sample MCP Server for Motion Graphics:
 * Provides design tokens, curated color palettes, and motion presets
 * to the Agentic AI via the official Model Context Protocol (MCP) stdio interface.
 */
const server = new Server(
  {
    name: 'motion-design-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 1. List available MCP tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'get_motion_theme',
        description: 'Returns curated color palettes and styling rules for a given motion graphic theme (e.g. "cyberpunk", "minimalist", "corporate", "neon_synthwave", "fintech").',
        inputSchema: {
          type: 'object',
          properties: {
            theme: {
              type: 'string',
              description: 'The visual theme name',
              enum: ['cyberpunk', 'minimalist', 'corporate', 'neon_synthwave', 'fintech'],
            },
          },
          required: ['theme'],
        },
      },
      {
        name: 'get_physics_preset',
        description: 'Returns recommended Remotion spring physics configurations (damping, mass, stiffness) for specific motion vibes (e.g. "bouncy", "snappy", "heavy", "smooth_glide").',
        inputSchema: {
          type: 'object',
          properties: {
            vibe: {
              type: 'string',
              description: 'The desired animation feel/vibe',
              enum: ['bouncy', 'snappy', 'heavy', 'smooth_glide'],
            },
          },
          required: ['vibe'],
        },
      },
    ],
  };
});

// 2. Handle MCP tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'get_motion_theme') {
    const theme = (args as any)?.theme || 'cyberpunk';
    const themes: Record<string, any> = {
      cyberpunk: {
        background: '#0a0a14',
        surface: 'rgba(15, 17, 30, 0.85)',
        primary: '#00ffcc',
        secondary: '#ff007f',
        accent: '#ffe600',
        text: '#ffffff',
        glowStyle: '0 0 30px rgba(0, 255, 204, 0.5)',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      minimalist: {
        background: '#f8f9fa',
        surface: '#ffffff',
        primary: '#111827',
        secondary: '#4b5563',
        accent: '#2563eb',
        text: '#0f172a',
        glowStyle: 'none',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      },
      fintech: {
        background: '#04111d',
        surface: 'rgba(16, 30, 48, 0.9)',
        primary: '#00d26a',
        secondary: '#0070f3',
        accent: '#00e5ff',
        text: '#f1f5f9',
        glowStyle: '0 0 25px rgba(0, 210, 106, 0.4)',
        fontFamily: 'SF Pro Display, Inter, sans-serif',
      },
      corporate: {
        background: '#0f172a',
        surface: '#1e293b',
        primary: '#38bdf8',
        secondary: '#818cf8',
        accent: '#f59e0b',
        text: '#f8fafc',
        glowStyle: 'none',
        fontFamily: 'Inter, sans-serif',
      },
      neon_synthwave: {
        background: '#130026',
        surface: '#2b004f',
        primary: '#ff007f',
        secondary: '#00f0ff',
        accent: '#ffb703',
        text: '#ffffff',
        glowStyle: '0 0 35px rgba(255, 0, 127, 0.6)',
        fontFamily: 'Courier New, monospace',
      },
    };

    const selected = themes[theme] || themes.cyberpunk;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(selected, null, 2),
        },
      ],
    };
  }

  if (name === 'get_physics_preset') {
    const vibe = (args as any)?.vibe || 'snappy';
    const presets: Record<string, any> = {
      bouncy: { damping: 8, mass: 0.5, stiffness: 120, description: 'High overshoot and playful bounce' },
      snappy: { damping: 14, mass: 0.8, stiffness: 180, description: 'Quick, crisp, minimal overshoot' },
      heavy: { damping: 20, mass: 2.0, stiffness: 90, description: 'Cinematic, heavy, deliberate momentum' },
      smooth_glide: { damping: 18, mass: 1.0, stiffness: 70, description: 'Velvety smooth, floaty easing' },
    };

    const selected = presets[vibe] || presets.snappy;
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(selected, null, 2),
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
  console.error('[MCP Server] Motion Design MCP Server running on stdio');
}

startServer().catch((err) => {
  console.error('[MCP Server] Failed to start:', err);
  process.exit(1);
});

