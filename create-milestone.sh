#!/bin/bash

# SAM AI Platform - Milestone Creation Script
# Usage: ./create-milestone.sh "v2.1" "Feature Name" "Feature description"

VERSION=$1
FEATURE_NAME=$2
DESCRIPTION=$3

if [ -z "$VERSION" ] || [ -z "$FEATURE_NAME" ]; then
    echo "❌ Usage: ./create-milestone.sh \"v2.1\" \"Feature Name\" \"Feature description\""
    echo "Example: ./create-milestone.sh \"v2.1\" \"Supabase Integration\" \"Complete Supabase backend integration\""
    exit 1
fi

# Get current date
DATE=$(date +%Y-%m-%d)
TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# Get git info
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "No git")
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "No git")

# File names
MILESTONE_FILE="MILESTONE_${DATE}_${VERSION}.md"

echo "🎯 Creating milestone: $MILESTONE_FILE"
echo "📝 Feature: $FEATURE_NAME"
echo "📅 Date: $DATE"
echo "🔗 Git: $GIT_COMMIT ($GIT_BRANCH)"

# Create milestone file
cat > "$MILESTONE_FILE" << EOF
# MILESTONE $DATE $VERSION - $FEATURE_NAME

## 🎯 MILESTONE SUMMARY
- **Date**: $DATE
- **Version**: $VERSION
- **Features**: $DESCRIPTION
- **Status**: ✅ Current
- **Git**: $GIT_COMMIT - "$FEATURE_NAME" ($GIT_BRANCH branch)
- **Created**: $TIMESTAMP

## 🚀 FEATURES COMPLETED
- ✅ $DESCRIPTION
- ✅ [Add completed features here]

## 📁 COMPLETE CODE FILES

### File 1: \`/app/page.tsx\` - Main Application
\`\`\`tsx
$(cat app/page.tsx 2>/dev/null || echo "// File not found - add manually")
\`\`\`

### File 2: \`/app/api/sam/chat/route.ts\` - AI Chat API
\`\`\`typescript
$(cat app/api/sam/chat/route.ts 2>/dev/null || echo "// File not found - add manually")
\`\`\`

## ⚙️ CONFIGURATION

### package.json
\`\`\`json
$(cat package.json 2>/dev/null || echo "// File not found - add manually")
\`\`\`

### Environment Variables (.env.local)
\`\`\`bash
# Add your environment variables here
OPENROUTER_API_KEY=your_key_here
NEXT_PUBLIC_ENVIRONMENT=development
\`\`\`

### Deployment Config (netlify.toml)
\`\`\`toml
$(cat netlify.toml 2>/dev/null || echo "# File not found - add manually")
\`\`\`

## 🔄 QUICK RESTORE

1. **Copy Files**: Copy all code files above to their respective paths
2. **Install Dependencies**: \`npm install\`
3. **Environment Setup**: Add required environment variables to .env.local
4. **Start Development**: \`npm run dev\`
5. **Test Locally**: Visit http://localhost:3000
6. **Deploy Staging**: \`npm run build && netlify deploy --dir=.next --alias=staging\`
7. **Deploy Production**: \`netlify deploy --prod\` (when ready)

## 📊 DEPLOYMENT INFO

- **Staging URL**: https://staging--sam-new-sep-7.netlify.app
- **Production URL**: https://app.meet-sam.com
- **Build Status**: ✅ Successful
- **Test Status**: ✅ All features working

## 🎯 UNIQUE FEATURES

### $FEATURE_NAME
- [Describe key features here]
- [Add technical details]
- [Include any special configurations]

---

**This milestone represents: $DESCRIPTION**
EOF

echo "✅ Milestone created: $MILESTONE_FILE"

# Update MILESTONE_SYSTEM.md
if [ -f "MILESTONE_SYSTEM.md" ]; then
    echo "📝 Updating MILESTONE_SYSTEM.md..."
    
    # Create a backup
    cp MILESTONE_SYSTEM.md MILESTONE_SYSTEM.md.bak
    
    # Add new milestone to the index (this is a simple approach - you might want to enhance this)
    echo "🎯 Please manually update MILESTONE_SYSTEM.md with the new milestone entry:"
    echo "| $DATE | $VERSION | $FEATURE_NAME | ✅ Current | [MILESTONE_${DATE}_${VERSION}.md](#milestone-${DATE//-}-${VERSION//.}) |"
    
else
    echo "⚠️  MILESTONE_SYSTEM.md not found. Please create it first."
fi

echo ""
echo "🎉 Milestone $VERSION created successfully!"
echo "📁 File: $MILESTONE_FILE"
echo "📝 Don't forget to:"
echo "   1. Review and update the generated file"
echo "   2. Add specific feature details"
echo "   3. Update MILESTONE_SYSTEM.md index"
echo "   4. Commit the milestone file to git"