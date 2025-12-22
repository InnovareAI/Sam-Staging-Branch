'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/app/lib/supabase-client';
import { ProspectStats } from './ProspectStats';
import { ProspectsTable } from './ProspectsTable';
import { ProspectData } from './types';
import { Star } from 'lucide-react';

interface ProspectHubProps {
    workspaceId: string;
}

// Helper to calculate quality score (copied from DataCollectionHub)
function calculateQualityScore(prospect: Partial<ProspectData>): number {
    let score = 0;
    if (prospect.email) score += 30;
    if (prospect.phone) score += 20;
    if (prospect.connectionDegree === '1st') score += 25;
    else if (prospect.connectionDegree === '2nd') score += 15;
    else if (prospect.connectionDegree === '3rd') score += 5;
    if (prospect.confidence && prospect.confidence > 0.8) score += 15;
    else if (prospect.enrichmentScore && prospect.enrichmentScore > 80) score += 15;
    if (prospect.location && prospect.industry) score += 10;
    return Math.min(score, 100);
}

// Fetch function
async function fetchApprovalSessions(workspaceId?: string): Promise<ProspectData[]> {
    try {
        const url = workspaceId
            ? `/api/prospect-approval/sessions/list?workspace_id=${workspaceId}`
            : '/api/prospect-approval/sessions/list';

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch sessions');

        const data = await response.json();
        if (!data.success || !data.sessions || data.sessions.length === 0) {
            return [];
        }

        // Limit to recent sessions for performance
        const recentSessions = data.sessions.slice(0, 10);
        const allProspects: ProspectData[] = [];

        for (const session of recentSessions) {
            const prospectsResponse = await fetch(
                `/api/prospect-approval/prospects?session_id=${session.id}&page=1&limit=1000&status=all`
            );

            if (!prospectsResponse.ok) continue;
            const prospectsData = await prospectsResponse.json();

            if (prospectsData.success && prospectsData.prospects) {
                const mappedProspects = prospectsData.prospects
                    .filter((p: any) => p.approval_status !== 'transferred_to_campaign')
                    .map((p: any) => {
                        const prospect: ProspectData = {
                            id: p.prospect_id,
                            name: p.name,
                            title: p.title || '',
                            company: p.company?.name || '',
                            industry: p.company?.industry || '',
                            location: p.location || '',
                            email: p.contact?.email || '',
                            linkedinUrl: p.contact?.linkedin_url || '',
                            phone: p.contact?.phone || '',
                            connectionDegree: p.connection_degree ? `${p.connection_degree}${p.connection_degree === 1 ? 'st' : p.connection_degree === 2 ? 'nd' : 'rd'}` : undefined,
                            source: p.source || 'linkedin',
                            enrichmentScore: p.enrichment_score || 0,
                            confidence: (p.enrichment_score || 80) / 100,
                            approvalStatus: (p.approval_status || 'pending') as 'pending' | 'approved' | 'rejected',
                            campaignName: session.campaign_name || `Session-${session.id.slice(0, 8)}`,
                            campaignTag: session.campaign_tag || session.campaign_name || session.prospect_source || 'linkedin',
                            sessionId: session.id,
                            uploaded: false,
                            qualityScore: 0,
                            createdAt: p.created_at ? new Date(p.created_at) : session.created_at ? new Date(session.created_at) : new Date(),
                            researchedBy: session.user_email || session.user_name || 'Unknown',
                            researchedByInitials: session.user_initials || 'U',
                            linkedinUserId: p.linkedin_user_id || p.contact?.linkedin_user_id || undefined
                        };
                        prospect.qualityScore = calculateQualityScore(prospect);
                        return prospect;
                    });
                allProspects.push(...mappedProspects);
            }
        }

        // Sort by newest
        return allProspects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
        console.error('Failed to fetch approval sessions:', error);
        return [];
    }
}

export default function ProspectHub({ workspaceId }: ProspectHubProps) {
    const queryClient = useQueryClient();

    const { data: prospects = [], isLoading } = useQuery({
        queryKey: ['prospect-hub-data', workspaceId],
        queryFn: () => fetchApprovalSessions(workspaceId),
        enabled: !!workspaceId,
        staleTime: 10000,
    });

    const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });

    useEffect(() => {
        if (prospects) {
            setStats({
                total: prospects.length,
                approved: prospects.filter(p => p.approvalStatus === 'approved').length,
                rejected: prospects.filter(p => p.approvalStatus === 'rejected').length,
                pending: prospects.filter(p => p.approvalStatus === 'pending').length,
            });
        }
    }, [prospects]);

    // Real-time subscription
    useEffect(() => {
        if (!workspaceId) return;

        const channel = supabase
            .channel('prospect_approval_hub_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prospect_approval_sessions', filter: `workspace_id=eq.${workspaceId}` },
                () => queryClient.invalidateQueries(['prospect-hub-data']))
            .on('postgres_changes', { event: '*', schema: 'public', table: 'prospect_approval_data', filter: `workspace_id=eq.${workspaceId}` },
                () => queryClient.invalidateQueries(['prospect-hub-data']))
            .subscribe();

        return () => { channel.unsubscribe(); };
    }, [workspaceId, queryClient]);

    const handleApprove = (ids: string[]) => {
        console.log('Approve ids:', ids);
        // TODO: Implement approve logic
    };

    const handleReject = (ids: string[]) => {
        console.log('Reject ids:', ids);
        // TODO: Implement reject logic
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Prospect Database</h1>
                <p className="text-muted-foreground">
                    Manage and review your AI-researched prospects.
                </p>
            </div>

            <ProspectStats
                total={stats.total}
                approved={stats.approved}
                rejected={stats.rejected}
                pending={stats.pending}
            />

            <div className="mt-6">
                {isLoading ? (
                    <div className="flex items-center justify-center h-64 border rounded-lg bg-gray-50/50">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <ProspectsTable
                        data={prospects}
                        onApprove={handleApprove}
                        onReject={handleReject}
                    />
                )}
            </div>
        </div>
    );
}
