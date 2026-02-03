# Advanced Features Guide

This guide covers the advanced query building, batch operations, and data transformation features of the Budibase MCP Server.

## Advanced Query Builder

### Simple Query Strings

Use intuitive string syntax for quick queries:

```javascript
// Example: Find active users in marketing with salary > 60000
{
  "name": "simple_query",
  "arguments": {
    "appId": "app_123",
    "tableId": "users",
    "queryString": "status:active,department~Marketing,salary>60000",
    "limit": 50
  }
}
```

**Query String Operators:**
- `:` - Equals (exact match)
- `~` - Fuzzy search/contains
- `*` - Contains (substring)
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `!=` - Not equals

### Advanced Query Builder

Build complex queries with multiple conditions:

```javascript
{
  "name": "advanced_query",
  "arguments": {
    "appId": "app_123",
    "tableId": "employees",
    "conditions": [
      { "field": "status", "operator": "equals", "value": "active" },
      { "field": "salary", "operator": "range", "rangeOptions": { "low": 50000, "high": 100000 } },
      { "field": "department", "operator": "in", "values": ["Engineering", "Sales", "Marketing"] },
      { "field": "email", "operator": "notEmpty" }
    ],
    "sort": [
      { "field": "salary", "direction": "descending" },
      { "field": "hire_date", "direction": "ascending" }
    ],
    "limit": 100
  }
}
```

### Fluent Query Interface

Chain operations for readable query building:

```javascript
{
  "name": "fluent_query",
  "arguments": {
    "appId": "app_123",
    "tableId": "products",
    "operations": [
      { "method": "equals", "args": ["category", "Electronics"] },
      { "method": "greaterThan", "args": ["price", 100] },
      { "method": "contains", "args": ["name", "iPhone"] },
      { "method": "sortBy", "args": ["price", "descending"] },
      { "method": "limit", "args": [20] }
    ]
  }
}
```

**Available Fluent Methods:**
- `equals(field, value)` - Exact match
- `notEquals(field, value)` - Not equal
- `contains(field, value)` - String contains
- `startsWith(field, value)` - String starts with
- `endsWith(field, value)` - String ends with
- `fuzzy(field, value)` - Fuzzy search
- `range(field, low, high)` - Numeric range
- `greaterThan(field, value)` - Greater than
- `lessThan(field, value)` - Less than
- `empty(field)` - Field is empty
- `notEmpty(field)` - Field is not empty
- `sortBy(field, direction)` - Add sorting
- `limit(count)` - Limit results
- `bookmark(value)` - Pagination

## Batch Operations

### Batch Create Records

Create multiple records efficiently:

```javascript
{
  "name": "batch_create_records",
  "arguments": {
    "appId": "app_123",
    "tableId": "customers",
    "records": [
      { "name": "John Doe", "email": "john@example.com", "status": "active" },
      { "name": "Jane Smith", "email": "jane@example.com", "status": "pending" },
      { "name": "Bob Johnson", "email": "bob@example.com", "status": "active" }
    ],
    "batchSize": 10,
    "continueOnError": true
  }
}
```

### Batch Update Records

Update multiple records with individual data:

```javascript
{
  "name": "batch_update_records",
  "arguments": {
    "appId": "app_123",
    "tableId": "employees",
    "records": [
      { "id": "row_123", "data": { "salary": 75000, "status": "promoted" } },
      { "id": "row_124", "data": { "salary": 68000, "department": "Engineering" } },
      { "id": "row_125", "data": { "status": "active", "last_review": "2024-01-01" } }
    ],
    "batchSize": 5,
    "continueOnError": true
  }
}
```

### Batch Delete Records

Delete multiple records by ID:

```javascript
{
  "name": "batch_delete_records",
  "arguments": {
    "appId": "app_123",
    "tableId": "temp_data",
    "recordIds": ["row_123", "row_124", "row_125", "row_126"],
    "batchSize": 10,
    "continueOnError": false
  }
}
```

### Bulk Query and Process

Query records and perform bulk operations:

```javascript
{
  "name": "bulk_query_and_process",
  "arguments": {
    "appId": "app_123",
    "tableId": "users",
    "query": {
      "equal": { "status": "inactive" },
      "range": { "last_login": { "high": 1640995200000 } }  // Before 2022
    },
    "operation": "update",
    "updateData": { "status": "archived", "archived_date": "2024-01-01" },
    "batchSize": 20,
    "continueOnError": true
  }
}
```

## Data Transformation

### Transform Records

Apply various transformations to data:

