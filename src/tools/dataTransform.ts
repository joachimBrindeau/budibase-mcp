import { z } from 'zod';
import { evaluate } from 'mathjs';
import { format as formatDate, parseISO } from 'date-fns';
import Papa from 'papaparse';
import { MCPTool } from '../types/mcp';
import { BudibaseClient } from '../clients/budibase';
import { validateSchema, AppIdSchema, TableIdSchema } from '../utils/validation';
import { logger } from '../utils/logger';

const TransformRecordsSchema = z.object({
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
  transformations: z.array(z.object({
    field: z.string(),
    operation: z.enum(['uppercase', 'lowercase', 'trim', 'prefix', 'suffix', 'replace', 'calculate', 'format_date', 'extract', 'concatenate']),
    value: z.any().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    format: z.string().optional(),
    expression: z.string().optional(),
    fields: z.array(z.string()).optional(),
    separator: z.string().optional()
  })),
  outputFormat: z.enum(['records', 'csv', 'json', 'table']).default('records'),
  limit: z.number().min(1).max(1000).default(100)
});

const ConvertFormatSchema = z.object({
  data: z.array(z.record(z.any())),
  fromFormat: z.enum(['records', 'csv', 'json']),
  toFormat: z.enum(['records', 'csv', 'json', 'table', 'markdown']),
  options: z.object({
    csvDelimiter: z.string().default(','),
    includeHeaders: z.boolean().default(true),
    dateFormat: z.string().optional(),
    numberFormat: z.string().optional()
  }).optional()
});

function transformValue(value: any, transformation: any, record: any = {}): any {
  const { operation, value: transformValue, from, to, format, expression } = transformation;

  switch (operation) {
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;

    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;

    case 'trim':
      return typeof value === 'string' ? value.trim() : value;

    case 'prefix':
      return typeof value === 'string' ? `${transformValue}${value}` : value;

    case 'suffix':
      return typeof value === 'string' ? `${value}${transformValue}` : value;

    case 'replace':
      if (typeof value === 'string' && from && to !== undefined) {
        return value.replace(new RegExp(from, 'g'), to);
      }
      return value;

    case 'calculate':
      if (expression) {
        try {
          // Use mathjs for safe expression evaluation
          const scope: Record<string, number> = { value: Number(value) || 0 };
          // Add all numeric fields from record to scope
          for (const [key, val] of Object.entries(record)) {
            if (typeof val === 'number') {
              scope[key] = val;
            }
          }
          return evaluate(expression, scope);
        } catch (err) {
          logger.warn('Expression evaluation failed', { expression, error: err });
          return value;
        }
      }
      return value;

    case 'format_date':
      if (value && format) {
        try {
          const date = typeof value === 'string' ? parseISO(value) : new Date(value);
          // Use date-fns format patterns
          return formatDate(date, format);
        } catch (err) {
          logger.warn('Date formatting failed', { value, format, error: err });
          return value;
        }
      }
      return value;

    case 'extract':
      if (typeof value === 'string' && from) {
        const match = value.match(new RegExp(from));
        return match ? match[0] : value;
      }
      return value;

    default:
      return value;
  }
}

function convertToFormat(data: any[], format: string, options: any = {}): any {
  const { csvDelimiter = ',', includeHeaders = true } = options;

  switch (format) {
    case 'csv':
      // Use papaparse for robust CSV generation
      return Papa.unparse(data, {
        delimiter: csvDelimiter,
        header: includeHeaders,
        skipEmptyLines: true,
      });

    case 'json':
      return JSON.stringify(data, null, 2);

    case 'table':
    case 'markdown':
      if (data.length === 0) return 'No data';

      const headers = Object.keys(data[0]);
      const colWidths = headers.map(header =>
        Math.max(header.length, ...data.map(row => String(row[header] ?? '').length))
      );

      const headerRow = '| ' + headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ') + ' |';
      const separatorRow = '| ' + colWidths.map(w => '-'.repeat(w)).join(' | ') + ' |';
      const dataRows = data.map(record =>
        '| ' + headers.map((h, i) => String(record[h] ?? '').padEnd(colWidths[i])).join(' | ') + ' |'
      );

      return [headerRow, separatorRow, ...dataRows].join('\n');

    default:
      return data;
  }
}

