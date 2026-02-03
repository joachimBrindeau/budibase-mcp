# Records Domain

Single and batch CRUD operations on table rows.

## Which Tool?

```
How many records?
├── 1 record
│   ├── Read    → get_row
│   ├── Create  → create_record
│   ├── Update  → update_record
│   └── Delete  → delete_record
├── Known list of records
│   ├── Create  → batch_create_records
│   ├── Update  → batch_update_records
│   ├── Delete  → batch_delete_records
│   └── Mixed   → batch_upsert_records
└── "All records where..."
    └── Update/Delete → bulk_query_and_process
```

## Single Record Tools

### get_row
Read a single record by ID.
```json
{ "appId": "app_xxx", "tableId": "ta_xxx", "rowId": "ro_xxx" }
```

### create_record
Create a new record. Safe — no confirmation needed.
```json
{ "appId": "app_xxx", "tableId": "ta_xxx", "data": { "name": "Acme", "status": "active" } }
```
Returns created record with `_id`.

### update_record
Update an existing record. **Confirm required.**
```json
{ "appId": "app_xxx", "tableId": "ta_xxx", "recordId": "ro_xxx", "data": { "status": "inactive" } }
```
Partial updates — only pass changed fields.

### delete_record
Delete a record permanently. **Confirm required.**
```json
{ "appId": "app_xxx", "tableId": "ta_xxx", "recordId": "ro_xxx" }
```

## Batch Tools

All batch tools share these options:

| Parameter | Default | Max | Description |
|-----------|---------|-----|-------------|
| `batchSize` | 10 | 50 | Records per API call |
| `continueOnError` | true | — | Skip failures, keep going |

### batch_create_records
Create multiple records. Safe.
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "records": [{ "name": "A" }, { "name": "B" }],
  "batchSize": 10, "continueOnError": true
}
```

### batch_update_records
Update multiple records. **Confirm required.**
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "records": [
    { "id": "ro_xxx", "data": { "status": "done" } },
    { "id": "ro_yyy", "data": { "status": "done" } }
  ]
}
```

### batch_delete_records
Delete multiple records. **Confirm required.**
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "recordIds": ["ro_xxx", "ro_yyy", "ro_zzz"]
}
```

### batch_upsert_records
Create or update based on `_id` presence. **Confirm required** (may update).
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "records": [
    { "name": "New Record" },
    { "_id": "ro_xxx", "name": "Updated Record" }
  ]
}
```
Records with `_id` → update. Without `_id` → create.

### bulk_query_and_process
Query records then apply bulk update or delete. **Confirm required.**
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "query": { "equal": { "status": "archived" } },
  "operation": "delete"
}
```
For bulk update, add `updateData`:
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "query": { "equal": { "region": "EU" } },
  "operation": "update",
  "updateData": { "gdprCompliant": true }
}
```

## Linking Records

Link fields accept arrays of row IDs:
```json
{
  "appId": "app_xxx", "tableId": "ta_xxx",
  "data": {
    "name": "Order #123",
    "customer": ["ro_customerXxx"],
    "products": ["ro_prod1", "ro_prod2"]
  }
}
```
