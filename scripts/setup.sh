#!/bin/bash
# Budibase MCP Server - Setup Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

echo "Budibase MCP Server Setup"
echo "========================="

if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from template. Edit with your credentials, then press Enter."
    read -r
fi

echo "Installing dependencies..."
npm install

echo "Building project..."
npm run build

echo "
Setup complete! Run 'npm start' to begin.

For Claude Desktop, add to config:
{
  \"mcpServers\": {
    \"budibase\": {
      \"command\": \"node\",
      \"args\": [\"$PROJECT_DIR/dist/index.js\"]
    }
  }
}"
