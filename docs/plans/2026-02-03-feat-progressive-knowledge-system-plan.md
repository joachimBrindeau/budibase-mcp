---
title: "feat: Progressive Knowledge System"
type: feat
date: 2026-02-03
brainstorm: docs/brainstorms/2026-02-03-progressive-knowledge-brainstorm.md
---

# Progressive Knowledge System

## Overview

Add persistent per-app YAML knowledge files that Claude reads before Budibase tool calls and writes after discovering new data. Eliminates redundant `discover_apps` / `get_tables` / `query_records` / `get_table_schema` calls across conversations.

**Before:** "Add a comment on Elicit" → 5 tool calls (discover → tables → query → schema → update)
**After:** Claude reads 1 knowledge file → 1 tool call (`update_record`)

## Problem Statement

Every conversation starts cold. The skill's Phase 1 (Discover) calls `discover_apps(includeTables: true)` to learn structure, then additional calls to resolve entities and schemas. For a medium Budibase instance (5-10 apps, 15-50 tables), this burns 3-5 unnecessary API calls and ~2,000+ tokens of tool output per conversation on data that rarely changes.

## Proposed Solution

A `knowledge/` folder inside the skill directory (`.claude/skills/budibase/knowledge/`) with:

- `_index.yaml` — app name → folder routing, table lists, aliases, ambiguity defaults
- `{app-slug}/` — one folder per app
- `{app-slug}/{table-name}.yaml` — one file per table with schema, entities, workflows

Claude reads these files via the Read tool before any Budibase tool call (Phase 0), and writes updates via the Write tool after discovering new data (Phase 5). The SKILL.md is updated to enforce this flow.

No MCP server code changes. No new tools. Claude uses its existing Read/Write file abilities.

## Technical Approach

### File Location

```
.claude/skills/budibase/
  SKILL.md                    # Modified: add Phase 0 + Phase 5
  knowledge/                  # NEW: persistent knowledge
    _index.yaml               # App router + table lists
    {app-slug}/               # One folder per app
      {table-name}.yaml       # One file per table
  references/                 # Unchanged
    records.md
    analytics.md
    queries.md
    apps.md
```

**Why inside the skill?** Knowledge is consumed by the skill, not the MCP server runtime. Follows MECE — skill concern stays with skill.

**Gitignored.** Knowledge files contain instance-specific IDs. `.gitignore` excludes `*.yaml` files and app subdirectories, but keeps `.gitkeep`.

### YAML Schemas

#### `_index.yaml`

```yaml
bootstrapped: "2026-02-03"

apps:
  klarc:
    folder: klarc
    appId: app_abc123
    aliases: []
    tables:
      - comptes
      - contacts
      - dossiers

defaults:                                        # Ambiguity resolution memory
  Contacts: klarc                                # "Contacts" → always klarc unless overridden
```

**Slugification rule:** `name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')`

#### Per-table file (e.g., `klarc/comptes.yaml`)

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

### Skill Workflow Modification

Current: `Discover → Route → Execute → Report`
New: `Knowledge → Route → Execute → Report → Learn`

#### Phase 0: Knowledge (replaces Phase 1: Discover for known paths)

```
1. Read .claude/skills/budibase/knowledge/_index.yaml
   - If missing → run Bootstrap (see below), then continue
   - If budibase_url != current BUDIBASE_URL → delete all knowledge, run Bootstrap
2. Match user intent to an app:
   - By explicit app name → direct lookup in _index.yaml
   - By entity name → scan table files in app folder for entity match
   - By alias → check aliases in _index.yaml
   - By table name → check tables list in _index.yaml
3. Read the matched table file: knowledge/{app-folder}/{table-name}.yaml
4. Use known IDs: appId, tableId, rowId, schema, workflows
5. Only call discovery tools for unknown paths
```

#### Phase 1-4: Route → Execute → Report (unchanged)

Same as current SKILL.md. Intent router, domain references, safety protocol.

#### Phase 5: Learn (new, after Report)

```
Only write knowledge when structural data was discovered:

| Trigger | What to write | Target |
|---------|--------------|--------|
| discover_apps called | All apps + tables | _index.yaml + create table YAML files |
| get_table_schema called | Schema for that table | {app}/{table}.yaml (schema section) |
| Entity resolved by query | rowId + matchField | {app}/{table}.yaml (entities section) |
| Workflow pattern emerged | trigger + steps + field | {app}/{table}.yaml (workflows section) |
| Table/app created | New entry | _index.yaml + new table YAML file |
| Table/app deleted | Remove entry | _index.yaml + delete table YAML file |

NOT triggered by: query_records, get_row, aggregate_data, transform_records, batch ops.
These return record data, not structural data.
```

### Bootstrap Flow

Triggered when `_index.yaml` doesn't exist, or user says "rebuild knowledge" / "forget everything":

```
1. Call discover_apps(includeTables: true)       → 1 API call
2. Write _index.yaml with all apps, folder slugs, table lists
3. Create per-app folder: knowledge/{app-slug}/
4. Write per-table YAML files with table section (name + tableId + primaryDisplay)
5. schema, entities, workflows sections start empty → filled incrementally
```

