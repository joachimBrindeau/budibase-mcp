import type { BudibaseClient } from '../clients/budibase';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  execute: (args: unknown, client: BudibaseClient) => Promise<unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: (client: BudibaseClient) => Promise<unknown> | unknown;
}
