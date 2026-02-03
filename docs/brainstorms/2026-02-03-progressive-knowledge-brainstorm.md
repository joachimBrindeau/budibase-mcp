# Progressive Knowledge System for Budibase MCP

**Date:** 2026-02-03
**Status:** Brainstorm complete — all decisions resolved

## What We're Building

A persistent knowledge layer that lets Claude skip redundant Budibase API discovery by remembering entity locations, schemas, and workflow patterns across conversations. Instead of discovering app -> table -> record -> schema on every request, Claude reads from per-app knowledge files first and goes straight to the target.

**Before:** "Add a comment on Elicit" -> discover_apps -> get_tables -> query_records -> get_table_schema -> update_record (5 tool calls)
**After:** Claude reads knowledge file -> update_record (1 tool call + 1 file read)

## Why Per-App Files

- **Scale:** 3-10 apps, 15-50 tables — single file would grow unwieldy
- **Locality:** Most tasks target one app. Read one file, not everything
- **Maintainability:** Can delete/rebuild knowledge for one app without touching others
- **Index file** (`_index.yaml`) maps app names/aliases to files for fast routing

## Architecture

```
knowledge/
  _index.yaml          # App name -> file mapping + aliases + ambiguity
  crm.yaml             # Entities, schemas, workflows for CRM
  billing.yaml         # Same structure per app
  ...
```

### Index file (`_index.yaml`)

```yaml
apps:
  CRM:
    file: crm.yaml
    appId: app_abc123
    aliases: [crm, client management]
  Billing:
    file: billing.yaml
    appId: app_def456
    aliases: [billing, invoices]

ambiguous:
  Elicit:
    found_in: [crm, billing]
    default: crm              # user chose this once, remembered
```

### Per-app file (e.g., `crm.yaml`)

```yaml
app:
  name: CRM
  appId: app_abc123

entities:
  Elicit:
    table: Clients
    tableId: ta_xyz789
    rowId: ro_def456
    matchField: Name
    matchValue: Elicit
    _lastSeen: 2026-02-03
  Acme Corp:
    table: Clients
    tableId: ta_xyz789
    rowId: ro_ghi012
    matchField: Name
    matchValue: Acme Corp
    _lastSeen: 2026-02-03

schemas:
  Clients:
    tableId: ta_xyz789
    fields:
      Name: { type: string, primary: true }
      Notes: { type: longform }
      Status: { type: options, values: [Active, Inactive, Lead] }
      Projects: { type: link, target: Projects, display: Name }
  Projects:
    tableId: ta_abc345
    fields:
      Name: { type: string, primary: true }
      Client: { type: link, target: Clients, display: Name }
      Status: { type: options }

workflows:
  add_comment:
    trigger: "add comment/note on [entity]"
    steps: "resolve entity -> update_record, append to Notes field"
    field: Notes
  change_status:
    trigger: "mark [entity] as [status]"
    steps: "resolve entity -> update_record on Status field"
    field: Status
  link_project:
    trigger: "link/associate [entity] to [project]"
    steps: "resolve both entities -> update_record with link field"
    field: Projects
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Persistence | Across conversations | Avoid re-discovering stable data every session |
| Storage | Per-app YAML files | Scales with 3-10 apps, read one file per task |
| Format | YAML | Less tokens than JSON, human-editable, Claude writes it reliably |
| Population | Claude writes files directly | No MCP tool needed, uses Claude's file-write ability |
| Knowledge types | Entities + schemas + workflows | Full coverage of repeated discovery patterns |
| Update trigger | Auto after discovery | No manual "save" needed, knowledge grows organically |
| Staleness | Trust until failure, then self-heal | No TTL expiry — failure-driven invalidation is cheaper |
| Entity resolution | rowId first, matchField fallback | Speed on happy path, resilience on sad path |
| Ambiguity | Context-first, then ask, remember choice | Stored in `_index.yaml` as default |
| Multi-user | Single shared knowledge folder | MCP is single-client; knowledge is objective facts |
| Pruning | Self-healing + manual rebuild command | No automated cleanup — stale-but-unused costs nothing |
| File size | ~5KB cap per app file | Only store frequently-used entities + primary schema fields |
| Bootstrap | Scaffold on first use (apps + tables), learn entities incrementally | 1 discover_apps + N get_tables — done once |

## Flow: How It Works

### Bootstrap (first use)

Triggered when `knowledge/_index.yaml` doesn't exist, or user says "learn my Budibase setup":

1. Call `discover_apps` → populate `_index.yaml` with all apps + IDs
2. For each app, call `get_tables` → populate table names + IDs in each app file
3. Don't fetch records or full schemas — those build up incrementally

**Cost:** 1 + N API calls (N = number of apps). Done once.

### Read path (start of any Budibase task)

1. Claude reads `knowledge/_index.yaml`
2. Matches user's intent to an app (by name, alias, or entity lookup)
3. Reads that app's knowledge file
4. Uses known entity paths, schemas, workflow patterns to skip discovery
5. Falls back to normal discovery only for unknown entities/tables

### Write path (after task completion)

1. Claude checks: did I discover anything new? (new entity, new schema, new workflow)
2. If yes, reads current knowledge file, merges new knowledge, writes full file back
3. If a new app was encountered, adds it to `_index.yaml`

### Entity resolution order

1. Try `rowId` directly → 0 discovery calls
2. If 404 → query by `matchField` = `matchValue` → 1 call
3. If still not found → entity was deleted, remove from knowledge file
4. If entity unknown → normal discovery, then save to knowledge

### Staleness & self-healing

- No TTL, no proactive re-verification
- If a tool call fails (404, schema mismatch, app not found):
  1. Re-discover via normal MCP tools
  2. Overwrite stale entry in knowledge file
  3. Continue with corrected data
- `_lastSeen` dates are informational for humans, not used for expiry

### Ambiguity resolution

1. If user mentions the app explicitly → use that
2. If only one app has the entity → no ambiguity
3. If multiple apps → ask user, store choice as `default` in `_index.yaml`

## Skill Modification

Add **Phase 0: Knowledge Check** and **Phase 4: Knowledge Update** to the existing Discover -> Route -> Execute -> Report flow:

```
Phase 0: Knowledge Check
  1. Read knowledge/_index.yaml (if exists)
  2. If target app found → read app knowledge file
  3. Build context: known entities, schemas, workflow shortcuts
  4. Skip discovery tools for known paths
  5. If _index.yaml missing → run bootstrap

Existing phases: Discover → Route → Execute → Report

Phase 4: Knowledge Update
  1. After execution, check: was anything new discovered?
  2. If yes → read current knowledge file, merge, write back
  3. If new app → add to _index.yaml
  4. If entity failed → remove stale entry
```

## Token Budget

| Component | Size | Tokens (est.) |
|-----------|------|---------------|
| Existing skill + references | ~23 KB | ~6,000-8,000 |
| _index.yaml | ~1 KB | ~300 |
| Per-app file (read 1 per task) | ~3-5 KB | ~1,000-1,500 |
| **Total per conversation** | ~27-29 KB | ~7,500-10,000 |

Well within safe threshold (~50-100KB). Only 1 app file read per task, not all.

## What's NOT in Scope

- No changes to the MCP server's runtime cache (NodeCache stays as-is)
- No real-time sync between Budibase and knowledge files
- No UI for managing knowledge — YAML files, edit directly if needed
- No multi-user namespacing — single shared knowledge folder
- No automated pruning schedules — self-healing + manual rebuild only
