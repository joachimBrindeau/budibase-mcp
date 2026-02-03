import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { BudibaseClient } from './clients/budibase';
import { tools } from './tools';
import { resources } from './resources';
import { logger } from './utils/logger';
import { MCPError, ErrorCodes, BudibaseError } from './utils/errors';

export class BudibaseMCPServer {
  private server: Server;
  private budibaseClient: BudibaseClient;

  constructor() {
    this.server = new Server(
      {
        name: 'budibase-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.budibaseClient = new BudibaseClient();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logger.debug('Listing available tools');
      return {
        tools: tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });
    // Execute tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logger.info(`Executing tool: ${name}`, { arguments: args });

      try {
        const tool = tools.find(t => t.name === name);
        if (!tool) {
          throw new MCPError(
            ErrorCodes.METHOD_NOT_FOUND,
            `Tool not found: ${name}`
          );
        }

        const result = await tool.execute(args, this.budibaseClient);
        logger.debug(`Tool ${name} executed successfully`, { result });

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, error);

        // Return user-friendly error as tool result instead of throwing
        const userMessage = error instanceof BudibaseError
          ? error.toUserMessage()
          : error instanceof Error
            ? error.message
            : String(error);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: userMessage,
                message: `Tool '${name}' failed: ${userMessage}`
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      logger.debug('Listing available resources');
      return {
        resources: resources.map(resource => ({
          uri: resource.uri,
          name: resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        })),
      };
    });
    // Read resource content
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      logger.info(`Reading resource: ${uri}`);

      try {
        const resource = resources.find(r => r.uri === uri);
        if (!resource) {
          throw new MCPError(
            ErrorCodes.INVALID_REQUEST,
            `Resource not found: ${uri}`
          );
        }

        const content = await resource.read(this.budibaseClient);
        logger.debug(`Resource ${uri} read successfully`);

        return {
          contents: [
            {
              uri,
              mimeType: resource.mimeType,
              text: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
            },
          ],
        };
      } catch (error) {
        logger.error(`Resource read failed: ${uri}`, error);

        const userMessage = error instanceof BudibaseError
          ? error.toUserMessage()
          : error instanceof Error
            ? error.message
            : String(error);

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify({
                success: false,
                error: userMessage,
                message: `Failed to read resource: ${userMessage}`
              }, null, 2),
            },
          ],
        };
      }
    });
  }

  async start() {
    logger.info('Initializing Budibase client...');
    await this.budibaseClient.initialize();

    if (!this.budibaseClient.isConnected()) {
      logger.warn('Server starting with connection issues. Tools will report errors until connection is restored.');
    }

    logger.info('Starting MCP server transport...');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    logger.info('Budibase MCP Server is ready', {
      connected: this.budibaseClient.isConnected(),
      connectionError: this.budibaseClient.getConnectionError()
    });
  }

  async stop() {
    logger.info('Stopping Budibase MCP Server...');
    await this.server.close();
    logger.info('Server stopped');
  }
}