export const dataTransformTools: MCPTool[] = [
  {
    name: 'transform_records',
    description: 'Query records and apply transformations like formatting, calculations, and data cleaning',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        query: {
          type: 'object',
          description: 'Query to filter records',
          properties: {
            string: { type: 'object' },
            fuzzy: { type: 'object' },
            range: { type: 'object' },
            equal: { type: 'object' },
            notEqual: { type: 'object' },
            empty: { type: 'object' },
            notEmpty: { type: 'object' }
          }
        },
        transformations: {
          type: 'array',
          description: 'Array of transformations to apply',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Field name to transform' },
              operation: {
                type: 'string',
                enum: ['uppercase', 'lowercase', 'trim', 'prefix', 'suffix', 'replace', 'calculate', 'format_date', 'extract', 'concatenate'],
                description: 'Transformation operation'
              },
              value: { description: 'Value for prefix/suffix operations' },
              from: { type: 'string', description: 'From value for replace/extract operations' },
              to: { type: 'string', description: 'To value for replace operations' },
              format: { type: 'string', description: 'Format pattern (date-fns format for dates, e.g., "yyyy-MM-dd")' },
              expression: { type: 'string', description: 'Math expression using mathjs (e.g., "value * 2 + 10")' },
              fields: { type: 'array', items: { type: 'string' }, description: 'Fields to concatenate' },
              separator: { type: 'string', description: 'Separator for concatenation' }
            },
            required: ['field', 'operation']
          }
        },
        outputFormat: {
          type: 'string',
          enum: ['records', 'csv', 'json', 'table'],
          default: 'records',
          description: 'Output format for transformed data'
        },
        limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
      },
      required: ['appId', 'tableId', 'transformations']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(TransformRecordsSchema, args);
      logger.info('Starting record transformation', {
        appId: validated.appId,
        tableId: validated.tableId,
        transformationCount: validated.transformations.length
      });

      const queryResult = await client.queryRecords(validated.appId, {
        tableId: validated.tableId,
        query: validated.query,
        limit: validated.limit
      });

      const records = queryResult.data || [];
      logger.info(`Retrieved ${records.length} records for transformation`);

      const transformedRecords = records.map(record => {
        const transformed = { ...record };

        for (const transformation of validated.transformations) {
          const fieldValue = transformed[transformation.field];

          if (transformation.operation === 'concatenate' && transformation.fields) {
            const values = transformation.fields.map(field => transformed[field] || '');
            transformed[transformation.field] = values.join(transformation.separator || ' ');
          } else {
            transformed[transformation.field] = transformValue(fieldValue, transformation, record);
          }
        }

        return transformed;
      });

      const outputFormat = validated.outputFormat || 'records';
      const output = outputFormat === 'records'
        ? transformedRecords
        : convertToFormat(transformedRecords, outputFormat);

      return {
        success: true,
        data: {
          originalCount: records.length,
          transformedCount: transformedRecords.length,
          transformations: validated.transformations,
          outputFormat: validated.outputFormat,
          result: output
        },
        message: `Applied ${validated.transformations.length} transformations to ${records.length} records`,
      };
    },
  },

  {
    name: 'convert_data_format',
    description: 'Convert data between different formats (JSON, CSV, Table, Markdown)',
    inputSchema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          description: 'Array of record objects to convert',
          items: { type: 'object' }
        },
        fromFormat: {
          type: 'string',
          enum: ['records', 'csv', 'json'],
          description: 'Source format of the data'
        },
        toFormat: {
          type: 'string',
          enum: ['records', 'csv', 'json', 'table', 'markdown'],
          description: 'Target format for conversion'
        },
        options: {
          type: 'object',
          properties: {
            csvDelimiter: { type: 'string', default: ',' },
            includeHeaders: { type: 'boolean', default: true },
            dateFormat: { type: 'string' },
            numberFormat: { type: 'string' }
          }
        }
      },
      required: ['data', 'fromFormat', 'toFormat']
    },
    async execute(args: unknown) {
      const validated = validateSchema(ConvertFormatSchema, args);
      logger.info('Converting data format', {
        fromFormat: validated.fromFormat,
        toFormat: validated.toFormat,
        recordCount: validated.data.length
      });

      const converted = convertToFormat(validated.data, validated.toFormat, validated.options);

      return {
        success: true,
        data: {
          originalFormat: validated.fromFormat,
          targetFormat: validated.toFormat,
          recordCount: validated.data.length,
          converted
        },
        message: `Converted ${validated.data.length} records from ${validated.fromFormat} to ${validated.toFormat}`,
      };
    },
  },

  {
    name: 'aggregate_data',
    description: 'Perform aggregations on record data (count, sum, average, min, max, group by)',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Application ID' },
        tableId: { type: 'string', description: 'Table ID or name' },
        query: {
          type: 'object',
          description: 'Query to filter records before aggregation'
        },
        groupBy: {
          type: 'array',
          items: { type: 'string' },
          description: 'Fields to group by'
        },
        aggregations: {
          type: 'array',
          description: 'Aggregation operations to perform',
          items: {
            type: 'object',
            properties: {
              field: { type: 'string', description: 'Field to aggregate' },
              operation: {
                type: 'string',
                enum: ['count', 'sum', 'avg', 'min', 'max', 'distinct_count'],
                description: 'Aggregation operation'
              },
              alias: { type: 'string', description: 'Alias for the result field' }
            },
            required: ['field', 'operation']
          }
        },
        limit: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
      },
      required: ['appId', 'tableId', 'aggregations']
    },
    async execute(args: unknown, client: BudibaseClient) {
      const validated = validateSchema(z.object({
        appId: AppIdSchema,
        tableId: TableIdSchema,
        query: z.any().optional(),
        groupBy: z.array(z.string()).optional(),
        aggregations: z.array(z.object({
          field: z.string(),
          operation: z.enum(['count', 'sum', 'avg', 'min', 'max', 'distinct_count']),
          alias: z.string().optional()
        })),
        limit: z.number().min(1).max(1000).default(100)
      }), args);

      logger.info('Starting data aggregation', {
        appId: validated.appId,
        tableId: validated.tableId,
        groupBy: validated.groupBy,
        aggregationCount: validated.aggregations.length
      });

      const queryResult = await client.queryRecords(validated.appId, {
        tableId: validated.tableId,
        query: validated.query,
        limit: validated.limit
      });

      const records = queryResult.data || [];

      const performAggregation = (groupRecords: any[], agg: typeof validated.aggregations[0]) => {
        const values = groupRecords
          .map(r => r[agg.field])
          .filter(v => v !== null && v !== undefined);

        switch (agg.operation) {
          case 'count': return groupRecords.length;
          case 'sum': return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
          case 'avg': return values.length > 0 ? values.reduce((sum, val) => sum + (Number(val) || 0), 0) / values.length : 0;
          case 'min': return values.length > 0 ? Math.min(...values.map(Number)) : null;
          case 'max': return values.length > 0 ? Math.max(...values.map(Number)) : null;
          case 'distinct_count': return new Set(values).size;
          default: return null;
        }
      };

      let results: any[];

      if (validated.groupBy?.length) {
        const groups = new Map<string, any[]>();

        for (const record of records) {
          const groupKey = validated.groupBy.map(field => record[field]).join('|');
          if (!groups.has(groupKey)) groups.set(groupKey, []);
          groups.get(groupKey)!.push(record);
        }

        results = Array.from(groups.entries()).map(([groupKey, groupRecords]) => {
          const result: Record<string, any> = {};
          const groupValues = groupKey.split('|');
          validated.groupBy!.forEach((field, i) => result[field] = groupValues[i]);

          for (const agg of validated.aggregations) {
            result[agg.alias || `${agg.operation}_${agg.field}`] = performAggregation(groupRecords, agg);
          }
          return result;
        });
      } else {
        const result: Record<string, any> = {};
        for (const agg of validated.aggregations) {
          result[agg.alias || `${agg.operation}_${agg.field}`] = performAggregation(records, agg);
        }
        results = [result];
      }

      return {
        success: true,
        data: {
          totalRecords: records.length,
          groupBy: validated.groupBy,
          aggregations: validated.aggregations,
          results
        },
        message: `Aggregated ${records.length} records into ${results.length} result(s)`,
      };
    },
  },
];
