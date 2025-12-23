'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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

// Pagination state type
interface PaginationState {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

// Session summary type for list filtering
interface SessionSummary {
    id: string;
    name: string;
    count: number;
}

// Fetch function - uses unified paginated API
async function fetchWorkspaceProspects(
    workspaceId: string,
    page: number = 1,
    limit: number = 50,
    sessionId?: string,
    status?: string,
    search?: string
): Promise<{ prospects: ProspectData[]; sessions: SessionSummary[]; pagination: PaginationState }> {
    try {
        const params = new URLSearchParams({
            page: String(page),
            limit: String(limit),
            status: status || 'all'
        });
        if (sessionId) params.set('session_id', sessionId);
        if (search) params.set('search', search);

        const response = await fetch(`/api/prospect-approval/workspace-prospects?${params}`);
        if (!response.ok) throw new Error('Failed to fetch prospects');

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'Failed to fetch prospects');
        }

        // Map API response to ProspectData format
        const prospects: ProspectData[] = (data.prospects || []).map((p: any) => {
            const prospect: ProspectData = {
                id: p.id,
                name: p.name || 'Unknown',
                title: p.title || '',
                company: p.company || '',
                industry: '',
                location: p.location || '',
                email: p.email || '',
                linkedinUrl: p.linkedinUrl || '',
                phone: p.phone || '',
                connectionDegree: p.connectionDegree,
                source: p.source || 'linkedin',
                enrichmentScore: p.qualityScore || 0,
                confidence: (p.qualityScore || 80) / 100,
                approvalStatus: (p.approvalStatus || 'pending') as 'pending' | 'approved' | 'rejected',
                campaignName: p.campaignName || 'Unknown',
                campaignTag: p.campaignTag || 'Unknown',
                sessionId: p.sessionId,
                uploaded: false,
                qualityScore: p.qualityScore || 0,
                createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
                researchedBy: 'Unknown',
                researchedByInitials: 'U',
                linkedinUserId: p.linkedinUserId
            };
            // Recalculate quality score with our logic
            prospect.qualityScore = calculateQualityScore(prospect);
            return prospect;
        });

        return {
            prospects,
            sessions: data.sessions || [],
            pagination: data.pagination || { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
        };

    } catch (error) {
        console.error('Failed to fetch workspace prospects:', error);
        return {
            prospects: [],
            sessions: [],
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false }
        };
    }
}

import { toastError, toastSuccess, toastInfo } from '@/lib/toast';
import ImportProspectsModal from '@/components/ImportProspectsModal';
import ConfirmModal from '@/components/ConfirmModal';
import { useRouter } from 'next/navigation';
import { Upload, Trash2 } from 'lucide-react';
import { AddToCampaignModal } from './AddToCampaignModal';
import { CreateCampaignModal } from './CreateCampaignModal';
import { Button } from '@/components/ui/button';


