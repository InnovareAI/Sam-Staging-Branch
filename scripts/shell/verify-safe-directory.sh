#!/bin/bash

# Safety verification script for Claude Code
# Run this before any file operations to ensure we're in the correct directory

REQUIRED_PATH="/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7"
CURRENT_PATH=$(pwd)

echo "🔍 Verifying directory safety..."
echo "Current directory: $CURRENT_PATH"
echo "Required directory: $REQUIRED_PATH"

if [ "$CURRENT_PATH" = "$REQUIRED_PATH" ]; then
    echo "✅ SAFE: You are in the correct directory"
    echo "✅ Proceed with file operations"
    exit 0
else
    echo "❌ DANGER: You are in the WRONG directory!"
    echo "❌ Current: $CURRENT_PATH"
    echo "❌ Required: $REQUIRED_PATH"
    echo ""
    echo "🚨 STOP ALL OPERATIONS IMMEDIATELY"
    echo "🚨 Navigate to the correct directory first:"
    echo "   cd $REQUIRED_PATH"
    exit 1
fi
