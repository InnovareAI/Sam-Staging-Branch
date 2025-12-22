export type DuplicateWarning = {
    type: 'email' | 'linkedin'
    identifier: string
    existing_campaign_id: string
    existing_campaign_name: string
    existing_campaign_type: string
    blocking: boolean
}

export type ProspectData = {
    id: string;
    name: string;
    title: string;
    company: string;
    industry: string;
    location: string;
    email: string;
    linkedinUrl: string;
    phone: string;
    connectionDegree?: string;
    source: string;
    enrichmentScore: number;
    confidence: number;
    approvalStatus: 'pending' | 'approved' | 'rejected';
    campaignName?: string;
    campaignTag?: string;
    sessionId?: string;
    uploaded: boolean;
    qualityScore: number;
    createdAt: Date;
    researchedBy: string;
    researchedByInitials: string;
    linkedinUserId?: string;
    duplicateWarning?: DuplicateWarning;
}
