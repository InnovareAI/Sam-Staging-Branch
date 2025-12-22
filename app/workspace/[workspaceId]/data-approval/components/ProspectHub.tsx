'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/app/lib/supabase-client';
import { ProspectStats } from './ProspectStats';
import { ProspectsTable } from './ProspectsTable';
import { ProspectData } from './types';
import { Star } from 'lucide-react';
import { ProspectDetailsSheet } from './ProspectDetailsSheet';
import { ProspectTableSkeleton } from './ProspectTableSkeleton';

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

        // Optimize: Fetch prospects for all sessions in parallel
        const prospectPromises = recentSessions.map(async (session: any) => {
            const response = await fetch(
                `/api/prospect-approval/prospects?session_id=${session.id}&page=1&limit=1000&status=all`
            );
            if (!response.ok) return [];

            const prospectsData = await response.json();
            if (!prospectsData.success || !prospectsData.prospects) return [];

            return prospectsData.prospects
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
        });

        const results = await Promise.all(prospectPromises);
        const allProspects = results.flat();

        // Sort by newest
        return allProspects.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    } catch (error) {
        console.error('Failed to fetch approval sessions:', error);
        return [];
    }
}
import { toastError, toastSuccess, toastInfo } from '@/lib/toast';
import ImportProspectsModal from '@/components/ImportProspectsModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { AddToCampaignModal } from './AddToCampaignModal';


export default function ProspectHub({ workspaceId }: ProspectHubProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const LOCAL_STORAGE_KEY = `sam_prospect_data_${workspaceId}`;

    // Initialize from LocalStorage if available to show data immediately
    useEffect(() => {
        try {
            const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Restore Date objects
                const restored = parsed.map((p: any) => ({
                    ...p,
                    createdAt: new Date(p.createdAt)
                }));
                // Only set if query cache is empty to avoid overwriting fresh data
                if (!queryClient.getQueryData(['prospect-hub-data', workspaceId])) {
                    queryClient.setQueryData(['prospect-hub-data', workspaceId], restored);
                }
            }
        } catch (e) {
            console.error('Failed to load prospects from cache', e);
        }
    }, [workspaceId, queryClient]);

    const { data: prospects = [], isLoading, refetch, isFetching } = useQuery({
        queryKey: ['prospect-hub-data', workspaceId],
        queryFn: async () => {
            const data = await fetchApprovalSessions(workspaceId);
            // Cache successful fetch
            try {
                localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
            } catch (e) {
                console.error('Failed to cache prospects', e);
            }
            return data;
        },
        enabled: !!workspaceId,
        staleTime: 5 * 60 * 1000, // 5 minutes cache
        refetchOnWindowFocus: false // Prevent annoying refetches
    });

    const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0 });
    const [showImportModal, setShowImportModal] = useState(false);
    const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false);
    const [addToCampaignIds, setAddToCampaignIds] = useState<string[]>([]);
    const [importInitialTab, setImportInitialTab] = useState('file');
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning' as 'warning' | 'danger' | 'info'
    });

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

    // Real-time subscription (keep existing)

    const handleDataCollected = (newProspects: ProspectData[], source: string) => {
        toastSuccess(`Imported ${newProspects.length} prospects from ${source}`);
        refetch();
        setShowImportModal(false);
    };

    const updateProspectStatus = async (id: string, status: 'approved' | 'rejected' | 'pending') => {
        const prospect = prospects.find(p => p.id === id);
        if (!prospect?.sessionId) return;

        try {
            await fetch('/api/prospect-approval/decisions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: prospect.sessionId,
                    prospect_id: id,
                    decision: status
                })
            });

            // Optimistic update handled by invalidation or manual cache update
            queryClient.setQueryData(['prospect-hub-data', workspaceId], (old: ProspectData[] | undefined) => {
                if (!old) return [];
                return old.map(p => p.id === id ? { ...p, approvalStatus: status } : p);
            });

            if (status === 'approved') toastSuccess('Prospect approved');
            else if (status === 'rejected') toastSuccess('Prospect rejected');
        } catch (error) {
            console.error('Error updating prospect:', error);
            toastError('Failed to update status');
        }
    };

    const handleApprove = (ids: string[]) => {
        ids.forEach(id => updateProspectStatus(id, 'approved'));
    };

    const handleReject = (ids: string[]) => {
        ids.forEach(id => updateProspectStatus(id, 'rejected'));
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Delete Prospect',
            message: 'Are you sure you want to permanently delete this prospect?',
            type: 'danger',
            onConfirm: async () => {
                try {
                    await fetch(`/api/prospect-approval/delete?prospect_id=${id}`, { method: 'DELETE' });
                    toastSuccess('Prospect deleted');
                    refetch();
                } catch (error) {
                    toastError('Failed to delete prospect');
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    // ... inside component ...

    // ... inside component ...

    const [selectedProspect, setSelectedProspect] = useState<ProspectData | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const handleViewDetails = (prospect: ProspectData) => {
        setSelectedProspect(prospect);
        setIsSheetOpen(true);
    };

    return (
        <div className="space-y-6 p-6">
            {/* Stats Section */}
            <ProspectStats
                total={stats.total}
                approved={stats.approved}
                rejected={stats.rejected}
                pending={stats.pending}
            />

            {/* Prospects Table Section */}
            <div className="mt-6">

                {isLoading && prospects.length === 0 ? (
                    <ProspectTableSkeleton />
                ) : (
                    <>
                        {isFetching && (
                            <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                Updating data in background...
                            </div>
                        )}
                        <ProspectsTable
                            data={prospects}
                            onApprove={handleApprove}
                            onReject={handleReject}
                            onDelete={handleDelete}
                            onViewDetails={handleViewDetails}
                            onImportClick={() => { setImportInitialTab('url'); setShowImportModal(true); }}
                            onAddToCampaign={(ids) => {
                                setAddToCampaignIds(ids);
                                setShowAddToCampaignModal(true);
                            }}
                        />
                    </>
                )}
            </div>

            {/* Modals */}
            {showImportModal && (
                <ImportProspectsModal
                    open={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onDataCollected={handleDataCollected}
                    workspaceId={workspaceId}
                    initialTab={importInitialTab}
                />
            )}

            {showAddToCampaignModal && (
                <AddToCampaignModal
                    open={showAddToCampaignModal}
                    onClose={() => setShowAddToCampaignModal(false)}
                    workspaceId={workspaceId}
                    prospectIds={addToCampaignIds}
                    onSuccess={() => {
                        // Refresh data to show updated status/removal
                        refetch();
                        // Also clear selection by forcing table re-render or similar if needed, 
                        // but refetch usually handles data updates.
                        // Ideally we'd also uncheck the boxes, but the table state handle that.
                    }}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
            />

            <ProspectDetailsSheet
                prospect={selectedProspect}
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
            />
        </div>
    );
}
