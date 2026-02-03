import { z } from 'zod';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { validateSchema, AppIdSchema, TableIdSchema, RecordIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const QueryRecordsSchema = z.object({
  appId: AppIdSchema,
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
  sort: z.record(z.enum(['ascending', 'descending'])).optional(),
  limit: z.number().min(1).max(1000).default(50),
  bookmark: z.string().optional(),
});

const CreateRecordSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  data: z.record(z.any()),
});

const UpdateRecordSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  recordId: RecordIdSchema,
  data: z.record(z.any()),
});

const DeleteRecordSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  recordId: RecordIdSchema,
});

const GetTableSchemaSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema.optional(),
});

const GetRecordSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  rowId: RecordIdSchema,
});

const CreateTableSchema = z.object({
  appId: AppIdSchema,
  name: z.string().min(1, 'Table name is required'),
  schema: z.record(z.any()),
  primaryDisplay: z.string().optional(),
});

const UpdateTableSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  name: z.string().optional(),
  schema: z.record(z.any()).optional(),
  primaryDisplay: z.string().optional(),
});

const DeleteTableSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
});
export const databaseTools: MCPTool[] = [
  {
    name: 'check_connection',
    description: 'Check connection status to Budibase API',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    async execute(_args: unknown, client: BudibaseClient) {
      const isConnected = client.isConnected();
      const error = client.getConnectionError();

      if (isConnected) {
        // Try a quick API call to verify connection is still working
        try {
          await client.getApplications();
          return {
            success: true,
            data: { connected: true },
            message: 'Connected to Budibase successfully',
          };
        } catch (err) {
          return {
            success: false,
            data: { connected: false },
            message: err instanceof Error ? err.message : 'Connection test failed',
          };
        }
      }

      return {
        success: false,
        data: { connected: false, error },
        message: error || 'Not connected to Budibase',
      };
    },
  },

  {
    name: 'list_tables',
    description: 'List all tables in a Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(z.object({ appId: AppIdSchema }), args);
      logger.info('Listing tables', { appId: validated.appId });

      const tables = await client.getTables(validated.appId);
      
      return {
        success: true,
        data: {
          tables: tables.map(table => ({
            id: table._id,
            name: table.name,
            type: table.type,
            fieldCount: Object.keys(table.schema || {}).length,
            fields: Object.keys(table.schema || {}),
          })),
        },
        message: `Retrieved ${tables.length} tables`,
      };
    },
  },
  {
    name: 'get_row',
    description: 'Get a single row/record from a Budibase table',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID containing the record' },
        rowId: { type: 'string', description: 'Row/Record ID to retrieve' },
      },
      required: ['appId', 'tableId', 'rowId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(GetRecordSchema, args);
      logger.info('Getting record', { 
        appId: validated.appId, 
        tableId: validated.tableId,
        recordId: validated.rowId 
      });

      const record = await client.getRecord(validated.appId, validated.tableId, validated.rowId);
      
      return {
        success: true,
        data: { record },
        message: `Retrieved record ${validated.rowId}`,
      };
    },
  },
  {
    name: 'query_records',
    description: 'Query records from a Budibase table with advanced filtering, sorting, and pagination',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID to query' },
        query: {
          type: 'object',
          description: 'Query filters',
          properties: {
            string: { type: 'object', description: 'String search filters' },
            fuzzy: { type: 'object', description: 'Fuzzy search filters' },
            range: { type: 'object', description: 'Numeric range filters' },
            equal: { type: 'object', description: 'Equality filters' },
            notEqual: { type: 'object', description: 'Inequality filters' },
            empty: { type: 'object', description: 'Empty value filters' },
            notEmpty: { type: 'object', description: 'Non-empty value filters' },
          },
        },
        sort: { type: 'object', description: 'Sort configuration' },
        limit: { type: 'number', description: 'Maximum records to return (1-1000)', default: 50 },
        bookmark: { type: 'string', description: 'Pagination bookmark' },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(QueryRecordsSchema, args);
      logger.info('Querying records', { appId: validated.appId, tableId: validated.tableId });

      // Resolve table ID in case it's a name
      const tables = await client.getTables(validated.appId);
      const resolvedTableId = tables.find(t => 
        t._id === validated.tableId || 
        t.name.toLowerCase() === validated.tableId.toLowerCase()
      )?._id || validated.tableId;

      const result = await client.queryRecords(validated.appId, {
        tableId: resolvedTableId,
        query: validated.query,
        sort: validated.sort,
        limit: validated.limit,
        bookmark: validated.bookmark,
      });

      return {
        success: true,
        data: {
          rows: result.data || [],
          hasNextPage: result.hasNextPage,
          bookmark: result.bookmark,
        },
        message: `Retrieved ${result.data.length} records from ${validated.tableId}`,
      };
    },
  },
  {
    name: 'create_record',
    description: 'Create a new record in a Budibase table',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID to create record in' },
        data: { type: 'object', description: 'Record data to create' },
      },
      required: ['appId', 'tableId', 'data'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(CreateRecordSchema, args);
      logger.info('Creating record', { appId: validated.appId, tableId: validated.tableId });

      const record = await client.createRecord(validated.appId, validated.tableId, validated.data);

      return {
        success: true,
        data: record,
        message: `Successfully created record with ID: ${record._id}`,
      };
    },
  },

  {
    name: 'update_record',
    description: 'Update an existing record in a Budibase table',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID containing the record' },
        recordId: { type: 'string', description: 'Record ID to update' },
        data: { type: 'object', description: 'Record data to update' },
      },
      required: ['appId', 'tableId', 'recordId', 'data'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(UpdateRecordSchema, args);
      logger.info('Updating record', { 
        appId: validated.appId, 
        tableId: validated.tableId, 
        recordId: validated.recordId 
      });

      const record = await client.updateRecord(
        validated.appId, 
        validated.tableId, 
        validated.recordId, 
        validated.data
      );

      return {
        success: true,
        data: record,
        message: `Successfully updated record ${validated.recordId}`,
      };
    },
  },
  {
    name: 'delete_record',
    description: 'Delete a record from a Budibase table',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID containing the record' },
        recordId: { type: 'string', description: 'Record ID to delete' },
      },
      required: ['appId', 'tableId', 'recordId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(DeleteRecordSchema, args);
      logger.info('Deleting record', { 
        appId: validated.appId, 
        tableId: validated.tableId, 
        recordId: validated.recordId 
      });

      await client.deleteRecord(validated.appId, validated.tableId, validated.recordId);

      return {
        success: true,
        message: `Successfully deleted record ${validated.recordId}`,
      };
    },
  },

  {
    name: 'get_table_schema',
    description: 'Get table schema information including fields, types, and relationships',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Specific table ID (optional - returns all tables if omitted)' },
      },
      required: ['appId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(GetTableSchemaSchema, args);
      logger.info('Getting table schema', { appId: validated.appId, tableId: validated.tableId });

      if (validated.tableId) {
        // First, try to resolve the table ID in case it's a name
        const tables = await client.getTables(validated.appId);
        const resolvedTableId = tables.find(t => 
          t._id === validated.tableId || 
          t.name.toLowerCase() === validated.tableId!.toLowerCase()
        )?._id || validated.tableId;
        
        const table = await client.getTable(validated.appId, resolvedTableId);
        return {
          success: true,
          data: {
            table: {
              id: table._id,
              name: table.name,
              type: table.type,
              schema: table.schema,
            },
          },
          message: `Retrieved schema for table ${table.name}`,
        };
      } else {
        const tables = await client.getTables(validated.appId);
        return {
          success: true,
          data: {
            tables: tables.map(table => ({
              id: table._id,
              name: table.name,
              type: table.type,
              fieldCount: Object.keys(table.schema).length,
              fields: Object.keys(table.schema),
            })),
          },
          message: `Retrieved ${tables.length} tables`,
        };
      }
    },
  },

  {
    name: 'create_table',
    description: 'Create a new table in a Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        name: { type: 'string', description: 'Table name' },
        schema: { 
          type: 'object', 
          description: 'Table schema defining columns and their types',
          additionalProperties: true
        },
        primaryDisplay: { type: 'string', description: 'Primary display column (optional)' },
      },
      required: ['appId', 'name', 'schema'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(CreateTableSchema, args);
      logger.info('Creating table', { appId: validated.appId, name: validated.name });

      const table = await client.createTable(validated.appId, {
        name: validated.name,
        schema: validated.schema,
        primaryDisplay: validated.primaryDisplay,
      });

      return {
        success: true,
        data: { table },
        message: `Successfully created table: ${table.name} (ID: ${table._id})`,
      };
    },
  },

  {
    name: 'update_table',
    description: 'Update an existing table in a Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID to update' },
        name: { type: 'string', description: 'New table name (optional)' },
        schema: { 
          type: 'object', 
          description: 'Updated table schema (optional)',
          additionalProperties: true
        },
        primaryDisplay: { type: 'string', description: 'New primary display column (optional)' },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(UpdateTableSchema, args);
      logger.info('Updating table', { appId: validated.appId, tableId: validated.tableId });

      const { appId, tableId, ...updateData } = validated;
      
      // Resolve table ID in case it's a name
      const tables = await client.getTables(appId);
      const resolvedTableId = tables.find(t => 
        t._id === tableId || 
        t.name.toLowerCase() === tableId.toLowerCase()
      )?._id || tableId;

      const table = await client.updateTable(appId, resolvedTableId, updateData);

      return {
        success: true,
        data: { table },
        message: `Successfully updated table: ${table.name}`,
      };
    },
  },

  {
    name: 'delete_table',
    description: 'Delete a table from a Budibase application',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID to delete' },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(DeleteTableSchema, args);
      logger.info('Deleting table', { appId: validated.appId, tableId: validated.tableId });

      // Resolve table ID in case it's a name
      const tables = await client.getTables(validated.appId);
      const resolvedTableId = tables.find(t => 
        t._id === validated.tableId || 
        t.name.toLowerCase() === validated.tableId.toLowerCase()
      )?._id || validated.tableId;

      await client.deleteTable(validated.appId, resolvedTableId);

      return {
        success: true,
        message: `Successfully deleted table ${validated.tableId}`,
      };
    },
  },
];