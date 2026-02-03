---
name: budibase
description: Manages Budibase applications through MCP tools. Handles record CRUD, querying, bulk operations, data transformation, schema management, and app lifecycle. Triggers on "budibase", table data management, record operations, bulk imports, or data analytics. Enforces MECE workflows with confirmation for destructive operations.
---

# Budibase Data Management

## Quick Start

Every operation follows: **Knowledge → Route → Execute → Report → Learn**.

```
0. Knowledge: Read knowledge files → resolve app/table/entity from cache
1. Route: Match intent to tool (see table below) → load domain reference
2. Execute: Call tool with correct IDs → confirm if destructive
3. Report: Return result → include rollback if needed
4. Learn: Persist any newly discovered structure to knowledge files
```

## Phase 0: Knowledge

Before any tool call, load persistent knowledge to skip redundant discovery.

### Read Path

```
1. Read .claude/skills/budibase/knowledge/_index.yaml
   - If missing → run Bootstrap (see below)
   - If budibase_url != BUDIBASE_URL from environment → delete all knowledge, run Bootstrap
2. Match user intent to an app + table:
   - By explicit app name ("in CRM") → direct lookup in _index.yaml
   - By entity name ("Elicit") → scan table files in app folder for entity match
   - By alias → check aliases in _index.yaml
   - By table name ("Clients table") → check tables map in _index.yaml
   - Ambiguous match → check defaults in _index.yaml, or ask user
3. Get appId + tableId directly from _index.yaml (tables map has IDs)
4. If app folder doesn't exist → run Hydrate App (creates all table files with schemas)
5. Read knowledge/{app-folder}/{table-name}.yaml for entities, workflows, schema details
6. Only call discovery tools for paths not in _index.yaml
```

### Bootstrap

Triggered when `_index.yaml` doesn't exist, or user says "rebuild knowledge" / "forget everything":

```
1. Call discover_apps(includeTables: true)
2. Write _index.yaml:
   - bootstrapped date
   - Each app: name, folder slug, appId, aliases (empty), tables map (name → tableId)
   - No app folders or table files yet (created on first access via Hydrate)
```

**Slugification:** `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`

### Hydrate App

