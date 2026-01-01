'use client';

import React, { useState, useEffect } from 'react';
import { X, Inbox, Save, Loader2, Tag, CheckCircle, Sparkles, MessageSquare, AlertTriangle } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface InboxAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface InboxAgentConfig {
  enabled: boolean;
  categorization_enabled: boolean;
  auto_categorize_new_messages: boolean;
  response_suggestions_enabled: boolean;
  suggest_for_categories: string[];
  auto_tagging_enabled: boolean;
  ai_model: string;
  categorization_instructions: string;
}

interface MessageCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  icon: string;
  is_system: boolean;
  suggested_action: string;
}

const DEFAULT_CONFIG: InboxAgentConfig = {
  enabled: false,
  categorization_enabled: true,
  auto_categorize_new_messages: true,
  response_suggestions_enabled: true,
  suggest_for_categories: ['interested', 'question', 'objection'],
  auto_tagging_enabled: false,
  ai_model: 'claude-3-5-sonnet',
  categorization_instructions: `## MESSAGE CATEGORIZATION GUIDELINES

Analyze each incoming message and classify it into one of these categories:

**High Priority (Respond Immediately)**
- INTERESTED: Prospect shows genuine interest in product/service
- MEETING_REQUEST: Prospect wants to schedule a call or meeting
- QUESTION: Direct question about product, pricing, or capabilities

**Medium Priority (Respond Today)**
- OBJECTION: Concerns about timing, budget, or fit
- REFERRAL: Prospect suggests talking to someone else

**Low Priority (Can Wait)**
- OUT_OF_OFFICE: Auto-replies, vacation messages
- FOLLOW_UP: Generic follow-ups needed
- NOT_INTERESTED: Polite declines

**No Action Needed**
- SPAM: Irrelevant or promotional messages

## ANALYSIS APPROACH
1. Read the full message context
2. Identify intent signals (keywords, sentiment, questions)
3. Consider the conversation history
4. Assign confidence score (0-1)
5. Suggest appropriate response action`,
};

