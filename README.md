# Budibase MCP Server

MCP server for Budibase. Manage apps, tables, records, queries, and bulk operations through the Model Context Protocol.

## Prerequisites

- Node.js >= 18
- Budibase instance with API access
- Budibase API key

## Install

```bash
git clone https://github.com/joachimBrindeau/budibase-mcp.git
cd budibase-mcp
npm install
cp .env.example .env
# Edit .env with your credentials
npm run build
```

## Configuration

```env
BUDIBASE_URL=https://your-budibase-instance.com
BUDIBASE_API_KEY=your-api-key-here

# Optional
LOG_LEVEL=info
CACHE_TTL=300
MAX_RETRIES=3
REQUEST_TIMEOUT=30000
```

## Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "budibase": {
      "command": "node",
      "args": ["/path/to/budibase-mcp/dist/index.js"],
      "env": {
        "BUDIBASE_URL": "https://your-instance.com",
        "BUDIBASE_API_KEY": "your-key"
      }
    }
  }
}
```

## Tools

### Apps
| Tool | Description |
|------|-------------|
| `check_connection` | Verify API connectivity |
| `discover_apps` | List apps with table structure |
| `list_applications` | List all apps |
| `get_application` | Get app details |
| `create_application` | Create app |
| `update_application` | Update app |
| `publish_application` | Publish to production |
| `unpublish_application` | Remove from production |
| `delete_application` | Delete app |

### Tables
| Tool | Description |
|------|-------------|
| `list_tables` | List tables in an app |
| `get_table_schema` | Get field definitions |
| `create_table` | Create table |
| `update_table` | Modify table schema |
| `delete_table` | Delete table |

### Records
| Tool | Description |
|------|-------------|
| `query_records` | Filter and search records |
| `get_row` | Get single record |
| `create_record` | Create record |
| `update_record` | Update record |
| `delete_record` | Delete record |

### Batch Operations
| Tool | Description |
|------|-------------|
| `batch_create_records` | Create multiple records |
| `batch_update_records` | Update multiple records |
| `batch_delete_records` | Delete multiple records |
| `batch_upsert_records` | Create or update records |
| `bulk_query_and_process` | Query then update/delete in bulk |

### Queries
| Tool | Description |
|------|-------------|
| `simple_query` | One-liner string format queries |
| `advanced_query` | Multi-condition queries |
| `fluent_query` | Programmatic query building |
| `search_queries` | Discover saved queries |
| `execute_query` | Run saved queries |

### Analytics
| Tool | Description |
|------|-------------|
| `transform_records` | Apply transformations to records |
| `aggregate_data` | Sum, avg, count with groupBy |
| `convert_data_format` | Convert between JSON, CSV, table |

### Users
| Tool | Description |
|------|-------------|
| `list_users` | List all users |
| `get_user` | Get user details |
| `create_user` | Create user |
| `update_user` | Update user |
| `delete_user` | Delete user |

## Table Name Resolution

Pass table names or IDs interchangeably:

```json
{ "tableId": "Customers" }
{ "tableId": "ta_abc123" }
```

## Development

```bash
npm run dev          # Watch mode
npm run lint         # Biome check
npm run lint:fix     # Biome auto-fix
npm run format       # Biome format
npm run knip         # Unused code detection
npm run jscpd        # Copy-paste detection
npm run gitleaks     # Secret scanning
npm run check        # Run all checks
```

Git hooks (via Lefthook):
- **pre-commit**: biome check, gitleaks, typecheck
- **pre-push**: knip, jscpd, biome, gitleaks

## License

MIT
