'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Save, Upload, XCircle, Clock, Calendar, Mail, AlertCircle, Info } from 'lucide-react';
import { toastError, toastSuccess, toastInfo } from '@/lib/toast';
import { UnipileModal } from '@/components/integrations/UnipileModal';
import EmailProvidersModal from './EmailProvidersModal';


interface CampaignApprovalScreenProps {
  campaignData: {
    name: string;
    type: 'LinkedIn' | 'Email' | 'Multi-channel';
    campaignType?: 'connector' | 'messenger' | 'builder'; // Add specific campaign type
    prospects: any[];
    messages?: {
      connection_request?: string;
      follow_up_1?: string;
      follow_up_2?: string;
      follow_up_3?: string;
      follow_up_4?: string;
      follow_up_5?: string;
    };
  };
  workspaceId: string;
  userTimezone?: string | null; // User's saved timezone preference from profile
  onApprove: (finalCampaignData: any) => void;
  onReject: () => void;
  onRequestSAMHelp: (context: string) => void;
}

export default function CampaignApprovalScreen({
  campaignData,
  workspaceId,
  userTimezone,
  onApprove,
  onReject,
  onRequestSAMHelp
}: CampaignApprovalScreenProps) {
  const [messages, setMessages] = useState(campaignData.messages || {});
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    timing: true,
    messages: true,
    templates: false
  });

  // Channel type selection state
  const [channelType, setChannelType] = useState<'linkedin' | 'email'>(
    campaignData.type === 'Email' ? 'email' : 'linkedin'
  );

  // Connection wizards state
  const [showLinkedInWizard, setShowLinkedInWizard] = useState(false);
  const [showEmailWizard, setShowEmailWizard] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState({
    linkedin: false,
    email: false
  });

  // Timing controls for flow_settings
  const [connectionWait, setConnectionWait] = useState(36); // hours (12-96)
  const [followupWait, setFollowupWait] = useState(5);      // days (1-30)

  // Timezone selection (uses saved preference or defaults to ET)
  const [selectedTimezone, setSelectedTimezone] = useState(userTimezone || 'America/New_York');

  // Business hours and holiday settings - DISABLED FOR TESTING
  const [workingHoursStart, setWorkingHoursStart] = useState(0);   // 12am (no restriction)
  const [workingHoursEnd, setWorkingHoursEnd] = useState(23);     // 11pm (no restriction)
  const [skipWeekends, setSkipWeekends] = useState(false);        // Allow weekends
  const [skipHolidays, setSkipHolidays] = useState(false);        // Allow holidays

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Check connected accounts on mount
  useEffect(() => {
    const checkConnectedAccounts = async () => {
      try {
        const response = await fetch(`/api/workspace-accounts/check?workspace_id=${workspaceId}`);
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

    checkConnectedAccounts();
  }, [workspaceId]);

  // Load saved templates on mount
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        const response = await fetch(`/api/messaging-templates/list?workspace_id=${workspaceId}`);
        if (response.ok) {
          const data = await response.json();
          setSavedTemplates(data.templates || []);
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    };
    loadTemplates();
  }, [workspaceId]);

  // Autosave on message changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      handleSaveTemplate(true); // silent autosave
    }, 3000);

    return () => clearTimeout(timeoutId);
  }, [messages]);

  const handleUploadTemplate = () => {
    setShowTemplateLibrary(!showTemplateLibrary);
  };

  // Handle channel type change with account validation
  const handleChannelTypeChange = (type: 'linkedin' | 'email') => {
    // Check if account is connected
    if (type === 'linkedin' && !connectedAccounts.linkedin) {
      toastInfo('Please connect your LinkedIn account first');
      setShowLinkedInWizard(true);
      return;
    }

    if (type === 'email' && !connectedAccounts.email) {
      toastInfo('Please connect your email account first');
      setShowEmailWizard(true);
      return;
    }

    // Account is connected, proceed
    setChannelType(type);
    toastSuccess(`Switched to ${type === 'linkedin' ? 'LinkedIn' : 'Email'} campaign`);
  };

  // Recheck accounts after wizard closes
  const handleWizardClose = async () => {
    setShowLinkedInWizard(false);
    setShowEmailWizard(false);

    // Recheck connected accounts
    try {
      const response = await fetch(`/api/workspace-accounts/check?workspace_id=${workspaceId}`);
      const data = await response.json();

      if (data.success) {
        const newConnectedAccounts = {
          linkedin: data.linkedin_connected || false,
          email: data.email_connected || false
        };
        setConnectedAccounts(newConnectedAccounts);

        // If account was just connected, switch to that channel
        if (!connectedAccounts.linkedin && newConnectedAccounts.linkedin) {
          setChannelType('linkedin');
          toastSuccess('LinkedIn account connected! You can now create LinkedIn campaigns.');
        }
        if (!connectedAccounts.email && newConnectedAccounts.email) {
          setChannelType('email');
          toastSuccess('Email account connected! You can now create email campaigns.');
        }
      }
    } catch (error) {
      console.error('Failed to recheck accounts:', error);
    }
  };

  const handleSaveTemplate = async (silent = false) => {
    if (!messages.connection_request?.trim() && !messages.follow_up_1?.trim()) {
      if (!silent) toastError('Add at least one message to save');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/messaging-templates/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          campaign_name: campaignData.name,
          campaign_type: campaignData.type.toLowerCase(),
          connection_message: messages.connection_request || '',
          alternative_message: messages.follow_up_1 || '',
          follow_up_messages: [
            messages.follow_up_2 || '',
            messages.follow_up_3 || '',
            messages.follow_up_4 || '',
            messages.follow_up_5 || ''
          ].filter(m => m.trim())
        })
      });

      if (response.ok) {
        if (!silent) toastSuccess('Template saved!');
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      console.error('Save error:', error);
      if (!silent) toastError('Failed to save template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = () => {
    // Build flow_settings for data-driven campaigns
    const flow_settings = {
      campaign_type: campaignData.campaignType === 'messenger' ? 'linkedin_dm' : 'linkedin_connection',
      connection_wait_hours: connectionWait,
      followup_wait_days: followupWait,
      message_wait_days: followupWait, // For DM campaigns
      messages: {
        connection_request: messages.connection_request || null,
        follow_up_1: messages.follow_up_1 || null,
        follow_up_2: messages.follow_up_2 || null,
        follow_up_3: messages.follow_up_3 || null,
        follow_up_4: messages.follow_up_4 || null,
        follow_up_5: messages.follow_up_5 || null,
        goodbye: messages.follow_up_5 || null, // Use last message as goodbye
        // DM campaign messages (same data, different naming)
        message_1: messages.follow_up_1 || null,
        message_2: messages.follow_up_2 || null,
        message_3: messages.follow_up_3 || null,
        message_4: messages.follow_up_4 || null,
        message_5: messages.follow_up_5 || null
      }
    };

    const finalData = {
      ...campaignData,
      messages,
      flow_settings, // Add flow_settings for N8N
      timezone: selectedTimezone, // User-selected timezone (will be saved to user profile)
      working_hours_start: workingHoursStart,
      working_hours_end: workingHoursEnd,
      skip_weekends: skipWeekends,
      skip_holidays: skipHolidays,
      approvedAt: new Date().toISOString(),
      status: 'approved'
    };
    onApprove(finalData);
  };

  return (
    <div className="flex-1 bg-gray-900 overflow-y-auto">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 to-blue-900 rounded-lg p-6 mb-6 border border-purple-700">
          <h1 className="text-3xl font-bold text-white mb-2">Message Approval</h1>
          <p className="text-gray-300">Review and finalize your campaign messaging before launch</p>
        </div>

        {/* Campaign Summary */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-gray-400 text-sm">Campaign:</span>
                <span className="text-white font-semibold ml-2">{campaignData.name}</span>
              </div>
              <div className="h-6 w-px bg-gray-600"></div>
              <div>
                <span className="text-gray-400 text-sm">Prospects:</span>
                <span className="text-white font-semibold ml-2">{campaignData.prospects.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Messaging Sequence */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-white">Messaging Sequence</h2>
            <p className="text-gray-400 text-sm mt-1">Review your campaign messages before launching</p>
          </div>

          <div className="space-y-4">
              {/* Connection Request / Initial Email (only for Connector campaigns and Email) */}
              {(campaignData.campaignType === 'connector' || campaignData.type === 'Email') && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold text-white mb-3">
                    {campaignData.type === 'Email' ? 'Initial Email' : 'Connection Request'}
                  </h3>
                  <textarea
                    value={messages.connection_request || ''}
                    onChange={(e) => setMessages({ ...messages, connection_request: e.target.value })}
                    className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                    placeholder={campaignData.type === 'Email' ? "Enter your initial email..." : "Enter your connection request message..."}
                  />
                </div>
              )}

              {/* Follow-up 1 / Initial Message */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">
                  {campaignData.campaignType === 'messenger' ? 'Initial Message' : 'Follow-up Message 1'}
                </h3>
                <textarea
                  value={messages.follow_up_1 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_1: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder={campaignData.campaignType === 'messenger' ? "Enter your initial message..." : "Enter your first follow-up message..."}
                />
              </div>

              {/* Follow-up 2 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Follow-up Message 2</h3>
                <textarea
                  value={messages.follow_up_2 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_2: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your second follow-up message..."
                />
              </div>

              {/* Follow-up 3 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Follow-up Message 3</h3>
                <textarea
                  value={messages.follow_up_3 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_3: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your third follow-up message..."
                />
              </div>

              {/* Follow-up 4 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Follow-up Message 4</h3>
                <textarea
                  value={messages.follow_up_4 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_4: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your fourth follow-up message..."
                />
              </div>

              {/* Follow-up 5 - Goodbye Message */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h3 className="font-semibold text-white mb-3">Follow-up Message 5 (Goodbye)</h3>
                <textarea
                  value={messages.follow_up_5 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_5: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your goodbye message (polite closing)..."
                />
              </div>
            </div>
        </div>

        {/* Template Library (OLD - kept for reference) */}
        {false && savedTemplates.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
            <div
              className="flex items-center justify-between cursor-pointer mb-4"
              onClick={() => toggleSection('templates')}
            >
              <h2 className="text-xl font-semibold text-white">Saved Templates</h2>
              {expandedSections.templates ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
            </div>

            {expandedSections.templates && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedTemplates.map((template, idx) => (
                  <div key={idx} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 cursor-pointer">
                    <h3 className="font-semibold text-white mb-2">{template.name}</h3>
                    <div className="text-sm text-gray-400 mb-2">{template.type} Campaign</div>
                    <button
                      onClick={() => setMessages(template.messages)}
                      className="text-purple-400 hover:text-purple-300 text-sm"
                    >
                      Load Template
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <button
            onClick={onReject}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <XCircle size={20} />
            Reject & Edit
          </button>

          <button
            onClick={handleApprove}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <CheckCircle size={20} />
            Approve & Launch
          </button>
        </div>
      </div>

      {/* LinkedIn Unipile Wizard */}
      <UnipileModal
        isOpen={showLinkedInWizard}
        onClose={handleWizardClose}
      />

      {/* Email Providers Wizard */}
      <EmailProvidersModal
        isOpen={showEmailWizard}
        onClose={handleWizardClose}
        workspaceId={workspaceId}
      />
    </div>
  );
}
