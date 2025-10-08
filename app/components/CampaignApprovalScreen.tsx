'use client';

import { useState } from 'react';
import { CheckCircle, ChevronDown, ChevronUp, MessageSquare, Save, Upload, XCircle } from 'lucide-react';
import { toastError } from '@/lib/toast';


interface CampaignApprovalScreenProps {
  campaignData: {
    name: string;
    type: 'LinkedIn' | 'Email' | 'Multi-channel';
    prospects: any[];
    messages?: {
      connection_request?: string;
      follow_up_1?: string;
      follow_up_2?: string;
      follow_up_3?: string;
    };
  };
  onApprove: (finalCampaignData: any) => void;
  onReject: () => void;
  onRequestSAMHelp: (context: string) => void;
}

export default function CampaignApprovalScreen({
  campaignData,
  onApprove,
  onReject,
  onRequestSAMHelp
}: CampaignApprovalScreenProps) {
  const [messages, setMessages] = useState(campaignData.messages || {});
  const [savedTemplates, setSavedTemplates] = useState<any[]>([]);
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    messages: true,
    templates: false
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleUploadTemplate = () => {
    // TODO: Implement template upload
    console.log('Upload template');
  };

  const handleSaveTemplate = () => {
    // TODO: Save current messages as template
    const template = {
      name: `${campaignData.name} Template`,
      type: campaignData.type,
      messages: messages,
      created: new Date().toISOString()
    };
    setSavedTemplates(prev => [...prev, template]);
    toastError('Template saved successfully!');
  };

  const handleAskSAM = (messageType: string) => {
    const context = `Help me write a ${messageType} for my ${campaignData.type} campaign "${campaignData.name}". Target audience: ${campaignData.prospects.length} prospects in ${campaignData.prospects[0]?.industry || 'various industries'}.`;
    onRequestSAMHelp(context);
  };

  const handleApprove = () => {
    const finalData = {
      ...campaignData,
      messages,
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
                Upload Template
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSaveTemplate();
                }}
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <Save size={16} />
                Save Template
              </button>
              {expandedSections.messages ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
            </div>
          </div>

          {expandedSections.messages && (
            <div className="space-y-4">
              {/* Connection Request / Initial Email */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">
                    {campaignData.type === 'Email' ? 'Initial Email' : 'Connection Request'}
                  </h3>
                  <button
                    onClick={() => handleAskSAM('connection request')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Ask SAM to Draft
                  </button>
                </div>
                <textarea
                  value={messages.connection_request || ''}
                  onChange={(e) => setMessages({ ...messages, connection_request: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your initial message..."
                />
              </div>

              {/* Follow-up 1 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Follow-up Message 1</h3>
                  <button
                    onClick={() => handleAskSAM('follow-up message 1')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Ask SAM to Draft
                  </button>
                </div>
                <textarea
                  value={messages.follow_up_1 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_1: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your first follow-up message..."
                />
              </div>

              {/* Follow-up 2 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Follow-up Message 2</h3>
                  <button
                    onClick={() => handleAskSAM('follow-up message 2')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Ask SAM to Draft
                  </button>
                </div>
                <textarea
                  value={messages.follow_up_2 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_2: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your second follow-up message..."
                />
              </div>

              {/* Follow-up 3 */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Follow-up Message 3</h3>
                  <button
                    onClick={() => handleAskSAM('follow-up message 3')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg flex items-center gap-2"
                  >
                    <MessageSquare size={16} />
                    Ask SAM to Draft
                  </button>
                </div>
                <textarea
                  value={messages.follow_up_3 || ''}
                  onChange={(e) => setMessages({ ...messages, follow_up_3: e.target.value })}
                  className="w-full bg-gray-600 border border-gray-500 rounded-lg p-3 text-white text-sm min-h-[100px]"
                  placeholder="Enter your third follow-up message..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Template Library */}
        {savedTemplates.length > 0 && (
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
            <div className="text-sm text-gray-400 mb-1">Ready to launch?</div>
            <div className="text-xs text-gray-500">Campaign will be sent to N8N for execution</div>
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
