import { z } from 'zod';
import type { BudibaseClient } from '../clients/budibase';
import type { MCPTool } from '../types/mcp';
import { logger } from '../utils/logger';
import { AppIdSchema, QueryFilterSchema, RecordIdSchema, TableIdSchema, validateSchema } from '../utils/validation';

const MAX_FETCH_ALL_ROWS = 5000;
const FETCH_ALL_PAGE_SIZE = 1000;

const QueryRecordsSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  query: QueryFilterSchema.optional(),
  sort: z.record(z.enum(['ascending', 'descending'])).optional(),
  limit: z.number().min(1).max(1000).default(50),
  bookmark: z.string().optional(),
  fields: z.array(z.string().min(1)).optional(),
  fetchAll: z.boolean().default(false),
});

function pickFields(rows: Record<string, unknown>[], fields: string[]): Record<string, unknown>[] {
  const keep = new Set(['_id', ...fields]);
  return rows.map((row) => {
    const picked: Record<string, unknown> = {};
    for (const key of keep) {
      if (key in row) picked[key] = row[key];
    }
    return picked;
  });
}

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
  tableId: TableIdSchema,
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
    description:
      'Check connection status to Budibase API. Call this first to verify credentials before other operations. Related: list_applications, discover_apps.',
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
    description:
      'List all tables in a Budibase application. Returns table IDs, names, and field names. Use get_table_schema for full field details. Accepts app name or ID.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID (e.g. "My App" or "app_xxx")' },
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
          tables: tables.map((table) => ({
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
    description:
      'Get a single row by ID. Returns full record with linked fields normalized. Use query_records to find records by field values.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
        rowId: { type: 'string', description: 'Row ID (e.g. "ro_xxx")' },
      },
      required: ['appId', 'tableId', 'rowId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(GetRecordSchema, args);
      logger.info('Getting record', {
        appId: validated.appId,
        tableId: validated.tableId,
        recordId: validated.rowId,
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
    description:
      'Query records with filtering, sorting, and pagination. Supports field selection (return only specified columns) and auto-pagination (fetchAll to get all matching rows in one call). Filters: equal, string, fuzzy, range, notEqual, empty, notEmpty. Always specify fields to reduce response size.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
        query: {
          type: 'object',
          description:
            'Filters: {equal: {field: value}, string: {field: "search"}, fuzzy: {field: "approx"}, range: {field: {low: 0, high: 100}}, notEqual: {field: value}, empty: {field: true}, notEmpty: {field: true}}',
          properties: {
            string: { type: 'object', description: 'Contains match: {fieldName: "search term"}' },
            fuzzy: { type: 'object', description: 'Approximate match: {fieldName: "approx"}' },
            range: { type: 'object', description: 'Numeric range: {fieldName: {low: 0, high: 100}}' },
            equal: { type: 'object', description: 'Exact match: {fieldName: "value"}' },
            notEqual: { type: 'object', description: 'Exclude match: {fieldName: "value"}' },
            empty: { type: 'object', description: 'Field is empty: {fieldName: true}' },
            notEmpty: { type: 'object', description: 'Field has value: {fieldName: true}' },
          },
        },
        sort: { type: 'object', description: 'Sort: {fieldName: "ascending" | "descending"}' },
        limit: {
          type: 'number',
          description: 'Max records per page (1-1000, default 50). Ignored when fetchAll is true.',
        },
        bookmark: {
          type: 'string',
          description: 'Pagination bookmark from previous response. Ignored when fetchAll is true.',
        },
        fields: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Columns to return (e.g. ["nom", "statut"]). _id is always included. Omit to return all columns.',
        },
        fetchAll: {
          type: 'boolean',
          description: `Auto-paginate to fetch all matching rows (max ${MAX_FETCH_ALL_ROWS}). Returns truncated: true if cap exceeded.`,
        },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(QueryRecordsSchema, args);
      logger.info('Querying records', {
        appId: validated.appId,
        tableId: validated.tableId,
        fetchAll: validated.fetchAll,
        fields: validated.fields,
      });

      if (validated.fetchAll) {
        const allRows: Record<string, unknown>[] = [];
        let currentBookmark: string | undefined;
        let truncated = false;
        let hasMore = true;

        while (hasMore) {
          const page = await client.queryRecords(validated.appId, {
            tableId: validated.tableId,
            query: validated.query,
            sort: validated.sort,
            limit: FETCH_ALL_PAGE_SIZE,
            bookmark: currentBookmark,
          });

          allRows.push(...page.data);
          currentBookmark = page.bookmark;

          if (allRows.length >= MAX_FETCH_ALL_ROWS) {
            allRows.length = MAX_FETCH_ALL_ROWS;
            truncated = true;
            hasMore = false;
          } else {
            hasMore = page.hasNextPage;
          }
        }

        const rows = validated.fields ? pickFields(allRows, validated.fields) : allRows;

        return {
          success: true,
          data: { rows, totalRows: rows.length, truncated },
          message: `Retrieved ${rows.length} records from ${validated.tableId}${truncated ? ` (truncated at ${MAX_FETCH_ALL_ROWS} — narrow your filters)` : ''}`,
        };
      }

      const result = await client.queryRecords(validated.appId, {
        tableId: validated.tableId,
        query: validated.query,
        sort: validated.sort,
        limit: validated.limit,
        bookmark: validated.bookmark,
      });

      const rows = validated.fields ? pickFields(result.data || [], validated.fields) : result.data || [];

      return {
        success: true,
        data: {
          rows,
          hasNextPage: result.hasNextPage,
          bookmark: result.bookmark,
        },
        message: `Retrieved ${rows.length} records from ${validated.tableId}`,
      };
    },
  },
  {
    name: 'create_record',
    description:
      'Create a new record. Use get_table_schema first to see required fields. For bulk inserts, use batch_create_records (up to 50 at once). Example: data: {name: "John", age: 30}.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
        data: { type: 'object', description: 'Record fields: {fieldName: value, ...}' },
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
    description:
      'Update an existing record. Only include fields to change. For bulk updates, use batch_update_records. Related: get_row, query_records.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
        recordId: { type: 'string', description: 'Record ID (e.g. "ro_xxx")' },
        data: { type: 'object', description: 'Fields to update: {fieldName: newValue}' },
      },
      required: ['appId', 'tableId', 'recordId', 'data'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(UpdateRecordSchema, args);
      logger.info('Updating record', {
        appId: validated.appId,
        tableId: validated.tableId,
        recordId: validated.recordId,
      });

      const record = await client.updateRecord(validated.appId, validated.tableId, validated.recordId, validated.data);

      return {
        success: true,
        data: record,
        message: `Successfully updated record ${validated.recordId}`,
      };
    },
  },
  {
    name: 'delete_record',
    description:
      'Delete a record by ID. For bulk deletes, use batch_delete_records. Use query_records first to find record IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
        recordId: { type: 'string', description: 'Record ID (e.g. "ro_xxx")' },
      },
      required: ['appId', 'tableId', 'recordId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(DeleteRecordSchema, args);
      logger.info('Deleting record', {
        appId: validated.appId,
        tableId: validated.tableId,
        recordId: validated.recordId,
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
    description:
      'Get detailed schema for a specific table including field types and relationships. Use list_tables to find table IDs first.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Budibase application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(GetTableSchemaSchema, args);
      logger.info('Getting table schema', { appId: validated.appId, tableId: validated.tableId });

      const table = await client.getTable(validated.appId, validated.tableId);

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
    },
  },

  {
    name: 'create_table',
    description:
      'Create a new table with schema. Field types: string, number, boolean, datetime, link, formula, attachment. Example schema: {name: {type: "string"}, age: {type: "number"}}. Related: list_tables, get_table_schema.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        name: { type: 'string', description: 'Table name' },
        schema: {
          type: 'object',
          // biome-ignore lint/security/noSecrets: schema description, not a secret
          description: 'Fields: {fieldName: {type: "string"|"number"|"boolean"|"datetime"|"link"}}',
          additionalProperties: true,
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
    description:
      'Update table name, schema, or primary display. Accepts table name or ID. Related: create_table, delete_table, get_table_schema.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
        name: { type: 'string', description: 'New table name (optional)' },
        schema: {
          type: 'object',
          description: 'Updated table schema (optional)',
          additionalProperties: true,
        },
        primaryDisplay: { type: 'string', description: 'New primary display column (optional)' },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(UpdateTableSchema, args);
      logger.info('Updating table', { appId: validated.appId, tableId: validated.tableId });

      const { appId, tableId, ...updateData } = validated;
      const table = await client.updateTable(appId, tableId, updateData);

      return {
        success: true,
        data: { table },
        message: `Successfully updated table: ${table.name}`,
      };
    },
  },

  {
    name: 'delete_table',
    description:
      'Delete a table and all its records permanently. Accepts table name or ID. Related: list_tables, update_table.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application name or ID' },
        tableId: { type: 'string', description: 'Table name or ID' },
      },
      required: ['appId', 'tableId'],
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(DeleteTableSchema, args);
      logger.info('Deleting table', { appId: validated.appId, tableId: validated.tableId });

      await client.deleteTable(validated.appId, validated.tableId);

      return {
        success: true,
        message: `Successfully deleted table ${validated.tableId}`,
      };
    },
  },
];
