/**
 * Workspace Prospect Manager
 * Handles prospect deduplication, team coordination, and messaging prevention
 * Ensures no prospect gets messaged twice from the same workspace
 */

import { supabaseAdmin } from '@/app/lib/supabase'

export interface WorkspaceProspect {
  id: string
  workspace_id: string
  email_address?: string
  linkedin_profile_url?: string
  phone_number?: string
  company_domain?: string
  full_name?: string
  first_name?: string
  last_name?: string
  job_title?: string
  company_name?: string
  location?: string
  assigned_to?: string
  prospect_status: 'new' | 'assigned' | 'contacted' | 'replied' | 'qualified' | 'converted' | 'closed'
  contact_count: number
  last_contacted_at?: string
  last_contacted_by?: string
  prospect_hash: string
}

export interface ContactEligibilityResult {
  can_contact: boolean
  reason: 'eligible' | 'assigned_to_other_user' | 'cooldown_period' | 'max_contacts_reached' | 'prospect_has_replied' | 'prospect_not_found'
  assigned_to?: string
  contact_count?: number
  last_contacted_at?: string
  cooldown_expires_at?: string
  max_contacts?: number
}

export interface WorkspaceAccount {
  id: string
  workspace_id: string
  user_id: string
  account_type: 'linkedin' | 'email' | 'whatsapp' | 'instagram'
  account_identifier: string
  account_name?: string
  connection_status: 'connected' | 'disconnected' | 'error' | 'suspended'
  daily_message_count: number
  daily_message_limit: number
  is_active: boolean
  is_primary: boolean
  is_currently_selected?: boolean
}

export interface ProspectContactAttempt {
  workspace_id: string
  prospect_id: string
  contacted_by: string
  account_used: string
  contact_method: string
  message_content?: string
  subject_line?: string
  campaign_id?: string
  platform_message_id?: string
  conversation_id?: string
}

export class WorkspaceProspectManager {
  private static readonly DEDUPLICATION_FIELDS = [
    'email_address',
    'linkedin_profile_url', 
    'phone_number',
    'company_domain'
  ]

