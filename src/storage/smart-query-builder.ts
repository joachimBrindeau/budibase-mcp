import { BudibaseTable, BudibaseField, QueryRequest } from '../types/budibase';
import { SchemaRegistry } from './schema-registry';
import { logger } from '../utils/logger';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface OptimizedQuery extends QueryRequest {
  hints?: {
    useIndex?: string;
    estimatedRows?: number;
    complexity?: 'simple' | 'moderate' | 'complex';
  };
}

export class SmartQueryBuilder {
  constructor(private schemaRegistry: SchemaRegistry) {}

  async buildQuery(
    tableId: string, 
    query: Partial<QueryRequest>
  ): Promise<OptimizedQuery> {
    const table = await this.schemaRegistry.getTableSchema(tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in schema registry`);
    }

    // Validate query against schema
    const validation = this.validateQuery(table, query);
    if (!validation.valid) {
      throw new Error(`Invalid query: ${validation.errors.join(', ')}`);
    }

    // Log warnings if any
    if (validation.warnings.length > 0) {
      logger.warn('Query validation warnings', { warnings: validation.warnings });
    }

    // Optimize query based on schema
    return this.optimizeQuery(table, query);
  }

  private validateQuery(
    table: BudibaseTable, 
    query: Partial<QueryRequest>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const schema = table.schema;

    // Validate fields in query conditions
    if (query.query) {
      const allFields = new Set<string>();
      
      // Collect all referenced fields
      Object.entries(query.query).forEach(([operator, conditions]) => {
        if (conditions && typeof conditions === 'object') {
          Object.keys(conditions).forEach(field => allFields.add(field));
        }
      });

      // Validate each field
      allFields.forEach(field => {
        if (!schema[field] && !['_id', '_rev', 'tableId'].includes(field)) {
          errors.push(`Field '${field}' does not exist in table '${table.name}'`);
        }
      });

      // Type validation
      if (query.query.range) {
        Object.entries(query.query.range).forEach(([field, range]) => {
          const fieldSchema = schema[field];
          if (fieldSchema && fieldSchema.type !== 'number') {
            errors.push(`Range query on field '${field}' requires numeric type, but field is '${fieldSchema.type}'`);
          }
        });
      }

      if (query.query.string || query.query.fuzzy) {
        const textOps = { ...query.query.string, ...query.query.fuzzy };
        Object.keys(textOps).forEach(field => {
          const fieldSchema = schema[field];
          if (fieldSchema && !['string', 'formula'].includes(fieldSchema.type)) {
            warnings.push(`Text search on field '${field}' of type '${fieldSchema.type}' may not work as expected`);
          }
        });
      }
    }

    // Validate sort fields
    if (query.sort) {
      Object.keys(query.sort).forEach(field => {
        if (!schema[field] && !['_id', 'createdAt', 'updatedAt'].includes(field)) {
          errors.push(`Sort field '${field}' does not exist in table '${table.name}'`);
        }
      });
    }

    // Validate limit
    if (query.limit && (query.limit < 1 || query.limit > 1000)) {
      errors.push('Limit must be between 1 and 1000');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  private optimizeQuery(
    table: BudibaseTable,
    query: Partial<QueryRequest>
  ): OptimizedQuery {
    const optimized: OptimizedQuery = {
      tableId: table._id,
      ...query,
      hints: {}
    };

    // Estimate query complexity
    let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
    let conditionCount = 0;

    if (query.query) {
      Object.values(query.query).forEach(conditions => {
        if (conditions && typeof conditions === 'object') {
          conditionCount += Object.keys(conditions).length;
        }
      });
    }

    if (conditionCount > 5 || (query.query?.fuzzy && Object.keys(query.query.fuzzy).length > 0)) {
      complexity = 'complex';
    } else if (conditionCount > 2) {
      complexity = 'moderate';
    }

    optimized.hints!.complexity = complexity;

    // Suggest index usage based on query patterns
    if (query.query?.equal && Object.keys(query.query.equal).length === 1) {
      const field = Object.keys(query.query.equal)[0];
      const schema = table.schema;
      if (schema[field]?.constraints?.presence) {
        optimized.hints!.useIndex = field;
      }
    }

    // Set default limit if not specified
    if (!optimized.limit) {
      optimized.limit = complexity === 'complex' ? 20 : 50;
    }

    return optimized;
  }

  async suggestQuery(
    tableId: string,
    description: string
  ): Promise<Partial<QueryRequest>> {
    const table = await this.schemaRegistry.getTableSchema(tableId);
    if (!table) {
      throw new Error(`Table ${tableId} not found in schema registry`);
    }

    // Simple query suggestion based on field names and types
    const suggestion: Partial<QueryRequest> = {
      query: {},
      limit: 50
    };

    // Extract potential field names from description
    const words = description.toLowerCase().split(/\s+/);
    const schema = table.schema;

    Object.entries(schema).forEach(([fieldName, field]) => {
      const fieldNameLower = fieldName.toLowerCase();
      
      // Check if field name is mentioned in description
      if (words.some(word => fieldNameLower.includes(word) || word.includes(fieldNameLower))) {
        // Suggest appropriate operator based on field type
        switch (field.type) {
          case 'string':
            suggestion.query!.string = { [fieldName]: '' };
            break;
          case 'number':
            suggestion.query!.range = { [fieldName]: { low: 0, high: 100 } };
            break;
          case 'boolean':
            suggestion.query!.equal = { [fieldName]: true };
            break;
          case 'datetime':
            suggestion.query!.range = { [fieldName]: {} };
            break;
        }
      }
    });

    // Add sort if "latest", "recent", or "newest" is mentioned
    if (words.some(word => ['latest', 'recent', 'newest'].includes(word))) {
      suggestion.sort = { createdAt: 'descending' };
    }

    return suggestion;
  }
}