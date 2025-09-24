/**
 * MCP Template Management Tools for Sam-First Campaign System
 * Handles messaging template creation, optimization, and performance tracking
 */

import { supabaseAdmin } from '@/app/lib/supabase';

export interface MessageTemplate {
  id?: string;
  workspace_id: string;
  template_name: string;
  campaign_type: 'sam_signature' | 'event_invitation' | 'product_launch' | 'partnership' | 'custom';
  industry?: string;
  target_role?: string;
  target_company_size?: 'startup' | 'smb' | 'mid_market' | 'enterprise';
  connection_message: string;
  alternative_message?: string;
  follow_up_messages: string[];
  language: string;
  tone: string;
  performance_metrics?: any;
  is_active: boolean;
}

export interface TemplatePerformance {
  template_id: string;
  campaign_id?: string;
  total_sent: number;
  total_responses: number;
  response_rate: number;
  connection_rate: number;
  meeting_rate: number;
}

/**
 * Create a new messaging template
 */
export async function mcp__template__create(template: Omit<MessageTemplate, 'id'>): Promise<{
  success: boolean;
  template_id?: string;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    const { data, error } = await supabase
      .from('messaging_templates')
      .insert({
        workspace_id: template.workspace_id,
        template_name: template.template_name,
        campaign_type: template.campaign_type,
        industry: template.industry,
        target_role: template.target_role,
        target_company_size: template.target_company_size,
        connection_message: template.connection_message,
        alternative_message: template.alternative_message,
        follow_up_messages: template.follow_up_messages,
        language: template.language || 'en',
        tone: template.tone || 'professional',
        is_active: true
      })
      .select('id')
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, template_id: data.id };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get templates by criteria
 */
export async function mcp__template__get_by_criteria(params: {
  workspace_id: string;
  industry?: string;
  target_role?: string;
  campaign_type?: string;
  language?: string;
  limit?: number;
}): Promise<{
  success: boolean;
  templates?: MessageTemplate[];
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    let query = supabase
      .from('messaging_templates')
      .select('*')
      .eq('workspace_id', params.workspace_id)
      .eq('is_active', true);

    if (params.industry) query = query.eq('industry', params.industry);
    if (params.target_role) query = query.eq('target_role', params.target_role);
    if (params.campaign_type) query = query.eq('campaign_type', params.campaign_type);
    if (params.language) query = query.eq('language', params.language);
    
    query = query.limit(params.limit || 50);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, templates: data || [] };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get specific template by ID
 */
export async function mcp__template__get_by_id(params: {
  template_id: string;
  workspace_id: string;
}): Promise<{
  success: boolean;
  template?: MessageTemplate;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    const { data, error } = await supabase
      .from('messaging_templates')
      .select('*')
      .eq('id', params.template_id)
      .eq('workspace_id', params.workspace_id)
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, template: data };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Update existing template
 */
export async function mcp__template__update(params: {
  template_id: string;
  workspace_id: string;
  updates: Partial<MessageTemplate>;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    const { error } = await supabase
      .from('messaging_templates')
      .update({
        ...params.updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.template_id)
      .eq('workspace_id', params.workspace_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Delete template (soft delete by setting is_active = false)
 */
export async function mcp__template__delete(params: {
  template_id: string;
  workspace_id: string;
}): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    const { error } = await supabase
      .from('messaging_templates')
      .update({ is_active: false })
      .eq('id', params.template_id)
      .eq('workspace_id', params.workspace_id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Track template performance
 */
export async function mcp__template__track_performance(performance: TemplatePerformance): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    const { error } = await supabase
      .from('template_performance')
      .insert({
        template_id: performance.template_id,
        campaign_id: performance.campaign_id,
        total_sent: performance.total_sent,
        total_responses: performance.total_responses,
        response_rate: performance.response_rate,
        connection_rate: performance.connection_rate,
        meeting_rate: performance.meeting_rate,
        date_start: new Date().toISOString().split('T')[0],
        date_end: new Date().toISOString().split('T')[0]
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get template performance metrics
 */
export async function mcp__template__get_performance(params: {
  template_id: string;
  workspace_id: string;
}): Promise<{
  success: boolean;
  performance?: TemplatePerformance[];
  avg_response_rate?: number;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    // Get template performance data
    const { data: performanceData, error: perfError } = await supabase
      .from('template_performance')
      .select('*')
      .eq('template_id', params.template_id);

    if (perfError) {
      return { success: false, error: perfError.message };
    }

    // Calculate average response rate
    const avgResponseRate = performanceData && performanceData.length > 0
      ? performanceData.reduce((sum, p) => sum + p.response_rate, 0) / performanceData.length
      : 0;

    return { 
      success: true, 
      performance: performanceData || [],
      avg_response_rate: avgResponseRate
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Clone existing template with modifications
 */
export async function mcp__template__clone(params: {
  source_template_id: string;
  workspace_id: string;
  new_name: string;
  modifications?: Partial<MessageTemplate>;
}): Promise<{
  success: boolean;
  new_template_id?: string;
  error?: string;
}> {
  try {
    // Get source template
    const sourceResult = await mcp__template__get_by_id({
      template_id: params.source_template_id,
      workspace_id: params.workspace_id
    });

    if (!sourceResult.success || !sourceResult.template) {
      return { success: false, error: 'Source template not found' };
    }

    // Create new template with modifications
    const newTemplate = {
      ...sourceResult.template,
      template_name: params.new_name,
      ...params.modifications
    };
    
    delete newTemplate.id; // Remove ID to create new record

    return await mcp__template__create(newTemplate);
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Get top performing templates
 */
export async function mcp__template__get_top_performers(params: {
  workspace_id: string;
  limit?: number;
  min_campaigns?: number;
}): Promise<{
  success: boolean;
  templates?: Array<MessageTemplate & { avg_response_rate: number }>;
  error?: string;
}> {
  try {
    const supabase = supabaseAdmin();
    
    const { data, error } = await supabase
      .rpc('get_templates_by_criteria', {
        p_workspace_id: params.workspace_id,
        p_industry: null,
        p_role: null,
        p_campaign_type: null
      });

    if (error) {
      return { success: false, error: error.message };
    }

    // Filter and sort by performance
    const topPerformers = (data || [])
      .filter((t: any) => t.avg_response_rate > 0)
      .sort((a: any, b: any) => b.avg_response_rate - a.avg_response_rate)
      .slice(0, params.limit || 10);

    return { success: true, templates: topPerformers };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}