```javascript
{
  "name": "transform_records",
  "arguments": {
    "appId": "app_123",
    "tableId": "customers",
    "query": { "equal": { "status": "active" } },
    "transformations": [
      { "field": "name", "operation": "uppercase" },
      { "field": "email", "operation": "lowercase" },
      { "field": "phone", "operation": "replace", "from": "-", "to": "" },
      { "field": "salary", "operation": "calculate", "expression": "value * 1.05" },
      { "field": "full_contact", "operation": "concatenate", "fields": ["name", "email"], "separator": " <" },
      { "field": "created_date", "operation": "format_date", "format": "ISO" }
    ],
    "outputFormat": "csv",
    "limit": 100
  }
}
```

**Available Transformations:**
- `uppercase` - Convert to uppercase
- `lowercase` - Convert to lowercase
- `trim` - Remove whitespace
- `prefix` - Add prefix to value
- `suffix` - Add suffix to value
- `replace` - Replace text using regex
- `calculate` - Perform mathematical calculation
- `format_date` - Format date values
- `extract` - Extract part of value using regex
- `concatenate` - Join multiple fields

### Data Aggregation

Perform statistical operations on data:

```javascript
{
  "name": "aggregate_data",
  "arguments": {
    "appId": "app_123",
    "tableId": "sales",
    "query": { "range": { "sale_date": { "low": 1640995200000, "high": 1672531200000 } } },
    "groupBy": ["department", "region"],
    "aggregations": [
      { "field": "amount", "operation": "sum", "alias": "total_sales" },
      { "field": "amount", "operation": "avg", "alias": "avg_sale" },
      { "field": "amount", "operation": "count", "alias": "sale_count" },
      { "field": "amount", "operation": "min", "alias": "min_sale" },
      { "field": "amount", "operation": "max", "alias": "max_sale" },
      { "field": "customer_id", "operation": "distinct_count", "alias": "unique_customers" }
    ],
    "limit": 1000
  }
}
```

### Format Conversion

Convert data between different formats:

```javascript
{
  "name": "convert_data_format",
  "arguments": {
    "data": [
      { "name": "John Doe", "age": 30, "salary": 75000 },
      { "name": "Jane Smith", "age": 28, "salary": 68000 }
    ],
    "fromFormat": "records",
    "toFormat": "csv",
    "options": {
      "csvDelimiter": ",",
      "includeHeaders": true
    }
  }
}
```

**Supported Formats:**
- `records` - JavaScript object arrays
- `json` - JSON string format
- `csv` - Comma-separated values
- `table` - ASCII table format
- `markdown` - Markdown table format

## Performance Considerations

### Batch Processing
- Default batch size: 10 records
- Maximum batch size: 50 records
- Automatic delays between batches (100ms)
- Continue on error for resilient processing

### Query Optimization
- Use specific field conditions when possible
- Limit results to reduce memory usage
- Use pagination with bookmarks for large datasets
- Index commonly queried fields in Budibase

### Error Handling
- All batch operations support `continueOnError` flag
- Detailed error reporting with record indices
- Progress tracking for long-running operations
- Automatic cleanup on critical failures

## Examples by Use Case

### Data Migration
```javascript
// 1. Query old data
{
  "name": "advanced_query",
  "arguments": {
    "appId": "legacy_app",
    "tableId": "old_customers",
    "conditions": [{ "field": "migrated", "operator": "notEquals", "value": true }],
    "limit": 1000
  }
}

// 2. Transform data
{
  "name": "transform_records",
  "arguments": {
    "appId": "legacy_app",
    "tableId": "old_customers",
    "transformations": [
      { "field": "phone", "operation": "replace", "from": "[^0-9]", "to": "" },
      { "field": "email", "operation": "lowercase" }
    ]
  }
}

// 3. Batch create in new system
{
  "name": "batch_create_records",
  "arguments": {
    "appId": "new_app",
    "tableId": "customers",
    "records": "...", // transformed data
    "batchSize": 25
  }
}
```

### Data Analysis
```javascript
// Generate sales report with aggregations
{
  "name": "aggregate_data",
  "arguments": {
    "appId": "sales_app",
    "tableId": "transactions",
    "groupBy": ["sales_rep", "month"],
    "aggregations": [
      { "field": "amount", "operation": "sum", "alias": "total_revenue" },
      { "field": "amount", "operation": "avg", "alias": "avg_deal_size" },
      { "field": "transaction_id", "operation": "count", "alias": "deal_count" }
    ]
  }
}
```

### Data Cleanup
```javascript
// Find and fix data quality issues
{
  "name": "bulk_query_and_process",
  "arguments": {
    "appId": "app_123",
    "tableId": "contacts",
    "query": { "empty": { "email": true } },
    "operation": "update",
    "updateData": { "status": "incomplete", "needs_review": true }
  }
}
```