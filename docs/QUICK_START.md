# Quick Implementation Guide

## Step 1: Install Dependencies

```bash
cd /Users/joachim/Documents/MCP/budibase-mcp-server
npm install sqlite3 sqlite
```

## Step 2: Update Your Code

### Option A: Automatic Migration (Recommended)

```bash
node migrate-schema-registry.js
```

This will:
- Update server.ts to use EnhancedBudibaseClient
- Add schema tools to the tools index
- Create data directory
- Update .gitignore
- Create initialization script

### Option B: Manual Integration

1. Update `src/server.ts`:
```typescript
// Replace:
import { BudibaseClient } from './clients/budibase';
// With:
import { EnhancedBudibaseClient } from './storage/enhanced-client';

// Replace:
private budibaseClient: BudibaseClient;
// With:
private budibaseClient: EnhancedBudibaseClient;

// Replace:
this.budibaseClient = new BudibaseClient();
// With:
this.budibaseClient = new EnhancedBudibaseClient();
```

2. Update `src/tools/index.ts`:
```typescript
import { schemaTools } from './schema';

export const tools = [
  ...applicationTools,
  ...databaseTools,
  ...userTools,
  ...queryTools,
  ...batchTools,
  ...dataTransformTools,
  ...schemaTools  // Add this
];
```

## Step 3: Build and Initialize

```bash
# Build the project
npm run build

# Initialize schema registry
node init-schema-registry.js
```

## Step 4: Start Using

```bash
# Start the server
npm start
```

## Example Usage in Claude Desktop

Once running, you can use the new tools:

```
1. Sync an application:
   "Sync the schema for my Inventory Management app"

2. Validate queries:
   "Check if this query is valid for the products table"

3. Natural language queries:
   "Help me find all active products created this month"

4. View schema history:
   "Show me the schema changes for the orders table"
```

## Configuration Options

Add to `.env`:

```env
# Schema Registry Settings (optional)
SCHEMA_DB_PATH=./data/schema-registry.db
SCHEMA_SYNC_INTERVAL=3600000  # 1 hour in ms
SCHEMA_CACHE_TTL=300  # 5 minutes in seconds
```

## Troubleshooting

### Issue: SQLite errors
```bash
# Reinstall with build tools
npm install --build-from-source sqlite3
```

### Issue: Permission errors
```bash
# Ensure data directory is writable
chmod 755 ./data
```

### Issue: Schema not syncing
```bash
# Force sync all applications
node init-schema-registry.js --force
```

## Next Steps

1. Monitor schema changes
2. Set up auto-sync intervals
3. Use natural language queries
4. Track query performance
5. Export schema documentation

## Support

For issues or questions:
1. Check logs in `./logs/`
2. Review `SCHEMA_REGISTRY.md`
3. See examples in `./examples/`