**Cost:** 1 API call. Done once per Budibase instance.

### Entity Resolution Order

When Claude needs to operate on a named entity (e.g., "Elicit"):

```
1. Check knowledge file entities section
   ├── Found → use rowId directly (0 API calls)
   │           ├── Tool succeeds → done
   │           └── 404 → go to step 2
   └── Not found → go to step 2

2. Query by matchField (primaryDisplay of the table)
   → query_records with filter: { equal: { [primaryDisplay]: "Elicit" } }
   ├── 1 result → use it, save to knowledge entities section
   ├── 0 results → remove stale entry if existed, report "not found"
   └── N results → present options, save chosen one
```

### Self-Healing Error Map

| Error | Cause | Action |
|-------|-------|--------|
| 404 on tableId | Table deleted/renamed | Re-discover app tables, update knowledge |
| 404 on rowId | Record deleted | Remove entity entry, query by matchField |
| 400 "field X does not exist" | Schema changed | Re-fetch `get_table_schema`, update knowledge |
| 404 on appId | App deleted | Remove from `_index.yaml` + delete app folder |
| 401 / 403 | Auth problem | Pass through to user. Never re-discover |
| 429 | Rate limited | Pass through. Retry handled by axios-retry |
| 5xx | Server error | Pass through. Never re-discover |
| YAML parse error | Corrupted file | Delete the file, re-bootstrap that app |

### Ambiguity Resolution

When an entity or table name exists in multiple apps:

```
1. User mentions app explicitly ("in CRM") → use that app
2. Check _index.yaml defaults section → use stored preference
3. Only one app has it → no ambiguity
4. Multiple apps, no default → ask user, store choice in defaults section
```

Override: user says "I mean the Billing one" → update defaults.

## Acceptance Criteria

- [x] `knowledge/` folder created at `.claude/skills/budibase/knowledge/`
- [x] `.gitignore` updated to exclude knowledge folder
- [x] SKILL.md rewritten with Phase 0 (Knowledge) and Phase 5 (Learn)
- [x] Bootstrap populates `_index.yaml` + per-app files from `discover_apps`
- [x] Known entities resolve without API calls (rowId fast path)
- [x] Unknown entities fall through to live discovery, then get saved
- [x] Self-healing: stale knowledge auto-corrects on tool failure
- [x] Ambiguity defaults remembered across conversations
- [x] Instance fingerprint (`budibase_url`) prevents cross-instance contamination
- [x] "Rebuild knowledge" / "forget [app]" triggers work

## Implementation Phases

### Phase 1: Foundation

Create the knowledge file structure and gitignore entry.

**Files to create:**
- `.claude/skills/budibase/knowledge/.gitkeep` (empty, ensures folder exists in git)

**Files to modify:**
- [.gitignore](.gitignore) — add `.claude/skills/budibase/knowledge/*.yaml` and `.claude/skills/budibase/knowledge/*/`

### Phase 2: SKILL.md Rewrite

Rewrite [SKILL.md](.claude/skills/budibase/SKILL.md) to integrate knowledge phases:

- Replace Phase 1 (Discover) with Phase 0 (Knowledge) that reads knowledge files first
- Add Phase 5 (Learn) after Report
- Add Bootstrap section
- Add Entity Resolution section
- Add Self-Healing Error Map
- Add Ambiguity Resolution section
- Keep Intent Router, Domains, Safety Protocol, Workflow Recipes, ID Formats, Relationships, Error Handling unchanged
- Add "Knowledge Management" section with rebuild/forget triggers

### Phase 3: Validation

- Test bootstrap flow: delete knowledge folder, invoke `/budibase`, verify files created
- Test read path: with knowledge populated, verify Claude skips `discover_apps`
- Test write path: look up a new entity, verify it appears in knowledge file
- Test self-healing: manually corrupt a rowId, verify Claude recovers
- Test ambiguity: reference a table that exists in two apps, verify prompt + memory

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Claude inconsistently writes YAML | Define exact schema in SKILL.md with examples. Claude follows instructions reliably when given a template |
| Knowledge files grow beyond 3KB | Soft cap enforced by SKILL.md instructions: keep ~20 entities per table, primary fields only in schemas |
| Instance change not detected | Compare `budibase_url` from environment against `_index.yaml` — mismatch triggers full rebuild |
| Concurrent Claude sessions overwrite | Last-write-wins. Single user, acceptable trade-off |

## What's NOT in Scope

- No MCP server code changes (no new tools, no resource changes)
- No NodeCache modifications (runtime cache stays independent)
- No real-time Budibase sync
- No multi-user namespacing
- No automated pruning schedules
- No UI for knowledge management

## References

- Brainstorm: [2026-02-03-progressive-knowledge-brainstorm.md](../brainstorms/2026-02-03-progressive-knowledge-brainstorm.md)
- Current skill: [SKILL.md](../../.claude/skills/budibase/SKILL.md)
- BudibaseClient caching: [budibase.ts:19-23](../../src/clients/budibase.ts#L19-L23)
- ID resolution: [budibase.ts:168-220](../../src/clients/budibase.ts#L168-L220)
- Tool registration: [tools/index.ts](../../src/tools/index.ts)
