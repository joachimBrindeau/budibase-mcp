---
name: budibase
description: Manages Budibase applications through MCP tools. Handles record CRUD, querying, bulk operations, data transformation, schema management, and app lifecycle. Triggers on "budibase", table data management, record operations, bulk imports, or data analytics. Enforces MECE workflows with confirmation for destructive operations.
---

# Budibase Data Management

## Quick Start

Every operation follows: **Discover → Route → Execute → Report**.

```
1. discover_apps (includeTables: true)  →  learn structure
2. Route intent to tool (see table below) →  load domain reference
3. Execute with correct tool              →  confirm if destructive
4. Report result                          →  include rollback if needed
```

## MCP Resources

Read these resources for context before tool calls:

| URI | Purpose |
|-----|---------|
| `budibase://system/capabilities` | Batch limits, cache config, query limits, ID formats |
| `budibase://system/status` | Connection health and cache stats |
| `budibase://applications/summary` | All apps with status |
| `budibase://users/summary` | All users with status |

## Intent Router

Match user intent directly to tool. Read the domain reference before calling.

| User Says | Tool | Domain |
|-----------|------|--------|
| "show me all...", "list...", "find..." | `query_records` | [queries](references/queries.md) |
| "search for...", "filter by..." | `query_records` | [queries](references/queries.md) |
| "how many...", "total...", "average..." | `aggregate_data` | [analytics](references/analytics.md) |
| "add...", "create...", "insert..." | `create_record` | [records](references/records.md) |
| "import...", "bulk add..." | `batch_create_records` | [records](references/records.md) |
| "update...", "change...", "set..." | `update_record` | [records](references/records.md) |
| "update all where..." | `bulk_query_and_process` | [records](references/records.md) |
| "delete...", "remove..." | `delete_record` | [records](references/records.md) |
| "export as CSV...", "convert to..." | `convert_data_format` | [analytics](references/analytics.md) |
| "clean up...", "format...", "normalize..." | `transform_records` | [analytics](references/analytics.md) |
| "create table...", "add column..." | `create_table` / `update_table` | [apps](references/apps.md) |
| "publish...", "deploy..." | `publish_application` | [apps](references/apps.md) |
| "what apps...", "what tables..." | `discover_apps` | [apps](references/apps.md) |
| "what fields...", "show schema..." | `get_table_schema` | [apps](references/apps.md) |
| "saved queries...", "run query..." | `search_queries` / `execute_query` | [queries](references/queries.md) |

For multiple records, always prefer batch tools over looping single-record tools.

## Domains (MECE)

| Domain | When | Safety | Reference |
|--------|------|--------|-----------|
| **Records** | CRUD single/batch rows | Create=safe, Update/Delete=confirm | [records.md](references/records.md) |
| **Queries** | Search, filter, sort, paginate, saved queries | Safe (read-only) | [queries.md](references/queries.md) |
| **Apps** | Apps, tables, users, lifecycle | Create=safe, Modify/Delete=confirm | [apps.md](references/apps.md) |
| **Analytics** | Transform, aggregate, convert | Safe (read-only) | [analytics.md](references/analytics.md) |

## Safety Protocol

**Safe** (execute immediately): All reads, creates, transforms, queries.

**Confirm required** (preview first): Updates, deletes, bulk mutations, publish/unpublish.

```
1. Preview: Show what changes (current → new, or records to delete)
2. Ask: "This will [action] [N] records in [Table]. Proceed?"
3. Execute: Only after explicit "yes"
4. Report: Summary + rollback guidance
```

## Workflow Recipes

### Import CSV Data
```
1. discover_apps → get appId and tableId
2. get_table_schema → validate CSV columns match fields
3. batch_create_records → import with continueOnError: true
4. Report: created count, any failures
```

### Clean and Export Data
```
1. query_records → fetch target records
2. transform_records → apply formatting (trim, uppercase, dates)
3. convert_data_format → export to csv/json/markdown
```

### Bulk Update with Conditions
```
1. query_records → find matching records (preview)
2. Show user: "[N] records match. Will set [field] to [value]."
3. bulk_query_and_process → operation: "update", updateData: {...}
```

### Migrate Records Between Tables
```
1. query_records → fetch from source table
2. transform_records → reshape fields if schemas differ
3. batch_create_records → insert into target table
4. (optional) batch_delete_records → remove from source after confirm
```

## ID Formats

| Entity | Format | Example |
|--------|--------|---------|
| Application | `app_` prefix | `app_dev_abc123` |
| Table | `ta_` prefix | `ta_abc123def456` |
| Row/Record | `ro_` prefix | `ro_ta_abc123_xyz789` |
| User | `us_` prefix | `us_abc123` |
| Query | `query_` prefix | `query_abc123` |

Table names auto-resolve: pass `"Customers"` or `"ta_abc123"` interchangeably.

## Relationships

Link fields store row ID arrays: `["ro_xxx", "ro_yyy"]`.

- Field type `link` with `relationshipType`: one-to-many, many-to-one, many-to-many
- `tableId` on link field = related table
- Pass `{ "linkField": ["ro_id1", "ro_id2"] }` in record data

## Error Handling

All responses: `{ success, data, message }`.

Batch responses: `{ success, partialSuccess, totalRequested, totalSuccessful, totalFailed, errors[] }`.
- `success=true` only when ALL items succeed
- `partialSuccess=true` when some succeed and some fail

Errors include recovery hints suggesting next tools:
- 401/403 → "Try: check_connection"
- 404 → "Try: list_applications or list_tables to find valid IDs"
- 429 → "Reduce batch size/concurrency"
- 5xx → "Try: check_connection"

On failure: check appId/tableId exist, validate field names via `get_table_schema`, report partial successes for batch ops.
