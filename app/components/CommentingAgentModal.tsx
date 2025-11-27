'use client';

import React, { useState, useEffect } from 'react';
import { X, MessageSquare, Save, Loader2, CheckCircle, AlertTriangle, Sparkles, TrendingUp, Users, Clock, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';
import { useRouter } from 'next/navigation';

interface CommentingAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

type Tone = 'professional' | 'friendly' | 'casual' | 'passionate';
type Formality = 'formal' | 'semi-formal' | 'informal';
type CommentLength = 'short' | 'medium' | 'long';
type QuestionFrequency = 'frequently' | 'sometimes' | 'rarely' | 'never';

interface AISettings {
  tone: Tone;
  formality: Formality;
  commentLength: CommentLength;
  questionFrequency: QuestionFrequency;
  useKnowledgeBase: boolean;
  personalityDocument: string;
}

interface BrandGuidelines {
  id?: string;
  tone_of_voice: string;
  writing_style: string;
  topics_and_perspective: string;
  dos_and_donts: string;
  comment_framework: string;
  max_characters: number;
  system_prompt: string;
  is_active: boolean;
}

const defaultAISettings: AISettings = {
  tone: 'professional',
  formality: 'semi-formal',
  commentLength: 'medium',
  questionFrequency: 'sometimes',
  useKnowledgeBase: true,
  personalityDocument: '',
};

const defaultBrandGuidelines: BrandGuidelines = {
  tone_of_voice: '',
  writing_style: '',
  topics_and_perspective: '',
  dos_and_donts: '',
  comment_framework: 'ACA+I: Acknowledge, Add nuance, drop an I-statement, ask a warm question',
  max_characters: 300,
  system_prompt: 'You are an AI agent replying as a real person to LinkedIn posts. Write replies that sound like a sharp, trusted friend—confident, human, and curious. Professional but warm.',
  is_active: true,
};

export default function CommentingAgentModal({ isOpen, onClose, workspaceId }: CommentingAgentModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [hasLinkedInAccount, setHasLinkedInAccount] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [showBrandGuidelines, setShowBrandGuidelines] = useState(false);
  const [aiSettings, setAISettings] = useState<AISettings>(defaultAISettings);
  const [brandGuidelines, setBrandGuidelines] = useState<BrandGuidelines>(defaultBrandGuidelines);
  const [savingBrandGuidelines, setSavingBrandGuidelines] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Check if commenting agent is enabled for workspace and load AI settings
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('commenting_agent_enabled, metadata')
        .eq('id', workspaceId)
        .single();

      if (workspace) {
        setEnabled(workspace.commenting_agent_enabled || false);

        // Load AI settings from metadata
        const savedSettings = workspace.metadata?.commenting_agent_settings;
        if (savedSettings) {
          setAISettings({
            tone: savedSettings.tone || defaultAISettings.tone,
            formality: savedSettings.formality || defaultAISettings.formality,
            commentLength: savedSettings.commentLength || defaultAISettings.commentLength,
            questionFrequency: savedSettings.questionFrequency || defaultAISettings.questionFrequency,
            useKnowledgeBase: savedSettings.useKnowledgeBase ?? defaultAISettings.useKnowledgeBase,
            personalityDocument: savedSettings.personalityDocument || defaultAISettings.personalityDocument,
          });
        }
      }

      // Check for connected LinkedIn accounts
      const { data: linkedInAccounts } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id')
        .eq('workspace_id', workspaceId)
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .limit(1);

      setHasLinkedInAccount(linkedInAccounts && linkedInAccounts.length > 0);

      // Load brand guidelines from linkedin_brand_guidelines table
      const { data: guidelines } = await supabase
        .from('linkedin_brand_guidelines')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .maybeSingle();

      if (guidelines) {
        setBrandGuidelines({
          id: guidelines.id,
          tone_of_voice: guidelines.tone_of_voice || '',
          writing_style: guidelines.writing_style || '',
          topics_and_perspective: guidelines.topics_and_perspective || '',
          dos_and_donts: guidelines.dos_and_donts || '',
          comment_framework: guidelines.comment_framework || defaultBrandGuidelines.comment_framework,
          max_characters: guidelines.max_characters || 300,
          system_prompt: guidelines.system_prompt || defaultBrandGuidelines.system_prompt,
          is_active: guidelines.is_active ?? true,
        });
      }
    } catch (error) {
      console.error('Failed to load commenting agent config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAISettings = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const supabase = createClient();

      // Get current metadata first
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('metadata')
        .eq('id', workspaceId)
        .single();

      const currentMetadata = workspace?.metadata || {};

      // Update with new AI settings
      const { error } = await supabase
        .from('workspaces')
        .update({
          metadata: {
            ...currentMetadata,
            commenting_agent_settings: aiSettings,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspaceId);

      if (error) throw error;

      setSaveMessage('✓ AI settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save AI settings:', error);
      setSaveMessage('❌ Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveBrandGuidelines = async () => {
    setSavingBrandGuidelines(true);
    setSaveMessage('');

    try {
      const supabase = createClient();

      // Validate required field
      if (!brandGuidelines.tone_of_voice.trim()) {
        setSaveMessage('❌ Tone of Voice is required');
        setSavingBrandGuidelines(false);
        return;
      }

      const guidelineData = {
        workspace_id: workspaceId,
        tone_of_voice: brandGuidelines.tone_of_voice,
        writing_style: brandGuidelines.writing_style || null,
        topics_and_perspective: brandGuidelines.topics_and_perspective || null,
        dos_and_donts: brandGuidelines.dos_and_donts || null,
        comment_framework: brandGuidelines.comment_framework,
        max_characters: brandGuidelines.max_characters,
        system_prompt: brandGuidelines.system_prompt,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (brandGuidelines.id) {
        // Update existing
        const { error } = await supabase
          .from('linkedin_brand_guidelines')
          .update(guidelineData)
          .eq('id', brandGuidelines.id);

        if (error) throw error;
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('linkedin_brand_guidelines')
          .insert(guidelineData)
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setBrandGuidelines({ ...brandGuidelines, id: data.id });
        }
      }

      setSaveMessage('✓ Brand guidelines saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save brand guidelines:', error);
      setSaveMessage('❌ Failed to save brand guidelines');
    } finally {
      setSavingBrandGuidelines(false);
    }
  };

  const handleToggle = async (newEnabled: boolean) => {
    setSaving(true);
    setSaveMessage('');

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('workspaces')
        .update({
          commenting_agent_enabled: newEnabled,
          updated_at: new Date().toISOString(),
        })
        .eq('id', workspaceId);

      if (error) throw error;

      setEnabled(newEnabled);
      setSaveMessage(
        newEnabled
          ? '✓ Commenting Agent activated! Refresh to see the new tab.'
          : '✓ Commenting Agent deactivated.'
      );

      // If enabling, refresh the page after 2 seconds to show new nav tab
      if (newEnabled) {
        setTimeout(() => {
          router.refresh();
          onClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Failed to toggle commenting agent:', error);
      setSaveMessage('❌ Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center">
              <MessageSquare size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Commenting Agent</h2>
              <p className="text-gray-400 text-sm">Automated LinkedIn engagement system</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-pink-500" />
            </div>
          ) : (
            <>
              {/* Feature Overview */}
              <div className="p-6 bg-gradient-to-br from-pink-900/30 to-purple-900/30 rounded-lg border border-pink-700/50">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Sparkles size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">Smart LinkedIn Commenting</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-4">
                      Automatically discover and comment on LinkedIn posts using SAM AI. Build relationships
                      and generate leads by engaging with your target audience where they're already active.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp size={16} className="text-pink-400" />
                        <span className="text-gray-300">3 targeting modes</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Users size={16} className="text-pink-400" />
                        <span className="text-gray-300">Anti-bot detection</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <MessageSquare size={16} className="text-pink-400" />
                        <span className="text-gray-300">SAM-powered</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock size={16} className="text-pink-400" />
                        <span className="text-gray-300">Smart timing</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* LinkedIn Account Requirement */}
              {!hasLinkedInAccount && (
                <div className="p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-yellow-200 font-medium mb-1">LinkedIn Account Required</div>
                      <p className="text-yellow-300/80 text-sm">
                        You need to connect a LinkedIn account before enabling the Commenting Agent.
                        Go to Settings → Integrations to connect your account.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium flex items-center gap-2">
                    Activate Commenting Agent
                    {enabled && <span className="text-xs px-2 py-0.5 bg-green-600 rounded-full">ACTIVE</span>}
                  </div>
                  <div className="text-gray-400 text-sm mt-1">
                    Unlock the Commenting Agent tab and start running campaigns
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleToggle(e.target.checked)}
                    disabled={saving || !hasLinkedInAccount}
                    className="sr-only peer"
                  />
                  <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600 ${(!hasLinkedInAccount || saving) ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                </label>
              </div>

              {/* Success Message */}
              {saveMessage && (
                <div className={`p-4 rounded-lg border ${
                  saveMessage.startsWith('✓')
                    ? 'bg-green-900/30 border-green-700/50 text-green-200'
                    : 'bg-red-900/30 border-red-700/50 text-red-200'
                }`}>
                  {saveMessage}
                </div>
              )}

              {/* What You Get */}
              <div className="space-y-3">
                <h4 className="text-white font-medium">When you activate this feature:</h4>
                <div className="space-y-2">
                  {[
                    'New "Commenting Agent" tab appears in sidebar',
                    'Create campaigns targeting hashtags, keywords, or profiles',
                    'SAM generates contextual comments using AI',
                    'Smart anti-bot detection prevents spam flags',
                    'Approve comments before posting (HITL workflow)',
                    'Track engagement and convert commenters to prospects',
                  ].map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-sm">
                      <CheckCircle size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* How It Works */}
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <h4 className="text-white font-medium mb-3">How it works:</h4>
                <ol className="space-y-2 text-sm text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">1.</span>
                    <span>Choose targeting: hashtags (#SaaS), keywords ("sales automation"), or specific profiles</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">2.</span>
                    <span>AI searches LinkedIn and scores posts for relevance (70%+ relevance threshold)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">3.</span>
                    <span>Waits for organic engagement (2+ comments, 5+ likes) to avoid looking like a bot</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">4.</span>
                    <span>SAM generates contextual comments (tiered strategy: 50% templates, 40% light AI, 10% full AI)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">5.</span>
                    <span>You approve comments in the approval workflow</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">6.</span>
                    <span>Comments posted with natural delays (20+ min gaps, random timing)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-pink-400 font-medium">7.</span>
                    <span>Track engagement: likes, replies, connections, and convert to prospects</span>
                  </li>
                </ol>
              </div>

              {/* AI Settings Section */}
              {enabled && (
                <div className="border border-gray-600 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowAISettings(!showAISettings)}
                    className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Sparkles size={20} className="text-purple-400" />
                      <span className="text-white font-medium">AI Comment Settings</span>
                    </div>
                    {showAISettings ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {showAISettings && (
                    <div className="p-4 bg-gray-800 space-y-6">
                      {/* Tone */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Tone</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['professional', 'friendly', 'casual', 'passionate'] as Tone[]).map((t) => (
                            <button
                              key={t}
                              onClick={() => setAISettings({ ...aiSettings, tone: t })}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                aiSettings.tone === t
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Formality */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Formality Level</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['formal', 'semi-formal', 'informal'] as Formality[]).map((f) => (
                            <button
                              key={f}
                              onClick={() => setAISettings({ ...aiSettings, formality: f })}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                aiSettings.formality === f
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {f.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-')}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comment Length */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Comment Length</label>
                        <div className="grid grid-cols-3 gap-2">
                          {(['short', 'medium', 'long'] as CommentLength[]).map((l) => (
                            <button
                              key={l}
                              onClick={() => setAISettings({ ...aiSettings, commentLength: l })}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                aiSettings.commentLength === l
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {l.charAt(0).toUpperCase() + l.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Question Frequency */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Ask Questions</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(['frequently', 'sometimes', 'rarely', 'never'] as QuestionFrequency[]).map((q) => (
                            <button
                              key={q}
                              onClick={() => setAISettings({ ...aiSettings, questionFrequency: q })}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                aiSettings.questionFrequency === q
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              }`}
                            >
                              {q.charAt(0).toUpperCase() + q.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Use Knowledge Base */}
                      <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                        <div>
                          <div className="text-white font-medium text-sm">Use Workspace Knowledge</div>
                          <div className="text-gray-400 text-xs">Include your company context in comments</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={aiSettings.useKnowledgeBase}
                            onChange={(e) => setAISettings({ ...aiSettings, useKnowledgeBase: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                      </div>

                      {/* Save AI Settings Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={saveAISettings}
                          disabled={saving}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Save size={16} />
                          )}
                          Save AI Settings
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Brand Guidelines Section */}
              {enabled && (
                <div className="border border-gray-600 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setShowBrandGuidelines(!showBrandGuidelines)}
                    className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText size={20} className="text-pink-400" />
                      <div className="text-left">
                        <span className="text-white font-medium block">Brand Guidelines</span>
                        <span className="text-gray-400 text-xs">Define your unique voice and commenting style</span>
                      </div>
                    </div>
                    {showBrandGuidelines ? (
                      <ChevronUp size={20} className="text-gray-400" />
                    ) : (
                      <ChevronDown size={20} className="text-gray-400" />
                    )}
                  </button>

                  {showBrandGuidelines && (
                    <div className="p-4 bg-gray-800 space-y-5">
                      {/* Tone of Voice (Required) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Tone of Voice <span className="text-pink-400">*</span>
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          How should your comments sound? (e.g., "Professional but warm, confident but not arrogant")
                        </p>
                        <textarea
                          value={brandGuidelines.tone_of_voice}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, tone_of_voice: e.target.value })}
                          placeholder="Professional and authentic. Confident but approachable. We sound like a knowledgeable friend, not a salesperson."
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                        />
                      </div>

                      {/* Writing Style */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Writing Style
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          Describe sentence structure, vocabulary, and formatting preferences
                        </p>
                        <textarea
                          value={brandGuidelines.writing_style}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, writing_style: e.target.value })}
                          placeholder="Concise and engaging. Use short sentences. Avoid jargon. No emojis or exclamation marks. Ask thoughtful questions."
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                        />
                      </div>

                      {/* Topics & Perspective */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Topics & Perspective
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          What topics do you engage with? What's your unique viewpoint?
                        </p>
                        <textarea
                          value={brandGuidelines.topics_and_perspective}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, topics_and_perspective: e.target.value })}
                          placeholder="We focus on B2B sales, automation, and AI. Our perspective: technology should enhance human connection, not replace it."
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                        />
                      </div>

                      {/* Do's and Don'ts */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Do's and Don'ts
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          Specific rules for what to include or avoid in comments
                        </p>
                        <textarea
                          value={brandGuidelines.dos_and_donts}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, dos_and_donts: e.target.value })}
                          placeholder={`DO: Reference specific points from the post, ask thoughtful questions, share relevant insights
DON'T: Use "Great post!", mention our product, use buzzwords like "synergy", be generic`}
                          rows={4}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                        />
                      </div>

                      {/* Comment Framework */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Comment Framework
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          Structure for generating comments (e.g., ACA+I: Acknowledge, Add nuance, I-statement, Question)
                        </p>
                        <textarea
                          value={brandGuidelines.comment_framework}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, comment_framework: e.target.value })}
                          placeholder="ACA+I: Acknowledge the post, Add nuance or insight, drop an I-statement from experience, ask a warm question"
                          rows={2}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                        />
                      </div>

                      {/* Max Characters */}
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          Max Characters
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          Maximum length for generated comments (recommended: 200-400)
                        </p>
                        <input
                          type="number"
                          value={brandGuidelines.max_characters}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, max_characters: parseInt(e.target.value) || 300 })}
                          min={50}
                          max={1000}
                          className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                        />
                      </div>

                      {/* System Prompt (Advanced) */}
                      <div className="pt-4 border-t border-gray-700">
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                          System Prompt <span className="text-gray-500 text-xs">(Advanced)</span>
                        </label>
                        <p className="text-xs text-gray-400 mb-2">
                          The base instruction given to the AI. Only modify if you know what you're doing.
                        </p>
                        <textarea
                          value={brandGuidelines.system_prompt}
                          onChange={(e) => setBrandGuidelines({ ...brandGuidelines, system_prompt: e.target.value })}
                          rows={3}
                          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm font-mono text-xs"
                        />
                      </div>

                      {/* Save Brand Guidelines Button */}
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={saveBrandGuidelines}
                          disabled={savingBrandGuidelines}
                          className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          {savingBrandGuidelines ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Save size={16} />
                          )}
                          Save Brand Guidelines
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {enabled ? 'Agent is active' : 'Agent is inactive'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
