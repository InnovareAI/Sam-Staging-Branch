# SAM AI System Override Documentation

## Overview

The SAM AI System Override is a secure administrator bypass system that allows authorized InnovareAI workspace members to skip the standard onboarding flow and issue direct work commands to SAM. This system is designed for maximum productivity and efficiency for power users.

## Authentication System

### Command Format
```
#OverrideCode email@domain.com PIN PASSWORD
```

### Credentials
- **Email**: admin@innovareai.com (or authorized admin email)
- **PIN**: 8612 (4-digit user-defined PIN)
- **Password**: InnovareAI!2025# (fixed system password)
- **Workspace**: Must be verified InnovareAI workspace member

### Example Usage
```
#OverrideCode admin@innovareai.com 8612 InnovareAI!2025#
```

## Security Features

### Multi-Layer Authentication
1. **Command Parsing** - Validates command format and structure
2. **Credential Validation** - SHA256 hashed PIN + password verification
3. **Workspace Authorization** - Confirms InnovareAI workspace membership
4. **Session Tracking** - Logs all override sessions with IP/User-Agent

### Data Protection
- **SHA256 Hashing** - All credentials stored as hashed values with salt
- **Unique Constraints** - One admin account per workspace/email combination
- **Manual Setup Only** - No automated account creation (prevents unauthorized access)
- **Audit Trail** - Complete logging of sessions and commands

## System Behavior

### Override Mode Activation
When successfully authenticated, SAM switches to:
- **Direct Command Interface** - No onboarding, scripts, or casual conversation
- **Results-Focused Communication** - Professional, efficient responses
- **Enterprise-Tier Processing** - Uses best available Mistral model
- **Full Tool Access** - Immediate LinkedIn research, data analysis capabilities

### Response Style Changes
**Normal Mode:**
```
Hi there! How's your day going? I'm Sam, and I'm here to help with...
```

**Override Mode:**
```
🔧 SYSTEM OVERRIDE ACTIVATED

Administrator access granted. Ready to execute direct commands.
What would you like me to work on?
```

### Available Capabilities
- ✅ LinkedIn research and prospecting
- ✅ Boolean search execution
- ✅ Company intelligence gathering
- ✅ ICP research and analysis
- ✅ Campaign strategy development
- ✅ Real-time data collection
- ✅ Advanced sales optimization

## Technical Implementation

### Database Schema

#### `sam_admin_users` Table
```sql
CREATE TABLE sam_admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    user_id UUID REFERENCES users(id),
    
    -- Authentication
    email TEXT NOT NULL,
    pin_hash TEXT NOT NULL,        -- SHA256(PIN + salt)
    password_hash TEXT NOT NULL,   -- SHA256(password + salt)
    
    -- Access Control
    full_access BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    
    -- Usage Tracking
    usage_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(workspace_id, email)
);
```

#### `sam_override_sessions` Table
```sql
CREATE TABLE sam_override_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id UUID NOT NULL REFERENCES sam_admin_users(id),
    workspace_id UUID NOT NULL REFERENCES workspaces(id),
    
    -- Session Details
    session_start TIMESTAMPTZ DEFAULT NOW(),
    session_end TIMESTAMPTZ,
    commands_executed INTEGER DEFAULT 0,
    
    -- Request Metadata
    ip_address INET,
    user_agent TEXT,
    session_data JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `sam_override_commands` Table
```sql
CREATE TABLE sam_override_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sam_override_sessions(id),
    admin_user_id UUID NOT NULL REFERENCES sam_admin_users(id),
    
    -- Command Details
    command_type TEXT NOT NULL,
    command_text TEXT NOT NULL,
    command_params JSONB DEFAULT '{}',
    
    -- Execution Details
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    execution_time_ms INTEGER,
    status TEXT DEFAULT 'success',
    
    -- Results
    result_summary TEXT,
    result_data JSONB DEFAULT '{}',
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### API Integration

#### Chat Route Handler
File: `/app/api/sam/chat/route.ts`

Key functionality:
1. **Command Detection** - Scans user input for `#OverrideCode`
2. **Credential Validation** - Verifies email, PIN, password combination
3. **System Prompt Override** - Switches to admin mode prompt
4. **Session Logging** - Records override session start

