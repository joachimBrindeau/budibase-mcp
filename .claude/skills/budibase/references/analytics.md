# Analytics Domain

Data transformation, aggregation, and format conversion. All read-only — no confirmation needed.

## Which Tool?

```
What do you need?
├── "How many / total / average / max..."
│   └── aggregate_data           ← groupBy + aggregations
├── "Clean up / format / normalize..."
│   └── transform_records        ← query + transformations
├── "Export as CSV / JSON / table..."
│   ├── From Budibase data → transform_records (outputFormat: "csv")
│   └── From existing data → convert_data_format
└── "Convert between formats"
    └── convert_data_format      ← no API call, local conversion
```

## transform_records

Query records and apply transformations in-place.

```json
{
  "appId": "app_xxx",
  "tableId": "ta_xxx",
  "query": { "equal": { "status": "active" } },
  "transformations": [
    { "field": "name", "operation": "uppercase" },
    { "field": "price", "operation": "calculate", "expression": "value * 1.2" },
    { "field": "createdAt", "operation": "format_date", "format": "yyyy-MM-dd" }
  ],
  "outputFormat": "records",
  "limit": 100
}
```

### Operations

| Operation | Parameters | Example |
|-----------|-----------|---------|
| `uppercase` | — | `"john"` → `"JOHN"` |
| `lowercase` | — | `"JOHN"` → `"john"` |
| `trim` | — | `" hi "` → `"hi"` |
| `prefix` | `value` | `value: "$"` → `"$100"` |
| `suffix` | `value` | `value: "%"` → `"100%"` |
| `replace` | `from`, `to` | `from: "-", to: "/"` |
| `calculate` | `expression` | `"value * 2 + tax"` (mathjs) |
| `format_date` | `format` | `"yyyy-MM-dd"` (date-fns) |
| `extract` | `from` (regex) | `from: "\\d+"` extracts numbers |
| `concatenate` | `fields`, `separator` | Joins multiple fields |

### Calculate Expressions

Uses mathjs. `value` = current field value. All numeric fields from the record are available as variables.

```json
{ "field": "total", "operation": "calculate", "expression": "price * quantity" }
```

### Concatenate

Joins values from multiple fields:
```json
{
  "field": "fullName",
  "operation": "concatenate",
  "fields": ["firstName", "lastName"],
  "separator": " "
}
```

### Output Formats

| Format | Description |
|--------|-------------|
| `records` | Array of objects (default) |
| `csv` | CSV string |
| `json` | Pretty-printed JSON string |
| `table` | Markdown table |

## aggregate_data

Perform aggregations with optional grouping.

```json
{
  "appId": "app_xxx",
  "tableId": "ta_xxx",
  "query": { "equal": { "status": "active" } },
  "groupBy": ["region", "category"],
  "aggregations": [
    { "field": "amount", "operation": "sum", "alias": "totalAmount" },
    { "field": "amount", "operation": "avg", "alias": "avgAmount" },
    { "field": "_id", "operation": "count", "alias": "recordCount" }
  ],
  "limit": 100
}
```

### Aggregation Operations

| Operation | Description |
|-----------|-------------|
| `count` | Number of records |
| `sum` | Sum of numeric values |
| `avg` | Average of numeric values |
| `min` | Minimum value |
| `max` | Maximum value |
| `distinct_count` | Count of unique values |

Without `groupBy`, returns a single result row for the entire dataset.

## convert_data_format

Convert between data formats (no Budibase API call).

```json
{
  "data": [{ "name": "A", "value": 1 }, { "name": "B", "value": 2 }],
  "fromFormat": "records",
  "toFormat": "csv",
  "options": {
    "csvDelimiter": ",",
    "includeHeaders": true
  }
}
```

### Format Conversions

| From | To | Notes |
|------|----|----|
| `records` | `csv` | Uses papaparse |
| `records` | `json` | Pretty-printed |
| `records` | `table` | Markdown table |
| `records` | `markdown` | Same as table |
| `csv` | `records` | Parse CSV to objects |
| `json` | `records` | Parse JSON string |