export default function InboxAgentModal({ isOpen, onClose, workspaceId }: InboxAgentModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [config, setConfig] = useState<InboxAgentConfig>(DEFAULT_CONFIG);
  const [categories, setCategories] = useState<MessageCategory[]>([]);
  const [activeTab, setActiveTab] = useState<'settings' | 'categories'>('settings');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      loadCategories();
    }
  }, [isOpen, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_inbox_agent_config')
        .select('*')
        .eq('workspace_id', workspaceId)
        .single();

      if (data) {
        setConfig({
          ...DEFAULT_CONFIG,
          ...data,
          suggest_for_categories: data.suggest_for_categories || DEFAULT_CONFIG.suggest_for_categories,
        });
      }
    } catch (error) {
      console.error('Failed to load inbox agent config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      // Load system categories and workspace-specific categories
      const { data, error } = await supabase
        .from('inbox_message_categories')
        .select('*')
        .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`)
        .order('display_order', { ascending: true });

      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const { error } = await supabase
        .from('workspace_inbox_agent_config')
        .upsert({
          workspace_id: workspaceId,
          enabled: config.enabled,
          categorization_enabled: config.categorization_enabled,
          auto_categorize_new_messages: config.auto_categorize_new_messages,
          response_suggestions_enabled: config.response_suggestions_enabled,
          suggest_for_categories: config.suggest_for_categories,
          auto_tagging_enabled: config.auto_tagging_enabled,
          ai_model: config.ai_model,
          categorization_instructions: config.categorization_instructions,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'workspace_id'
        });

      if (error) throw error;

      setSaveMessage('✓ Inbox Agent configuration saved successfully');
      setTimeout(() => {
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      console.error('Failed to save inbox agent config:', error);
      setSaveMessage('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategoryForSuggestions = (slug: string) => {
    setConfig(prev => {
      const current = prev.suggest_for_categories;
      if (current.includes(slug)) {
        return { ...prev, suggest_for_categories: current.filter(s => s !== slug) };
      } else {
        return { ...prev, suggest_for_categories: [...current, slug] };
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-600 rounded-full flex items-center justify-center">
              <Inbox size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Inbox Agent Configuration</h2>
              <p className="text-gray-400 text-sm">AI-powered message categorization and intent detection</p>
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
            onClick={() => setActiveTab('settings')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'settings'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-700/50'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Sparkles size={16} />
              <span>Settings</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'categories'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-700/50'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <Tag size={16} />
              <span>Categories</span>
            </div>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-purple-500" />
            </div>
          ) : activeTab === 'settings' ? (
            <>
              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Enable Inbox Agent</div>
                  <div className="text-gray-400 text-sm">Automatically categorize incoming messages with AI</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Auto-Categorize New Messages */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Auto-Categorize New Messages</div>
                  <div className="text-gray-400 text-sm">Automatically analyze incoming messages as they arrive</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.auto_categorize_new_messages}
                    onChange={(e) => setConfig({ ...config, auto_categorize_new_messages: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Response Suggestions */}
              <div className="p-4 bg-gray-700 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">Response Suggestions</div>
                    <div className="text-gray-400 text-sm">Generate AI response suggestions for categorized messages</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.response_suggestions_enabled}
                      onChange={(e) => setConfig({ ...config, response_suggestions_enabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {config.response_suggestions_enabled && (
                  <div className="pt-2 border-t border-gray-600">
                    <div className="text-sm text-gray-300 mb-2">Suggest responses for these categories:</div>
                    <div className="flex flex-wrap gap-2">
                      {categories.filter(c => c.suggested_action === 'reply').map(cat => (
                        <button
                          key={cat.slug}
                          onClick={() => toggleCategoryForSuggestions(cat.slug)}
                          className={`px-3 py-1 rounded-full text-sm transition-colors ${
                            config.suggest_for_categories.includes(cat.slug)
                              ? 'bg-purple-600 text-white'
                              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Model */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  AI Model
                </label>
                <select
                  value={config.ai_model}
                  onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Recommended)</option>
                  <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</option>
                </select>
              </div>

              {/* Categorization Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Categorization Instructions
                </label>
                <textarea
                  value={config.categorization_instructions}
                  onChange={(e) => setConfig({ ...config, categorization_instructions: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent min-h-[200px] font-mono text-sm"
                  placeholder="Enter instructions for AI categorization..."
                />
                <p className="mt-1 text-xs text-gray-400">
                  Custom instructions the AI will follow when categorizing messages
                </p>
              </div>
            </>
          ) : (
            /* Categories Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-white">Message Categories</h3>
                <span className="text-sm text-gray-400">{categories.length} categories</span>
              </div>

              <div className="space-y-2">
                {categories.map(category => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-4 bg-gray-700 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <div>
                        <div className="text-white font-medium">{category.name}</div>
                        <div className="text-gray-400 text-sm">{category.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        category.suggested_action === 'reply' ? 'bg-green-900/50 text-green-400' :
                        category.suggested_action === 'archive' ? 'bg-gray-600 text-gray-300' :
                        category.suggested_action === 'follow_up' ? 'bg-orange-900/50 text-orange-400' :
                        category.suggested_action === 'ignore' ? 'bg-gray-600 text-gray-400' :
                        'bg-red-900/50 text-red-400'
                      }`}>
                        {category.suggested_action}
                      </span>
                      {category.is_system && (
                        <span className="text-xs text-gray-500">System</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gray-700/50 rounded-lg border border-dashed border-gray-600">
                <div className="text-center">
                  <Tag size={24} className="mx-auto text-gray-500 mb-2" />
                  <div className="text-gray-400 text-sm">
                    Custom categories coming soon
                  </div>
                  <div className="text-gray-500 text-xs mt-1">
                    You'll be able to create workspace-specific categories
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 space-y-3">
          {saveMessage && (
            <p className={`text-sm text-center ${
              saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
            }`}>
              {saveMessage}
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Configuration</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
