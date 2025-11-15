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

        {/* Channel Selection */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Select Outreach Channel
          </h3>

          <div className="grid grid-cols-2 gap-4">
            {/* LinkedIn Option */}
            <label className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all ${
              channelType === 'linkedin'
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}>
              <input
                type="radio"
                name="channel"
                value="linkedin"
                checked={channelType === 'linkedin'}
                onChange={() => handleChannelTypeChange('linkedin')}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">LinkedIn Outreach</div>
                  <div className="text-gray-400 text-sm">Connection requests + follow-ups</div>
                </div>
                {channelType === 'linkedin' && (
                  <div className="ml-auto">
                    <CheckCircle className="text-blue-500" size={24} />
                  </div>
                )}
              </div>
              {!connectedAccounts.linkedin && (
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded border border-yellow-500/40">
                    Not Connected
                  </span>
                </div>
              )}
            </label>

            {/* Email Option */}
            <label className={`relative cursor-pointer border-2 rounded-lg p-4 transition-all ${
              channelType === 'email'
                ? 'border-green-500 bg-green-500/10'
                : 'border-gray-600 hover:border-gray-500'
            }`}>
              <input
                type="radio"
                name="channel"
                value="email"
                checked={channelType === 'email'}
                onChange={() => handleChannelTypeChange('email')}
                className="sr-only"
              />
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="text-white font-medium">Email Outreach</div>
                  <div className="text-gray-400 text-sm">Direct transactional emails</div>
                </div>
                {channelType === 'email' && (
                  <div className="ml-auto">
                    <CheckCircle className="text-green-500" size={24} />
                  </div>
                )}
              </div>
              {!connectedAccounts.email && (
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 bg-yellow-600/20 text-yellow-400 text-xs rounded border border-yellow-500/40">
                    Not Connected
                  </span>
                </div>
              )}
            </label>
          </div>

          {/* Helper text */}
          <div className="mt-4 p-3 bg-gray-700/50 rounded border border-gray-600">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-gray-300">
                {channelType === 'linkedin' ? (
                  <>
                    <strong>LinkedIn:</strong> Send connection requests, then follow-up messages after acceptance.
                  </>
                ) : (
                  <>
                    <strong>Email:</strong> Send direct emails to prospects. No connection requests needed.
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Campaign Timing */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => toggleSection('timing')}
          >
            <div className="flex items-center gap-2">
              <Clock className="text-purple-400" size={20} />
              <h2 className="text-xl font-semibold text-white">Campaign Timing</h2>
            </div>
            {expandedSections.timing ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
          </div>

          {expandedSections.timing && (
            <div className="space-y-6">
              {/* Connection Wait */}
              {campaignData.campaignType === 'connector' && (
                <div className="bg-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-white font-medium">Connection Wait Time</label>
                    <span className="text-purple-400 font-semibold">{connectionWait} hours</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="96"
                    step="12"
                    value={connectionWait}
                    onChange={(e) => setConnectionWait(Number(e.target.value))}
                    className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>12h (Aggressive)</span>
                    <span>36h (Balanced)</span>
                    <span>96h (Nurturing)</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Time to wait after connection request is accepted before sending first follow-up
                  </p>
                </div>
              )}

              {/* Follow-up Wait */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white font-medium">
                    {campaignData.campaignType === 'messenger' ? 'Message Cadence' : 'Follow-up Cadence'}
                  </label>
                  <span className="text-purple-400 font-semibold">{followupWait} days</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={followupWait}
                  onChange={(e) => setFollowupWait(Number(e.target.value))}
                  className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>1d (Fast)</span>
                  <span>7d (Standard)</span>
                  <span>30d (Slow)</span>
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {campaignData.campaignType === 'messenger'
                    ? 'Time between each message in your sequence'
                    : 'Time between each follow-up message'
                  }
                </p>
              </div>

              {/* Timeline Preview */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="text-blue-400" size={18} />
                  <h3 className="text-white font-medium">Timeline Preview</h3>
                </div>
                <div className="space-y-2">
                  {campaignData.campaignType === 'connector' && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-purple-600 text-white px-2 py-1 rounded font-mono text-xs min-w-[60px] text-center">
                        Day 0
                      </div>
                      <div className="text-gray-300">Connection Request</div>
                    </div>
                  )}
                  {campaignData.campaignType === 'connector' && messages.connection_request && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded font-mono text-xs min-w-[60px] text-center">
                        Day {(connectionWait / 24).toFixed(1)}
                      </div>
                      <div className="text-gray-300">Follow-Up 1</div>
                    </div>
                  )}
                  {messages.follow_up_1 && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded font-mono text-xs min-w-[60px] text-center">
                        Day {campaignData.campaignType === 'connector'
                          ? ((connectionWait / 24) + followupWait).toFixed(1)
                          : followupWait
                        }
                      </div>
                      <div className="text-gray-300">
                        {campaignData.campaignType === 'messenger' ? 'Message 1' : 'Follow-Up 2'}
                      </div>
                    </div>
                  )}
                  {messages.follow_up_2 && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded font-mono text-xs min-w-[60px] text-center">
                        Day {campaignData.campaignType === 'connector'
                          ? ((connectionWait / 24) + (followupWait * 2)).toFixed(1)
                          : (followupWait * 2)
                        }
                      </div>
                      <div className="text-gray-300">
                        {campaignData.campaignType === 'messenger' ? 'Message 2' : 'Follow-Up 3'}
                      </div>
                    </div>
                  )}
                  {messages.follow_up_3 && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="bg-blue-600 text-white px-2 py-1 rounded font-mono text-xs min-w-[60px] text-center">
                        Day {campaignData.campaignType === 'connector'
                          ? ((connectionWait / 24) + (followupWait * 3)).toFixed(1)
                          : (followupWait * 3)
                        }
                      </div>
                      <div className="text-gray-300">
                        {campaignData.campaignType === 'messenger' ? 'Message 3' : 'Follow-Up 4'}
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-600">
                  <div className="text-sm text-gray-400">
                    <span className="font-medium text-white">Total Duration:</span>{' '}
                    {campaignData.campaignType === 'connector'
                      ? ((connectionWait / 24) + (followupWait * Object.keys(messages).filter(k => k.includes('follow_up') && messages[k]).length)).toFixed(1)
                      : (followupWait * Object.keys(messages).filter(k => k.includes('follow_up') && messages[k]).length).toFixed(1)
                    } days
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Messaging Sequence */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <div
            className="flex items-center justify-between cursor-pointer mb-4"
            onClick={() => toggleSection('messages')}
          >
            <h2 className="text-xl font-semibold text-white">Messaging Sequence</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUploadTemplate();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <Upload size={16} />
                {showTemplateLibrary ? 'Hide Templates' : 'Load Template'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveTemplate(false);
                }}
                disabled={isSaving}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
              {expandedSections.messages ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
            </div>
          </div>

          {expandedSections.messages && (
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
          )}

          {/* Template Library (shown when Upload clicked) */}
          {showTemplateLibrary && savedTemplates.length > 0 && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600">
              <h3 className="font-semibold text-white mb-3">Saved Templates ({savedTemplates.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {savedTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-gray-600 rounded-lg p-3 hover:bg-gray-500 cursor-pointer transition-colors"
                    onClick={() => {
                      setMessages({
                        connection_request: template.connection_message || '',
                        follow_up_1: template.alternative_message || '',
                        follow_up_2: template.follow_up_messages?.[0] || '',
                        follow_up_3: template.follow_up_messages?.[1] || '',
                        follow_up_4: template.follow_up_messages?.[2] || '',
                        follow_up_5: template.follow_up_messages?.[3] || ''
                      });
                      setShowTemplateLibrary(false);
                      toastSuccess('Template loaded!');
                    }}
                  >
                    <div className="font-semibold text-white mb-1">{template.template_name?.replace('autosave_', '')}</div>
                    <div className="text-xs text-gray-400">
                      Updated: {new Date(template.updated_at).toLocaleDateString()}
                    </div>
                    {template.connection_message && (
                      <div className="text-xs text-gray-300 mt-2 truncate">
                        {template.connection_message.substring(0, 100)}...
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {showTemplateLibrary && savedTemplates.length === 0 && (
            <div className="mt-4 p-4 bg-gray-700 rounded-lg border border-gray-600 text-center text-gray-400">
              No saved templates yet. Save your first template using the "Save Template" button.
            </div>
          )}
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
        <div className="flex items-center justify-between bg-gray-800 rounded-lg p-6 border border-gray-700">
          <button
            onClick={onReject}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <XCircle size={20} />
            Reject & Edit
          </button>

          <div className="text-center flex-1 max-w-md">
            <div className="text-sm text-gray-400 mb-3">Campaign sending schedule</div>

            {/* Timezone Selector */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">Timezone</label>
              <select
                value={selectedTimezone}
                onChange={(e) => setSelectedTimezone(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona (MST)</option>
                <option value="America/Anchorage">Alaska (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii (HST)</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Paris (CET/CEST)</option>
                <option value="Europe/Berlin">Berlin (CET/CEST)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Australia/Sydney">Sydney (AEDT)</option>
              </select>
            </div>

            {/* Business Hours */}
            <div className="mb-3">
              <label className="text-xs text-gray-400 block mb-1">Business Hours</label>
              <div className="flex gap-2 items-center">
                <select
                  value={workingHoursStart}
                  onChange={(e) => setWorkingHoursStart(parseInt(e.target.value))}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
                <span className="text-gray-400 text-sm">to</span>
                <select
                  value={workingHoursEnd}
                  onChange={(e) => setWorkingHoursEnd(parseInt(e.target.value))}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Skip Weekends/Holidays */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipWeekends}
                  onChange={(e) => setSkipWeekends(e.target.checked)}
                  className="w-4 h-4"
                />
                Skip weekends
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipHolidays}
                  onChange={(e) => setSkipHolidays(e.target.checked)}
                  className="w-4 h-4"
                />
                Skip public holidays
              </label>
            </div>
          </div>

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
