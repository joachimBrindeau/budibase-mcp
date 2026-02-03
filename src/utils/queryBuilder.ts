import { QueryRequest } from '../types/budibase';

export interface QueryCondition {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'endsWith' | 'fuzzy' | 'range' | 'empty' | 'notEmpty' | 'in' | 'notIn';
  value?: any;
  values?: any[];
  rangeOptions?: { low?: number; high?: number };
}

export interface SortCondition {
  field: string;
  direction: 'ascending' | 'descending';
}

export interface QueryBuilderOptions {
  conditions?: QueryCondition[];
  sort?: SortCondition[];
  limit?: number;
  offset?: number;
  bookmark?: string;
}

export class BudibaseQueryBuilder {
  private conditions: QueryCondition[] = [];
  private sortConditions: SortCondition[] = [];
  private limitValue?: number;
  private bookmarkValue?: string;

  /**
   * Add an equality condition
   */
  equals(field: string, value: any): this {
    this.conditions.push({ field, operator: 'equals', value });
    return this;
  }

  /**
   * Add a not equals condition
   */
  notEquals(field: string, value: any): this {
    this.conditions.push({ field, operator: 'notEquals', value });
    return this;
  }

  /**
   * Add a contains condition (string search)
   */
  contains(field: string, value: string): this {
    this.conditions.push({ field, operator: 'contains', value });
    return this;
  }

  /**
   * Add a starts with condition
   */
  startsWith(field: string, value: string): this {
    this.conditions.push({ field, operator: 'startsWith', value });
    return this;
  }

  /**
   * Add an ends with condition
   */
  endsWith(field: string, value: string): this {
    this.conditions.push({ field, operator: 'endsWith', value });
    return this;
  }

  /**
   * Add a fuzzy search condition
   */
  fuzzy(field: string, value: string): this {
    this.conditions.push({ field, operator: 'fuzzy', value });
    return this;
  }

  /**
   * Add a range condition for numeric fields
   */
  range(field: string, low?: number, high?: number): this {
    this.conditions.push({ 
      field, 
      operator: 'range', 
      rangeOptions: { low, high } 
    });
    return this;
  }

  /**
   * Add a between condition (alias for range)
   */
  between(field: string, low: number, high: number): this {
    return this.range(field, low, high);
  }

  /**
   * Add a greater than condition
   */
  greaterThan(field: string, value: number): this {
    return this.range(field, value, undefined);
  }

  /**
   * Add a less than condition
   */
  lessThan(field: string, value: number): this {
    return this.range(field, undefined, value);
  }

  /**
   * Add an empty field condition
   */
  empty(field: string): this {
    this.conditions.push({ field, operator: 'empty' });
    return this;
  }

  /**
   * Add a not empty field condition
   */
  notEmpty(field: string): this {
    this.conditions.push({ field, operator: 'notEmpty' });
    return this;
  }

  /**
   * Add an "in" condition (value must be in array)
   */
  in(field: string, values: any[]): this {
    this.conditions.push({ field, operator: 'in', values });
    return this;
  }

  /**
   * Add a "not in" condition (value must not be in array)
   */
  notIn(field: string, values: any[]): this {
    this.conditions.push({ field, operator: 'notIn', values });
    return this;
  }

  /**
   * Add a sorting condition
   */
  sortBy(field: string, direction: 'ascending' | 'descending' = 'ascending'): this {
    this.sortConditions.push({ field, direction });
    return this;
  }

  /**
   * Add ascending sort (alias for sortBy)
   */
  orderBy(field: string): this {
    return this.sortBy(field, 'ascending');
  }

  /**
   * Add descending sort
   */
  orderByDesc(field: string): this {
    return this.sortBy(field, 'descending');
  }

  /**
   * Set the limit for results
   */
  limit(count: number): this {
    this.limitValue = Math.min(Math.max(1, count), 1000); // Clamp between 1-1000
    return this;
  }

  /**
   * Set pagination bookmark
   */
  bookmark(bookmark: string): this {
    this.bookmarkValue = bookmark;
    return this;
  }

  /**
   * Take only the first N results
   */
  take(count: number): this {
    return this.limit(count);
  }