Triggered the first time an app is referenced (app folder doesn't exist):

```
1. Call get_table_schema for EACH table in the app (use tableIds from _index.yaml)
2. Create app folder: knowledge/{app-slug}/
3. Write per-table YAML files: knowledge/{app-slug}/{table-name}.yaml
   - table section: name, tableId, primaryDisplay (from schema response)
   - schema section: all fields with name, type, link target
   - entities, workflows sections: empty (filled incrementally)
```

**Cost:** N API calls (one per table). Done once per app, on first access.

### Knowledge File Structure

```
knowledge/
  _index.yaml                    # App router + table lists
  {app-slug}/                    # One folder per app
    {table-name}.yaml            # One file per table
```

**`_index.yaml`:**

```yaml
bootstrapped: "2026-02-03"

apps:
  klarc:
    folder: klarc
    appId: app_abc123
    aliases: []
    tables:
      comptes: ta_xyz789
      contacts: ta_abc123
      dossiers: ta_def456

defaults:
  Contacts: klarc
```

**Per-table file (e.g., `klarc/comptes.yaml`):**

```yaml
table:
  name: comptes
  tableId: ta_xyz789
  primaryDisplay: nom

schema:
  fields:
    nom: { type: string, primary: true }
    notes: { type: longform }
    status: { type: options }
    contacts: { type: link, target: contacts }

entities:
  ELICIT PLANT:
    rowId: ro_def456
    matchField: nom
    matchValue: ELICIT PLANT
    _lastSeen: "2026-02-03"

workflows:
  add_comment:
    trigger: "add comment/note on [entity]"
    steps: "resolve entity → update_record, append to notes field"
    field: notes
```

**Size budget (~3KB soft cap per table file):**

| Section | Budget | What to store |
|---------|--------|---------------|
| `table` | ~200B | Name + tableId + primaryDisplay |
| `schema` | ~1KB | Only if Claude has fetched it. Fields: name, type, link target. No constraints |
| `entities` | ~1.5KB | ~20 most recent entities. Drop oldest when exceeded |
| `workflows` | ~300B | Only patterns from actual usage |

### Entity Resolution

When operating on a named entity (e.g., "update Elicit's notes"):

```
1. Check knowledge entities section
   ├── Found → use rowId directly (0 API calls)
   │   ├── Success → done
   │   └── 404 → go to step 2
   └── Not found → go to step 2

2. Query by primaryDisplay field
   → query_records with filter: { equal: { [primaryDisplay]: "Elicit" } }
   ├── 1 result → use it, save to knowledge entities section
   ├── 0 results → remove stale entry if existed, report "not found"
   └── N results → present options to user, save chosen one
```

### Ambiguity Resolution

When an entity or table name exists in multiple apps:

```
1. User mentions app explicitly ("in CRM") → use that app
2. Check _index.yaml defaults → use stored preference
3. Only one app has it → no ambiguity
4. Multiple apps, no default → ask user, store choice in defaults
```

## MCP Resources

Read these resources for context when knowledge files are insufficient:

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

## Phase 5: Learn

After executing a tool, persist newly discovered structural data to knowledge files.

### Write Triggers

| Trigger | What to write | Target file |
|---------|--------------|-------------|
| Bootstrap (`discover_apps`) | All apps + table name→ID maps | `_index.yaml` only |
| Hydrate App (first access) | All table schemas for that app | `{app}/{table}.yaml` for each table |
| `get_table_schema` called (refresh) | Updated schema for that table | `{app}/{table}.yaml` (schema section) |
| Entity resolved by query | rowId + matchField | `{app}/{table}.yaml` (entities section) |
| Recurring workflow pattern | trigger + steps + field | `{app}/{table}.yaml` (workflows section) |
| Table/app created | New entry | `_index.yaml` + new table YAML file |
| Table/app deleted | Remove entry | `_index.yaml` + delete table YAML file |

**NOT triggered by:** `query_records`, `get_row`, `aggregate_data`, `transform_records`, batch ops. These return record data, not structural data.

### Write Procedure

```
1. Read the target table YAML file
2. Merge new data into the relevant section
3. If entities section exceeds ~20 entries, drop the oldest by _lastSeen
4. Write the full file back (not append — prevents corruption)
5. If new app/table encountered, update _index.yaml and create files
```

### Self-Healing

When a tool call fails due to stale knowledge:

| Error | Cause | Action |
|-------|-------|--------|
| 404 on tableId | Table deleted/renamed | Re-discover app tables (`discover_apps`), update knowledge |
| 404 on rowId | Record deleted | Remove entity entry, query by matchField |
| 400 "field X does not exist" | Schema changed | Re-fetch `get_table_schema`, update knowledge |
| 404 on appId | App deleted | Remove from `_index.yaml` + delete app folder |
| 401 / 403 | Auth problem | Pass through to user. Never re-discover |
| 429 | Rate limited | Pass through. Retry handled by axios-retry |
| 5xx | Server error | Pass through. Never re-discover |
| YAML parse error | Corrupted file | Delete the file, re-bootstrap that app |

## Knowledge Management

| User Says | Action |
|-----------|--------|
| "rebuild knowledge" / "forget everything" | Delete all knowledge files + folders, run Bootstrap |
| "forget [app name]" | Delete that app's folder + remove from `_index.yaml` |
| "refresh [app name]" | Delete app folder, re-run Hydrate App |
| "[entity] means the [app] one" | Update defaults in `_index.yaml` |

## Workflow Recipes

### Import CSV Data
```
1. Knowledge: resolve appId + tableId from knowledge
2. get_table_schema → validate CSV columns match fields (Learn: save schema)
3. batch_create_records → import with continueOnError: true
4. Report: created count, any failures
```

### Clean and Export Data
```
1. Knowledge: resolve appId + tableId from knowledge
2. query_records → fetch target records
3. transform_records → apply formatting (trim, uppercase, dates)
4. convert_data_format → export to csv/json/markdown
```

### Bulk Update with Conditions
```
1. Knowledge: resolve appId + tableId from knowledge
2. query_records → find matching records (preview)
3. Show user: "[N] records match. Will set [field] to [value]."
4. bulk_query_and_process → operation: "update", updateData: {...}
```

### Migrate Records Between Tables
```
1. Knowledge: resolve source + target appId/tableId
2. query_records → fetch from source table
3. transform_records → reshape fields if schemas differ
4. batch_create_records → insert into target table
5. (optional) batch_delete_records → remove from source after confirm
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

On failure: check knowledge files for stale IDs, validate field names via `get_table_schema`, report partial successes for batch ops.
