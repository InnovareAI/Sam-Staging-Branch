# Rolling TODO Management System

## Overview

This system prevents TODO bloat in your main instruction files while keeping tasks organized and accessible.

---

## File Structure

```
project-root/
├── TODO.md                          # Active rolling TODOs (lightweight)
├── CLAUDE.md                        # Project instructions (keep clean)
├── .claudeignore                    # Excludes archives from context
└── docs/
    └── archive/
        └── TODO_ARCHIVE_YYYY_MM.md  # Completed items archive
```

---

## How It Works

### 1. **Active TODOs** (`TODO.md`)
- **Size**: Keep under 200 lines
- **Content**: Only active/upcoming tasks
- **Update frequency**: During every dev session
- **Claude reads**: Yes (always loaded)

### 2. **Archive** (`docs/archive/TODO_ARCHIVE_*.md`)
- **Size**: Unlimited (excluded from context)
- **Content**: Completed tasks, historical records
- **Update frequency**: Monthly or when TODO.md > 200 lines
- **Claude reads**: No (in `.claudeignore`)

### 3. **Project Instructions** (`CLAUDE.md`)
- **Size**: Keep under 500 lines
- **Content**: Permanent project guidelines
- **Update frequency**: Rarely (only for major changes)
- **Claude reads**: Yes (always loaded)

---

## Daily Workflow

### Starting a Session

1. **You say**: "What should I work on today?"
2. **Claude reads**: `TODO.md` automatically
3. **Claude responds**: With prioritized tasks from "URGENT" section

### During Session

```markdown
You: "Add task: Implement user authentication"
Claude: Adds to TODO.md → 📋 This Week section

You: "Mark authentication complete"
Claude: Moves to ✅ Recently Completed section
```

### End of Session

```markdown
You: "Archive completed tasks"
Claude: Moves items from "Recently Completed" to docs/archive/TODO_ARCHIVE_2025_10.md
```

---

## Best Practices

### ✅ DO

- Keep TODO.md focused on **current work**
- Be specific: "Fix login bug on /auth page" (not "Fix bugs")
- Archive monthly or when file > 200 lines
- Use categories: URGENT, This Week, Next Sprint, etc.
- Update as you go, not at end of day

### ❌ DON'T

- Put implementation details in TODO.md
- Let "Recently Completed" grow beyond 20 items
- Mix TODOs with project instructions
- Keep historical context in active TODO
- Forget to archive (causes bloat)

---

## Categories Explained

### 🔥 URGENT - Do Today
**Purpose**: Immediate blockers or time-sensitive tasks  
**Limit**: 3-5 items maximum  
**Example**:
```markdown
- [ ] Fix production bug preventing user login
- [ ] Deploy hotfix for payment gateway
```

### 📋 This Week
**Purpose**: Priority tasks for current sprint  
**Limit**: 10-15 items  
**Example**:
```markdown
- [ ] Implement email verification flow
- [ ] Add unit tests for auth module
```

### 💡 Next Sprint
**Purpose**: Planned features or improvements  
**Limit**: No strict limit, but keep realistic  
**Example**:
```markdown
- [ ] Design new dashboard UI
- [ ] Research SSO integration options
```

### 🐛 Bugs to Fix
**Purpose**: Known issues that aren't urgent  
**Move to URGENT** when they become critical  
**Example**:
```markdown
- [ ] Profile image upload fails for PNG > 5MB
- [ ] Dashboard loads slowly with > 100 items
```

### ✨ Feature Requests
**Purpose**: User requests or nice-to-haves  
**Review monthly** to prioritize  
**Example**:
```markdown
- [ ] Add dark mode support
- [ ] Export data to CSV feature
```

### 📝 Documentation Needed
**Purpose**: Docs debt tracking  
**Example**:
```markdown
- [ ] Document API authentication flow
- [ ] Update deployment guide for new Netlify config
```

### 🔄 Refactoring / Tech Debt
**Purpose**: Code quality improvements  
**Schedule deliberately** (don't let it grow indefinitely)  
**Example**:
```markdown
- [ ] Extract auth logic into separate service
- [ ] Update deprecated React patterns in legacy components
```

---

## Archiving Process

### When to Archive

- **Monthly**: First day of each month
- **When TODO.md > 200 lines**: Archive immediately
- **Before major milestones**: Clean slate for next phase

### How to Archive

**Manual Method:**
```bash
# 1. Create/open archive file
open docs/archive/TODO_ARCHIVE_2025_10.md

# 2. Cut completed items from TODO.md "Recently Completed"
# 3. Paste into archive under appropriate week
# 4. Save both files
```

**Claude-Assisted:**
```
You: "Archive completed tasks from this month"
Claude: Moves items from TODO.md to docs/archive/TODO_ARCHIVE_2025_10.md
```

### Archive Format

```markdown
# TODO Archive - October 2025

## Week of Oct 2, 2025

### Features Completed
- [x] Implemented user authentication
- [x] Added email verification

### Bugs Fixed
- [x] Fixed login redirect issue
- [x] Resolved payment gateway timeout

### Documentation
- [x] Updated API docs
```

---

## Integration with Claude Code

### Automatic Reading

Claude Code will automatically read `TODO.md` when:
- You ask "What should I work on?"
- You start a conversation about tasks
- You reference TODOs in context

### Updating Tasks

**You can say**:
- "Add to urgent: Fix the payment bug"
- "Mark authentication feature as complete"
- "Move database optimization to next sprint"
- "Show me what's urgent"

**Claude will**:
- Update TODO.md appropriately
- Maintain proper formatting
- Keep categories organized

---

## Context Window Benefits

### Before This System
- TODOs embedded in CLAUDE.md (bloats context)
- Historical TODOs never cleaned (924KB file!)
- Claude loads irrelevant completed tasks

### After This System
- TODO.md: ~2KB (current work only)
- Archives: Excluded from context
- CLAUDE.md: 19KB (instructions only)
- **Total context savings**: ~900KB+

---

## Tips & Tricks

### 1. **Use Task IDs for Complex Items**
```markdown
- [ ] [FEAT-123] Implement OAuth2 integration
- [ ] [BUG-456] Fix dashboard rendering issue
```

### 2. **Link to Design Docs**
```markdown
- [ ] Build new editor (see /docs/editor-design.md)
```

### 3. **Add Context Notes**
```markdown
- [ ] Refactor user service
      Note: Dependencies on auth module, do after FEAT-123
```

### 4. **Time Estimates**
```markdown
- [ ] Add pagination [2h]
- [ ] Write integration tests [4h]
```

### 5. **Assignees (if team)**
```markdown
- [ ] Deploy to staging (@john)
- [ ] Review API changes (@sarah)
```

---

## Troubleshooting

### Problem: TODO.md keeps growing
**Solution**: Archive more frequently, be more specific with tasks

### Problem: Can't find old completed tasks
**Solution**: Check `docs/archive/TODO_ARCHIVE_*.md` files

### Problem: Claude not reading TODO.md
**Solution**: Check it's not in `.claudeignore`, restart VS Code

### Problem: Forgetting to update TODOs
**Solution**: Make it part of your commit message habit
```
git commit -m "feat: add auth" && code TODO.md
```

---

## Related Files

- **Active TODOs**: `TODO.md`
- **Project Instructions**: `CLAUDE.md`
- **Setup Guide**: `CLAUDE_CODE_SETUP.md`
- **Archives**: `/docs/archive/TODO_ARCHIVE_*.md`
- **Claude Settings**: `.claude-code-settings.json`

---

**Created**: October 2, 2025  
**Purpose**: Prevent context bloat while maintaining organized task tracking
