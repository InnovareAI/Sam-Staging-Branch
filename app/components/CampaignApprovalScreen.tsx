'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle } from 'lucide-react';
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

  // CRITICAL FIX (Dec 10): Prevent duplicate campaign creation from double-clicks
  const [isLaunching, setIsLaunching] = useState(false);

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

  const handleApprove = () => {
    // CRITICAL: Prevent double-click
    if (isLaunching) {
      console.log('⚠️ Campaign launch already in progress - ignoring duplicate click');
      return;
    }
    setIsLaunching(true);

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
          <h1 className="text-3xl font-bold text-white mb-2">Campaign Summary & Approval</h1>
          <p className="text-gray-300">Review all campaign details before launching</p>
        </div>

        {/* Campaign Overview */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Campaign Overview</h2>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-gray-400 text-sm mb-1">Campaign Name</div>
              <div className="text-white font-semibold">{campaignData.name}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Campaign Type</div>
              <div className="text-white font-semibold">{campaignData.type}</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Target Prospects</div>
              <div className="text-white font-semibold">{campaignData.prospects.length} contacts</div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Timezone</div>
              <div className="text-white font-semibold">
                {selectedTimezone === 'America/New_York' && 'Eastern Time (ET)'}
                {selectedTimezone === 'America/Chicago' && 'Central Time (CT)'}
                {selectedTimezone === 'America/Denver' && 'Mountain Time (MT)'}
                {selectedTimezone === 'America/Los_Angeles' && 'Pacific Time (PT)'}
                {selectedTimezone === 'Europe/London' && 'London (GMT/BST)'}
                {!['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London'].includes(selectedTimezone) && selectedTimezone}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Business Hours</div>
              <div className="text-white font-semibold">
                {workingHoursStart === 0 ? '12 AM' : workingHoursStart < 12 ? `${workingHoursStart} AM` : workingHoursStart === 12 ? '12 PM' : `${workingHoursStart - 12} PM`}
                {' - '}
                {workingHoursEnd === 0 ? '12 AM' : workingHoursEnd < 12 ? `${workingHoursEnd} AM` : workingHoursEnd === 12 ? '12 PM' : `${workingHoursEnd - 12} PM`}
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-sm mb-1">Schedule Preferences</div>
              <div className="text-white font-semibold">
                {skipWeekends && skipHolidays && 'Weekdays only, skip holidays'}
                {skipWeekends && !skipHolidays && 'Weekdays only'}
                {!skipWeekends && skipHolidays && 'All days, skip holidays'}
                {!skipWeekends && !skipHolidays && 'All days'}
              </div>
            </div>
          </div>
        </div>

        {/* Messaging Sequence */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">Messaging Sequence</h2>

          <div className="space-y-3">
              {/* Connection Request / Initial Email (only for Connector campaigns and Email) */}
              {(campaignData.campaignType === 'connector' || campaignData.type === 'Email') && messages.connection_request && (
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="text-purple-400 text-xs font-semibold mb-2">
                    {campaignData.type === 'Email' ? 'INITIAL EMAIL' : 'CONNECTION REQUEST'}
                  </div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {messages.connection_request}
                  </div>
                </div>
              )}

              {/* Follow-up 1 / Initial Message */}
              {messages.follow_up_1 && (
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="text-purple-400 text-xs font-semibold mb-2">
                    {campaignData.campaignType === 'messenger' ? 'INITIAL MESSAGE' : 'FOLLOW-UP MESSAGE 1'}
                  </div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {messages.follow_up_1}
                  </div>
                </div>
              )}

              {/* Follow-up 2 */}
              {messages.follow_up_2 && (
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="text-purple-400 text-xs font-semibold mb-2">FOLLOW-UP MESSAGE 2</div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {messages.follow_up_2}
                  </div>
                </div>
              )}

              {/* Follow-up 3 */}
              {messages.follow_up_3 && (
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="text-purple-400 text-xs font-semibold mb-2">FOLLOW-UP MESSAGE 3</div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {messages.follow_up_3}
                  </div>
                </div>
              )}

              {/* Follow-up 4 */}
              {messages.follow_up_4 && (
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="text-purple-400 text-xs font-semibold mb-2">FOLLOW-UP MESSAGE 4</div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {messages.follow_up_4}
                  </div>
                </div>
              )}

              {/* Follow-up 5 - Goodbye Message */}
              {messages.follow_up_5 && (
                <div className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
                  <div className="text-purple-400 text-xs font-semibold mb-2">FOLLOW-UP MESSAGE 5 (GOODBYE)</div>
                  <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                    {messages.follow_up_5}
                  </div>
                </div>
              )}
            </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 bg-gray-800 rounded-lg p-6 border border-gray-700">
          <button
            onClick={onReject}
            disabled={isLaunching}
            className={`px-6 py-3 text-white rounded-lg flex items-center gap-2 transition-colors ${
              isLaunching
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <XCircle size={20} />
            Reject & Edit
          </button>

          <button
            onClick={handleApprove}
            disabled={isLaunching}
            className={`px-6 py-3 text-white rounded-lg flex items-center gap-2 transition-colors ${
              isLaunching
                ? 'bg-gray-500 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isLaunching ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Launching...
              </>
            ) : (
              <>
                <CheckCircle size={20} />
                Approve & Launch
              </>
            )}
          </button>
        </div>
      </div>

      {/* LinkedIn Unipile Wizard */}
      <UnipileModal
        isOpen={showLinkedInWizard}
        onClose={handleWizardClose}
        workspaceId={workspaceId}
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
