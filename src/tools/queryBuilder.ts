import { z } from 'zod';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { validateSchema, AppIdSchema, TableIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { BudibaseQueryBuilder } from '../utils/queryBuilder';
import { MCPError, ErrorCodes } from '../utils/errors';

const QueryBuilderSchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'fuzzy', 'range', 'empty', 'notEmpty', 'in', 'notIn']),
    value: z.any().optional(),
    values: z.array(z.any()).optional(),
    rangeOptions: z.object({
      low: z.number().optional(),
      high: z.number().optional()
    }).optional()
  })).optional(),
  sort: z.array(z.object({
    field: z.string(),
    direction: z.enum(['ascending', 'descending'])
  })).optional(),
  limit: z.number().min(1).max(1000).optional(),
  bookmark: z.string().optional(),
});

const SimpleQuerySchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  queryString: z.string().describe('Simple query string format: field:value,field2>10,field3~search'),
  limit: z.number().min(1).max(1000).default(50),
  bookmark: z.string().optional(),
});

const FluentQuerySchema = z.object({
  appId: AppIdSchema,
  tableId: TableIdSchema,
  operations: z.array(z.object({
    method: z.string(),
    args: z.array(z.any())
  })).describe('Array of query builder operations: [{method: "equals", args: ["field", "value"]}, {method: "sortBy", args: ["field", "asc"]}]'),
});

