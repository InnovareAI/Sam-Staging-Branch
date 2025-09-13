# SAM AI Supabase Authentication Integration Plan

## 🎯 Current State Analysis

### Existing Database Architecture ✅
Your Supabase database already has an excellent multi-tenant foundation:

**Core Auth Tables:**
- **users** - Clerk integration with workspace references
- **organizations** - Multi-tenant organizations with subscription tiers
- **workspaces** - Team workspaces within organizations  
- **tenants** - Tenant management system
- **user_organizations** - User-org relationships with roles
- **workspace_members** - Workspace membership with roles

**Key Features:**
- ✅ UUID-based tenant isolation
- ✅ Clerk authentication ready (clerk_id field)
- ✅ Multi-level tenancy (Organizations → Workspaces → Users)
- ✅ Role-based access control (admin, member roles)
- ✅ Subscription management (trial, paid tiers)
- ✅ Current/default workspace switching

## 🚀 Integration Implementation Plan

### Phase 1: Supabase Auth Client Setup
**Goal**: Replace localStorage with Supabase authentication

#### 1.1 Create Supabase Auth Hooks
```typescript
// /app/hooks/useAuth.ts
- useAuth() hook for authentication state
- useUser() hook for user data
- useWorkspace() hook for workspace management
- useOrganization() hook for org data
```

#### 1.2 Auth Context Provider
```typescript
// /app/providers/AuthProvider.tsx
- Supabase auth state management
- User session persistence
- Workspace/organization context
- Role-based permissions
```

### Phase 2: User Authentication Flow
**Goal**: Implement complete auth flow with tenant isolation

#### 2.1 Authentication Pages
```typescript
// Replace current anonymous system with:
/app/auth/sign-in/page.tsx - Supabase Auth UI
/app/auth/sign-up/page.tsx - Registration with org creation
/app/auth/callback/page.tsx - Auth callback handler
```

#### 2.2 Workspace Selection
```typescript
// /app/workspace/select/page.tsx
- List user's workspaces
- Default workspace detection
- Workspace switching capability
```

### Phase 3: Multi-Tenant Data Access
**Goal**: Secure all data operations with tenant isolation

#### 3.1 Database Access Layer
```typescript
// /app/lib/supabase-client.ts
- Tenant-aware database client
- Row Level Security (RLS) policies
- Workspace-scoped queries
- Organization-level isolation
```

#### 3.2 API Route Protection
```typescript
// Update all API routes:
/app/api/sam/chat/route.ts - Add user/workspace context
/app/api/knowledge/route.ts - Tenant-scoped knowledge base
/app/api/* - All routes require authentication
```

### Phase 4: Sam AI Integration
**Goal**: Make Sam AI tenant-aware and personalized

#### 4.1 Conversation Persistence
```typescript
// Update Sam conversations:
- Link conversations to user_id + workspace_id
- Tenant-isolated conversation history
- Workspace-shared knowledge base
- Organization-level AI settings
```

#### 4.2 Knowledge Base Integration
```typescript
// Multi-tenant knowledge base:
- Organization-scoped knowledge base
- Workspace-specific training data
- User-level conversation context
- Shared vs private knowledge
```

### Phase 5: UI/UX Updates
**Goal**: Complete authenticated user experience

#### 5.1 Navigation Updates
```typescript
// /app/components/Navigation.tsx
- User profile display
- Workspace switcher
- Organization settings
- Sign out functionality
```

#### 5.2 Dashboard Enhancements
```typescript
// Add authenticated features:
- User onboarding flow
- Workspace management
- Team member invitations
- Usage analytics per tenant
```

## 🔧 Technical Implementation Details

### Database Schema Utilization

#### User Management
```sql
-- Users table (already exists)
users: {
  id: uuid,
  clerk_id: text, -- Clerk integration
  email: text,
  first_name: text,
  last_name: text,
  default_workspace_id: uuid,
  current_workspace_id: uuid
}
```

#### Multi-Tenant Structure
```sql
-- Organizations (already exists)
organizations: {
  id: uuid,
  name: varchar,
  slug: varchar,
  subscription_tier: varchar,
  settings: jsonb
}

-- Workspaces (already exists)
workspaces: {
  id: uuid,
  name: text,
  owner_id: uuid,
  settings: jsonb,
  is_active: boolean
}

-- Membership tables (already exist)
user_organizations: { user_id, organization_id, role }
workspace_members: { workspace_id, user_id, role }
```

### Row Level Security (RLS) Policies

#### Users Table
```sql
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = clerk_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid()::text = clerk_id);
```

#### Workspace Data
```sql
-- Users can only access their workspace data
CREATE POLICY "Workspace members can access data" ON [table_name]
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members 
      WHERE user_id = (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
      )
    )
  );
```

#### Organization Data
```sql
-- Users can only access their organization data  
CREATE POLICY "Organization members can access data" ON [table_name]
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM user_organizations
      WHERE user_id = (
        SELECT id FROM users WHERE clerk_id = auth.uid()::text
      )
    )
  );
```

### Authentication Flow

#### 1. User Signs In
```typescript
// Clerk handles authentication
// Webhook creates/updates user in Supabase
// User gets redirected to workspace selection
```

#### 2. Workspace Selection  
```typescript
// Query user's workspaces
// Set current_workspace_id
// Redirect to main app
```

#### 3. Authenticated App
```typescript
// All queries scoped to current workspace
// Sam AI conversations linked to user + workspace
// Knowledge base shared within organization
```

## 📋 Implementation Checklist

### Phase 1: Setup ✅
- [x] Analyze existing database structure
- [ ] Create Supabase auth hooks
- [ ] Build authentication provider
- [ ] Set up RLS policies

### Phase 2: Authentication ✅
- [ ] Replace localStorage auth with Supabase
- [ ] Build sign-in/sign-up flows
- [ ] Create workspace selection
- [ ] Add auth callback handling

### Phase 3: Data Layer ✅
- [ ] Update all API routes for auth
- [ ] Implement tenant-scoped queries
- [ ] Add workspace switching
- [ ] Test data isolation

### Phase 4: Sam AI Integration ✅
- [ ] Link conversations to users
- [ ] Add workspace context to AI
- [ ] Update knowledge base queries
- [ ] Test multi-tenant AI responses

### Phase 5: UI/UX ✅
- [ ] Add user profile components
- [ ] Build workspace switcher
- [ ] Update navigation
- [ ] Add team management

## 🎯 Expected Outcomes

### Security Benefits
- ✅ Complete tenant data isolation
- ✅ Row-level security enforcement
- ✅ Role-based access control
- ✅ Secure API authentication

### User Experience
- ✅ Seamless authentication flow
- ✅ Workspace switching capability
- ✅ Team collaboration features
- ✅ Personalized Sam AI experience

### Business Benefits
- ✅ Multi-tenant SaaS architecture
- ✅ Subscription management
- ✅ Enterprise-ready security
- ✅ Scalable team management

## 🚀 Next Steps

1. **Start with Phase 1**: Create authentication hooks and provider
2. **Test thoroughly**: Each phase should be tested before moving to next
3. **Maintain compatibility**: Keep current features working during transition
4. **Create milestone**: Save state before major changes

---

**This plan leverages your excellent existing database structure while adding robust authentication and multi-tenant capabilities to Sam AI.**