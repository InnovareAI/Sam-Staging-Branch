'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { createClient } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Target,
  CheckCircle,
  Pause,
  Play,
  FileText,
  Eye,
  Grid3x3,
  Search,
  Plus,
  Rocket,
  LayoutDashboard,
  Zap,
  Loader2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Types
import type { Campaign, CampaignStatsData, ConnectedAccounts } from '@/types/campaign';

// Modular Components
import { CampaignStats } from "@/components/campaign/CampaignStats";
import { CampaignList as CampaignListModular } from "@/components/campaign/CampaignList";
import { CampaignEditModal } from "@/components/campaign/CampaignEditModal";
import { CampaignSettingsModal } from "@/components/campaign/CampaignSettingsModal";
import { CampaignProspectsModal } from "@/components/campaign/CampaignProspectsModal";
import { ReachInboxPushModal } from "@/components/campaign/ReachInboxPushModal";
import { CampaignBuilder } from "@/components/campaign/CampaignBuilder";
import CampaignApprovalScreen from '@/app/components/CampaignApprovalScreen';
import { UnipileModal } from '@/components/integrations/UnipileModal';
import { ConfirmModal } from '@/components/ui/CustomModal';

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface CampaignHubProps {
  workspaceId?: string | null;
  initialProspects?: any[] | null;
  initialCampaignType?: 'email' | 'linkedin' | 'connector' | 'messenger';
  initialDraftId?: string;
  onCampaignCreated?: () => void;
}

