# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build          # TypeScript compile (tsc) to dist/
npm run dev            # Watch mode with tsx
npm run start          # Run production server (node dist/index.js)
npm run test           # Run test suite (node tests/suite.js)
npm run lint           # Biome linter check
npm run lint:fix       # Auto-fix linting issues
npm run format         # Format code with Biome
npm run check          # Full check: typecheck + lint + knip + jscpd + gitleaks
```

## Architecture

MCP server for Budibase (low-code platform) using stdio transport. Single client, no auth layer — the API key in `.env` determines access.

```
src/index.ts          → Entry point, graceful shutdown
src/server.ts         → MCP Server: registers tool/resource handlers
src/config/index.ts   → Zod-validated config from .env
src/clients/budibase.ts → Single API client (axios + retry + cache)
src/tools/            → Tool modules, each exports MCPTool[]
src/tools/index.ts    → Aggregates all tool arrays into one flat list
src/resources/index.ts → MCP resources (status, capabilities, summaries)
src/types/            → BudibaseRecord, BudibaseTable, MCPTool, etc.
src/utils/            → Logger (winston), errors, validation (zod), batch ops
```

### How tools work

Each file in `src/tools/` exports an `MCPTool[]` array. Tools have `name`, `description`, `inputSchema` (JSON Schema), and an `execute(args, client)` function. All tools receive the shared `BudibaseClient` instance. Registration is in `src/tools/index.ts` — just spread into the array.

### BudibaseClient key behaviors

- **ID resolution**: `resolveAppId()` and `resolveTableId()` accept names or IDs interchangeably. App IDs get dev→prod conversion (`_dev_` → `_`).
- **Linked field normalization**: `normalizeLinkedFields()` converts full nested records (from GET /rows/:id) to `{_id, primaryDisplay}` format (matching POST /rows/search output). Called in `getRecord`, `createRecord`, `updateRecord`.
- **Caching**: `NodeCache` with configurable TTL (default 300s) for apps, tables, users. Cache keys: `applications`, `tables:{appId}`, `table:{appId}:{tableId}`, `users`.
- **Retry**: `axios-retry` with exponential backoff on 429/5xx/network errors.

### Batch operations

`src/utils/batchOperations.ts` provides `BatchOperationManager` with `batchCreate`, `batchUpdate`, `batchDelete`, `batchUpsert`. Uses `p-map` for concurrent processing (default concurrency 3, max batch size 50). `batchUpsert` falls back to create only on 404.

### Error hierarchy

- `BudibaseError` — API errors with status codes and user-friendly recovery hints
- `MCPError` — Protocol-level errors (INVALID_REQUEST, METHOD_NOT_FOUND, INVALID_PARAMS)
- `ValidationError` — Zod schema validation failures

Errors in tool execution are caught by `server.ts` and returned as `{ success: false, error, message }` with `isError: true` — they don't crash the server.

## Code style

- **Formatter/Linter**: Biome — single quotes, trailing commas, semicolons, 2-space indent, 120 char width
- **Git hooks**: lefthook — pre-commit runs biome check + typecheck + gitleaks; pre-push adds knip + jscpd
- **Validation**: All tool inputs validated with Zod schemas before execution
- **Logging**: Winston logger — never use `console.log`

## Skill

The `/budibase` skill in `.claude/skills/budibase/SKILL.md` defines the agent workflow for using this MCP server's tools. It follows **Discover → Route → Execute → Report** with an intent router table mapping user phrases to tools. Reference docs for each domain (records, queries, apps, analytics) live in `.claude/skills/budibase/references/`. The skill enforces a safety protocol: reads/creates execute immediately, updates/deletes require user confirmation with preview.
