# Claude Code Setup Guide

## System Instructions & Context Management

### Files Created:

1. **`.claude-code-settings.json`** - Project-level configuration with permissions and guardrails
2. **`.claudeignore`** - Exclude files from Claude's context (like .gitignore)
3. **`CLAUDE.md`** - Cleaned to 19KB (was 924KB) - Essential instructions only

---

## How Claude Code Reads Instructions

### Priority Order:
1. **`.claude-code-settings.json`** - Technical permissions and sandbox settings
2. **`CLAUDE.md`** (or similar named files) - Project-specific instructions
3. **`docs/projects/CLAUDE_GUARDRAILS_MASTERFILE.md`** - Organization-wide standards

### What Gets Loaded Automatically:
- Files you explicitly reference in conversation
- Files Claude determines are relevant to your query
- Project structure and configuration files
- Recent git changes

### What Doesn't Get Loaded:
- Files matching `.claudeignore` patterns
- `node_modules/` and other large directories
- Binary files and archives
- Backup files

---

## Key Settings Explained

### Permissions (in `.claude-code-settings.json`):

```json
{
  "permissions": {
    "allow": [
      "read:/path/to/your/project/**",
      "write:/path/to/your/project/**"
    ],
    "deny": [
      "read:/path/to/other/projects/**"
    ],
    "ask": [
      "bash:rm **",
      "bash:git push **"
    ]
  }
}
```

- **allow**: Claude can freely access these paths
- **deny**: Claude is blocked from these paths
- **ask**: Claude must request permission before executing

### Sandbox Settings:

```json
{
  "sandbox": {
    "filesystem": {
      "write": {
        "allowOnly": ["/your/project/path"],
        "denyWithinAllow": [".env", ".git/config"]
      }
    }
  }
}
```

Restricts Claude's file system access to specific directories.

---

## Context Window Management

### Problem:
Claude Code was consuming your entire context window in minutes because:
1. It auto-loads files from your workspace
2. Conversation history accumulates
3. Large documentation files (like 924KB `CLAUDE.md`) get loaded

### Solutions Implemented:

#### 1. **Cleaned CLAUDE.md**
- **Before**: 924KB / 23,815 lines
- **After**: 19KB / 437 lines
- **Savings**: 98% reduction

#### 2. **Created .claudeignore**
Excludes from context:
- `node_modules/`
- Build outputs (`.next/`, `dist/`)
- Archives and backups
- Large documentation files
- Logs and cache

#### 3. **Set Permissions**
Prevents Claude from:
- Reading other projects
- Accessing sensitive files
- Writing outside project directory

---

## Best Practices

### To Reduce Context Consumption:

1. **Start Fresh Conversations Often**
   - Use "New Chat" when switching tasks
   - Don't let conversations grow too long

2. **Be Specific**
   - Reference exact files: "Look at `app/api/route.ts` lines 45-60"
   - Don't say: "Fix the API"

3. **Limit Scope**
   - Work on one feature at a time
   - Don't ask Claude to scan entire codebase

4. **Use .claudeignore**
   - Add any large files you don't need Claude to read
   - Archive old documentation

5. **Clean Up Regularly**
   - Archive completed work
   - Remove duplicate sections
   - Keep documentation concise

---

## For Other Projects

To set up similar guardrails in another project:

1. **Copy `.claude-code-settings.json`** and update paths
2. **Copy `.claudeignore`** and customize patterns
3. **Create project-specific `CLAUDE.md`** with instructions

### Example for 3cubed/SEO_Platform:

```bash
cd /Users/tvonlinz/Dev_Master/3cubed/SEO_Platform

# Copy settings and update paths
cp ../InnovareAI/Sam-New-Sep-7/.claude-code-settings.json .
# Edit the file to change paths to /3cubed/SEO_Platform

# Copy ignore patterns
cp ../InnovareAI/Sam-New-Sep-7/.claudeignore .

# Create project instructions
touch CLAUDE.md
```

---

## Troubleshooting

### Context Still Filling Up Too Fast?

1. Check what files Claude is reading:
   - Look at the file list in the chat sidebar
   - Add large files to `.claudeignore`

2. Archive old conversations:
   - Settings in `.claude-code-settings.json`:
   - `"cleanupPeriodDays": 30` (already set)

3. Use more specific queries:
   - Bad: "Review the codebase"
   - Good: "Review the authentication logic in `lib/auth.ts`"

### Claude Accessing Wrong Directories?

Check `.claude-code-settings.json` permissions:
- Ensure `deny` rules are specific
- Restart VS Code after changing settings

---

## References

- **Project Instructions**: `CLAUDE.md` (19KB)
- **Organization Standards**: `docs/projects/CLAUDE_GUARDRAILS_MASTERFILE.md` (100KB)
- **Claude Code Docs**: https://docs.claude.com/en/docs/claude-code/settings

---

**Last Updated**: October 2, 2025
