'use client';

import React from 'react';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
import { useState, useEffect } from 'react';
import { createClient } from '@/app/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Mail,
  Linkedin,
  MessageCircle,
  Calendar,
  Target,
  TrendingUp,
  Activity,
  CheckCircle,
  Circle,
  XCircle,
  X,
  Clock,
  Globe,
  AlertCircle,
  Megaphone,
  Pause,
  Play,
  BarChart3,
  Edit,
  FileText,
  MessageSquare,
  Send,
  Brain,
  Plus,
  Settings,
  Upload,
  Zap,
  Eye,
  Grid3x3,
  AlertTriangle,
  Loader2,
  Link,
  Archive,
  Trash2,
  Sparkles,
  Rocket,
  UserPlus
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
// All UI components now use custom Tailwind (shadcn removed)
import CampaignApprovalScreen from '@/app/components/CampaignApprovalScreen';
import { UnipileModal } from '@/components/integrations/UnipileModal';

// Helper function to get human-readable campaign type labels
function getCampaignTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    'connector': 'Connector',
    'messenger': 'Messenger',
    'builder': 'Builder',
    'inbound': 'Inbound',
    'company_follow': 'Company Follow',
    'email': 'Email',
    'multi_channel': 'Multi-Channel'
  };
  return typeLabels[type] || (type ? type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown');
}

