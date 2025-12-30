/**
 * Shared types for Campaign-related components
 */

export interface Campaign {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'paused' | 'inactive' | 'completed' | 'archived';
    campaign_type: 'email' | 'linkedin' | 'connector' | 'messenger';
    workspace_id: string;

    // Metrics
    sent?: number;
    connections?: number;
    replies?: number;
    total_prospects?: number;
    prospects_count?: number;

    // Message Templates
    message_templates?: {
        connection_request?: string;
        alternative_message?: string;
        email_body?: string;
        initial_subject?: string;
        follow_up_subjects?: string[];
        use_threaded_replies?: boolean;
        ab_testing_enabled?: boolean;
        connection_request_b?: string;
        alternative_message_b?: string;
        email_body_b?: string;
        initial_subject_b?: string;
        follow_up_messages?: Array<{
            message: string;
            delay_days: number;
        }>;
    };

    // Timestamps
    created_at?: string;
    updated_at?: string;
    launched_at?: string;
}

export interface CampaignStatsData {
    total: number;
    active: number;
    paused: number;
    completed: number;
    sent: number;
    connected: number;
    replied: number;
    archived?: number;
}

export interface ConnectedAccounts {
    linkedin: boolean;
    email: boolean;
}