export const queryBuilderTools: MCPTool[] = [
  {
    name: 'advanced_query',
    description: 'Build complex queries with multiple conditions, sorting, and filtering options',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        conditions: {
          type: 'array',
          description: 'Array of query conditions',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Field name to query' },
              operator: { 
                type: 'string', 
                enum: ['equals', 'notEquals', 'contains', 'startsWith', 'endsWith', 'fuzzy', 'range', 'empty', 'notEmpty', 'in', 'notIn'],
                description: 'Comparison operator' 
              },
              value: { description: 'Value to compare against (for single value operators)' },
              values: { 
                type: 'array', 
                description: 'Array of values (for in/notIn operators)' 
              },
              rangeOptions: {
                type: 'object',
                properties: {
                  low: { type: 'number', description: 'Lower bound for range' },
                  high: { type: 'number', description: 'Upper bound for range' }
                }
              }
            },
            required: ['field', 'operator']
          }
        },
        sort: {
          type: 'array',
          description: 'Sort conditions',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Field to sort by' },
              direction: { type: 'string', enum: ['ascending', 'descending'] }
            },
            required: ['field', 'direction']
          }
        },
        limit: { type: 'number', minimum: 1, maximum: 1000, description: 'Maximum results to return' },
        bookmark: { type: 'string', description: 'Pagination bookmark' }
      },
      required: ['appId', 'tableId']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(QueryBuilderSchema, args);
      logger.info('Building advanced query', { 
        appId: validated.appId, 
        tableId: validated.tableId,
        conditionCount: validated.conditions?.length || 0
      });

      const builder = BudibaseQueryBuilder.create();

      // Apply conditions
      if (validated.conditions) {
        for (const condition of validated.conditions) {
          switch (condition.operator) {
            case 'equals':
              builder.equals(condition.field, condition.value);
              break;
            case 'notEquals':
              builder.notEquals(condition.field, condition.value);
              break;
            case 'contains':
              builder.contains(condition.field, condition.value);
              break;
            case 'startsWith':
              builder.startsWith(condition.field, condition.value);
              break;
            case 'endsWith':
              builder.endsWith(condition.field, condition.value);
              break;
            case 'fuzzy':
              builder.fuzzy(condition.field, condition.value);
              break;
            case 'range':
              const range = condition.rangeOptions || {};
              builder.range(condition.field, range.low, range.high);
              break;
            case 'empty':
              builder.empty(condition.field);
              break;
            case 'notEmpty':
              builder.notEmpty(condition.field);
              break;
            case 'in':
              if (condition.values) {
                builder.in(condition.field, condition.values);
              }
              break;
            case 'notIn':
              if (condition.values) {
                builder.notIn(condition.field, condition.values);
              }
              break;
          }
        }
      }

      // Apply sorting
      if (validated.sort) {
        for (const sortCondition of validated.sort) {
          builder.sortBy(sortCondition.field, sortCondition.direction);
        }
      }

      // Apply limit and bookmark
      if (validated.limit) {
        builder.limit(validated.limit);
      }
      if (validated.bookmark) {
        builder.bookmark(validated.bookmark);
      }

      // Build and execute query
      const queryRequest = {
        tableId: validated.tableId,
        ...builder.build()
      };

      const result = await client.queryRecords(validated.appId, queryRequest);

      return {
        success: true,
        data: {
          rows: result.data || [],
          hasNextPage: result.hasNextPage,
          bookmark: result.bookmark,
          queryUsed: queryRequest,
          totalConditions: validated.conditions?.length || 0
        },
        message: `Advanced query returned ${result.data?.length || 0} records`,
      };
    },
  },

  {
    name: 'simple_query',
    description: 'Execute queries using simple string format (field:value,field2>10,field3~search)',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        queryString: { 
          type: 'string', 
          description: 'Query string format: field:value,field2>10,field3~search,field4*contains' 
        },
        limit: { type: 'number', minimum: 1, maximum: 1000, default: 50 },
        bookmark: { type: 'string', description: 'Pagination bookmark' }
      },
      required: ['appId', 'tableId', 'queryString']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(SimpleQuerySchema, args);
      logger.info('Executing simple query', { 
        appId: validated.appId, 
        tableId: validated.tableId,
        queryString: validated.queryString
      });

      // Parse query string using builder
      const builder = BudibaseQueryBuilder.fromString(validated.queryString);
      
      if (validated.limit) {
        builder.limit(validated.limit);
      }
      if (validated.bookmark) {
        builder.bookmark(validated.bookmark);
      }

      // Build and execute query
      const queryRequest = {
        tableId: validated.tableId,
        ...builder.build()
      };

      const result = await client.queryRecords(validated.appId, queryRequest);

      return {
        success: true,
        data: {
          rows: result.data || [],
          hasNextPage: result.hasNextPage,
          bookmark: result.bookmark,
          queryStringUsed: validated.queryString,
          parsedQuery: queryRequest
        },
        message: `Simple query "${validated.queryString}" returned ${result.data?.length || 0} records`,
      };
    },
  },

  {
    name: 'fluent_query',
    description: 'Build queries using fluent interface operations array',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        operations: {
          type: 'array',
          description: 'Array of fluent operations: [{method: "equals", args: ["name", "John"]}, {method: "sortBy", args: ["createdAt", "descending"]}]',
          items: {
            type: 'object',
            properties: {
              method: { type: 'string', description: 'Builder method name' },
              args: { type: 'array', description: 'Method arguments' }
            },
            required: ['method', 'args']
          }
        }
      },
      required: ['appId', 'tableId', 'operations']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(FluentQuerySchema, args);
      logger.info('Building fluent query', { 
        appId: validated.appId, 
        tableId: validated.tableId,
        operationCount: validated.operations.length
      });

      const builder = BudibaseQueryBuilder.create();

      // Apply operations sequentially
      for (const operation of validated.operations) {
        const method = operation.method;
        const args = operation.args;

        // Safely call builder method if it exists
        if (typeof (builder as any)[method] === 'function') {
          try {
            (builder as any)[method](...args);
          } catch (error) {
            logger.warn(`Failed to apply operation ${method}`, { args, error });
            throw new MCPError(ErrorCodes.INVALID_PARAMS, `Invalid operation: ${method} with args: ${JSON.stringify(args)}`);
          }
        } else {
          throw new MCPError(ErrorCodes.INVALID_PARAMS, `Unknown query builder method: ${method}`);
        }
      }

      // Build and execute query
      const queryRequest = {
        tableId: validated.tableId,
        ...builder.build()
      };

      const result = await client.queryRecords(validated.appId, queryRequest);

      return {
        success: true,
        data: {
          rows: result.data || [],
          hasNextPage: result.hasNextPage,
          bookmark: result.bookmark,
          operationsUsed: validated.operations,
          generatedQuery: queryRequest
        },
        message: `Fluent query with ${validated.operations.length} operations returned ${result.data?.length || 0} records`,
      };
    },
  },
];