#!/bin/bash

# Archive old Claude-specific MCP tools since development moved to Codex and Warp

echo "Archiving old Claude-specific MCP tools..."

# Create archive directory
mkdir -p .archived-mcp-tools

# Move old MCP files
mv mcp-qa-agent.js .archived-mcp-tools/ 2>/dev/null
mv mcp-directory-monitor.js .archived-mcp-tools/ 2>/dev/null

echo "Archived files to .archived-mcp-tools/"
echo "These tools are no longer needed since development moved to OpenAI Codex and Warp."