  /**
   * Build the final query request
   */
  build(): Omit<QueryRequest, 'tableId'> {
    const query: any = {
      string: {},
      fuzzy: {},
      range: {},
      equal: {},
      notEqual: {},
      empty: {},
      notEmpty: {}
    };

    // Process conditions
    for (const condition of this.conditions) {
      switch (condition.operator) {
        case 'equals':
          query.equal[condition.field] = condition.value;
          break;
        case 'notEquals':
          query.notEqual[condition.field] = condition.value;
          break;
        case 'contains':
        case 'startsWith':
        case 'endsWith':
          query.string[condition.field] = condition.value;
          break;
        case 'fuzzy':
          query.fuzzy[condition.field] = condition.value;
          break;
        case 'range':
          query.range[condition.field] = condition.rangeOptions || {};
          break;
        case 'empty':
          query.empty[condition.field] = true;
          break;
        case 'notEmpty':
          query.notEmpty[condition.field] = true;
          break;
        case 'in':
          // For "in" operations, we'll use multiple equal conditions
          if (condition.values && condition.values.length > 0) {
            query.equal[condition.field] = condition.values[0]; // Budibase API limitation
          }
          break;
        case 'notIn':
          // For "not in" operations, we'll use multiple notEqual conditions
          if (condition.values && condition.values.length > 0) {
            query.notEqual[condition.field] = condition.values[0]; // Budibase API limitation
          }
          break;
      }
    }

    // Remove empty query objects
    Object.keys(query).forEach(key => {
      if (Object.keys(query[key]).length === 0) {
        delete query[key];
      }
    });

    // Build sort object
    const sort: Record<string, 'ascending' | 'descending'> = {};
    for (const sortCondition of this.sortConditions) {
      sort[sortCondition.field] = sortCondition.direction;
    }

    const result: any = {};
    
    if (Object.keys(query).length > 0) {
      result.query = query;
    }
    
    if (Object.keys(sort).length > 0) {
      result.sort = sort;
    }
    
    if (this.limitValue !== undefined) {
      result.limit = this.limitValue;
    }
    
    if (this.bookmarkValue) {
      result.bookmark = this.bookmarkValue;
    }

    return result;
  }

  /**
   * Reset the builder to start fresh
   */
  reset(): this {
    this.conditions = [];
    this.sortConditions = [];
    this.limitValue = undefined;
    this.bookmarkValue = undefined;
    return this;
  }

  /**
   * Create a new query builder instance
   */
  static create(): BudibaseQueryBuilder {
    return new BudibaseQueryBuilder();
  }

  /**
   * Parse a simple query string into conditions
   * Format: "field1:value1,field2>10,field3~search"
   */
  static fromString(queryString: string): BudibaseQueryBuilder {
    const builder = new BudibaseQueryBuilder();
    
    if (!queryString.trim()) {
      return builder;
    }

    const parts = queryString.split(',').map(p => p.trim());
    
    for (const part of parts) {
      // Handle different operators
      if (part.includes('>=')) {
        const [field, value] = part.split('>=').map(p => p.trim());
        builder.greaterThan(field, parseFloat(value) - 0.01); // Approximate >=
      } else if (part.includes('<=')) {
        const [field, value] = part.split('<=').map(p => p.trim());
        builder.lessThan(field, parseFloat(value) + 0.01); // Approximate <=
      } else if (part.includes('>')) {
        const [field, value] = part.split('>').map(p => p.trim());
        builder.greaterThan(field, parseFloat(value));
      } else if (part.includes('<')) {
        const [field, value] = part.split('<').map(p => p.trim());
        builder.lessThan(field, parseFloat(value));
      } else if (part.includes('~')) {
        const [field, value] = part.split('~').map(p => p.trim());
        builder.fuzzy(field, value);
      } else if (part.includes('*')) {
        const [field, value] = part.split('*').map(p => p.trim());
        builder.contains(field, value);
      } else if (part.includes('!=')) {
        const [field, value] = part.split('!=').map(p => p.trim());
        builder.notEquals(field, value);
      } else if (part.includes(':')) {
        const [field, value] = part.split(':').map(p => p.trim());
        builder.equals(field, value);
      }
    }
    
    return builder;
  }
}