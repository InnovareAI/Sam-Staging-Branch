# SAM AI Platform - Admin Database Foundation

## 📊 Database Architecture Overview

SAM AI Platform uses **Supabase (PostgreSQL)** with comprehensive **Row Level Security (RLS)** for multi-tenant data isolation. The platform supports both Clerk (legacy) and Supabase Auth for flexible authentication strategies.

### 🔗 Database Connection
- **Supabase Project ID**: `latxadqrvrrrcvkktrog`
- **Dashboard URL**: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog
- **Environment**: Production-ready with staging/development environments

---

## 🏗️ Core Database Tables

### 1. **Users Table** (`public.users`)
**Purpose**: Central user management with dual authentication support

```sql
CREATE TABLE public.users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,          -- Supabase Auth ID (primary)
  clerk_id TEXT UNIQUE,                                   -- Clerk ID (optional, legacy)
  email TEXT UNIQUE NOT NULL,                            -- User email
  first_name TEXT,                                       -- First name
  last_name TEXT,                                        -- Last name
  image_url TEXT,                                        -- Profile image
  current_workspace_id UUID,                             -- Active workspace reference
  created_at TIMESTAMPTZ DEFAULT NOW(),                  -- Creation timestamp
  updated_at TIMESTAMPTZ DEFAULT NOW()                   -- Auto-updated timestamp
);
```

**Admin Capabilities**:
- View all user profiles and activity
- Manage user account status
- Track user workspace assignments
- Monitor user creation and update patterns

**Key Indexes**:
- `idx_users_clerk_id` - Fast Clerk ID lookups
- `idx_users_email` - Email-based queries

**RLS Policies**:
- Users can read/update their own data
- Service role has full access for admin operations

---

### 2. **Organizations Table** (`public.organizations`)
**Purpose**: Multi-tenant organization management (Clerk integration ready)

```sql
CREATE TABLE public.organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,         -- Organization UUID
  clerk_org_id TEXT UNIQUE,                              -- Clerk organization ID (optional)
  name TEXT NOT NULL,                                    -- Organization display name
  slug TEXT UNIQUE NOT NULL,                             -- URL-safe organization identifier
  created_by UUID NOT NULL,                              -- Creator user ID
  settings JSONB DEFAULT '{}',                           -- Organization configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),     -- Creation timestamp
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()      -- Auto-updated timestamp
);
```

**Admin Capabilities**:
- Manage all organizations across the platform
- Configure organization-specific settings
- Monitor organization growth and usage
- Handle organization mergers/transfers

**Key Features**:
- **JSONB Settings**: Flexible configuration storage
- **Auto-generated Slugs**: URL-safe organization identifiers
- **Audit Trail**: Creation and update timestamps

**RLS Policies**:
- Users see organizations they belong to
- Organization admins can update their org
- Service role has full access for admin operations

---

### 3. **User Organizations Junction** (`public.user_organizations`)
**Purpose**: Many-to-many user-organization relationships with roles

```sql
CREATE TABLE public.user_organizations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',                            -- member, admin, owner
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);
```

**Admin Role Management**:
- **owner**: Full organization control, billing, deletion
- **admin**: User management, settings, member invitations
- **member**: Standard access to organization features

**Admin Capabilities**:
- View all user-organization relationships
- Modify user roles across organizations
- Audit organization membership changes
- Handle role escalations and de-escalations

---

### 4. **Workspaces Table** (`public.workspaces`)
**Purpose**: Sub-organization workspace management for project isolation

