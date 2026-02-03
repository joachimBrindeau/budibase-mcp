import { z } from 'zod';
import type { BudibaseClient } from '../clients/budibase';
import type { MCPTool } from '../types/mcp';
import { logger } from '../utils/logger';
import { AppIdSchema, validateSchema } from '../utils/validation';

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
    description:
      'List saved queries (SQL, REST, etc.) defined in Budibase. Returns query IDs, names, verbs, and parameters. Use execute_query to run them. Related: query_records (direct table queries).',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Filter by application name or ID (optional)' },
      },
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(SearchQueriesSchema, args);
      logger.info('Searching queries', { appId: validated.appId });

      const queries = await client.searchQueries(validated.appId);

      return {
        success: true,
        data: {
          queries: queries.map((query) => ({
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
    description:
      'Execute a saved query by ID. Use search_queries to find query IDs and required parameters. Parameters are key-value pairs matching the query definition.',
    inputSchema: {
      type: 'object',
      properties: {
        queryId: { type: 'string', description: 'Query ID from search_queries' },
        parameters: {
          type: 'object',
          description: 'Query parameters: {paramName: value, ...}',
          additionalProperties: true,
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
