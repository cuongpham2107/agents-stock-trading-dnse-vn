import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export class McpClient {
  private client: Client;
  private transport: StdioClientTransport | null = null;

  constructor() {
    this.client = new Client({ name: "dnse-chatbot", version: "1.0.0" });
  }

  async connect(serverConfig: {
    command: string;
    args: string[];
    env?: Record<string, string>;
    cwd?: string;
  }): Promise<void> {
    this.transport = new StdioClientTransport(serverConfig);
    await this.client.connect(this.transport);
  }

  async listTools(): Promise<McpTool[]> {
    const result = await this.client.listTools();
    return result.tools;
  }

  async callTool(
    name: string,
    args: Record<string, unknown>
  ): Promise<string> {
    const result = await this.client.callTool({ name, arguments: args });

    if (result.content && Array.isArray(result.content)) {
      return result.content
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("\n");
    }

    return JSON.stringify(result);
  }

  async close(): Promise<void> {
    if (this.transport) {
      await this.client.close();
    }
  }
}
