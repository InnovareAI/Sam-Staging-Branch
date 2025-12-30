export interface SamAttachment {
    id: string;
    file_name: string;
    file_type: string;
    file_size: number;
    mime_type: string;
    storage_path: string;
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    created_at: string;
}

export interface SamThreadMessage {
    id: string;
    thread_id: string;
    user_id: string;
    role: 'user' | 'assistant';
    content: string;
    model_used?: string;
    token_count?: number;
    processing_time_ms?: number;
    confidence_score?: number;
    relevance_score?: number;
    message_order: number;
    has_prospect_intelligence?: boolean;
    prospect_intelligence_data?: any;
    attachments?: SamAttachment[];
    created_at: string;
}

export interface SamConversationThread {
    id: string;
    user_id: string;
    workspace_id?: string;
    organization_id?: string;
    title: string;
    thread_type: 'prospect' | 'campaign' | 'general' | 'linkedin_research' | 'company_analysis';
    status: 'active' | 'archived' | 'completed';

    // Thread context
    prospect_name?: string;
    prospect_company?: string;
    prospect_linkedin_url?: string;
    campaign_name?: string;
    tags?: string[];
    priority: 'low' | 'medium' | 'high' | 'urgent';

    // Discovery context
    discovery_session_id?: string;

    // Last message cache
    last_user_message?: string;
    last_sam_message?: string;
    last_active_at: string;

    created_at: string;
    updated_at: string;
}

export interface ThreadFilters {
    status?: 'active' | 'archived' | 'completed';
    thread_type?: string;
    search?: string;
    tags?: string[];
}