function CampaignList({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();

  // Use workspaceId from props - no fallback to prevent loading wrong workspace data
  const actualWorkspaceId = workspaceId;

  // State for modals
  const [showProspectsModal, setShowProspectsModal] = useState(false);
  const [selectedCampaignForProspects, setSelectedCampaignForProspects] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  // Add Prospects modal state
  const [showAddProspects, setShowAddProspects] = useState(false);
  const [selectedCampaignForAdd, setSelectedCampaignForAdd] = useState<any>(null);
  const [availableProspects, setAvailableProspects] = useState<any[]>([]);
  const [selectedProspectIds, setSelectedProspectIds] = useState<string[]>([]);
  const [prospectSearchTerm, setProspectSearchTerm] = useState('');
  const [loadingProspectsForAdd, setLoadingProspectsForAdd] = useState(false);

  // Multi-select state
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // ReachInbox push state
  const [showReachInboxModal, setShowReachInboxModal] = useState(false);
  const [selectedCampaignForReachInbox, setSelectedCampaignForReachInbox] = useState<any>(null);
  const [reachInboxCampaigns, setReachInboxCampaigns] = useState<any[]>([]);
  const [selectedReachInboxCampaign, setSelectedReachInboxCampaign] = useState<string>('');
  const [loadingReachInbox, setLoadingReachInbox] = useState(false);
  const [pushingToReachInbox, setPushingToReachInbox] = useState(false);

  console.log('🏢 [CAMPAIGN HUB] Workspace ID being used:', actualWorkspaceId, 'from prop:', workspaceId);

  // REACT QUERY: Fetch and cache campaigns
  const { data: campaigns = [], isLoading: loading, refetch } = useQuery({
    queryKey: ['campaigns', actualWorkspaceId],
    queryFn: async () => {
      // Return empty if no workspaceId
      if (!actualWorkspaceId) {
        console.warn('CampaignList: No workspaceId provided');
        return [];
      }

      console.log('📡 [CAMPAIGN HUB] Fetching campaigns for workspace:', actualWorkspaceId);

      const response = await fetch(`/api/campaigns?workspace_id=${actualWorkspaceId}`);

      if (!response.ok) {
        console.error('❌ [CAMPAIGN HUB] Failed to load campaigns:', response.statusText);
        // Return empty array on error - no fake data
        return [];
      }

      const data = await response.json();
      // API returns { success: true, data: { campaigns: [...] } } via apiSuccess()
      const campaigns = data.data?.campaigns || data.campaigns || [];
      console.log(`✅ [CAMPAIGN HUB] Fetched ${campaigns.length} campaigns:`, campaigns.map((c: any) => ({ name: c.name, status: c.status })));
      return campaigns;
    },
    enabled: !!actualWorkspaceId, // Only fetch if workspaceId is available
    staleTime: 0, // Always consider data stale - campaigns change frequently
    refetchOnWindowFocus: true,
    refetchOnMount: 'always', // Always refetch on component mount
  });

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener('refreshCampaigns', handleRefresh);

    return () => window.removeEventListener('refreshCampaigns', handleRefresh);
  }, [refetch]);

  // REACT QUERY: Mutation for toggling campaign status
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ campaignId, currentStatus }: { campaignId: string; currentStatus: string }) => {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      // Auto-sync LinkedIn IDs before activating campaign
      if (newStatus === 'active' && workspaceId) {
        try {
          const syncResponse = await fetch('/api/campaigns/sync-linkedin-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId,
              workspaceId
            })
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            console.log(`✅ Auto-synced ${syncResult.resolved || 0} LinkedIn IDs`);
          }
        } catch (error) {
          console.warn('LinkedIn ID sync failed:', error);
          // Continue with activation anyway
        }
      }

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign status');
      }

      // If activating campaign, trigger it via queue-based execution (30 min spacing)
      if (newStatus === 'active' && workspaceId) {
        try {
          console.log(`🚀 Auto-launching campaign ${campaignId} (queued, 30 min spacing)...`);
          const launchResponse = await fetch('/api/campaigns/direct/send-connection-requests-fast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              campaignId
            })
          });

          if (launchResponse.ok) {
            const launchResult = await launchResponse.json();
            console.log('✅ Campaign launched:', launchResult);
            return { campaignId, newStatus, launched: true, launchResult };
          } else {
            // Get error details from response
            const errorData = await launchResponse.json().catch(() => ({ error: 'Unknown error' }));
            const errorMessage = errorData.error || errorData.message || 'Campaign launch failed';
            const errorDetails = errorData.details || '';

            console.error('❌ Campaign launch failed:', errorMessage, errorDetails);
            throw new Error(`${errorMessage}${errorDetails ? ': ' + errorDetails : ''}`);
          }
        } catch (error: any) {
          console.error('❌ Campaign launch error:', error);
          throw new Error(`Campaign launch failed: ${error.message || 'Unknown error'}`);
        }
      }

      return { campaignId, newStatus };
    },
    onSuccess: async (data) => {
      // Add 3-second delay before invalidating cache to allow backend processing
      if (data.launched) {
        const result = data.launchResult;
        const sent = result.sent || 0;
        const failed = result.failed || 0;
        const processed = result.processed || 0;
        const skipped = processed - sent - failed;

        // Build summary message
        let message = `Campaign executed: ${sent} sent`;
        if (skipped > 0) message += `, ${skipped} skipped`;
        if (failed > 0) message += `, ${failed} failed`;

        toastSuccess(message);

        // Log details of skipped/failed prospects for troubleshooting
        if (result.results && (skipped > 0 || failed > 0)) {
          const issues = result.results
            .filter((r: any) => r.status !== 'success')
            .map((r: any) => `${r.name}: ${r.reason || 'unknown'}`);

          if (issues.length > 0) {
            console.warn('🔍 Skipped/Failed prospects:', issues.join('\n'));

            // Count by reason type
            const reasonCounts: Record<string, number> = {};
            result.results
              .filter((r: any) => r.status !== 'success')
              .forEach((r: any) => {
                const reason = r.reason || 'unknown';
                reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
              });

            console.warn('📊 Breakdown by reason:', reasonCounts);
          }
        }

        // Wait for backend to finish processing prospects
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        toastSuccess('Campaign status updated');
      }

      // Invalidate and refetch campaigns
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    },
    onError: (error: any) => {
      console.error('Error toggling campaign status:', error);
      const errorMessage = error.message || 'Failed to update campaign status';
      toastError(errorMessage);
    }
  });

  const toggleCampaignStatus = (campaignId: string, currentStatus: string) => {
    toggleStatusMutation.mutate({ campaignId, currentStatus });
  };

  // REACT QUERY: Mutation for archiving campaign
  const archiveMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });

      if (!response.ok) {
        throw new Error('Failed to archive campaign');
      }

      return { campaignId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      toastSuccess('Campaign archived');
    },
    onError: (error) => {
      console.error('Error archiving campaign:', error);
      toastError('Failed to archive campaign');
    }
  });

  const archiveCampaign = (campaignId: string) => {
    if (confirm('Archive this campaign? This will permanently stop it and move it to archived campaigns.')) {
      archiveMutation.mutate(campaignId);
    }
  };

  // REACT QUERY: Mutation for executing campaign
  const executeMutation = useMutation({
    mutationFn: async (campaignId: string) => {
      console.log(`🚀 Executing campaign ${campaignId} (fast queue mode)...`);

      // Find campaign to determine its type
      const campaign = campaigns.find((c: any) => c.id === campaignId);
      const isMessengerCampaign = campaign?.campaign_type === 'messenger';

      // Use appropriate endpoint based on campaign type
      const endpoint = isMessengerCampaign
        ? '/api/campaigns/direct/send-messages-queued'
        : '/api/campaigns/direct/send-connection-requests-fast';

      console.log(`📍 Campaign type: ${campaign?.campaign_type || 'unknown'}`);
      console.log(`🔗 Using endpoint: ${endpoint}`);

      // Use fast endpoint that returns immediately (no validation - happens in background)
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          campaignId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || errorData.message || 'Campaign execution failed');
      }

      const result = await response.json();
      return { campaignId, result };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      toastSuccess('Campaign launched successfully!');
      console.log('✅ Campaign execution result:', data.result);
    },
    onError: (error: any) => {
      console.error('Error executing campaign:', error);
      toastError(error.message || 'Failed to launch campaign');
    }
  });

  const executeCampaign = (campaignId: string) => {
    executeMutation.mutate(campaignId);
  };

  const showCampaignAnalytics = (campaignId: string) => {
    // TODO: Open analytics modal or navigate to analytics view
    toastError(`Analytics for campaign ${campaignId} - Coming soon!`);
  };

  const viewMessages = (campaign: any) => {
    console.log('👁️ View messages clicked:', campaign);

    if (!campaign || !campaign.id) {
      toastError('Invalid campaign data');
      return;
    }

    // Open edit modal in read-only mode to view messages
    setCampaignToEdit(campaign);
    setEditFormData({
      name: campaign.name || campaign.campaign_name || '',
      connection_message: campaign.connection_message || campaign.message_templates?.connection_request || '',
      alternative_message: campaign.alternative_message || campaign.message_templates?.alternative_message || '',
      follow_up_messages: campaign.follow_up_messages?.length > 0
        ? campaign.follow_up_messages
        : (campaign.message_templates?.follow_up_messages || []),
      // Email subject lines
      initial_subject: campaign.message_templates?.initial_subject || '',
      follow_up_subjects: campaign.message_templates?.follow_up_subjects || [],
      use_threaded_replies: campaign.message_templates?.use_threaded_replies || false,
      timing: campaign.timing || {}
    });
    setShowEditModal(true);
  };

  const editCampaign = (campaign: any) => {
    console.log('🎯 Edit campaign clicked:', campaign);

    // Validate campaign data
    if (!campaign || !campaign.id) {
      toastError('Invalid campaign data');
      return;
    }

    // Check if campaign is active - must pause first
    if (campaign.status === 'active') {
      toastWarning('Cannot edit an active campaign. Pause it first.');
      return;
    }

    // If messages have been sent, show info but allow editing
    if (campaign.sent && campaign.sent > 0) {
      toastInfo(`⚠️ ${campaign.sent} messages already sent. Changes will only affect future messages.`);
    }

    console.log('✅ Opening edit modal for campaign:', campaign.id);
    console.log('📧 Campaign data:', {
      campaign_type: campaign.campaign_type,
      direct_connection: campaign.connection_message,
      template_connection: campaign.message_templates?.connection_request,
      direct_alternative: campaign.alternative_message,
      template_alternative: campaign.message_templates?.alternative_message,
      direct_followups: campaign.follow_up_messages,
      template_followups: campaign.message_templates?.follow_up_messages
    });

    setCampaignToEdit(campaign);

    const isEmailCampaign = campaign.campaign_type === 'email';

    // Email campaigns use email_body field, LinkedIn uses connection_request
    const emailBody = isEmailCampaign
      ? (campaign.message_templates?.email_body || campaign.message_templates?.alternative_message || '')
      : '';

    const connectionMessage = isEmailCampaign
      ? ''
      : (campaign.connection_message || campaign.message_templates?.connection_request || '');

    const alternativeMessage = isEmailCampaign
      ? ''
      : (campaign.alternative_message || campaign.message_templates?.alternative_message || '');

    // Load from message_templates if direct fields are empty
    setEditFormData({
      name: campaign.name || '',
      connection_message: connectionMessage,
      alternative_message: alternativeMessage,
      // NEW: email_body field for email campaigns
      email_body: emailBody,
      follow_up_messages: campaign.follow_up_messages?.length > 0
        ? campaign.follow_up_messages
        : (campaign.message_templates?.follow_up_messages || []),
      // Email subject lines
      initial_subject: campaign.message_templates?.initial_subject || '',
      follow_up_subjects: campaign.message_templates?.follow_up_subjects || [],
      use_threaded_replies: campaign.message_templates?.use_threaded_replies || false,
      timing: campaign.timing || {}
    });
    setShowEditModal(true);
  };

  const handleSaveCampaignEdit = async () => {
    if (!campaignToEdit) return;

    try {
      const isEmailCampaign = campaignToEdit.campaign_type === 'email';

      // Build message_templates - email uses email_body, LinkedIn uses connection_request
      const message_templates = {
        // LinkedIn fields - empty for email campaigns
        connection_request: isEmailCampaign ? '' : (editFormData.connection_message || ''),
        alternative_message: isEmailCampaign ? '' : (editFormData.alternative_message || ''),
        // Email field - empty for LinkedIn campaigns
        email_body: isEmailCampaign ? (editFormData.email_body || '') : '',
        // Shared fields
        follow_up_messages: editFormData.follow_up_messages || [],
        initial_subject: editFormData.initial_subject || '',
        follow_up_subjects: editFormData.follow_up_subjects || [],
        use_threaded_replies: editFormData.use_threaded_replies || false
      };

      const updatePayload = {
        name: editFormData.name,
        connection_message: isEmailCampaign ? '' : editFormData.connection_message,
        alternative_message: isEmailCampaign ? '' : editFormData.alternative_message,
        follow_up_messages: editFormData.follow_up_messages,
        message_templates
      };

      const response = await fetch(`/api/campaigns/${campaignToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      toastSuccess('Campaign updated successfully!');
      setShowEditModal(false);
      setCampaignToEdit(null);

      // Refresh campaigns list
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toastError('Failed to update campaign');
    }
  };

  // Handler for viewing prospects
  const viewProspects = (campaignId: string) => {
    console.log('👥 View Prospects clicked:', campaignId);

    if (!campaignId) {
      toastError('Invalid campaign ID');
      return;
    }

    setSelectedCampaignForProspects(campaignId);
    setShowProspectsModal(true);
  };

  // Handler for opening Add Prospects modal
  const openAddProspectsModal = async (campaign: any) => {
    console.log('➕ Add Prospects clicked:', campaign.id);

    setSelectedCampaignForAdd(campaign);
    setShowAddProspects(true);
    setLoadingProspectsForAdd(true);

    // Fetch available prospects from workspace_prospects table
    try {
      const supabase = createClient();
      const { data: prospects, error } = await supabase
        .from('workspace_prospects')
        .select('*')
        .eq('workspace_id', actualWorkspaceId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch prospects:', error);
        toastError('Failed to load prospects');
        setAvailableProspects([]);
      } else {
        console.log('✅ Loaded', prospects?.length || 0, 'available prospects');
        setAvailableProspects(prospects || []);
      }
    } catch (error) {
      console.error('Error fetching prospects:', error);
      toastError('Failed to load prospects');
      setAvailableProspects([]);
    } finally {
      setLoadingProspectsForAdd(false);
    }
  };

  // Handler for toggling prospect selection
  const toggleProspectSelection = (prospectId: string) => {
    setSelectedProspectIds(prev => {
      if (prev.includes(prospectId)) {
        return prev.filter(id => id !== prospectId);
      } else {
        return [...prev, prospectId];
      }
    });
  };

  // Handler for adding selected prospects to campaign
  const handleAddProspects = async () => {
    if (!selectedCampaignForAdd || selectedProspectIds.length === 0) {
      toastError('Please select at least one prospect');
      return;
    }

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaignForAdd.id}/prospects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospect_ids: selectedProspectIds })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          // Conflict with other campaigns
          const conflictList = data.conflicts
            .map((c: any) => `- ${c.name} (in ${c.current_campaign})`)
            .join('\n');
          toastError(`Campaign conflict:\n\n${data.message}\n\n${conflictList}`);
        } else {
          toastError(data.error || 'Failed to add prospects');
        }
        return;
      }

      toastSuccess(`Added ${data.added_prospects} prospect(s) to campaign`);

      // Reset state
      setShowAddProspects(false);
      setSelectedProspectIds([]);
      setProspectSearchTerm('');

      // Refresh campaigns list
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    } catch (error) {
      console.error('Error adding prospects:', error);
      toastError('Failed to add prospects to campaign');
    }
  };

  // ReachInbox push handlers
  const openReachInboxModal = async (campaign: any) => {
    console.log('📧 Push to ReachInbox clicked:', campaign.id);

    setSelectedCampaignForReachInbox(campaign);
    setShowReachInboxModal(true);
    setLoadingReachInbox(true);

    // Fetch available ReachInbox campaigns
    try {
      const response = await fetch('/api/campaigns/email/reachinbox/push-leads');
      const data = await response.json();

      if (data.success && data.campaigns) {
        console.log('✅ Loaded', data.campaigns.length, 'ReachInbox campaigns');
        setReachInboxCampaigns(data.campaigns);
      } else {
        console.error('Failed to fetch ReachInbox campaigns:', data.error);
        toastError(data.error || 'Failed to load ReachInbox campaigns');
        setReachInboxCampaigns([]);
      }
    } catch (error) {
      console.error('Error fetching ReachInbox campaigns:', error);
      toastError('Failed to connect to ReachInbox');
      setReachInboxCampaigns([]);
    } finally {
      setLoadingReachInbox(false);
    }
  };

  const handlePushToReachInbox = async () => {
    if (!selectedCampaignForReachInbox || !selectedReachInboxCampaign) {
      toastError('Please select a ReachInbox campaign');
      return;
    }

    setPushingToReachInbox(true);

    try {
      const response = await fetch('/api/campaigns/email/reachinbox/push-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reachinbox_campaign_id: selectedReachInboxCampaign,
          sam_campaign_id: selectedCampaignForReachInbox.id
        })
      });

      const data = await response.json();

      if (data.success) {
        toastSuccess(`Pushed ${data.data.leads_pushed} leads to ReachInbox campaign "${data.data.reachinbox_campaign_name}"`);
        setShowReachInboxModal(false);
        setSelectedReachInboxCampaign('');
        setSelectedCampaignForReachInbox(null);

        // Refresh campaigns list
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      } else {
        toastError(data.error || 'Failed to push leads to ReachInbox');
      }
    } catch (error) {
      console.error('Error pushing to ReachInbox:', error);
      toastError('Failed to push leads to ReachInbox');
    } finally {
      setPushingToReachInbox(false);
    }
  };

  // Multi-select handlers
  const toggleCampaignSelection = (campaignId: string) => {
    setSelectedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (campaigns: any[]) => {
    if (selectedCampaigns.size === campaigns.length) {
      setSelectedCampaigns(new Set());
    } else {
      setSelectedCampaigns(new Set(campaigns.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCampaigns(new Set());
    setIsMultiSelectMode(false);
  };

  const handleBulkDelete = async () => {
    if (selectedCampaigns.size === 0) return;

    const confirmDelete = confirm(`Delete ${selectedCampaigns.size} campaign(s)? This cannot be undone.`);
    if (!confirmDelete) return;

    try {
      await Promise.all(
        Array.from(selectedCampaigns).map(campaignId =>
          fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
        )
      );
      toastSuccess(`Deleted ${selectedCampaigns.size} campaign(s)`);
      clearSelection();
      refetch();
    } catch (error) {
      toastError('Failed to delete some campaigns');
    }
  };

  const handleBulkPause = async () => {
    if (selectedCampaigns.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedCampaigns).map(campaignId =>
          fetch(`/api/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paused' })
          })
        )
      );
      toastSuccess(`Paused ${selectedCampaigns.size} campaign(s)`);
      clearSelection();
      refetch();
    } catch (error) {
      toastError('Failed to pause some campaigns');
    }
  };

  const handleBulkResume = async () => {
    if (selectedCampaigns.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedCampaigns).map(campaignId =>
          fetch(`/api/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
          })
        )
      );
      toastSuccess(`Resumed ${selectedCampaigns.size} campaign(s)`);
      clearSelection();
      refetch();
    } catch (error) {
      toastError('Failed to resume some campaigns');
    }
  };

  // REACT QUERY: Load campaign prospects
  const { data: campaignProspects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ['campaignProspects', selectedCampaignForProspects],
    queryFn: async () => {
      if (!selectedCampaignForProspects) return [];
      const response = await fetch(`/api/campaigns/${selectedCampaignForProspects}/prospects`);
      if (!response.ok) throw new Error('Failed to load campaign prospects');
      const result = await response.json();
      return result.prospects || [];
    },
    enabled: !!selectedCampaignForProspects && showProspectsModal,
    refetchInterval: 10000, // Auto-refresh every 10 seconds
    staleTime: 5 * 1000, // Consider data stale after 5 seconds
  });

  // Real-time subscription for prospect status updates
  useEffect(() => {
    if (!selectedCampaignForProspects || !showProspectsModal) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`campaign-prospects-${selectedCampaignForProspects}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'campaign_prospects',
          filter: `campaign_id=eq.${selectedCampaignForProspects}`
        },
        () => {
          // Refetch prospects when any update occurs
          queryClient.invalidateQueries({ queryKey: ['campaignProspects', selectedCampaignForProspects] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCampaignForProspects, showProspectsModal, queryClient]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-900/20 border-green-500';
      case 'paused': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
      case 'draft': return 'text-gray-400 bg-gray-900/20 border-gray-500';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={14} className="text-green-400" />;
      case 'paused': return <Clock size={14} className="text-yellow-400" />;
      case 'draft': return <FileText size={14} className="text-gray-400" />;
      default: return <FileText size={14} className="text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Saved as Draft';
      case 'active': return 'Active';
      case 'paused': return 'Paused';
      case 'completed': return 'Completed';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-gray-800 rounded-xl border border-gray-700 p-6">
            <div className="h-6 bg-gray-700 rounded mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700">
              <div className="h-8 bg-gray-700 rounded"></div>
              <div className="h-8 bg-gray-700 rounded"></div>
              <div className="h-8 bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {campaigns.map((c, index) => (
        <motion.div
          key={c.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: index * 0.05 }}
          whileHover={{
            scale: 1.02,
            y: -5,
            boxShadow: "0 25px 50px -12px rgba(168, 85, 247, 0.25)"
          }}
        >
        <div
          className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm rounded-xl border border-gray-700 hover:border-purple-500/50 hover:bg-gradient-to-br hover:from-purple-600/20 hover:to-purple-900/20 shadow-xl hover:shadow-purple-500/20 group transition-all duration-300"
        >
          <div className="p-6 pb-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="text-white font-semibold text-lg group-hover:text-white mb-2">
                  {c.name}
                </h3>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusColor(c.status)}`}>
                  {getStatusIcon(c.status)}
                  {getStatusLabel(c.status)}
                </span>
              </div>
              <div className="flex gap-2 ml-4 relative z-10">
                {c.status === 'active' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCampaignStatus(c.id, c.status);
                    }}
                    className="p-2 rounded-md text-yellow-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white transition-colors"
                    title="Pause campaign"
                    type="button"
                  >
                    <Pause size={16} />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCampaignStatus(c.id, c.status);
                    }}
                    className="p-2 rounded-md text-green-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white transition-colors"
                    title="Resume campaign"
                    type="button"
                  >
                    <Play size={16} />
                  </button>
                )}
                {(c.status === 'active' || c.status === 'paused') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      executeCampaign(c.id);
                    }}
                    className="p-2 rounded-md text-purple-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white transition-colors"
                    title="Launch campaign now"
                    type="button"
                  >
                    <Rocket size={16} />
                  </button>
                )}
                {c.status !== 'archived' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveCampaign(c.id);
                    }}
                    className="p-2 rounded-md text-gray-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white transition-colors"
                    title="Archive campaign"
                    type="button"
                  >
                    <Archive size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🔵 Eye button clicked!', c.id);
                    viewMessages(c);
                  }}
                  className="p-2 rounded-md text-cyan-400 hover:bg-gray-700 hover:text-white transition-colors"
                  title="View messages"
                  type="button"
                >
                  <Eye size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🟠 Users button clicked!', c.id);
                    viewProspects(c.id);
                  }}
                  className="p-2 rounded-md text-orange-400 hover:bg-gray-700 hover:text-white transition-colors"
                  title="View prospects"
                  type="button"
                >
                  <Users size={16} />
                </button>
                {c.status !== 'archived' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('🟢 Add Prospects button clicked!', c.id);
                      openAddProspectsModal(c);
                    }}
                    className="p-2 rounded-md text-green-400 hover:bg-gray-700 hover:text-white transition-colors"
                    title="Add prospects to campaign"
                    type="button"
                  >
                    <UserPlus size={16} />
                  </button>
                )}
                {c.campaign_type === 'email' && c.status !== 'archived' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('📧 Push to ReachInbox button clicked!', c.id);
                      openReachInboxModal(c);
                    }}
                    className="p-2 rounded-md text-pink-400 hover:bg-gray-700 hover:text-white transition-colors"
                    title="Push to ReachInbox"
                    type="button"
                  >
                    <Send size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🔷 Analytics button clicked!', c.id);
                    showCampaignAnalytics(c.id);
                  }}
                  className="p-2 rounded-md text-blue-400 hover:bg-gray-700 hover:text-white transition-colors"
                  title="View analytics"
                  type="button"
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('🟣 Edit button clicked!', c.id);
                    editCampaign(c);
                  }}
                  className="p-2 rounded-md text-purple-400 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={c.sent > 0 ? "Cannot edit (messages sent)" : "Edit campaign"}
                  disabled={c.sent > 0}
                  type="button"
                >
                  <Edit size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 pb-6">
            {c.status !== 'draft' && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700 group-hover:border-purple-400">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.sent}</div>
                  <div className="text-gray-400 group-hover:text-purple-100 text-xs">Sent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.opened}</div>
                  <div className="text-gray-400 group-hover:text-purple-100 text-xs">Opened</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.replied}</div>
                  <div className="text-gray-400 group-hover:text-purple-100 text-xs">Replied</div>
                </div>
              </div>
            )}

            {c.status === 'draft' && (
              <div className="pt-4 border-t border-gray-700 group-hover:border-purple-400">
                <div className="text-center text-gray-400 group-hover:text-purple-100 text-sm">
                  Ready to configure and launch
                </div>
              </div>
            )}
          </div>
        </div>
        </motion.div>
      ))}

      {/* Edit Campaign Modal */}
      {showEditModal && campaignToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-hidden flex flex-col border border-purple-500">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h2 className="text-2xl text-white flex items-center gap-2">
                  <Edit className="text-purple-400" size={24} />
                  Edit Campaign: {campaignToEdit.name}
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Update campaign messages and settings
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Campaign name"
                />
              </div>

              {/* Connection Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Connection Request Message</label>
                <textarea
                  value={editFormData.connection_message || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, connection_message: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-none"
                  placeholder="Hi {{firstName}}, I noticed..."
                />
                <p className="text-xs text-gray-500 mt-1">Available variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{company}}'}, {'{{title}}'}</p>
              </div>

              {/* Email Body (for email campaigns) OR Alternative Message (for LinkedIn) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {campaignToEdit?.campaign_type === 'email' ? 'Initial Email Body' : 'Alternative Message (Optional)'}
                </label>
                <textarea
                  value={campaignToEdit?.campaign_type === 'email' ? (editFormData.email_body || '') : (editFormData.alternative_message || '')}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    // For email campaigns, update email_body. For LinkedIn, update alternative_message
                    ...(campaignToEdit?.campaign_type === 'email'
                      ? { email_body: e.target.value }
                      : { alternative_message: e.target.value })
                  })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-none"
                  placeholder={campaignToEdit?.campaign_type === 'email' ? "Initial email body..." : "Alternative message if already connected..."}
                />
              </div>

              {/* Email Subject Lines - Only show for email campaigns */}
              {campaignToEdit?.campaign_type === 'email' && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-4">
                  <h4 className="text-blue-400 font-medium flex items-center gap-2">
                    <Mail size={18} />
                    Email Subject Lines
                  </h4>

                  {/* Initial Subject */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Initial Email Subject</label>
                    <input
                      type="text"
                      value={editFormData.initial_subject || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, initial_subject: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Quick question about {{company}}"
                    />
                  </div>

                  {/* Threading Option */}
                  <div className="flex items-center gap-3 bg-gray-700/50 rounded-lg p-3">
                    <input
                      type="checkbox"
                      id="edit-use-threaded-replies"
                      checked={editFormData.use_threaded_replies || false}
                      onChange={(e) => setEditFormData({ ...editFormData, use_threaded_replies: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <label htmlFor="edit-use-threaded-replies" className="text-white cursor-pointer font-medium text-sm">
                        Use threaded replies (RE:)
                      </label>
                      <p className="text-xs text-gray-400">
                        {editFormData.use_threaded_replies
                          ? `Follow-ups will use "RE: ${editFormData.initial_subject || '[Initial Subject]'}"`
                          : 'Each follow-up will have its own subject line'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Follow-up Subjects (only if not using threaded replies) */}
                  {!editFormData.use_threaded_replies && editFormData.follow_up_messages?.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Follow-up Subject Lines</label>
                      {editFormData.follow_up_messages.map((_: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-12">FU{index + 1}:</span>
                          <input
                            type="text"
                            value={editFormData.follow_up_subjects?.[index] || ''}
                            onChange={(e) => {
                              const updated = [...(editFormData.follow_up_subjects || [])];
                              updated[index] = e.target.value;
                              setEditFormData({ ...editFormData, follow_up_subjects: updated });
                            }}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Subject for follow-up ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up Messages */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Follow-up Messages</label>
                <div className="space-y-3">
                  {(editFormData.follow_up_messages || []).map((msg: any, index: number) => (
                    <div key={index} className="bg-gray-700/50 border border-gray-600 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Follow-up #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...editFormData.follow_up_messages];
                            updated.splice(index, 1);
                            setEditFormData({ ...editFormData, follow_up_messages: updated });
                          }}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <textarea
                        value={typeof msg === 'string' ? msg : (msg.message || msg.content || '')}
                        onChange={(e) => {
                          const updated = [...editFormData.follow_up_messages];
                          updated[index] = typeof msg === 'string' ? e.target.value : { ...msg, message: e.target.value };
                          setEditFormData({ ...editFormData, follow_up_messages: updated });
                        }}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[80px] resize-none"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setEditFormData({
                        ...editFormData,
                        follow_up_messages: [...(editFormData.follow_up_messages || []), '']
                      });
                    }}
                    className="flex items-center gap-1 px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors text-sm"
                  >
                    <Plus size={14} />
                    Add Follow-up
                  </button>
                </div>
              </div>

              {/* Messaging Cadence */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={18} className="text-purple-400" />
                  <label className="text-sm font-medium text-gray-300">Messaging Cadence (Days Between Follow-ups)</label>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">FU1 Delay</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.timing?.fu1_delay_days || 2}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        timing: { ...(editFormData.timing || {}), fu1_delay_days: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">FU2 Delay</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.timing?.fu2_delay_days || 5}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        timing: { ...(editFormData.timing || {}), fu2_delay_days: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">FU3 Delay</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.timing?.fu3_delay_days || 7}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        timing: { ...(editFormData.timing || {}), fu3_delay_days: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">FU4 Delay</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.timing?.fu4_delay_days || 5}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        timing: { ...(editFormData.timing || {}), fu4_delay_days: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Goodbye Delay</label>
                    <input
                      type="number"
                      min="1"
                      value={editFormData.timing?.gb_delay_days || 7}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        timing: { ...(editFormData.timing || {}), gb_delay_days: parseInt(e.target.value) }
                      })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Number of days to wait between each follow-up message
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCampaignEdit}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prospects Modal */}
      {showProspectsModal && selectedCampaignForProspects && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 my-8 max-h-[90vh] overflow-hidden flex flex-col border border-orange-500">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h2 className="text-2xl text-white flex items-center gap-2">
                  <Users className="text-orange-400" size={24} />
                  Campaign Prospects
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  {loadingProspects ? 'Loading prospects...' : `${campaignProspects.length} prospects in this campaign`}
                </p>
              </div>
              <button
                onClick={() => setShowProspectsModal(false)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {loadingProspects ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-purple-400" size={48} />
                </div>
              ) : campaignProspects.length > 0 ? (
                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-700 border-b border-gray-600">
                        <th className="text-left text-gray-300 font-medium px-4 py-3 text-sm">Name</th>
                        <th className="text-left text-gray-300 font-medium px-4 py-3 text-sm">Title</th>
                        <th className="text-left text-gray-300 font-medium px-4 py-3 text-sm">Company</th>
                        <th className="text-left text-gray-300 font-medium px-4 py-3 text-sm">Status</th>
                        <th className="text-center text-gray-300 font-medium px-4 py-3 text-sm">CR Sent</th>
                        <th className="text-center text-gray-300 font-medium px-4 py-3 text-sm">Connected</th>
                        <th className="text-center text-gray-300 font-medium px-4 py-3 text-sm">FU Sent</th>
                        <th className="text-center text-gray-300 font-medium px-4 py-3 text-sm">Replied</th>
                        <th className="text-center text-gray-300 font-medium px-4 py-3 text-sm">Opted Out</th>
                        <th className="text-left text-gray-300 font-medium px-4 py-3 text-sm">LinkedIn</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignProspects.map((prospect: any) => (
                        <tr key={prospect.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                          <td className="text-white px-4 py-3">
                            {prospect.first_name} {prospect.last_name}
                          </td>
                          <td className="text-gray-300 px-4 py-3">{prospect.title || '-'}</td>
                          <td className="text-gray-300 px-4 py-3">{prospect.company || '-'}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${
                                prospect.status === 'cr_sent' ? 'bg-green-900/20 text-green-400 border-green-500' :
                                prospect.status === 'fu1_sent' ? 'bg-blue-900/20 text-blue-400 border-blue-500' :
                                prospect.status === 'fu2_sent' ? 'bg-blue-900/20 text-blue-400 border-blue-500' :
                                prospect.status === 'fu3_sent' ? 'bg-purple-900/20 text-purple-400 border-purple-500' :
                                prospect.status === 'fu4_sent' ? 'bg-purple-900/20 text-purple-400 border-purple-500' :
                                prospect.status === 'fu5_sent' ? 'bg-purple-900/20 text-purple-400 border-purple-500' :
                                prospect.status === 'completed' ? 'bg-cyan-900/20 text-cyan-400 border-cyan-500' :
                                prospect.status === 'failed' ? 'bg-red-900/20 text-red-400 border-red-500' :
                                prospect.status === 'daily_limit_exceeded' ? 'bg-orange-900/20 text-orange-400 border-orange-500' :
                                prospect.status === 'weekly_limit_exceeded' ? 'bg-red-900/20 text-red-400 border-red-500' :
                                prospect.status === 'approved' ? 'bg-yellow-900/20 text-yellow-400 border-yellow-500' :
                                prospect.status === 'pending' ? 'bg-gray-900/20 text-gray-400 border-gray-500' :
                                'bg-gray-900/20 text-gray-400 border-gray-500'
                              }`}
                            >
                              {prospect.status === 'daily_limit_exceeded' ? 'Daily Limit' :
                               prospect.status === 'weekly_limit_exceeded' ? 'Weekly Limit' :
                               prospect.status?.replace(/_/g, ' ') || 'pending'}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={prospect.status === 'cr_sent' || prospect.status?.startsWith('fu') ? "text-green-400 font-semibold" : "text-gray-500"}>
                              {prospect.status === 'cr_sent' || prospect.status?.startsWith('fu') ? "✓" : "-"}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={prospect.connection_accepted_at ? "text-green-400 font-semibold" : "text-gray-500"}>
                              {prospect.connection_accepted_at ? "✓" : "-"}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={prospect.status?.startsWith('fu') ? "text-purple-400 font-semibold" : "text-gray-500"}>
                              {prospect.status === 'fu1_sent' ? '1' :
                               prospect.status === 'fu2_sent' ? '2' :
                               prospect.status === 'fu3_sent' ? '3' :
                               prospect.status === 'fu4_sent' ? '4' :
                               prospect.status === 'fu5_sent' ? '5' :
                               prospect.status === 'completed' ? '5' : '0'}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={prospect.responded_at ? "text-blue-400 font-semibold" : "text-gray-500"}>
                              {prospect.responded_at ? "✓" : "-"}
                            </span>
                          </td>
                          <td className="text-center px-4 py-3">
                            <span className={prospect.status === 'opted_out' ? "text-red-400 font-semibold" : "text-gray-500"}>
                              {prospect.status === 'opted_out' ? "✓" : "-"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {prospect.linkedin_url ? (
                              <a
                                href={prospect.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              >
                                <Link size={14} />
                                View
                              </a>
                            ) : (
                              <span className="text-gray-600">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <Users size={48} className="mx-auto mb-4 text-gray-600" />
                  <p>No prospects found for this campaign</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-end">
              <button
                type="button"
                onClick={() => setShowProspectsModal(false)}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Prospects Modal */}
      {showAddProspects && selectedCampaignForAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-hidden flex flex-col border border-green-500">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h2 className="text-2xl text-white flex items-center gap-2">
                  <UserPlus className="text-green-400" size={24} />
                  Add Prospects to Campaign
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Select prospects from your database to add to "{selectedCampaignForAdd.name}"
                </p>
              </div>
              <button
                onClick={() => setShowAddProspects(false)}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Search/Filter */}
              <input
                type="text"
                placeholder="Search prospects by name, company, title..."
                value={prospectSearchTerm}
                onChange={(e) => setProspectSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              />

              {/* Prospect List */}
              {loadingProspectsForAdd ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-green-400" size={48} />
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto border border-gray-700 rounded-lg">
                  {availableProspects
                    .filter(p => {
                      if (!prospectSearchTerm) return true;
                      const searchLower = prospectSearchTerm.toLowerCase();
                      return (
                        p.first_name?.toLowerCase().includes(searchLower) ||
                        p.last_name?.toLowerCase().includes(searchLower) ||
                        p.company_name?.toLowerCase().includes(searchLower) ||
                        p.title?.toLowerCase().includes(searchLower)
                      );
                    })
                    .map((prospect) => (
                      <div
                        key={prospect.id}
                        className="flex items-center gap-3 p-3 border-b border-gray-700 hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => toggleProspectSelection(prospect.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedProspectIds.includes(prospect.id)}
                          onChange={() => toggleProspectSelection(prospect.id)}
                          className="w-4 h-4 text-green-600 bg-gray-700 border-gray-600 rounded focus:ring-green-500"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-white">
                            {prospect.first_name} {prospect.last_name}
                          </div>
                          <div className="text-sm text-gray-400">
                            {prospect.title || 'No title'} at {prospect.company_name || 'No company'}
                          </div>
                        </div>
                      </div>
                    ))}

                  {availableProspects.filter(p => {
                    if (!prospectSearchTerm) return true;
                    const searchLower = prospectSearchTerm.toLowerCase();
                    return (
                      p.first_name?.toLowerCase().includes(searchLower) ||
                      p.last_name?.toLowerCase().includes(searchLower) ||
                      p.company_name?.toLowerCase().includes(searchLower) ||
                      p.title?.toLowerCase().includes(searchLower)
                    );
                  }).length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <Users size={48} className="mx-auto mb-4 text-gray-600" />
                      <p>No prospects found</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-between items-center">
              <div className="text-sm text-gray-400">
                {selectedProspectIds.length} prospect(s) selected
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddProspects(false);
                    setSelectedProspectIds([]);
                    setProspectSearchTerm('');
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddProspects}
                  disabled={selectedProspectIds.length === 0}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add {selectedProspectIds.length} Prospect{selectedProspectIds.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ReachInbox Push Modal */}
      {showReachInboxModal && selectedCampaignForReachInbox && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 my-8 border border-pink-500">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <div>
                <h2 className="text-2xl text-white flex items-center gap-2">
                  <Send className="text-pink-400" size={24} />
                  Push to ReachInbox
                </h2>
                <p className="text-gray-400 text-sm mt-1">
                  Push leads from "{selectedCampaignForReachInbox.name}" to a ReachInbox campaign
                </p>
              </div>
              <button
                onClick={() => {
                  setShowReachInboxModal(false);
                  setSelectedReachInboxCampaign('');
                }}
                className="text-gray-400 hover:text-gray-300 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {loadingReachInbox ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="animate-spin text-pink-400" size={48} />
                  <span className="ml-3 text-gray-400">Loading ReachInbox campaigns...</span>
                </div>
              ) : reachInboxCampaigns.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Mail size={48} className="mx-auto mb-4 text-gray-600" />
                  <p>No ReachInbox campaigns found</p>
                  <p className="text-sm mt-2">Create a campaign in ReachInbox first</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Select ReachInbox Campaign
                    </label>
                    <select
                      value={selectedReachInboxCampaign}
                      onChange={(e) => setSelectedReachInboxCampaign(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      <option value="">Select a campaign...</option>
                      {reachInboxCampaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.name} ({campaign.status}) - {campaign.leads_count || 0} leads
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-sm text-gray-300">
                      <p className="flex justify-between mb-2">
                        <span>SAM Campaign:</span>
                        <span className="text-white">{selectedCampaignForReachInbox.name}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Prospects to push:</span>
                        <span className="text-white">{selectedCampaignForReachInbox.prospects_count || selectedCampaignForReachInbox.total_prospects || 'All pending'}</span>
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500">
                    Leads will be pushed with email, name, company, and job title. Only prospects with valid email addresses will be included.
                  </p>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReachInboxModal(false);
                  setSelectedReachInboxCampaign('');
                }}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePushToReachInbox}
                disabled={!selectedReachInboxCampaign || pushingToReachInbox || loadingReachInbox}
                className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {pushingToReachInbox ? (
                  <>
                    <Loader2 className="animate-spin" size={16} />
                    Pushing...
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    Push to ReachInbox
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Campaign Builder Component from v1
function CampaignBuilder({
  onClose,
  initialProspects,
  initialCampaignType,
  draftToLoad,
  onPrepareForApproval,
  workspaceId,
  clientCode,
  connectedAccounts,
  setConnectedAccounts,
  setShowUnipileWizard,
  setUnipileProvider
}: {
  onClose?: () => void;
  initialProspects?: any[] | null;
  initialCampaignType?: 'email' | 'linkedin';
  draftToLoad?: any;
  onPrepareForApproval?: (campaignData: any) => void;
  workspaceId?: string | null;
  clientCode?: string | null;
  connectedAccounts: { linkedin: boolean; email: boolean };
  setConnectedAccounts: (accounts: { linkedin: boolean; email: boolean }) => void;
  setShowUnipileWizard: (show: boolean) => void;
  setUnipileProvider: (provider: 'LINKEDIN' | 'GOOGLE' | 'OUTLOOK') => void;
}) {
  // Generate default campaign name following search naming convention: YYYYMMDD-ClientCode-Description
  const generateDefaultCampaignName = () => {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const code = clientCode || 'XXX'; // Always 3 digits
    return `${dateStr}-${code}-Outreach Campaign`;
  };

  // Derive campaign name from initialProspects if available
  const getInitialCampaignName = () => {
    if (initialProspects && initialProspects.length > 0 && initialProspects[0].campaignName) {
      return initialProspects[0].campaignName;
    }
    return generateDefaultCampaignName();
  };

  const [name, setName] = useState(getInitialCampaignName());
  // Default campaign type based on:
  // 1. initialCampaignType (from prospect approval modal)
  // 2. Connected accounts (if only email -> 'email', else 'connector')
  const getDefaultCampaignType = () => {
    // Priority 1: Use initialCampaignType if provided
    if (initialCampaignType) {
      // Map 'linkedin' to 'connector' (LinkedIn campaigns use connector type)
      return initialCampaignType === 'linkedin' ? 'connector' : initialCampaignType;
    }
    // Priority 2: Auto-detect from connected accounts
    if (!connectedAccounts.linkedin && connectedAccounts.email) {
      return 'email';
    }
    return 'connector';
  };
  const [campaignType, setCampaignType] = useState(getDefaultCampaignType());
  const [userSelectedCampaignType, setUserSelectedCampaignType] = useState(false); // Track manual selection
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null); // CRITICAL FIX: Track session_id from CSV uploads

  // Auto-populate CSV data when initialProspects are provided
  useEffect(() => {
    console.log('🔍 CampaignBuilder initialProspects check:', {
      hasProspects: !!initialProspects,
      length: initialProspects?.length,
      sample: initialProspects?.[0]
    });

    if (initialProspects && initialProspects.length > 0) {
      console.log('✅ Loading initialProspects into csvData:', initialProspects);
      const headers = ['name', 'title', 'company', 'email', 'linkedin_url', 'connection_degree'];
      setCsvHeaders(headers);
      setCsvData(initialProspects);
      setDataSource('approved'); // Set to approved mode for validation
      setShowPreview(true);

      // CRITICAL FIX: Extract and store session_id from initialProspects
      const sessionId = initialProspects[0]?.sessionId || initialProspects[0]?.session_id;
      if (sessionId) {
        console.log('✅ Extracted session_id from initialProspects:', sessionId);
        setUploadedSessionId(sessionId);
      } else {
        console.warn('⚠️ No session_id found in initialProspects - prospects may not transfer to campaign');
      }

      // Stay on step 1 to let user select campaign type
      toastSuccess(`Loaded ${initialProspects.length} approved prospects - select campaign type`);
    } else {
      console.log('⚠️ No initialProspects provided to CampaignBuilder');
    }
  }, [initialProspects]);
  const [samMessages, setSamMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [samInput, setSamInput] = useState('');
  const [isGeneratingTemplates, setIsGeneratingTemplates] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Approved prospects state
  const [dataSource, setDataSource] = useState<'approved' | 'upload' | 'quick-add'>('approved');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]); // Selected session IDs
  const [selectedProspects, setSelectedProspects] = useState<any[]>([]);

  // Quick Add state
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [isAddingQuickProspect, setIsAddingQuickProspect] = useState(false);

  // React Query + localStorage for approved prospects (persistent across sessions)
  const {
    data: approvalSessionsData = { sessions: [], prospects: [] },
    isLoading: loadingApprovedProspects,
    refetch: refetchApprovedProspects
  } = useQuery({
    queryKey: ['approved-prospects', workspaceId],
    queryFn: async () => {
      if (!workspaceId) return { sessions: [], prospects: [] };

      // Load from prospect approval system (Data Approval flow)
      const sessionsResponse = await fetch('/api/prospect-approval/sessions/list');
      if (!sessionsResponse.ok) {
        return { sessions: [], prospects: [] };
      }

      const sessionsData = await sessionsResponse.json();
      if (!sessionsData.success || !sessionsData.sessions) {
        return { sessions: [], prospects: [] };
      }

      // Collect sessions with their approved prospects
      const sessionsWithProspects: any[] = [];
      const allApprovedProspects: any[] = [];

      for (const session of sessionsData.sessions) {
        const prospectsResponse = await fetch(`/api/prospect-approval/prospects?session_id=${session.id}`);
        if (prospectsResponse.ok) {
          const prospectsData = await prospectsResponse.json();
          if (prospectsData.success && prospectsData.prospects) {
            // Filter pending prospects (awaiting approval)
            const pendingProspects = prospectsData.prospects
              .filter((p: any) => p.approval_status === 'pending')
              .map((p: any) => {
                // Split name into first and last
                const nameParts = (p.name || '').trim().split(' ');
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';

                return {
                  id: p.prospect_id,
                  name: p.name,
                  first_name: firstName,
                  last_name: lastName,
                  title: p.title || '',
                  company: p.company?.name || p.company || '',
                  company_name: p.company?.name || p.company || '',
                  email: p.contact?.email || '',
                  linkedin_url: p.contact?.linkedin_url || '',
                  phone: p.contact?.phone || '',
                  industry: p.company?.industry || '',
                  location: p.location || '',
                  contact: p.contact, // PRESERVE contact object for fallback
                  sessionId: session.id,
                  campaignName: session.campaign_name || 'Untitled',
                  source: p.source || 'prospect_approval',
                  approval_status: p.approval_status // Preserve approval status
                };
              });

            if (pendingProspects.length > 0) {
              sessionsWithProspects.push({
                id: session.id,
                name: session.campaign_name || 'Untitled Session',
                createdAt: session.created_at,
                prospectsCount: pendingProspects.length,
                prospects: pendingProspects
              });
              allApprovedProspects.push(...pendingProspects);
            }
          }
        }
      }

      const result = {
        sessions: sessionsWithProspects,
        prospects: allApprovedProspects
      };

      // Save to localStorage for next session
      try {
        localStorage.setItem(`approved-prospects-${workspaceId}`, JSON.stringify({
          data: result,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to cache approved prospects:', e);
      }

      console.log(`✅ Loaded ${sessionsWithProspects.length} approval sessions with ${allApprovedProspects.length} approved prospects`);
      return result;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes (prospects change more frequently)
    cacheTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!workspaceId && dataSource === 'approved', // Only fetch when needed
    initialData: () => {
      // Try to load from localStorage on mount
      try {
        const cached = localStorage.getItem(`approved-prospects-${workspaceId}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // Use cached data if less than 1 hour old
          if (Date.now() - timestamp < 60 * 60 * 1000) {
            return data;
          }
        }
      } catch (e) {
        console.warn('Failed to load cached prospects:', e);
      }
      return undefined;
    }
  });

  // Extract for backwards compatibility
  const approvalSessions = approvalSessionsData.sessions;
  const approvedProspects = approvalSessionsData.prospects;
  
  // Message templates
  const [connectionMessage, setConnectionMessage] = useState('');
  const [alternativeMessage, setAlternativeMessage] = useState('');
  // Initialize with 5 follow-up messages (Messages 2-6 in the sequence)
  const [followUpMessages, setFollowUpMessages] = useState<string[]>(['', '', '', '', '']);

  // Email subject lines
  const [initialSubject, setInitialSubject] = useState('');
  const [followUpSubjects, setFollowUpSubjects] = useState<string[]>(['', '', '', '', '']);
  const [useThreadedReplies, setUseThreadedReplies] = useState(false); // If true, follow-ups use "RE: {initialSubject}"

  const [activeField, setActiveField] = useState<{type: 'connection' | 'alternative' | 'followup', index?: number}>({type: 'connection'});
  const [activeTextarea, setActiveTextarea] = useState<HTMLTextAreaElement | null>(null);

  // Draft/Auto-save state
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Paste Template state
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isImprovingCopy, setIsImprovingCopy] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{
    connectionMessage: string;
    alternativeMessage: string;
    followUpMessages: string[];
  } | null>(null);

  // KB Template state
  const [showKBModal, setShowKBModal] = useState(false);
  const [selectedKBTemplate, setSelectedKBTemplate] = useState<any>(null);

  // Campaign Settings state (timing/cadence)
  const [campaignSettings, setCampaignSettings] = useState<any>({
    connection_request_delay: '1-3 hours',
    follow_up_delay: '2-3 days',
    // Per-message delays: array matching followUpMessages length
    message_delays: ['2-3 days', '3-5 days', '5-7 days', '1 week', '2 weeks']
  });

  // React Query + localStorage for KB templates (persistent across sessions)
  const {
    data: kbTemplates = [],
    isLoading: loadingKBTemplates,
    refetch: refetchKBTemplates
  } = useQuery({
    queryKey: ['kb-templates', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID required');

      // Get sections first to find messaging section ID
      const sectionsResponse = await fetch(`/api/knowledge-base/sections?workspace_id=${workspaceId}`);
      if (!sectionsResponse.ok) {
        const errorData = await sectionsResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load KB sections');
      }

      const sectionsData = await sectionsResponse.json();

      if (!sectionsData.sections || sectionsData.sections.length === 0) {
        return [];
      }

      const messagingSection = sectionsData.sections.find((s: any) => s.section_id === 'messaging');
      if (!messagingSection) {
        return [];
      }

      // Load templates from messaging section
      const templatesResponse = await fetch(
        `/api/knowledge-base/content?workspace_id=${workspaceId}&section_id=${messagingSection.id}`
      );

      if (!templatesResponse.ok) {
        const errorData = await templatesResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to load templates');
      }

      const templatesData = await templatesResponse.json();
      const templates = templatesData.content || [];

      // Save to localStorage for next session
      try {
        localStorage.setItem(`kb-templates-${workspaceId}`, JSON.stringify({
          data: templates,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to cache templates to localStorage:', e);
      }

      return templates;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!workspaceId && showKBModal, // Only fetch when modal opens
    initialData: () => {
      // Try to load from localStorage on mount
      try {
        const cached = localStorage.getItem(`kb-templates-${workspaceId}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // Use cached data if less than 24 hours old
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            return data;
          }
        }
      } catch (e) {
        console.warn('Failed to load cached templates:', e);
      }
      return undefined;
    },
    onError: (error: any) => {
      console.error('Failed to load KB templates:', error);
      toastError(error.message || 'Failed to load templates from Knowledge Base');
    }
  });

  // Show feedback when KB templates load
  useEffect(() => {
    if (!showKBModal || loadingKBTemplates) return;

    if (kbTemplates.length === 0) {
      toastInfo('No templates found in Knowledge Base messaging section. Add templates to use them in campaigns.');
    } else {
      toastSuccess(`Loaded ${kbTemplates.length} template(s) from Knowledge Base`);
    }
  }, [kbTemplates.length, loadingKBTemplates, showKBModal]);

  // Previous Messages state
  const [showPreviousMessagesModal, setShowPreviousMessagesModal] = useState(false);
  const [selectedPreviousCampaign, setSelectedPreviousCampaign] = useState<any>(null);

  // Template Library state
  const [showTemplateLibraryModal, setShowTemplateLibraryModal] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Manual Template Creation Modal
  const [showManualTemplateModal, setShowManualTemplateModal] = useState(false);
  const [manualConnection, setManualConnection] = useState('');
  const [manualAlternative, setManualAlternative] = useState('');
  const [manualFollowUps, setManualFollowUps] = useState(['']);

  // SAM Generation Modal
  const [showSamGenerationModal, setShowSamGenerationModal] = useState(false);

  // React Query + localStorage for previous campaigns (persistent across sessions)
  const {
    data: previousCampaigns = [],
    isLoading: loadingPreviousCampaigns,
    refetch: refetchPreviousCampaigns
  } = useQuery({
    queryKey: ['previous-campaigns', workspaceId],
    queryFn: async () => {
      if (!workspaceId) throw new Error('Workspace ID required');

      const response = await fetch(`/api/campaigns?workspace_id=${workspaceId}`);
      if (!response.ok) {
        throw new Error('Failed to load previous campaigns');
      }

      const data = await response.json();
      const campaigns = data.campaigns || [];

      console.log('📋 Previous campaigns debug:', {
        totalCampaigns: campaigns.length,
        sampleCampaign: campaigns[0],
        campaignNames: campaigns.map((c: any) => c.name)
      });

      // Filter campaigns that have messages
      const campaignsWithMessages = campaigns.filter((c: any) => {
        const hasMessages = c.connection_message || c.alternative_message || (c.follow_up_messages && c.follow_up_messages.length > 0);
        if (!hasMessages && campaigns.length > 0) {
          console.log(`⚠️ Campaign "${c.name}" has no messages:`, {
            connection_message: !!c.connection_message,
            alternative_message: !!c.alternative_message,
            follow_up_messages: c.follow_up_messages?.length || 0
          });
        }
        return hasMessages;
      });

      console.log(`✅ Found ${campaignsWithMessages.length} campaigns with messages out of ${campaigns.length} total`);

      // Save to localStorage for next session
      try {
        localStorage.setItem(`previous-campaigns-${workspaceId}`, JSON.stringify({
          data: campaignsWithMessages,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Failed to cache previous campaigns:', e);
      }

      return campaignsWithMessages;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    enabled: !!workspaceId && showPreviousMessagesModal,
    initialData: () => {
      try {
        const cached = localStorage.getItem(`previous-campaigns-${workspaceId}`);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          // Cache valid for 24 hours
          if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
            return data;
          }
        }
      } catch (e) {
        console.warn('Failed to load cached previous campaigns:', e);
      }
      return undefined;
    },
    onSuccess: (data) => {
      if (data.length === 0) {
        toastInfo('No previous campaigns with messages found');
      } else {
        toastSuccess(`Loaded ${data.length} previous campaign(s)`);
      }
    },
    onError: (error: any) => {
      console.error('Failed to load previous campaigns:', error);
      toastError(error.message || 'Failed to load previous campaigns');
    }
  });

  // Auto-save draft to localStorage (persistent across sessions)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!workspaceId || !name.trim()) return;

      const draft = {
        name,
        campaignType,
        connectionMessage,
        alternativeMessage,
        followUpMessages,
        savedAt: new Date().toISOString()
      };

      try {
        localStorage.setItem(`campaign-draft-${workspaceId}`, JSON.stringify(draft));
        console.log('Draft auto-saved to localStorage');
      } catch (e) {
        console.warn('Failed to save draft:', e);
      }
    }, 2000); // Debounce 2 seconds

    return () => clearTimeout(timer);
  }, [name, campaignType, connectionMessage, alternativeMessage, followUpMessages, workspaceId]);

  // DISABLED: Auto-load draft from localStorage on mount
  // User feedback: Don't auto-restore drafts, only load when explicitly clicked
  // Drafts are managed through the database drafts list now
  useEffect(() => {
    // Intentionally disabled - drafts are loaded explicitly from the drafts list
    // Clean up old localStorage drafts if they exist
    if (workspaceId) {
      try {
        const saved = localStorage.getItem(`campaign-draft-${workspaceId}`);
        if (saved) {
          const draft = JSON.parse(saved);
          const savedDate = new Date(draft.savedAt);
          const daysSaved = (Date.now() - savedDate.getTime()) / (1000 * 60 * 60 * 24);

          // Clean up drafts older than 7 days (silent, no toast)
          if (daysSaved >= 7) {
            localStorage.removeItem(`campaign-draft-${workspaceId}`);
          }
        }
      } catch (e) {
        console.warn('Failed to clean up draft:', e);
      }
    }
  }, [workspaceId]);

  // SAM Chat scroll management
  const samChatRef = useState<HTMLDivElement | null>(null)[0];
  const chatContainerRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check connection degrees of prospects
  const getConnectionDegrees = () => {
    const prospects = csvData.length > 0 ? csvData : (initialProspects || []);
    const degrees = prospects.map((p: any, index: number) => {
      // Check multiple possible field names (case-insensitive)
      // IMPORTANT: Check contact.connectionDegree for SAM prospects
      const degree = p.connection_degree || p.degree || p.connectionDegree ||
                     p.contact?.connectionDegree || p.contact?.connection_degree ||
                     p.Connection || p['Connection Degree'] || p.linkedin_connection_degree;

      // DETAILED DEBUG LOGGING for first 3 prospects
      if (index < 3) {
        console.log(`🔍 Prospect ${index} connection degree debug:`, {
          name: p.name,
          raw_prospect: p,
          connection_degree: p.connection_degree,
          degree: p.degree,
          connectionDegree: p.connectionDegree,
          contact_object: p.contact,
          'contact.connectionDegree': p.contact?.connectionDegree,
          'contact.connection_degree': p.contact?.connection_degree,
          'p.Connection': p.Connection,
          'p["Connection Degree"]': p['Connection Degree'],
          linkedin_connection_degree: p.linkedin_connection_degree,
          detected_value: degree
        });
      }

      // Normalize to string for comparison
      const degreeStr = String(degree || '').toLowerCase().trim();

      // Check for 1st degree
      if (degreeStr === '1' || degreeStr === '1st' || degreeStr === 'first' ||
          degreeStr === '1st degree' || degreeStr.includes('1st')) return '1st';

      // Check for 2nd degree
      if (degreeStr === '2' || degreeStr === '2nd' || degreeStr === 'second' ||
          degreeStr === '2nd degree' || degreeStr.includes('2nd')) return '2nd';

      // Check for 3rd degree
      if (degreeStr === '3' || degreeStr === '3rd' || degreeStr === 'third' ||
          degreeStr === '3rd degree' || degreeStr === '3+' || degreeStr.includes('3rd') ||
          degreeStr.includes('3+')) return '3rd';

      return 'unknown';
    });

    const firstDegree = degrees.filter(d => d === '1st').length;
    const secondThird = degrees.filter(d => d === '2nd' || d === '3rd').length;
    const unknown = degrees.filter(d => d === 'unknown').length;

    // Debug logging
    if (prospects.length > 0) {
      console.log('🔍 Connection Degrees Analysis:', {
        total: prospects.length,
        firstDegree,
        secondThird,
        unknown,
        sampleProspect: prospects[0],
        sampleDegrees: degrees.slice(0, 3)
      });
    }

    return { firstDegree, secondThird, unknown, total: prospects.length };
  };

  const connectionDegrees = getConnectionDegrees();
  const has1stDegree = connectionDegrees.firstDegree > 0;
  const hasOnly1stDegree = connectionDegrees.firstDegree > 0 && connectionDegrees.secondThird === 0;

  // Check if CSV has connection degree data (required for LinkedIn campaigns)
  // FIXED: For SAM search results (non-CSV), check if prospects have LinkedIn URLs
  const prospects = csvData.length > 0 ? csvData : (initialProspects || []);
  const hasLinkedInUrls = prospects.some((p: any) =>
    p.linkedin_url || p.linkedinUrl || p.contact?.linkedin_url || p.contact?.linkedinUrl
  );
  // For CSV uploads: require explicit connection degree field
  // For SAM/initialProspects: connection degree is always included in scraped data
  const hasConnectionDegreeData = (initialProspects && initialProspects.length > 0)
    ? true // SAM scraped data always has connectionDegree field
    : (csvData.length > 0)
      ? (connectionDegrees.total > 0 && (connectionDegrees.firstDegree > 0 || connectionDegrees.secondThird > 0))
      : false; // No prospects loaded yet

  // Auto-select campaign type based on prospect connection degrees
  useEffect(() => {
    // Only auto-select if user hasn't manually chosen a campaign type
    if (userSelectedCampaignType) return;

    if (connectionDegrees.total === 0) return; // No prospects loaded yet

    // Calculate percentages
    const firstDegreePercent = (connectionDegrees.firstDegree / connectionDegrees.total) * 100;
    const secondThirdPercent = (connectionDegrees.secondThird / connectionDegrees.total) * 100;

    // Auto-select campaign type based on majority (only for LinkedIn campaigns)
    if (hasOnly1stDegree) {
      // All prospects are 1st degree → Messenger
      setCampaignType('messenger');
      console.log('🎯 Auto-selected MESSENGER (all 1st degree connections)');
    } else if (connectionDegrees.secondThird > 0 && connectionDegrees.firstDegree === 0) {
      // All prospects are 2nd/3rd degree → Connector
      setCampaignType('connector');
      console.log('🎯 Auto-selected CONNECTOR (all 2nd/3rd degree connections)');
    } else if (firstDegreePercent >= 70) {
      // Mostly 1st degree (70%+) → Messenger
      setCampaignType('messenger');
      console.log(`🎯 Auto-selected MESSENGER (${firstDegreePercent.toFixed(0)}% are 1st degree)`);
    } else if (secondThirdPercent >= 70) {
      // Mostly 2nd/3rd degree (70%+) → Connector
      setCampaignType('connector');
      console.log(`🎯 Auto-selected CONNECTOR (${secondThirdPercent.toFixed(0)}% are 2nd/3rd degree)`);
    }
    // If mixed (no clear majority), keep current selection (default: connector)
  }, [connectionDegrees.total, connectionDegrees.firstDegree, connectionDegrees.secondThird, hasOnly1stDegree, userSelectedCampaignType]);

  // Auto-select email campaign type when only email account is connected
  useEffect(() => {
    if (userSelectedCampaignType) return; // Don't override manual selection

    // If user has only email connected (no LinkedIn), default to email campaign
    if (!connectedAccounts.linkedin && connectedAccounts.email) {
      if (campaignType !== 'email') {
        setCampaignType('email');
        console.log('🎯 Auto-selected EMAIL (only email account connected)');
      }
    }
  }, [connectedAccounts.linkedin, connectedAccounts.email, userSelectedCampaignType, campaignType]);

  // Campaign types are greyed out based on connection degrees, but user maintains control
  // Auto-selection happens when prospects are loaded, but user can override manually

  const campaignTypes = [
    {
      value: 'connector',
      label: 'Connector',
      description: 'Reach out to 2nd and 3rd+ degree connections with personalized connection requests and follow-ups',
      icon: Users
    },
    {
      value: 'messenger',
      label: 'Messenger',
      description: 'Send direct messages to 1st degree connections',
      icon: MessageSquare
    },
    {
      value: 'email',
      label: 'Email',
      description: 'Send direct emails to prospects without LinkedIn connection requests',
      icon: Mail
    },
    {
      value: 'multichannel',
      label: 'Multi-Channel',
      description: 'Multi-Channel Outreach Campaigns - Combine LinkedIn and email outreach in one campaign',
      icon: Settings
    }
  ];

  const placeholders = [
    { key: '{first_name}', description: 'Contact\'s first name' },
    { key: '{last_name}', description: 'Contact\'s last name' },
    { key: '{job_title}', description: 'Current job title' },
    { key: '{company_name}', description: 'Current company name' },
    { key: '{industry}', description: 'Industry information' },
    { key: '{location}', description: 'Geographic location' }
  ];

  // Auto-save draft with debounce
  const saveDraft = async (force = false) => {
    if (!name.trim() || !workspaceId) return;

    setIsSavingDraft(true);
    try {
      const response = await fetch('/api/campaigns/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: currentDraftId,
          workspaceId,
          name,
          campaignType,
          currentStep,
          connectionMessage,
          alternativeMessage,
          followUpMessages,
          csvData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (!currentDraftId) {
          setCurrentDraftId(result.draftId);
        }
        setLastSavedAt(new Date());
        if (force) {
          toastSuccess('Draft saved');
        }
      }
    } catch (error) {
      console.error('Error saving draft:', error);
      if (force) {
        toastError('Failed to save draft');
      }
    } finally {
      setIsSavingDraft(false);
    }
  };

  // DISABLED: Auto-load draft on mount (removed - was annoying)
  // Drafts are now only loaded when explicitly selected from the drafts list

  // Load draft when draftToLoad prop is provided
  useEffect(() => {
    if (!draftToLoad) return;

    console.log('Loading draft from prop:', draftToLoad);
    setCurrentDraftId(draftToLoad.id);
    setName(draftToLoad.name);
    setCampaignType(draftToLoad.type);
    setCurrentStep(draftToLoad.current_step || 1);
    setConnectionMessage(draftToLoad.connection_message || '');
    setAlternativeMessage(draftToLoad.alternative_message || '');
    setFollowUpMessages(draftToLoad.follow_up_messages || ['']);

    if (draftToLoad.draft_data?.csvData) {
      setCsvData(draftToLoad.draft_data.csvData);
      setShowPreview(true);
    }

    toastInfo(`Loaded draft: ${draftToLoad.name}`);
  }, [draftToLoad]);

  // Auto-save on changes (debounced)
  useEffect(() => {
    if (!name.trim()) return;

    const timeoutId = setTimeout(() => {
      saveDraft();
    }, 2000); // Save 2 seconds after last change

    return () => clearTimeout(timeoutId);
  }, [name, campaignType, currentStep, connectionMessage, alternativeMessage, followUpMessages, csvData]);

  // Auto-scroll SAM chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current && samMessages.length > 0) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [samMessages, isGeneratingTemplates]);

  // Show scroll button when not at bottom
  const handleChatScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShowScrollButton(!isAtBottom && scrollHeight > clientHeight);
    }
  };

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Note: Approved prospects loading is now handled by React Query (lines 594-696)
  // The useQuery hook automatically refetches when dataSource === 'approved'

  const addFollowUpMessage = () => {
    setFollowUpMessages([...followUpMessages, '']);
    // Also add empty subject for the new follow-up
    setFollowUpSubjects([...followUpSubjects, '']);
    // Add default delay for new message
    const newDelays = [...(campaignSettings.message_delays || []), '2-3 days'];
    setCampaignSettings({...campaignSettings, message_delays: newDelays});
  };

  const updateFollowUpMessage = (index: number, value: string) => {
    const updated = [...followUpMessages];
    updated[index] = value;
    setFollowUpMessages(updated);
  };

  const updateFollowUpSubject = (index: number, value: string) => {
    const updated = [...followUpSubjects];
    updated[index] = value;
    setFollowUpSubjects(updated);
  };

  const removeFollowUpMessage = (index: number) => {
    if (followUpMessages.length > 1) {
      setFollowUpMessages(followUpMessages.filter((_, i) => i !== index));
      // Also remove the corresponding subject and delay
      setFollowUpSubjects(followUpSubjects.filter((_, i) => i !== index));
      const newDelays = (campaignSettings.message_delays || []).filter((_: any, i: number) => i !== index);
      setCampaignSettings({...campaignSettings, message_delays: newDelays});
    }
  };

  const updateMessageDelay = (index: number, delay: string) => {
    const newDelays = [...(campaignSettings.message_delays || [])];
    newDelays[index] = delay;
    setCampaignSettings({...campaignSettings, message_delays: newDelays});
  };

  const insertPlaceholder = (placeholder: string, messageType?: 'connection' | 'alternative' | 'followup', index?: number) => {
    // If no messageType specified, use the currently focused textarea
    if (!messageType && activeTextarea) {
      const start = activeTextarea.selectionStart;
      const end = activeTextarea.selectionEnd;
      
      // Determine which field this textarea belongs to and update accordingly
      if (activeTextarea.placeholder.includes('Hi {first_name}')) {
        const currentValue = connectionMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setConnectionMessage(newValue);
      } else if (activeTextarea.placeholder.includes('Would love to connect')) {
        const currentValue = alternativeMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setAlternativeMessage(newValue);
      } else if (activeTextarea.dataset.followupIndex !== undefined) {
        const followupIndex = parseInt(activeTextarea.dataset.followupIndex);
        const currentValue = followUpMessages[followupIndex];
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        updateFollowUpMessage(followupIndex, newValue);
      }
      
      // Restore cursor position after the inserted placeholder
      setTimeout(() => {
        activeTextarea.focus();
        activeTextarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
      return;
    }

    // Fallback to original logic if messageType is explicitly provided
    if (messageType === 'connection') {
      const textarea = document.querySelector('textarea[placeholder*="Hi {first_name}"]') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = connectionMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setConnectionMessage(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        setConnectionMessage(prev => prev + placeholder);
      }
    } else if (messageType === 'alternative') {
      const textarea = document.querySelector('textarea[placeholder*="Would love to connect"]') as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = alternativeMessage;
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        setAlternativeMessage(newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        setAlternativeMessage(prev => prev + placeholder);
      }
    } else if (messageType === 'followup' && index !== undefined) {
      const textarea = document.querySelector(`textarea[data-followup-index="${index}"]`) as HTMLTextAreaElement;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const currentValue = followUpMessages[index];
        const newValue = currentValue.substring(0, start) + placeholder + currentValue.substring(end);
        updateFollowUpMessage(index, newValue);
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
        }, 0);
      } else {
        updateFollowUpMessage(index, followUpMessages[index] + placeholder);
      }
    }
  };

  const startSamTemplateGeneration = () => {
    const campaignTypeLabel = campaignType === 'connector' ? '**connector campaign** (for 2nd/3rd degree LinkedIn connections)' : '**messenger campaign** (for 1st degree connections - already connected)';
    const messageType = campaignType === 'connector' ? 'connection request + follow-up messages' : 'direct messages (no connection request needed)';

    setShowSamGenerationModal(true);
    setSamMessages([{
      role: 'assistant',
      content: `Hi! I'm SAM, and I'll help you create compelling LinkedIn messaging templates for your ${campaignTypeLabel} "${name}".

**Campaign Type:** ${campaignType === 'connector' ? 'Connector - I will generate a connection request message and follow-ups' : 'Messenger - I will generate direct messages for your existing connections (no connection request)'}

I can see you have ${csvData.length} prospects loaded. To create the best ${messageType}, tell me:

1. What's your main goal with this campaign? (networking, lead generation, partnerships, etc.)
2. What value can you offer these prospects?
3. Any specific tone you'd like? (professional, casual, friendly, etc.)

Let's create messages that get responses! 🎯`
    }]);
  };

  const sendSamMessage = async () => {
    if (!samInput.trim()) return;

    const userMessage = samInput.trim();
    setSamInput('');
    setSamMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsGeneratingTemplates(true);

    try {
      // Call the actual SAM API for messaging generation
      const response = await fetch('/api/sam/generate-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          campaign_name: name,
          campaign_type: campaignType,
          prospect_count: csvData.length,
          user_input: userMessage,
          conversation_history: samMessages,
          prospect_sample: csvData.slice(0, 3) // Send first 3 prospects for context
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate messaging');
      }

      const result = await response.json();
      
      setSamMessages(prev => [...prev, {
        role: 'assistant',
        content: result.response || 'Generated templates based on your requirements!'
      }]);

      // Auto-apply templates if SAM provides them
      if (result.templates) {
        // Only set connection message for Connector campaigns
        if (result.templates.connection_message && campaignType === 'connector') {
          setConnectionMessage(result.templates.connection_message);
        }
        if (result.templates.alternative_message) {
          setAlternativeMessage(result.templates.alternative_message);
        }
        if (result.templates.follow_up_messages) {
          setFollowUpMessages(result.templates.follow_up_messages);
        }
      }

    } catch (error: any) {
      console.error('SAM API error:', error);
      
      // Fallback to local messaging generation
      setSamMessages(prev => [...prev, {
        role: 'assistant',
        content: `I'll help you create templates! Based on "${userMessage}", here are some suggestions:

**Connection Request:**
"Hi {first_name}, I noticed your work at {company_name}. I'd love to connect and share some insights that might be valuable for your work."

**Follow-up:**
"Thanks for connecting, {first_name}! I'm curious about the biggest challenges you're facing at {company_name} right now."

Would you like me to adjust these or create more variations?`
      }]);
    }

    setIsGeneratingTemplates(false);
  };

  const applySamTemplates = () => {
    // Extract templates from SAM's messages and apply them
    // Look through all assistant messages for template content
    const assistantMessages = samMessages.filter(m => m.role === 'assistant');

    if (assistantMessages.length === 0) {
      toastWarning('No templates generated yet. Chat with SAM first!');
      return;
    }

    // Try to extract templates from the last assistant message
    const lastMessage = assistantMessages[assistantMessages.length - 1].content;

    // Extract connection request (only for Connector campaigns)
    const connectionMatch = lastMessage.match(/\*\*Connection Request:\*\*\s*\n?"([^"]+)"|Connection Request:\s*\n?"([^"]+)"|Connection Message:\s*\n?"([^"]+)"/i);
    if (connectionMatch && campaignType === 'connector') {
      const extracted = connectionMatch[1] || connectionMatch[2] || connectionMatch[3];
      setConnectionMessage(extracted.trim());
    }

    // Extract alternative message
    const altMatch = lastMessage.match(/\*\*Alternative Message:\*\*\s*\n?"([^"]+)"|Alternative Message:\s*\n?"([^"]+)"/i);
    if (altMatch) {
      const extracted = altMatch[1] || altMatch[2];
      setAlternativeMessage(extracted.trim());
    }

    // Extract follow-ups (look for "**Follow-up:**" or "Follow-up Message")
    const followUpMatches = [...lastMessage.matchAll(/\*\*Follow-up(?:\s+\d+)?:\*\*\s*\n?"([^"]+)"|Follow-up(?:\s+Message)?(?:\s+\d+)?:\s*\n?"([^"]+)"/gi)];
    if (followUpMatches.length > 0) {
      const followUps = followUpMatches.map(match => (match[1] || match[2]).trim());
      setFollowUpMessages(followUps);
    }

    // If no structured templates found, try to extract any quoted text
    if (!connectionMatch && !altMatch && followUpMatches.length === 0) {
      const quotes = [...lastMessage.matchAll(/"([^"]{20,})"/g)];
      if (quotes.length > 0) {
        // First quote is connection message (Connector) or initial message (Messenger)
        if (campaignType === 'connector') {
          setConnectionMessage(quotes[0][1].trim());
          if (quotes.length > 1) {
            setFollowUpMessages(quotes.slice(1).map(q => q[1].trim()));
          }
        } else {
          // For Messenger campaigns, first quote is the initial message (alternativeMessage)
          setAlternativeMessage(quotes[0][1].trim());
          if (quotes.length > 1) {
            setFollowUpMessages(quotes.slice(1).map(q => q[1].trim()));
          }
        }
      } else {
        toastWarning('Could not find templates in SAM\'s response. Try asking SAM to generate specific messages.');
        return;
      }
    }

    toastSuccess('Templates extracted and applied!');
  };

  // Paste Template functions
  const parsePastedTemplate = async () => {
    if (!pastedText.trim()) {
      toastWarning('Please paste some template text first');
      return;
    }

    setIsParsing(true);
    try {
      const response = await fetch('/api/campaigns/parse-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pastedText,
          campaignType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Parse template API error:', result);
        const errorMessage = result.error || 'Failed to parse template';
        toastError(`Error: ${errorMessage}`);
        return;
      }

      if (result.success) {
        setParsedPreview(result.parsed);

        // Show warning if fallback was used
        if (result.warning) {
          console.warn('⚠️ Parse warning:', result.warning);
          toastWarning(`Using original text (AI parsing had issues)`);
        } else {
          toastSuccess('Template parsed successfully!');
        }
      } else {
        const errorMessage = result.error || 'Failed to parse template';
        console.error('Parse template failed:', result);
        toastError(`Error: ${errorMessage}`);
      }
    } catch (error) {
      console.error('Parse error:', error);
      toastError('Failed to parse template. Please check console for details.');
    } finally {
      setIsParsing(false);
    }
  };

  const applyParsedTemplate = () => {
    if (!parsedPreview) return;

    // Only set connection message for Connector campaigns
    if (parsedPreview.connectionMessage && campaignType === 'connector') {
      setConnectionMessage(parsedPreview.connectionMessage);
    }
    if (parsedPreview.alternativeMessage) {
      setAlternativeMessage(parsedPreview.alternativeMessage);
    }
    if (parsedPreview.followUpMessages && parsedPreview.followUpMessages.length > 0) {
      setFollowUpMessages(parsedPreview.followUpMessages);
    }

    // Close modal and reset
    setShowPasteModal(false);
    setPastedText('');
    setParsedPreview(null);
    toastSuccess('Templates applied to campaign!');
  };

  const improveParsedCopy = async () => {
    if (!parsedPreview || !workspaceId) return;

    setIsImprovingCopy(true);
    try {
      const response = await fetch('/api/campaigns/parse-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: `CONNECTION MESSAGE:\n${parsedPreview.connectionMessage}\n\n${
            parsedPreview.alternativeMessage ? `ALTERNATIVE MESSAGE:\n${parsedPreview.alternativeMessage}\n\n` : ''
          }${
            parsedPreview.followUpMessages && parsedPreview.followUpMessages.length > 0
              ? parsedPreview.followUpMessages.map((msg, idx) => `FOLLOW-UP ${idx + 1}:\n${msg}`).join('\n\n')
              : ''
          }`,
          workspaceId,
          enhancePrompt: 'Improve this messaging to be more engaging, persuasive, and professional while maintaining the tone and structure. Keep all placeholders intact.'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        toastError(result.error || 'Failed to improve copy');
        return;
      }

      // Update preview with improved copy
      setParsedPreview({
        connectionMessage: result.connectionMessage || parsedPreview.connectionMessage,
        alternativeMessage: result.alternativeMessage || parsedPreview.alternativeMessage,
        followUpMessages: result.followUpMessages || parsedPreview.followUpMessages
      });

      toastSuccess('Copy improved by SAM AI!');
    } catch (error) {
      console.error('Improve copy error:', error);
      toastError('Failed to improve copy');
    } finally {
      setIsImprovingCopy(false);
    }
  };

  // KB Template functions
  const openKBModal = () => {
    setShowKBModal(true);
    // React Query will auto-fetch when modal opens (enabled: showKBModal)
  };

  const applyKBTemplate = async (template: any) => {
    if (!template || !template.content || !template.content.trim()) {
      toastError('Template has no content');
      return;
    }

    // Parse the KB template content using the same AI parser
    setIsParsing(true);
    try {
      const response = await fetch('/api/campaigns/parse-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pastedText: template.content,
          campaignType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('Parse KB template error:', result);
        const errorMessage = result.error || 'Failed to parse template';
        toastError(`Error: ${errorMessage}`);
        return;
      }

      if (result.success && result.parsed) {
        // Apply parsed template
        // Only set connection message for Connector campaigns
        if (result.parsed.connectionMessage && campaignType === 'connector') {
          setConnectionMessage(result.parsed.connectionMessage);
        }
        if (result.parsed.alternativeMessage) {
          setAlternativeMessage(result.parsed.alternativeMessage);
        }
        if (result.parsed.followUpMessages && result.parsed.followUpMessages.length > 0) {
          setFollowUpMessages(result.parsed.followUpMessages);
        }

        // Close modal and reset
        setShowKBModal(false);
        setSelectedKBTemplate(null);
        toastSuccess(`Template "${template.title || 'Untitled'}" applied to campaign!`);
      } else {
        toastError('Failed to parse KB template');
      }
    } catch (error) {
      console.error('Apply KB template error:', error);
      toastError('Failed to apply template from Knowledge Base');
    } finally {
      setIsParsing(false);
    }
  };

  // Previous Messages functions
  const openPreviousMessagesModal = () => {
    setShowPreviousMessagesModal(true);
    // React Query will automatically fetch when modal opens (enabled: showPreviousMessagesModal)
  };

  const applyPreviousCampaignMessages = (campaign: any) => {
    if (!campaign) return;

    // Only set connection message for Connector campaigns
    if (campaign.connection_message && campaignType === 'connector') {
      setConnectionMessage(campaign.connection_message);
    }
    if (campaign.alternative_message) {
      setAlternativeMessage(campaign.alternative_message);
    }
    if (campaign.follow_up_messages && campaign.follow_up_messages.length > 0) {
      setFollowUpMessages(campaign.follow_up_messages);
    }

    setShowPreviousMessagesModal(false);
    setSelectedPreviousCampaign(null);
    toastSuccess(`Messages from "${campaign.name || 'Untitled'}" applied to campaign!`);
  };

  // Template Library functions
  useEffect(() => {
    const loadTemplates = async () => {
      if (!showTemplateLibraryModal || !workspaceId) return;

      try {
        const response = await fetch(`/api/messaging-templates?workspace_id=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setSavedTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        toastError('Failed to load saved templates');
      }
    };

    loadTemplates();
  }, [showTemplateLibraryModal, workspaceId]);

  const applyTemplate = (template: any) => {
    if (!template) return;

    // Only set connection message for Connector campaigns
    if (template.connection_message && campaignType === 'connector') {
      setConnectionMessage(template.connection_message);
    }
    if (template.alternative_message) {
      setAlternativeMessage(template.alternative_message);
    }
    if (template.follow_up_messages && template.follow_up_messages.length > 0) {
      setFollowUpMessages(template.follow_up_messages);
    }

    setShowTemplateLibraryModal(false);
    setSelectedTemplate(null);
    toastSuccess(`Template "${template.template_name || 'Untitled'}" loaded successfully!`);
  };

  const handleQuickAddProspect = async () => {
    if (!quickAddUrl || !quickAddUrl.trim()) {
      toastError('Please enter a LinkedIn URL');
      return;
    }

    // Basic URL validation - accept both www and non-www variants
    const lowerUrl = quickAddUrl.toLowerCase();
    if (!lowerUrl.includes('linkedin.com') || !lowerUrl.includes('/in/')) {
      toastError('Invalid LinkedIn URL. Expected format: https://linkedin.com/in/username or https://www.linkedin.com/in/username');
      return;
    }

    setIsAddingQuickProspect(true);

    try {
      // Create abort controller with 10 second timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('/api/prospects/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: quickAddUrl.trim(),
          workspace_id: workspaceId
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to add prospect');
      }

      const data = await response.json();

      if (data.success && data.prospect) {
        // Add prospect to csvData
        const newProspect = {
          name: data.prospect.name,
          linkedin_url: data.prospect.linkedin_url,
          linkedin_user_id: data.prospect.linkedin_user_id || null,
          connection_degree: data.prospect.connection_degree,
          source: 'quick_add'
        };

        setCsvData([...csvData, newProspect]);
        setShowPreview(true);

        // Clear input
        setQuickAddUrl('');

        // Show success message with campaign type suggestion
        toastSuccess(data.message);

        // Auto-suggest campaign type based on connection degree
        if (data.campaign_type_suggestion === 'messenger' && campaignType !== 'messenger') {
          toastSuccess('💡 Tip: This is a 1st degree connection - consider using Messenger campaign type');
        } else if (data.campaign_type_suggestion === 'connector' && campaignType !== 'connector') {
          toastSuccess('💡 Tip: This is a 2nd/3rd degree connection - Connector campaign will send a connection request first');
        }
      } else {
        toastError(data.message || 'Failed to add prospect');
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          toastError('Request timed out. Please try again.');
        } else {
          toastError(error.message);
        }
      } else {
        toastError('Failed to add prospect');
      }
    } finally {
      setIsAddingQuickProspect(false);
    }
  };

  const processFile = (file: File) => {
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setIsUploading(true);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        const csv = e.target?.result as string;
        const lines = csv.split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          const data = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            const row: any = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            return row;
          }).filter(row => Object.values(row).some(val => val));
          
          // Validate connection degree field for LinkedIn campaigns
          const connectionDegreeFields = [
            'connection_degree', 'degree', 'connectiondegree', 'connection',
            'connection degree', 'linkedin_connection_degree', 'linkedin connection degree'
          ];

          const hasConnectionDegree = headers.some(h =>
            connectionDegreeFields.includes(h.toLowerCase().trim())
          );

          if (!hasConnectionDegree) {
            console.warn('⚠️ CSV missing connection degree field - LinkedIn campaigns will be disabled');
            toastInfo('CSV missing connection degree column. To enable LinkedIn campaigns, add a column named "Connection Degree" or "Connection" with values like "1st", "2nd", or "3rd" for each prospect, then re-upload. Currently only Email campaigns are available.');
          }

          setCsvHeaders(headers);
          setCsvData(data);
          setShowPreview(true);
        }
        setIsUploading(false);
      };
      reader.readAsText(file);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv'));
    
    if (csvFile) {
      processFile(csvFile);
    } else {
      toastError('Please drop a CSV file');
    }
  };
  
  const submit = async () => {
    // Validate prospect data based on source - check all possible prospect sources
    const hasProspectData = csvData.length > 0 || selectedProspects.length > 0 || (initialProspects?.length || 0) > 0;
    if (!hasProspectData) {
      alert('Please add prospects before creating campaign');
      return;
    }
    if (campaignType === 'connector' && !connectionMessage.trim()) {
      toastError('Please add a connection request message');
      return;
    }
    if (campaignType === 'messenger' && !followUpMessages.some(msg => msg.trim())) {
      toastError('Please add at least one message');
      return;
    }

    // Prepare campaign data for approval screen
    // Priority: initialProspects (from Data Approval) > csvData (upload) > selectedProspects
    let prospects;
    if (initialProspects && initialProspects.length > 0) {
      // Use initialProspects from Data Approval
      prospects = initialProspects.map(prospect => ({
        firstName: prospect.first_name || prospect.name?.split(' ')[0] || '',
        lastName: prospect.last_name || prospect.name?.split(' ').slice(1).join(' ') || '',
        email: prospect.email || prospect.contact?.email,
        company: prospect.company?.name || prospect.company_name || prospect.company || '',
        title: prospect.title,
        industry: prospect.industry || prospect.company?.industry?.[0] || 'Not specified',
        linkedin_url: prospect.linkedin_url || prospect.linkedinUrl || prospect.contact?.linkedin_url,
        linkedin_user_id: prospect.linkedin_user_id
      }));
    } else if (dataSource === 'upload' && csvData.length > 0) {
      // Use uploaded CSV data
      prospects = csvData;
    } else {
      // Use manually selected prospects
      prospects = selectedProspects.map(prospect => ({
        firstName: prospect.name?.split(' ')[0] || '',
        lastName: prospect.name?.split(' ').slice(1).join(' ') || '',
        email: prospect.email,
        company: prospect.company,
        title: prospect.title,
        industry: prospect.industry || 'Not specified',
        linkedin_url: prospect.linkedin_url || prospect.linkedinUrl,
        linkedin_user_id: prospect.linkedin_user_id
      }));
    }

    const campaignData = {
      name: name,
      type: campaignType === 'connector' ? 'LinkedIn' : campaignType,
      campaignType: campaignType, // Add specific campaign type (connector/messenger/builder)
      prospects: prospects,
      messages: {
        connection_request: connectionMessage,
        follow_up_1: followUpMessages[0] || '',
        follow_up_2: followUpMessages[1] || '',
        follow_up_3: followUpMessages[2] || '',
        follow_up_4: followUpMessages[3] || '',
        follow_up_5: followUpMessages[4] || ''
      },
      // Include message timing/cadence settings
      message_delays: campaignSettings.message_delays || ['2-3 days', '3-5 days', '5-7 days', '1 week', '2 weeks'],
      // Store additional data needed for execution
      _executionData: {
        campaignType,
        alternativeMessage,
        followUpMessages,
        message_delays: campaignSettings.message_delays
      }
    };

    // Pass to approval screen
    if (onPrepareForApproval) {
      onPrepareForApproval(campaignData);
      return;
    }

    // Fallback: if no approval callback, proceed with old flow
    try {
      // Use workspaceId from props - no fallback to prevent creating campaigns in wrong workspace
      const actualWorkspaceId = workspaceId;

      console.log('🚀 [CAMPAIGN CREATE] About to create campaign with:', {
        workspace_id: actualWorkspaceId,
        name,
        campaign_type: campaignType,
        workspaceId_prop: workspaceId,
        using_fallback: !workspaceId
      });

      // Extract session_id from multiple sources (for auto-transfer)
      // Priority: 1. uploadedSessionId state, 2. initialProspects, 3. csvData[0]
      const sessionId = uploadedSessionId ||
                       initialProspects?.[0]?.sessionId ||
                       initialProspects?.[0]?.session_id ||
                       csvData?.[0]?.sessionId ||
                       csvData?.[0]?.session_id;

      console.log('🔍 Campaign creation - session_id detection:', {
        hasInitialProspects: !!initialProspects?.length,
        hasCsvData: !!csvData?.length,
        uploadedSessionId,
        firstProspect: initialProspects?.[0],
        firstCsvRow: csvData?.[0],
        extractedSessionId: sessionId
      });

      if (!sessionId) {
        console.warn('⚠️ ⚠️ ⚠️ NO SESSION_ID FOUND - PROSPECTS WILL NOT BE AUTO-TRANSFERRED TO CAMPAIGN!');
        console.warn('This means prospects will need to be manually uploaded via /api/campaigns/upload-prospects');
      }

      // Step 1: Create campaign
      const campaignResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: actualWorkspaceId,
          name,
          campaign_type: campaignType,
          connection_message: connectionMessage,
          alternative_message: alternativeMessage,
          follow_up_messages: followUpMessages.filter(msg => msg.trim()),
          // Email subject lines
          initial_subject: initialSubject,
          follow_up_subjects: followUpSubjects.filter((_, i) => followUpMessages[i]?.trim()), // Only include subjects for non-empty follow-ups
          use_threaded_replies: useThreadedReplies,
          session_id: sessionId // CRITICAL FIX: Include session_id for auto-transfer of approved prospects
        })
      });

      if (!campaignResponse.ok) {
        throw new Error('Failed to create campaign');
      }

      const campaignData = await campaignResponse.json();
      const campaign = campaignData.campaign; // Extract nested campaign object

      // CRITICAL: Log if prospects were auto-transferred via session_id
      if (campaignData.prospects_transferred && campaignData.prospects_transferred > 0) {
        console.log(`✅ AUTO-TRANSFERRED: ${campaignData.prospects_transferred} prospects transferred from session ${sessionId}`);
        toastSuccess(`Campaign created with ${campaignData.prospects_transferred} prospects from approval session`);

        // Skip manual prospect upload since they were auto-transferred
        // Jump to campaign list
        onCampaignCreated?.();
        return;
      } else if (sessionId) {
        console.warn(`⚠️ Session ID ${sessionId} was provided but NO prospects were auto-transferred`);
        console.warn('Possible reasons: No approved prospects, or prospects already transferred, or RLS blocking access');
      }

      // Step 2: Add prospects to campaign
      // CRITICAL FIX: Use different API for approved prospects vs raw uploads
      if (initialProspects && initialProspects.length > 0 && initialProspects[0].id) {
        // Prospects from Data Approval - use add-approved-prospects API
        console.log('✅ Adding approved prospects via /api/campaigns/add-approved-prospects');

        const addProspectsResponse = await fetch('/api/campaigns/add-approved-prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaign.id,
            workspace_id: actualWorkspaceId,
            prospect_ids: initialProspects.map(p => p.id)  // FIXED: Use id not prospect_id
          })
        });

        if (!addProspectsResponse.ok) {
          const errorData = await addProspectsResponse.json();
          throw new Error(errorData.error || 'Failed to add approved prospects to campaign');
        }

        const addResult = await addProspectsResponse.json();
        console.log(`✅ Added ${addResult.count || 0} approved prospects to campaign`);

        // Success message for approved prospects
        toastSuccess(`✅ Campaign "${name}" created!\n\n📊 ${addResult.count || 0} approved prospects added\n🎯 Campaign ready for execution`);

      } else {
        // Raw prospect data (CSV/manual upload) - use upload-prospects API
        console.log('📤 Uploading raw prospects via /api/campaigns/upload-prospects');

        // CRITICAL FIX: Build prospects array from multiple sources with fallback priority
        // Priority: 1. csvData (direct uploads), 2. initialProspects, 3. selectedProspects
        let prospects;
        if (csvData && csvData.length > 0) {
          // CSV data uploaded - use it directly
          console.log(`✅ Using csvData: ${csvData.length} prospects`);
          prospects = csvData;
        } else if (initialProspects && initialProspects.length > 0) {
          console.log(`✅ Using initialProspects: ${initialProspects.length} prospects`);
          prospects = initialProspects.map(prospect => ({
            // Handle both workspace_prospects schema and other schemas
            first_name: prospect.first_name || (prospect.name ? prospect.name.split(' ')[0] : ''),
            last_name: prospect.last_name || (prospect.name ? prospect.name.split(' ').slice(1).join(' ') : ''),
            name: prospect.name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
            email: prospect.email || prospect.email_address || prospect.contact?.email,
            company: prospect.company?.name || prospect.company_name || prospect.company || '',
            title: prospect.title || prospect.job_title,
            linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url,
            linkedin_user_id: prospect.linkedin_user_id
          }));
        } else if (selectedProspects && selectedProspects.length > 0) {
          console.log(`✅ Using selectedProspects: ${selectedProspects.length} prospects`);
          prospects = selectedProspects.map(prospect => ({
            // Handle both workspace_prospects schema and other schemas
            first_name: prospect.first_name || (prospect.name ? prospect.name.split(' ')[0] : ''),
            last_name: prospect.last_name || (prospect.name ? prospect.name.split(' ').slice(1).join(' ') : ''),
            name: prospect.name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
            email: prospect.email || prospect.email_address,
            company: prospect.company || prospect.company_name,
            title: prospect.title || prospect.job_title,
            linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url,
            linkedin_user_id: prospect.linkedin_user_id
          }));
        } else {
          // CRITICAL: No prospects found - throw error instead of silently creating empty campaign
          console.error('❌ NO PROSPECTS FOUND for campaign creation!');
          console.error('  - csvData:', csvData?.length || 0);
          console.error('  - initialProspects:', initialProspects?.length || 0);
          console.error('  - selectedProspects:', selectedProspects?.length || 0);
          throw new Error('No prospects found. Please upload a CSV file or select prospects before creating a campaign.');
        }

        console.log(`📊 Uploading ${prospects.length} prospects to campaign ${campaign.id}`);

        const uploadResponse = await fetch('/api/campaigns/upload-prospects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            campaign_id: campaign.id,
            prospects: prospects
          })
        });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to upload prospects: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();

      // Calculate connection degrees for these prospects
      const prospectDegrees = prospects.map((p: any) => {
        const degree = p.connection_degree || p.degree || 'unknown';
        return degree.toLowerCase().includes('1st') ? '1st' :
               (degree.toLowerCase().includes('2nd') || degree.toLowerCase().includes('3rd')) ? '2nd/3rd' : 'unknown';
      });
      const firstDegreeCount = prospectDegrees.filter((d: string) => d === '1st').length;
      const secondThirdCount = prospectDegrees.filter((d: string) => d === '2nd/3rd').length;
      const hasOnly1stDegreeLocal = firstDegreeCount > 0 && secondThirdCount === 0;

      // Step 2.5: Auto-sync LinkedIn IDs for MESSENGER campaigns (1st degree connections only)
      let syncedCount = 0;
      if (uploadResult.prospects_with_linkedin_ids === 0 && hasOnly1stDegreeLocal && campaignType === 'messenger') {
        console.log('🔄 Auto-syncing LinkedIn IDs for 1st degree connections (Messenger campaign)...');

        try {
          const syncResponse = await fetch('/api/campaigns/sync-linkedin-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: campaign.id,
              workspaceId: workspaceId
            })
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            syncedCount = syncResult.resolved || 0;
            console.log(`✅ Synced ${syncedCount} LinkedIn IDs from message history`);
          } else {
            console.warn('⚠️ LinkedIn ID sync failed, will need manual resolution');
          }
        } catch (error) {
          console.error('LinkedIn ID sync error:', error);
          // Continue anyway - user can manually resolve later
        }
      }

      // Update prospects count to include synced IDs
      const totalProspectsWithIds = uploadResult.prospects_with_linkedin_ids + syncedCount;

      // Step 3: Auto-execute via queue-based Unipile integration (30 min spacing)
      if (totalProspectsWithIds > 0 || campaign.campaign_type === 'connector') {
        const executeEndpoint = '/api/campaigns/direct/send-connection-requests-fast';

        const executeResponse = await fetch(executeEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // Include cookies for Supabase auth
          body: JSON.stringify({
            campaignId: campaign.id
          })
        });

        if (executeResponse.ok) {
          const syncMessage = syncedCount > 0
            ? `\n🔗 ${syncedCount} LinkedIn IDs auto-resolved from message history`
            : '';
          toastError(`✅ Campaign "${name}" created and launched!\n\n📊 ${csvData.length} prospects uploaded${syncMessage}\n🚀 ${totalProspectsWithIds} ready for messaging\n📬 Campaign sent to execution queue`);
        } else {
          toastError(`✅ Campaign "${name}" created!\n\n📊 Upload Results:\n• ${csvData.length} prospects uploaded\n• ${totalProspectsWithIds} with LinkedIn IDs\n• Ready for manual launch`);
        }
      } else {
        toastError(`✅ Campaign "${name}" created!\n\n📊 Upload Results:\n• ${csvData.length} prospects uploaded\n• LinkedIn ID discovery needed for messaging\n• Run connection campaign first to capture IDs`);
      }
      } // Close else block for raw prospect upload

      // Reset form and refresh campaign list
      setCurrentStep(1);
      setCsvData([]);
      setCsvFile(null);
      setShowPreview(false);
      setConnectionMessage('');
      setAlternativeMessage('');
      setFollowUpMessages(['']);
      
      // Close the campaign builder
      if (onClose) {
        onClose();
      }
      
      // Trigger refresh of campaign list
      window.dispatchEvent(new CustomEvent('refreshCampaigns'));

      // Switch to Paused tab to show the approved campaign
      setCampaignFilter('paused');

    } catch (error: any) {
      console.error('Campaign creation error:', error);

      // Auto-save as draft when campaign creation fails
      console.log('💾 Auto-saving campaign as draft due to error...');
      try {
        await saveDraft(true); // Force save with toast notification
        toastError(`❌ Error creating campaign: ${error.message}. Draft saved.`);
      } catch (draftError) {
        console.error('Failed to save draft:', draftError);
        toastError(`❌ Error creating campaign: ${error.message}`);
      }
    }
  };
  
  return (
    <>
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-gray-700 mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center">
            <Rocket size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">New Campaign</h2>
            <p className="text-gray-400 text-sm">Multi-channel outreach automation</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={() => {
              if (currentStep > 1) {
                // If on Step 3 and we have initialProspects (meaning we skipped Step 2), go back to Step 1
                if (currentStep === 3 && initialProspects && initialProspects.length > 0) {
                  setCurrentStep(1);
                } else {
                  // Otherwise, go back one step
                  setCurrentStep(currentStep - 1);
                }
              } else {
                // On step 1, close the modal
                onClose();
              }
            }}
            className="text-gray-400 hover:text-gray-300 transition-colors"
            title={currentStep > 1 ? 'Back' : 'Close'}
          >
            <X size={24} />
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center mb-8">
        {[1, 2, 3].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step <= currentStep ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-400'
            }`}>
              {step}
            </div>
            {step < 3 && (
              <div className={`w-16 h-1 mx-2 ${
                step < currentStep ? 'bg-purple-600' : 'bg-gray-600'
              }`} />
            )}
          </div>
        ))}
        <div className="ml-4 text-sm text-gray-400">
          Step {currentStep} of 3: {
            currentStep === 1 ? 'Campaign Setup' :
            currentStep === 2 ? 'Campaign Summary' :
            'Message Templates'
          }
        </div>
      </div>

      {/* Step 1: Campaign Setup */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="p-6 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-lg border border-purple-700/50">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles size={24} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">Launch Your Campaign</h3>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">
                  Create intelligent, multi-channel outreach campaigns. SAM AI personalizes every message
                  to maximize engagement and conversions.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp size={16} className="text-purple-400" />
                    <span className="text-gray-300">AI-powered personalization</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={16} className="text-purple-400" />
                    <span className="text-gray-300">Multi-channel reach</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Target size={16} className="text-purple-400" />
                    <span className="text-gray-300">Smart targeting</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock size={16} className="text-purple-400" />
                    <span className="text-gray-300">Automated follow-ups</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="campaign-name" className="block text-sm font-medium text-gray-400">
              Campaign Name
            </label>
            <input
              id="campaign-name"
              type="text"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter campaign name..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-3">
              Campaign Type
            </label>
            {/* Connection Degree Detection Info */}
            {connectionDegrees.total > 0 && (
              <div className={`border rounded-lg p-3 mb-4 ${
                !hasConnectionDegreeData
                  ? 'bg-yellow-900/20 border-yellow-500/30'
                  : 'bg-blue-900/20 border-blue-500/30'
              }`}>
                <p className={`text-sm ${
                  !hasConnectionDegreeData ? 'text-yellow-300' : 'text-blue-300'
                }`}>
                  {!hasConnectionDegreeData && (
                    <span>
                      ⚠️ <strong>No LinkedIn connection degree detected</strong> - Only Email campaigns available.
                      <br />
                      To enable LinkedIn campaigns: Add a column named <strong>"Connection Degree"</strong> or <strong>"Connection"</strong> to your CSV with values like "1st", "2nd", or "3rd", then re-upload.
                    </span>
                  )}
                  {hasConnectionDegreeData && hasOnly1stDegree && (
                    <span>✓ All prospects are 1st degree connections - Messenger available, Connector disabled</span>
                  )}
                  {hasConnectionDegreeData && !hasOnly1stDegree && connectionDegrees.secondThird > 0 && connectionDegrees.firstDegree === 0 && (
                    <span>✓ All prospects are 2nd/3rd degree - Connector available, Messenger disabled</span>
                  )}
                  {hasConnectionDegreeData && connectionDegrees.firstDegree > 0 && connectionDegrees.secondThird > 0 && (
                    <span>📊 Mixed connection degrees: {connectionDegrees.firstDegree} × 1st degree, {connectionDegrees.secondThird} × 2nd/3rd degree</span>
                  )}
                  {hasConnectionDegreeData && connectionDegrees.firstDegree === 0 && connectionDegrees.secondThird === 0 && (initialProspects && initialProspects.length > 0) && (
                    <span>✓ LinkedIn prospects loaded - All campaign types available based on your connections</span>
                  )}
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {campaignTypes.map((type) => {
                const IconComponent = type.icon;
                const isConnector = type.value === 'connector';
                const isMessenger = type.value === 'messenger';
                const isMultichannel = type.value === 'multichannel';
                const isEmail = type.value === 'email';

                // Calculate percentages for stricter enforcement
                const firstDegreePercent = connectionDegrees.total > 0
                  ? (connectionDegrees.firstDegree / connectionDegrees.total) * 100
                  : 0;
                const secondThirdPercent = connectionDegrees.total > 0
                  ? (connectionDegrees.secondThird / connectionDegrees.total) * 100
                  : 0;

                // STRICT ENFORCEMENT: Disable campaign types that don't match the majority
                const hasOnly2nd3rdDegree = connectionDegrees.secondThird > 0 && connectionDegrees.firstDegree === 0;

                // Check if prospects have email addresses
                const prospects = csvData.length > 0 ? csvData : (initialProspects || []);
                const hasEmailAddresses = prospects.some(p => p.email || p.email_address || p.contact?.email);

                let isDisabled = false;
                let disabledReason = '';
                let needsConnection: 'linkedin' | 'email' | 'both' | null = null;

                // Multi is always disabled (in development)
                if (isMultichannel) {
                  isDisabled = true;
                  disabledReason = '🚧 In Development - Multi-channel campaigns coming soon';
                }
                // Check connection degree restrictions FIRST (highest priority)
                else if (connectionDegrees.total > 0) {
                  // Disable Connector if prospects are predominantly 1st degree (70%+)
                  if (isConnector && (hasOnly1stDegree || firstDegreePercent >= 70)) {
                    isDisabled = true;
                    if (hasOnly1stDegree) {
                      disabledReason = 'All prospects are 1st degree - use Messenger for direct messages';
                    } else {
                      disabledReason = `${Math.round(firstDegreePercent)}% are 1st degree - use Messenger instead`;
                    }
                  }
                  // Disable Messenger if prospects are predominantly 2nd/3rd degree (70%+)
                  if (isMessenger && (hasOnly2nd3rdDegree || secondThirdPercent >= 70)) {
                    isDisabled = true;
                    if (hasOnly2nd3rdDegree) {
                      disabledReason = 'All prospects are 2nd/3rd degree - use Connector to send connection requests first';
                    } else {
                      disabledReason = `${Math.round(secondThirdPercent)}% are 2nd/3rd degree - use Connector instead`;
                    }
                  }
                  // Check email availability for Email campaigns
                  if (isEmail && !hasEmailAddresses && prospects.length > 0) {
                    isDisabled = true;
                    disabledReason = 'No email addresses in prospects - add email column to CSV';
                  }
                  // Check account connections (lower priority) - only if not already disabled
                  if (!isDisabled && (isConnector || isMessenger) && !connectedAccounts.linkedin) {
                    isDisabled = true;
                    disabledReason = 'LinkedIn account not connected';
                    needsConnection = 'linkedin';
                  }
                  if (!isDisabled && isEmail && !connectedAccounts.email) {
                    isDisabled = true;
                    disabledReason = 'Email account not connected';
                    needsConnection = 'email';
                  }
                }
                // No prospects loaded yet - check account connections only
                else {
                  if ((isConnector || isMessenger) && !connectedAccounts.linkedin) {
                    isDisabled = true;
                    disabledReason = 'LinkedIn account not connected';
                    needsConnection = 'linkedin';
                  } else if (isEmail && !connectedAccounts.email) {
                    isDisabled = true;
                    disabledReason = 'Email account not connected';
                    needsConnection = 'email';
                  }
                }

                return (
                  <div
                    key={type.value}
                    onClick={() => {
                      if (!isDisabled && !needsConnection) {
                        setCampaignType(type.value);
                        setUserSelectedCampaignType(true); // Mark as manually selected
                      }
                    }}
                    className={`p-5 border-2 rounded-lg transition-all ${
                      isDisabled
                        ? 'border-gray-700 bg-gray-800/50 opacity-50'
                        : campaignType === type.value
                        ? 'border-purple-500 bg-gradient-to-br from-purple-900/40 to-blue-900/40 cursor-pointer shadow-lg shadow-purple-500/20'
                        : 'border-gray-600 bg-gray-700/50 hover:border-purple-400 hover:bg-gray-700 cursor-pointer'
                    } ${needsConnection ? '' : isDisabled ? 'cursor-not-allowed' : ''}`}
                    title={isDisabled && !needsConnection ? `Not available: ${disabledReason}` : ''}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        campaignType === type.value
                          ? 'bg-purple-600'
                          : 'bg-gray-600'
                      }`}>
                        <IconComponent className="text-white" size={20} />
                      </div>
                      <h4 className="text-white font-semibold text-base">{type.label}</h4>
                    </div>
                    <p className="text-gray-300 text-sm leading-relaxed">{type.description}</p>
                    {isDisabled && needsConnection && (
                      <div className="mt-3">
                        <p className="text-yellow-400 text-xs mb-2">
                          ⚠️ {disabledReason}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (needsConnection === 'linkedin') {
                              setUnipileProvider('LINKEDIN');
                              setShowUnipileWizard(true);
                            } else if (needsConnection === 'email') {
                              setUnipileProvider('GOOGLE'); // Default to Google for email
                              setShowUnipileWizard(true);
                            } else if (needsConnection === 'both') {
                              setUnipileProvider('LINKEDIN');
                              setShowUnipileWizard(true);
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors flex items-center justify-center gap-1"
                        >
                          <Link size={12} />
                          Connect {needsConnection === 'both' ? 'Accounts' : needsConnection === 'linkedin' ? 'LinkedIn' : 'Email'} Now
                        </button>
                      </div>
                    )}
                    {isDisabled && !needsConnection && (
                      <p className="text-red-400 text-xs mt-2">
                        ⚠️ Not available: {disabledReason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            {connectionDegrees.total > 0 && (campaignType === 'messenger' || campaignType === 'connector') && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-3">
                <p className="text-blue-300 text-sm">
                  <strong>{userSelectedCampaignType ? 'Selected:' : 'Auto-selected:'}</strong> {campaignType === 'messenger' ? 'Messenger' : 'Connector'} campaign
                  {hasOnly1stDegree && ` (all ${connectionDegrees.firstDegree} prospects are 1st degree connections)`}
                  {connectionDegrees.secondThird > 0 && connectionDegrees.firstDegree === 0 && ` (all ${connectionDegrees.secondThird} prospects are 2nd/3rd degree connections)`}
                  {!hasOnly1stDegree && connectionDegrees.firstDegree > 0 && connectionDegrees.secondThird > 0 &&
                    ` (${Math.round((campaignType === 'messenger' ? connectionDegrees.firstDegree : connectionDegrees.secondThird) / connectionDegrees.total * 100)}% match)`}
                </p>
              </div>
            )}
            {campaignType === 'email' && (
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-3">
                <p className="text-blue-300 text-sm">
                  <strong>Selected:</strong> Email campaign - Direct email outreach without LinkedIn connection requests
                </p>
              </div>
            )}
            {campaignType === 'multichannel' && (
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mt-3">
                <p className="text-purple-300 text-sm">
                  <strong>Selected:</strong> Multichannel campaign - Combine LinkedIn and email outreach
                </p>
              </div>
            )}
            {has1stDegree && !hasOnly1stDegree && campaignType === 'connector' && (
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-3">
                <p className="text-yellow-300 text-sm">
                  ⚠️ <strong>Warning:</strong> {connectionDegrees.firstDegree} of your prospects are 1st degree connections and will be skipped in Connector campaigns. Consider using <strong>Builder</strong> instead.
                </p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Step 2: Campaign Summary - LIST BASED VIEW */}
      {currentStep === 2 && (
        <div className="space-y-6">
          {/* Show list-based selection */}
          <div>
            <h4 className="text-white font-medium mb-4">Select Prospect Lists</h4>

            {/* Auto-selected list from Data Approval */}
            {initialProspects && initialProspects.length > 0 && initialProspects[0].sessionId && (() => {
              const autoSelectedSession = approvalSessions.find(s => s.id === initialProspects[0].sessionId);
              return autoSelectedSession ? (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="text-green-400" size={20} />
                      <div>
                        <p className="text-white font-medium">{autoSelectedSession.campaign_name || autoSelectedSession.name || 'Unnamed List'}</p>
                        <p className="text-gray-400 text-sm">{initialProspects.length} prospects • Auto-selected from Data Approval</p>
                      </div>
                    </div>
                    <span className="text-green-400 text-sm">✓ Assigned</span>
                  </div>
                </div>
              ) : null;
            })()}

            {/* Show other available lists */}
            <div className="bg-gray-700 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <label className="text-sm font-medium text-gray-400">
                  Additional Lists (Optional)
                </label>
                <span className="text-xs text-gray-500">
                  {approvalSessions.filter(s => !selectedSessions.includes(s.id)).length} available
                </span>
              </div>

              {loadingApprovedProspects ? (
                <div className="text-center py-8 text-gray-400">Loading lists...</div>
              ) : approvalSessions.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  No additional lists available
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {approvalSessions
                    .filter(session => !initialProspects || session.id !== initialProspects[0]?.sessionId)
                    .map(session => {
                      const sessionProspects = approvedProspects.filter(p => p.sessionId === session.id);
                      const isSelected = selectedSessions.includes(session.id);
                      const hasActiveSession = session.campaign_id && session.campaign_id !== name;

                      return (
                        <div
                          key={session.id}
                          className={`p-3 rounded border ${
                            hasActiveSession ? 'border-gray-600 bg-gray-800/50 opacity-50' :
                            isSelected ? 'border-purple-500/50 bg-purple-900/20' : 'border-gray-600 hover:border-gray-500'
                          } cursor-pointer transition-colors`}
                          onClick={() => {
                            if (hasActiveSession) return;
                            if (isSelected) {
                              setSelectedSessions(selectedSessions.filter(id => id !== session.id));
                              setSelectedProspects(selectedProspects.filter(p => p.sessionId !== session.id));
                            } else {
                              setSelectedSessions([...selectedSessions, session.id]);
                              setSelectedProspects([...selectedProspects, ...sessionProspects]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {isSelected ? (
                                <CheckCircle className="text-purple-400" size={18} />
                              ) : (
                                <Circle className="text-gray-500" size={18} />
                              )}
                              <div>
                                <p className="text-white text-sm font-medium">{session.name || 'Unnamed List'}</p>
                                <p className="text-gray-400 text-xs">{sessionProspects.length} prospects</p>
                              </div>
                            </div>
                            {hasActiveSession && (
                              <span className="text-xs text-gray-500">In use by another campaign</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            {/* Summary */}
            <div className="mt-4 bg-gray-800 rounded-lg p-4">
              <div className="text-sm text-gray-400">
                <span className="text-white font-medium">
                  {(initialProspects?.length || 0) + selectedProspects.length}
                </span> total prospects selected
              </div>
            </div>
          </div>

          {/* Data Source Selection - Hide when prospects are from approval */}
          {!(initialProspects && initialProspects.length > 0) && (
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h4 className="text-white font-medium mb-3">Choose Prospect Data Source</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setDataSource('approved')}
                className={`h-auto p-4 flex flex-col items-start border rounded-lg transition-colors ${
                  dataSource === 'approved'
                    ? 'border-purple-500 bg-purple-600/20 text-purple-300'
                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Users className="mb-2" size={24} />
                <div className="font-medium">Use Approved Prospects</div>
                <div className="text-xs text-gray-400 mt-1">Select from previously approved prospect data</div>
              </button>

              <button
                type="button"
                onClick={() => setDataSource('quick-add')}
                className={`h-auto p-4 flex flex-col items-start border rounded-lg transition-colors ${
                  dataSource === 'quick-add'
                    ? 'border-purple-500 bg-purple-600/20 text-purple-300'
                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Link className="mb-2" size={24} />
                <div className="font-medium">Quick Add LinkedIn URL</div>
                <div className="text-xs text-gray-400 mt-1">Paste a LinkedIn profile URL to add instantly</div>
              </button>
            </div>
          </div>
          )}

          {/* Approved Prospects Selection - only show if prospects not already loaded */}
          {dataSource === 'approved' && !initialProspects?.length && (
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Approval Lists (Optional - add more)
              </label>
              <div className="bg-gray-700 rounded-lg p-4">
                {loadingApprovedProspects ? (
                  <div className="text-center py-8 text-gray-400">Loading approval sessions...</div>
                ) : approvalSessions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    No approval sessions found. Use the Prospect Database section to approve some prospects first.
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-white font-medium">{approvalSessions.length} Approval List{approvalSessions.length !== 1 ? 's' : ''} Available</span>
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = selectedSessions.length === approvalSessions.length;
                          if (allSelected) {
                            setSelectedSessions([]);
                            setSelectedProspects([]);
                            setName(generateDefaultCampaignName());
                          } else {
                            setSelectedSessions(approvalSessions.map(s => s.id));
                            setSelectedProspects([...approvedProspects]);
                            // Use first session's name when selecting all
                            if (approvalSessions.length > 0 && approvalSessions[0].name) {
                              setName(approvalSessions[0].name);
                            }
                          }
                        }}
                        className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        {selectedSessions.length === approvalSessions.length ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {approvalSessions.map((session) => {
                        const isSelected = selectedSessions.includes(session.id);
                        return (
                          <div
                            key={session.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'border-purple-500 bg-purple-600/20'
                                : 'border-gray-600 bg-gray-800 hover:border-gray-500'
                            }`}
                            onClick={() => {
                              if (isSelected) {
                                // Deselect session and remove its prospects
                                const newSelectedSessions = selectedSessions.filter(id => id !== session.id);
                                setSelectedSessions(newSelectedSessions);
                                setSelectedProspects(selectedProspects.filter(p => p.sessionId !== session.id));

                                // Update campaign name to first remaining selected session's name
                                if (newSelectedSessions.length > 0) {
                                  const firstSession = approvalSessions.find(s => s.id === newSelectedSessions[0]);
                                  if (firstSession?.name) {
                                    setName(firstSession.name);
                                  }
                                } else {
                                  // No sessions selected, reset to default
                                  setName(generateDefaultCampaignName());
                                }
                              } else {
                                // Select session and add its prospects
                                const newSelectedSessions = [...selectedSessions, session.id];
                                setSelectedSessions(newSelectedSessions);
                                setSelectedProspects([...selectedProspects, ...session.prospects]);

                                // If this is the first session selected, use its name for the campaign
                                if (selectedSessions.length === 0 && session.name) {
                                  setName(session.name);
                                }
                              }
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <div className="text-white font-medium">{session.name}</div>
                                <div className="text-gray-300 text-sm mt-1">
                                  {session.prospectsCount} approved prospect{session.prospectsCount !== 1 ? 's' : ''}
                                </div>
                                <div className="text-gray-400 text-xs mt-1">
                                  Created: {new Date(session.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500'
                                  : 'border-gray-500'
                              }`}>
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {selectedProspects.length > 0 && (
                      <>
                        <div className="mt-4 p-3 bg-purple-600/20 rounded-lg">
                          <span className="text-purple-300">
                            {selectedSessions.length} list{selectedSessions.length !== 1 ? 's' : ''} selected • {selectedProspects.length} prospect{selectedProspects.length !== 1 ? 's' : ''} for campaign
                          </span>
                        </div>
                        <div className="mt-4 bg-gray-800 rounded-lg p-6">
                          <h4 className="text-white font-medium mb-4">Campaign Summary</h4>
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <div className="text-gray-400 text-sm mb-1">List Name</div>
                              <div className="text-white font-medium">{name}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-sm mb-1">List Date</div>
                              <div className="text-white font-medium">{new Date().toLocaleDateString()}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Number of Prospects</div>
                              <div className="text-white font-medium">{selectedProspects.length}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Campaign Type</div>
                              <div className="text-white font-medium">{campaignType === 'linkedin' ? 'LinkedIn' : campaignType === 'email' ? 'Email' : 'Combined'}</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Industry</div>
                              <div className="text-white font-medium">-</div>
                            </div>
                            <div>
                              <div className="text-gray-400 text-sm mb-1">Connection Grade</div>
                              <div className="text-white font-medium">-</div>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick Add URL Input - show when quick-add is selected */}
          {dataSource === 'quick-add' && (
            <div className="bg-gray-700 rounded-lg p-4 mb-6">
              <h4 className="text-white font-medium mb-3">Add LinkedIn Profile</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="https://linkedin.com/in/username"
                  value={quickAddUrl}
                  onChange={(e) => setQuickAddUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isAddingQuickProspect) {
                      handleQuickAddProspect();
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50"
                  disabled={isAddingQuickProspect}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (quickAddUrl && quickAddUrl.trim()) {
                      handleQuickAddProspect();
                    }
                  }}
                  disabled={typeof quickAddUrl !== 'string' || quickAddUrl.trim().length === 0 || isAddingQuickProspect}
                  className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isAddingQuickProspect ? (
                    <>
                      <Loader2 className="mr-2 animate-spin" size={16} />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2" size={16} />
                      Add
                    </>
                  )}
                </button>
              </div>
              <p className="text-gray-400 text-xs mt-2">
                Paste a LinkedIn profile URL and we'll automatically detect if they're a 1st degree connection
              </p>

              {/* Show added prospects */}
              {csvData.length > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-400 text-sm">Added Prospects ({csvData.length})</span>
                    <button
                      type="button"
                      onClick={() => setCsvData([])}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {csvData.map((prospect, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-800 p-3 rounded-lg border border-gray-600"
                      >
                        <div className="flex-1">
                          <div className="text-white font-medium">{prospect.name}</div>
                          <div className="text-gray-400 text-xs mt-1">{prospect.linkedin_url}</div>
                          <div className="text-gray-500 text-xs mt-1">
                            {prospect.connection_degree} degree connection
                            {prospect.linkedin_user_id && ' • Ready for Messenger'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setCsvData(csvData.filter((_, i) => i !== index));
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* Step 3: Message Templates (Connector Campaign) */}
      {currentStep === 3 && campaignType === 'connector' && (
        <div className="space-y-6">
          {/* SAM Messaging Generation */}
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Zap className="text-purple-400 mr-2" size={20} />
              <h4 className="text-white font-medium">SAM AI Messaging Generator</h4>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              Let SAM create personalized messaging sequences based on your campaign goals and target audience.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                onClick={() => {
                  setManualConnection('');
                  setManualAlternative('');
                  setManualFollowUps(['']);
                  setShowManualTemplateModal(true);
                }}
              >
                <Edit size={16} className="mr-1" />
                Create Manually
              </button>
              <button
                type="button"
                onClick={() => {
                  const campaignTypeLabel = campaignType === 'connector' ? '**connector campaign** (for 2nd/3rd degree LinkedIn connections)' : '**messenger campaign** (for 1st degree connections - already connected)';
                  const messageType = campaignType === 'connector' ? 'connection request + follow-up messages' : 'direct messages (no connection request needed)';

                  setSamMessages([{
                    role: 'assistant',
                    content: `Hi! I'm SAM, and I'll help you create compelling LinkedIn messaging sequences for your ${campaignTypeLabel} "${name}".\n\n**Campaign Type:** ${campaignType === 'connector' ? 'Connector - I will generate a connection request message and follow-ups' : 'Messenger - I will generate direct messages for your existing connections (no connection request)'}\n\nI can see you have ${csvData.length} prospects loaded. To create the best ${messageType}, tell me:\n\n1. What's your main goal with this campaign? (networking, lead generation, partnerships, etc.)\n2. What value can you offer these prospects?\n3. Any specific tone you'd like? (professional, casual, friendly, etc.)\n\nLet's create messages that get responses! 🎯`
                  }]);
                  setShowSamGenerationModal(true);
                }}
                className="flex items-center px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Zap size={16} className="mr-1" />
                Generate Messaging with SAM
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                onClick={openKBModal}
              >
                <Brain size={16} className="mr-1" />
                Load from Knowledgebase
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 rounded-lg transition-colors"
                onClick={openPreviousMessagesModal}
              >
                <Clock size={16} className="mr-1" />
                Load Previous Messages
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-pink-600/20 hover:bg-pink-600/30 text-pink-400 border border-pink-500/30 rounded-lg transition-colors"
                onClick={() => setShowTemplateLibraryModal(true)}
              >
                <FileText size={16} className="mr-1" />
                Load from Template
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg transition-colors"
                onClick={() => setShowPasteModal(true)}
              >
                <Upload size={16} className="mr-1" />
                Paste Template
              </button>
            </div>
          </div>

          {/* ONLY show Connection Request for Connector campaigns */}
          {campaignType === 'connector' && (
            <div className="space-y-2">
              <label htmlFor="connection-message" className="block text-sm font-medium text-gray-400">
                Connection Request Message
              </label>
              <p className="text-xs text-gray-500">
                This message will be sent with your connection request
              </p>
              <textarea
                id="connection-message"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                rows={4}
                value={connectionMessage}
                onChange={e => setConnectionMessage(e.target.value)}
                onFocus={(e) => {
                  setActiveField({type: 'connection'});
                  setActiveTextarea(e.target as HTMLTextAreaElement);
                }}
                placeholder="Hi {first_name}, I saw your profile and would love to connect..."
                maxLength={275}
              />
              <div className="flex justify-between items-center">
                <span className={`text-xs font-medium ${
                  connectionMessage.length > 250 ? 'text-orange-400' :
                  connectionMessage.length > 270 ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {connectionMessage.length}/275 characters
                  {connectionMessage.length > 250 && connectionMessage.length <= 275 && (
                    <span className="ml-2 text-xs">({275 - connectionMessage.length} remaining)</span>
                  )}
                </span>
                {connectionMessage.length > 0 && (
                  <button
                    type="button"
                    className="flex items-center px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg transition-colors"
                    onClick={async () => {
                      // Call SAM API directly to improve the message
                      try {
                        toastInfo('SAM is improving your message...');

                        console.log('Improve with SAM - Request:', {
                          workspaceId,
                          campaignName: name,
                          messageLength: connectionMessage.length,
                          prospectCount: csvData.length
                        });

                        const response = await fetch('/api/sam/generate-templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            workspace_id: workspaceId,
                            campaign_name: name,
                            campaign_type: 'connector',
                            prospect_count: csvData.length,
                            user_input: `Please improve this connection request message. Keep it under 275 characters and maintain personalization placeholders like {first_name}, {company_name}, etc.\n\nCurrent message (${connectionMessage.length} chars):\n"${connectionMessage}"\n\nMake it more engaging while staying professional and concise.`,
                            conversation_history: [],
                            prospect_sample: csvData.slice(0, 3)
                          })
                        });

                        console.log('Improve with SAM - Response status:', response.status);

                        if (response.ok) {
                          const result = await response.json();
                          console.log('Improve with SAM - Result:', result);

                          if (result.templates?.connection_message) {
                            const improved = result.templates.connection_message;
                            if (improved.length <= 275) {
                              setConnectionMessage(improved);
                              toastSuccess(`Message improved! (${improved.length}/275 characters)`);
                            } else {
                              toastWarning(`Improved message is ${improved.length} characters. Truncating to 275.`);
                              setConnectionMessage(improved.substring(0, 275));
                            }
                          } else {
                            console.error('No connection_message in result:', result);
                            toastError('Could not extract improved message. Check console for details.');
                          }
                        } else {
                          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                          console.error('Improve with SAM - API error:', response.status, errorData);
                          toastError(`Failed to improve message: ${errorData.error || errorData.details || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Improve message error:', error);
                        toastError(`Error improving message: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      }
                    }}
                  >
                    <Zap size={12} className="mr-1" />
                    Improve with SAM
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ONLY show Alternative Message for Connector campaigns */}
          {campaignType === 'connector' && (
            <div className="space-y-2">
              <label htmlFor="alternative-message" className="block text-sm font-medium text-gray-400">
                Alternative Message (Optional)
              </label>
              <p className="text-xs text-gray-500">
                Shorter alternative message for connection requests
              </p>
              <textarea
                id="alternative-message"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                rows={2}
                value={alternativeMessage}
                onChange={e => setAlternativeMessage(e.target.value)}
                onFocus={(e) => {
                  setActiveField({type: 'alternative'});
                  setActiveTextarea(e.target as HTMLTextAreaElement);
                }}
                placeholder="Would love to connect with you on LinkedIn!"
                maxLength={115}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500">
                  Characters remaining: {115 - alternativeMessage.length}/115
                </span>
                {alternativeMessage.length > 0 && (
                  <button
                    type="button"
                    className="flex items-center px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg transition-colors"
                    onClick={async () => {
                      // Call SAM API directly to improve the message
                      try {
                        toastInfo('SAM is improving your alternative message...');

                        const response = await fetch('/api/sam/generate-templates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            workspace_id: workspaceId,
                            campaign_name: name,
                            campaign_type: 'connector',
                            prospect_count: csvData.length,
                            user_input: `Please improve this alternative message. Keep it under 115 characters and maintain a friendly, concise tone.\n\nCurrent message (${alternativeMessage.length} chars):\n"${alternativeMessage}"\n\nMake it more engaging while staying brief.`,
                            conversation_history: [],
                            prospect_sample: csvData.slice(0, 3)
                          })
                        });

                        if (response.ok) {
                          const result = await response.json();

                          if (result.templates?.alternative_message) {
                            const improved = result.templates.alternative_message;
                            if (improved.length <= 115) {
                              setAlternativeMessage(improved);
                              toastSuccess(`Alternative message improved! (${improved.length}/115 characters)`);
                            } else {
                              toastWarning(`Improved message is ${improved.length} characters. Truncating to 115.`);
                              setAlternativeMessage(improved.substring(0, 115));
                            }
                          } else {
                            toastError('Could not extract improved message.');
                          }
                        } else {
                          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                          toastError(`Failed to improve message: ${errorData.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Improve alternative message error:', error);
                        toastError(`Error improving message: ${error instanceof Error ? error.message : 'Unknown error'}`);
                      }
                    }}
                  >
                    <Zap size={12} className="mr-1" />
                    Improve with SAM
                  </button>
                )}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-400">
                6-Step Messaging Sequence (5 Follow-ups)
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Messages 2-6 sent after connection is accepted
            </p>

            {followUpMessages.map((message, index) => {
              // Helper function to get message label and requirements
              const getMessageLabel = () => {
                if (index === 0) return 'Message 2 - Must start with "Hello {first_name},"';
                if (index === 4) return 'Message 6 - Goodbye message (no first name)';
                return `Message ${index + 2} (no first name)`;
              };

              const getMessagePlaceholder = () => {
                if (index === 0) return 'Hello {first_name}, [your message here]...';
                if (index === 4) return 'Polite goodbye message leaving door open for future connection...';
                return `Follow-up message ${index + 2}...`;
              };

              return (
                <div key={index} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-400">
                        {getMessageLabel()}
                      </label>
                      <span className="text-xs text-gray-500">• Wait:</span>
                    </div>
                    <select
                      className="bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                      value={(campaignSettings.message_delays || [])[index] || '2-3 days'}
                      onChange={(e) => updateMessageDelay(index, e.target.value)}
                    >
                      <option value="1 day">1 day</option>
                      <option value="2-3 days">2-3 days</option>
                      <option value="3-5 days">3-5 days</option>
                      <option value="5-7 days">5-7 days</option>
                      <option value="1 week">1 week</option>
                      <option value="2 weeks">2 weeks</option>
                    </select>
                  </div>
                  <textarea
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                    rows={3}
                    value={message}
                    onChange={e => updateFollowUpMessage(index, e.target.value)}
                    onFocus={(e) => {
                      setActiveField({type: 'followup', index});
                      setActiveTextarea(e.target as HTMLTextAreaElement);
                    }}
                    placeholder={getMessagePlaceholder()}
                    data-followup-index={index}
                  />
                  {message.length > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      {/* Remove button */}
                      {followUpMessages.length > 1 && (
                        <button
                          type="button"
                          className="flex items-center px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                          onClick={() => {
                            if (confirm(`Remove Message ${index + 2}?`)) {
                              removeFollowUpMessage(index);
                              toastSuccess(`Message ${index + 2} removed`);
                            }
                          }}
                        >
                          <X size={12} className="mr-1" />
                          Remove
                        </button>
                      )}
                      <div className="flex-grow"></div>
                      <button
                        type="button"
                        className="flex items-center px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg transition-colors"
                        onClick={async () => {
                          // Call SAM API directly to improve the message
                          try {
                            toastInfo(`SAM is improving message ${index + 2}...`);

                            const messageType = index === 0 ? 'Message 2 (must start with "Hello {first_name},")' :
                                              index === 4 ? 'Message 6 (goodbye message)' :
                                              `Message ${index + 2}`;

                            const response = await fetch('/api/sam/generate-templates', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                workspace_id: workspaceId,
                                campaign_name: name,
                                campaign_type: 'connector',
                                prospect_count: csvData.length,
                                user_input: `Please improve this follow-up message (${messageType}). ${index === 0 ? 'It MUST start with "Hello {first_name},"' : index === 4 ? 'This is a goodbye message - keep it polite and leave the door open.' : 'Make it engaging and valuable.'}\n\nCurrent message:\n"${message}"\n\nMake it more effective while maintaining personalization placeholders.`,
                                conversation_history: [],
                                prospect_sample: csvData.slice(0, 3)
                              })
                            });

                            if (response.ok) {
                              const result = await response.json();

                              if (result.templates?.follow_up_messages?.[index]) {
                                const improved = result.templates.follow_up_messages[index];
                                updateFollowUpMessage(index, improved);
                                toastSuccess(`Message ${index + 2} improved!`);
                              } else if (result.templates?.message) {
                                // Fallback to generic message field
                                updateFollowUpMessage(index, result.templates.message);
                                toastSuccess(`Message ${index + 2} improved!`);
                              } else {
                                toastError('Could not extract improved message.');
                              }
                            } else {
                              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                              toastError(`Failed to improve message: ${errorData.error || 'Unknown error'}`);
                            }
                          } catch (error) {
                            console.error(`Improve follow-up ${index} error:`, error);
                            toastError(`Error improving message: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          }
                        }}
                      >
                        <Zap size={12} className="mr-1" />
                        Improve with SAM
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Follow-Up Message Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={addFollowUpMessage}
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Add Follow-Up Message
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Add additional steps to your messaging sequence (currently {followUpMessages.length} follow-up{followUpMessages.length !== 1 ? 's' : ''})
              </p>
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <h4 className="text-white font-semibold">Personalization Placeholders</h4>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Click to insert dynamic fields that auto-fill with prospect data
            </p>
            <div className="flex flex-wrap gap-2">
              {placeholders.map((placeholder) => (
                <button
                  key={placeholder.key}
                  onClick={() => insertPlaceholder(placeholder.key)}
                  className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 hover:border-purple-400 rounded-full text-purple-200 text-xs font-medium transition-all hover:scale-105 cursor-pointer"
                  title={placeholder.description}
                >
                  {placeholder.key}
                </button>
              ))}
            </div>
          </div>

          {/* Message Timing & Cadence */}
          <div className="p-5 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Clock size={16} className="text-white" />
              </div>
              <h4 className="text-white font-semibold">Message Timing & Cadence</h4>
            </div>
            <p className="text-gray-300 text-sm mb-5">
              Configure delays between messages to optimize engagement
            </p>
            <div className="space-y-6">
              {/* Connection Request Delay */}
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-white">
                      Connection Request Delay
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      Time to wait between sending connection requests
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      className="w-16 bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
                      defaultValue="2"
                      placeholder="2"
                    />
                    <select
                      className="bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                      value={campaignSettings.connection_request_delay || '1-3 hours'}
                      onChange={(e) => setCampaignSettings({...campaignSettings, connection_request_delay: e.target.value})}
                    >
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours ⭐</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Follow-up Message Delay */}
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-white">
                      Follow-up Message Delay
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                      Time to wait between follow-up messages after connection is accepted
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      className="w-16 bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
                      defaultValue="3"
                      placeholder="3"
                    />
                    <select
                      className="bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                      value={campaignSettings.follow_up_delay || '2-3 days'}
                      onChange={(e) => setCampaignSettings({...campaignSettings, follow_up_delay: e.target.value})}
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days ⭐</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Message Templates (Messenger Campaign - 1st degree connections) */}
      {currentStep === 3 && campaignType === 'messenger' && (
        <div className="space-y-6">
          {/* SAM Messaging Generation */}
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Zap className="text-purple-400 mr-2" size={20} />
              <h4 className="text-white font-medium">SAM AI Messaging Generator</h4>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              Let SAM create personalized messaging sequences for your 1st degree connections.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                onClick={() => {
                  setManualConnection('');
                  setManualAlternative('');
                  setManualFollowUps(['']);
                  setShowManualTemplateModal(true);
                }}
              >
                <Edit size={16} className="mr-1" />
                Create Manually
              </button>
              <button
                type="button"
                onClick={() => {
                  setSamMessages([{
                    role: 'assistant',
                    content: `Hi! I'm SAM, and I'll help you create compelling LinkedIn direct messages for your **messenger campaign** "${name}" (for 1st degree connections - already connected).\n\n**Campaign Type:** Messenger - I will generate direct messages for your existing connections. No connection request needed since you're already connected!\n\nI can see you have ${(initialProspects?.length || 0) + csvData.length + selectedProspects.length} prospects who are already 1st degree connections. To create the best direct messaging, tell me:\n\n1. What's your main goal with this campaign? (nurturing relationships, offering services, partnerships, etc.)\n2. What value can you offer these connections?\n3. Any specific tone you'd like? (professional, friendly, consultative, etc.)\n\nLet's create messages that strengthen your relationships! 🎯`
                  }]);
                  setShowSamGenerationModal(true);
                }}
                className="flex items-center px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Zap size={16} className="mr-1" />
                Generate Messaging with SAM
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                onClick={openKBModal}
              >
                <Brain size={16} className="mr-1" />
                Load from Knowledgebase
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 rounded-lg transition-colors"
                onClick={openPreviousMessagesModal}
              >
                <Clock size={16} className="mr-1" />
                Load Previous Messages
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg transition-colors"
                onClick={() => setShowPasteModal(true)}
              >
                <Upload size={16} className="mr-1" />
                Paste Template
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="messenger-initial-message" className="block text-sm font-medium text-gray-400">
              Initial Message
            </label>
            <p className="text-xs text-gray-500">
              First message sent to your 1st degree connections (no connection request needed)
            </p>
            <textarea
              id="messenger-initial-message"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
              rows={4}
              value={alternativeMessage}
              onChange={e => setAlternativeMessage(e.target.value)}
              onFocus={(e) => {
                setActiveField({type: 'alternative'});
                setActiveTextarea(e.target as HTMLTextAreaElement);
              }}
              placeholder="Hi {{first_name}}, I wanted to reach out about..."
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Characters: {alternativeMessage.length}
              </span>
              {alternativeMessage.length > 0 && (
                <button
                  type="button"
                  className="flex items-center px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg transition-colors"
                  onClick={async () => {
                    // Call SAM API directly to improve the message
                    try {
                      toastInfo('SAM is improving your initial message...');

                      const response = await fetch('/api/sam/generate-templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          workspace_id: workspaceId,
                          campaign_name: name,
                          campaign_type: 'messenger',
                          prospect_count: csvData.length,
                          user_input: `Please improve this initial messenger message for 1st degree connections.\n\nCurrent message (${alternativeMessage.length} chars):\n"${alternativeMessage}"\n\nMake it more engaging, personalized, and effective while maintaining personalization placeholders.`,
                          conversation_history: [],
                          prospect_sample: csvData.slice(0, 3)
                        })
                      });

                      if (response.ok) {
                        const result = await response.json();

                        if (result.templates?.initial_message || result.templates?.alternative_message) {
                          const improved = result.templates.initial_message || result.templates.alternative_message;
                          setAlternativeMessage(improved);
                          toastSuccess(`Initial message improved!`);
                        } else {
                          toastError('Could not extract improved message.');
                        }
                      } else {
                        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                        toastError(`Failed to improve message: ${errorData.error || 'Unknown error'}`);
                      }
                    } catch (error) {
                      console.error('Improve initial message error:', error);
                      toastError(`Error improving message: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                  }}
                >
                  <Zap size={12} className="mr-1" />
                  Improve with SAM
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-400">
                6-Step Messaging Sequence (5 Follow-ups)
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Messages 2-6 sent to your 1st degree connections
            </p>

            {followUpMessages.map((message, index) => {
              // Helper function to get message label and requirements
              const getMessageLabel = () => {
                if (index === 0) return 'Message 2 - Must start with "Hello {first_name},"';
                if (index === 4) return 'Message 6 - Goodbye message (no first name)';
                return `Message ${index + 2} (no first name)`;
              };

              const getMessagePlaceholder = () => {
                if (index === 0) return 'Hello {first_name}, [your message here]...';
                if (index === 4) return 'Polite goodbye message leaving door open for future connection...';
                return `Follow-up message ${index + 2}...`;
              };

              return (
                <div key={index} className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-400">
                        {getMessageLabel()}
                      </label>
                      <span className="text-xs text-gray-500">• Wait:</span>
                    </div>
                    <select
                      className="bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                      value={(campaignSettings.message_delays || [])[index] || '2-3 days'}
                      onChange={(e) => updateMessageDelay(index, e.target.value)}
                    >
                      <option value="1 day">1 day</option>
                      <option value="2-3 days">2-3 days</option>
                      <option value="3-5 days">3-5 days</option>
                      <option value="5-7 days">5-7 days</option>
                      <option value="1 week">1 week</option>
                      <option value="2 weeks">2 weeks</option>
                    </select>
                  </div>
                  <textarea
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                    rows={4}
                    value={message}
                    onChange={e => updateFollowUpMessage(index, e.target.value)}
                    onFocus={(e) => {
                      setActiveField({type: 'followup', index});
                      setActiveTextarea(e.target as HTMLTextAreaElement);
                    }}
                    placeholder={getMessagePlaceholder()}
                    data-followup-index={index}
                  />
                  {message.length > 0 && (
                    <div className="flex justify-between items-center mt-2">
                      {/* Remove button */}
                      {followUpMessages.length > 1 && (
                        <button
                          type="button"
                          className="flex items-center px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                          onClick={() => {
                            if (confirm(`Remove Message ${index + 2}?`)) {
                              removeFollowUpMessage(index);
                              toastSuccess(`Message ${index + 2} removed`);
                            }
                          }}
                        >
                          <X size={12} className="mr-1" />
                          Remove
                        </button>
                      )}
                      <div className="flex-grow"></div>
                      <button
                        type="button"
                        className="flex items-center px-2 py-1 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 rounded-lg transition-colors"
                        onClick={async () => {
                          // Call SAM API directly to improve the message
                          try {
                            toastInfo(`SAM is improving message ${index + 2}...`);

                            const messageType = index === 0 ? 'Message 2 (must start with "Hello {first_name},")' :
                                              index === 4 ? 'Message 6 (goodbye message)' :
                                              `Message ${index + 2}`;

                            const response = await fetch('/api/sam/generate-templates', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                workspace_id: workspaceId,
                                campaign_name: name,
                                campaign_type: 'messenger',
                                prospect_count: csvData.length,
                                user_input: `Please improve this follow-up message for messenger campaign (${messageType}). ${index === 0 ? 'It MUST start with "Hello {first_name},"' : index === 4 ? 'This is a goodbye message - keep it polite and leave the door open.' : 'Make it engaging and valuable.'}\n\nCurrent message:\n"${message}"\n\nMake it more effective while maintaining personalization placeholders.`,
                                conversation_history: [],
                                prospect_sample: csvData.slice(0, 3)
                              })
                            });

                            if (response.ok) {
                              const result = await response.json();

                              if (result.templates?.follow_up_messages?.[index]) {
                                const improved = result.templates.follow_up_messages[index];
                                updateFollowUpMessage(index, improved);
                                toastSuccess(`Message ${index + 2} improved!`);
                              } else if (result.templates?.message) {
                                // Fallback to generic message field
                                updateFollowUpMessage(index, result.templates.message);
                                toastSuccess(`Message ${index + 2} improved!`);
                              } else {
                                toastError('Could not extract improved message.');
                              }
                            } else {
                              const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                              toastError(`Failed to improve message: ${errorData.error || 'Unknown error'}`);
                            }
                          } catch (error) {
                            console.error(`Improve messenger follow-up ${index} error:`, error);
                            toastError(`Error improving message: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          }
                        }}
                      >
                        <Zap size={12} className="mr-1" />
                        Improve with SAM
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Follow-Up Message Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={addFollowUpMessage}
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Add Follow-Up Message
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Add additional steps to your messaging sequence (currently {followUpMessages.length} follow-up{followUpMessages.length !== 1 ? 's' : ''})
              </p>
            </div>
          </div>

          <div className="p-5 bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-700/30">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
              <h4 className="text-white font-semibold">Personalization Placeholders</h4>
            </div>
            <p className="text-gray-300 text-sm mb-4">
              Click to insert dynamic fields that auto-fill with prospect data
            </p>
            <div className="flex flex-wrap gap-2">
              {placeholders.map((placeholder) => (
                <button
                  key={placeholder.key}
                  onClick={() => insertPlaceholder(placeholder.key)}
                  className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/50 hover:border-purple-400 rounded-full text-purple-200 text-xs font-medium transition-all hover:scale-105 cursor-pointer"
                  title={placeholder.description}
                >
                  {placeholder.key}
                </button>
              ))}
            </div>
          </div>

          {/* Message Timing & Cadence */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Message Timing & Cadence</h4>
            <p className="text-xs text-gray-500 mb-4">
              Configure delays between messages to optimize engagement
            </p>
            <div className="space-y-4">
              {/* Initial Message Delay (for Messenger campaigns) */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Initial Message Delay
                </label>
                <select
                  className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                  value={campaignSettings.connection_request_delay || '1-3 hours'}
                  onChange={(e) => setCampaignSettings({...campaignSettings, connection_request_delay: e.target.value})}
                >
                  <option value="immediate">Immediate</option>
                  <option value="15-30 minutes">15-30 minutes</option>
                  <option value="1-3 hours">1-3 hours (recommended)</option>
                  <option value="3-6 hours">3-6 hours</option>
                  <option value="6-12 hours">6-12 hours</option>
                  <option value="12-24 hours">12-24 hours</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Time to wait between sending initial messages
                </p>
              </div>

              {/* Follow-up Message Delay */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Follow-up Message Delay
                </label>
                <select
                  className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                  value={campaignSettings.follow_up_delay || '2-3 days'}
                  onChange={(e) => setCampaignSettings({...campaignSettings, follow_up_delay: e.target.value})}
                >
                  <option value="1 day">1 day</option>
                  <option value="2-3 days">2-3 days (recommended)</option>
                  <option value="3-5 days">3-5 days</option>
                  <option value="5-7 days">5-7 days</option>
                  <option value="1 week">1 week</option>
                  <option value="2 weeks">2 weeks</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Time to wait between follow-up messages
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Message Templates (Email Campaign) */}
      {currentStep === 3 && campaignType === 'email' && (
        <div className="space-y-6">
          {/* SAM Messaging Generation */}
          <div className="bg-purple-600/20 border border-purple-500/30 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Zap className="text-purple-400 mr-2" size={20} />
              <h4 className="text-white font-medium">SAM AI Email Sequence Generator</h4>
            </div>
            <p className="text-gray-300 text-sm mb-3">
              Let SAM create personalized email sequences for your outreach campaign.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                onClick={() => {
                  setManualConnection('');
                  setManualAlternative('');
                  setManualFollowUps(['']);
                  setShowManualTemplateModal(true);
                }}
              >
                <Edit size={16} className="mr-1" />
                Create Manually
              </button>
              <button
                type="button"
                onClick={() => {
                  setSamMessages([{
                    role: 'assistant',
                    content: `Hi! I'm SAM, and I'll help you create compelling email sequences for your cold email campaign "${name}".\n\n**Campaign Type:** Email Outreach\n\nI can see you have ${csvData.length} prospects with business emails. To create the best email sequence, tell me:\n\n1. What's your main goal with this campaign? (lead generation, partnerships, sales, etc.)\n2. What value can you offer these prospects?\n3. Any specific tone you'd like? (professional, casual, friendly, etc.)\n\nLet's create emails that get responses! 📧`
                  }]);
                  setShowSamGenerationModal(true);
                }}
                className="flex items-center px-3 py-1.5 text-sm bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                <Zap size={16} className="mr-1" />
                Generate with SAM
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
                onClick={openKBModal}
              >
                <Brain size={16} className="mr-1" />
                Load from KB
              </button>
              <button
                type="button"
                className="flex items-center px-3 py-1.5 text-sm bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-lg transition-colors"
                onClick={() => setShowPasteModal(true)}
              >
                <Upload size={16} className="mr-1" />
                Paste Template
              </button>
            </div>
          </div>

          {/* Initial Email */}
          <div className="space-y-3">
            <label htmlFor="email-initial" className="block text-sm font-medium text-gray-400">
              Initial Email
            </label>
            <p className="text-xs text-gray-500">
              First email sent to your prospects
            </p>

            {/* Subject Line */}
            <div className="space-y-1">
              <label htmlFor="email-initial-subject" className="block text-xs text-gray-500">
                Subject Line
              </label>
              <input
                id="email-initial-subject"
                type="text"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
                value={initialSubject}
                onChange={e => setInitialSubject(e.target.value)}
                placeholder="e.g., Quick question about {{company_name}}"
              />
            </div>

            {/* Email Body */}
            <div className="space-y-1">
              <label htmlFor="email-initial-body" className="block text-xs text-gray-500">
                Email Body
              </label>
              <textarea
                id="email-initial-body"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                rows={6}
                value={alternativeMessage}
                onChange={e => setAlternativeMessage(e.target.value)}
                onFocus={(e) => {
                  setActiveField({type: 'alternative'});
                  setActiveTextarea(e.target as HTMLTextAreaElement);
                }}
                placeholder="Hi {{first_name}},&#10;&#10;I noticed you're at {{company_name}} and thought you might be interested in...&#10;&#10;Would love to connect!"
              />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Characters: {alternativeMessage.length}
              </span>
            </div>
          </div>

          {/* Threading Option */}
          <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="use-threaded-replies"
                checked={useThreadedReplies}
                onChange={e => setUseThreadedReplies(e.target.checked)}
                className="w-4 h-4 text-purple-600 bg-gray-700 border-gray-600 rounded focus:ring-purple-500"
              />
              <div>
                <label htmlFor="use-threaded-replies" className="text-white cursor-pointer">
                  Use threaded replies (RE:)
                </label>
                <p className="text-xs text-gray-400 mt-1">
                  {useThreadedReplies
                    ? `Follow-up emails will use "RE: ${initialSubject || '[Initial Subject]'}" as the subject line`
                    : 'Each follow-up email will have its own unique subject line'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Email Follow-ups */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-400">
                Follow-up Emails ({followUpMessages.length})
              </label>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Automated follow-up sequence
            </p>

            {followUpMessages.map((message, index) => (
              <div key={index} className="mb-4 bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  Follow-up Email {index + 1}
                </label>

                {/* Subject Line for this follow-up (only if not using threaded replies) */}
                {!useThreadedReplies && (
                  <div className="mb-3">
                    <label className="block text-xs text-gray-500 mb-1">
                      Subject Line
                    </label>
                    <input
                      type="text"
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none text-sm"
                      value={followUpSubjects[index] || ''}
                      onChange={e => updateFollowUpSubject(index, e.target.value)}
                      placeholder={`e.g., Following up on my previous email`}
                    />
                  </div>
                )}
                {useThreadedReplies && (
                  <div className="mb-3 text-xs text-gray-500 italic">
                    Subject: RE: {initialSubject || '[Initial Subject]'}
                  </div>
                )}

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">
                      Email Body
                    </label>
                    <textarea
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                      rows={4}
                      value={message}
                      onChange={e => updateFollowUpMessage(index, e.target.value)}
                      onFocus={(e) => {
                        setActiveField({type: 'followup', index});
                        setActiveTextarea(e.target as HTMLTextAreaElement);
                      }}
                      placeholder={`Follow-up email ${index + 1}...`}
                      data-followup-index={index}
                    />
                  </div>
                  <div className="flex flex-col gap-2 justify-center">
                    <span className="text-xs text-gray-400 text-center">Send after</span>
                    <input
                      type="number"
                      min="0"
                      className="w-16 bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
                      defaultValue="3"
                      placeholder="3"
                    />
                    <select
                      className="bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-xs font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                      value={(campaignSettings.message_delays || [])[index] || '2-3 days'}
                      onChange={(e) => updateMessageDelay(index, e.target.value)}
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                    </select>
                  </div>
                </div>
                {message.length > 0 && followUpMessages.length > 1 && (
                  <div className="flex justify-between items-center mt-2">
                    <button
                      type="button"
                      className="flex items-center px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                      onClick={() => {
                        if (confirm(`Remove Follow-up ${index + 1}?`)) {
                          removeFollowUpMessage(index);
                          toastSuccess(`Follow-up ${index + 1} removed`);
                        }
                      }}
                    >
                      <X size={12} className="mr-1" />
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Add Follow-Up Button */}
            <div className="mt-4">
              <button
                type="button"
                onClick={addFollowUpMessage}
                className="flex items-center px-3 py-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors"
              >
                <Plus size={16} className="mr-2" />
                Add Follow-Up Email
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Currently {followUpMessages.length} follow-up{followUpMessages.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Personalization Placeholders */}
          <div className="bg-gray-700 rounded-lg p-4">
            <h4 className="text-white font-medium mb-3">Personalization Placeholders</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {placeholders.map((placeholder) => (
                <button
                  key={placeholder.key}
                  type="button"
                  onClick={() => insertPlaceholder(placeholder.key)}
                  className="text-xs px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  title={placeholder.description}
                >
                  {placeholder.key}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Click any placeholder to insert it into your email
            </p>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={() => {
            // If on Step 3 and we have initialProspects (meaning we skipped Step 2), go back to Step 1
            if (currentStep === 3 && initialProspects && initialProspects.length > 0) {
              setCurrentStep(1);
            } else {
              setCurrentStep(Math.max(1, currentStep - 1));
            }
          }}
          disabled={currentStep === 1}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors"
        >
          Previous
        </button>

        <div className="flex gap-3">
          {currentStep < 3 ? (
            <>
              <button
                type="button"
                onClick={() => {
                  // Validate connection degree for LinkedIn campaigns before proceeding
                  if (currentStep === 1 && (campaignType === 'connector' || campaignType === 'messenger')) {
                    // Check if we have connection degree data
                    if (!hasConnectionDegreeData && csvData.length > 0) {
                      toastError('LinkedIn campaigns require connection degree data. Please add a "Connection Degree" column to your CSV with values like "1st", "2nd", or "3rd", then re-upload.');
                      return;
                    }
                  }

                  // Skip Step 2 if prospects are already loaded from Data Approval
                  if (currentStep === 1 && initialProspects && initialProspects.length > 0) {
                    setCurrentStep(3); // Jump directly to messages
                  } else {
                    setCurrentStep(currentStep + 1);
                  }
                }}
                disabled={currentStep === 2 && !csvData.length && !selectedProspects.length && !initialProspects?.length}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {currentStep === 1 && initialProspects && initialProspects.length > 0
                  ? 'Continue to Messages'
                  : 'Next Step'}
              </button>
              {currentStep === 2 && (
                <button
                  type="button"
                  onClick={() => {
                    // Validate connection degree for LinkedIn campaigns
                    if ((campaignType === 'connector' || campaignType === 'messenger') && !hasConnectionDegreeData) {
                      toastError('LinkedIn campaigns require connection degree data. Cannot proceed without uploading prospects with connection degrees.');
                      return;
                    }
                    setCurrentStep(3);
                  }}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
                  title="Skip prospect data - you can add prospects later"
                >
                  Skip for Now
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={submit}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 font-medium text-white rounded-lg transition-colors"
              >
                Create Campaign
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveDraft(true);
                  toastSuccess('Campaign draft saved successfully');
                }}
                disabled={isSavingDraft || !name.trim()}
                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                {isSavingDraft ? 'Saving...' : 'Save Draft'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (currentStep > 1) {
                // Go back one step
                setCurrentStep(currentStep - 1);
              } else {
                // On step 1, close the modal
                onClose();
              }
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>

      {/* Template Library Modal */}
      {showTemplateLibraryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <FileText size={24} className="text-pink-400" />
                    Load from Template Library
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Select a saved template to load into your campaign
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowTemplateLibraryModal(false);
                    setSelectedTemplate(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {savedTemplates.length === 0 ? (
                <div className="text-center py-12">
                  <FileText size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400 mb-2">No saved templates yet</p>
                  <p className="text-gray-500 text-sm">Templates you save will appear here</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedTemplates.map((template) => (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className={`
                        p-4 rounded-lg border-2 cursor-pointer transition-all
                        ${selectedTemplate?.id === template.id
                          ? 'border-pink-500 bg-pink-900/20'
                          : 'border-gray-600 bg-gray-700/50 hover:border-pink-400 hover:bg-gray-700'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="text-white font-semibold">
                          {template.template_name?.replace('autosave_', '') || 'Untitled Template'}
                        </h4>
                        {selectedTemplate?.id === template.id && (
                          <CheckCircle size={20} className="text-pink-400" />
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mb-3">
                        Updated: {new Date(template.updated_at).toLocaleDateString()}
                      </div>
                      {template.connection_message && (
                        <div className="text-xs text-gray-300 truncate mb-1">
                          <span className="text-gray-500">CR:</span> {template.connection_message.substring(0, 60)}...
                        </div>
                      )}
                      {template.alternative_message && (
                        <div className="text-xs text-gray-300 truncate">
                          <span className="text-gray-500">Alt:</span> {template.alternative_message.substring(0, 60)}...
                        </div>
                      )}
                      {template.follow_up_messages && template.follow_up_messages.length > 0 && (
                        <div className="text-xs text-gray-400 mt-2">
                          {template.follow_up_messages.length} follow-up message(s)
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTemplateLibraryModal(false);
                  setSelectedTemplate(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => applyTemplate(selectedTemplate)}
                disabled={!selectedTemplate}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                Load Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paste Template Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Upload size={24} className="text-green-400" />
                    Paste Message Template
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Paste your message and SAM will <strong className="text-green-400">only add placeholders</strong> (like {"{first_name}"}) - your original wording stays exactly the same
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPasteModal(false);
                    setPastedText('');
                    setParsedPreview(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {!parsedPreview ? (
                /* Input Step */
                <div className="space-y-4">
                  <div>
                    <label htmlFor="paste-text" className="block text-sm font-medium text-gray-300 mb-2">
                      Paste your message template(s)
                    </label>
                    <textarea
                      id="paste-text"
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Example:

Hi Sarah, I noticed you're the VP of Sales at Acme Corp. I'd love to connect and share some insights on outbound automation.

Follow-up: Hey Sarah, wanted to circle back on connecting.

Follow-up 2: Sarah, last attempt - would you be open to a quick chat?"
                      className="w-full min-h-[300px] px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Brain className="text-blue-400 mt-0.5" size={20} />
                      <div className="text-sm text-gray-300">
                        <strong className="text-white">SAM AI will automatically:</strong>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          {campaignType === 'connector' ? (
                            <li>Identify connection messages vs follow-ups</li>
                          ) : (
                            <li>Identify initial message and follow-ups</li>
                          )}
                          <li>Replace names with <code className="text-purple-400">{'{first_name}'}</code></li>
                          <li>Replace companies with <code className="text-purple-400">{'{company_name}'}</code></li>
                          <li>Replace job titles with <code className="text-purple-400">{'{job_title}'}</code></li>
                          <li>Preserve your message tone and structure</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview Step */
                <div className="space-y-4">
                  <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                      <CheckCircle size={20} />
                      <strong>Template parsed successfully!</strong>
                    </div>
                    <p className="text-gray-300 text-sm">
                      Review the parsed messages below. Placeholders have been automatically added.
                    </p>
                  </div>

                  {parsedPreview.connectionMessage && campaignType === 'connector' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Connection Message</label>
                      <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                        <p className="text-white whitespace-pre-wrap">{parsedPreview.connectionMessage}</p>
                      </div>
                    </div>
                  )}

                  {parsedPreview.alternativeMessage && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        {campaignType === 'messenger' ? 'Initial Message' : 'Alternative Message'}
                      </label>
                      <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                        <p className="text-white whitespace-pre-wrap">{parsedPreview.alternativeMessage}</p>
                      </div>
                    </div>
                  )}

                  {parsedPreview.followUpMessages && parsedPreview.followUpMessages.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Follow-up Messages</label>
                      <div className="space-y-3">
                        {parsedPreview.followUpMessages.map((msg, idx) => (
                          <div key={idx} className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                            <div className="text-gray-400 text-xs mb-2">Follow-up {idx + 1}</div>
                            <p className="text-white whitespace-pre-wrap">{msg}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-between">
              <button
                type="button"
                onClick={() => {
                  setShowPasteModal(false);
                  setPastedText('');
                  setParsedPreview(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                {parsedPreview && (
                  <>
                    <button
                      type="button"
                      onClick={() => setParsedPreview(null)}
                      disabled={isImprovingCopy}
                      className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      Back to Edit
                    </button>
                    <button
                      type="button"
                      onClick={improveParsedCopy}
                      disabled={isImprovingCopy}
                      className="flex items-center px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {isImprovingCopy ? (
                        <>
                          <Loader2 size={16} className="mr-1 animate-spin" />
                          Improving...
                        </>
                      ) : (
                        <>
                          <Brain size={16} className="mr-1" />
                          Improve Copy
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={parsedPreview ? applyParsedTemplate : parsePastedTemplate}
                  disabled={isParsing || isImprovingCopy || (!pastedText.trim() && !parsedPreview)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {isParsing ? (
                    <>Processing...</>
                  ) : parsedPreview ? (
                    <>
                      <CheckCircle size={16} className="mr-1" />
                      Apply to Campaign
                    </>
                  ) : (
                    <>
                      <Brain size={16} className="mr-1" />
                      Process with SAM AI
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KB Template Selection Modal */}
      {showKBModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Brain size={24} className="text-blue-400" />
                    Load Template from Knowledge Base
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Select a template from your Messaging & Voice section
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowKBModal(false);
                    setSelectedKBTemplate(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {loadingKBTemplates ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="text-blue-400 animate-spin mb-3" />
                  <p className="text-gray-400">Loading templates...</p>
                </div>
              ) : kbTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain size={48} className="text-gray-500 mb-4" />
                  <p className="text-gray-300 text-lg mb-2">No templates found</p>
                  <p className="text-gray-400 text-sm max-w-md">
                    Add message templates to your Knowledge Base (Messaging & Voice section) to load them here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {kbTemplates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedKBTemplate?.id === template.id
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                      }`}
                      onClick={() => setSelectedKBTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">
                            {template.title || 'Untitled Template'}
                          </h4>
                          {template.metadata?.description && (
                            <p className="text-gray-400 text-sm mb-2">{template.metadata.description}</p>
                          )}
                          <div className="text-gray-500 text-xs">
                            {template.tags && template.tags.length > 0 && (
                              <div className="flex gap-2 mt-2">
                                {template.tags.map((tag: string, idx: number) => (
                                  <span key={idx} className="px-2 py-1 bg-gray-600 rounded text-gray-300">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        {selectedKBTemplate?.id === template.id && (
                          <div className="ml-3 text-blue-400">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowKBModal(false);
                  setSelectedKBTemplate(null);
                }}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => selectedKBTemplate && applyKBTemplate(selectedKBTemplate)}
                disabled={!selectedKBTemplate || isParsing}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isParsing ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    Apply Template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Previous Messages Modal */}
      {showPreviousMessagesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Clock size={24} className="text-orange-400" />
                    Load Previous Messages
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">
                    Choose from your previously created campaigns
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowPreviousMessagesModal(false);
                    setSelectedPreviousCampaign(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 flex-1 overflow-y-auto">
              {loadingPreviousCampaigns ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 size={32} className="text-orange-400 animate-spin mb-3" />
                  <p className="text-gray-400">Loading previous campaigns...</p>
                </div>
              ) : previousCampaigns.length === 0 ? (
                <div className="text-center py-12">
                  <Clock size={48} className="text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">No previous campaigns with messages found</p>
                  <p className="text-gray-500 text-sm mb-3">
                    Create a campaign with connection messages or follow-ups to see them here
                  </p>
                  <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 max-w-md mx-auto text-left">
                    <p className="text-blue-300 text-xs">
                      <strong>💡 Tip:</strong> Messages are automatically saved when you:
                    </p>
                    <ul className="text-blue-400 text-xs mt-2 space-y-1 list-disc list-inside">
                      <li>Complete Step 3 (Messages) in campaign creation</li>
                      <li>Save a campaign with connection/follow-up messages</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {previousCampaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${
                        selectedPreviousCampaign?.id === campaign.id
                          ? 'border-orange-500 bg-orange-500/10'
                          : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                      }`}
                      onClick={() => setSelectedPreviousCampaign(campaign)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">{campaign.name || 'Untitled Campaign'}</h4>
                          <p className="text-gray-400 text-sm mb-2">
                            Type: {getCampaignTypeLabel(campaign.type || 'connector')}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {campaign.connection_message && (
                              <span className="flex items-center gap-1">
                                <MessageCircle size={12} />
                                Connection msg
                              </span>
                            )}
                            {campaign.alternative_message && (
                              <span className="flex items-center gap-1">
                                <MessageSquare size={12} />
                                Alternative msg
                              </span>
                            )}
                            {campaign.follow_up_messages && campaign.follow_up_messages.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Send size={12} />
                                {campaign.follow_up_messages.length} follow-up{campaign.follow_up_messages.length !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedPreviousCampaign?.id === campaign.id && (
                          <div className="ml-3 text-orange-400">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-700 flex justify-between">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowPreviousMessagesModal(false);
                  setSelectedPreviousCampaign(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => selectedPreviousCampaign && applyPreviousCampaignMessages(selectedPreviousCampaign)}
                disabled={!selectedPreviousCampaign}
                className="bg-orange-600 hover:bg-orange-700"
              >
                <CheckCircle size={16} className="mr-2" />
                Apply Messages
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Template Creation Modal */}
      {showManualTemplateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Edit size={24} className="text-gray-400" />
                    Create Message Templates
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">Manually create your campaign messaging sequence</p>
                </div>
                <button onClick={() => setShowManualTemplateModal(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Connection Message (Connector campaigns only) */}
              {campaignType === 'connector' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Connection Request Message (275 char max)
                  </label>
                  <textarea
                    value={manualConnection}
                    onChange={(e) => setManualConnection(e.target.value.slice(0, 275))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white min-h-[100px]"
                    placeholder="Hi {first_name}, I noticed your work at {company_name}..."
                  />
                  <div className="text-right text-sm text-gray-400 mt-1">{manualConnection.length}/275</div>
                </div>
              )}

              {/* Initial/Alternative Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {campaignType === 'messenger' ? 'Initial Message' : 'Alternative Message (for 1st connections)'}
                </label>
                <p className="text-xs text-gray-500 mb-2">
                  {campaignType === 'messenger'
                    ? 'First message sent to your 1st degree connections'
                    : 'Message sent to prospects who are already 1st degree connections'}
                </p>
                <textarea
                  value={manualAlternative}
                  onChange={(e) => setManualAlternative(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white min-h-[100px]"
                  placeholder={campaignType === 'messenger'
                    ? "Hi {first_name}, I wanted to reach out about..."
                    : "Hi {first_name}, thanks for being connected..."}
                />
              </div>

              {/* Follow-up Messages */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Follow-up Messages</label>
                {manualFollowUps.map((msg, idx) => (
                  <div key={idx} className="mb-3">
                    <div className="flex items-start gap-2">
                      <textarea
                        value={msg}
                        onChange={(e) => {
                          const updated = [...manualFollowUps];
                          updated[idx] = e.target.value;
                          setManualFollowUps(updated);
                        }}
                        className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white min-h-[80px]"
                        placeholder={`Follow-up message ${idx + 1}...`}
                      />
                      {manualFollowUps.length > 1 && (
                        <button
                          onClick={() => setManualFollowUps(manualFollowUps.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-300 p-2"
                        >
                          <X size={20} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setManualFollowUps([...manualFollowUps, ''])}
                  className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  + Add Follow-up
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors" onClick={() => setShowManualTemplateModal(false)}>Cancel</button>
              <button
                type="button"
                onClick={() => {
                  // Only set connection message for Connector campaigns
                  if (campaignType === 'connector') {
                    setConnectionMessage(manualConnection);
                  }
                  setAlternativeMessage(manualAlternative);
                  setFollowUpMessages(manualFollowUps.filter(m => m.trim()));
                  setShowManualTemplateModal(false);
                  toastSuccess('Templates applied to campaign!');
                }}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <CheckCircle size={16} className="mr-2" />
                Apply Templates
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAM Generation Modal */}
      {showSamGenerationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Zap size={24} className="text-purple-400" />
                    Generate Messaging with SAM
                  </h3>
                  <p className="text-gray-400 text-sm mt-1">AI-powered messaging sequence creation for your campaign</p>
                </div>
                <button onClick={() => setShowSamGenerationModal(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              <div className="relative">
                <div ref={chatContainerRef} onScroll={handleChatScroll} className="h-96 overflow-y-auto mb-4 space-y-3 scroll-smooth">
                  {samMessages.map((message, index) => (
                    <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] p-3 rounded-lg ${message.role === 'user' ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-100'}`}>
                        <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      </div>
                    </div>
                  ))}
                  {isGeneratingTemplates && (
                    <div className="flex justify-start">
                      <div className="bg-gray-600 text-gray-100 p-3 rounded-lg">
                        <div className="text-sm">SAM is creating your templates...</div>
                      </div>
                    </div>
                  )}
                </div>

                {showScrollButton && (
                  <button onClick={scrollToBottom} className="absolute bottom-6 right-4 bg-purple-600 hover:bg-purple-700 text-white rounded-full p-2 shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={samInput}
                  onChange={e => setSamInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && sendSamMessage()}
                  placeholder="Tell SAM about your campaign goals..."
                  className="flex-1 px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                />
                <button type="button" onClick={sendSamMessage} disabled={isGeneratingTemplates || !samInput.trim()} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Submit
                </button>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button type="button" className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors" onClick={() => setShowSamGenerationModal(false)}>Cancel</button>
              <button
                type="button"
                onClick={() => {
                  applySamTemplates();
                  setShowSamGenerationModal(false);
                }}
                className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={samMessages.length < 3}
              >
                <CheckCircle size={16} className="mr-2" />
                Apply Templates
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

interface CampaignHubProps {
  workspaceId?: string | null;
  initialProspects?: any[] | null;
  initialCampaignType?: 'email' | 'linkedin';
  onCampaignCreated?: () => void;
}

const CampaignHub: React.FC<CampaignHubProps> = ({ workspaceId, initialProspects, initialCampaignType, onCampaignCreated }) => {
  // Use workspaceId from props - no fallback to prevent loading wrong workspace data
  const actualWorkspaceId = workspaceId;

  console.log('🏢 [CAMPAIGN HUB MAIN] Workspace ID being used:', actualWorkspaceId, 'from prop:', workspaceId);

  const [showBuilder, setShowBuilder] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showFullFeatures, setShowFullFeatures] = useState(false);
  const [showApprovalScreen, setShowApprovalScreen] = useState(false);
  const [campaignDataForApproval, setCampaignDataForApproval] = useState<any>(null);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedCampaignProspects, setSelectedCampaignProspects] = useState<any[] | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<any>(null);

  // Track when campaign was created from initialProspects to prevent showing in Campaign Creator
  const [campaignCreatedFromInitial, setCampaignCreatedFromInitial] = useState(false);

  // Multi-select state
  const [selectedCampaigns, setSelectedCampaigns] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);

  // Account connection wizards state (for CampaignBuilder)
  const [showUnipileWizard, setShowUnipileWizard] = useState(false);
  const [unipileProvider, setUnipileProvider] = useState<'LINKEDIN' | 'GOOGLE' | 'OUTLOOK'>('LINKEDIN');
  const [connectedAccounts, setConnectedAccounts] = useState({
    linkedin: false,
    email: false
  });

  // Check connected accounts on mount
  useEffect(() => {
    const checkConnectedAccounts = async () => {
      try {
        const response = await fetch(`/api/workspace-accounts/check?workspace_id=${actualWorkspaceId}`);
        const data = await response.json();

        if (data.success) {
          setConnectedAccounts({
            linkedin: data.linkedin_connected || false,
            email: data.email_connected || false
          });
        }
      } catch (error) {
        console.error('Failed to check connected accounts:', error);
      }
    };

    if (actualWorkspaceId) {
      checkConnectedAccounts();
    }
  }, [actualWorkspaceId]);

  const queryClient = useQueryClient();

  // Fetch user's saved timezone preference
  const [userTimezone, setUserTimezone] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserTimezone = async () => {
      try {
        const response = await fetch('/api/user/get-timezone');
        if (response.ok) {
          const data = await response.json();
          setUserTimezone(data.timezone);
        }
      } catch (error) {
        console.error('Failed to fetch user timezone:', error);
      }
    };
    fetchUserTimezone();
  }, []);

  // Fetch workspace data to get client_code
  const { data: workspaceData } = useQuery({
    queryKey: ['workspace', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return null;
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, client_code')
        .eq('id', actualWorkspaceId)
        .single();
      if (error) {
        console.error('Failed to fetch workspace:', error);
        return null;
      }
      return data;
    },
    enabled: !!actualWorkspaceId
  });

  // Auto-open pending approvals toggle (stored in localStorage)
  const [autoOpenApprovals, setAutoOpenApprovals] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('autoOpenApprovals');
      return saved !== null ? saved === 'true' : true; // Default to true
    }
    return true;
  });

  // Don't auto-open builder - show Pending Approval section instead
  // Users will click "Draft Messages" to open builder for each campaign
  // useEffect(() => {
  //   if (initialProspects && initialProspects.length > 0) {
  //     setShowBuilder(true);
  //   }
  // }, [initialProspects]);

  // Save auto-open preference to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('autoOpenApprovals', autoOpenApprovals.toString());
    }
  }, [autoOpenApprovals]);

  // Campaign filter state
  const [campaignFilter, setCampaignFilter] = useState<'active' | 'paused' | 'archived' | 'completed' | 'pending' | 'draft'>('active');

  // REACT QUERY: Fetch pending campaigns with caching - LAZY LOAD when tab is active
  const { data: pendingCampaignsFromDB = [], isLoading: loadingPendingFromDB } = useQuery({
    queryKey: ['pendingCampaigns', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];

      // Use new optimized approved prospects API
      const response = await fetch(`/api/prospect-approval/approved?workspace_id=${actualWorkspaceId}`);
      if (!response.ok) return [];

      const data = await response.json();
      if (!data.success || !data.prospects) return [];

      // Group approved prospects by campaign name
      const campaignGroups: Record<string, any> = {};

      for (const prospect of data.prospects) {
        const campaignName = prospect.prospect_approval_sessions?.campaign_name || `Session-${prospect.session_id?.slice(0, 8)}`;

        if (!campaignGroups[campaignName]) {
          campaignGroups[campaignName] = {
            campaignName,
            campaignTag: prospect.prospect_approval_sessions?.campaign_tag || prospect.prospect_approval_sessions?.prospect_source || 'linkedin',
            sessionId: prospect.session_id,
            prospects: [],
            createdAt: prospect.created_at
          };
        }

        // Split name into first and last
        const nameParts = (prospect.name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        campaignGroups[campaignName].prospects.push({
          id: prospect.prospect_id,
          prospect_id: prospect.prospect_id, // CRITICAL: Also include as prospect_id for API compatibility
          name: prospect.name,
          first_name: firstName,
          last_name: lastName,
          title: prospect.title || '',
          company: prospect.company?.name || '',
          company_name: prospect.company?.name || '',
          email: prospect.contact?.email || '',
          linkedin_url: prospect.contact?.linkedin_url || prospect.linkedin_url || '', // Check both locations
          phone: prospect.contact?.phone || '',
          industry: prospect.company?.industry?.[0] || '',
          location: prospect.location || '',
          campaignTag: prospect.prospect_approval_sessions?.campaign_tag || prospect.prospect_approval_sessions?.campaign_name || 'linkedin'
        });
      }

      // Convert to array sorted by creation date
      const campaigns = Object.values(campaignGroups).sort((a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return campaigns;
    },
    enabled: campaignFilter === 'pending' && !!workspaceId, // Only fetch when Pending tab is active
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // REACT QUERY: Fetch draft campaigns with caching - LAZY LOAD when tab is active
  const { data: draftCampaigns = [], isLoading: loadingDrafts } = useQuery({
    queryKey: ['draftCampaigns', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) return [];

      const response = await fetch(`/api/campaigns/draft?workspaceId=${actualWorkspaceId}`);
      if (!response.ok) return [];

      const result = await response.json();
      return result.drafts || [];
    },
    enabled: campaignFilter === 'draft', // Only fetch when Draft tab is active
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });

  // REACT QUERY: Fetch all campaigns (active, inactive, archived)
  const { data: allCampaigns = [], isLoading: loadingAllCampaigns } = useQuery({
    queryKey: ['campaigns', actualWorkspaceId],
    queryFn: async () => {
      if (!actualWorkspaceId) {
        console.log('📡 [CAMPAIGN HUB MAIN] No workspace ID, returning empty');
        return [];
      }

      console.log('📡 [CAMPAIGN HUB MAIN] Fetching campaigns for workspace:', actualWorkspaceId);
      const response = await fetch(`/api/campaigns?workspace_id=${actualWorkspaceId}`);
      console.log('📡 [CAMPAIGN HUB MAIN] Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [CAMPAIGN HUB MAIN] Failed to load campaigns:', response.statusText, errorText);
        return [];
      }

      const result = await response.json();
      // API returns { success: true, data: { campaigns: [...] } } via apiSuccess()
      const campaigns = result.data?.campaigns || result.campaigns || [];
      console.log('✅ [CAMPAIGN HUB MAIN] Fetched campaigns:', {
        count: campaigns.length,
        names: campaigns.map((c: any) => c.name)
      });
      return campaigns;
    },
    enabled: (campaignFilter === 'active' || campaignFilter === 'inactive' || campaignFilter === 'archived' || campaignFilter === 'completed') && !!actualWorkspaceId,
    staleTime: 0, // Always fetch fresh - campaigns change frequently
    gcTime: 0, // Don't cache stale data
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  // Load approval messages when approval tab is selected
  useEffect(() => {
    if (campaignFilter === 'approval' && approvalMessages.pending.length === 0) {
      loadApprovalMessages();
    }
  }, [campaignFilter]);

  // Modal states for campaign management features
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showCampaignCloning, setShowCampaignCloning] = useState(false);
  const [showMessageApproval, setShowMessageApproval] = useState(false);
  const [showScheduledCampaigns, setShowScheduledCampaigns] = useState(false);
  const [showABTesting, setShowABTesting] = useState(false);
  const [showCampaignSettings, setShowCampaignSettings] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [showStepsEditor, setShowStepsEditor] = useState(false);
  const [selectedMessageForReview, setSelectedMessageForReview] = useState<any>(null);
  const [showCampaignProspects, setShowCampaignProspects] = useState(false);
  const [selectedCampaignForProspects, setSelectedCampaignForProspects] = useState<string | null>(null);

  // State for message preview and edit modals - matching CampaignList component
  const [showMessagePreview, setShowMessagePreview] = useState(false);
  const [selectedCampaignForMessages, setSelectedCampaignForMessages] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [campaignToEdit, setCampaignToEdit] = useState<any>(null);
  const [editFormData, setEditFormData] = useState<any>({});

  // Editable campaign settings state
  const [editedCampaignSettings, setEditedCampaignSettings] = useState<any>({
    name: '',
    daily_connection_limit: 15,
    daily_follow_up_limit: 20,
    use_priority: true,
    priority: 'medium',
    start_immediately: true,
    scheduled_start: null,
    allow_same_company: false,
    allow_duplicate_emails: false,
    skip_bounced_emails: true
  });
  const [campaignSettingsChanged, setCampaignSettingsChanged] = useState(false);

  // Campaign cloning state
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDescription, setNewCampaignDescription] = useState('');
  const [cloneProspects, setCloneProspects] = useState(false);
  const [cloneTemplates, setCloneTemplates] = useState(true);
  const [cloneSettings, setCloneSettings] = useState(true);
  const [isCloning, setIsCloning] = useState(false);

  // Scheduled campaigns state
  const [selectedScheduleCampaign, setSelectedScheduleCampaign] = useState('');
  const [scheduleStartTime, setScheduleStartTime] = useState('');
  const [scheduleEndTime, setScheduleEndTime] = useState('');
  const [scheduleNotes, setScheduleNotes] = useState('');

  // A/B Testing state
  const [testName, setTestName] = useState('');
  const [testType, setTestType] = useState('connection_message');
  const [variantA, setVariantA] = useState('');
  const [variantB, setVariantB] = useState('');
  const [sampleSize, setSampleSize] = useState(100);
  const [splitRatio, setSplitRatio] = useState('50/50');
  const [testDuration, setTestDuration] = useState(7);

  // Campaign Settings state
  const [campaignSettings, setCampaignSettings] = useState<any>({
    connection_request_delay: '1-3 hours',
    follow_up_delay: '2-3 days',
    max_messages_per_day: 20,
    preferred_send_times: ['9-11 AM', '1-3 PM'],
    active_days: ['Monday-Friday'],
    timezone: 'ET (Eastern Time)',
    auto_insert_company_name: true,
    use_job_title: true,
    include_industry_insights: false,
    reference_mutual_connections: false,
    daily_connection_limit: 100,
    respect_do_not_contact: true,
    auto_pause_high_rejection: true,
    require_message_approval: false
  });
  const [settingsChanged, setSettingsChanged] = useState(false);

  // Track if campaign creation is in progress to prevent duplicate submissions
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false);

  // Handle campaign approval and execution
  const handleApproveCampaign = async (finalCampaignData: any) => {
    // CRITICAL FIX (Nov 26): Prevent duplicate campaign creation from double-clicks
    if (isCreatingCampaign) {
      console.log('⚠️ Campaign creation already in progress - ignoring duplicate call');
      return;
    }
    setIsCreatingCampaign(true);

    console.log('🚀 [FIX DEPLOYED] handleApproveCampaign called - v2 with null checks');
    try {
      const { _executionData } = finalCampaignData;

      // Determine campaign type (needed for LinkedIn ID sync logic)
      const approvedCampaignType = _executionData?.campaignType || finalCampaignData.type || 'connector';

      // Extract session_id from prospects (for auto-transfer of approved prospects)
      const sessionId = finalCampaignData.prospects?.[0]?.sessionId || initialProspects?.[0]?.sessionId;

      // Step 1: Create campaign with 'inactive' status (ready to activate)
      console.log('🎯 [APPROVE CAMPAIGN] Creating campaign with workspace_id:', actualWorkspaceId);

      const campaignResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: actualWorkspaceId,
          name: finalCampaignData.name,
          campaign_type: approvedCampaignType,
          status: 'active', // Set to active after user approves in modal so it can execute immediately
          session_id: sessionId, // CRITICAL: Pass session_id to auto-transfer approved prospects
          // MESSENGER: Use direct_message_1/2/3 (no CR)
          // CONNECTOR: Use connection_request + follow_ups
          message_templates: approvedCampaignType === 'messenger' ? {
            direct_message_1: finalCampaignData.messages.connection_request, // First message (no CR for messenger)
            direct_message_2: finalCampaignData.messages.follow_up_1,
            direct_message_3: finalCampaignData.messages.follow_up_2,
            direct_message_4: finalCampaignData.messages.follow_up_3,
            direct_message_5: finalCampaignData.messages.follow_up_4
          } : {
            connection_request: finalCampaignData.messages.connection_request,
            alternative_message: _executionData?.alternativeMessage || finalCampaignData.messages.follow_up_1,
            follow_up_messages: [
              finalCampaignData.messages.follow_up_1,
              finalCampaignData.messages.follow_up_2,
              finalCampaignData.messages.follow_up_3,
              finalCampaignData.messages.follow_up_4,
              finalCampaignData.messages.follow_up_5
            ].filter(msg => msg?.trim())
          },
          // Include message timing/cadence for dynamic N8N scheduling
          message_delays: finalCampaignData.message_delays || _executionData?.message_delays || ['2-3 days', '3-5 days', '5-7 days', '1 week', '2 weeks'],
          // Timing preferences - use user-selected values from approval modal
          timezone: finalCampaignData.timezone || 'America/New_York',
          working_hours_start: finalCampaignData.working_hours_start ?? 7,
          working_hours_end: finalCampaignData.working_hours_end ?? 18,
          skip_weekends: finalCampaignData.skip_weekends ?? true,
          skip_holidays: finalCampaignData.skip_holidays ?? true,
          country_code: 'US'       // For holiday calendar
        })
      });

      if (!campaignResponse.ok) {
        const errorData = await campaignResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create campaign');
      }

      const campaignData = await campaignResponse.json();
      console.log('🔍 DEBUG: Campaign API Response:', {
        hasCampaign: !!campaignData.campaign,
        hasDataCampaign: !!campaignData.data?.campaign,
        hasCampaignId: !!campaignData.campaign_id,
        hasError: !!campaignData.error,
        keys: Object.keys(campaignData),
        fullResponse: campaignData
      });

      // Handle case where API returned an error despite 201 status
      if (campaignData.error && !campaignData.campaign && !campaignData.data?.campaign) {
        console.warn('⚠️ API returned error with 201 status:', campaignData.error);
        // Still try to recover using campaign_id if provided
      }

      // Handle case where campaign was created but not returned
      // CRITICAL FIX: API returns { data: { campaign } }, not { campaign }
      let campaign = campaignData.campaign || campaignData.data?.campaign;

      if (!campaign && campaignData.campaign_id) {
        // Campaign was created but not returned - try to fetch it
        console.log('⚠️ Campaign created but not returned, attempting to fetch:', campaignData.campaign_id);
        try {
          const fetchResponse = await fetch(`/api/campaigns/${campaignData.campaign_id}`);
          if (fetchResponse.ok) {
            const fetchData = await fetchResponse.json();
            campaign = fetchData.campaign || fetchData;

            // CRITICAL FIX: campaign_performance_summary uses campaign_id instead of id
            // Normalize to always have id field
            if (campaign && !campaign.id && campaign.campaign_id) {
              campaign.id = campaign.campaign_id;
            }
          }
        } catch (fetchError) {
          console.error('Failed to fetch campaign:', fetchError);
        }

        if (!campaign) {
          throw new Error('Campaign created but could not be loaded. Please refresh the page and check your Campaigns list.');
        }
      }

      // CRITICAL: Normalize campaign_id to id field (some endpoints use campaign_id)
      if (campaign && !campaign.id && campaign.campaign_id) {
        campaign.id = campaign.campaign_id;
      }

      if (!campaign) {
        throw new Error('No campaign data returned from API');
      }

      console.log('✅ DEBUG: Campaign object verified:', {
        id: campaign.id,
        name: campaign.name,
        hasId: !!campaign.id
      });

      // Step 2: Upload prospects (with proper schema mapping)
      console.log('🔍 DEBUG: finalCampaignData.prospects BEFORE mapping:', JSON.stringify(finalCampaignData.prospects.slice(0, 2), null, 2));

      const mappedProspects = finalCampaignData.prospects.map((prospect: any, index: number) => {
        const mapped = {
          // Handle both workspace_prospects schema and other schemas
          first_name: prospect.first_name || (prospect.name ? prospect.name.split(' ')[0] : ''),
          last_name: prospect.last_name || (prospect.name ? prospect.name.split(' ').slice(1).join(' ') : ''),
          name: prospect.name || `${prospect.first_name || ''} ${prospect.last_name || ''}`.trim(),
          email: prospect.email || prospect.email_address || prospect.contact?.email,
          company: prospect.company?.name || prospect.company_name || prospect.company || '',
          title: prospect.title || prospect.job_title,
          linkedin_url: prospect.linkedin_url || prospect.linkedin_profile_url || prospect.contact?.linkedin_url,
          linkedin_user_id: prospect.linkedin_user_id,
          connection_degree: prospect.connection_degree || prospect.degree,
          sessionId: prospect.sessionId
        };

        if (index < 2) {
          console.log(`🔍 DEBUG: Prospect ${index + 1} AFTER mapping:`, {
            name: mapped.name,
            linkedin_url: mapped.linkedin_url,
            had_linkedin_url: !!prospect.linkedin_url,
            had_linkedin_profile_url: !!prospect.linkedin_profile_url,
            had_contact_linkedin_url: !!prospect.contact?.linkedin_url,
            raw_contact: prospect.contact
          });
        }

        return mapped;
      });

      // CRITICAL: Verify campaign.id exists before uploading prospects
      if (!campaign.id) {
        console.error('❌ CRITICAL: campaign.id is undefined!', {
          campaign,
          campaignKeys: Object.keys(campaign || {}),
          campaignData
        });
        throw new Error('Campaign ID is missing. Cannot upload prospects.');
      }

      console.log('🔍 DEBUG: About to send to /api/campaigns/upload-prospects:', {
        campaign_id: campaign.id,
        prospect_count: mappedProspects.length,
        first_two_prospects: mappedProspects.slice(0, 2).map(p => ({
          name: p.name,
          linkedin_url: p.linkedin_url,
          company: p.company
        }))
      });

      const uploadResponse = await fetch('/api/campaigns/upload-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: campaign.id,
          prospects: mappedProspects
        })
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({}));
        console.error('❌ Upload prospects failed:', {
          status: uploadResponse.status,
          statusText: uploadResponse.statusText,
          errorData,
          campaign_id_sent: campaign.id,
          campaign_object: campaign
        });
        throw new Error(errorData.error || `Failed to upload prospects: ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();

      // Calculate connection degrees for these prospects
      const prospectDegrees = mappedProspects.map((p: any) => {
        const degree = p.connection_degree || p.degree || 'unknown';
        return degree.toLowerCase().includes('1st') ? '1st' :
               (degree.toLowerCase().includes('2nd') || degree.toLowerCase().includes('3rd')) ? '2nd/3rd' : 'unknown';
      });
      const firstDegreeCount = prospectDegrees.filter((d: string) => d === '1st').length;
      const secondThirdCount = prospectDegrees.filter((d: string) => d === '2nd/3rd').length;
      const hasOnly1stDegreeLocal = firstDegreeCount > 0 && secondThirdCount === 0;

      // Step 2.5: Auto-sync LinkedIn IDs for MESSENGER campaigns (1st degree connections only)
      let syncedCount = 0;
      if (uploadResult.prospects_with_linkedin_ids === 0 && hasOnly1stDegreeLocal && campaignType === 'messenger') {
        console.log('🔄 Auto-syncing LinkedIn IDs for 1st degree connections (Messenger campaign)...');

        try {
          const syncResponse = await fetch('/api/campaigns/sync-linkedin-ids', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: campaign.id,
              workspaceId: workspaceId
            })
          });

          if (syncResponse.ok) {
            const syncResult = await syncResponse.json();
            syncedCount = syncResult.resolved || 0;
            console.log(`✅ Synced ${syncedCount} LinkedIn IDs from message history`);
          } else {
            console.warn('⚠️ LinkedIn ID sync failed, will need manual resolution');
          }
        } catch (error) {
          console.error('LinkedIn ID sync error:', error);
          // Continue anyway - user can manually resolve later
        }
      }

      // Update prospects count to include synced IDs
      const totalProspectsWithIds = uploadResult.prospects_with_linkedin_ids + syncedCount;

      // Step 3: AUTOMATED EXECUTION - Execute campaign automatically for ALL approved campaigns
      // Queue-based Unipile integration (30 min spacing) - no workflow engine needed
      // CRITICAL FIX: Use correct endpoint based on campaign type
      const executeEndpoint = approvedCampaignType === 'messenger'
        ? '/api/campaigns/direct/send-messages-queued'
        : '/api/campaigns/direct/send-connection-requests-fast';

      console.log(`🚀 Executing ${approvedCampaignType} campaign via ${executeEndpoint}`);

      if (mappedProspects.length > 0) {
        try {
          const executeResponse = await fetch(executeEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              campaignId: campaign.id
            })
          });

          if (executeResponse.ok) {
            const executeResult = await executeResponse.json();
            const syncMessage = syncedCount > 0
              ? `\n🔗 ${syncedCount} LinkedIn IDs auto-resolved from message history`
              : '';

            // Check if all prospects were skipped (duplicates or failed)
            if (executeResult.queued === 0 && executeResult.skipped > 0) {
              toastWarning(`⚠️ Campaign "${finalCampaignData.name}" created but cannot launch!\n\n❌ All ${executeResult.skipped} prospects were skipped:\n${executeResult.skipped_details?.slice(0, 3).map((s: any) => `   • ${s.reason}`).join('\n') || '   • Duplicate or already in another campaign'}\n\n💡 Solution: Upload new prospects who haven't been contacted before`);
            } else if (executeResult.skipped > 0) {
              // Some prospects queued, some skipped
              toastWarning(`✅ Campaign "${finalCampaignData.name}" launched with warnings!\n\n✅ ${executeResult.queued} prospects queued\n⚠️ ${executeResult.skipped} prospects skipped (duplicates)${syncMessage}\n\n💡 Check campaign dashboard for details`);
            } else {
              // All prospects queued successfully
              toastSuccess(`✅ Campaign "${finalCampaignData.name}" approved and launched successfully!\n\n📊 ${mappedProspects.length} prospects uploaded${syncMessage}\n🚀 Your campaign is now live and messages will be sent according to your schedule`);
            }
          } else {
            const errorData = await executeResponse.json();
            const errorDetails = errorData.details ? `\n🔍 Details: ${errorData.details}` : '';
            toastError(`✅ Campaign "${finalCampaignData.name}" created!\n⚠️ Launch failed: ${errorData.error || 'Unknown error'}${errorDetails}\n💡 Check campaign dashboard for details`);
          }
        } catch (executeError) {
          console.error('Campaign execution error:', executeError);
          toastError(`✅ Campaign "${finalCampaignData.name}" created!\n⚠️ Failed to launch campaign\n💡 You can manually launch from campaign dashboard`);
        }
      }
      // Old conditional execution logic removed - now executes automatically above

      // Save user's timezone preference to their profile (for future campaigns)
      if (finalCampaignData.timezone) {
        try {
          await fetch('/api/user/update-timezone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timezone: finalCampaignData.timezone })
          });
          console.log(`✅ Saved timezone preference: ${finalCampaignData.timezone}`);
        } catch (timezoneError) {
          console.error('Failed to save timezone preference:', timezoneError);
          // Don't throw - campaign was created successfully
        }
      }

      // Mark approval session as completed if prospects came from approval flow
      const approvalSessionId = mappedProspects[0]?.sessionId || initialProspects?.[0]?.sessionId;
      if (approvalSessionId) {
        try {
          await fetch('/api/prospect-approval/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: approvalSessionId })
          });
          console.log(`✅ Marked approval session ${approvalSessionId} as completed`);
        } catch (error) {
          console.error('Failed to complete session:', error);
          // Don't throw - campaign was created successfully
        }
      }

      // AUTO-SAVE: Save campaign messages as a reusable template
      try {
        await fetch('/api/messaging-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: actualWorkspaceId,
            template_name: `${finalCampaignData.name} - Template`,
            campaign_type: approvedCampaignType,
            connection_message: finalCampaignData.messages.connection_request || '',
            alternative_message: finalCampaignData.messages.follow_up_1 || '',
            follow_up_messages: [
              finalCampaignData.messages.follow_up_2,
              finalCampaignData.messages.follow_up_3,
              finalCampaignData.messages.follow_up_4,
              finalCampaignData.messages.follow_up_5
            ].filter(msg => msg?.trim())
          })
        });
        console.log(`✅ Auto-saved campaign messages as template: "${finalCampaignData.name} - Template"`);
      } catch (error) {
        console.error('Failed to auto-save template:', error);
        // Don't throw - campaign was created successfully
      }

      // Reset and close approval screen
      setShowApprovalScreen(false);
      setCampaignDataForApproval(null);
      setShowBuilder(false);

      // CRITICAL FIX (Nov 26): Mark that campaign was created from initialProspects
      // This prevents the campaign from showing in BOTH Campaign Creator AND Active Campaigns
      setCampaignCreatedFromInitial(true);

      // Invalidate caches to refresh campaign lists and counters
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ['pendingCampaigns'] });

      // CRITICAL FIX (Nov 23): Switch to Active Campaigns tab AND trigger refresh event
      setCampaignFilter('active');

      // Dispatch custom event to force refresh in CampaignList component
      window.dispatchEvent(new CustomEvent('refreshCampaigns'));

      onCampaignCreated?.();

    } catch (error) {
      console.error('Campaign approval error:', error);
      toastError(`Error: ${error instanceof Error ? error.message : 'Failed to execute campaign'}`);
    } finally {
      // Reset the creating flag so user can retry if needed
      setIsCreatingCampaign(false);
    }
  };

  // Load templates when modal opens
  // REACT QUERY: Load templates
  const { data: templates = [], isLoading: loadingTemplates, refetch: refetchTemplates } = useQuery({
    queryKey: ['campaignTemplates'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns/templates');
      if (!response.ok) return [];
      const result = await response.json();
      return result.templates || [];
    },
    enabled: showTemplateLibrary,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const openTemplateLibrary = () => {
    setShowTemplateLibrary(true);
  };

  // REACT QUERY: Load campaigns for cloning
  const { data: campaignsForCloning = [], refetch: refetchCampaignsForCloning } = useQuery({
    queryKey: ['campaignsForCloning'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) return [];
      const result = await response.json();
      return result.campaigns || [];
    },
    enabled: showCampaignCloning || showScheduledCampaigns || showABTesting,
    staleTime: 5 * 60 * 1000,
  });

  const openCampaignCloning = () => {
    setShowCampaignCloning(true);
    // Reset form
    setSelectedCampaignId('');
    setNewCampaignName('');
    setNewCampaignDescription('');
    setCloneProspects(false);
    setCloneTemplates(true);
    setCloneSettings(true);
  };

  const handleCloneCampaign = async () => {
    if (!selectedCampaignId || !newCampaignName.trim()) {
      toastError('Please select a campaign and enter a new campaign name');
      return;
    }

    setIsCloning(true);
    try {
      const response = await fetch('/api/campaigns/clone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source_campaign_id: selectedCampaignId,
          new_name: newCampaignName.trim(),
          new_description: newCampaignDescription.trim() || undefined,
          clone_prospects: cloneProspects,
          clone_templates: cloneTemplates,
          clone_settings: cloneSettings
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess(`Campaign "${result.cloned_campaign.name}" cloned successfully!`);
        setShowCampaignCloning(false);
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
        queryClient.invalidateQueries({ queryKey: ['campaignsForCloning'] });
      } else {
        const error = await response.json();
        toastError(`Failed to clone campaign: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to clone campaign:', error);
      toastError('Failed to clone campaign. Please try again.');
    } finally {
      setIsCloning(false);
    }
  };

  // REACT QUERY: Load approval messages
  const { data: approvalData, isLoading: loadingApproval, refetch: refetchApprovalMessages } = useQuery({
    queryKey: ['approvalMessages', actualWorkspaceId],
    queryFn: async () => {
      // Return empty data if no actualWorkspaceId - prevents crash
      if (!actualWorkspaceId) {
        return {
          messages: { pending: [], approved: [], rejected: [] },
          counts: { pending: 0, approved: 0, rejected: 0, total: 0 }
        };
      }

      const response = await fetch(`/api/campaigns/messages/approval?workspace_id=${actualWorkspaceId}`);

      // Graceful error handling - don't crash the page
      if (!response.ok) {
        console.error('Failed to load approval messages:', response.statusText);
        return {
          messages: { pending: [], approved: [], rejected: [] },
          counts: { pending: 0, approved: 0, rejected: 0, total: 0 }
        };
      }

      const result = await response.json();

      // Transform the data to include campaign_name from joined campaigns table
      const transformMessages = (messages: any[]) => messages.map(msg => ({
        ...msg,
        campaign_name: msg.campaigns?.name || msg.campaign_name || 'Unknown Campaign',
        message_content: msg.message_text || msg.message_content || '',
        step_number: msg.sequence_step || msg.step_number || 1
      }));

      const transformed = {
        pending: transformMessages(result.grouped?.pending || []),
        approved: transformMessages(result.grouped?.approved || []),
        rejected: transformMessages(result.grouped?.rejected || [])
      };

      return {
        messages: transformed,
        counts: result.counts || { pending: 0, approved: 0, rejected: 0, total: 0 }
      };
    },
    enabled: showMessageApproval && !!workspaceId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });

  const approvalMessages = approvalData?.messages || { pending: [], approved: [], rejected: [] };
  const approvalCounts = approvalData?.counts || { pending: 0, approved: 0, rejected: 0, total: 0 };

  // Auto-open approval screen if there are pending approvals and toggle is enabled
  useEffect(() => {
    if (autoOpenApprovals && approvalCounts.pending > 0) {
      setShowMessageApproval(true);
    }
  }, [autoOpenApprovals, approvalCounts.pending]);

  const openMessageApproval = () => {
    setShowMessageApproval(true);
  };

  const handleApproveMessage = async (messageId: string) => {
    try {
      const response = await fetch('/api/campaigns/messages/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'approve',
          message_id: messageId
        })
      });

      if (response.ok) {
        // Invalidate and refetch approval messages
        queryClient.invalidateQueries({ queryKey: ['approvalMessages'] });
      } else {
        const error = await response.json();
        toastError(`Failed to approve message: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to approve message:', error);
      toastError('Failed to approve message. Please try again.');
    }
  };

  const handleRejectMessage = async (messageId: string, reason?: string) => {
    try {
      const response = await fetch('/api/campaigns/messages/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'reject',
          message_id: messageId,
          rejection_reason: reason || 'Message rejected'
        })
      });

      if (response.ok) {
        // Invalidate and refetch approval messages
        queryClient.invalidateQueries({ queryKey: ['approvalMessages'] });
      } else {
        const error = await response.json();
        toastError(`Failed to reject message: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to reject message:', error);
      toastError('Failed to reject message. Please try again.');
    }
  };

  // REACT QUERY: Load campaign prospects
  const { data: campaignProspects = [], isLoading: loadingProspects } = useQuery({
    queryKey: ['campaignProspects', selectedCampaignForProspects],
    queryFn: async () => {
      if (!selectedCampaignForProspects) return [];
      const response = await fetch(`/api/campaigns/${selectedCampaignForProspects}/prospects`);
      if (!response.ok) throw new Error('Failed to load campaign prospects');
      const result = await response.json();
      return result.prospects || [];
    },
    enabled: !!selectedCampaignForProspects && showCampaignProspects,
    staleTime: 0, // Force fresh data every time
  });

  const loadCampaignProspects = (campaignId: string) => {
    setSelectedCampaignForProspects(campaignId);
    setShowCampaignProspects(true);
  };

  const handleBulkApproval = async (action: 'approve' | 'reject') => {
    const messageIds = approvalMessages.pending.map((msg: any) => msg.id);
    if (messageIds.length === 0) {
      toastError('No pending messages to approve');
      return;
    }

    try {
      const response = await fetch('/api/campaigns/messages/approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: action === 'approve' ? 'bulk_approve' : 'bulk_reject',
          message_ids: messageIds,
          rejection_reason: action === 'reject' ? 'Bulk rejection' : undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess(result.message);
        // Invalidate and refetch approval messages
        queryClient.invalidateQueries({ queryKey: ['approvalMessages'] });
      } else {
        const error = await response.json();
        toastError(`Failed to ${action} messages: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} messages:`, error);
      toastError(`Failed to ${action} messages. Please try again.`);
    }
  };

  // REACT QUERY: Load scheduled campaigns
  const { data: scheduledData, isLoading: loadingSchedules } = useQuery({
    queryKey: ['scheduledCampaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns/schedule');
      if (response.ok) {
        const result = await response.json();
        return {
          campaigns: result.grouped || { upcoming: [], active: [], completed: [], cancelled: [] },
          counts: result.counts || { upcoming: 0, active: 0, completed: 0, cancelled: 0, total: 0 }
        };
      }
      // Return empty data on error - no fake data
      return {
        campaigns: { upcoming: [], active: [], completed: [], cancelled: [] },
        counts: { upcoming: 0, active: 0, completed: 0, cancelled: 0, total: 0 }
      };
    },
    enabled: showScheduledCampaigns,
    staleTime: 5 * 60 * 1000,
  });

  const scheduledCampaigns = scheduledData?.campaigns || { upcoming: [], active: [], completed: [], cancelled: [] };
  const scheduleCounts = scheduledData?.counts || { upcoming: 0, active: 0, completed: 0, cancelled: 0, total: 0 };

  const openScheduledCampaigns = () => {
    setShowScheduledCampaigns(true);
    // Reset form
    setSelectedScheduleCampaign('');
    setScheduleStartTime('');
    setScheduleEndTime('');
    setScheduleNotes('');
  };

  const handleScheduleCampaign = async () => {
    if (!selectedScheduleCampaign || !scheduleStartTime) {
      toastError('Please select a campaign and start time');
      return;
    }

    try {
      const response = await fetch('/api/campaigns/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaign_id: selectedScheduleCampaign,
          scheduled_start_time: scheduleStartTime,
          scheduled_end_time: scheduleEndTime || undefined,
          notes: scheduleNotes || undefined
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess(`Campaign "${result.campaign.name}" scheduled successfully!`);
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['scheduledCampaigns'] });
        // Reset form
        setSelectedScheduleCampaign('');
        setScheduleStartTime('');
        setScheduleEndTime('');
        setScheduleNotes('');
      } else {
        const error = await response.json();
        toastError(`Failed to schedule campaign: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to schedule campaign:', error);
      toastError('Failed to schedule campaign. Please try again.');
    }
  };

  const handleScheduleAction = async (scheduleId: string, action: string) => {
    try {
      const response = await fetch('/api/campaigns/schedule', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schedule_id: scheduleId,
          action: action
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess(result.message);
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['scheduledCampaigns'] });
      } else {
        const error = await response.json();
        toastError(`Failed to ${action} schedule: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} schedule:`, error);
      toastError(`Failed to ${action} schedule. Please try again.`);
    }
  };

  // REACT QUERY: Load A/B tests
  const { data: abTestData, isLoading: loadingABTests } = useQuery({
    queryKey: ['abTests'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns/ab-testing');
      const result = await response.json();
      return {
        tests: result.grouped || { active: [], completed: [], paused: [], stopped: [] },
        counts: result.counts || { active: 0, completed: 0, paused: 0, stopped: 0, total: 0 }
      };
    },
    enabled: showABTesting,
    staleTime: 5 * 60 * 1000,
  });

  const abTests = abTestData?.tests || { active: [], completed: [], paused: [], stopped: [] };
  const abTestCounts = abTestData?.counts || { active: 0, completed: 0, paused: 0, stopped: 0, total: 0 };

  const openABTesting = () => {
    setShowABTesting(true);
    // Reset form
    setTestName('');
    setTestType('connection_message');
    setVariantA('');
    setVariantB('');
    setSampleSize(100);
    setSplitRatio('50/50');
    setTestDuration(7);
  };

  const handleCreateABTest = async () => {
    if (!testName || !variantA || !variantB || !selectedCampaignId) {
      toastError('Please fill in all required fields');
      return;
    }

    try {
      const response = await fetch('/api/campaigns/ab-testing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_name: testName,
          test_type: testType,
          campaign_id: selectedCampaignId,
          duration_days: testDuration,
          sample_size: sampleSize,
          split_ratio: splitRatio,
          variants: [
            { variant_name: 'A', content: variantA },
            { variant_name: 'B', content: variantB }
          ]
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess(`A/B test "${result.test.test_name}" created successfully!`);
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['abTests'] });
        // Reset form
        setTestName('');
        setVariantA('');
        setVariantB('');
        setSelectedCampaignId('');
      } else {
        const error = await response.json();
        toastError(`Failed to create A/B test: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to create A/B test:', error);
      toastError('Failed to create A/B test. Please try again.');
    }
  };

  const handleABTestAction = async (testId: string, action: string) => {
    try {
      const response = await fetch('/api/campaigns/ab-testing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_id: testId,
          action: action
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess(result.message);
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['abTests'] });
      } else {
        const error = await response.json();
        toastError(`Failed to ${action} test: ${error.error}`);
      }
    } catch (error) {
      console.error(`Failed to ${action} test:`, error);
      toastError(`Failed to ${action} test. Please try again.`);
    }
  };

  // REACT QUERY: Load campaign settings
  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['campaignSettings'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns/settings?scope=workspace');
      const result = await response.json();
      return result.settings;
    },
    enabled: showCampaignSettings,
    staleTime: 10 * 60 * 1000,
    onSuccess: (data) => {
      if (data) {
        setCampaignSettings(data);
        setSettingsChanged(false);
      }
    },
  });

  const openCampaignSettings = () => {
    setShowCampaignSettings(true);
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/campaigns/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scope: 'workspace',
          ...campaignSettings
        })
      });

      if (response.ok) {
        const result = await response.json();
        toastSuccess('Campaign settings saved successfully!');
        setCampaignSettings(result.settings);
        setSettingsChanged(false);
        // Invalidate and refetch
        queryClient.invalidateQueries({ queryKey: ['campaignSettings'] });
      } else {
        const error = await response.json();
        toastError(`Failed to save settings: ${error.error}`);
      }
    } catch (error) {
      console.error('Failed to save campaign settings:', error);
      toastError('Failed to save settings. Please try again.');
    }
  };

  const updateSetting = (key: string, value: any) => {
    setCampaignSettings({
      ...campaignSettings,
      [key]: value
    });
    setSettingsChanged(true);
  };

  const handleCheckboxArrayChange = (key: string, value: string, checked: boolean) => {
    const currentValues = campaignSettings[key] || [];
    let newValues;
    
    if (checked) {
      newValues = [...currentValues, value];
    } else {
      newValues = currentValues.filter((v: string) => v !== value);
    }
    
    updateSetting(key, newValues);
  };

  // Check if we're in "auto-create mode" (prospects from approval)
  const isAutoCreateMode = initialProspects && initialProspects.length > 0 && showBuilder;

  // Filter campaigns based on selected tab
  const filteredCampaigns = allCampaigns.filter((c: any) => {
    if (campaignFilter === 'active') return c.status === 'active';
    if (campaignFilter === 'paused') return c.status === 'paused' || c.status === 'inactive' || c.status === 'scheduled'; // Paused/inactive/scheduled campaigns
    if (campaignFilter === 'completed') return c.status === 'completed' || c.status === 'archived'; // Campaigns that finished their sequence
    return true;
  });

  // DEBUG: Log campaign data
  console.log('🔍 CampaignHub Debug:', {
    campaignFilter,
    allCampaignsCount: allCampaigns.length,
    filteredCampaignsCount: filteredCampaigns.length,
    loadingAllCampaigns,
    allCampaignsData: allCampaigns.map(c => ({ id: c.id, name: c.name, status: c.status }))
  });

  // Calculate counts for each tab
  const activeCampaignsCount = allCampaigns.filter((c: any) => c.status === 'active').length;
  const pausedCampaignsCount = allCampaigns.filter((c: any) => c.status === 'paused' || c.status === 'inactive' || c.status === 'scheduled').length;
  const completedCampaignsCount = allCampaigns.filter((c: any) => c.status === 'completed' || c.status === 'archived').length;

  // Handle campaign action menu (open settings)
  const handleCampaignAction = (campaignId: string) => {
    console.log('Opening settings for campaign:', campaignId);
    const campaign = allCampaigns.find((c: any) => c.id === campaignId);
    setSelectedCampaign(campaign || null);

    // Initialize editable settings from campaign data
    if (campaign) {
      const execPrefs = campaign.execution_preferences || {};
      setEditedCampaignSettings({
        name: campaign.name || '',
        daily_connection_limit: execPrefs.daily_connection_limit || 15,
        daily_follow_up_limit: execPrefs.daily_follow_up_limit || 20,
        use_priority: execPrefs.use_priority !== false,
        priority: execPrefs.priority || 'medium',
        start_immediately: execPrefs.start_immediately !== false,
        scheduled_start: execPrefs.scheduled_start || null,
        timezone: campaign.timezone || 'America/New_York',
        working_hours_start: campaign.working_hours_start || 7,
        working_hours_end: campaign.working_hours_end || 18,
        skip_weekends: campaign.skip_weekends !== false,
        skip_holidays: campaign.skip_holidays !== false,
        country_code: campaign.country_code || 'US',
        allow_same_company: execPrefs.allow_same_company || false,
        allow_duplicate_emails: execPrefs.allow_duplicate_emails || false,
        skip_bounced_emails: execPrefs.skip_bounced_emails !== false
      });
      setCampaignSettingsChanged(false);
    }

    setShowCampaignSettings(true);
  };

  // Handler for viewing prospects
  const viewProspects = (campaignId: string) => {
    console.log('👥 View Prospects clicked:', campaignId);

    if (!campaignId) {
      toastError('Invalid campaign ID');
      return;
    }

    setSelectedCampaignForProspects(campaignId);
    setShowCampaignProspects(true);
  };

  // Handler for showing campaign analytics
  const showCampaignAnalytics = (campaignId: string) => {
    console.log('📊 Analytics clicked:', campaignId);
    // TODO: Open analytics modal or navigate to analytics view
    toastInfo(`Analytics for campaign ${campaignId} - Coming soon!`);
  };

  // Handler for editing campaign
  const editCampaign = (campaign: any) => {
    console.log('🎯 Edit campaign clicked:', campaign);

    // Validate campaign data
    if (!campaign || !campaign.id) {
      toastError('Invalid campaign data');
      return;
    }

    // Check if campaign is active - must pause first
    if (campaign.status === 'active') {
      toastWarning('Cannot edit an active campaign. Pause it first.');
      return;
    }

    // If messages have been sent, show info but allow editing
    if (campaign.sent && campaign.sent > 0) {
      toastInfo(`⚠️ ${campaign.sent} messages already sent. Changes will only affect future messages.`);
    }

    console.log('✅ Opening edit modal for campaign:', campaign.id);
    console.log('📧 Campaign data:', {
      campaign_type: campaign.campaign_type,
      direct_connection: campaign.connection_message,
      template_connection: campaign.message_templates?.connection_request,
      direct_alternative: campaign.alternative_message,
      template_alternative: campaign.message_templates?.alternative_message,
      direct_followups: campaign.follow_up_messages,
      template_followups: campaign.message_templates?.follow_up_messages
    });

    setCampaignToEdit(campaign);

    const isEmailCampaign = campaign.campaign_type === 'email';

    // Email campaigns use email_body field, LinkedIn uses connection_request
    const emailBody = isEmailCampaign
      ? (campaign.message_templates?.email_body || campaign.message_templates?.alternative_message || '')
      : '';

    const connectionMessage = isEmailCampaign
      ? ''
      : (campaign.connection_message || campaign.message_templates?.connection_request || '');

    const alternativeMessage = isEmailCampaign
      ? ''
      : (campaign.alternative_message || campaign.message_templates?.alternative_message || '');

    // Load from message_templates if direct fields are empty
    setEditFormData({
      name: campaign.name || '',
      connection_message: connectionMessage,
      alternative_message: alternativeMessage,
      // NEW: email_body field for email campaigns
      email_body: emailBody,
      follow_up_messages: campaign.follow_up_messages?.length > 0
        ? campaign.follow_up_messages
        : (campaign.message_templates?.follow_up_messages || []),
      // Email subject lines
      initial_subject: campaign.message_templates?.initial_subject || '',
      follow_up_subjects: campaign.message_templates?.follow_up_subjects || [],
      use_threaded_replies: campaign.message_templates?.use_threaded_replies || false,
      timing: campaign.timing || {}
    });
    setShowEditModal(true);
  };

  // Handler for saving campaign edits
  const handleSaveCampaignEdit = async () => {
    if (!campaignToEdit) return;

    try {
      const isEmailCampaign = campaignToEdit.campaign_type === 'email';

      // Build message_templates - email uses email_body, LinkedIn uses connection_request
      const message_templates = {
        // LinkedIn fields - empty for email campaigns
        connection_request: isEmailCampaign ? '' : (editFormData.connection_message || ''),
        alternative_message: isEmailCampaign ? '' : (editFormData.alternative_message || ''),
        // Email field - empty for LinkedIn campaigns
        email_body: isEmailCampaign ? (editFormData.email_body || '') : '',
        // Shared fields
        follow_up_messages: editFormData.follow_up_messages || [],
        initial_subject: editFormData.initial_subject || '',
        follow_up_subjects: editFormData.follow_up_subjects || [],
        use_threaded_replies: editFormData.use_threaded_replies || false
      };

      const updatePayload = {
        name: editFormData.name,
        connection_message: isEmailCampaign ? '' : editFormData.connection_message,
        alternative_message: isEmailCampaign ? '' : editFormData.alternative_message,
        follow_up_messages: editFormData.follow_up_messages,
        message_templates
      };

      const response = await fetch(`/api/campaigns/${campaignToEdit.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload)
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }

      toastSuccess('Campaign updated successfully!');
      setShowEditModal(false);
      setCampaignToEdit(null);

      // Refresh campaigns list
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    } catch (error) {
      console.error('Error updating campaign:', error);
      toastError('Failed to update campaign');
    }
  };

  // Handler for toggling campaign status (pause/resume)
  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';

      console.log(`🔄 Toggling campaign ${campaignId} from ${currentStatus} to ${newStatus}`);

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update campaign status');
      }

      toastSuccess(`Campaign ${newStatus === 'active' ? 'resumed' : 'paused'} successfully`);

      // Refresh campaigns list
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    } catch (error) {
      console.error('Error toggling campaign status:', error);
      toastError('Failed to update campaign status');
    }
  };

  // Handler for archiving campaign
  const archiveCampaign = async (campaignId: string, campaignName: string) => {
    try {
      // Confirm before archiving
      const confirmed = window.confirm(
        `Archive campaign "${campaignName}"?\n\nThis will move the campaign to the Completed tab. You can still view it later.`
      );

      if (!confirmed) return;

      console.log(`📦 Archiving campaign ${campaignId}`);

      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' })
      });

      if (!response.ok) {
        throw new Error('Failed to archive campaign');
      }

      toastSuccess('Campaign archived successfully');

      // Refresh campaigns list
      queryClient.invalidateQueries({ queryKey: ['campaigns', workspaceId] });
    } catch (error) {
      console.error('Error archiving campaign:', error);
      toastError('Failed to archive campaign');
    }
  };

  // Multi-select handlers
  const toggleCampaignSelection = (campaignId: string) => {
    setSelectedCampaigns(prev => {
      const newSet = new Set(prev);
      if (newSet.has(campaignId)) {
        newSet.delete(campaignId);
      } else {
        newSet.add(campaignId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = (campaigns: any[]) => {
    if (selectedCampaigns.size === campaigns.length) {
      setSelectedCampaigns(new Set());
    } else {
      setSelectedCampaigns(new Set(campaigns.map((c: any) => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedCampaigns(new Set());
  };

  const handleBulkPause = async () => {
    if (selectedCampaigns.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedCampaigns).map(campaignId =>
          fetch(`/api/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paused' })
          })
        )
      );

      toastSuccess(`Paused ${selectedCampaigns.size} campaign(s)`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    } catch (error) {
      console.error('Failed to pause campaigns:', error);
      toastError('Failed to pause some campaigns');
    }
  };

  const handleBulkResume = async () => {
    if (selectedCampaigns.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedCampaigns).map(campaignId =>
          fetch(`/api/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'active' })
          })
        )
      );

      toastSuccess(`Resumed ${selectedCampaigns.size} campaign(s)`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    } catch (error) {
      console.error('Failed to resume campaigns:', error);
      toastError('Failed to resume some campaigns');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCampaigns.size === 0) return;

    const confirmDelete = window.confirm(
      `Delete ${selectedCampaigns.size} campaign(s)? This cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      await Promise.all(
        Array.from(selectedCampaigns).map(campaignId =>
          fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' })
        )
      );

      toastSuccess(`Deleted ${selectedCampaigns.size} campaign(s)`);
      clearSelection();
      queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
    } catch (error) {
      console.error('Failed to delete campaigns:', error);
      toastError('Failed to delete some campaigns');
    }
  };

  // Handle campaign setting changes
  const handleCampaignSettingChange = (field: string, value: any) => {
    setEditedCampaignSettings((prev: any) => ({
      ...prev,
      [field]: value
    }));
    setCampaignSettingsChanged(true);
  };

  // Save campaign settings
  const handleSaveCampaignSettings = async () => {
    if (!selectedCampaign) return;

    try {
      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedCampaignSettings.name,
          timezone: editedCampaignSettings.timezone,
          working_hours_start: editedCampaignSettings.working_hours_start,
          working_hours_end: editedCampaignSettings.working_hours_end,
          skip_weekends: editedCampaignSettings.skip_weekends,
          skip_holidays: editedCampaignSettings.skip_holidays,
          country_code: editedCampaignSettings.country_code,
          execution_preferences: {
            daily_connection_limit: editedCampaignSettings.daily_connection_limit,
            daily_follow_up_limit: editedCampaignSettings.daily_follow_up_limit,
            use_priority: editedCampaignSettings.use_priority,
            priority: editedCampaignSettings.priority,
            start_immediately: editedCampaignSettings.start_immediately,
            scheduled_start: editedCampaignSettings.scheduled_start,
            allow_same_company: editedCampaignSettings.allow_same_company,
            allow_duplicate_emails: editedCampaignSettings.allow_duplicate_emails,
            skip_bounced_emails: editedCampaignSettings.skip_bounced_emails
          }
        })
      });

      if (response.ok) {
        toastSuccess('Campaign settings saved successfully!');
        setCampaignSettingsChanged(false);

        // Update local campaign object
        setSelectedCampaign({
          ...selectedCampaign,
          name: editedCampaignSettings.name,
          timezone: editedCampaignSettings.timezone,
          working_hours_start: editedCampaignSettings.working_hours_start,
          working_hours_end: editedCampaignSettings.working_hours_end,
          skip_weekends: editedCampaignSettings.skip_weekends,
          skip_holidays: editedCampaignSettings.skip_holidays,
          country_code: editedCampaignSettings.country_code,
          execution_preferences: {
            daily_connection_limit: editedCampaignSettings.daily_connection_limit,
            daily_follow_up_limit: editedCampaignSettings.daily_follow_up_limit,
            use_priority: editedCampaignSettings.use_priority,
            priority: editedCampaignSettings.priority,
            start_immediately: editedCampaignSettings.start_immediately,
            scheduled_start: editedCampaignSettings.scheduled_start,
            allow_same_company: editedCampaignSettings.allow_same_company,
            allow_duplicate_emails: editedCampaignSettings.allow_duplicate_emails,
            skip_bounced_emails: editedCampaignSettings.skip_bounced_emails
          }
        });

        // Refresh campaigns list
        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });

        // Close modal after successful save
        setTimeout(() => {
          setShowCampaignSettings(false);
          setSelectedCampaign(null);
        }, 500); // Small delay to let user see success toast
      } else {
        const error = await response.json();
        toastError(`Failed to save settings: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Campaign settings save error:', error);
      toastError('Failed to save campaign settings');
    }
  };
  const campaignName = initialProspects?.[0]?.campaignName || initialProspects?.[0]?.campaignTag || 'New Campaign';

  return (
    <div className="h-full">
      {/* Main Campaign Hub Content - Full Width */}
      <div className="h-full overflow-y-auto">
      {/* Header - Different for auto-create mode */}
      {isAutoCreateMode ? (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{
                  rotate: [0, 360],
                  scale: [1, 1.1, 1]
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/50"
              >
                <Target className="text-white" size={20} />
              </motion.div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-600 bg-clip-text text-transparent">
                  Creating Campaign: {campaignName}
                </h1>
                <p className="text-gray-300 text-sm mt-1">{initialProspects.length} approved prospects ready to launch</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFullFeatures(!showFullFeatures)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg transition-colors text-sm shadow-lg"
            >
              {showFullFeatures ? (
                <>
                  <Eye className="w-4 h-4" />
                  Hide Full Hub
                </>
              ) : (
                <>
                  <Grid3x3 className="w-4 h-4" />
                  Show Full Hub
                </>
              )}
            </motion.button>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/40 rounded-xl p-4 flex items-center gap-3 backdrop-blur-sm shadow-lg shadow-purple-500/10"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <CheckCircle className="text-green-400" size={20} />
            </motion.div>
            <div className="flex-1">
              <p className="text-white text-sm font-semibold">Prospects Loaded from Prospect Database</p>
              <p className="text-gray-300 text-xs mt-1">Add your message templates below to complete the campaign setup</p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}

      <div className="w-full space-y-8">

        {/* Campaign Approval Screen */}
        {showApprovalScreen && campaignDataForApproval && (
          <CampaignApprovalScreen
            campaignData={campaignDataForApproval}
            workspaceId={actualWorkspaceId}
            userTimezone={userTimezone}
            onApprove={async (finalCampaignData) => {
              // Execute campaign creation and N8N trigger
              await handleApproveCampaign(finalCampaignData);
            }}
            onReject={() => {
              // Go back to campaign builder
              setShowApprovalScreen(false);
              setCampaignDataForApproval(null);
            }}
            onRequestSAMHelp={(context) => {
              // TODO: Trigger main SAM chat with context
              console.log('SAM help requested:', context);
              toastError(`SAM help requested. Context: ${context}\n\nThis will open the main chat window with SAM ready to help you draft your message.`);
            }}
          />
        )}

        {/* Campaign Builder Modal */}
        {showBuilder && !showApprovalScreen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-6xl max-h-[95vh] overflow-y-auto">
              <CampaignBuilder
                onClose={() => {
                  setShowBuilder(false);
                  setSelectedCampaignProspects(null); // Clear selected campaign prospects
                  setSelectedDraft(null); // Clear selected draft
                  setCampaignFilter('paused'); // Switch to Paused tab to show approved campaign
                  onCampaignCreated?.();
                }}
                initialProspects={selectedCampaignProspects || initialProspects}
                initialCampaignType={initialCampaignType}
                draftToLoad={selectedDraft}
                onPrepareForApproval={(campaignData) => {
                  setCampaignDataForApproval(campaignData);
                  setShowApprovalScreen(true);
                }}
                workspaceId={actualWorkspaceId}
                clientCode={workspaceData?.client_code || null}
                connectedAccounts={connectedAccounts}
                setConnectedAccounts={setConnectedAccounts}
                setShowUnipileWizard={setShowUnipileWizard}
                setUnipileProvider={setUnipileProvider}
              />
            </div>
          </div>
        )}

        {/* Campaign List with Tabs */}
        {!showBuilder && !showApprovalScreen && (!isAutoCreateMode || showFullFeatures) && (
          <div>
            {/* Status Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setCampaignFilter('active')}
                className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  campaignFilter === 'active'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Active
                {activeCampaignsCount > 0 && (
                  <span className="px-2 py-0.5 bg-green-600 text-white text-xs rounded-full">
                    {activeCampaignsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCampaignFilter('paused')}
                className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  campaignFilter === 'paused'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Paused
                {pausedCampaignsCount > 0 && (
                  <span className="px-2 py-0.5 bg-gray-600 text-white text-xs rounded-full">
                    {pausedCampaignsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCampaignFilter('completed')}
                className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  campaignFilter === 'completed'
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Completed
                {completedCampaignsCount > 0 && (
                  <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                    {completedCampaignsCount}
                  </span>
                )}
              </button>
              {/* Campaign Creator Tab - Shows campaigns with approved prospects */}
              <button
                onClick={() => setCampaignFilter('pending')}
                className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  campaignFilter === 'pending'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Campaign Creator
                {/* CRITICAL FIX (Nov 26): Don't count initialProspects if campaign was created from them */}
                {((!campaignCreatedFromInitial ? (initialProspects?.filter(p => p.approvalStatus === 'approved').length || 0) : 0) + pendingCampaignsFromDB.length) > 0 && (
                  <span className="px-2 py-0.5 bg-yellow-600 text-white text-xs rounded-full">
                    {(!campaignCreatedFromInitial ? (initialProspects?.filter(p => p.approvalStatus === 'approved').length || 0) : 0) + pendingCampaignsFromDB.length}
                  </span>
                )}
              </button>
              {/* Draft Tab - Shows saved draft campaigns */}
              <button
                onClick={() => setCampaignFilter('draft')}
                className={`px-6 py-3 text-sm font-medium transition-colors flex items-center gap-2 ${
                  campaignFilter === 'draft'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText size={16} />
                Drafts
                {draftCampaigns.length > 0 && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
                    {draftCampaigns.length}
                  </span>
                )}
              </button>
            </div>

            {/* Conditional Content: Campaign Table OR Pending Campaigns Table OR Draft Campaigns Table */}
            {campaignFilter === 'draft' ? (
              /* Draft Campaigns Table - Saved incomplete campaigns */
              <div className="overflow-x-auto">
                {loadingDrafts ? (
                  <div className="text-center py-12">
                    <div className="text-gray-400">Loading drafts...</div>
                  </div>
                ) : draftCampaigns.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto text-gray-400 mb-4" size={48} />
                    <div className="text-white font-medium mb-2">No draft campaigns</div>
                    <div className="text-gray-400">Start creating a campaign and it will auto-save as a draft.</div>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-750">
                      <tr className="text-left text-gray-400 text-xs uppercase">
                        <th className="px-6 py-3 font-medium">Campaign</th>
                        <th className="px-6 py-3 font-medium">Type</th>
                        <th className="px-6 py-3 font-medium">Progress</th>
                        <th className="px-6 py-3 font-medium">Last Saved</th>
                        <th className="px-6 py-3 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draftCampaigns.map((draft: any) => (
                        <tr
                          key={draft.id}
                          onClick={() => {
                            // Load draft into builder
                            setSelectedDraft(draft);
                            setShowBuilder(true);
                          }}
                          className="border-b border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                              <div>
                                <div className="text-white font-medium">{draft.name}</div>
                                <div className="text-gray-400 text-sm">Draft campaign</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-gray-300">{getCampaignTypeLabel(draft.type)}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div className="text-white">Step {draft.current_step || 1} of 3</div>
                              <div className="w-20 bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-500 h-2 rounded-full transition-all"
                                  style={{ width: `${((draft.current_step || 1) / 3) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-gray-400 text-sm">
                              {new Date(draft.updated_at).toLocaleDateString()} {new Date(draft.updated_at).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (confirm(`Delete draft "${draft.name}"?`)) {
                                  try {
                                    const response = await fetch(
                                      `/api/campaigns/draft?draftId=${draft.id}&workspaceId=${workspaceId}`,
                                      { method: 'DELETE' }
                                    );
                                    if (response.ok) {
                                      // Clear currentDraftId if this was the active draft
                                      if (currentDraftId === draft.id) {
                                        setCurrentDraftId(null);
                                      }
                                      // Clear localStorage draft to prevent restore message
                                      try {
                                        localStorage.removeItem(`campaign-draft-${workspaceId}`);
                                      } catch (e) {
                                        console.warn('Failed to clear localStorage draft:', e);
                                      }
                                      queryClient.invalidateQueries({ queryKey: ['draftCampaigns'] });
                                      toastSuccess('Draft deleted');
                                    }
                                  } catch (error) {
                                    toastError('Failed to delete draft');
                                  }
                                }
                              }}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Delete draft"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : campaignFilter === 'pending' ? (
              /* Pending Campaigns Table - Campaigns with approved prospects waiting for messages */
              <div className="overflow-x-auto">
                {(() => {
                  // Merge temp initialProspects and persistent DB campaigns
                  const allCampaigns: any[] = [];

                  // Add temp campaigns from initialProspects - ONLY APPROVED ONES
                  // CRITICAL FIX (Nov 26): Skip if campaign was already created from these prospects
                  if (initialProspects && initialProspects.length > 0 && !campaignCreatedFromInitial) {
                    const approvedProspects = initialProspects.filter(p => p.approvalStatus === 'approved');
                    const campaignGroups = approvedProspects.reduce((acc: any, prospect: any) => {
                      const campaignName = prospect.campaignName || prospect.campaignTag || 'Unnamed Campaign';
                      if (!acc[campaignName]) {
                        acc[campaignName] = { campaignName, prospects: [], source: 'temp', createdAt: new Date() };
                      }
                      acc[campaignName].prospects.push(prospect);
                      return acc;
                    }, {});
                    allCampaigns.push(...Object.values(campaignGroups));
                  }

                  // Add persistent campaigns from DB (avoid duplicates)
                  pendingCampaignsFromDB.forEach(dbCampaign => {
                    if (!allCampaigns.find(c => c.campaignName === dbCampaign.campaignName)) {
                      allCampaigns.push({ ...dbCampaign, source: 'database' });
                    }
                  });

                  if (loadingPendingFromDB && allCampaigns.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="text-gray-400">Loading pending campaigns...</div>
                      </div>
                    );
                  }

                  if (allCampaigns.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <CheckCircle className="mx-auto text-green-400 mb-4" size={48} />
                        <div className="text-white font-medium mb-2">No pending campaigns</div>
                        <div className="text-gray-400">Approve prospects in Prospect Database to create campaigns.</div>
                      </div>
                    );
                  }

                  return (
                    <table className="w-full">
                      <thead className="bg-gray-750">
                        <tr className="text-left text-gray-400 text-xs uppercase">
                          <th className="px-6 py-3 font-medium">Campaign</th>
                          <th className="px-6 py-3 font-medium">Source</th>
                          <th className="px-6 py-3 font-medium">Prospects</th>
                          <th className="px-6 py-3 font-medium">Created</th>
                          <th className="px-6 py-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCampaigns.map(({ campaignName, prospects, source, createdAt }) => (
                          <tr
                            key={campaignName}
                            className="border-b border-gray-700 hover:bg-gray-750 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-medium">{campaignName}</span>
                                    {source === 'database' && (
                                      <span className="px-2 py-0.5 bg-blue-600/20 text-blue-400 text-xs rounded-full border border-blue-500/40">
                                        Saved
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-gray-400 text-sm">Ready for message creation</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-300 text-sm">
                                {source === 'database' ? 'Prospect Database' : 'Recent'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-white">{prospects.length}</div>
                              <div className="text-gray-400 text-sm">approved</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-gray-400 text-sm">
                                {createdAt ? new Date(createdAt).toLocaleDateString() : 'Today'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Set the campaign-specific prospects before opening builder
                                    setSelectedCampaignProspects(prospects);
                                    setShowBuilder(true);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors"
                                >
                                  <MessageSquare size={14} />
                                  Create Campaign
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            ) : (
              /* Campaign Table */
              <div className="overflow-x-auto">
                {/* Bulk Action Bar */}
                {selectedCampaigns.size > 0 && (
                  <div className="bg-purple-900/20 border-b border-purple-500/30 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-white font-medium">{selectedCampaigns.size} campaign(s) selected</span>
                      <button
                        onClick={clearSelection}
                        className="text-gray-400 hover:text-white text-sm"
                      >
                        Clear selection
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleBulkPause}
                        className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm flex items-center gap-1"
                      >
                        <Pause size={14} />
                        Pause
                      </button>
                      <button
                        onClick={handleBulkResume}
                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm flex items-center gap-1"
                      >
                        <Play size={14} />
                        Resume
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm flex items-center gap-1"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <table className="w-full">
                <thead className="bg-gray-750">
                  <tr className="text-left text-gray-400 text-xs uppercase">
                    <th className="px-6 py-3 font-medium w-12">
                      <input
                        type="checkbox"
                        checked={filteredCampaigns.length > 0 && selectedCampaigns.size === filteredCampaigns.length}
                        onChange={() => toggleSelectAll(filteredCampaigns)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                      />
                    </th>
                    <th className="px-6 py-3 font-medium">Campaign</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Contacted</th>
                    <th className="px-6 py-3 font-medium">Connected</th>
                    <th className="px-6 py-3 font-medium">Replied</th>
                    <th className="px-6 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((campaign: any) => (
                    <tr
                      key={campaign.id}
                      className={`border-t border-gray-700 hover:bg-gray-750 transition-colors ${selectedCampaigns.has(campaign.id) ? 'bg-purple-900/10' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedCampaigns.has(campaign.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleCampaignSelection(campaign.id);
                          }}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-600 focus:ring-purple-500"
                        />
                      </td>
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => handleCampaignAction(campaign.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                          <div>
                            <div className="text-white font-medium">{campaign.name}</div>
                            <div className="text-gray-400 text-sm">Created {new Date(campaign.created_at).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-300">{getCampaignTypeLabel(campaign.type)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{campaign.sent || 0}</div>
                        <div className="text-gray-400 text-sm">of {campaign.prospects || 0}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{campaign.connections || 0}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white">{campaign.replies || 0}</div>
                        <div className="text-gray-400 text-sm">{(Number(campaign.response_rate) || 0).toFixed(1)}%</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              editCampaign(campaign);
                            }}
                            className={`transition-colors ${
                              campaign.status === 'active'
                                ? 'text-gray-600 cursor-not-allowed'
                                : 'text-cyan-400 hover:text-cyan-300'
                            }`}
                            title={campaign.status === 'active' ? "Pause to view/edit" : "View/Edit campaign"}
                            disabled={campaign.status === 'active'}
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              viewProspects(campaign.id);
                            }}
                            className="text-orange-400 hover:text-orange-300 transition-colors"
                            title="View prospects"
                          >
                            <Users size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCampaignStatus(campaign.id, campaign.status);
                            }}
                            className={`transition-colors ${
                              campaign.status === 'active'
                                ? 'text-yellow-400 hover:text-yellow-300'
                                : 'text-green-400 hover:text-green-300'
                            }`}
                            title={campaign.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                          >
                            {campaign.status === 'active' ? <Pause size={18} /> : <Play size={18} />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              archiveCampaign(campaign.id, campaign.name);
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Archive campaign"
                          >
                            <Archive size={18} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCampaignAction(campaign.id);
                            }}
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Campaign settings"
                          >
                            <Settings size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* Performance Metrics - Hidden for now */}
        <div className="hidden grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Mail className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <CheckCircle className="text-green-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">179</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Total Messages Sent</div>
            <div className="text-xs text-green-300">↑ 12% from last week</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Eye className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <TrendingUp className="text-orange-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">84</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Messages Opened</div>
            <div className="text-xs text-orange-300">47% open rate</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <Users className="text-purple-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">17</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Positive Replies</div>
            <div className="text-xs text-purple-300">9.5% reply rate</div>
          </div>
        </div>

      {/* Template Library Modal */}
      {showTemplateLibrary && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Template Library</h3>
              <button
                onClick={() => setShowTemplateLibrary(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-gray-400">Loading templates...</div>
              </div>
            ) : (
              <div className="space-y-4">
                {templates.map((template) => (
                  <div key={template.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-white font-medium">{template.name}</h4>
                      <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded">
                        {template.type ? template.type.replace('_', ' ').toUpperCase() : 'UNKNOWN'}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm mb-3">{template.description}</p>
                    <div className="space-y-2">
                      {template.steps?.map((step: any, index: number) => (
                        <div key={index} className="bg-gray-600 p-3 rounded cursor-pointer hover:bg-gray-500 transition-colors">
                          <div className="text-sm font-medium text-white mb-1">
                            Step {index + 1}: {step.step_type}
                          </div>
                          <div className="text-xs text-gray-300">
                            {step.message_template ? step.message_template.substring(0, 100) : 'No message'}...
                          </div>
                          {step.delay_days > 0 && (
                            <div className="text-xs text-blue-300 mt-1">
                              Delay: {step.delay_days} days
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-600">
                      <span className="text-xs text-gray-400">
                        Expected Response: {template.expected_response_rate}%
                      </span>
                      <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors">
                        Use Template
                      </button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && !loadingTemplates && (
                  <div className="text-center py-12 text-gray-400">
                    No templates found. Check your API connection.
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTemplateLibrary(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Cloning Modal */}
      {showCampaignCloning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Clone Campaign</h3>
              <button
                onClick={() => setShowCampaignCloning(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Campaign to Clone</label>
                <select 
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                >
                  <option value="">Select a campaign...</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name} - {campaign.status}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">New Campaign Name</label>
                <input
                  type="text"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Enter new campaign name..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description (Optional)</label>
                <textarea
                  value={newCampaignDescription}
                  onChange={(e) => setNewCampaignDescription(e.target.value)}
                  placeholder="Enter description for cloned campaign..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Clone Settings</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={cloneTemplates}
                        onChange={(e) => setCloneTemplates(e.target.checked)}
                        className="mr-2" 
                      />
                      <span className="text-gray-300 text-sm">Message templates</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={cloneSettings}
                        onChange={(e) => setCloneSettings(e.target.checked)}
                        className="mr-2" 
                      />
                      <span className="text-gray-300 text-sm">Campaign settings</span>
                    </label>
                    <label className="flex items-center">
                      <input 
                        type="checkbox" 
                        checked={cloneProspects}
                        onChange={(e) => setCloneProspects(e.target.checked)}
                        className="mr-2" 
                      />
                      <span className="text-gray-300 text-sm">Prospect list</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Modifications</label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-gray-300 text-sm">Update industry targeting</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-gray-300 text-sm">Adjust message tone</span>
                    </label>
                    <label className="flex items-center">
                      <input type="checkbox" className="mr-2" />
                      <span className="text-gray-300 text-sm">Change timing settings</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCampaignCloning(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCloneCampaign}
                disabled={isCloning || !selectedCampaignId || !newCampaignName.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                {isCloning ? 'Cloning...' : 'Clone Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Settings Modal */}
      {showCampaignSettings && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Settings size={24} className="text-white" />
                <h3 className="text-xl font-semibold text-white">Settings</h3>
                <span className="text-xs px-2 py-1 bg-blue-600 text-white rounded ml-2">
                  {selectedCampaign.type === 'linkedin' ? 'LinkedIn' :
                   selectedCampaign.type === 'email' ? 'Email' : 'Multi-Channel'}
                </span>
              </div>
              <button
                onClick={() => setShowCampaignSettings(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Campaign Name */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign name</h4>
                <p className="text-gray-400 text-sm mb-3">Rename your campaign here for easier campaign management.</p>
                <input
                  type="text"
                  value={editedCampaignSettings.name}
                  onChange={(e) => handleCampaignSettingChange('name', e.target.value)}
                  maxLength={100}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none"
                />
                <div className="text-right text-gray-400 text-xs mt-1">Characters: {editedCampaignSettings.name.length}/100</div>
              </div>

              {/* Campaign Limits */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign limits</h4>
                <p className="text-gray-400 text-sm mb-4">
                  Specify the daily limit for this campaign. These limits will be applied to reach out to your leads.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">
                      {selectedCampaign.type === 'linkedin'
                        ? 'Set the number of new connection requests to send daily:'
                        : selectedCampaign.type === 'email'
                        ? 'Set the number of new emails to send daily:'
                        : 'Set the number of new contacts to reach daily:'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedCampaignSettings.daily_connection_limit}
                      onChange={(e) => handleCampaignSettingChange('daily_connection_limit', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-gray-400 text-xs mt-1">
                      <span>0</span>
                      <span className="text-white font-medium">{editedCampaignSettings.daily_connection_limit}</span>
                      <span>100</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-gray-300 text-sm mb-2 block">
                      {selectedCampaign.type === 'linkedin'
                        ? 'Set the number of LinkedIn follow-up messages to send daily:'
                        : selectedCampaign.type === 'email'
                        ? 'Set the number of follow-up emails to send daily:'
                        : 'Set the number of follow-up messages to send daily:'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={editedCampaignSettings.daily_follow_up_limit}
                      onChange={(e) => handleCampaignSettingChange('daily_follow_up_limit', parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-gray-400 text-xs mt-1">
                      <span>0</span>
                      <span className="text-white font-medium">{editedCampaignSettings.daily_follow_up_limit}</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Campaign Priority */}
              <div className="border-b border-gray-700 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">Campaign Priority</h4>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">Use priority</span>
                    <input
                      type="checkbox"
                      checked={editedCampaignSettings.use_priority}
                      onChange={(e) => handleCampaignSettingChange('use_priority', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                </div>
                <p className="text-gray-400 text-sm mb-3">If enabled, each campaign will have a default priority value "Medium". If a campaign priority is changed to "High" more actions will be scheduled to be sent from it in comparison to campaigns with lower priority.</p>
                <select
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  value={editedCampaignSettings.priority}
                  onChange={(e) => handleCampaignSettingChange('priority', e.target.value)}
                  disabled={!editedCampaignSettings.use_priority}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              {/* Schedule Campaign */}
              <div className="border-b border-gray-700 pb-6">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-white font-medium">Schedule campaign</h4>
                  <label className="flex items-center gap-2">
                    <span className="text-gray-300 text-sm">Start immediately</span>
                    <input
                      type="checkbox"
                      checked={editedCampaignSettings.start_immediately}
                      onChange={(e) => handleCampaignSettingChange('start_immediately', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                  </label>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  {selectedCampaign.type === 'linkedin' || selectedCampaign.type === 'multi_channel'
                    ? 'You can schedule when campaign will be active. Once set to active, LinkedIn messages will start being sent during your account\'s active hours.'
                    : 'You can schedule when campaign will be active. Once set to active, emails will start being sent immediately.'}
                </p>
                <input
                  type="datetime-local"
                  value={editedCampaignSettings.scheduled_start || ''}
                  onChange={(e) => handleCampaignSettingChange('scheduled_start', e.target.value)}
                  disabled={editedCampaignSettings.start_immediately}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                />

                {/* Timezone Selector */}
                <div className="mt-4">
                  <label className="text-gray-300 text-sm mb-2 block">
                    <Globe size={14} className="inline mr-1" />
                    Timezone
                  </label>
                  <select
                    value={editedCampaignSettings.timezone || 'America/New_York'}
                    onChange={(e) => handleCampaignSettingChange('timezone', e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Anchorage">Alaska Time (AKT)</option>
                    <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Paris">Paris (CET/CEST)</option>
                    <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                    <option value="Australia/Sydney">Sydney (AEDT)</option>
                    <option value="UTC">UTC</option>
                  </select>
                  <p className="text-gray-400 text-xs mt-1">Campaign messages will be sent according to this timezone</p>
                </div>

                {/* Working Hours */}
                <div className="mt-4">
                  <label className="text-gray-300 text-sm mb-2 block">
                    <Clock size={14} className="inline mr-1" />
                    Working Hours
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Start Time</label>
                      <select
                        value={editedCampaignSettings.working_hours_start || 7}
                        onChange={(e) => handleCampaignSettingChange('working_hours_start', parseInt(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">End Time</label>
                      <select
                        value={editedCampaignSettings.working_hours_end || 18}
                        onChange={(e) => handleCampaignSettingChange('working_hours_end', parseInt(e.target.value))}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">Messages will only be sent between {editedCampaignSettings.working_hours_start || 7}:00 and {editedCampaignSettings.working_hours_end || 18}:00</p>
                </div>

                {/* Skip Weekends */}
                <div className="mt-4">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={editedCampaignSettings.skip_weekends !== false}
                      onChange={(e) => handleCampaignSettingChange('skip_weekends', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <span className="text-white text-sm">Skip Weekends</span>
                      <p className="text-gray-400 text-xs">Don't send messages on Saturday and Sunday</p>
                    </div>
                  </label>
                </div>

                {/* Skip Holidays */}
                <div className="mt-4">
                  <label className="flex items-center gap-3 mb-2">
                    <input
                      type="checkbox"
                      checked={editedCampaignSettings.skip_holidays !== false}
                      onChange={(e) => handleCampaignSettingChange('skip_holidays', e.target.checked)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <span className="text-white text-sm">Skip Public Holidays</span>
                      <p className="text-gray-400 text-xs">Don't send messages on public holidays</p>
                    </div>
                  </label>
                  {editedCampaignSettings.skip_holidays !== false && (
                    <div className="ml-7">
                      <label className="text-gray-400 text-xs mb-1 block">Holiday Calendar</label>
                      <select
                        value={editedCampaignSettings.country_code || 'US'}
                        onChange={(e) => handleCampaignSettingChange('country_code', e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                      >
                        <option value="US">United States</option>
                        <option value="GB">United Kingdom</option>
                        <option value="CA">Canada</option>
                        <option value="DE">Germany</option>
                        <option value="FR">France</option>
                        <option value="AU">Australia</option>
                        <option value="JP">Japan</option>
                        <option value="SG">Singapore</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* Prospects */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Prospects</h4>
                {selectedCampaign.type === 'linkedin' || selectedCampaign.type === 'multi_channel' ? (
                  <>
                    <p className="text-gray-400 text-sm mb-3">Override and allow outreaching to LinkedIn profiles from the same company</p>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={editedCampaignSettings.allow_same_company}
                        onChange={(e) => handleCampaignSettingChange('allow_same_company', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-white text-sm">Override LinkedIn profiles</span>
                    </label>
                    <p className="text-gray-400 text-xs mt-2">Enable duplicating leads between company campaigns</p>
                  </>
                ) : (
                  <>
                    <p className="text-gray-400 text-sm mb-3">Email campaign prospect settings</p>
                    <label className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={editedCampaignSettings.allow_duplicate_emails}
                        onChange={(e) => handleCampaignSettingChange('allow_duplicate_emails', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-white text-sm">Allow duplicate email addresses</span>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={editedCampaignSettings.skip_bounced_emails}
                        onChange={(e) => handleCampaignSettingChange('skip_bounced_emails', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className="text-white text-sm">Skip bounced emails</span>
                    </label>
                    <p className="text-gray-400 text-xs mt-2">Automatically skip previously bounced email addresses</p>
                  </>
                )}
              </div>

              {/* Campaign Status */}
              <div className="border-b border-gray-700 pb-6">
                <h4 className="text-white font-medium mb-2">Campaign status</h4>
                <p className="text-gray-400 text-sm mb-3">
                  {selectedCampaign.type === 'linkedin'
                    ? 'You can turn this campaign on and off. An active campaign will send LinkedIn connection requests and messages according to your settings.'
                    : selectedCampaign.type === 'email'
                    ? 'You can turn this campaign on and off. An active campaign will send emails according to your settings.'
                    : 'You can turn this campaign on and off. An active campaign will send messages across all channels according to your settings.'}
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 bg-gray-700 rounded">
                    <div className={`w-3 h-3 rounded-full ${
                      selectedCampaign.status === 'active' ? 'bg-green-500' :
                      selectedCampaign.status === 'paused' ? 'bg-yellow-500' :
                      selectedCampaign.status === 'completed' ? 'bg-blue-500' :
                      selectedCampaign.status === 'inactive' ? 'bg-gray-400' :
                      'bg-gray-500'
                    }`}></div>
                    <span className="text-white capitalize">{selectedCampaign.status}</span>
                  </div>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                    value={selectedCampaign.status}
                    onChange={async (e) => {
                      const newStatus = e.target.value;

                      try {
                        const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ status: newStatus })
                        });

                        if (response.ok) {
                          // Update local state
                          setSelectedCampaign({ ...selectedCampaign, status: newStatus });

                          // Refresh campaigns list
                          queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
                          queryClient.invalidateQueries({ queryKey: ['pendingCampaigns', actualWorkspaceId] });

                          toastSuccess(`Campaign status updated to ${newStatus}`);

                          // If activating, also execute the campaign
                          if (newStatus === 'active') {
                            try {
                              // Queue-based Unipile integration for LinkedIn campaigns (30 min spacing)
                              let executeEndpoint = '/api/campaigns/direct/send-connection-requests-fast';

                              if (selectedCampaign.campaign_type === 'email') {
                                // Use queue-based email sending (cron processes every 13 min)
                                executeEndpoint = '/api/campaigns/email/send-emails-queued';
                              }

                              console.log(`Executing ${selectedCampaign.campaign_type || 'messenger'} campaign via ${executeEndpoint}`);

                              const execResponse = await fetch(executeEndpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                credentials: 'include', // Include cookies for Supabase auth
                                body: JSON.stringify({
                                  campaignId: selectedCampaign.id
                                })
                              });

                              if (execResponse.ok) {
                                const execData = await execResponse.json().catch(() => ({ message: 'Execution started' }));
                                const progressMsg = execData.has_more_prospects
                                  ? ` (${execData.remaining_prospects} more queued for background processing)`
                                  : '';
                                toastSuccess(`Campaign started! ${execData.message || 'Messages are being sent'}${progressMsg}`);
                              } else {
                                const execError = await execResponse.json().catch(() => ({
                                  error: 'Execution failed',
                                  details: { message: `Status ${execResponse.status}: ${execResponse.statusText}` }
                                }));
                                console.error('Campaign execution failed:', execError);
                                toastError(`Campaign activated but execution failed: ${execError.details?.message || execError.error || 'Unknown error'}`);
                              }
                            } catch (execError) {
                              console.error('Campaign execution error:', execError);
                              const errorMessage = execError instanceof Error ? execError.message : String(execError);
                              toastError(`Campaign activation failed: ${errorMessage}`);
                            }
                          }
                        } else {
                          const error = await response.json();
                          toastError(`Failed to update status: ${error.error || 'Unknown error'}`);
                        }
                      } catch (error) {
                        console.error('Status update error:', error);
                        toastError('Failed to update campaign status');
                      }
                    }}
                  >
                    <option value="active">Active - Campaign is running</option>
                    <option value="paused">Paused - Campaign is temporarily stopped</option>
                    <option value="inactive">Inactive - Campaign ready to activate</option>
                    <option value="completed">Completed - Campaign finished</option>
                    <option value="archived">Archived - Campaign archived</option>
                  </select>
                </div>
              </div>

              {/* Delete Campaign */}
              <div>
                <h4 className="text-white font-medium mb-2">Delete campaign</h4>
                <p className="text-gray-400 text-sm mb-3">Deleting a campaign will stop all the campaign's activity. Contacts from the campaign will remain in 'My Network' and in your 'Inbox', however, they will no longer receive messages from the deleted campaign. You will be able to continue manual communication with these contacts.</p>
                <button
                  onClick={async () => {
                    if (!selectedCampaign) return;

                    const confirmed = confirm(
                      `Are you sure you want to delete "${selectedCampaign.name}"?\n\nThis action cannot be undone. The campaign will be archived if it has sent messages, or permanently deleted if it hasn't.`
                    );

                    if (!confirmed) return;

                    try {
                      const response = await fetch(`/api/campaigns/${selectedCampaign.id}`, {
                        method: 'DELETE'
                      });

                      if (response.ok) {
                        const result = await response.json();
                        toastSuccess(result.message || 'Campaign deleted successfully');

                        // Close settings modal
                        setShowCampaignSettings(false);
                        setSelectedCampaign(null);

                        // Refresh campaigns list
                        queryClient.invalidateQueries({ queryKey: ['campaigns', actualWorkspaceId] });
                        queryClient.invalidateQueries({ queryKey: ['pendingCampaigns'] });
                      } else {
                        const error = await response.json();
                        toastError(error.error || 'Failed to delete campaign');
                      }
                    } catch (error) {
                      console.error('Delete campaign error:', error);
                      toastError('Failed to delete campaign. Please try again.');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <X size={16} />
                  Delete campaign
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-700">
              <button
                onClick={handleSaveCampaignSettings}
                className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!campaignSettingsChanged}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Approval Modal - REPLACED BY APPROVAL TAB */}
      {false && showMessageApproval && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Message Approval Queue</h3>
              <button
                onClick={() => setShowMessageApproval(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Pending Messages */}
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-yellow-400 font-medium">
                    Pending Approval ({approvalCounts.pending})
                  </h4>
                  {approvalCounts.pending > 0 && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => handleBulkApproval('approve')}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                      >
                        Approve All
                      </button>
                      <button 
                        onClick={() => handleBulkApproval('reject')}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                      >
                        Reject All
                      </button>
                    </div>
                  )}
                </div>
                
                {loadingApproval ? (
                  <div className="text-center py-4">
                    <div className="text-gray-400">Loading messages...</div>
                  </div>
                ) : approvalMessages.pending.length === 0 ? (
                  <div className="text-center py-4">
                    <div className="text-gray-400">No pending messages</div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {approvalMessages.pending.map((message: any) => (
                      <div key={message.id} className="bg-gray-700 rounded p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <span className="text-white font-medium">
                              {message.campaign_prospects?.workspace_prospects?.first_name} {message.campaign_prospects?.workspace_prospects?.last_name}
                              {message.campaign_prospects?.workspace_prospects?.company_name && ` - ${message.campaign_prospects?.workspace_prospects?.company_name}`}
                            </span>
                            <span className="text-gray-400 text-sm ml-2">
                              {message.message_type || 'Message'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleApproveMessage(message.id)}
                              className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                            >
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectMessage(message.id)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                        <div className="text-gray-300 text-sm bg-gray-600 p-2 rounded">
                          {message.message_content || message.message_text || 'No message content'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Approved Messages */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">
                  Recently Approved ({approvalCounts.approved})
                </h4>
                {approvalMessages.approved.length === 0 ? (
                  <div className="text-center py-2">
                    <div className="text-gray-400 text-sm">No recently approved messages</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvalMessages.approved.slice(0, 5).map((message: any) => (
                      <div key={message.id} className="bg-gray-700 rounded p-3 text-sm">
                        <span className="text-white">
                          {message.campaign_prospects?.workspace_prospects?.first_name} {message.campaign_prospects?.workspace_prospects?.last_name}
                          {message.campaign_prospects?.workspace_prospects?.company_name && ` - ${message.campaign_prospects?.workspace_prospects?.company_name}`}
                        </span>
                        <span className="text-gray-400 ml-2">
                          • Approved {message.approved_at ? new Date(message.approved_at).toLocaleString() : 'recently'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rejected Messages */}
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4">
                <h4 className="text-red-400 font-medium mb-3">
                  Recently Rejected ({approvalCounts.rejected})
                </h4>
                {approvalMessages.rejected.length === 0 ? (
                  <div className="text-center py-2">
                    <div className="text-gray-400 text-sm">No recently rejected messages</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {approvalMessages.rejected.slice(0, 5).map((message: any) => (
                      <div key={message.id} className="bg-gray-700 rounded p-3 text-sm">
                        <span className="text-white">
                          {message.campaign_prospects?.workspace_prospects?.first_name} {message.campaign_prospects?.workspace_prospects?.last_name}
                          {message.campaign_prospects?.workspace_prospects?.company_name && ` - ${message.campaign_prospects?.workspace_prospects?.company_name}`}
                        </span>
                        <span className="text-gray-400 ml-2">
                          • Rejected {message.approved_at ? new Date(message.approved_at).toLocaleString() : 'recently'}
                        </span>
                        {message.rejection_reason && (
                          <span className="text-red-400 ml-2">• Reason: {message.rejection_reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowMessageApproval(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scheduled Campaigns Modal */}
      {showScheduledCampaigns && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Scheduled Campaigns</h3>
              <button
                onClick={() => setShowScheduledCampaigns(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Create Schedule */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Schedule New Campaign</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Campaign</label>
                    <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm">
                      <option>Select campaign...</option>
                      <option>Q4 SaaS Outreach</option>
                      <option>Holiday Networking</option>
                      <option>New Year Prospecting</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Start Date</label>
                    <input type="datetime-local" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">End Date</label>
                    <input type="datetime-local" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                <button className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                  Schedule Campaign
                </button>
              </div>

              {/* Upcoming Schedules */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-3">Upcoming Schedules</h4>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium">Holiday Networking Campaign</div>
                        <div className="text-gray-400 text-sm">Starts: Dec 15, 2024 at 9:00 AM</div>
                        <div className="text-gray-400 text-sm">Expected Duration: 2 weeks</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Edit</button>
                        <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-700 rounded p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-white font-medium">Q1 2025 Prospecting Blitz</div>
                        <div className="text-gray-400 text-sm">Starts: Jan 2, 2025 at 8:00 AM</div>
                        <div className="text-gray-400 text-sm">Expected Duration: 1 month</div>
                      </div>
                      <div className="flex gap-2">
                        <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Edit</button>
                        <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Cancel</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Active Schedules */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">Currently Active</h4>
                <div className="bg-gray-700 rounded p-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-white font-medium">November B2B Outreach</div>
                      <div className="text-gray-400 text-sm">Started: Nov 1, 2024 • Progress: 65%</div>
                      <div className="text-gray-400 text-sm">Messages sent: 156/240</div>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Pause</button>
                      <button className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Stop</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowScheduledCampaigns(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A/B Testing Hub Modal */}
      {showABTesting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-4xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">A/B Testing Hub</h3>
              <button
                onClick={() => setShowABTesting(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Create New Test */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Create New A/B Test</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Test Name</label>
                    <input type="text" placeholder="e.g., Subject Line Test - Dec 2024" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Test Type</label>
                    <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm">
                      <option>Connection Message</option>
                      <option>Follow-up Message</option>
                      <option>Message Timing</option>
                      <option>Subject Line</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Variant A</label>
                    <textarea rows={3} placeholder="Enter first variant..." className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Variant B</label>
                    <textarea rows={3} placeholder="Enter second variant..." className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm"></textarea>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Sample Size</label>
                    <input type="number" defaultValue="100" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Split %</label>
                    <select className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm">
                      <option>50/50</option>
                      <option>60/40</option>
                      <option>70/30</option>
                      <option>80/20</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Duration (days)</label>
                    <input type="number" defaultValue="7" className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm" />
                  </div>
                </div>
                
                <button className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors">
                  Start A/B Test
                </button>
              </div>

              {/* Active Tests */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <h4 className="text-blue-400 font-medium mb-3">Active Tests (2)</h4>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-white font-medium">Holiday Subject Line Test</div>
                        <div className="text-gray-400 text-sm">Started 3 days ago • 5 days remaining</div>
                      </div>
                      <span className="px-2 py-1 bg-blue-600 text-white text-xs rounded">Running</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-600 p-3 rounded">
                        <div className="text-sm text-gray-300 mb-1">Variant A: "Quick holiday question"</div>
                        <div className="text-white font-medium">Response Rate: 18.5%</div>
                        <div className="text-gray-400 text-xs">45 sent, 8 replies</div>
                      </div>
                      <div className="bg-gray-600 p-3 rounded">
                        <div className="text-sm text-gray-300 mb-1">Variant B: "End-of-year opportunity"</div>
                        <div className="text-white font-medium">Response Rate: 23.1%</div>
                        <div className="text-gray-400 text-xs">39 sent, 9 replies</div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                      <button className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded">Pause</button>
                      <button className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded">Stop</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Completed Tests */}
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                <h4 className="text-green-400 font-medium mb-3">Completed Tests</h4>
                <div className="space-y-3">
                  <div className="bg-gray-700 rounded p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-white font-medium">Q4 Connection Message Test</div>
                        <div className="text-gray-400 text-sm">Completed 1 week ago</div>
                      </div>
                      <span className="px-2 py-1 bg-green-600 text-white text-xs rounded">Winner: B</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-gray-600 p-3 rounded">
                        <div className="text-sm text-gray-300 mb-1">Variant A: Professional approach</div>
                        <div className="text-white font-medium">Response Rate: 12.3%</div>
                        <div className="text-gray-400 text-xs">100 sent, 12 replies</div>
                      </div>
                      <div className="bg-gray-600 p-3 rounded border-2 border-green-500">
                        <div className="text-sm text-gray-300 mb-1">Variant B: Value-focused approach</div>
                        <div className="text-white font-medium">Response Rate: 19.8%</div>
                        <div className="text-gray-400 text-xs">100 sent, 20 replies</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowABTesting(false)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Steps Editor */}
      {showStepsEditor && selectedCampaign && (
        <CampaignStepsEditor
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          campaignType={selectedCampaign.type}
          onClose={() => setShowStepsEditor(false)}
          onSave={(steps) => {
            console.log('Saved campaign steps:', steps);
            // TODO: Save steps to database
            setShowStepsEditor(false);
          }}
          workspaceId={actualWorkspaceId || undefined}
        />
      )}

      {/* Message Review Detail Modal */}
      {selectedMessageForReview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gray-750 px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0">
              <div>
                <h3 className="text-xl font-semibold text-white">{selectedMessageForReview.campaign_name}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm text-gray-400">
                    Step {selectedMessageForReview.step_number} • {new Date(selectedMessageForReview.created_at).toLocaleString()}
                  </p>
                  <span className="text-gray-600">•</span>
                  <button
                    onClick={() => loadCampaignProspects(selectedMessageForReview.campaign_id)}
                    disabled={loadingProspects}
                    className="text-sm text-purple-400 hover:text-purple-300 underline transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <Users size={14} />
                    {loadingProspects ? 'Loading...' : 'View Approved Prospects'}
                  </button>
                </div>
              </div>
              <button
                onClick={() => setSelectedMessageForReview(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Message Content */}
            <div className="p-6 space-y-6">
              {/* Message Body */}
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">Message Content</label>
                <div className="bg-gray-900 rounded-lg p-6 border border-gray-700">
                  <div className="text-gray-100 text-base leading-relaxed whitespace-pre-wrap">
                    {selectedMessageForReview.message_content}
                  </div>
                </div>
              </div>

              {/* Message Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs uppercase mb-1">Characters</div>
                  <div className={`text-2xl font-semibold ${selectedMessageForReview.message_content?.length > 275 && selectedMessageForReview.step_number === 1 ? 'text-yellow-400' : 'text-white'}`}>
                    {selectedMessageForReview.message_content?.length || 0}
                  </div>
                  {selectedMessageForReview.message_content?.length > 275 && selectedMessageForReview.step_number === 1 && (
                    <div className="text-yellow-400 text-xs mt-1 flex items-center gap-1">
                      <AlertTriangle size={12} />
                      Exceeds LinkedIn limit
                    </div>
                  )}
                </div>
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs uppercase mb-1">Personalization Tags</div>
                  <div className="text-2xl font-semibold text-white">
                    {(selectedMessageForReview.message_content?.match(/\{\{.*?\}\}/g) || []).length}
                  </div>
                  <div className="text-gray-400 text-xs mt-1">Dynamic fields</div>
                </div>
                <div className="bg-gray-750 rounded-lg p-4 border border-gray-700">
                  <div className="text-gray-400 text-xs uppercase mb-1">Status</div>
                  <div className="text-2xl font-semibold text-yellow-400">Pending</div>
                  <div className="text-gray-400 text-xs mt-1">Awaiting review</div>
                </div>
              </div>

              {/* Personalization Tags Used */}
              {(selectedMessageForReview.message_content?.match(/\{\{.*?\}\}/g) || []).length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-400 mb-2 block">Personalization Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(selectedMessageForReview.message_content?.match(/\{\{.*?\}\}/g) || [])).map((tag: string, idx: number) => (
                      <span key={idx} className="px-3 py-1 bg-purple-600/20 text-purple-300 text-sm rounded-full border border-purple-500/40">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedMessageForReview(null)}
                    className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // TODO: Open SAM chat with context about this message
                      console.log('Ask SAM for help with message:', selectedMessageForReview);
                      toastError('SAM chat integration coming soon! This will open a chat with SAM to help improve this message.');
                    }}
                    className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Brain size={18} />
                    Ask SAM to Improve
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleRejectMessage(selectedMessageForReview.id);
                      setSelectedMessageForReview(null);
                    }}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <XCircle size={18} />
                    Reject Message
                  </button>
                  <button
                    onClick={() => {
                      handleApproveMessage(selectedMessageForReview.id);
                      setSelectedMessageForReview(null);
                    }}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    <CheckCircle size={18} />
                    Approve Message
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Prospects Modal */}
      {showCampaignProspects && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gray-750 px-6 py-4 border-b border-gray-700 flex items-center justify-between sticky top-0">
              <div>
                <h3 className="text-xl font-semibold text-white">Campaign Prospects</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {campaignProspects.length} prospect{campaignProspects.length !== 1 ? 's' : ''} in this campaign
                </p>
              </div>
              <button
                onClick={() => setShowCampaignProspects(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Prospect List */}
            <div className="p-6">
              {campaignProspects.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="mx-auto text-gray-600 mb-4" size={48} />
                  <div className="text-white font-medium mb-2">No prospects found</div>
                  <div className="text-gray-400">This campaign doesn't have any prospects yet.</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {campaignProspects.map((prospect: any) => (
                    <div
                      key={prospect.id}
                      className="bg-gray-750 border border-gray-600 rounded-lg p-4 hover:border-purple-500/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-white font-semibold">
                              {prospect.first_name && prospect.last_name
                                ? `${prospect.first_name} ${prospect.last_name}`
                                : prospect.workspace_prospects?.full_name || prospect.name || 'Unknown'}
                            </h4>
                            {prospect.status && (
                              <span className={`px-2 py-0.5 text-xs rounded-full border ${
                                prospect.status === 'pending' ? 'bg-yellow-600/20 text-yellow-400 border-yellow-500/40' :
                                prospect.status === 'approved' ? 'bg-green-600/20 text-green-400 border-green-500/40' :
                                prospect.status === 'contacted' || prospect.status === 'connected' ? 'bg-blue-600/20 text-blue-400 border-blue-500/40' :
                                'bg-gray-600/20 text-gray-400 border-gray-500/40'
                              }`}>
                                {prospect.status}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            {(prospect.title || prospect.workspace_prospects?.job_title) && (
                              <div>
                                <span className="text-gray-400">Title:</span>
                                <span className="text-gray-300 ml-2">{prospect.title || prospect.workspace_prospects?.job_title}</span>
                              </div>
                            )}
                            {(prospect.company_name || prospect.company || prospect.workspace_prospects?.company_name) && (
                              <div>
                                <span className="text-gray-400">Company:</span>
                                <span className="text-gray-300 ml-2">{prospect.company_name || prospect.company || prospect.workspace_prospects?.company_name}</span>
                              </div>
                            )}
                            {(prospect.email || prospect.workspace_prospects?.email) && (
                              <div>
                                <span className="text-gray-400">Email:</span>
                                <span className="text-gray-300 ml-2">{prospect.email || prospect.workspace_prospects?.email}</span>
                              </div>
                            )}
                            {(prospect.linkedin_url || prospect.workspace_prospects?.linkedin_url) && (
                              <div>
                                <span className="text-gray-400">LinkedIn:</span>
                                <a
                                  href={prospect.linkedin_url || prospect.workspace_prospects?.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-purple-400 hover:text-purple-300 ml-2 underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View Profile
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Campaign Stats */}
                          <div className="mt-3 pt-3 border-t border-gray-700">
                            <div className="grid grid-cols-5 gap-4 text-xs">
                              <div className="text-center">
                                <div className="text-gray-400 mb-1">CR Sent</div>
                                <div className={prospect.contacted_at ? "text-green-400 font-semibold text-sm" : "text-gray-500 text-sm"}>
                                  {prospect.contacted_at ? "1" : "0"}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-gray-400 mb-1">Connected</div>
                                <div className={prospect.connection_accepted_at ? "text-green-400 font-semibold text-sm" : "text-gray-500 text-sm"}>
                                  {prospect.connection_accepted_at ? "1" : "0"}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-gray-400 mb-1">FU Sent</div>
                                <div className={prospect.follow_up_sequence_index > 0 ? "text-purple-400 font-semibold text-sm" : "text-gray-500 text-sm"}>
                                  {prospect.follow_up_sequence_index || 0}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-gray-400 mb-1">Replied</div>
                                <div className={prospect.responded_at ? "text-blue-400 font-semibold text-sm" : "text-gray-500 text-sm"}>
                                  {prospect.responded_at ? "1" : "0"}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-gray-400 mb-1">Opted Out</div>
                                <div className={prospect.status === 'opted_out' ? "text-red-400 font-semibold text-sm" : "text-gray-500 text-sm"}>
                                  {prospect.status === 'opted_out' ? "1" : "0"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-750 px-6 py-4 border-t border-gray-700 flex justify-end sticky bottom-0">
              <button
                onClick={() => setShowCampaignProspects(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message Preview Modal */}
      {showMessagePreview && selectedCampaignForMessages && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowMessagePreview(false)}>
          <div className="bg-gray-900 border border-purple-500 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl text-white flex items-center gap-2">
                    <Eye className="text-purple-400" size={24} />
                    Message Preview: {selectedCampaignForMessages.name}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Review all messages that will be sent in this campaign</p>
                </div>
                <button
                  onClick={() => setShowMessagePreview(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Connection Message - check both direct field and message_templates */}
              {(selectedCampaignForMessages.connection_message || selectedCampaignForMessages.message_templates?.connection_request) && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-purple-400 mb-3 flex items-center gap-2">
                    <MessageCircle size={18} />
                    Connection Request Message
                  </h3>
                  <div className="bg-gray-900/50 border border-gray-700 rounded p-4">
                    <p className="text-gray-200 whitespace-pre-wrap">
                      {selectedCampaignForMessages.connection_message || selectedCampaignForMessages.message_templates?.connection_request}
                    </p>
                  </div>
                </div>
              )}

              {/* Alternative Message - check both direct field and message_templates */}
              {(selectedCampaignForMessages.alternative_message || selectedCampaignForMessages.message_templates?.alternative_message) && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-cyan-400 mb-3 flex items-center gap-2">
                    <MessageSquare size={18} />
                    Alternative Message
                  </h3>
                  <div className="bg-gray-900/50 border border-gray-700 rounded p-4">
                    <p className="text-gray-200 whitespace-pre-wrap">
                      {selectedCampaignForMessages.alternative_message || selectedCampaignForMessages.message_templates?.alternative_message}
                    </p>
                  </div>
                </div>
              )}

              {/* Follow-up Messages - check both direct field and message_templates */}
              {(() => {
                const followUps = selectedCampaignForMessages.follow_up_messages?.length > 0
                  ? selectedCampaignForMessages.follow_up_messages
                  : selectedCampaignForMessages.message_templates?.follow_up_messages;

                return followUps && followUps.length > 0 && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-green-400 mb-3 flex items-center gap-2">
                      <Send size={18} />
                      Follow-up Messages ({followUps.length})
                    </h3>
                    <div className="space-y-4">
                      {followUps.map((msg: any, index: number) => (
                        <div key={index} className="bg-gray-900/50 border border-gray-700 rounded p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-400">Follow-up #{index + 1}</span>
                            {msg.delay_days && (
                              <span className="bg-blue-900/20 text-blue-400 border border-blue-500 px-2 py-1 rounded text-xs">
                                Delay: {msg.delay_days} days
                              </span>
                            )}
                          </div>
                          <p className="text-gray-200 whitespace-pre-wrap">{typeof msg === 'string' ? msg : (msg.message || msg.content || msg)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* No Messages */}
              {(() => {
                const hasDirectMessages = selectedCampaignForMessages.connection_message ||
                                         selectedCampaignForMessages.alternative_message ||
                                         (selectedCampaignForMessages.follow_up_messages?.length > 0);

                const hasTemplateMessages = selectedCampaignForMessages.message_templates?.connection_request ||
                                           selectedCampaignForMessages.message_templates?.alternative_message ||
                                           (selectedCampaignForMessages.message_templates?.follow_up_messages?.length > 0);

                return !hasDirectMessages && !hasTemplateMessages && (
                  <div className="text-center py-8 text-gray-400">
                    <AlertCircle size={48} className="mx-auto mb-4 text-gray-600" />
                    <p>No messages configured for this campaign</p>
                  </div>
                );
              })()}
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6">
              <Button
                onClick={() => setShowMessagePreview(false)}
                className="bg-purple-600 hover:bg-purple-700 w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {showEditModal && campaignToEdit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
          <div className="bg-gray-900 border border-purple-500 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-6 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl text-white flex items-center gap-2">
                    <Edit className="text-purple-400" size={24} />
                    Edit Campaign: {campaignToEdit.name}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">Update campaign messages and settings</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Campaign name"
                />
              </div>

              {/* Connection Message */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Connection Request Message</label>
                <textarea
                  value={editFormData.connection_message || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, connection_message: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-none"
                  placeholder="Hi {{firstName}}, I noticed..."
                />
                <p className="text-xs text-gray-500 mt-1">Available variables: {'{{firstName}}'}, {'{{lastName}}'}, {'{{company}}'}, {'{{title}}'}</p>
              </div>

              {/* Email Body (for email campaigns) OR Alternative Message (for LinkedIn) */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {campaignToEdit?.campaign_type === 'email' ? 'Initial Email Body' : 'Alternative Message (Optional)'}
                </label>
                <textarea
                  value={campaignToEdit?.campaign_type === 'email' ? (editFormData.email_body || '') : (editFormData.alternative_message || '')}
                  onChange={(e) => setEditFormData({
                    ...editFormData,
                    // For email campaigns, update email_body. For LinkedIn, update alternative_message
                    ...(campaignToEdit?.campaign_type === 'email'
                      ? { email_body: e.target.value }
                      : { alternative_message: e.target.value })
                  })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[120px] resize-none"
                  placeholder={campaignToEdit?.campaign_type === 'email' ? "Initial email body..." : "Alternative message if already connected..."}
                />
              </div>

              {/* Email Subject Lines - Only show for email campaigns */}
              {campaignToEdit?.campaign_type === 'email' && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 space-y-4">
                  <h4 className="text-blue-400 font-medium flex items-center gap-2">
                    <Mail size={18} />
                    Email Subject Lines
                  </h4>

                  {/* Initial Subject */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Initial Email Subject</label>
                    <input
                      type="text"
                      value={editFormData.initial_subject || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, initial_subject: e.target.value })}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Quick question about {{company}}"
                    />
                  </div>

                  {/* Threading Option */}
                  <div className="flex items-center gap-3 bg-gray-700/50 rounded-lg p-3">
                    <input
                      type="checkbox"
                      id="edit-use-threaded-replies"
                      checked={editFormData.use_threaded_replies || false}
                      onChange={(e) => setEditFormData({ ...editFormData, use_threaded_replies: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                    />
                    <div>
                      <label htmlFor="edit-use-threaded-replies" className="text-white cursor-pointer font-medium text-sm">
                        Use threaded replies (RE:)
                      </label>
                      <p className="text-xs text-gray-400">
                        {editFormData.use_threaded_replies
                          ? `Follow-ups will use "RE: ${editFormData.initial_subject || '[Initial Subject]'}"`
                          : 'Each follow-up will have its own subject line'
                        }
                      </p>
                    </div>
                  </div>

                  {/* Follow-up Subjects (only if not using threaded replies) */}
                  {!editFormData.use_threaded_replies && editFormData.follow_up_messages?.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm text-gray-400">Follow-up Subject Lines</label>
                      {editFormData.follow_up_messages.map((_: any, index: number) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-12">FU{index + 1}:</span>
                          <input
                            type="text"
                            value={editFormData.follow_up_subjects?.[index] || ''}
                            onChange={(e) => {
                              const updated = [...(editFormData.follow_up_subjects || [])];
                              updated[index] = e.target.value;
                              setEditFormData({ ...editFormData, follow_up_subjects: updated });
                            }}
                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`Subject for follow-up ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up Messages */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Follow-up Messages</label>
                <div className="space-y-3">
                  {(editFormData.follow_up_messages || []).map((msg: any, index: number) => (
                    <div key={index} className="bg-gray-800/50 border border-gray-700 rounded p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">Follow-up #{index + 1}</span>
                        <button
                          onClick={() => {
                            const updated = [...editFormData.follow_up_messages];
                            updated.splice(index, 1);
                            setEditFormData({ ...editFormData, follow_up_messages: updated });
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <textarea
                        value={typeof msg === 'string' ? msg : (msg.message || msg.content || '')}
                        onChange={(e) => {
                          const updated = [...editFormData.follow_up_messages];
                          updated[index] = typeof msg === 'string' ? e.target.value : { ...msg, message: e.target.value };
                          setEditFormData({ ...editFormData, follow_up_messages: updated });
                        }}
                        className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none min-h-[80px]"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(editFormData.follow_up_messages || []), ''];
                      setEditFormData({ ...editFormData, follow_up_messages: updated });
                    }}
                    className="w-full flex items-center justify-center px-3 py-1.5 text-sm border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    <Plus size={16} className="mr-2" />
                    Add Follow-up Message
                  </button>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 px-4 py-2 border border-gray-700 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCampaignEdit}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unified Unipile Wizard (LinkedIn & Email) */}
      <UnipileModal
        isOpen={showUnipileWizard}
        provider={unipileProvider}
        workspaceId={actualWorkspaceId || undefined}
        onClose={() => {
          setShowUnipileWizard(false);
          // Recheck accounts after closing
          if (workspaceId) {
            fetch(`/api/workspace-accounts/check?workspace_id=${workspaceId}`)
              .then(res => res.json())
              .then(data => {
                if (data.success) {
                  setConnectedAccounts({
                    linkedin: data.linkedin_connected || false,
                    email: data.email_connected || false
                  });
                  if (unipileProvider === 'LINKEDIN' && data.linkedin_connected) {
                    toastSuccess('LinkedIn account connected! You can now create LinkedIn campaigns.');
                  } else if ((unipileProvider === 'GOOGLE' || unipileProvider === 'OUTLOOK') && data.email_connected) {
                    toastSuccess('Email account connected! You can now create email campaigns.');
                  }
                }
              })
              .catch(err => console.error('Failed to recheck accounts:', err));
          }
        }}
      />

      </div>
    </div>
    </div>
  );
};

export default CampaignHub;
