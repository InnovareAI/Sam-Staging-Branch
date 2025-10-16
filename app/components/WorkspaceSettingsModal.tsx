'use client';

import React, { useState, useEffect } from 'react';
import { X, Settings, Building2, Brain, Mail, Save, Loader2, MessageCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LLMConfigModal from '@/components/LLMConfigModal';
import EmailProvidersModal from '@/app/components/EmailProvidersModal';
import ReplyAgentModal from '@/app/components/ReplyAgentModal';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export function WorkspaceSettingsModal({ isOpen, onClose, workspaceId, workspaceName }: WorkspaceSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'integrations'>('general');
  const [name, setName] = useState(workspaceName);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isLLMModalOpen, setIsLLMModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isReplyAgentModalOpen, setIsReplyAgentModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setName(workspaceName);
      setSaveMessage('');
    }
  }, [isOpen, workspaceName]);

  const handleSaveName = async () => {
    if (!name.trim()) {
      setSaveMessage('Workspace name cannot be empty');
      return;
    }

    setSaving(true);
    setSaveMessage('');

    try {
      const supabase = createClientComponentClient();
      const { error } = await supabase
        .from('workspaces')
        .update({ name: name.trim() })
        .eq('id', workspaceId);

      if (error) throw error;

      setSaveMessage('✓ Workspace name updated successfully');
      setTimeout(() => {
        window.location.reload(); // Reload to update workspace name everywhere
      }, 1000);
    } catch (error) {
      console.error('Failed to update workspace name:', error);
      setSaveMessage('Failed to update workspace name');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <Settings size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Workspace Settings</h2>
                <p className="text-gray-400 text-sm">{workspaceName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Building2 size={18} />
              <span className="font-medium">General</span>
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center space-x-2 px-6 py-3 border-b-2 transition-colors ${
                activeTab === 'integrations'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Brain size={18} />
              <span className="font-medium">Integrations</span>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter workspace name"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    This name appears across the platform and in team invitations
                  </p>
                </div>

                <button
                  onClick={handleSaveName}
                  disabled={saving || name === workspaceName}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>

                {saveMessage && (
                  <p className={`text-sm ${
                    saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {saveMessage}
                  </p>
                )}
              </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <div className="space-y-4">
                <p className="text-gray-300 text-sm mb-4">
                  Configure AI models and email providers for your workspace
                </p>

                {/* AI Model Configuration */}
                <button
                  onClick={() => setIsLLMModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <Brain className="text-purple-400" size={20} />
                    <div className="text-left">
                      <div className="text-white font-medium">AI Model Configuration</div>
                      <div className="text-gray-400 text-sm">Choose which AI model powers SAM</div>
                    </div>
                  </div>
                  <svg className="text-gray-400 group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>

                {/* Email Providers */}
                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <Mail className="text-green-400" size={20} />
                    <div className="text-left">
                      <div className="text-white font-medium">Email Providers</div>
                      <div className="text-gray-400 text-sm">Connect Gmail or Outlook for email campaigns</div>
                    </div>
                  </div>
                  <svg className="text-gray-400 group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>

                {/* Reply Agent */}
                <button
                  onClick={() => setIsReplyAgentModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
                >
                  <div className="flex items-center space-x-3">
                    <MessageCircle className="text-blue-400" size={20} />
                    <div className="text-left">
                      <div className="text-white font-medium">Reply Agent</div>
                      <div className="text-gray-400 text-sm">Auto-respond to prospect replies with AI</div>
                    </div>
                  </div>
                  <svg className="text-gray-400 group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-700">
            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* LLM Config Modal */}
      <LLMConfigModal
        isOpen={isLLMModalOpen}
        onClose={() => setIsLLMModalOpen(false)}
        onSave={() => {
          setIsLLMModalOpen(false);
          setSaveMessage('✓ AI model configuration updated');
        }}
      />

      {/* Email Providers Modal */}
      <EmailProvidersModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        workspaceId={workspaceId}
      />

      {/* Reply Agent Modal */}
      <ReplyAgentModal
        isOpen={isReplyAgentModalOpen}
        onClose={() => setIsReplyAgentModalOpen(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
