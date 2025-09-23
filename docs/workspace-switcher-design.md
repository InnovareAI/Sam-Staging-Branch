# Workspace Switcher & Managed Account Strategy

## 🎯 DESIGN OVERVIEW

### Privacy-Safe Multi-Workspace Management
- **InnovareAI Team**: Workspace switcher + pooled LinkedIn accounts
- **Client Users**: Single workspace view only
- **LinkedIn Accounts**: Shared pool managed by InnovareAI team

## 🔐 SECURITY MODEL

### Access Levels
```typescript
enum UserAccessLevel {
  SUPER_ADMIN = 'super_admin',     // tl@innovareai.com - all workspaces
  MANAGER = 'manager',             // @innovareai.com - assigned workspaces  
  CLIENT_ADMIN = 'client_admin',   // Client workspace admin
  CLIENT_USER = 'client_user'      // Client workspace user
}
```

### Workspace Visibility Rules
```typescript
function getVisibleWorkspaces(user: User): Workspace[] {
  if (user.access_level === 'super_admin') {
    return getAllWorkspaces(); // All workspaces
  }
  
  if (user.access_level === 'manager') {
    return getWorkspacesByManagerEmail(user.email); // Assigned workspaces
  }
  
  // Client users: only their own workspace
  return getUserWorkspaces(user.id).filter(ws => ws.id === user.current_workspace_id);
}
```

## 🔄 WORKSPACE SWITCHER UI

### For InnovareAI Team (Managers)
```jsx
<WorkspaceSwitcher>
  <WorkspaceOption workspace="InnovareAI" role="owner" />
  <WorkspaceOption workspace="ChillMine" role="owner" />
  <WorkspaceOption workspace="3cubed" role="admin" />
  <WorkspaceOption workspace="Sendingcell" role="admin" />
  <WorkspaceOption workspace="WT Matchmaker" role="admin" />
</WorkspaceSwitcher>
```

### For Client Users
```jsx
// No switcher - fixed workspace context
<WorkspaceHeader>
  <h1>ChillMine Workspace</h1>
  <p>You are a member of this workspace</p>
</WorkspaceHeader>
```

## 🔗 LINKEDIN ACCOUNT POOLING

### Shared Resource Management
```typescript
interface LinkedInAccountPool {
  accounts: {
    id: string;
    name: string;
    status: 'active' | 'credentials_needed' | 'maintenance';
    assignedTo: string | null; // workspace_id or null for available
    managedBy: string[]; // user_ids who can manage this account
  }[];
}

// Example pool configuration
const accountPool = {
  accounts: [
    {
      id: '3Zj8ks8aSrKg0ySaLQo_8A',
      name: 'Irish Cita De Ade', 
      status: 'active',
      assignedTo: null, // Available for assignment
      managedBy: ['tl@innovareai.com', 'cl@innovareai.com']
    },
    {
      id: 'Hut6zgezT_SWmwL-XIkjSg',
      name: 'Thorsten Linz',
      status: 'credentials_needed',
      assignedTo: 'global', // Admin account - all workspaces
      managedBy: ['tl@innovareai.com']
    }
  ]
};
```

## 📊 CAMPAIGN DATA ISOLATION

### Workspace-Scoped Operations
```typescript
// Campaign creation with workspace context
async function createCampaign(data: CampaignData, workspaceContext: string) {
  return {
    ...data,
    workspace_id: workspaceContext,
    linkedin_accounts: getAvailableAccountsForWorkspace(workspaceContext),
    created_by: getCurrentUser().id,
    managed_by_workspace: workspaceContext
  };
}

// Data filtering by workspace
async function getCampaigns(user: User) {
  if (user.access_level === 'super_admin') {
    return getAllCampaigns(); // All campaigns across workspaces
  }
  
  if (user.access_level === 'manager') {
    const visibleWorkspaces = getVisibleWorkspaces(user);
    return getCampaignsByWorkspaces(visibleWorkspaces.map(w => w.id));
  }
  
  // Client users: only their workspace campaigns
  return getCampaignsByWorkspace(user.current_workspace_id);
}
```

## 🎯 IMPLEMENTATION PHASES

### Phase 1: Access Level System
- [ ] Add `access_level` column to users table
- [ ] Implement workspace visibility rules
- [ ] Create access level detection logic

### Phase 2: Workspace Switcher UI
- [ ] Build WorkspaceSwitcher component
- [ ] Add workspace context state management
- [ ] Implement role-based UI rendering

### Phase 3: LinkedIn Account Pooling
- [ ] Create `linkedin_account_pool` table
- [ ] Implement pool management APIs
- [ ] Build account assignment interface

### Phase 4: Campaign Workspace Context
- [ ] Add workspace_id to all campaign operations
- [ ] Implement workspace-scoped data filtering
- [ ] Create workspace performance dashboards

## 🔒 PRIVACY SAFEGUARDS

### What Clients CAN See:
- ✅ Their workspace campaigns and results
- ✅ Aggregated performance metrics  
- ✅ Campaign scheduling and management
- ✅ Prospect upload and management

### What Clients CANNOT See:
- ❌ LinkedIn account credentials or details
- ❌ Other workspaces' data
- ❌ Account management interfaces
- ❌ Cross-workspace analytics
- ❌ InnovareAI team operations

### What Managers CAN See:
- ✅ All assigned workspaces via switcher
- ✅ LinkedIn account pool management
- ✅ Cross-workspace performance analytics
- ✅ Account assignment and rotation
- ✅ Full campaign management

## 🚀 BENEFITS

### For InnovareAI Team:
- **Efficient Management**: Switch between client workspaces seamlessly
- **Resource Optimization**: Pool LinkedIn accounts across clients
- **Centralized Control**: Manage all campaigns from one interface
- **Performance Tracking**: Cross-workspace analytics and reporting

### For Clients:
- **Privacy Protection**: No access to other clients' data
- **Simplified Interface**: Focus on their own campaigns only
- **Professional Service**: Managed LinkedIn accounts without complexity
- **Performance Results**: Clear campaign metrics and ROI

### For System:
- **Scalability**: Easy to add new workspaces and accounts
- **Security**: Proper isolation and access controls
- **Efficiency**: Shared resources reduce account overhead
- **Compliance**: Clear data boundaries and audit trails

## 🔧 TECHNICAL ARCHITECTURE

```typescript
// Workspace Context Provider
const WorkspaceContext = createContext({
  currentWorkspace: null,
  availableWorkspaces: [],
  switchWorkspace: (workspaceId: string) => {},
  userAccessLevel: 'client_user'
});

// LinkedIn Account Manager
class LinkedInAccountManager {
  async getAvailableAccounts(workspaceId: string): Promise<LinkedInAccount[]>
  async assignAccountToWorkspace(accountId: string, workspaceId: string): Promise<void>
  async releaseAccountFromWorkspace(accountId: string): Promise<void>
  async getAccountUsageStats(): Promise<AccountUsageStats>
}

// Campaign Manager with Workspace Context
class CampaignManager {
  constructor(private workspaceContext: string) {}
  
  async createCampaign(data: CampaignData): Promise<Campaign>
  async getCampaigns(): Promise<Campaign[]> // Filtered by workspace
  async getCampaignMetrics(): Promise<Metrics> // Workspace-scoped
}
```

This design provides **efficient workspace management** for InnovareAI while maintaining **strict privacy boundaries** for clients.