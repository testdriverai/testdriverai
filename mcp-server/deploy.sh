#!/bin/bash
set -e

echo "🔨 Building TestDriver MCP Server..."
npm run build

echo ""
echo "📦 Deploying to ~/.mcp/testdriver..."

# Create the directory
mkdir -p ~/.mcp/testdriver

# Copy necessary files
cp -r dist package.json package-lock.json ~/.mcp/testdriver/

# Install production dependencies in the target location
cd ~/.mcp/testdriver
npm install --production

echo ""
echo "✅ Deployment complete!"
echo ""
echo "MCP server installed at: ~/.mcp/testdriver"
echo ""
echo "Update your MCP client configuration to use:"
echo "  node ~/.mcp/testdriver/dist/index.js"
echo ""
echo "Don't forget to set TESTDRIVER_API_KEY in your environment!"