```sql
CREATE TABLE public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,                                    -- Workspace display name
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}',                           -- Workspace configuration
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Admin Capabilities**:
- Monitor workspace usage across organizations
- Manage workspace ownership transfers
- Configure workspace-specific settings
- Archive/restore workspaces

**Key Features**:
- **Organization Hierarchy**: Workspaces belong to organizations
- **Flexible Settings**: JSONB configuration per workspace
- **Owner Tracking**: Clear ownership and creation audit

---

### 5. **Workspace Members** (`public.workspace_members`)
**Purpose**: Workspace-level access control and collaboration

```sql
CREATE TABLE public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',                            -- member, admin, owner
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);
```

**Admin Capabilities**:
- View all workspace memberships
- Manage user access to specific workspaces
- Audit workspace collaboration patterns
- Handle access disputes and escalations

---

### 6. **Knowledge Base** (`public.knowledge_base`)
**Purpose**: Centralized SAM AI knowledge storage and retrieval

```sql
CREATE TABLE public.knowledge_base (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,                              -- 'core', 'conversational-design', 'strategy', 'verticals'
    subcategory TEXT,                                    -- Optional organization
    title TEXT NOT NULL,                                 -- Knowledge entry title
    content TEXT NOT NULL,                               -- Full knowledge content
    tags TEXT[] DEFAULT '{}',                            -- Searchable tags array
    version TEXT DEFAULT '4.4',                          -- Knowledge version
    is_active BOOLEAN DEFAULT true,                      -- Active status
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Admin Capabilities**:
- Manage SAM AI's knowledge base content
- Version control for knowledge updates
- Category and tag management
- Full-text search across all knowledge
- Performance analytics on knowledge usage

**Special Features**:
- **Full-Text Search**: PostgreSQL GIN indexes for content search
- **Tag-based Search**: Array-based tagging system
- **Version Control**: Track knowledge base evolution
- **Search Function**: `search_knowledge_base()` for complex queries

---

### 7. **SAM Conversations** (`sam_conversations`)
**Purpose**: Complete conversation logging and analytics

```sql
-- Table structure inferred from code usage
CREATE TABLE sam_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),             -- User who initiated (nullable for anonymous)
  organization_id TEXT,                                  -- Organization context (Clerk org ID)
  message TEXT NOT NULL,                                 -- User message
  response TEXT NOT NULL,                                -- SAM AI response
  metadata JSONB DEFAULT '{}',                          -- Conversation metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Admin Capabilities**:
- Monitor all SAM AI conversations across platform
- Analyze conversation patterns and success rates
- Track script progression and user engagement
- Quality assurance and AI performance monitoring
- Support and troubleshooting assistance

**Metadata Structure**:
```json
{
  "scriptPosition": "greeting|dayResponse|discovery|etc",
  "scriptProgress": { "greeting": true, "tour": false },
  "timestamp": "2025-01-10T10:30:00Z",
  "userType": "authenticated|anonymous",
  "sessionId": "unique-session-identifier"
}
```

---

## 🔐 Security & Access Control

### Row Level Security (RLS) Implementation
All tables use PostgreSQL RLS for multi-tenant data isolation:

**Policy Pattern**:
```sql
-- User access to their own data
CREATE POLICY "Users can access own data" ON table_name
  FOR SELECT USING (user_id = auth.uid());

-- Organization-scoped access
CREATE POLICY "Organization members can access org data" ON table_name
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations 
      WHERE user_id = auth.uid()
    )
  );

-- Service role (admin) full access
CREATE POLICY "Service role full access" ON table_name
  FOR ALL USING (auth.role() = 'service_role');
```

### Admin Access Levels
1. **Super Admin**: Service role access to all data
2. **Organization Admin**: Full access within organization
3. **Workspace Admin**: Limited to specific workspace management
4. **Support**: Read-only access for troubleshooting

---

## 📈 Admin Dashboard Requirements

### Essential Admin Views

#### 1. **User Management Dashboard**
- Total users, active users, growth trends
- User registration patterns and sources
- Account status and verification levels
- Organization membership overview

#### 2. **Organization Analytics**
- Organization growth and churn metrics
- Per-organization usage statistics
- Revenue tracking and billing status
- Feature adoption rates

#### 3. **Workspace Monitoring**
- Workspace creation and usage patterns
- Collaboration metrics and team sizes
- Resource utilization per workspace
- Performance and storage metrics

#### 4. **SAM AI Performance**
- Conversation volume and success rates
- Script progression analytics
- User satisfaction and engagement scores
- Error rates and resolution times

#### 5. **Knowledge Base Management**
- Content performance and usage analytics
- Search query analysis and optimization
- Version control and update tracking
- Content gap identification

### Advanced Admin Features

#### **Multi-Tenant Data Queries**
```sql
-- Get organization usage summary
SELECT 
  o.name as organization_name,
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT w.id) as total_workspaces,
  COUNT(DISTINCT sc.id) as total_conversations
FROM organizations o
LEFT JOIN user_organizations uo ON o.id = uo.organization_id
LEFT JOIN users u ON uo.user_id = u.id
LEFT JOIN workspaces w ON o.id = w.organization_id
LEFT JOIN sam_conversations sc ON o.clerk_org_id = sc.organization_id
GROUP BY o.id, o.name
ORDER BY total_conversations DESC;
```

#### **User Activity Analysis**
```sql
-- Get user engagement metrics
SELECT 
  u.email,
  u.created_at as user_since,
  COUNT(sc.id) as total_conversations,
  MAX(sc.created_at) as last_conversation,
  COUNT(DISTINCT DATE(sc.created_at)) as active_days
