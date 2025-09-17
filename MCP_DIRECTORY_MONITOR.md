# MCP Directory Monitor Agent

## Overview
The MCP Directory Monitor Agent enforces strict SAM AI project directory boundaries to prevent cross-project contamination and deployment errors.

## What It Prevents
- ✅ **Directory wandering** outside SAM AI project
- ✅ **Cross-project contamination** from SEO/other projects  
- ✅ **Deployment mix-ups** between different sites
- ✅ **File operations** in forbidden directories
- ✅ **Accidental violations** of CLAUDE.md restrictions

## Installation
The agent is already installed and configured:
- **Script**: `mcp-directory-monitor.js`
- **Config**: `.mcp.json` includes `directory-monitor` server
- **Dependencies**: `@modelcontextprotocol/sdk` installed

## Available Tools

### 1. `validate_path`
Validates if a file path is within SAM AI project boundaries.

**Parameters:**
- `path` (string, required): File or directory path to validate
- `operation` (string, optional): Operation type (read, write, execute, deploy)

**Returns:**
- Valid paths: `✅ Path within SAM AI project boundaries`
- Invalid paths: `🚨 CRITICAL VIOLATION: Path outside SAM AI project`

### 2. `get_monitor_status`
Get current monitoring status and violation history.

**Returns:**
```json
{
  "session_active": true,
  "current_directory": "/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7",
  "allowed_root": "/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7",
  "violations_count": 0,
  "recent_violations": [],
  "directory_valid": true
}
```

### 3. `check_current_directory`
Verify current working directory is within project bounds.

### 4. `reset_violations`
Reset violation counter (use with extreme caution).

## Violation Levels

### 🟡 Warning
- Suspicious path patterns detected
- Non-critical boundary approach

### 🟠 Violation  
- Path outside SAM AI project detected
- Violation recorded and counted

### 🔴 Critical
- **BOUNDARY_BREACH**: Path outside allowed root
- **FORBIDDEN_ACCESS**: Access to explicitly forbidden paths
- **MULTIPLE_VIOLATIONS**: 3+ violations detected

### ⛔ Termination
- Session terminated immediately
- Manual intervention required

## Protected Boundaries

### ✅ Allowed
```
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/
├── app/
├── components/
├── lib/
├── docs/
└── ... (all SAM AI project files)
```

### ❌ Forbidden
```
/Users/tvonlinz/Dev_Master/3cubed/           # SEO Platform
/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/../  # Parent directory
/Users/tvonlinz/package-lock.json           # Parent lockfile
```

## Testing

### Valid Path Test
```bash
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "validate_path", "arguments": {"path": "/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/page.tsx", "operation": "read"}}}' | node mcp-directory-monitor.js
```

**Expected Result:** ✅ Valid path confirmation

### Violation Test  
```bash
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "validate_path", "arguments": {"path": "/Users/tvonlinz/Dev_Master/3cubed/SEO_Platform", "operation": "read"}}}' | node mcp-directory-monitor.js
```

**Expected Result:** 🚨 Critical violation with session termination

## Integration Points

The monitor should be integrated into:
1. **Bash tool execution** - Validate all paths before commands
2. **Read/Write operations** - Check file paths before access
3. **Git operations** - Verify repository context
4. **Deployment commands** - Confirm correct project before deploy

## Manual Usage

You can manually check paths using:
```bash
# Check if current directory is valid
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "check_current_directory", "arguments": {}}}' | node mcp-directory-monitor.js

# Get monitoring status
echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "get_monitor_status", "arguments": {}}}' | node mcp-directory-monitor.js
```

## Emergency Procedures

### If Violations Detected
1. **Stop all operations immediately**
2. **Verify current directory**: `pwd`
3. **Return to SAM AI project**: `cd /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7`
4. **Reset violations**: Use `reset_violations` tool if needed
5. **Review recent actions** for contamination

### If Session Terminated
1. **End current session**
2. **Start fresh session** 
3. **Verify directory boundaries**
4. **Proceed with caution**

## Success Metrics

The monitor will prevent:
- ❌ Accidental SEO site deployments to SAM AI
- ❌ Cross-project file contamination  
- ❌ Directory boundary violations
- ❌ Multi-project confusion during development

## Maintenance

- **Monitor logs**: Check violation patterns
- **Update boundaries**: Modify `ALLOWED_PROJECT_ROOT` if needed
- **Review forbidden paths**: Update `FORBIDDEN_PATHS` array
- **Test regularly**: Verify violation detection works

---

**Remember**: The monitor is only as effective as its enforcement. Human oversight and immediate session termination on violations remain the most important safeguards.