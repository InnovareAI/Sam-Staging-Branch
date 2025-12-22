export type KnowledgeDocument = {
    id: string;
    section: string;
    title: string;
    summary?: string;
    tags?: string[];
    vectorChunks?: number;
    updatedAt?: string | null;
    metadata?: Record<string, unknown>;
};

export type ICPProfile = {
    id: string;
    name?: string;
    icp_name?: string;
    overview?: Record<string, unknown>;
    target_profile?: Record<string, unknown>;
    decision_makers?: {
        primary_contact?: {
            name?: string;
            role?: string;
            company?: string;
        };
        supporting_contacts?: Array<{ name?: string; role?: string }>;
    };
    pain_points?: Record<string, unknown>;
    buying_process?: Record<string, unknown>;
    messaging?: Record<string, unknown>;
    success_metrics?: Record<string, unknown>;
    advanced?: {
        company_culture?: string[];
        messaging_guidelines?: string[];
        must_not_mention?: string[];
        human_checkpoints?: string[];
    } & Record<string, unknown>;
    [key: string]: unknown;
};

export type KnowledgeBaseProduct = {
    id: string;
    name: string;
    description?: string | null;
    category?: string | null;
    pricing?: Record<string, unknown> | null;
    features?: string[] | null;
    benefits?: string[] | null;
    use_cases?: string[] | null;
    competitive_advantages?: string[] | null;
    target_segments?: string[] | null;
    created_at?: string;
    updated_at?: string;
};

export type KnowledgeBaseCompetitor = {
    id: string;
    name: string;
    website?: string | null;
    description?: string | null;
    strengths?: string[] | null;
    weaknesses?: string[] | null;
    pricing_model?: string | null;
    key_features?: string[] | null;
    target_market?: string | null;
    competitive_positioning?: Record<string, unknown> | null;
    created_at?: string;
    updated_at?: string;
};

export type KnowledgeBasePersona = {
    id: string;
    name: string;
    icp_id?: string | null;
    job_title?: string | null;
    department?: string | null;
    seniority_level?: string | null;
    decision_making_role?: string | null;
    pain_points?: string[] | null;
    goals?: string[] | null;
    communication_preferences?: Record<string, unknown> | null;
    objections?: string[] | null;
    messaging_approach?: Record<string, unknown> | null;
    created_at?: string;
    updated_at?: string;
};

// Helper Utils
export const ensureRecord = (value: unknown): Record<string, unknown> =>
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const ensureArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value
            .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
            .filter((item) => item.length > 0)
        : [];

export const transformICPResponse = (icp: Record<string, unknown>): ICPProfile => {
    const industries = ensureArray(icp['industries']);
    const jobTitles = ensureArray(icp['job_titles']);
    const locations = ensureArray(icp['locations']);
    const technologies = ensureArray(icp['technologies']);
    const painPoints = ensureArray(icp['pain_points']);
    const companySizeMin = typeof icp['company_size_min'] === 'number' ? icp['company_size_min'] : null;
    const companySizeMax = typeof icp['company_size_max'] === 'number' ? icp['company_size_max'] : null;
    const idValue = icp['id'];

    const id = typeof idValue === 'string' && idValue.trim().length > 0
        ? idValue
        : String(idValue ?? `icp-${Date.now()}`);

    return {
        id,
        name: typeof icp['name'] === 'string' ? icp['name'] : typeof icp['icp_name'] === 'string' ? icp['icp_name'] : 'Untitled ICP',
        overview: {
            industries,
            job_titles: jobTitles,
            locations,
            technologies,
            company_size_min: companySizeMin,
            company_size_max: companySizeMax,
        },
        target_profile: {
            industries,
            job_titles: jobTitles,
            locations,
            technologies,
            company_size_range: [companySizeMin, companySizeMax].filter((value) => value !== null),
        },
        decision_makers: {},
        pain_points: {
            operational_challenges: painPoints,
            growth_pressures: [],
            emotional_drivers: [],
        },
        buying_process: ensureRecord(icp['qualification_criteria']),
        messaging: ensureRecord(icp['messaging_framework']),
        success_metrics: {},
        advanced: {},
    };
};
