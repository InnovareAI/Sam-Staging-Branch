'use client';

import { pool } from '@/lib/db';
import { supabase } from './supabase';

// Enhanced Supabase client with tenant-aware helpers
export class TenantAwareSupabaseClient {
  private client = supabase;
  private currentUserId: string | null = null;
  private currentWorkspaceId: string | null = null;
  private currentOrganizationId: string | null = null;

  // Set current user context
  setUserContext(userId: string, workspaceId?: string, organizationId?: string) {
    this.currentUserId = userId;
    this.currentWorkspaceId = workspaceId || null;
    this.currentOrganizationId = organizationId || null;
  }

  // Clear user context
  clearUserContext() {
    this.currentUserId = null;
    this.currentWorkspaceId = null;
    this.currentOrganizationId = null;
  }

  // Get workspace-scoped query builder
  workspaceQuery(tableName: string) {
    if (!this.currentWorkspaceId) {
      throw new Error('No workspace context set. Call setUserContext first.');
    }

    return this.client
      .from(tableName)
      .select('*')
      .eq('workspace_id', this.currentWorkspaceId);
  }

  // Get organization-scoped query builder
  organizationQuery(tableName: string) {
    if (!this.currentOrganizationId) {
      throw new Error('No organization context set. Call setUserContext first.');
    }

    return this.client
      .from(tableName)
      .select('*')
      .eq('organization_id', this.currentOrganizationId);
  }

  // Get user-scoped query builder
  userQuery(tableName: string) {
    if (!this.currentUserId) {
      throw new Error('No user context set. Call setUserContext first.');
    }

    return this.client
      .from(tableName)
      .select('*')
      .eq('user_id', this.currentUserId);
  }

  // Generic query builder with automatic tenant filtering
  tenantQuery(tableName: string, scope: 'user' | 'workspace' | 'organization' = 'workspace') {
    const baseQuery = this.client.from(tableName).select('*');

    switch (scope) {
      case 'user':
        if (!this.currentUserId) {
          throw new Error('No user context set for user-scoped query.');
        }
        return baseQuery.eq('user_id', this.currentUserId);

      case 'workspace':
        if (!this.currentWorkspaceId) {
          throw new Error('No workspace context set for workspace-scoped query.');
        }
        return baseQuery.eq('workspace_id', this.currentWorkspaceId);

      case 'organization':
        if (!this.currentOrganizationId) {
          throw new Error('No organization context set for organization-scoped query.');
        }
        return baseQuery.eq('organization_id', this.currentOrganizationId);

      default:
        return baseQuery;
    }
  }

  // Insert with automatic tenant context
  async tenantInsert(tableName: string, data: any, scope: 'user' | 'workspace' | 'organization' = 'workspace') {
    const insertData = { ...data };

    // Add tenant context based on scope
    switch (scope) {
      case 'user':
        if (this.currentUserId) {
          insertData.user_id = this.currentUserId;
        }
        break;

      case 'workspace':
        if (this.currentWorkspaceId) {
          insertData.workspace_id = this.currentWorkspaceId;
        }
        if (this.currentUserId) {
          insertData.user_id = this.currentUserId; // Many tables have both
        }
        break;

      case 'organization':
        if (this.currentOrganizationId) {
          insertData.organization_id = this.currentOrganizationId;
        }
        if (this.currentUserId) {
          insertData.user_id = this.currentUserId; // Many tables have both
        }
        break;
    }

    return this.client
      .from(tableName)
      .insert([insertData])
      .select();
  }

  // Update with tenant filtering
  async tenantUpdate(
    tableName: string, 
    updates: any, 
    filters: Record<string, any> = {},
    scope: 'user' | 'workspace' | 'organization' = 'workspace'
  ) {
    let query = this.client.from(tableName).update(updates);

    // Add tenant filtering
    switch (scope) {
      case 'user':
        if (this.currentUserId) {
          query = query.eq('user_id', this.currentUserId);
        }
        break;

      case 'workspace':
        if (this.currentWorkspaceId) {
          query = query.eq('workspace_id', this.currentWorkspaceId);
        }
        break;

      case 'organization':
        if (this.currentOrganizationId) {
          query = query.eq('organization_id', this.currentOrganizationId);
        }
        break;
    }

    // Add additional filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    return query.select();
  }

  // Delete with tenant filtering
  async tenantDelete(
    tableName: string, 
    filters: Record<string, any> = {},
    scope: 'user' | 'workspace' | 'organization' = 'workspace'
  ) {
    let query = this.client.from(tableName).delete();

    // Add tenant filtering
    switch (scope) {
      case 'user':
        if (this.currentUserId) {
          query = query.eq('user_id', this.currentUserId);
        }
        break;

      case 'workspace':
        if (this.currentWorkspaceId) {
          query = query.eq('workspace_id', this.currentWorkspaceId);
        }
        break;

      case 'organization':
        if (this.currentOrganizationId) {
          query = query.eq('organization_id', this.currentOrganizationId);
        }
        break;
    }

    // Add additional filters
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });

    return query;
  }

  // Direct access to underlying client for complex queries
  get raw() {
    return this.client;
  }

  // Context getters
  get userId() {
    return this.currentUserId;
  }

  get workspaceId() {
    return this.currentWorkspaceId;
  }

  get organizationId() {
    return this.currentOrganizationId;
  }

  // Check if context is set
  hasUserContext(): boolean {
    return this.currentUserId !== null;
  }

  hasWorkspaceContext(): boolean {
    return this.currentWorkspaceId !== null;
  }

  hasOrganizationContext(): boolean {
    return this.currentOrganizationId !== null;
  }
}

// Export singleton instance
export const tenantSupabase = new TenantAwareSupabaseClient();

// Export for direct use in components
export { supabase } from './supabase';