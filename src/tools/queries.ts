import { z } from 'zod';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { validateSchema, AppIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const SearchQueriesSchema = z.object({
  appId: AppIdSchema.optional(),
});

const ExecuteQuerySchema = z.object({
  queryId: z.string().min(1, 'Query ID is required'),
  parameters: z.record(z.any()).optional(),
});

export const queryTools: MCPTool[] = [
  {
    name: 'search_queries',
    description: 'Search for available queries in Budibase',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Filter queries by application ID (optional)' },
      },
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(SearchQueriesSchema, args);
      logger.info('Searching queries', { appId: validated.appId });
      
      const queries = await client.searchQueries(validated.appId);
      
      return {
        success: true,
        data: {
          queries: queries.map(query => ({
            id: query._id,
            name: query.name,
            datasourceId: query.datasourceId,
            queryVerb: query.queryVerb,
            parameters: query.parameters,
            readable: query.readable,
          })),
        },
        message: `Found ${queries.length} queries`,
      };
    },
  },

  {
    name: 'execute_query',
    description: 'Execute a query with optional parameters',
    inputSchema: {
      type: 'object',
      properties: {
        queryId: { type: 'string', description: 'Query ID to execute' },
        parameters: { 
          type: 'object', 
          description: 'Query parameters (optional)',
          additionalProperties: true
        },
      },
      required: ['queryId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(ExecuteQuerySchema, args);
      logger.info('Executing query', { queryId: validated.queryId });
      
      const result = await client.executeQuery(validated.queryId, validated.parameters);
      
      return {
        success: true,
        data: { result },
        message: `Successfully executed query ${validated.queryId}`,
      };
    },
  },
];