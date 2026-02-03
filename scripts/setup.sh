#!/bin/bash
# Budibase MCP Server - Quick Setup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "🚀 Budibase MCP Server - Schema Registry Setup"
echo "=============================================="

# Check .env
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env - Please edit with your credentials and press Enter"
    read -r
fi

# Install, migrate, build, initialize
echo "📦 Installing dependencies..."
npm install sqlite3 sqlite

echo "🔄 Running migration..."
node scripts/migrate-schema-registry.js

echo "🔨 Building project..."
npm run build

echo "🧪 Running tests..."
node tests/integration.js

echo "
✅ Setup complete! Run 'npm start' to begin.

For Claude Desktop, add to config:
{
  \"mcpServers\": {
    \"budibase\": {
      \"command\": \"node\",
      \"args\": [\"$PROJECT_DIR/dist/index.js\"]
    }
  }
}"