export default function ProspectHub({ workspaceId }: ProspectHubProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    // Memoized keys that are stable across re-renders
    const LOCAL_STORAGE_KEY = useMemo(() => `sam_prospect_data_${workspaceId}`, [workspaceId]);
    const FILTER_STATE_KEY = useMemo(() => `sam_prospect_filters_${workspaceId}`, [workspaceId]);

    // Track hydration state to prevent saving defaults
    const hasHydratedRef = useRef(false);
    const hasSavedOnceRef = useRef(false);

    // Start with defaults - will hydrate from localStorage in useEffect
    const [filterState, setFilterState] = useState({
        page: 1,
        pageSize: 50,
        sessionId: undefined as string | undefined,
        search: '',
        status: 'all'
    });

    // Hydrate from localStorage ONCE on mount (client-side only)
    useEffect(() => {
        if (hasHydratedRef.current) return; // Already hydrated
        hasHydratedRef.current = true;

        try {
            const saved = localStorage.getItem(FILTER_STATE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                console.log('📦 Restored filter state from localStorage:', parsed);
                setFilterState({
                    page: parsed.page || 1,
                    pageSize: parsed.pageSize || 50,
                    sessionId: parsed.sessionId || undefined,
                    search: parsed.search || '',
                    status: parsed.status || 'all'
                });
            } else {
                console.log('📦 No saved filter state, using defaults');
            }
        } catch (e) {
            console.warn('Failed to load filter state from localStorage', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);  // Only run once on mount

    // Destructure for easier access
    const page = filterState.page;
    const pageSize = filterState.pageSize;
    const selectedSessionId = filterState.sessionId;
    const searchQuery = filterState.search;
    const statusFilter = filterState.status;

    // State setters that update the combined state
    const setPage = useCallback((p: number | ((prev: number) => number)) => {
        setFilterState(prev => ({ ...prev, page: typeof p === 'function' ? p(prev.page) : p }));
    }, []);
    const setPageSize = useCallback((s: number) => {
        setFilterState(prev => ({ ...prev, pageSize: s, page: 1 })); // Reset page on size change
    }, []);
    const setSelectedSessionId = useCallback((id: string | undefined) => {
        setFilterState(prev => ({ ...prev, sessionId: id, page: 1 })); // Reset page on session change
    }, []);
    const setSearchQuery = useCallback((q: string) => {
        setFilterState(prev => ({ ...prev, search: q }));
    }, []);
    const setStatusFilter = useCallback((s: string) => {
        setFilterState(prev => ({ ...prev, status: s, page: 1 })); // Reset page on filter change
    }, []);

    // Persist filter state to localStorage when it changes
    // Skip until we've hydrated AND saved at least once (to avoid saving defaults)
    useEffect(() => {
        // Wait until we've hydrated from localStorage before saving
        if (!hasHydratedRef.current) return;

        // Skip the first save after hydration (that's just restoring state)
        if (!hasSavedOnceRef.current) {
            hasSavedOnceRef.current = true;
            return;
        }

        try {
            localStorage.setItem(FILTER_STATE_KEY, JSON.stringify(filterState));
            console.log('💾 Saved filter state to localStorage:', filterState);
        } catch (e) {
            console.warn('Failed to save filter state to localStorage', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterState]);  // Save whenever filterState changes

    // Fetch paginated data
    const { data, isLoading, refetch, isFetching } = useQuery({
        queryKey: ['prospect-hub-data', workspaceId, page, pageSize, selectedSessionId, searchQuery, statusFilter],
        queryFn: async () => {
            const result = await fetchWorkspaceProspects(
                workspaceId,
                page,
                pageSize,
                selectedSessionId,
                statusFilter,
                searchQuery || undefined
            );
            // Cache successful fetch (only first page for quick load)
            if (page === 1) {
                try {
                    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result.prospects));
                } catch (e) {
                    console.error('Failed to cache prospects', e);
                }
            }
            return result;
        },
        enabled: !!workspaceId,
        staleTime: 2 * 60 * 1000, // 2 minutes cache
        refetchOnWindowFocus: false
    });

    // Extract data from query result
    const prospects = data?.prospects || [];
    const sessions = data?.sessions || [];
    const pagination = data?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0, hasNext: false, hasPrev: false };

    const [stats, setStats] = useState({ total: 0, approved: 0, rejected: 0, pending: 0, lists: 0 });
    const [showImportModal, setShowImportModal] = useState(false);
    const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false);
    const [showCreateCampaignModal, setShowCreateCampaignModal] = useState(false);
    const [defaultCampaignName, setDefaultCampaignName] = useState('');
    const [addToCampaignIds, setAddToCampaignIds] = useState<string[]>([]);
    const [importInitialTab, setImportInitialTab] = useState<any>('url');
    const [isProcessingPaste, setIsProcessingPaste] = useState(false);
    const [isProcessingUrl, setIsProcessingUrl] = useState(false);
    const [isProcessingCsv, setIsProcessingCsv] = useState(false);
    const [isProcessingQuickAdd, setIsProcessingQuickAdd] = useState(false);
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning' as 'warning' | 'danger' | 'info'
    });
    const [lastAction, setLastAction] = useState<{
        type: 'approve' | 'reject' | 'delete',
        ids: string[],
        previousStates: Record<string, 'pending' | 'approved' | 'rejected'>,
        prospects?: ProspectData[]
    } | null>(null);

    // Update stats when pagination data changes
    useEffect(() => {
        if (pagination) {
            setStats({
                total: pagination.total,
                approved: prospects.filter(p => p.approvalStatus === 'approved').length,
                rejected: prospects.filter(p => p.approvalStatus === 'rejected').length,
                pending: prospects.filter(p => p.approvalStatus === 'pending').length,
                lists: sessions.length,
            });
        }
    }, [pagination, prospects, sessions]);

    // Initialize from LocalStorage for instant first paint (optional)
    useEffect(() => {
        if (page === 1 && !prospects.length && !isLoading) {
            try {
                const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    const restored = parsed.map((p: any) => ({
                        ...p,
                        createdAt: new Date(p.createdAt)
                    }));
                    queryClient.setQueryData(
                        ['prospect-hub-data', workspaceId, 1, pageSize, undefined, '', 'all'],
                        { prospects: restored, sessions: [], pagination: { page: 1, limit: pageSize, total: restored.length, totalPages: 1, hasNext: false, hasPrev: false } }
                    );
                }
            } catch (e) {
                console.error('Failed to load prospects from cache', e);
            }
        }
    }, [workspaceId, queryClient, page, pageSize, prospects.length, isLoading]);

    // Pagination handlers
    const handleNextPage = () => {
        if (pagination.hasNext) setPage(p => p + 1);
    };
    const handlePrevPage = () => {
        if (pagination.hasPrev) setPage(p => p - 1);
    };
    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize);
        // Note: setPageSize already resets page to 1 in combined state
    };

    // Debounced refetch for real-time updates
    const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const debouncedRefetch = useCallback(() => {
        // Clear any pending refetch
        if (refetchTimeoutRef.current) {
            clearTimeout(refetchTimeoutRef.current);
        }
        // Schedule refetch after 500ms debounce
        refetchTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Executing debounced refetch');
            refetch();
        }, 500);
    }, [refetch]);

    // Real-time subscription for prospect changes
    useEffect(() => {
        // Subscribe to changes on workspace_prospects table (new architecture)
        const workspaceProspectsChannel = supabase
            .channel('workspace-prospects-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'workspace_prospects',
                    filter: `workspace_id=eq.${workspaceId}`
                },
                (payload) => {
                    console.log('🔄 Realtime: workspace_prospects change', payload.eventType);
                    debouncedRefetch();
                }
            )
            .subscribe();

        // Subscribe to changes on prospect_approval_data table (legacy architecture)
        const approvalDataChannel = supabase
            .channel('approval-data-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'prospect_approval_data'
                },
                (payload) => {
                    console.log('🔄 Realtime: prospect_approval_data change', payload.eventType);
                    debouncedRefetch();
                }
            )
            .subscribe();

        // Subscribe to decisions changes for status updates
        const decisionsChannel = supabase
            .channel('decisions-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'prospect_approval_decisions'
                },
                (payload) => {
                    console.log('🔄 Realtime: decision change', payload.eventType);
                    debouncedRefetch();
                }
            )
            .subscribe();

        // Cleanup subscriptions on unmount
        return () => {
            supabase.removeChannel(workspaceProspectsChannel);
            supabase.removeChannel(approvalDataChannel);
            supabase.removeChannel(decisionsChannel);
        };
    }, [workspaceId, debouncedRefetch]);

    const handleDataCollected = (newProspects: ProspectData[], source: string) => {
        toastSuccess(`Imported ${newProspects.length} prospects from ${source}`);
        refetch();
        setShowImportModal(false);
    };

    const handleLinkedInUrl = async (url: string) => {
        setIsProcessingUrl(true);
        try {
            // Extract search parameters from URL
            const urlObj = new URL(url);
            const savedSearchId = urlObj.searchParams.get('savedSearchId');
            const keywords = urlObj.searchParams.get('keywords');
            const sessionId = urlObj.searchParams.get('sessionId');

            console.log('LinkedIn Search URL parsed:', { savedSearchId, keywords, sessionId });

            const response = await fetch('/api/linkedin/search/simple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    search_criteria: {
                        saved_search_id: savedSearchId,
                        keywords: keywords,
                        url: url // Pass full URL as fallback
                    },
                    workspace_id: workspaceId
                })
            });

            const data = await response.json();
            if (data.success) {
                toastSuccess(`Successfully started import for ${data.count || 0} prospects`);
                refetch();
                setShowImportModal(false);
            } else {
                toastError(data.error || 'Failed to start LinkedIn import');
            }
        } catch (error) {
            console.error('LinkedIn URL error:', error);
            toastError('Invalid URL or search failed');
        } finally {
            setIsProcessingUrl(false);
        }
    };

    const handleCsvUpload = async (file: File) => {
        setIsProcessingCsv(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('workspace_id', workspaceId);
            formData.append('campaign_name', `${new Date().toISOString().split('T')[0]}-CSV-Import`);

            const response = await fetch('/api/prospect-approval/upload-csv', {
                method: 'POST',
                // Don't set Content-Type, browser will set it with boundary
                body: formData
            });

            const data = await response.json();
            if (data.success) {
                toastSuccess(`Uploaded ${data.count || 0} prospects from CSV`);
                refetch();
                setShowImportModal(false);
            } else {
                toastError(data.error || 'Failed to upload CSV');
            }
        } catch (error) {
            console.error('CSV upload error:', error);
            toastError('Error uploading CSV file');
        } finally {
            setIsProcessingCsv(false);
        }
    };

    const handlePasteData = async (text: string) => {
        setIsProcessingPaste(true);
        try {
            const lines = text.trim().split('\n');
            const prospectsData = lines.map(line => {
                const parts = line.includes('\t') ? line.split('\t') : line.split(',');
                const cleanParts = parts.map(p => p.trim());
                return {
                    name: cleanParts[0] || 'Unknown',
                    title: cleanParts[1] || '',
                    company: { name: cleanParts[2] || '' },
                    contact: {
                        email: cleanParts[3] || '',
                        linkedin_url: cleanParts[4] || ''
                    }
                };
            }).filter(p => p.name !== 'Unknown' || p.contact.linkedin_url);

            const response = await fetch('/api/prospect-approval/upload-prospects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    prospects: prospectsData,
                    source: 'paste-import'
                })
            });

            const data = await response.json();
            if (data.success) {
                toastSuccess(`Imported ${data.count || 0} prospects from clipboard`);
                refetch();
                setShowImportModal(false);
            } else {
                toastError(data.error || 'Failed to import pasted data');
            }
        } catch (error) {
            console.error('Paste error:', error);
            toastError('Error processing pasted data');
        } finally {
            setIsProcessingPaste(false);
        }
    };

    const handleQuickAdd = async (url: string) => {
        setIsProcessingQuickAdd(true);
        try {
            const response = await fetch('/api/prospect-approval/upload-prospects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_id: workspaceId,
                    prospects: [{ contact: { linkedin_url: url } }],
                    source: 'quick-add'
                })
            });

            const data = await response.json();
            if (data.success) {
                toastSuccess('Prospect added successfully');
                refetch();
                setShowImportModal(false);
            } else {
                toastError(data.error || 'Failed to add prospect');
            }
        } catch (error) {
            console.error('Quick add error:', error);
            toastError('Error adding prospect');
        } finally {
            setIsProcessingQuickAdd(false);
        }
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

            // For single updates, we don't necessarily need a big undo UI, but we could add it.
            // However, bulk actions are more important.

            if (status === 'approved') toastSuccess('Prospect approved');
            else if (status === 'rejected') toastSuccess('Prospect rejected');
        } catch (error) {
            console.error('Error updating prospect:', error);
            toastError('Failed to update status');
        }
    };

    const handleUndo = async () => {
        if (!lastAction) return;

        try {
            if (lastAction.type === 'delete' && lastAction.prospects) {
                // Restoration for delete is harder because we need a POST API for full restoration.
                // For now, let's notify the user if delete undo is not supported or implement it if API allows.
                // Assuming we can't easily undo permanent delete without a specialized 'restore' API.
                toastInfo("Undo for delete is coming soon. Please contact support if this was a mistake.");
                return;
            }

            // For approve/reject, we just set them back to their previous status
            await Promise.all(lastAction.ids.map(id => {
                const prevStatus = lastAction.previousStates[id] || 'pending';
                const prospect = prospects.find(p => p.id === id);
                if (!prospect?.sessionId) return Promise.resolve();

                return fetch('/api/prospect-approval/decisions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: prospect.sessionId,
                        prospect_id: id,
                        decision: prevStatus
                    })
                });
            }));

            // Restoration for delete
            if (lastAction.type === 'delete' && lastAction.prospects) {
                // We use the POST /api/prospect-approval/prospects endpoint to re-insert them
                // Group by session
                const sessions = new Map<string, ProspectData[]>();
                lastAction.prospects.forEach(p => {
                    if (p.sessionId) {
                        if (!sessions.has(p.sessionId)) sessions.set(p.sessionId, []);
                        sessions.get(p.sessionId)!.push(p);
                    }
                });

                await Promise.all(Array.from(sessions.entries()).map(([sessionId, sessionProspects]) => {
                    const prospectsData = sessionProspects.map(p => ({
                        id: p.id,
                        name: p.name,
                        title: p.title,
                        company: p.company,
                        contact: {
                            email: p.email,
                            linkedin_url: p.linkedinUrl,
                            phone: p.phone,
                            linkedin_user_id: p.linkedinUserId
                        },
                        location: p.location,
                        connection_degree: p.connectionDegree ? parseInt(p.connectionDegree) : undefined,
                        enrichment_score: p.enrichmentScore,
                        source: p.source
                    }));
                    return fetch('/api/prospect-approval/prospects', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            session_id: sessionId,
                            prospects_data: prospectsData
                        })
                    });
                }));
            }

            // Restore cache
            queryClient.setQueryData(['prospect-hub-data', workspaceId], (old: ProspectData[] | undefined) => {
                if (!old) return [];
                if (lastAction.type === 'delete' && lastAction.prospects) {
                    return [...lastAction.prospects, ...old].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
                }
                const newIds = new Set(lastAction.ids);
                return old.map(p => newIds.has(p.id) ? { ...p, approvalStatus: lastAction.previousStates[p.id] || 'pending' } : p);
            });

            toastSuccess(`Undone last ${lastAction.type} action`);
            setLastAction(null);
            refetch(); // Final sync
        } catch (error) {
            console.error('Undo error:', error);
            toastError('Failed to undo action');
        }
    };

    const handleDeleteMultiple = async (ids: string[]) => {
        const prospectsToDelete = prospects.filter(p => ids.includes(p.id));
        setConfirmModal({
            isOpen: true,
            title: `Delete ${ids.length} Prospects`,
            message: `Are you sure you want to permanently delete these ${ids.length} prospects?`,
            type: 'danger',
            onConfirm: async () => {
                try {
                    setLastAction({ type: 'delete', ids, previousStates: {}, prospects: prospectsToDelete });
                    await Promise.all(ids.map(id =>
                        fetch(`/api/prospect-approval/delete?prospect_id=${id}`, { method: 'DELETE' })
                    ));
                    toastSuccess(
                        <div className="flex items-center gap-2">
                            <span>Deleted {ids.length} prospects</span>
                            <Button variant="link" size="sm" onClick={handleUndo} className="h-auto p-0 text-blue-400 decoration-blue-400">Undo</Button>
                        </div>
                    );
                    refetch();
                } catch (error) {
                    console.error('Bulk delete error:', error);
                    toastError('Failed to delete some prospects');
                }
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
            }
        });
    };

    const handleApprove = (ids: string[]) => {
        const previousStates: Record<string, any> = {};
        ids.forEach(id => {
            const p = prospects.find(x => x.id === id);
            if (p) previousStates[id] = p.approvalStatus;
        });

        setLastAction({ type: 'approve', ids, previousStates });
        ids.forEach(id => updateProspectStatus(id, 'approved'));

        toastInfo(
            <div className="flex items-center gap-2">
                <span>Approved {ids.length} prospects</span>
                <Button variant="link" size="sm" onClick={handleUndo} className="h-auto p-0 text-blue-400 decoration-blue-400">Undo</Button>
            </div>
        );
    };

    const handleReject = (ids: string[]) => {
        const previousStates: Record<string, any> = {};
        ids.forEach(id => {
            const p = prospects.find(x => x.id === id);
            if (p) previousStates[id] = p.approvalStatus;
        });

        setLastAction({ type: 'reject', ids, previousStates });
        ids.forEach(id => updateProspectStatus(id, 'rejected'));

        toastInfo(
            <div className="flex items-center gap-2">
                <span>Rejected {ids.length} prospects</span>
                <Button variant="link" size="sm" onClick={handleUndo} className="h-auto p-0 text-blue-400 decoration-blue-400">Undo</Button>
            </div>
        );
    };

    const handleDelete = (id: string) => handleDeleteMultiple([id]);

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
                lists={stats.lists}
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
                            onDeleteSelected={handleDeleteMultiple}
                            onViewDetails={handleViewDetails}
                            onImportClick={() => { setImportInitialTab('url'); setShowImportModal(true); }}
                            onAddToCampaign={(ids) => {
                                setAddToCampaignIds(ids);
                                setShowAddToCampaignModal(true);
                            }}
                            onCreateCampaign={() => setShowCreateCampaignModal(true)}
                            title="Prospect Database"
                        />
                    </>
                )}
            </div>

            {/* Modals */}
            {showImportModal && (
                <ImportProspectsModal
                    open={showImportModal}
                    onClose={() => setShowImportModal(false)}
                    onLinkedInUrl={handleLinkedInUrl}
                    onCsvUpload={handleCsvUpload}
                    onPaste={handlePasteData}
                    onQuickAdd={handleQuickAdd}
                    isProcessingUrl={isProcessingUrl}
                    isProcessingCsv={isProcessingCsv}
                    isProcessingPaste={isProcessingPaste}
                    isProcessingQuickAdd={isProcessingQuickAdd}
                    initialTab={importInitialTab as any}
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

            {showCreateCampaignModal && (
                <CreateCampaignModal
                    open={showCreateCampaignModal}
                    onClose={() => setShowCreateCampaignModal(false)}
                    workspaceId={workspaceId}
                    defaultName={defaultCampaignName}
                    prospects={prospects}
                    onSuccess={(campaignId) => {
                        // Navigate to campaign hub to configure the new campaign
                        router.push(`/workspace/${workspaceId}/campaign-hub`);
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
                onApprove={handleApprove}
                onReject={handleReject}
                onDelete={handleDelete}
                onAddToCampaign={(ids) => {
                    setAddToCampaignIds(ids);
                    setShowAddToCampaignModal(true);
                    setIsSheetOpen(false);
                }}
                workspaceId={workspaceId}
            />
        </div>
    );
}
