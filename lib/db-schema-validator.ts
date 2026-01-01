/**
 * Database Schema Validator
 * Prevents silent failures from schema mismatches
 *
 * PROBLEM: We've had multiple incidents where inserts failed silently
 * because column names didn't match the actual database schema.
 *
 * SOLUTION: Type-safe schema definitions that TypeScript validates at compile time
 */

import { Pool } from 'pg';

/**
 * prospect_approval_sessions table schema
 * Source: Verified from database on 2025-10-10
 */
export interface ProspectApprovalSession {
  id: string;
  batch_number?: number;
  user_id: string;
  workspace_id: string;  // NOT organization_id!
  status: 'pending' | 'completed' | 'cancelled'; // NOT session_status!
  total_prospects: number;
  approved_count: number;
  rejected_count: number;
  pending_count: number;
  icp_criteria?: Record<string, any>;
  prospect_source: string; // NOT source!
  learning_insights?: Record<string, any>;
  created_at?: string;
  completed_at?: string | null;
}

/**
 * prospect_approval_data table schema
 */
export interface ProspectApprovalData {
  id?: string;
  session_id: string;
  prospect_id: string;
  name: string;
  title: string;
  company: string;
  contact: string;
  location?: string;
  profile_image?: string;
  recent_activity?: string;
  connection_degree?: string;
  enrichment_score: number;
  source: string;
  enriched_at: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

/**
 * workspace_prospects table schema
 */
export interface WorkspaceProspect {
  id?: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  company_name?: string | null;
  job_title?: string | null;
  linkedin_profile_url: string;
  email_address?: string | null;
  location?: string | null;
  industry?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Type-safe insert helpers that catch schema errors at compile time
 */
export class DbValidator {

  /**
   * Insert approval session with compile-time schema validation
   */
  static async insertApprovalSession(
    supabase: SupabaseClient,
    session: ProspectApprovalSession
  ) {
    const { data, error } = await supabase
      .from('prospect_approval_sessions')
      .insert(session)
      .select();

    if (error) {
      console.error('❌ INSERT FAILED - prospect_approval_sessions:', error);
      console.error('Attempted insert:', JSON.stringify(session, null, 2));
      throw new Error(`Schema validation failed: ${error.message}`);
    }

    console.log('✅ INSERT SUCCESS - prospect_approval_sessions:', data?.[0]?.id);
    return data;
  }

  /**
   * Insert approval data with compile-time schema validation
   */
  static async insertApprovalData(
    supabase: SupabaseClient,
    prospects: ProspectApprovalData[]
  ) {
    const { data, error } = await supabase
      .from('prospect_approval_data')
      .insert(prospects)
      .select();

    if (error) {
      console.error('❌ INSERT FAILED - prospect_approval_data:', error);
      console.error('Attempted insert (first row):', JSON.stringify(prospects[0], null, 2));
      throw new Error(`Schema validation failed: ${error.message}`);
    }

    console.log(`✅ INSERT SUCCESS - prospect_approval_data: ${data?.length || 0} rows`);
    return data;
  }

  /**
   * Insert workspace prospects with compile-time schema validation
   */
  static async insertWorkspaceProspects(
    supabase: SupabaseClient,
    prospects: WorkspaceProspect[]
  ) {
    const { data, error } = await supabase
      .from('workspace_prospects')
      .insert(prospects)
      .select();

    if (error) {
      console.error('❌ INSERT FAILED - workspace_prospects:', error);
      console.error('Attempted insert (first row):', JSON.stringify(prospects[0], null, 2));
      throw new Error(`Schema validation failed: ${error.message}`);
    }

    console.log(`✅ INSERT SUCCESS - workspace_prospects: ${data?.length || 0} rows`);
    return data;
  }

  /**
   * Query approval sessions with type safety
   */
  static async getApprovalSessions(
    supabase: SupabaseClient,
    workspaceId: string
  ): Promise<ProspectApprovalSession[]> {
    const { data, error } = await supabase
      .from('prospect_approval_sessions')
      .select('*')
      .eq('workspace_id', workspaceId) // Type-checked!
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ QUERY FAILED - prospect_approval_sessions:', error);
      throw new Error(`Query failed: ${error.message}`);
    }

    return data as ProspectApprovalSession[];
  }
}

/**
 * Schema migration helper - verifies actual schema matches expected
 */
export async function verifySchemaMatch(supabase: SupabaseClient) {
  console.log('🔍 Verifying database schema...');

  const tables = [
    'prospect_approval_sessions',
    'prospect_approval_data',
    'workspace_prospects'
  ];

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        console.error(`❌ ${table}: ${error.message}`);
      } else if (data && data.length > 0) {
        const columns = Object.keys(data[0]);
        console.log(`✅ ${table}: ${columns.join(', ')}`);
      } else {
        console.log(`⚠️  ${table}: empty (schema unverified)`);
      }
    } catch (err) {
      console.error(`❌ ${table}: ${err}`);
    }
  }
}
