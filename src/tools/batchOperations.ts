import { z } from 'zod';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { validateSchema, AppIdSchema, TableIdSchema, RecordIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { BatchOperationManager } from '../utils/batchOperations';
import { MCPError, ErrorCodes } from '../utils/errors';

const BatchCreateSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  records: z.array(z.record(z.any())).min(1, 'At least one record is required'),
  batchSize: z.number().min(1).max(50).default(10),
  continueOnError: z.boolean().default(true),
});

const BatchUpdateSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  records: z.array(z.object({
    id: RecordIdSchema,
    data: z.record(z.any())
  })).min(1, 'At least one record is required'),
  batchSize: z.number().min(1).max(50).default(10),
  continueOnError: z.boolean().default(true),
});

const BatchDeleteSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  recordIds: z.array(RecordIdSchema).min(1, 'At least one record ID is required'),
  batchSize: z.number().min(1).max(50).default(10),
  continueOnError: z.boolean().default(true),
});

const BatchUpsertSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  records: z.array(z.record(z.any())).min(1, 'At least one record is required'),
  batchSize: z.number().min(1).max(50).default(10),
  continueOnError: z.boolean().default(true),
});

export const batchOperationTools: MCPTool[] = [
  {
    name: 'batch_create_records',
    description: 'Create multiple records in batches with error handling and progress tracking',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        records: {
          type: 'array',
          description: 'Array of record objects to create',
          items: { type: 'object', additionalProperties: true }
        },
        batchSize: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        continueOnError: { type: 'boolean', default: true }
      },
      required: ['appId', 'tableId', 'records']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const { appId, tableId, records, batchSize, continueOnError } = validateSchema(BatchCreateSchema, args);
      logger.info('Starting batch create', { appId, tableId, count: records.length });

      const batchManager = new BatchOperationManager(client);
      const result = await batchManager.batchCreate(appId, tableId, records, { batchSize, continueOnError });

      return {
        success: result.success,
        data: { ...result, createdRecords: result.results },
        message: result.summary,
      };
    },
  },

  {
    name: 'batch_update_records',
    description: 'Update multiple records in batches with error handling and progress tracking',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        records: {
          type: 'array',
          description: 'Array of records with ID and data to update',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Record ID to update' },
              data: { type: 'object', description: 'Updated record data' }
            },
            required: ['id', 'data']
          }
        },
        batchSize: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        continueOnError: { type: 'boolean', default: true }
      },
      required: ['appId', 'tableId', 'records']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const { appId, tableId, records, batchSize, continueOnError } = validateSchema(BatchUpdateSchema, args);
      logger.info('Starting batch update', { appId, tableId, count: records.length });

      const batchManager = new BatchOperationManager(client);
      const result = await batchManager.batchUpdate(appId, tableId, records, { batchSize, continueOnError });

      return {
        success: result.success,
        data: { ...result, updatedRecords: result.results },
        message: result.summary,
      };
    },
  },

  {
    name: 'batch_delete_records',
    description: 'Delete multiple records in batches with error handling and progress tracking',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        recordIds: {
          type: 'array',
          description: 'Array of record IDs to delete',
          items: { type: 'string' }
        },
        batchSize: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        continueOnError: { type: 'boolean', default: true }
      },
      required: ['appId', 'tableId', 'recordIds']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const { appId, tableId, recordIds, batchSize, continueOnError } = validateSchema(BatchDeleteSchema, args);
      logger.info('Starting batch delete', { appId, tableId, count: recordIds.length });

      const batchManager = new BatchOperationManager(client);
      const result = await batchManager.batchDelete(appId, tableId, recordIds, { batchSize, continueOnError });

      return {
        success: result.success,
        data: { ...result, deletedRecordIds: result.results },
        message: result.summary,
      };
    },
  },

  {
    name: 'batch_upsert_records',
    description: 'Create or update multiple records (upsert) in batches based on record ID presence',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        records: {
          type: 'array',
          description: 'Array of record objects (with or without _id for upsert logic)',
          items: { type: 'object', additionalProperties: true }
        },
        batchSize: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        continueOnError: { type: 'boolean', default: true }
      },
      required: ['appId', 'tableId', 'records']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const { appId, tableId, records, batchSize, continueOnError } = validateSchema(BatchUpsertSchema, args);
      logger.info('Starting batch upsert', { appId, tableId, count: records.length });

      const batchManager = new BatchOperationManager(client);
      const result = await batchManager.batchUpsert(appId, tableId, records, { batchSize, continueOnError });

      return {
        success: result.success,
        data: { ...result, upsertedRecords: result.results },
        message: result.summary,
      };
    },
  },

  {
    name: 'bulk_query_and_process',
    description: 'Query records and perform bulk operations on the results',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        query: { type: 'object', description: 'Query to find records' },
        operation: { type: 'string', enum: ['update', 'delete'] },
        updateData: { type: 'object', description: 'Data to update (for update operation)' },
        batchSize: { type: 'number', minimum: 1, maximum: 50, default: 10 },
        continueOnError: { type: 'boolean', default: true }
      },
      required: ['appId', 'tableId', 'operation']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(z.object({
        appId: AppIdSchema,
        tableId: TableIdSchema,
        query: z.any().optional(),
        operation: z.enum(['update', 'delete']),
        updateData: z.record(z.any()).optional(),
        batchSize: z.number().min(1).max(50).default(10),
        continueOnError: z.boolean().default(true),
      }), args);

      const queryResult = await client.queryRecords(validated.appId, {
        tableId: validated.tableId,
        query: validated.query,
        limit: 1000
      });

      const records = queryResult.data || [];
      if (records.length === 0) {
        return {
          success: true,
          data: { totalFound: 0, totalProcessed: 0, results: [], errors: [] },
          message: 'No records found matching the query',
        };
      }

      const batchManager = new BatchOperationManager(client);
      const opts = { batchSize: validated.batchSize, continueOnError: validated.continueOnError };

      const result = validated.operation === 'update'
        ? (() => {
            if (!validated.updateData) {
              throw new MCPError(ErrorCodes.INVALID_PARAMS, 'updateData is required for update operation');
            }
            return batchManager.batchUpdate(
              validated.appId,
              validated.tableId,
              records.map(r => ({ id: r._id, data: validated.updateData! })),
              opts
            );
          })()
        : batchManager.batchDelete(validated.appId, validated.tableId, records.map(r => r._id), opts);

      const finalResult = await result;

      return {
        success: finalResult.success,
        data: { totalFound: records.length, ...finalResult },
        message: `Bulk ${validated.operation}: ${finalResult.summary}`,
      };
    },
  },
];