FROM users u
LEFT JOIN sam_conversations sc ON u.id::text = sc.user_id
GROUP BY u.id, u.email, u.created_at
ORDER BY total_conversations DESC;
```

#### **Knowledge Base Analytics**
```sql
-- Knowledge base usage and performance
SELECT 
  category,
  COUNT(*) as total_entries,
  AVG(LENGTH(content)) as avg_content_length,
  COUNT(*) FILTER (WHERE is_active = true) as active_entries,
  array_agg(DISTINCT unnest(tags)) as all_tags
FROM knowledge_base
GROUP BY category
ORDER BY total_entries DESC;
```

---

## 🛠️ Admin API Endpoints (Recommended)

### User Management
- `GET /api/admin/users` - List all users with filters
- `GET /api/admin/users/:id` - Get specific user details
- `PUT /api/admin/users/:id` - Update user information
- `DELETE /api/admin/users/:id` - Deactivate user account

### Organization Management
- `GET /api/admin/organizations` - List all organizations
- `POST /api/admin/organizations` - Create new organization
- `PUT /api/admin/organizations/:id` - Update organization
- `GET /api/admin/organizations/:id/members` - List organization members
- `POST /api/admin/organizations/:id/members` - Add organization member

### Analytics & Monitoring
- `GET /api/admin/analytics/users` - User analytics dashboard data
- `GET /api/admin/analytics/conversations` - SAM conversation analytics
- `GET /api/admin/analytics/organizations` - Organization performance metrics

### Knowledge Base Management
- `GET /api/admin/knowledge` - Knowledge base entries with admin access
- `POST /api/admin/knowledge` - Create knowledge entry
- `PUT /api/admin/knowledge/:id` - Update knowledge entry
- `DELETE /api/admin/knowledge/:id` - Archive knowledge entry

---

## 🚀 Implementation Recommendations

### Database Optimization
1. **Indexes**: Ensure proper indexes on frequently queried columns
2. **Partitioning**: Consider partitioning large tables like conversations by date
3. **Archiving**: Implement data archiving for old conversations
4. **Monitoring**: Set up query performance monitoring

### Security Best Practices
1. **Audit Logging**: Log all admin actions and data changes
2. **Access Controls**: Implement fine-grained admin permissions
3. **Data Encryption**: Encrypt sensitive data at rest and in transit
4. **Backup Strategy**: Automated daily backups with retention policies

### Scalability Considerations
1. **Read Replicas**: Use read replicas for analytics queries
2. **Caching**: Implement Redis caching for frequently accessed data
3. **Connection Pooling**: Use connection pooling for database efficiency
4. **Query Optimization**: Regular query performance analysis

---

## 📝 Migration & Maintenance

### Current Migration Files
- `001_create_users_table.sql` - Core user and organization structure
- `001_create_workspace_tables.sql` - Advanced workspace management
- `20250109_create_organizations_table.sql` - Clerk organization sync
- `20250109_update_conversations_for_clerk_orgs.sql` - Conversation org linking
- `20250909140000_create_knowledge_base.sql` - SAM AI knowledge system
- `20250910_update_for_supabase_auth.sql` - Supabase Auth compatibility

### Maintenance Tasks
1. **Regular Backups**: Automated daily database backups
2. **Index Maintenance**: Weekly index optimization
3. **Data Cleanup**: Monthly cleanup of inactive/archived data
4. **Performance Monitoring**: Continuous query performance tracking
5. **Security Updates**: Regular security patch application

---

## 💡 Admin Dashboard UI Components

### Recommended Component Structure
```
/admin
├── /dashboard           # Main admin dashboard
├── /users              # User management interface
├── /organizations      # Organization administration
├── /workspaces         # Workspace management
├── /conversations      # SAM AI conversation monitoring
├── /knowledge          # Knowledge base administration
├── /analytics          # Advanced analytics and reporting
└── /settings           # Platform configuration
```

### Key Features Per Section
- **Real-time metrics and KPIs**
- **Advanced filtering and search**
- **Bulk operations for data management**
- **Export capabilities for reporting**
- **Audit logs and change tracking**
- **Role-based access control**

---

## 🎯 Next Steps for Admin Implementation

1. **Create Admin API Routes** - Build secure API endpoints for admin operations
2. **Build Admin Dashboard UI** - Responsive admin interface with real-time data
3. **Implement Analytics** - Comprehensive analytics and reporting system
4. **Set Up Monitoring** - Database and application performance monitoring
5. **Security Hardening** - Additional security measures and audit logging
6. **Documentation** - Complete admin user documentation and training

This database foundation provides everything needed for a comprehensive admin system with full multi-tenant support, security, and scalability built-in.