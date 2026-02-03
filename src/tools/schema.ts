import { z } from 'zod';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { EnhancedBudibaseClient } from '../storage/enhanced-client';
import { validateSchema, AppIdSchema, TableIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const SyncApplicationSchema = z.object({
  appId: AppIdSchema,
  forceSync: z.boolean().default(false),
  syncInterval: z.number().optional(),
});

const ValidateQuerySchema = z.object({
  tableId: TableIdSchema,
  query: z.object({
    string: z.record(z.string()).optional(),
    fuzzy: z.record(z.string()).optional(),
    range: z.record(z.object({
      low: z.number().optional(),
      high: z.number().optional(),
    })).optional(),
    equal: z.record(z.any()).optional(),
    notEqual: z.record(z.any()).optional(),
    empty: z.record(z.boolean()).optional(),
    notEmpty: z.record(z.boolean()).optional(),
  }).optional(),
});

const SuggestQuerySchema = z.object({
  tableId: TableIdSchema,
  description: z.string().min(1),
});

const GetSchemaHistorySchema = z.object({
  tableId: TableIdSchema,
});

function isEnhancedClient(client: BudibaseClient): client is EnhancedBudibaseClient {
  return client instanceof EnhancedBudibaseClient;
}

export const schemaTools: MCPTool[] = [
  {
    name: 'sync_application_schema',
    description: 'Sync application and table schemas to local registry for offline access and validation',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID to sync' },
        forceSync: { 
          type: 'boolean', 
          description: 'Force sync even if data is fresh',
          default: false 
        },
        syncInterval: {
          type: 'number',
          description: 'Auto-sync interval in milliseconds (optional)'
        }
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      if (!isEnhancedClient(client)) {
        return {
          success: false,
          data: null,
          message: 'This tool requires Enhanced Budibase Client. Please update your server configuration.'
        };
      }

      const validated = validateSchema(SyncApplicationSchema, args);
      
      logger.info('Syncing application schema', { appId: validated.appId });
      
      await client.syncApplication(validated.appId, {
        forceSync: validated.forceSync,
        syncInterval: validated.syncInterval
      });

      const tables = await client.getApplicationTablesFromCache(validated.appId);
      
      return {
        success: true,
        data: {
          appId: validated.appId,
          tablesCount: tables.length,
          tables: tables.map(t => ({
            id: t._id,
            name: t.name,
            fieldCount: Object.keys(t.schema).length
          }))
        },
        message: `Successfully synced ${tables.length} tables`
      };
    }
  },

  {
    name: 'validate_query',
    description: 'Validate a query against table schema before execution',
    inputSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Table ID' },
        query: { 
          type: 'object',
          description: 'Query object to validate'
        }
      },
      required: ['tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      if (!isEnhancedClient(client)) {
        return {
          success: false,
          data: null,
          message: 'This tool requires Enhanced Budibase Client. Please update your server configuration.'
        };
      }

      const validated = validateSchema(ValidateQuerySchema, args);
      
      try {
        // Build and validate query using the enhanced client method
        await client.queryRecordsWithValidation(
          '', // Will be resolved by table ID
          validated.tableId,
          { query: validated.query }
        );
        
        return {
          success: true,
          data: {
            valid: true,
            query: validated.query
          },
          message: 'Query is valid'
        };
      } catch (error) {
        return {
          success: false,
          data: {
            valid: false,
            error: error instanceof Error ? error.message : String(error)
          },
          message: 'Query validation failed'
        };
      }
    }
  },

  {
    name: 'suggest_query',
    description: 'Get AI-powered query suggestions based on natural language description',
    inputSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Table ID' },
        description: { 
          type: 'string',
          description: 'Natural language description of what you want to query'
        }
      },
      required: ['tableId', 'description'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      if (!isEnhancedClient(client)) {
        return {
          success: false,
          data: null,
          message: 'This tool requires Enhanced Budibase Client. Please update your server configuration.'
        };
      }

      const validated = validateSchema(SuggestQuerySchema, args);
      
      const suggestion = await client.suggestQuery(
        validated.tableId,
        validated.description
      );
      
      return {
        success: true,
        data: {
          suggestion,
          example: `Use this suggestion with query_records tool`
        },
        message: 'Query suggestion generated'
      };
    }
  },

  {
    name: 'get_schema_history',
    description: 'Get version history of table schema changes',
    inputSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Table ID' }
      },
      required: ['tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      if (!isEnhancedClient(client)) {
        return {
          success: false,
          data: null,
          message: 'This tool requires Enhanced Budibase Client. Please update your server configuration.'
        };
      }

      const validated = validateSchema(GetSchemaHistorySchema, args);
      
      const history = await client.getSchemaHistory(validated.tableId);
      
      return {
        success: true,
        data: {
          tableId: validated.tableId,
          versions: history.length,
          history: history.map(v => ({
            version: v.version,
            createdAt: v.createdAt,
            checksum: v.checksum,
            fieldCount: Object.keys(v.schema).length
          }))
        },
        message: `Found ${history.length} schema versions`
      };
    }
  },

  {
    name: 'get_cached_schema',
    description: 'Get table schema from local cache (no API call)',
    inputSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'Table ID' }
      },
      required: ['tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      if (!isEnhancedClient(client)) {
        return {
          success: false,
          data: null,
          message: 'This tool requires Enhanced Budibase Client. Please update your server configuration.'
        };
      }

      const validated = validateSchema(z.object({ tableId: TableIdSchema }), args);
      
      const schema = await client.getTableSchemaFromCache(validated.tableId);
      
      if (!schema) {
        return {
          success: false,
          data: null,
          message: 'Schema not found in cache. Run sync_application_schema first.'
        };
      }
      
      return {
        success: true,
        data: {
          table: {
            id: schema._id,
            name: schema.name,
            type: schema.type,
            primaryDisplay: schema.primaryDisplay,
            fields: Object.entries(schema.schema).map(([name, field]) => ({
              name,
              type: field.type,
              constraints: field.constraints,
              relationshipType: field.relationshipType
            }))
          }
        },
        message: 'Schema retrieved from cache'
      };
    }
  }
];
