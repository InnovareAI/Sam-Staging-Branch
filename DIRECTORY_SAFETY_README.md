# Directory Safety System - Prevention of Cross-Project Contamination

## Problem Statement

Claude Code has previously killed 2 production projects by:
1. Working in the wrong directory
2. Making changes to files in other projects
3. Not verifying location before file operations

## Safety Measures Implemented

### 1. Project-Level CLAUDE.md Enhancement

**Location**: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/CLAUDE.md`

**Changes**:
- ✅ Added prominent directory safety section AT THE TOP (impossible to miss)
- ✅ Listed banned directories with historical context (killed projects)
- ✅ Explicit examples of safe vs forbidden operations
- ✅ Mandatory checklist before every file operation
- ✅ Clear consequences for violations

**Key Features**:
- 🚨 Triple warning emojis for visibility
- ⛔ "ZERO TOLERANCE" messaging
- 📋 Safety checklist for every operation
- ✅/❌ Visual examples of correct/incorrect usage

### 2. Global CLAUDE.md Enhancement

**Location**: `/Users/tvonlinz/.claude/CLAUDE.md`

**Changes**:
- ✅ Added WARNING about killed projects at the very top
- ✅ Project-specific isolation rules
- ✅ Mandatory `pwd` verification before operations
- ✅ Explicit project boundaries

### 3. Safety Verification Script

**Location**: `/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/shell/verify-safe-directory.sh`

**Usage**:
```bash
# Run before any file operations
./scripts/shell/verify-safe-directory.sh

# Returns:
# ✅ SAFE: You are in the correct directory - if correct
# ❌ DANGER: You are in the WRONG directory! - if incorrect
```

**Features**:
- Checks current directory matches required path
- Clear visual feedback (✅/❌)
- Exit codes: 0 (safe), 1 (dangerous)
- Can be integrated into git hooks or workflows

## How Future Claude Instances Will Be Protected

### First Contact Protection

1. **Global CLAUDE.md** loads first
   - Warns about project isolation
   - Lists killed projects as examples
   - Requires `pwd` verification

2. **Project CLAUDE.md** loads second
   - Massive warning section at top (lines 1-81)
   - Cannot miss the safety protocol
   - Explicit banned directory list

### Ongoing Protection

**Every file operation reminder**:
- Check file path contains `/Sam-New-Sep-7/`
- Run `pwd` to verify location
- Use safety verification script
- When in doubt, ASK user

## Recommended User Workflow

### Starting a New Session

```bash
# 1. Navigate to correct project
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7

# 2. Verify location
pwd

# 3. Run safety check
./scripts/shell/verify-safe-directory.sh

# 4. Tell Claude: "I'm in Sam-New-Sep-7, proceed with [task]"
```

### During Development

**Periodically remind Claude**:
- "Verify you're still in Sam-New-Sep-7"
- "Run pwd before the next file operation"
- "Check the safety script"

### If Claude Shows Signs of Wandering

**Red flags to watch for**:
- Mentions of `3cubed/` or `SEO_Platform/`
- Relative paths with `../../`
- Commands like `cd ..` or `cd ~`
- File paths without `Sam-New-Sep-7`

**Immediate action**:
1. STOP the operation
2. Run `pwd` to check location
3. If wrong, navigate back immediately
4. Remind Claude of directory restrictions

## Additional Protections You Can Add

### 1. Git Pre-commit Hook (Optional)

Create `.git/hooks/pre-commit`:
```bash
#!/bin/bash
REQUIRED_PATH="/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7"
CURRENT_PATH=$(pwd)

if [ "$CURRENT_PATH" != "$REQUIRED_PATH" ]; then
    echo "❌ ERROR: Committing from wrong directory!"
    echo "Current: $CURRENT_PATH"
    echo "Required: $REQUIRED_PATH"
    exit 1
fi
```

### 2. Shell Prompt Modification (Optional)

Add to your `~/.zshrc` or `~/.bashrc`:
```bash
# Color-code prompt based on project
if [[ "$PWD" == *"Sam-New-Sep-7"* ]]; then
    PS1="%F{green}[SAM-AI]%f $PS1"
elif [[ "$PWD" == *"3cubed"* ]]; then
    PS1="%F{blue}[3CUBED]%f $PS1"
fi
```

### 3. Directory Lock File (Optional)

Create `.project-lock` in project root:
```json
{
  "project": "Sam-New-Sep-7",
  "path": "/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7",
  "protected": true,
  "allow_cross_project": false
}
```

## Testing the Protection

### Safe Operations Test
```bash
cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7
./scripts/shell/verify-safe-directory.sh
# Should show: ✅ SAFE
```

### Dangerous Operation Test
```bash
cd /Users/tvonlinz/Dev_Master/3cubed/
./scripts/shell/verify-safe-directory.sh 2>/dev/null || echo "Correctly blocked!"
# Should show: ❌ DANGER or "Correctly blocked!"
```

## Summary

**Three Layers of Protection**:
1. **Global CLAUDE.md**: First line of defense, warns about killed projects
2. **Project CLAUDE.md**: Massive warning section, impossible to miss
3. **Safety Script**: Automated verification tool

**Human Verification**:
- Always check Claude's first `pwd` command
- Watch for directory navigation commands
- Stop immediately if you see wrong paths
- Remind Claude frequently about location

**Result**: Future Claude instances should have multiple safeguards preventing cross-project contamination.

---

**Created**: 2025-10-02
**Purpose**: Prevent repeat of production project destruction
**Status**: Active protection measures in place
