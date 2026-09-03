export {};

type WebMcpJsonSchema = Record<string, unknown>;

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: WebMcpJsonSchema;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

interface ModelContext {
  registerTool: (tool: WebMcpTool) => void;
  getTools?: () => WebMcpTool[];
  executeTool?: (name: string, input: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}