  /**
   * Add or retrieve existing prospect with intelligent deduplication
   */
  static async addOrGetProspect(
    workspace_id: string,
    prospectData: Partial<WorkspaceProspect>,
    data_source: string = 'manual'
  ): Promise<WorkspaceProspect> {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase.rpc('add_or_get_workspace_prospect', {
      p_workspace_id: workspace_id,
      p_email_address: prospectData.email_address || null,
      p_linkedin_profile_url: prospectData.linkedin_profile_url || null,
      p_phone_number: prospectData.phone_number || null,
      p_company_domain: prospectData.company_domain || null,
      p_full_name: prospectData.full_name || null,
      p_first_name: prospectData.first_name || null,
      p_last_name: prospectData.last_name || null,
      p_job_title: prospectData.job_title || null,
      p_company_name: prospectData.company_name || null,
      p_location: prospectData.location || null,
      p_data_source: data_source
    })

    if (error) {
      throw new Error(`Failed to add prospect: ${error.message}`)
    }

    // Get the full prospect record
    const { data: prospect, error: fetchError } = await supabase
      .from('workspace_prospects')
      .select('*')
      .eq('id', data)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch prospect: ${fetchError.message}`)
    }

    return prospect
  }

  /**
   * Check if a prospect can be contacted by a specific user
   */
  static async canContactProspect(
    workspace_id: string,
    prospect_id: string,
    user_id: string,
    contact_method: string = 'any'
  ): Promise<ContactEligibilityResult> {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase.rpc('can_contact_prospect', {
      p_workspace_id: workspace_id,
      p_prospect_id: prospect_id,
      p_user_id: user_id,
      p_contact_method: contact_method
    })

    if (error) {
      throw new Error(`Failed to check contact eligibility: ${error.message}`)
    }

    return data as ContactEligibilityResult
  }

  /**
   * Record a prospect contact attempt
   */
  static async recordProspectContact(
    contactData: ProspectContactAttempt
  ): Promise<string> {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase.rpc('record_prospect_contact', {
      p_workspace_id: contactData.workspace_id,
      p_prospect_id: contactData.prospect_id,
      p_contacted_by: contactData.contacted_by,
      p_account_used: contactData.account_used,
      p_contact_method: contactData.contact_method,
      p_message_content: contactData.message_content || null,
      p_subject_line: contactData.subject_line || null,
      p_campaign_id: contactData.campaign_id || null,
      p_platform_message_id: contactData.platform_message_id || null,
      p_conversation_id: contactData.conversation_id || null
    })

    if (error) {
      throw new Error(`Failed to record contact: ${error.message}`)
    }

    return data
  }

  /**
   * Find potential duplicate prospects across different identifiers
   */
  static async findPotentialDuplicates(
    workspace_id: string,
    prospectData: Partial<WorkspaceProspect>,
    limit: number = 10
  ): Promise<WorkspaceProspect[]> {
    const supabase = supabaseAdmin()

    // Build OR conditions for potential matches
    const orConditions: any[] = []

    if (prospectData.email_address) {
      orConditions.push({ email_address: prospectData.email_address })
    }
    if (prospectData.linkedin_profile_url) {
      orConditions.push({ linkedin_profile_url: prospectData.linkedin_profile_url })
    }
    if (prospectData.phone_number) {
      orConditions.push({ phone_number: prospectData.phone_number })
    }
    if (prospectData.company_domain) {
      orConditions.push({ company_domain: prospectData.company_domain })
    }

    if (orConditions.length === 0) {
      return []
    }

    const { data, error } = await supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', workspace_id)
      .or(orConditions.map(condition => 
        Object.entries(condition).map(([key, value]) => `${key}.eq.${value}`).join(',')
      ).join(','))
      .limit(limit)

    if (error) {
      console.error('Failed to find duplicates:', error)
      return []
    }

    return data || []
  }

  /**
   * Get workspace prospects with contact history and assignment info
   */
  static async getWorkspaceProspects(
    workspace_id: string,
    options: {
      status?: string[]
      assigned_to?: string
      has_response?: boolean
      limit?: number
      offset?: number
      search?: string
    } = {}
  ): Promise<{
    prospects: any[]
    total: number
  }> {
    const supabase = supabaseAdmin()
    
    let query = supabase
      .from('workspace_prospect_summary')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspace_id)

    // Apply filters
    if (options.status && options.status.length > 0) {
      query = query.in('prospect_status', options.status)
    }

    if (options.assigned_to) {
      query = query.eq('assigned_to', options.assigned_to)
    }

    if (options.has_response !== undefined) {
      query = query.eq('has_response', options.has_response)
    }

    if (options.search) {
      query = query.or(`full_name.ilike.%${options.search}%,company_name.ilike.%${options.search}%`)
    }

    // Apply pagination
    if (options.offset) {
      query = query.range(options.offset, (options.offset + (options.limit || 50)) - 1)
    } else if (options.limit) {
      query = query.limit(options.limit)
    }

    query = query.order('most_recent_contact', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const { data, error, count } = await query

    if (error) {
      throw new Error(`Failed to get workspace prospects: ${error.message}`)
    }

    return {
      prospects: data || [],
      total: count || 0
    }
  }

  /**
   * Assign prospect to team member
   */
  static async assignProspect(
    workspace_id: string,
    prospect_id: string,
    assigned_to: string,
    assigned_by: string
  ): Promise<void> {
    const supabase = supabaseAdmin()

    // Verify prospect exists in workspace
    const { data: prospect, error: prospectError } = await supabase
      .from('workspace_prospects')
      .select('id')
      .eq('id', prospect_id)
      .eq('workspace_id', workspace_id)
      .single()

    if (prospectError || !prospect) {
      throw new Error('Prospect not found in workspace')
    }

    // Update assignment
    const { error } = await supabase
      .from('workspace_prospects')
      .update({
        assigned_to: assigned_to,
        prospect_status: 'assigned',
        updated_at: new Date().toISOString()
      })
      .eq('id', prospect_id)

    if (error) {
      throw new Error(`Failed to assign prospect: ${error.message}`)
    }
  }

  /**
   * Bulk import prospects with deduplication
   */
  static async bulkImportProspects(
    workspace_id: string,
    prospects: Partial<WorkspaceProspect>[],
    data_source: string = 'bulk_import',
    options: {
      skip_duplicates?: boolean
      auto_assign?: boolean
      assignment_method?: 'round_robin' | 'manual'
    } = {}
  ): Promise<{
    imported: number
    duplicates: number
    errors: number
    results: Array<{
      prospect: Partial<WorkspaceProspect>
      status: 'imported' | 'duplicate' | 'error'
      prospect_id?: string
      error?: string
    }>
  }> {
    const results: Array<{
      prospect: Partial<WorkspaceProspect>
      status: 'imported' | 'duplicate' | 'error'
      prospect_id?: string
      error?: string
    }> = []

    let imported = 0
    let duplicates = 0
    let errors = 0

    for (const prospectData of prospects) {
      try {
        // Check for existing prospect first if skip_duplicates is true
        if (options.skip_duplicates) {
          const potentialDuplicates = await this.findPotentialDuplicates(workspace_id, prospectData, 1)
          if (potentialDuplicates.length > 0) {
            results.push({
              prospect: prospectData,
              status: 'duplicate',
              prospect_id: potentialDuplicates[0].id
            })
            duplicates++
            continue
          }
        }

        // Import prospect
        const prospect = await this.addOrGetProspect(workspace_id, prospectData, data_source)

        results.push({
          prospect: prospectData,
          status: 'imported',
          prospect_id: prospect.id
        })
        imported++

      } catch (error) {
        results.push({
          prospect: prospectData,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        errors++
      }
    }

    return {
      imported,
      duplicates,
      errors,
      results
    }
  }

  /**
   * Get contact statistics for workspace
   */
  static async getWorkspaceContactStats(
    workspace_id: string,
    time_range: 'today' | 'week' | 'month' | 'all' = 'week'
  ): Promise<{
    total_prospects: number
    contacted_prospects: number
    prospects_with_responses: number
    total_contacts: number
    contacts_by_user: Array<{
      user_id: string
      user_email: string
      contact_count: number
    }>
    contacts_by_method: Array<{
      contact_method: string
      contact_count: number
    }>
    response_rate: number
    avg_contacts_per_prospect: number
  }> {
    const supabase = supabaseAdmin()

    // Calculate date filter
    let dateFilter = new Date()
    switch (time_range) {
      case 'today':
        dateFilter.setHours(0, 0, 0, 0)
        break
      case 'week':
        dateFilter.setDate(dateFilter.getDate() - 7)
        break
      case 'month':
        dateFilter.setMonth(dateFilter.getMonth() - 1)
        break
      case 'all':
        dateFilter = new Date('2000-01-01') // Far in the past
        break
    }

    // Get basic prospect stats
    const { data: prospectStats } = await supabase
      .from('workspace_prospects')
      .select('id, contact_count')
      .eq('workspace_id', workspace_id)

    const total_prospects = prospectStats?.length || 0
    const contacted_prospects = prospectStats?.filter(p => p.contact_count > 0).length || 0

    // Get contact history with user details
    const { data: contactHistory } = await supabase
      .from('prospect_contact_history')
      .select(`
        id,
        contacted_by,
        contact_method,
        response_received,
        auth.users!prospect_contact_history_contacted_by_fkey(email)
      `)
      .eq('workspace_id', workspace_id)
      .gte('contacted_at', dateFilter.toISOString())

    const total_contacts = Array.isArray(contactHistory) ? contactHistory.length : 0
    const prospects_with_responses = new Set(
      Array.isArray(contactHistory) 
        ? contactHistory.filter(c => (c as any).response_received).map(c => (c as any).prospect_id)
        : []
    ).size

    // Group by user
    const contactsByUser = Array.isArray(contactHistory) ? contactHistory.reduce((acc, contact) => {
      const userId = (contact as any).contacted_by
      const userEmail = (contact as any).users?.email || 'Unknown'
      
      if (!acc[userId]) {
        acc[userId] = { user_id: userId, user_email: userEmail, contact_count: 0 }
      }
      acc[userId].contact_count++
      return acc
    }, {} as Record<string, any>) : {}

    // Group by method
    const contactsByMethod = Array.isArray(contactHistory) ? contactHistory.reduce((acc, contact) => {
      const method = (contact as any).contact_method
      if (!acc[method]) {
        acc[method] = { contact_method: method, contact_count: 0 }
      }
      acc[method].contact_count++
      return acc
    }, {} as Record<string, any>) : {}

    const response_rate = contacted_prospects > 0 ? (prospects_with_responses / contacted_prospects) : 0
    const avg_contacts_per_prospect = total_prospects > 0 ? (total_contacts / total_prospects) : 0

    return {
      total_prospects,
      contacted_prospects,
      prospects_with_responses,
      total_contacts,
      contacts_by_user: Object.values(contactsByUser),
      contacts_by_method: Object.values(contactsByMethod),
      response_rate: Math.round(response_rate * 100) / 100,
      avg_contacts_per_prospect: Math.round(avg_contacts_per_prospect * 100) / 100
    }
  }

  /**
   * Get prospects assigned to specific user
   */
  static async getUserAssignedProspects(
    workspace_id: string,
    user_id: string,
    status?: string[]
  ): Promise<WorkspaceProspect[]> {
    const supabase = supabaseAdmin()

    let query = supabase
      .from('workspace_prospects')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('assigned_to', user_id)

    if (status && status.length > 0) {
      query = query.in('prospect_status', status)
    }

    query = query.order('updated_at', { ascending: false })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get user prospects: ${error.message}`)
    }

    return data || []
  }

  /**
   * Mark prospect response received
   */
  static async markProspectResponse(
    workspace_id: string,
    prospect_id: string,
    platform_message_id: string,
    response_content: string
  ): Promise<void> {
    const supabase = supabaseAdmin()

    // Update contact history
    const { error: historyError } = await supabase
      .from('prospect_contact_history')
      .update({
        response_received: true,
        response_at: new Date().toISOString(),
        response_content: response_content
      })
      .eq('platform_message_id', platform_message_id)

    if (historyError) {
      console.error('Failed to update contact history:', historyError)
    }

    // Update prospect status
    const { error: prospectError } = await supabase
      .from('workspace_prospects')
      .update({
        prospect_status: 'replied',
        updated_at: new Date().toISOString()
      })
      .eq('id', prospect_id)
      .eq('workspace_id', workspace_id)

    if (prospectError) {
      console.error('Failed to update prospect status:', prospectError)
    }
  }
}