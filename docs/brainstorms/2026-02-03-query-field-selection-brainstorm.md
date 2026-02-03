---
date: 2026-02-03
topic: query-field-selection
---

# Query Field Selection & Auto-Pagination

## What We're Building

Add **field selection** and **auto-pagination** to the `query_records` tool. Currently, every search returns all columns for every row, wasting tokens when agents only need a few fields. Additionally, agents must manually loop with bookmark tokens to fetch all rows.

After this change: one `query_records` call can return all matching rows with only the columns the agent needs.

## Why This Approach

- Budibase API does not support server-side field selection — column filtering must happen client-side
- Filtering at the tool level (not client level) keeps the change minimal and backwards compatible
- Auto-pagination eliminates repetitive bookmark-looping tool calls, saving tokens and reducing latency
- 5,000 row cap prevents runaway fetches on large tables

## Key Decisions

- **Field filtering in tool execute, not client**: The API returns full rows regardless. Stripping happens in `database.ts` after the API call. `BudibaseClient` stays untouched.
- **`_id` always included**: Agents need row IDs for subsequent operations (update, delete, get). No need to specify it in `fields`.
- **`fetchAll` with 5,000 row cap**: Pages internally at 1000/page (API max). Returns `truncated: true` when hitting the cap so the agent knows to narrow filters.
- **Backwards compatible**: Both `fields` and `fetchAll` are optional. Omitting them gives today's behavior.

## Tool Schema Changes

```
query_records:
  existing params: appId, tableId, query, sort, limit, bookmark
  new params:
    fields: string[]    # optional — columns to return (+ _id always)
    fetchAll: boolean   # optional, default false — auto-paginate all pages
```

### Response when `fetchAll: true`

```json
{
  "success": true,
  "data": {
    "rows": [...],
    "totalRows": 3472,
    "truncated": false
  }
}
```

### Response when `fetchAll: true` and exceeds cap

```json
{
  "success": true,
  "data": {
    "rows": [...],
    "totalRows": 5000,
    "truncated": true
  }
}
```

## Skill Changes

Update SKILL.md to instruct agents:
- Always specify `fields` based on table schema in knowledge files
- Use `fetchAll: true` for complete data needs (analytics, exports, bulk ops)
- Use default pagination for browsing/previewing

## Open Questions

- Should `aggregate_data` and `transform_records` also get `fields` support? (Deferred — they already reduce output via aggregation/transformation)
- Should `bulk_query_and_process` benefit from `fields`? (Likely yes in a follow-up)

## Next Steps

→ `/workflows:plan` for implementation details
