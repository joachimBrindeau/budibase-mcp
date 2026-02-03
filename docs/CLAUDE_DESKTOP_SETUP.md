# Claude Desktop Integration Setup

This guide explains how to integrate the Budibase MCP Server with Claude Desktop to access all 36 tools.

## Prerequisites

1. **Claude Desktop installed** (version 0.4.0 or later)
2. **Node.js 18+** installed
3. **Budibase instance** with API access
4. **Built MCP server** (`npm run build` completed)

## Step 1: Build the MCP Server

```bash
cd /Users/joachim/Documents/MCP/budibase-mcp-server
npm install
npm run build
```

## Step 2: Configure Environment Variables

Create or update your `.env` file:

```bash
# Required Budibase Configuration
BUDIBASE_URL=https://your-budibase-instance.com
BUDIBASE_API_KEY=your_api_key_here

# Optional Configuration
LOG_LEVEL=info
NODE_ENV=production
```

## Step 3: Locate Claude Desktop Config

Find your Claude Desktop configuration file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

## Step 4: Add MCP Server Configuration

Add the Budibase MCP server to your Claude Desktop config:

```json
{
  "mcpServers": {
    "budibase": {
      "command": "node",
      "args": ["/Users/joachim/Documents/MCP/budibase-mcp-server/dist/index.js"],
      "env": {
        "BUDIBASE_URL": "https://your-budibase-instance.com",
        "BUDIBASE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

**Important**: 
- Replace the path with your actual installation path
- Replace `BUDIBASE_URL` with your Budibase instance URL
- Replace `BUDIBASE_API_KEY` with your actual API key

## Step 5: Restart Claude Desktop

1. Completely quit Claude Desktop
2. Restart Claude Desktop
3. Wait for the MCP server to initialize

## Step 6: Verify Connection

In Claude Desktop, try using a simple tool:

```
Can you list my Budibase applications?
```

Claude should respond using the `list_applications` tool.

## Available Tools (36 total)

### Application Management (8 tools)
- `discover_apps` - Explore applications with detailed structure
- `list_applications` - List all applications
- `get_application` - Get application details
- `create_application` - Create new application
- `update_application` - Update application
- `delete_application` - Delete application
- `publish_application` - Publish to production
- `unpublish_application` - Unpublish from production

### Table Management (5 tools)
- `list_tables` - List tables in an application
- `get_table_schema` - Get table structure and fields
- `create_table` - Create new table
- `update_table` - Update table schema
- `delete_table` - Delete table

### Record Operations (6 tools)
- `get_row` - Get single record
- `query_records` - Query with filtering and sorting
- `create_record` - Create new record
- `update_record` - Update existing record
- `delete_record` - Delete record

### User Management (5 tools)
- `list_users` - List all users
- `get_user` - Get user details
- `create_user` - Create new user
- `update_user` - Update user
- `delete_user` - Delete user

### Query Management (2 tools)
- `search_queries` - Find saved queries
- `execute_query` - Run saved query

### Advanced Query Builder (3 tools)
- `advanced_query` - Complex multi-condition queries
- `simple_query` - Simple string-based queries
- `fluent_query` - Fluent interface query building

### Batch Operations (5 tools)
- `batch_create_records` - Bulk record creation
- `batch_update_records` - Bulk record updates
- `batch_delete_records` - Bulk record deletion
- `batch_upsert_records` - Bulk create or update
- `bulk_query_and_process` - Query and bulk process

### Data Transformation (3 tools)
- `transform_records` - Transform and clean data
- `convert_data_format` - Convert between formats (JSON, CSV, etc.)
- `aggregate_data` - Perform aggregations (sum, count, group by)

## Example Usage Patterns

### Basic Operations
```
"Show me all applications"
"Create a new table called 'customers' in app 'my-app'"
"Add a new customer record with name 'John Doe'"
"Query all active customers"
```

### Advanced Operations
```
"Query customers where salary > 50000 and department = 'Engineering', limit 10"
"Create 100 test records in batches of 25"
"Transform all customer records to uppercase names and format phone numbers"
"Export customer data as CSV format"
```

### Data Analysis
```
"Aggregate sales data by region and calculate totals"
"Show me the average salary by department"
"Convert this JSON data to a nicely formatted table"
```

## Troubleshooting

### Server Not Starting
1. Check if Node.js 18+ is installed: `node --version`
2. Verify the build completed: `ls dist/index.js`
3. Test server manually: `node dist/index.js`

### Authentication Issues
1. Verify your Budibase URL is correct and accessible
2. Check your API key has proper permissions
3. Test API access: `curl -H "x-budibase-api-key: YOUR_KEY" "YOUR_URL/api/public/v1/applications"`

### Claude Desktop Not Recognizing Tools
1. Verify the config file path is correct
2. Check JSON syntax in config file
3. Restart Claude Desktop completely
4. Check Claude Desktop logs for errors

### Permission Issues
1. Ensure the MCP server path is readable by Claude Desktop
2. Check file permissions: `ls -la dist/index.js`
3. Verify environment variables are accessible

## Testing All Tools

You can test that all tools are working by asking Claude:

```
"Please test a few of your Budibase tools to make sure everything is working. Try listing applications, getting table schemas, and querying some records."
```

## Performance Notes

- **Concurrent Operations**: The server handles up to 10 concurrent operations
- **Batch Processing**: Optimized for batches of 25-50 records
- **Caching**: Frequently accessed data is cached for 5 minutes
- **Rate Limiting**: Respects Budibase API rate limits

## Security Considerations

- API keys are passed through environment variables (secure)
- No credentials stored in config files
- All API communications use HTTPS
- Input validation on all operations
- SQL injection and XSS protection enabled

---

## Success! 🎉

Once configured, Claude Desktop will have access to all 36 Budibase tools, enabling:

- ✅ Complete application management
- ✅ Full CRUD operations on tables and records
- ✅ Advanced query building and data filtering
- ✅ Batch operations for bulk data processing
- ✅ Data transformation and format conversion
- ✅ User and permission management
- ✅ Data aggregation and analysis

Your Claude Desktop instance will be able to interact with your Budibase applications as a power user with full API capabilities!