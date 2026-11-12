import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { StructuredTool } from '@langchain/core/tools';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export class LangChainMCPManager {
  private client: MultiServerMCPClient | null = null;
  private serverConfigs: Record<string, any> = {};

  /**
   * Register a stdio MCP server (e.g. filesystem, fetch, github, etc.)
   */
  addStdioServer(config: MCPServerConfig): void {
    this.serverConfigs[config.name] = {
      transport: 'stdio',
      command: config.command,
      args: config.args || [],
      env: {
        ...process.env,
        ...(config.env || {}),
      },
    };
    console.log(`[LangChain MCP] Registered server: ${config.name}`);
  }

  /**
   * Connect to all configured MCP servers and load their tools as LangChain StructuredTools.
   */
  async getTools(): Promise<StructuredTool[]> {
    if (Object.keys(this.serverConfigs).length === 0) {
      return [];
    }

    try {
      this.client = new MultiServerMCPClient({
        servers: this.serverConfigs,
      });

      const tools = await this.client.getTools();
      console.log(`[LangChain MCP] Loaded ${tools.length} tool(s) from MCP servers.`);
      return tools;
    } catch (err) {
      console.error('[LangChain MCP] Failed to load MCP tools:', err);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        console.log('[LangChain MCP] Closed all MCP connections.');
      } catch (err) {
        console.error('[LangChain MCP] Error closing MCP client:', err);
      }
      this.client = null;
    }
  }
}
