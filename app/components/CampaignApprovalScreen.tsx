'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, Save, Upload, XCircle, Clock, Calendar } from 'lucide-react';
import { toastError, toastSuccess, toastInfo } from '@/lib/toast';


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
  onApprove: (finalCampaignData: any) => void;
  onReject: () => void;
  onRequestSAMHelp: (context: string) => void;
}

export default function CampaignApprovalScreen({
  campaignData,
  workspaceId,
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

  // Timing controls for flow_settings
  const [connectionWait, setConnectionWait] = useState(36); // hours (12-96)
  const [followupWait, setFollowupWait] = useState(5);      // days (1-30)

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

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
                <span className="text-gray-400 text-sm">Type:</span>
                <span className="text-white font-semibold ml-2">{campaignData.type}</span>
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

          <div className="text-center">
            <div className="text-sm text-gray-400 mb-2">Using default timing: 7am-6pm ET, skip weekends/holidays</div>
            <button
              onClick={() => {
                // TODO: Show timing preferences modal/dropdown
                alert('Timing customization coming soon! For now, defaults will be used (7am-6pm ET, skip weekends/holidays). You can change these after campaign creation in Campaign Settings.');
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm flex items-center gap-2 mx-auto transition-colors"
            >
              <Clock size={16} />
              Customize Sending Settings
            </button>
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
    </div>
  );
}
