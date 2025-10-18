'use client';

import React, { useState, useEffect } from 'react';
import { X, Settings, Building2, Brain, Mail, Save, Loader2, MessageCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import LLMConfigModal from '@/components/LLMConfigModal';
import EmailProvidersModal from '@/app/components/EmailProvidersModal';
import ReplyAgentModal from '@/app/components/ReplyAgentModal';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

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
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <Card className="max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <CardHeader className="border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                  <Settings className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Workspace Settings</h2>
                  <p className="text-sm text-muted-foreground">{workspaceName}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </CardHeader>

          {/* Tabs */}
          <div className="flex border-b border-border bg-card">
            <button
              onClick={() => setActiveTab('general')}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors font-medium ${
                activeTab === 'general'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="h-4 w-4" />
              <span>General</span>
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-colors font-medium ${
                activeTab === 'integrations'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Brain className="h-4 w-4" />
              <span>Integrations</span>
            </button>
          </div>

          {/* Body */}
          <CardContent className="p-6 overflow-y-auto flex-1">
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-background border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-input transition-colors"
                    placeholder="Enter workspace name"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    This name appears across the platform and in team invitations
                  </p>
                </div>

                <button
                  onClick={handleSaveName}
                  disabled={saving || name === workspaceName}
                  className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground rounded-lg transition-colors font-medium"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>

                {saveMessage && (
                  <p className={`text-sm ${
                    saveMessage.startsWith('✓') ? 'text-green-500' : 'text-destructive'
                  }`}>
                    {saveMessage}
                  </p>
                )}
              </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm mb-6">
                  Configure AI models and email providers for your workspace
                </p>

                {/* AI Model Configuration */}
                <button
                  onClick={() => setIsLLMModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 bg-card hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                      <Brain className="text-purple-400 h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">AI Model Configuration</div>
                      <div className="text-muted-foreground text-sm">Choose which AI model powers SAM</div>
                    </div>
                  </div>
                  <svg className="text-muted-foreground group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>

                {/* Email Providers */}
                <button
                  onClick={() => setIsEmailModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 bg-card hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                      <Mail className="text-green-400 h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Email Providers</div>
                      <div className="text-muted-foreground text-sm">Connect Gmail or Outlook for email campaigns</div>
                    </div>
                  </div>
                  <svg className="text-muted-foreground group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>

                {/* Reply Agent */}
                <button
                  onClick={() => setIsReplyAgentModalOpen(true)}
                  className="w-full flex items-center justify-between p-4 bg-card hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                      <MessageCircle className="text-blue-400 h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">Reply Agent</div>
                      <div className="text-muted-foreground text-sm">Auto-respond to prospect replies with AI</div>
                    </div>
                  </div>
                  <svg className="text-muted-foreground group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </div>
            )}
          </CardContent>

          {/* Footer */}
          <div className="p-6 border-t border-border">
            <button
              onClick={onClose}
              className="w-full bg-secondary hover:bg-secondary/80 font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </Card>
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
