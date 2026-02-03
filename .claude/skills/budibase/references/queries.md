# Queries Domain

All read-only. No confirmation needed.

## Which Tool?

```
What kind of query?
├── Filter by field values, sort, paginate
│   └── query_records              ← default choice
├── Saved query in Budibase
│   ├── Don't know query ID → search_queries
│   └── Know query ID       → execute_query
└── Aggregation (count, sum, avg)
    └── use Analytics domain → aggregate_data
```

When in doubt, use `query_records`. It handles most cases.

## Tools Overview

| Tool | Best For | Complexity |
|------|----------|------------|
| `query_records` | Standard filtering with known fields | Low |
| `search_queries` | Discovering available saved queries | Low |
| `execute_query` | Running saved Budibase queries | Low |

## query_records

Standard filtering with sort, pagination, field selection, and auto-pagination. Accepts app/table names or IDs.

**Always pass `fields`** to reduce token usage. `_id` is always included automatically.

```json
{
  "appId": "app_xxx",
  "tableId": "ta_xxx",
  "query": {
    "equal": { "status": "active" },
    "notEmpty": { "email": true }
  },
  "fields": ["name", "status", "email"],
  "sort": { "createdAt": "descending" },
  "limit": 50
}
```

### Fetch All Rows

Use `fetchAll: true` to auto-paginate and get all matching rows in one call (max 5,000). Overrides `limit` and `bookmark`.

```json
{
  "appId": "app_xxx",
  "tableId": "ta_xxx",
  "query": { "equal": { "status": "active" } },
  "fields": ["name", "status"],
  "fetchAll": true
}
```

Response when fetchAll is used:
```json
{
  "rows": [...],
  "totalRows": 342,
  "truncated": false
}
```

If more than 5,000 rows match, `truncated: true` is returned — narrow your filters.

### Filter Types

| Type | Purpose | Example |
|------|---------|---------|
| `string` | Substring match | `{ "name": "john" }` |
| `fuzzy` | Fuzzy text match | `{ "name": "jonh" }` |
| `range` | Numeric range | `{ "age": { "low": 18, "high": 65 } }` |
| `equal` | Exact match | `{ "status": "active" }` |
| `notEqual` | Exclude value | `{ "status": "deleted" }` |
| `empty` | Field is null | `{ "email": true }` |
| `notEmpty` | Field exists | `{ "email": true }` |

Combine multiple filter types in one query — they are ANDed together.

## Saved Queries

### search_queries
Discover saved queries (optionally filtered by app).
```json
{ "appId": "app_xxx" }
```
Returns: `{ queries: [{ id, name, datasourceId, queryVerb, parameters }] }`

### execute_query
Run a saved query with parameters.
```json
{ "queryId": "query_xxx", "parameters": { "status": "active" } }
```

## Pagination

Two modes:

**Manual** (default): Pass `bookmark` from response to next call.
```
Response: { rows: [...], hasNextPage: true, bookmark: "abc123" }
```
Max `limit`: 1000, default: 50.

**Auto** (`fetchAll: true`): Fetches all pages internally, returns combined result.
```
Response: { rows: [...], totalRows: 342, truncated: false }
```
Max 5,000 rows. Use `fetchAll` for exports, analytics, bulk operations.