#### Admin Setup Endpoint
File: `/app/api/admin/setup-override/route.ts`

Manual admin user creation with setup token protection.

### Core Functions

#### `parseOverrideCommand(userInput: string)`
- Extracts credentials from command string
- Validates format and basic structure
- Returns parsed command object with validation status

#### `validateOverrideCredentials(credentials, userId?)`
- Performs database credential verification
- Checks workspace membership
- Updates usage tracking
- Returns admin user object on success

#### `getOverrideSystemPrompt(adminUser)`
- Generates specialized system prompt for override mode
- Includes admin context and capabilities
- Optimizes for direct command processing

## Setup Instructions

### 1. Database Migration
Apply the migration file:
```bash
# File: /supabase/migrations/20250916090000_sam_override_system.sql
npx supabase db push --linked
```

### 2. Environment Variables
Ensure these are set:
```env
OVERRIDE_SALT=innovareai_override_2024
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Admin User Creation
Use the setup endpoint:
```bash
curl -X POST https://app.meet-sam.com/api/admin/setup-override \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@innovareai.com",
    "pin": "8612",
    "password": "InnovareAI!2025#",
    "setupToken": "innovare-setup-2024"
  }'
```

### 4. Verification
Test the override command in SAM:
```
#OverrideCode admin@innovareai.com 8612 InnovareAI!2025#
```

## Security Considerations

### Access Control
- **Workspace Isolation** - Each workspace has separate admin users
- **Email Uniqueness** - One admin account per workspace/email pair
- **Manual Provisioning** - No self-service account creation
- **Token-Protected Setup** - Setup endpoint requires secret token

### Audit Requirements
- **Session Logging** - All override sessions recorded
- **Command Tracking** - Individual commands logged with metadata
- **Usage Analytics** - Track frequency and patterns
- **IP Monitoring** - Geographic access patterns

### Best Practices
1. **Rotate Credentials** - Change PIN and password regularly
2. **Monitor Usage** - Review audit logs for unusual activity
3. **Limit Admins** - Minimize number of override users
4. **Secure Communications** - Only use over HTTPS
5. **Regular Reviews** - Audit admin user list quarterly

## Troubleshooting

### Common Issues

#### "Invalid credentials" Error
- Verify email spelling and case
- Confirm PIN is exactly 4 digits (8612)
- Check password matches: InnovareAI!2025#
- Ensure workspace membership is active

#### "Access denied" Error
- User must be InnovareAI workspace member
- Check workspace_members table for user_id
- Verify workspace name contains "InnovareAI"

#### "Authentication failed" Error
- Database connection issues
- Check Supabase service role key
- Verify migration was applied successfully

### Diagnostic Commands

#### Check Admin Users
```sql
SELECT email, usage_count, last_used, is_active 
FROM sam_admin_users 
WHERE workspace_id IN (
    SELECT id FROM workspaces WHERE name ILIKE '%InnovareAI%'
);
```

#### Review Recent Sessions
```sql
SELECT s.session_start, s.ip_address, u.email, s.commands_executed
FROM sam_override_sessions s
JOIN sam_admin_users u ON s.admin_user_id = u.id
ORDER BY s.session_start DESC
LIMIT 10;
```

## Maintenance

### Regular Tasks
- **Weekly**: Review override session logs
- **Monthly**: Audit admin user list
- **Quarterly**: Rotate override password
- **Annually**: Review security architecture

### Performance Monitoring
- Track override session frequency
- Monitor command execution times
- Analyze usage patterns by admin
- Review error rates and failure types

### Backup Procedures
- Include override tables in database backups
- Export admin user list (hashed credentials only)
- Maintain audit trail archives
- Document recovery procedures

## Version History

- **v1.0** (2025-09-16): Initial implementation with basic override functionality
- **Future**: Multi-factor authentication, role-based access, API rate limiting

---

**⚠️ CRITICAL SECURITY NOTE**
This system bypasses standard authentication flows. Only grant override access to trusted administrators with legitimate business need for direct SAM access. Monitor usage carefully and revoke access immediately for former team members.