const CampaignHub: React.FC<CampaignHubProps> = ({
  workspaceId,
  initialProspects,
  initialCampaignType,
  initialDraftId,
  onCampaignCreated
}) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const actualWorkspaceId = workspaceId;

  // Header & View State
  const [showBuilder, setShowBuilder] = useState(!!initialProspects || !!initialDraftId);
  const [showApprovalScreen, setShowApprovalScreen] = useState(false);
  const [campaignDataForApproval, setCampaignDataForApproval] = useState<Campaign | null>(null);
  const [showFullHub, setShowFullHub] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<'active' | 'paused' | 'completed' | 'draft' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  // Auto Create Mode derived state
  const isAutoCreateMode = (initialProspects && initialProspects.length > 0) || !!initialDraftId;

  // Modal States
  const [showEditModal, setShowEditModal] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<Campaign | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [campaignForSettings, setCampaignForSettings] = useState<Campaign | null>(null);
  const [showProspectsModal, setShowProspectsModal] = useState(false);
  const [selectedCampaignForProspects, setSelectedCampaignForProspects] = useState<Campaign | null>(null);
  const [showReachInboxModal, setShowReachInboxModal] = useState(false);
  const [selectedCampaignForReach, setSelectedCampaignForReach] = useState<Campaign | null>(null);
  const [isPushingToReach, setIsPushingToReach] = useState(false);
  const [showUnipileWizard, setShowUnipileWizard] = useState(false);
  const [unipileProvider, setUnipileProvider] = useState<'LINKEDIN' | 'GOOGLE' | 'MICROSOFT' | null>(null);
  const [selectedProspectsForBuilder, setSelectedProspectsForBuilder] = useState<any[] | null>(null);

  // Main Campaigns Query
  const { data: allCampaigns = [], isLoading: loadingCampaigns } = useQuery({
    queryKey: ['campaigns', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];
      const response = await fetch(`/api/campaigns?workspace_id=${actualWorkspaceId}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.data?.campaigns || result.campaigns || [];
    },
    enabled: !!actualWorkspaceId,
    staleTime: 30 * 1000,
  });

  // Available Prospects Query (for Prospects Modal - only when modal open)
  const { data: availableProspects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ['available-prospects', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];
      const response = await fetch(`/api/workspace-prospects/available?workspace_id=${actualWorkspaceId}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.prospects || [];
    },
    enabled: showProspectsModal && !!actualWorkspaceId,
  });

  // Available Approved Prospects Query (always enabled for Create Campaign check)
  const { data: availableApprovedProspects = [] } = useQuery({
    queryKey: ['available-approved-prospects', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];
      const response = await fetch(`/api/workspace-prospects/available?workspace_id=${actualWorkspaceId}&status=approved`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.prospects || [];
    },
    enabled: !!actualWorkspaceId,
    staleTime: 30 * 1000,
  });

  // Available Lists Query (for Prospects Modal)
  const { data: availableLists = [], isLoading: loadingLists } = useQuery({
    queryKey: ['available-lists', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];
      const response = await fetch(`/api/workspace-prospects/lists?workspace_id=${actualWorkspaceId}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.lists || [];
    },
    enabled: showProspectsModal && !!actualWorkspaceId,
  });

  // ReachInbox Campaigns Query
  const { data: reachInboxCampaigns = [], isLoading: loadingReachInbox } = useQuery({
    queryKey: ['reachinbox-campaigns', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];
      const response = await fetch(`/api/campaigns/email/reachinbox/push-leads?workspace_id=${actualWorkspaceId}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.campaigns || result.data || [];
    },
    enabled: showReachInboxModal && !!actualWorkspaceId,
  });

  // Connected Accounts Query (for CampaignBuilder)
  const { data: connectedAccounts = { linkedin: false, email: false } } = useQuery<ConnectedAccounts>({
    queryKey: ['connected-accounts', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return { linkedin: false, email: false };
      try {
        const response = await fetch(`/api/workspace-accounts?workspace_id=${actualWorkspaceId}`);
        if (!response.ok) return { linkedin: false, email: false };
        const result = await response.json();
        const accounts = result.accounts || result.data || [];
        return {
          linkedin: accounts.some((a: any) => a.provider === 'LINKEDIN' && a.status === 'active'),
          email: accounts.some((a: any) => ['GOOGLE', 'MICROSOFT'].includes(a.provider) && a.status === 'active'),
        };
      } catch {
        return { linkedin: false, email: false };
      }
    },
    enabled: !!actualWorkspaceId,
    staleTime: 60 * 1000,
  });

  // Stats calculation
  const stats: CampaignStatsData = {
    total: allCampaigns.length,
    active: allCampaigns.filter((c: Campaign) => c.status === 'active').length,
    paused: allCampaigns.filter((c: Campaign) => c.status === 'paused' || c.status === 'inactive').length,
    completed: allCampaigns.filter((c: Campaign) => c.status === 'completed').length,
    sent: allCampaigns.reduce((acc: number, c: Campaign) => acc + (c.sent || 0), 0),
    connected: allCampaigns.reduce((acc: number, c: Campaign) => acc + (c.connections || 0), 0),
    replied: allCampaigns.reduce((acc: number, c: Campaign) => acc + (c.replies || 0), 0),
    archived: allCampaigns.filter((c: Campaign) => c.status === 'archived').length,
  };

  // Filtering logic
  const filteredCampaigns = allCampaigns.filter((c: Campaign) => {
    let matchesFilter = false;
    if (campaignFilter === 'draft') {
      matchesFilter = c.status === 'draft';
    } else if (campaignFilter === 'paused') {
      matchesFilter = c.status === 'paused' || c.status === 'inactive';
    } else {
      matchesFilter = c.status === campaignFilter;
    }
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Action Handlers
  const handleToggleStatus = async (campaignId: string, currentStatus: string) => {
    const newStatus = (currentStatus === 'active') ? 'paused' : 'active';
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, workspace_id: actualWorkspaceId })
      });
      if (response.ok) {
        toastSuccess(`Campaign ${newStatus === 'active' ? 'resumed' : 'paused'}`);
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      toastError('Failed to update status');
    }
  };

  const handleEdit = (campaign: any) => {
    setCampaignToEdit(campaign);
    setShowEditModal(true);
  };

  const handleSaveEdit = async (formData: any) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignToEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, workspace_id: actualWorkspaceId })
      });
      if (response.ok) {
        toastSuccess('Campaign updated successfully');
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
        setShowEditModal(false);
      } else {
        throw new Error('Failed to update campaign');
      }
    } catch (error) {
      toastError('Failed to update campaign');
    }
  };

  const handleEditSettings = (campaign: Campaign) => {
    setCampaignForSettings(campaign);
    setShowSettingsModal(true);
  };

  const handleSaveSettings = async (settings: any) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignForSettings?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: actualWorkspaceId,
          timezone: settings.timezone,
          country_code: settings.country_code,
          working_hours_start: settings.working_hours_start,
          working_hours_end: settings.working_hours_end,
          skip_weekends: settings.skip_weekends,
          skip_holidays: settings.skip_holidays,
          daily_limit: settings.daily_limit,
          flow_settings: {
            connection_wait_hours: settings.connection_wait_hours,
            followup_wait_days: settings.followup_wait_days
          }
        })
      });
      if (response.ok) {
        toastSuccess('Campaign settings updated');
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
        setShowSettingsModal(false);
      } else {
        throw new Error('Failed to update settings');
      }
    } catch (error) {
      toastError('Failed to update settings');
    }
  };

  const handleViewProspects = (campaign: any) => {
    setSelectedCampaignForProspects(campaign);
    setShowProspectsModal(true);
  };

  const handleAddProspects = async (prospectIds: string[]) => {
    try {
      const response = await fetch(`/api/campaigns/${selectedCampaignForProspects.id}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_ids: prospectIds, workspace_id: actualWorkspaceId })
      });
      if (response.ok) {
        toastSuccess(`${prospectIds.length} prospects added to campaign`);
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
        setShowProspectsModal(false);
      } else {
        throw new Error('Failed to add prospects');
      }
    } catch (error) {
      toastError('Failed to add prospects');
    }
  };

  const handleReachInbox = (campaign: any) => {
    setSelectedCampaignForReach(campaign);
    setShowReachInboxModal(true);
  };

  const handlePushToReachInbox = async (reachInboxId: string) => {
    setIsPushingToReach(true);
    try {
      const response = await fetch(`/api/campaigns/email/reachinbox/push-leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sam_campaign_id: selectedCampaignForReach?.id,
          reachinbox_campaign_id: reachInboxId,
          workspace_id: actualWorkspaceId
        })
      });
      const result = await response.json();
      if (response.ok) {
        toastSuccess(result.message || 'Leads pushed to ReachInbox');
        setShowReachInboxModal(false);
      } else {
        throw new Error(result.error || 'Failed to push leads');
      }
    } catch (error: any) {
      toastError(error.message || 'Failed to push leads');
    } finally {
      setIsPushingToReach(false);
    }
  };

  const handleExecute = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: actualWorkspaceId })
      });
      if (response.ok) {
        toastSuccess('Campaign execution triggered');
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      } else {
        throw new Error('Failed to trigger execution');
      }
    } catch (error) {
      toastError('Execution error');
    }
  };

  const handleArchive = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: actualWorkspaceId,
          status: 'archived'
        })
      });
      if (response.ok) {
        toastSuccess('Campaign archived');
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      } else {
        throw new Error('Failed to archive campaign');
      }
    } catch (error) {
      toastError('Archive error');
    }
  };

  const handleComplete = async (campaignId: string) => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: actualWorkspaceId,
          status: 'completed'
        })
      });
      if (response.ok) {
        toastSuccess('Campaign marked as completed');
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      } else {
        throw new Error('Failed to complete campaign');
      }
    } catch (error) {
      toastError('Error completing campaign');
    }
  };

  const handleViewAnalytics = (campaignId: string) => {
    toastInfo('Detailed analytics coming soon');
  };

  const handleViewMessages = (campaign: Campaign) => {
    toastInfo(`View templates for: ${campaign.name}`);
  };

  // Handle Create Campaign button click - check for available prospects first
  const handleCreateCampaign = () => {
    if (availableApprovedProspects.length > 0) {
      // Has approved prospects - proceed to builder with them
      setSelectedProspectsForBuilder(availableApprovedProspects);
      setShowBuilder(true);
    } else {
      // No approved prospects - redirect to Prospect Database
      toastWarning('No approved prospects available. Please approve prospects in the Prospect Database first.');
      router.push(`/workspace/${actualWorkspaceId}/data-approval`);
    }
  };

  // If in Builder mode (e.g. from Prospect Approval)
  if (showBuilder && !showApprovalScreen && (!showFullHub || isAutoCreateMode)) {
    // Use selectedProspectsForBuilder if set (from Create Campaign button), otherwise use initialProspects
    const prospectsToUse = selectedProspectsForBuilder || initialProspects;
    return (
      <div className="min-h-screen bg-transparent animate-in fade-in zoom-in-95 duration-300">
        <CampaignBuilder
          workspaceId={actualWorkspaceId}
          initialProspects={prospectsToUse}
          initialCampaignType={initialCampaignType}
          initialDraftId={initialDraftId}
          onClose={() => {
            setShowBuilder(false);
            setSelectedProspectsForBuilder(null); // Clear selected prospects
            onCampaignCreated?.();
          }}
          onPrepareForApproval={(data) => {
            setCampaignDataForApproval(data);
            setShowApprovalScreen(true);
          }}
          connectedAccounts={connectedAccounts}
          setConnectedAccounts={() => queryClient.invalidateQueries({ queryKey: ['connected-accounts', actualWorkspaceId] })}
          setShowUnipileWizard={setShowUnipileWizard}
          setUnipileProvider={setUnipileProvider}
        />
      </div>
    );
  }

  // If in Approval screen
  if (showApprovalScreen && campaignDataForApproval) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-xl z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card/90 border border-border/40 rounded-2xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl glass-effect"
        >
          <CampaignApprovalScreen
            campaignData={campaignDataForApproval}
            workspaceId={actualWorkspaceId || ''}
            onApprove={async (data) => {
              setShowApprovalScreen(false);
              setShowBuilder(false);
              toastSuccess("Campaign launched successfully!");
              queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
              onCampaignCreated?.();
            }}
            onReject={() => setShowApprovalScreen(false)}
          />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-10 py-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-2">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Rocket className="text-primary" size={28} />
            Campaign Hub
          </h1>
          <p className="text-gray-400 mt-1">Control center for your outreach. Track performance, manage sequences, and optimize conversion.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end mr-4 hidden sm:flex text-right">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60">Global Reach</span>
            <span className="text-sm font-medium text-foreground/80">{stats.sent.toLocaleString()} Prospects Contacted</span>
          </div>
          <Button
            onClick={handleCreateCampaign}
            className="h-12 px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl shadow-xl shadow-primary/20 transition-all hover:scale-105 active:scale-95"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Campaign
            {availableApprovedProspects.length > 0 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                {availableApprovedProspects.length}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="bg-card/30 backdrop-blur-md border border-border/40 rounded-3xl p-8 shadow-inner shadow-white/5">
        <CampaignStats stats={stats} />
      </div>

      {/* Main Campaign Management Area */}
      <div className="space-y-8 bg-card/30 backdrop-blur-md border border-border/40 rounded-3xl p-8 shadow-inner shadow-white/5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 xl:pb-0 no-scrollbar">
            <Tabs
              value={campaignFilter}
              onValueChange={(v: any) => setCampaignFilter(v)}
              className="w-full sm:w-auto"
            >
              <TabsList className="bg-muted/30 border border-border/40 p-1 rounded-2xl h-14">
                <TabsTrigger value="active" className="rounded-xl h-12 px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">
                  Active <Badge variant="secondary" className="ml-2 bg-background/20 text-current">{stats.active}</Badge>
                </TabsTrigger>
                <TabsTrigger value="paused" className="rounded-xl h-12 px-6 data-[state=active]:bg-background transition-all">
                  Paused <Badge variant="secondary" className="ml-2 bg-muted-foreground/20 text-current">{stats.paused}</Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="rounded-xl h-12 px-6 data-[state=active]:bg-background transition-all">
                  Completed <Badge variant="secondary" className="ml-2 bg-muted-foreground/20 text-current">{stats.completed}</Badge>
                </TabsTrigger>
                <TabsTrigger value="draft" className="rounded-xl h-12 px-6 data-[state=active]:bg-background transition-all">
                  Drafts
                </TabsTrigger>
                <TabsTrigger value="archived" className="rounded-xl h-12 px-6 data-[state=active]:bg-background transition-all">
                  Archived
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="relative w-full xl:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              placeholder="Search campaigns by name..."
              className="h-14 pl-12 pr-4 bg-muted/40 border-border/40 rounded-2xl focus:bg-muted/60 focus:ring-primary/20 transition-all text-lg placeholder:text-muted-foreground/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="min-h-[400px]">
          <CampaignListModular
            campaigns={filteredCampaigns}
            loading={loadingCampaigns}
            onToggleStatus={handleToggleStatus}
            onExecute={handleExecute}
            onArchive={handleArchive}
            onComplete={handleComplete}
            onViewMessages={handleViewMessages}
            onViewProspects={(campaignId: string) => {
              const campaign = allCampaigns.find((c: Campaign) => c.id === campaignId);
              if (campaign) handleViewProspects(campaign);
            }}
            onEdit={handleEdit}
            onEditSettings={handleEditSettings}
            onAddProspects={handleAddProspects}
            onShowAnalytics={handleViewAnalytics}
            onViewProspectsModular={handleViewProspects}
            onReachInbox={handleReachInbox}
            reachInboxConfigured={true}
          />
        </div>
      </div>

      {/* Global Modals */}
      <AnimatePresence mode="wait">
        {showEditModal && (
          <CampaignEditModal
            key="edit-modal"
            isOpen={showEditModal}
            onOpenChange={setShowEditModal}
            campaign={campaignToEdit}
            onSave={handleSaveEdit}
          />
        )}

        {showSettingsModal && (
          <CampaignSettingsModal
            key="settings-modal"
            isOpen={showSettingsModal}
            onOpenChange={setShowSettingsModal}
            campaign={campaignForSettings}
            onSave={handleSaveSettings}
          />
        )}

        {showProspectsModal && (
          <CampaignProspectsModal
            key="prospects-modal"
            isOpen={showProspectsModal}
            onOpenChange={setShowProspectsModal}
            campaign={selectedCampaignForProspects}
            availableProspects={availableProspects}
            availableLists={availableLists}
            loading={loadingProspects}
            loadingLists={loadingLists}
            onAddProspects={handleAddProspects}
            onAddList={async (listId: string) => {
              // Get all prospects from this list and add them
              const listProspects = availableProspects.filter((p: any) => p.session_id === listId);
              const ids = listProspects.map((p: any) => p.id);
              if (ids.length > 0) {
                await handleAddProspects(ids);
              }
            }}
          />
        )}

        {showReachInboxModal && (
          <ReachInboxPushModal
            key="reachinbox-modal"
            isOpen={showReachInboxModal}
            onOpenChange={setShowReachInboxModal}
            campaign={selectedCampaignForReach}
            reachInboxCampaigns={reachInboxCampaigns}
            loading={loadingReachInbox}
            pushing={isPushingToReach}
            onPush={handlePushToReachInbox}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CampaignHub;
