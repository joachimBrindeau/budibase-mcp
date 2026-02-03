# Apps Domain

Application management, table structure, users, and lifecycle.

## Which Tool?

```
What do you need?
├── Explore environment
│   ├── First time / overview  → discover_apps (includeTables: true)
│   ├── Just app list          → list_applications
│   ├── One app's details      → get_application
│   └── Connection ok?         → check_connection
├── Table structure
│   ├── List tables            → list_tables
│   ├── Field details          → get_table_schema
│   ├── Create table           → create_table
│   ├── Add/modify columns     → update_table ⚠️
│   └── Drop table             → delete_table ⚠️
├── App lifecycle
│   ├── Create app             → create_application
│   ├── Publish to prod        → publish_application ⚠️
│   ├── Pull from prod         → unpublish_application ⚠️
│   └── Delete app             → delete_application ⚠️
└── Users
    ├── List all               → list_users
    ├── One user               → get_user
    ├── Add user               → create_user
    ├── Modify user            → update_user ⚠️
    └── Remove user            → delete_user ⚠️
```

## Discovery

### check_connection
Verify MCP server can reach Budibase API. No parameters.

### discover_apps
Full environment discovery — apps with table structure.
```json
{ "includeTables": true }
```
Returns: apps with `id`, `name`, `status`, `tables[]` (each with `id`, `name`, `fields[]`).

### list_applications
Lightweight app listing without table details. No parameters.

### get_application
Single app details.
```json
{ "appId": "app_xxx" }
```

## Table Management

### list_tables
List all tables in an app.
```json
{ "appId": "app_xxx" }
```

### get_table_schema
Get field definitions, types, and relationships for a specific table. Both `appId` and `tableId` are required.
```json
{ "appId": "app_xxx", "tableId": "ta_xxx" }
```
Use `list_tables` to find table IDs first. Accepts table name or ID.

Returns field types: `string`, `number`, `boolean`, `datetime`, `attachment`, `link`, `formula`, `auto`, `json`.

### create_table
Create a new table. Safe.
```json
{
  "appId": "app_xxx",
  "name": "Customers",
  "schema": {
    "name": { "type": "string", "constraints": { "presence": true } },
    "email": { "type": "string" },
    "age": { "type": "number" },
    "active": { "type": "boolean" }
  },
  "primaryDisplay": "name"
}
```

### update_table
Modify table schema. **Confirm required.**
```json
{
  "appId": "app_xxx",
  "tableId": "ta_xxx",
  "name": "New Table Name",
  "schema": { "newField": { "type": "string" } },
  "primaryDisplay": "newField"
}
```

### delete_table
Delete entire table and all its data. **Confirm required.**
```json
{ "appId": "app_xxx", "tableId": "ta_xxx" }
```

## Application CRUD

### create_application
Create a new app. Safe.
```json
{ "name": "My App", "url": "/my-app", "template": "optional-template" }
```

### update_application
Modify app settings. **Confirm required.**
```json
{ "appId": "app_xxx", "name": "New Name", "url": "/new-url" }
```

### delete_application
Delete entire application. **Confirm required.**
```json
{ "appId": "app_xxx" }
```

## Lifecycle

### publish_application
Push app to production. **Confirm required.**
```json
{ "appId": "app_xxx" }
```

### unpublish_application
Remove from production. **Confirm required.**
```json
{ "appId": "app_xxx" }
```

## User Management

### list_users
List all Budibase users. No parameters.

### get_user
Get user details.
```json
{ "userId": "us_xxx" }
```

### create_user
Create new user. Safe.
```json
{
  "email": "user@example.com",
  "password": "min8chars",
  "firstName": "Jane",
  "lastName": "Doe",
  "roles": { "app_xxx": "ADMIN" }
}
```

### update_user
Modify user. **Confirm required.**
```json
{
  "userId": "us_xxx",
  "email": "new@example.com",
  "status": "active",
  "roles": { "app_xxx": "POWER" }
}
```
Status options: `active`, `inactive`.

### delete_user
Delete user permanently. **Confirm required.**
```json
{ "userId": "us_xxx" }
```

## Table Name Resolution

The MCP server auto-resolves table names to IDs. You can pass either:
- Table ID: `"ta_abc123"`
- Table name: `"Customers"`
