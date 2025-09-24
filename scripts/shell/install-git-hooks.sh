#!/bin/bash
# Install Git Hooks for Auto-Documentation
# This script sets up git hooks to automatically update documentation

echo "🔧 Installing git hooks for auto-documentation..."

# Create .git/hooks directory if it doesn't exist
mkdir -p .git/hooks

# Create pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
# Auto-update documentation before commit
echo "📚 Auto-updating documentation before commit..."

# Run the documentation updater
node scripts/js/auto-update-documentation.cjs

# Check if CLAUDE.md was updated
if git diff --quiet CLAUDE.md; then
    echo "✅ No documentation updates needed"
else
    echo "📝 Documentation updated - adding to commit"
    git add CLAUDE.md
fi
EOF

# Create post-commit hook
cat > .git/hooks/post-commit << 'EOF'
#!/bin/sh
# Log successful documentation update
echo "✅ Commit completed with auto-documentation update"
EOF

# Create post-merge hook (for pull/merge operations)
cat > .git/hooks/post-merge << 'EOF'
#!/bin/sh
# Update documentation after merge
echo "🔄 Updating documentation after merge..."
node scripts/js/auto-update-documentation.cjs

# If documentation was updated, create a follow-up commit
if ! git diff --quiet CLAUDE.md; then
    echo "📚 Documentation updated after merge"
    git add CLAUDE.md
    git commit -m "docs: Auto-update CLAUDE.md after merge

🤖 Generated with auto-documentation system"
fi
EOF

# Make hooks executable
chmod +x .git/hooks/pre-commit
chmod +x .git/hooks/post-commit  
chmod +x .git/hooks/post-merge

echo "✅ Git hooks installed successfully!"
echo "📋 Installed hooks:"
echo "  - pre-commit: Updates documentation before each commit"
echo "  - post-commit: Logs successful documentation updates"
echo "  - post-merge: Updates documentation after merge operations"
echo ""
echo "🚀 Usage:"
echo "  Hooks will run automatically with git commits and merges"
echo "  Manual update: npm run update-docs"
echo "  Post-deployment: npm run post-deploy"