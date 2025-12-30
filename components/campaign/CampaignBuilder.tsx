'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toastSuccess, toastError, toastWarning, toastInfo } from '@/lib/toast';
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
  UserPlus,
  FlaskConical,
  ChevronRight,
  ChevronLeft,
  Search,
  Check,
  MoreVertical,
  Minus
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Helper function to get human-readable campaign type labels
function getCampaignTypeLabel(type: string): string {
  const typeLabels: Record<string, string> = {
    'connector': 'Connector',
    'messenger': 'Messenger',
    'linkedin': 'Connector',
    'builder': 'Builder',
    'inbound': 'Inbound',
    'company_follow': 'Company Follow',
    'email': 'Email',
    'multi_channel': 'Multi-Channel'
  };
  return typeLabels[type] || (type ? type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Unknown');
}

export function CampaignBuilder({
  onClose,
  initialProspects,
  initialCampaignType,
  initialDraftId,
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
  initialCampaignType?: 'email' | 'linkedin' | 'connector' | 'messenger';
  initialDraftId?: string;
  draftToLoad?: any;
  onPrepareForApproval?: (campaignData: any) => void;
  workspaceId?: string | null;
  clientCode?: string | null;
  connectedAccounts: { linkedin: boolean; email: boolean };
  setConnectedAccounts: (accounts: { linkedin: boolean; email: boolean }) => void;
  setShowUnipileWizard: (show: boolean) => void;
  setUnipileProvider: (provider: 'LINKEDIN' | 'GOOGLE' | 'MICROSOFT' | null) => void;
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
    // Priority 1: Use initialCampaignType if provided (from approval screen pre-flight check)
    if (initialCampaignType) {
      // Map 'linkedin' to 'connector' for legacy support
      if (initialCampaignType === 'linkedin') return 'connector';
      // Return connector/messenger/email directly
      return initialCampaignType;
    }
    // Priority 2: Auto-detect from connected accounts
    if (!connectedAccounts.linkedin && connectedAccounts.email) {
      return 'email';
    }
    return 'connector';
  };
  const [campaignType, setCampaignType] = useState(getDefaultCampaignType());
  // Track if type was pre-selected from approval screen (skips type selection UI)
  const isTypePreSelected = initialCampaignType && ['connector', 'messenger', 'email'].includes(initialCampaignType);
  const [userSelectedCampaignType, setUserSelectedCampaignType] = useState(!!isTypePreSelected); // Pre-selected counts as selected
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Skip to Step 2 (Message Templates) if campaign type is pre-selected from approval screen
  const getInitialStep = () => {
    if (isTypePreSelected && initialProspects && initialProspects.length > 0) {
      return 2; // Skip directly to Message Templates
    }
    return 1;
  };
  const [currentStep, setCurrentStep] = useState(getInitialStep());
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null); // CRITICAL FIX: Track session_id from CSV uploads

  // CRITICAL FIX (Dec 7): IMMEDIATE sync when initialCampaignType arrives
  // Force re-calculation every time initialCampaignType changes to prevent race conditions
  useEffect(() => {
    if (initialCampaignType) {
      const newType = initialCampaignType === 'linkedin' ? 'connector' : initialCampaignType;
      console.log('🔄 [FORCE SYNC] campaignType:', initialCampaignType, '→', newType);
      setCampaignType(newType);
      setUserSelectedCampaignType(true);
    } else {
      // If initialCampaignType is explicitly cleared, reset to default
      console.log('⚠️ [RESET] initialCampaignType is undefined, keeping current:', campaignType);
    }
  }, [initialCampaignType]); // Re-run whenever initialCampaignType changes

  // Auto-populate CSV data when initialProspects are provided
  useEffect(() => {
    console.log('🔍 CampaignBuilder initialProspects check:', {
      hasProspects: !!initialProspects,
      length: initialProspects?.length,
      initialCampaignType,
      sample: initialProspects?.[0]
    });

    if (initialProspects && initialProspects.length > 0) {
      console.log('✅ Loading initialProspects into csvData:', initialProspects.length, 'prospects');
      console.log('📊 First prospect sample:', initialProspects[0]);
      const headers = ['name', 'title', 'company', 'email', 'linkedin_url', 'connection_degree'];
      setCsvHeaders(headers);
      setCsvData(initialProspects);
      setDataSource('approved');
      setShowPreview(true);

      // CRITICAL FIX (Dec 8): Load draft from database if initialDraftId is provided
      if (initialDraftId && workspaceId) {
        console.log('💾 Loading existing draft from database:', initialDraftId, 'workspace:', workspaceId);
        setCurrentDraftId(initialDraftId);

        // Fetch the draft from the API to get ALL data including prospects
        // CRITICAL: Must include workspaceId - API requires it for auth
        fetch(`/api/campaigns/draft?draftId=${initialDraftId}&workspaceId=${workspaceId}`)
          .then(res => res.json())
          .then(data => {
            // API returns { draft: ... } - no success field
            if (data.draft) {
              const draft = data.draft;
              console.log('✅ Draft loaded from database:', draft);

              // Set campaign name
              if (draft.name) {
                setName(draft.name);
                console.log('✅ Set campaign name from draft:', draft.name);
              }

              // Set campaign type
              if (draft.campaign_type) {
                const typeToSet = draft.campaign_type === 'linkedin' ? 'connector' : draft.campaign_type;
                setCampaignType(typeToSet);
                setUserSelectedCampaignType(true);
                console.log('✅ Set campaign type from draft:', draft.campaign_type, '→', typeToSet);
              }

              // CRITICAL FIX (Dec 8): Load ALL draft metadata (not just csvData)
              // Set current step (important for showing correct UI)
              if (draft.draft_data?.current_step !== undefined) {
                setCurrentStep(draft.draft_data.current_step);
                console.log('✅ Set current step from draft:', draft.draft_data.current_step);
              }

              // Load messages from draft_data
              if (draft.draft_data?.connection_message) {
                setConnectionMessage(draft.draft_data.connection_message);
                console.log('✅ Loaded connection message from draft');
              }
              if (draft.draft_data?.alternative_message) {
                setAlternativeMessage(draft.draft_data.alternative_message);
                console.log('✅ Loaded alternative message from draft');
              }
              if (draft.draft_data?.followup_messages && Array.isArray(draft.draft_data.followup_messages)) {
                setFollowUpMessages(draft.draft_data.followup_messages);
                console.log('✅ Loaded', draft.draft_data.followup_messages.length, 'follow-up messages from draft');
              }

              // Load campaign settings (timing/cadence)
              if (draft.draft_data?.campaign_settings) {
                setCampaignSettings(draft.draft_data.campaign_settings);
                console.log('✅ Loaded campaign settings from draft');
              }

              // Load prospects - CRITICAL FIX (Dec 8): initialProspects from user selection
              // takes HIGHEST priority. Database prospects are only used if no explicit selection.
              // Previous bug: Database prospects overwrote user's selection, causing 6 prospects
              // to appear when user only selected 2.
              if (initialProspects && initialProspects.length > 0) {
                // HIGHEST PRIORITY: User's explicit selection (from DataCollectionHub)
                // Already set at line 1886, don't override it!
                console.log('✅ Keeping', initialProspects.length, 'prospects from initialProspects (user selection - highest priority)');
                toastSuccess(`Loaded draft "${draft.name}" - using ${initialProspects.length} selected prospects`);
              } else if (draft.prospects && draft.prospects.length > 0) {
                // FALLBACK 1: Load from campaign_prospects table if no user selection
                setCsvData(draft.prospects);
                console.log('✅ Loaded', draft.prospects.length, 'prospects from campaign_prospects table');
                toastSuccess(`Loaded draft "${draft.name}" with ${draft.prospects.length} prospects`);
              } else if (draft.draft_data?.csvData && draft.draft_data.csvData.length > 0) {
                // FALLBACK 2: Legacy drafts stored prospects in draft_data.csvData
                setCsvData(draft.draft_data.csvData);
                console.log('✅ Loaded', draft.draft_data.csvData.length, 'prospects from legacy draft_data.csvData');
                toastSuccess(`Loaded draft "${draft.name}" with ${draft.draft_data.csvData.length} prospects`);
              } else {
                console.warn('⚠️ Draft has no prospects anywhere!');
              }
            } else {
              console.error('❌ Failed to load draft:', data.error || 'Unknown error');
              // Fallback to initialProspects
              if (initialProspects && initialProspects.length > 0) {
                setCsvData(initialProspects);
                setName(initialProspects[0]?.campaignName || 'New Campaign');
                if (initialCampaignType) {
                  const typeToSet = initialCampaignType === 'linkedin' ? 'connector' : initialCampaignType;
                  setCampaignType(typeToSet);
                  setUserSelectedCampaignType(true);
                }
              }
            }
          })
          .catch(error => {
            console.error('❌ Error fetching draft:', error);
            // Fallback to initialProspects
            if (initialProspects && initialProspects.length > 0) {
              setCsvData(initialProspects);
              setName(initialProspects[0]?.campaignName || 'New Campaign');
              if (initialCampaignType) {
                const typeToSet = initialCampaignType === 'linkedin' ? 'connector' : initialCampaignType;
                setCampaignType(typeToSet);
                setUserSelectedCampaignType(true);
              }
            }
          });
      } else {
        // No initialDraftId - use initialProspects directly (old flow)
        console.log('⚠️ No initialDraftId - loading prospects from initialProspects prop');

        // CRITICAL FIX (Dec 7): Set campaign name from prospects
        if (initialProspects[0]?.campaignName) {
          setName(initialProspects[0].campaignName);
          console.log('✅ Set campaign name:', initialProspects[0].campaignName);
        }

        // CRITICAL FIX (Dec 7): Sync campaign type IMMEDIATELY before saving
        if (initialCampaignType) {
          const typeToSet = initialCampaignType === 'linkedin' ? 'connector' : initialCampaignType;
          console.log('✅ Setting campaign type from prop:', initialCampaignType, '→', typeToSet);
          setCampaignType(typeToSet);
          setUserSelectedCampaignType(true);
        }

        // Extract session_id
        const sessionId = initialProspects[0]?.sessionId || initialProspects[0]?.session_id;
        if (sessionId) {
          console.log('✅ Extracted session_id:', sessionId);
          setUploadedSessionId(sessionId);
        }

        toastSuccess(`Loaded ${initialProspects.length} approved prospects - select campaign type`);
      }
    } else {
      console.log('⚠️ No initialProspects provided to CampaignBuilder');
    }
  }, [initialProspects, initialCampaignType, initialDraftId]);
  const [samMessages, setSamMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
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
    gcTime: 10 * 60 * 1000, // 10 minutes
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

  // A/B TESTING REMOVED (Dec 18, 2025) - Feature disabled
  const abTestingEnabled = false; // Kept for backwards compatibility
  // Placeholder A/B variables (feature disabled - kept for type safety)
  const connectionMessageB = '';
  const alternativeMessageB = '';
  const emailBodyB = '';
  const initialSubjectB = '';

  const [activeField, setActiveField] = useState<{ type: 'connection' | 'alternative' | 'followup', index?: number }>({ type: 'connection' });
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
  // NEW: Exact timing with {value, unit} objects instead of string ranges
  const [campaignSettings, setCampaignSettings] = useState<any>({
    connection_request_delay: { value: 2, unit: 'hours' },
    follow_up_delay: { value: 3, unit: 'days' },
    // Per-message delays: array matching followUpMessages length
    message_delays: [
      { value: 3, unit: 'days' },
      { value: 5, unit: 'days' },
      { value: 1, unit: 'weeks' },
      { value: 2, unit: 'weeks' },
      { value: 1, unit: 'months' }
    ]
  });

  // Helper to parse legacy string delays into structured format
  const parseDelay = (delay: any): { value: number; unit: string } => {
    if (typeof delay === 'object' && delay?.value !== undefined) return delay;
    if (typeof delay !== 'string') return { value: 3, unit: 'days' };

    // Parse legacy formats like "2-3 days", "1 week", "12-24 hours"
    const match = delay.match(/(\d+)(?:-\d+)?\s*(hour|day|week|month)/i);
    if (match) {
      const value = parseInt(match[1]);
      let unit = match[2].toLowerCase();
      if (!unit.endsWith('s')) unit += 's'; // Normalize to plural
      return { value, unit };
    }
    return { value: 3, unit: 'days' };
  };

  // Format delay for display
  const formatDelay = (delay: any): string => {
    const parsed = parseDelay(delay);
    const unit = parsed.value === 1 ? parsed.unit.replace(/s$/, '') : parsed.unit;
    return `${parsed.value} ${unit}`;
  };

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
    gcTime: 30 * 60 * 1000, // 30 minutes
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
    gcTime: 30 * 60 * 1000, // 30 minutes
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
      value: 'open_inmail',
      label: 'Open InMail',
      description: 'Message anyone with an Open Profile (free, no InMail credits needed). Requires LinkedIn Premium/Sales Navigator.',
      icon: Send
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
  // CRITICAL FIX (Dec 7): Accept optional prospectsOverride to bypass React state timing issues
  const saveDraft = async (force = false, prospectsOverride?: any[]) => {
    if (!name.trim() || !workspaceId) {
      if (force) {
        toastError(!name.trim() ? 'Please enter a campaign name' : 'No workspace selected');
      }
      return;
    }

    // Use prospectsOverride if provided, otherwise fall back to csvData state
    const prospectsToSave = prospectsOverride !== undefined ? prospectsOverride : csvData;

    // CRITICAL DEBUG: Log csvData before sending to API
    console.log('💾 [SAVE DRAFT] Preparing to save draft:', {
      name,
      campaignType,
      csvDataLength: csvData?.length || 0,
      prospectsOverrideLength: prospectsOverride?.length || 0,
      prospectsToSaveLength: prospectsToSave?.length || 0,
      usingOverride: prospectsOverride !== undefined,
      hasCsvData: !!csvData && csvData.length > 0,
      force
    });

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
          csvData: prospectsToSave,
        }),
      });

      console.log('💾 [SAVE DRAFT] API request sent with csvData:', prospectsToSave?.length || 0, 'prospects');

      const result = await response.json();

      if (result.success) {
        if (!currentDraftId) {
          setCurrentDraftId(result.draftId);
        }
        setLastSavedAt(new Date());
        if (force) {
          toastSuccess('Campaign draft saved! Find it in "Drafts" tab.');
          // NOTE: queryClient and refetch are not available in this component scope
          // Parent component will handle refreshing the drafts list
        }
      } else {
        if (force) {
          toastError(result.error || 'Failed to save draft');
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
    setUserSelectedCampaignType(true); // Dec 5: Treat draft type as user-selected to prevent auto-override
    setCurrentStep(draftToLoad.current_step || 1);
    setConnectionMessage(draftToLoad.connection_message || '');
    setAlternativeMessage(draftToLoad.alternative_message || '');
    setFollowUpMessages(draftToLoad.follow_up_messages || ['']);

    // CRITICAL FIX (Dec 8): Load prospects from `prospects` field (from campaign_prospects table)
    // NOT from draft_data.csvData (no longer used as of Dec 7 fix)
    if (draftToLoad.prospects && draftToLoad.prospects.length > 0) {
      console.log('✅ Loading', draftToLoad.prospects.length, 'prospects from campaign_prospects table');
      setCsvData(draftToLoad.prospects);
      setShowPreview(true);
    } else if (draftToLoad.draft_data?.csvData) {
      // Fallback for old drafts created before Dec 7 fix
      console.log('⚠️ Loading prospects from legacy draft_data.csvData (old draft format)');
      setCsvData(draftToLoad.draft_data.csvData);
      setShowPreview(true);
    } else {
      console.log('⚠️ No prospects found in draft');
    }

    toastInfo(`Loaded draft: ${draftToLoad.name}`);
  }, [draftToLoad]);

  // CRITICAL FIX (Dec 8): Load draft when initialDraftId is provided
  // This handles the flow from DataCollectionHub where draft is created BEFORE navigation
  useEffect(() => {
    if (!initialDraftId || !workspaceId) return;

    console.log('🔄 Loading draft from initialDraftId:', initialDraftId);

    const loadDraft = async () => {
      try {
        const response = await fetch(`/api/campaigns/draft?draftId=${initialDraftId}&workspaceId=${workspaceId}`);
        if (!response.ok) {
          console.error('Failed to load draft:', response.statusText);
          return;
        }

        const result = await response.json();
        const draft = result.draft;

        if (draft) {
          console.log('✅ Loaded draft from initialDraftId:', draft.id, 'with', draft.prospects?.length || 0, 'prospects');
          setCurrentDraftId(draft.id);
          setName(draft.name);
          setCampaignType(draft.campaign_type);
          setUserSelectedCampaignType(true);
          setCurrentStep(draft.current_step || 1);
          setConnectionMessage(draft.connection_message || '');
          setAlternativeMessage(draft.alternative_message || '');
          setFollowUpMessages(draft.follow_up_messages || ['']);

          // Load prospects from campaign_prospects table
          // Dec 8 CRITICAL FIX: Do NOT overwrite csvData if initialProspects was already provided
          // initialProspects contains the user's ACTUAL selection from DataCollectionHub
          // Loading draft.prospects would cause data leakage (all 6 prospects instead of selected 1)
          if (draft.prospects && draft.prospects.length > 0) {
            if (initialProspects && initialProspects.length > 0) {
              console.log('⏭️  SKIPPING draft.prospects load - initialProspects already set:', initialProspects.length, 'prospects (user selection takes priority)');
            } else {
              console.log('✅ Loading', draft.prospects.length, 'prospects from initialDraftId (no initialProspects)');
              setCsvData(draft.prospects);
              setShowPreview(true);
            }
          }

          toastInfo(`Loaded draft: ${draft.name}`);
        }
      } catch (error) {
        console.error('Error loading draft from initialDraftId:', error);
      }
    };

    loadDraft();
  }, [initialDraftId, workspaceId]);

  // Auto-save on changes (debounced)
  // CRITICAL (Dec 7): COMPLETELY DISABLE auto-save when initialDraftId prop exists OR initialProspects present
  useEffect(() => {
    if (!name.trim()) return;

    // CRITICAL FIX (Dec 7): If initialDraftId OR initialProspects exist, draft already created by DataCollectionHub
    // NEVER auto-save until user makes first manual save (lastSavedAt gets set)
    // This prevents race condition where campaignType changes before csvData loads
    if ((initialDraftId || initialProspects) && !lastSavedAt) {
      console.log('⏭️  Skipping auto-save - draft created by DataCollectionHub (initialDraftId:', initialDraftId, ', initialProspects:', initialProspects?.length, ')');
      return;
    }

    // CRITICAL FIX (Dec 7): NEVER auto-save empty drafts (prevents duplicates with 0 prospects)
    // This happens when campaignType changes but csvData hasn't loaded yet
    if (csvData.length === 0) {
      console.log('⏭️  Skipping auto-save - no prospects in csvData yet (length:', csvData.length, ')');
      return;
    }

    const timeoutId = setTimeout(() => {
      console.log('💾 Auto-saving draft with campaignType:', campaignType, 'csvData:', csvData.length, 'prospects');
      saveDraft();
    }, 2000); // Save 2 seconds after last change

    return () => {
      console.log('🚫 Cancelling auto-save timeout (campaignType or other deps changed)');
      clearTimeout(timeoutId);
    };
  }, [name, campaignType, currentStep, connectionMessage, alternativeMessage, followUpMessages, csvData, currentDraftId, initialDraftId, initialProspects, lastSavedAt]);

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
    const newDelays = [...(campaignSettings.message_delays || []), { value: 3, unit: 'days' }];
    setCampaignSettings({ ...campaignSettings, message_delays: newDelays });
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
      setCampaignSettings({ ...campaignSettings, message_delays: newDelays });
    }
  };

  // Update message delay - now handles structured {value, unit} objects
  const updateMessageDelay = (index: number, field: 'value' | 'unit', newValue: number | string) => {
    const newDelays = [...(campaignSettings.message_delays || [])];
    const current = parseDelay(newDelays[index]);
    if (field === 'value') {
      current.value = typeof newValue === 'number' ? newValue : parseInt(newValue as string) || 1;
    } else {
      current.unit = newValue as string;
    }
    newDelays[index] = current;
    setCampaignSettings({ ...campaignSettings, message_delays: newDelays });
  };

  // Update follow-up delay (single value, not array)
  const updateFollowUpDelay = (field: 'value' | 'unit', newValue: number | string) => {
    const current = parseDelay(campaignSettings.follow_up_delay);
    if (field === 'value') {
      current.value = typeof newValue === 'number' ? newValue : parseInt(newValue as string) || 1;
    } else {
      current.unit = newValue as string;
    }
    setCampaignSettings({ ...campaignSettings, follow_up_delay: current });
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

      if (!result.success) {
        const errorMessage = result.error || 'Failed to parse template';
        console.error('Parse template failed:', result);
        toastError(`Error: ${errorMessage}`);
        return;
      }

      setParsedPreview(result.parsed);

      // Show warning if fallback was used
      if (result.warning) {
        console.warn('⚠️ Parse warning:', result.warning);
        toastWarning(`Using original text (AI parsing had issues)`);
      } else {
        toastSuccess('Template parsed successfully!');
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
          rawText: `CONNECTION MESSAGE:\n${parsedPreview.connectionMessage}\n\n${parsedPreview.alternativeMessage ? `ALTERNATIVE MESSAGE:\n${parsedPreview.alternativeMessage}\n\n` : ''
            }${parsedPreview.followUpMessages && parsedPreview.followUpMessages.length > 0
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
      // Handle FileReader errors to prevent silent failures
      reader.onerror = () => {
        console.error('FileReader error:', reader.error);
        toastError('Failed to read CSV file. Please try again.');
        setIsUploading(false);
      };
      // Handle abort case
      reader.onabort = () => {
        console.warn('FileReader aborted');
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
        // CRITICAL FIX (Dec 17): For messenger campaigns, the "Initial Message" is in alternativeMessage,
        // NOT in followUpMessages[0]. The approval screen displays follow_up_1 as "INITIAL MESSAGE"
        // for messenger campaigns, so we need to put alternativeMessage there.
        follow_up_1: campaignType === 'messenger' ? (alternativeMessage || '') : (followUpMessages[0] || ''),
        follow_up_2: campaignType === 'messenger' ? (followUpMessages[0] || '') : (followUpMessages[1] || ''),
        follow_up_3: campaignType === 'messenger' ? (followUpMessages[1] || '') : (followUpMessages[2] || ''),
        follow_up_4: campaignType === 'messenger' ? (followUpMessages[2] || '') : (followUpMessages[3] || ''),
        follow_up_5: campaignType === 'messenger' ? (followUpMessages[3] || '') : (followUpMessages[4] || '')
      },
      // Include message timing/cadence settings
      message_delays: campaignSettings.message_delays || [{ value: 3, unit: 'days' }, { value: 5, unit: 'days' }, { value: 1, unit: 'weeks' }, { value: 2, unit: 'weeks' }, { value: 1, unit: 'months' }],
      // A/B Testing fields
      ab_testing: abTestingEnabled ? {
        enabled: true,
        connection_request_b: connectionMessageB,
        alternative_message_b: alternativeMessageB,
        email_body_b: emailBodyB,
        initial_subject_b: initialSubjectB
      } : null,
      // Store additional data needed for execution
      _executionData: {
        campaignType,
        alternativeMessage,
        followUpMessages,
        message_delays: campaignSettings.message_delays,
        ab_testing_enabled: abTestingEnabled,
        connection_message_b: connectionMessageB,
        alternative_message_b: alternativeMessageB,
        email_body_b: emailBodyB,
        initial_subject_b: initialSubjectB
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
          session_id: sessionId, // CRITICAL FIX: Include session_id for auto-transfer of approved prospects
          // A/B Testing fields - stored in message_templates
          ab_testing_enabled: abTestingEnabled,
          connection_request_b: abTestingEnabled ? connectionMessageB : undefined,
          alternative_message_b: abTestingEnabled ? alternativeMessageB : undefined,
          email_body_b: abTestingEnabled ? emailBodyB : undefined,
          initial_subject_b: abTestingEnabled ? initialSubjectB : undefined
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
              <h2 className="text-xl font-semibold text-white">{name || 'New Campaign'}</h2>
              <p className="text-gray-400 text-sm">{getCampaignTypeLabel(campaignType)} Campaign</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={() => {
                if (currentStep > 1) {
                  // Go back to Step 1
                  setCurrentStep(1);
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

        {/* Step Indicator - 2 steps: Campaign Setup → Message Templates */}
        <div className="flex items-center mb-8">
          {[1, 2].map((step) => (
            <div key={step} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step <= currentStep ? 'bg-purple-600 text-white' : 'bg-gray-600 text-gray-400'
                }`}>
                {step}
              </div>
              {step < 2 && (
                <div className={`w-16 h-1 mx-2 ${step < currentStep ? 'bg-purple-600' : 'bg-gray-600'
                  }`} />
              )}
            </div>
          ))}
          <div className="ml-4 text-sm text-gray-400">
            Step {currentStep} of 2: {
              currentStep === 1 ? 'Campaign Setup' : 'Message Templates'
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

            {/* Timezone Override */}
            <div className="space-y-2">
              <label htmlFor="campaign-timezone" className="block text-sm font-medium text-gray-400">
                Prospect Timezone
              </label>
              <p className="text-xs text-gray-500 mb-2">
                Messages will be sent during business hours (9 AM - 6 PM) in this timezone
              </p>
              <select
                id="campaign-timezone"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                value={campaignSettings.timezone}
                onChange={e => setCampaignSettings({ ...campaignSettings, timezone: e.target.value })}
              >
                <option value="America/New_York">US Eastern (New York)</option>
                <option value="America/Chicago">US Central (Chicago)</option>
                <option value="America/Denver">US Mountain (Denver)</option>
                <option value="America/Los_Angeles">US Pacific (Los Angeles)</option>
                <option value="Europe/London">UK (London)</option>
                <option value="Europe/Paris">Central Europe (Paris)</option>
                <option value="Europe/Berlin">Germany (Berlin)</option>
                <option value="Europe/Amsterdam">Netherlands (Amsterdam)</option>
                <option value="Europe/Zurich">Switzerland (Zurich)</option>
                <option value="Asia/Singapore">Singapore</option>
                <option value="Asia/Tokyo">Japan (Tokyo)</option>
                <option value="Asia/Shanghai">China (Shanghai)</option>
                <option value="Asia/Dubai">UAE (Dubai)</option>
                <option value="Australia/Sydney">Australia (Sydney)</option>
                <option value="Pacific/Auckland">New Zealand (Auckland)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-3">
                Campaign Type
              </label>

              {/* PRE-SELECTED: Show simple confirmation when type was chosen in approval screen */}
              {isTypePreSelected && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                      {campaignType === 'connector' && <UserPlus className="text-green-400" size={20} />}
                      {campaignType === 'messenger' && <MessageSquare className="text-green-400" size={20} />}
                      {campaignType === 'email' && <Mail className="text-green-400" size={20} />}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {campaignType === 'connector' && 'LinkedIn Connector Campaign'}
                        {campaignType === 'messenger' && 'LinkedIn Messenger Campaign'}
                        {campaignType === 'email' && 'Email Campaign'}
                      </p>
                      <p className="text-green-400 text-sm">✓ Pre-verified from approval screen</p>
                    </div>
                  </div>
                </div>
              )}

              {/* MANUAL SELECTION: Show full type picker when not pre-selected */}
              {!isTypePreSelected && connectionDegrees.total > 0 && (
                <div className={`border rounded-lg p-3 mb-4 ${!hasConnectionDegreeData
                  ? 'bg-yellow-900/20 border-yellow-500/30'
                  : 'bg-blue-900/20 border-blue-500/30'
                  }`}>
                  <p className={`text-sm ${!hasConnectionDegreeData ? 'text-yellow-300' : 'text-blue-300'
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
              {!isTypePreSelected && (
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

                    // Check if prospects have email addresses
                    const prospects = csvData.length > 0 ? csvData : (initialProspects || []);
                    const prospectsWithEmail = prospects.filter(p => p.email || p.email_address || p.contact?.email);
                    const hasEmailAddresses = prospectsWithEmail.length > 0;
                    const emailProspectCount = prospectsWithEmail.length;

                    let isDisabled = false;
                    let disabledReason = '';
                    let needsConnection: 'linkedin' | 'email' | 'both' | null = null;

                    // NEW: For mixed connection degrees/email, show how many will be included
                    // Messenger → only 1st degree, Connector → only 2nd/3rd degree, Email → only with email
                    let matchingProspectCount = 0;
                    let prospectBadge = '';

                    if (isMessenger && connectionDegrees.total > 0) {
                      matchingProspectCount = connectionDegrees.firstDegree;
                      if (connectionDegrees.secondThird > 0) {
                        prospectBadge = `${matchingProspectCount} of ${connectionDegrees.total} prospects`;
                      }
                    } else if (isConnector && connectionDegrees.total > 0) {
                      matchingProspectCount = connectionDegrees.secondThird;
                      if (connectionDegrees.firstDegree > 0) {
                        prospectBadge = `${matchingProspectCount} of ${connectionDegrees.total} prospects`;
                      }
                    } else if (isEmail && prospects.length > 0) {
                      matchingProspectCount = emailProspectCount;
                      const prospectsWithoutEmail = prospects.length - emailProspectCount;
                      if (prospectsWithoutEmail > 0) {
                        prospectBadge = `${matchingProspectCount} of ${prospects.length} prospects (have email)`;
                      }
                    }

                    // Multi is always disabled (in development)
                    if (isMultichannel) {
                      isDisabled = true;
                      disabledReason = '🚧 In Development - Multi-channel campaigns coming soon';
                    }
                    // Check connection degree restrictions - ONLY disable if 0 matching prospects
                    else if (connectionDegrees.total > 0) {
                      // Disable Connector ONLY if there are NO 2nd/3rd degree prospects
                      if (isConnector && connectionDegrees.secondThird === 0) {
                        isDisabled = true;
                        disabledReason = 'All prospects are 1st degree - use Messenger for direct messages';
                      }
                      // Disable Messenger ONLY if there are NO 1st degree prospects
                      if (isMessenger && connectionDegrees.firstDegree === 0) {
                        isDisabled = true;
                        disabledReason = 'All prospects are 2nd/3rd degree - use Connector to send connection requests first';
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
                        className={`p-5 border-2 rounded-lg transition-all ${isDisabled
                          ? 'border-gray-700 bg-gray-800/50 opacity-50'
                          : campaignType === type.value
                            ? 'border-purple-500 bg-gradient-to-br from-purple-900/40 to-blue-900/40 cursor-pointer shadow-lg shadow-purple-500/20'
                            : 'border-gray-600 bg-gray-700/50 hover:border-purple-400 hover:bg-gray-700 cursor-pointer'
                          } ${needsConnection ? '' : isDisabled ? 'cursor-not-allowed' : ''}`}
                        title={isDisabled && !needsConnection ? `Not available: ${disabledReason}` : ''}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${campaignType === type.value
                            ? 'bg-purple-600'
                            : 'bg-gray-600'
                            }`}>
                            <IconComponent className="text-white" size={20} />
                          </div>
                          <h4 className="text-white font-semibold text-base">{type.label}</h4>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">{type.description}</p>
                        {/* Show prospect count badge for mixed connection degrees */}
                        {!isDisabled && prospectBadge && (
                          <div className="mt-2 inline-flex items-center px-2 py-1 bg-purple-900/40 border border-purple-500/30 rounded text-xs text-purple-300">
                            📊 {prospectBadge}
                          </div>
                        )}
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
              )}
              {!isTypePreSelected && connectionDegrees.total > 0 && (campaignType === 'messenger' || campaignType === 'connector') && (
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
              {!isTypePreSelected && campaignType === 'email' && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3 mt-3">
                  <p className="text-blue-300 text-sm">
                    <strong>Selected:</strong> Email campaign - Direct email outreach without LinkedIn connection requests
                  </p>
                </div>
              )}
              {!isTypePreSelected && campaignType === 'multichannel' && (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mt-3">
                  <p className="text-purple-300 text-sm">
                    <strong>Selected:</strong> Multichannel campaign - Combine LinkedIn and email outreach
                  </p>
                </div>
              )}
              {!isTypePreSelected && has1stDegree && !hasOnly1stDegree && campaignType === 'connector' && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-3 mt-3">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ <strong>Warning:</strong> {connectionDegrees.firstDegree} of your prospects are 1st degree connections and will be skipped in Connector campaigns. Consider using <strong>Builder</strong> instead.
                  </p>
                </div>
              )}
            </div>

          </div>
        )}

        {/* Step 2: Message Templates (Connector Campaign) */}
        {currentStep === 2 && campaignType === 'connector' && (
          <div className="space-y-6">
            {/* Campaign Name - Editable in Step 2 */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                placeholder="Enter campaign name..."
              />
            </div>

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

            {/* A/B Testing Toggle */}
            <div className="bg-orange-900/20 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BarChart3 className="text-orange-400" size={20} />
                  <div>
                    <h4 className="text-orange-400 font-medium">A/B Testing</h4>
                    <p className="text-xs text-gray-400">Test different message variants (50/50 split)</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={abTestingEnabled}
                    onChange={(e) => setAbTestingEnabled(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
              {abTestingEnabled && (
                <p className="text-xs text-orange-300 mt-2">
                  Variant B inputs will appear below each message field. 50% of prospects will receive Variant A, 50% will receive Variant B.
                </p>
              )}
            </div>

            {/* ONLY show Connection Request for Connector campaigns */}
            {campaignType === 'connector' && (
              <div className="space-y-2">
                <label htmlFor="connection-message" className="block text-sm font-medium text-gray-400">
                  Connection Request Message {abTestingEnabled && <span className="text-orange-400">(Variant A - 50%)</span>}
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
                    setActiveField({ type: 'connection' });
                    setActiveTextarea(e.target as HTMLTextAreaElement);
                  }}
                  placeholder="Hi {first_name}, I saw your profile and would love to connect..."
                  maxLength={275}
                />
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${connectionMessage.length > 250 ? 'text-orange-400' :
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

            {/* Connection Request Message - Variant B (only when A/B testing is enabled) */}
            {campaignType === 'connector' && abTestingEnabled && (
              <div className="border-l-4 border-orange-500 pl-4 space-y-2">
                <label htmlFor="connection-message-b" className="block text-sm font-medium text-gray-400">
                  Connection Request Message <span className="text-orange-400">(Variant B - 50%)</span>
                </label>
                <p className="text-xs text-gray-500">
                  Alternative version to test against Variant A
                </p>
                <textarea
                  id="connection-message-b"
                  className="w-full px-4 py-2 bg-gray-700 border border-orange-500/50 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                  rows={4}
                  value={connectionMessageB}
                  onChange={e => setConnectionMessageB(e.target.value)}
                  placeholder="Hi {first_name}, I came across your profile and..."
                  maxLength={275}
                />
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-medium ${connectionMessageB.length > 250 ? 'text-orange-400' :
                    connectionMessageB.length > 270 ? 'text-red-400' :
                      'text-gray-400'
                    }`}>
                    {connectionMessageB.length}/275 characters
                  </span>
                  <p className="text-xs text-gray-500">Test a different hook, value prop, or CTA</p>
                </div>
              </div>
            )}

            {/* ONLY show Alternative Message for Connector campaigns */}
            {campaignType === 'connector' && (
              <div className="space-y-2">
                <label htmlFor="alternative-message" className="block text-sm font-medium text-gray-400">
                  Alternative Message (Optional) {abTestingEnabled && <span className="text-orange-400">(Variant A)</span>}
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
                    setActiveField({ type: 'alternative' });
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

            {/* Alternative Message - Variant B (only when A/B testing is enabled) */}
            {campaignType === 'connector' && abTestingEnabled && (
              <div className="border-l-4 border-orange-500 pl-4 space-y-2">
                <label htmlFor="alternative-message-b" className="block text-sm font-medium text-gray-400">
                  Alternative Message <span className="text-orange-400">(Variant B)</span>
                </label>
                <textarea
                  id="alternative-message-b"
                  className="w-full px-4 py-2 bg-gray-700 border border-orange-500/50 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                  rows={2}
                  value={alternativeMessageB}
                  onChange={e => setAlternativeMessageB(e.target.value)}
                  placeholder="Great to connect with professionals like you!"
                  maxLength={115}
                />
                <span className="text-xs text-gray-500">
                  Characters remaining: {115 - alternativeMessageB.length}/115
                </span>
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
                // Helper function to get message label
                const getMessageLabel = () => {
                  if (index === 0) return 'Message 2 (First Follow-up)';
                  if (index === 4) return 'Message 6 (Goodbye message)';
                  return `Message ${index + 2}`;
                };

                const getMessagePlaceholder = () => {
                  if (index === 0) return 'Your first follow-up message...';
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
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          className="w-16 bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
                          value={parseDelay((campaignSettings.message_delays || [])[index]).value}
                          onChange={(e) => updateMessageDelay(index, 'value', parseInt(e.target.value) || 1)}
                        />
                        <select
                          className="bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                          value={parseDelay((campaignSettings.message_delays || [])[index]).unit}
                          onChange={(e) => updateMessageDelay(index, 'unit', e.target.value)}
                        >
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                      rows={3}
                      value={message}
                      onChange={e => updateFollowUpMessage(index, e.target.value)}
                      onFocus={(e) => {
                        setActiveField({ type: 'followup', index });
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
                              showConfirmModal({
                                title: 'Remove Message',
                                message: `Remove Message ${index + 2}?`,
                                confirmText: 'Remove',
                                confirmVariant: 'danger',
                                onConfirm: () => {
                                  removeFollowUpMessage(index);
                                  toastSuccess(`Message ${index + 2} removed`);
                                }
                              });
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

                              const messageType = index === 0 ? 'Message 2 (first follow-up)' :
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
                                  user_input: `Please improve this follow-up message (${messageType}). ${index === 4 ? 'This is a goodbye message - keep it polite and leave the door open.' : 'Make it engaging and valuable.'}\n\nCurrent message:\n"${message}"\n\nMake it more effective while optionally using personalization placeholders like {first_name}, {company_name}, {title}.`,
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

          </div>
        )}

        {/* Step 2: Message Templates (Messenger Campaign - 1st degree connections) */}
        {currentStep === 2 && campaignType === 'messenger' && (
          <div className="space-y-6">
            {/* Campaign Name - Editable in Step 2 */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                placeholder="Enter campaign name..."
              />
            </div>

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
                  setActiveField({ type: 'alternative' });
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

            {/* A/B Testing Toggle for Messenger */}
            <div className="bg-orange-600/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FlaskConical className="text-orange-400 mr-2" size={20} />
                  <h4 className="text-white font-medium">A/B Testing</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={abTestingEnabled}
                    onChange={(e) => setAbTestingEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
              <p className="text-gray-400 text-sm">
                Test two different initial messages with a 50/50 split to see which performs better.
              </p>
            </div>

            {/* Variant B Initial Message (shown when A/B testing enabled) */}
            {abTestingEnabled && (
              <div className="space-y-2 border-l-4 border-orange-500 pl-4">
                <label htmlFor="messenger-initial-message-b" className="block text-sm font-medium text-orange-400">
                  Variant B - Initial Message
                </label>
                <p className="text-xs text-gray-500">
                  Alternative initial message (50% of prospects will receive this)
                </p>
                <textarea
                  id="messenger-initial-message-b"
                  className="w-full px-4 py-2 bg-gray-700 border border-orange-500/50 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                  rows={4}
                  value={alternativeMessageB}
                  onChange={e => setAlternativeMessageB(e.target.value)}
                  placeholder="Hi {{first_name}}, [different approach here]..."
                />
                <span className="text-xs text-gray-400">
                  Characters: {alternativeMessageB.length}
                </span>
              </div>
            )}

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
                // Helper function to get message label
                const getMessageLabel = () => {
                  if (index === 0) return 'Message 2 (First Follow-up)';
                  if (index === 4) return 'Message 6 (Goodbye message)';
                  return `Message ${index + 2}`;
                };

                const getMessagePlaceholder = () => {
                  if (index === 0) return 'Your first follow-up message...';
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
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="99"
                          className="w-16 bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
                          value={parseDelay((campaignSettings.message_delays || [])[index]).value}
                          onChange={(e) => updateMessageDelay(index, 'value', parseInt(e.target.value) || 1)}
                        />
                        <select
                          className="bg-gray-700 border-2 border-gray-600 rounded-lg px-3 py-2 text-white text-sm font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                          value={parseDelay((campaignSettings.message_delays || [])[index]).unit}
                          onChange={(e) => updateMessageDelay(index, 'unit', e.target.value)}
                        >
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                          <option value="weeks">Weeks</option>
                          <option value="months">Months</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                      rows={4}
                      value={message}
                      onChange={e => updateFollowUpMessage(index, e.target.value)}
                      onFocus={(e) => {
                        setActiveField({ type: 'followup', index });
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
                              showConfirmModal({
                                title: 'Remove Message',
                                message: `Remove Message ${index + 2}?`,
                                confirmText: 'Remove',
                                confirmVariant: 'danger',
                                onConfirm: () => {
                                  removeFollowUpMessage(index);
                                  toastSuccess(`Message ${index + 2} removed`);
                                }
                              });
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

                              const messageType = index === 0 ? 'Message 2 (first follow-up)' :
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
                                  user_input: `Please improve this follow-up message for messenger campaign (${messageType}). ${index === 4 ? 'This is a goodbye message - keep it polite and leave the door open.' : 'Make it engaging and valuable.'}\n\nCurrent message:\n"${message}"\n\nMake it more effective while optionally using personalization placeholders like {first_name}, {company_name}, {title}.`,
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

          </div>
        )}

        {/* Step 2: Message Templates (Email Campaign) */}
        {currentStep === 2 && campaignType === 'email' && (
          <div className="space-y-6">
            {/* Campaign Name - Editable in Step 2 */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
              <label className="block text-sm font-medium text-gray-400 mb-2">Campaign Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                placeholder="Enter campaign name..."
              />
            </div>

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
                    setActiveField({ type: 'alternative' });
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

            {/* A/B Testing Toggle for Email */}
            <div className="bg-orange-600/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  <FlaskConical className="text-orange-400 mr-2" size={20} />
                  <h4 className="text-white font-medium">A/B Testing</h4>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={abTestingEnabled}
                    onChange={(e) => setAbTestingEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                </label>
              </div>
              <p className="text-gray-400 text-sm">
                Test two different initial emails with a 50/50 split to see which performs better.
              </p>
            </div>

            {/* Variant B Email (shown when A/B testing enabled) */}
            {abTestingEnabled && (
              <div className="space-y-3 border-l-4 border-orange-500 pl-4">
                <label className="block text-sm font-medium text-orange-400">
                  Variant B - Initial Email
                </label>
                <p className="text-xs text-gray-500">
                  Alternative initial email (50% of prospects will receive this)
                </p>

                {/* Variant B Subject Line */}
                <div className="space-y-1">
                  <label htmlFor="email-initial-subject-b" className="block text-xs text-gray-500">
                    Subject Line (Variant B)
                  </label>
                  <input
                    id="email-initial-subject-b"
                    type="text"
                    className="w-full bg-gray-700 border border-orange-500/50 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none"
                    value={initialSubjectB}
                    onChange={e => setInitialSubjectB(e.target.value)}
                    placeholder="e.g., Alternative subject for {{company_name}}"
                  />
                </div>

                {/* Variant B Email Body */}
                <div className="space-y-1">
                  <label htmlFor="email-body-b" className="block text-xs text-gray-500">
                    Email Body (Variant B)
                  </label>
                  <textarea
                    id="email-body-b"
                    className="w-full px-4 py-2 bg-gray-700 border border-orange-500/50 rounded-lg text-white placeholder-gray-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
                    rows={6}
                    value={emailBodyB}
                    onChange={e => setEmailBodyB(e.target.value)}
                    placeholder="Hi {{first_name}},&#10;&#10;[Different approach here]...&#10;&#10;Would love to connect!"
                  />
                </div>
                <span className="text-xs text-gray-400">
                  Characters: {emailBodyB.length}
                </span>
              </div>
            )}

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
                          setActiveField({ type: 'followup', index });
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
                        min="1"
                        className="w-16 bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-center font-semibold focus:border-purple-500 focus:outline-none"
                        value={parseDelay((campaignSettings.message_delays || [])[index]).value}
                        onChange={(e) => updateMessageDelay(index, 'value', parseInt(e.target.value) || 1)}
                      />
                      <select
                        className="bg-gray-700 border-2 border-gray-600 rounded-lg px-2 py-2 text-white text-xs font-medium cursor-pointer hover:border-purple-500 focus:border-purple-500 focus:outline-none"
                        value={parseDelay((campaignSettings.message_delays || [])[index]).unit}
                        onChange={(e) => updateMessageDelay(index, 'unit', e.target.value)}
                      >
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                      </select>
                    </div>
                  </div>
                  {message.length > 0 && followUpMessages.length > 1 && (
                    <div className="flex justify-between items-center mt-2">
                      <button
                        type="button"
                        className="flex items-center px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg transition-colors"
                        onClick={() => {
                          showConfirmModal({
                            title: 'Remove Follow-up',
                            message: `Remove Follow-up ${index + 1}?`,
                            confirmText: 'Remove',
                            confirmVariant: 'danger',
                            onConfirm: () => {
                              removeFollowUpMessage(index);
                              toastSuccess(`Follow-up ${index + 1} removed`);
                            }
                          });
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
              // Go back to Step 1
              setCurrentStep(1);
            }}
            disabled={currentStep === 1}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors"
          >
            Previous
          </button>

          <div className="flex gap-3">
            {currentStep < 2 ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    console.log('🔘 Continue button clicked', {
                      currentStep,
                      campaignType,
                      hasConnectionDegreeData,
                      csvDataLength: csvData.length,
                      initialProspectsLength: initialProspects?.length || 0
                    });

                    // Validate connection degree for LinkedIn campaigns before proceeding
                    if (currentStep === 1 && (campaignType === 'connector' || campaignType === 'messenger')) {
                      // Check if we have connection degree data
                      if (!hasConnectionDegreeData && csvData.length > 0) {
                        console.log('❌ Blocked by connection degree validation');
                        toastError('LinkedIn campaigns require connection degree data. Please add a "Connection Degree" column to your CSV with values like "1st", "2nd", or "3rd", then re-upload.');
                        return;
                      }
                    }

                    console.log('✅ Moving to Step 2');
                    // Go to Step 2 (Message Templates)
                    setCurrentStep(2);
                  }}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {initialProspects && initialProspects.length > 0
                    ? 'Continue to Messages'
                    : 'Next Step'}
                </button>
                {/* Save Draft button - available on Step 1 so user can save without prospects */}
                <button
                  type="button"
                  onClick={() => saveDraft(true)}
                  disabled={isSavingDraft || !name.trim() || !workspaceId}
                  className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {isSavingDraft ? 'Saving...' : 'Save Draft'}
                </button>
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
                  onClick={() => saveDraft(true)}
                  disabled={isSavingDraft || !name.trim() || !workspaceId}
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
                    <p className="text-gray-500 text-xs mb-2">Include CR + all follow-ups. Labels like "CR1", "FU1" will be removed automatically.</p>
                    <textarea
                      id="paste-text"
                      value={pastedText}
                      onChange={(e) => setPastedText(e.target.value)}
                      placeholder="Example:

CR1 (250 chars)
Hi [First Name], I noticed we both work in the leadership space. Looking forward to staying in touch.

FU1 — Day 3
Hi [First Name], thanks for connecting. I wanted to share a case study...

FU2 — Day 7
Hi [First Name], quick follow-up on my previous message..."
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
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedKBTemplate?.id === template.id
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
                      className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedPreviousCampaign?.id === campaign.id
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-gray-600 hover:border-gray-500 bg-gray-700/50'
                        }`}
                      onClick={() => setSelectedPreviousCampaign(campaign)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-white font-medium mb-1">{campaign.name || 'Untitled Campaign'}</h4>
                          <p className="text-gray-400 text-sm mb-2">
                            Type: {getCampaignTypeLabel(campaign.campaign_type || campaign.type || 'connector')}
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
