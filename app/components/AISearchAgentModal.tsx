'use client';

import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Save, Loader2, Globe, Search, Sparkles, AlertTriangle, CheckCircle, Lock, BarChart3, BookOpen, RefreshCw, Mail } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface AISearchAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

interface AISearchConfig {
  id?: string;
  website_url: string;
  website_locked: boolean;
  enabled: boolean;
  auto_analyze_prospects: boolean;
  analysis_depth: 'quick' | 'standard' | 'comprehensive';
  check_meta_tags: boolean;
  check_structured_data: boolean;
  check_robots_txt: boolean;
  check_sitemap: boolean;
  check_llm_readability: boolean;
  check_entity_clarity: boolean;
  check_fact_density: boolean;
  check_citation_readiness: boolean;
  learn_from_outreach: boolean;
  learn_from_comments: boolean;
}

interface AnalysisResult {
  id: string;
  seo_score: number;
  geo_score: number;
  overall_score: number;
  status: string;
  analyzed_at: string;
  executive_summary: string;
  recommendations?: Array<{
    priority: string;
    category: string;
    title: string;
    description: string;
  }>;
}

interface ContentStrategy {
  strategy: string;
  content_pillars: string[];
  topics_to_cover: string[];
  format_recommendations: string[];
}

export default function AISearchAgentModal({ isOpen, onClose, workspaceId }: AISearchAgentModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'setup' | 'results' | 'strategy'>('setup');

  const [websiteInput, setWebsiteInput] = useState('');
  const [config, setConfig] = useState<AISearchConfig | null>(null);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResult | null>(null);
  const [contentStrategy, setContentStrategy] = useState<ContentStrategy | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, workspaceId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // Fetch config via API
      const response = await fetch(`/api/ai-search-agent/config?workspace_id=${workspaceId}`);
      const result = await response.json();

      if (result.success && result.data) {
        setConfig(result.data);

        // Load latest analysis if config exists
        loadLatestAnalysis();
      } else {
        // No config yet - show setup
        setConfig(null);
      }
    } catch (error) {
      console.error('Failed to load AI search config:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLatestAnalysis = async () => {
    try {
      const response = await fetch(`/api/ai-search-agent/analyze?workspace_id=${workspaceId}&limit=1`);
      const result = await response.json();

      if (result.success && result.data?.analyses?.length > 0) {
        setLatestAnalysis(result.data.analyses[0]);
      }
    } catch (error) {
      console.error('Failed to load analysis:', error);
    }
  };

  const handleSetupWebsite = async () => {
    if (!websiteInput.trim()) {
      setSaveMessage('Please enter your website URL');
      return;
    }

    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/ai-search-agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          website_url: websiteInput.trim()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to setup');
      }

      setConfig(result.data);
      setSaveMessage('✓ Website configured successfully! You can now run your first analysis.');

      // Auto-run first analysis
      setTimeout(() => runAnalysis(), 1000);
    } catch (error) {
      console.error('Setup failed:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to setup');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!config) return;

    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/ai-search-agent/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          enabled: config.enabled,
          auto_analyze_prospects: config.auto_analyze_prospects,
          analysis_depth: config.analysis_depth,
          check_meta_tags: config.check_meta_tags,
          check_structured_data: config.check_structured_data,
          check_robots_txt: config.check_robots_txt,
          check_sitemap: config.check_sitemap,
          check_llm_readability: config.check_llm_readability,
          check_entity_clarity: config.check_entity_clarity,
          check_fact_density: config.check_fact_density,
          check_citation_readiness: config.check_citation_readiness,
          learn_from_outreach: config.learn_from_outreach,
          learn_from_comments: config.learn_from_comments
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save');
      }

      setConfig(result.data);
      setSaveMessage('✓ Settings saved successfully');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const runAnalysis = async () => {
    if (!config?.website_url) return;

    setAnalyzing(true);
    setActiveTab('results');

    try {
      const response = await fetch('/api/ai-search-agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          website_url: config.website_url,
          depth: config.analysis_depth,
          include_learnings: config.learn_from_outreach || config.learn_from_comments
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      setLatestAnalysis(result.data);
    } catch (error) {
      console.error('Analysis failed:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const generateStrategy = async () => {
    setGeneratingStrategy(true);
    setActiveTab('strategy');

    try {
      const response = await fetch(`/api/ai-search-agent/content-strategy?workspace_id=${workspaceId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate strategy');
      }

      setContentStrategy(result.data);
    } catch (error) {
      console.error('Strategy generation failed:', error);
    } finally {
      setGeneratingStrategy(false);
    }
  };

  const sendEmailReport = async () => {
    if (!emailAddress.trim()) {
      setSaveMessage('Please enter an email address');
      return;
    }

    setSendingEmail(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/ai-search-agent/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          email: emailAddress.trim(),
          analysis_id: latestAnalysis?.id
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send report');
      }

      setSaveMessage(`✓ Report sent to ${emailAddress}`);
      setShowEmailInput(false);
      setEmailAddress('');
      setTimeout(() => setSaveMessage(''), 5000);
    } catch (error) {
      console.error('Send report failed:', error);
      setSaveMessage(error instanceof Error ? error.message : 'Failed to send report');
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-600';
    if (score >= 60) return 'bg-yellow-600';
    if (score >= 40) return 'bg-orange-600';
    return 'bg-red-600';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center">
              <TrendingUp size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">AI Search Agent</h2>
              <p className="text-gray-400 text-sm">Optimize content for AI search engines (GEO)</p>
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
        {config && (
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('setup')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'setup'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Setup
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'results'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Analysis Results
            </button>
            <button
              onClick={() => setActiveTab('strategy')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'strategy'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Content Strategy
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-orange-500" />
            </div>
          ) : !config ? (
            /* Initial Setup - No config yet */
            <div className="space-y-6">
              <div className="p-4 bg-orange-600/20 border border-orange-600/50 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Sparkles size={24} className="text-orange-400 flex-shrink-0" />
                  <div>
                    <h3 className="text-white font-medium">Welcome to AI Search Agent</h3>
                    <p className="text-gray-300 text-sm mt-1">
                      Enter your website URL to get started. The AI Search Agent will analyze your website
                      for SEO and GEO (Generative Engine Optimization) to help your content rank in AI search engines
                      like ChatGPT, Perplexity, and Google AI Overviews.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Your Website URL
                </label>
                <div className="flex space-x-3">
                  <div className="flex-1 relative">
                    <Globe className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={websiteInput}
                      onChange={(e) => setWebsiteInput(e.target.value)}
                      placeholder="https://www.example.com"
                      className="w-full pl-10 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-400 flex items-center">
                  <Lock size={12} className="mr-1" />
                  This URL will be locked after setup and cannot be changed
                </p>
              </div>

              <button
                onClick={handleSetupWebsite}
                disabled={saving || !websiteInput.trim()}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Setting up...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>Setup & Analyze Website</span>
                  </>
                )}
              </button>

              {saveMessage && (
                <p className={`text-sm text-center ${
                  saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'
                }`}>
                  {saveMessage}
                </p>
              )}
            </div>
          ) : activeTab === 'setup' ? (
            /* Setup Tab - Config exists */
            <>
              {/* Locked Website URL */}
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Lock size={20} className="text-gray-400" />
                    <div>
                      <div className="text-white font-medium">Website URL (Locked)</div>
                      <div className="text-orange-400 text-sm">{config.website_url}</div>
                    </div>
                  </div>
                  <button
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-sm rounded-lg transition-colors flex items-center space-x-2"
                  >
                    {analyzing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={14} />
                    )}
                    <span>{analyzing ? 'Analyzing...' : 'Run Analysis'}</span>
                  </button>
                </div>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                <div>
                  <div className="text-white font-medium">Enable AI Search Agent</div>
                  <div className="text-gray-400 text-sm">Automatically analyze and optimize for AI search</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                </label>
              </div>

              {/* Analysis Depth */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Analysis Depth
                </label>
                <select
                  value={config.analysis_depth}
                  onChange={(e) => setConfig({ ...config, analysis_depth: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="quick">Quick (Faster, basic checks)</option>
                  <option value="standard">Standard (Recommended)</option>
                  <option value="comprehensive">Comprehensive (Deep analysis)</option>
                </select>
              </div>

              {/* Learning from Other Agents */}
              <div className="space-y-3">
                <div className="text-sm font-medium text-gray-300">Learn From</div>

                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-white">Outreach Campaigns</span>
                    <span className="text-xs text-gray-400">(Message performance)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.learn_from_outreach}
                      onChange={(e) => setConfig({ ...config, learn_from_outreach: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-white">Commenting Agent</span>
                    <span className="text-xs text-gray-400">(Engagement insights)</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.learn_from_comments}
                      onChange={(e) => setConfig({ ...config, learn_from_comments: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                  </label>
                </div>
              </div>

              {/* GEO Info */}
              <div className="p-4 bg-orange-600/10 border border-orange-600/30 rounded-lg">
                <div className="flex items-start space-x-3">
                  <Sparkles size={20} className="text-orange-400 mt-0.5" />
                  <div>
                    <div className="text-white font-medium mb-1">What is GEO?</div>
                    <div className="text-gray-400 text-sm">
                      <strong>GEO (Generative Engine Optimization)</strong> is the practice of optimizing content
                      for AI search engines like ChatGPT, Perplexity, Claude, and Google AI Overviews.
                      Unlike traditional SEO, GEO focuses on:
                    </div>
                    <ul className="mt-2 text-sm text-gray-400 space-y-1">
                      <li>• <strong>LLM Readability</strong> - Can AI parse and understand your content?</li>
                      <li>• <strong>Entity Clarity</strong> - Are key concepts clearly defined?</li>
                      <li>• <strong>Fact Density</strong> - Does your content contain citable facts?</li>
                      <li>• <strong>Citation Readiness</strong> - Would AI cite your content as a source?</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'results' ? (
            /* Results Tab */
            <>
              {analyzing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 size={48} className="animate-spin text-orange-500" />
                  <div className="text-white font-medium">Analyzing your website...</div>
                  <div className="text-gray-400 text-sm">This may take 30-60 seconds</div>
                </div>
              ) : latestAnalysis ? (
                <div className="space-y-6">
                  {/* Score Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-700 rounded-lg text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(latestAnalysis.overall_score)}`}>
                        {latestAnalysis.overall_score}
                      </div>
                      <div className="text-gray-400 text-sm">Overall Score</div>
                    </div>
                    <div className="p-4 bg-gray-700 rounded-lg text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(latestAnalysis.seo_score)}`}>
                        {latestAnalysis.seo_score}
                      </div>
                      <div className="text-gray-400 text-sm">SEO Score</div>
                    </div>
                    <div className="p-4 bg-gray-700 rounded-lg text-center">
                      <div className={`text-3xl font-bold ${getScoreColor(latestAnalysis.geo_score)}`}>
                        {latestAnalysis.geo_score}
                      </div>
                      <div className="text-gray-400 text-sm">GEO Score</div>
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <div className="p-4 bg-gray-700 rounded-lg">
                    <h3 className="text-white font-medium mb-2">Executive Summary</h3>
                    <p className="text-gray-300 text-sm">{latestAnalysis.executive_summary}</p>
                    <div className="text-xs text-gray-500 mt-2">
                      Analyzed: {new Date(latestAnalysis.analyzed_at).toLocaleString()}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {latestAnalysis.recommendations && latestAnalysis.recommendations.length > 0 && (
                    <div>
                      <h3 className="text-white font-medium mb-3">Top Recommendations</h3>
                      <div className="space-y-3">
                        {latestAnalysis.recommendations.slice(0, 5).map((rec, i) => (
                          <div key={i} className="p-3 bg-gray-700 rounded-lg">
                            <div className="flex items-start space-x-3">
                              <span className={`px-2 py-0.5 text-xs rounded ${
                                rec.priority === 'high' ? 'bg-red-600' :
                                rec.priority === 'medium' ? 'bg-yellow-600' : 'bg-gray-600'
                              }`}>
                                {rec.priority.toUpperCase()}
                              </span>
                              <div>
                                <div className="text-white font-medium">{rec.title}</div>
                                <div className="text-gray-400 text-sm">{rec.description}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-3">
                    <button
                      onClick={generateStrategy}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium"
                    >
                      <BookOpen size={16} />
                      <span>Generate Strategy</span>
                    </button>
                    <button
                      onClick={() => setShowEmailInput(!showEmailInput)}
                      className="flex items-center justify-center space-x-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                    >
                      <Mail size={16} />
                      <span>Email Report</span>
                    </button>
                  </div>

                  {/* Email Input */}
                  {showEmailInput && (
                    <div className="p-4 bg-gray-700/50 rounded-lg space-y-3">
                      <div className="flex items-center space-x-2 text-gray-300 text-sm">
                        <Mail size={16} />
                        <span>Send analysis report via email</span>
                      </div>
                      <div className="flex space-x-3">
                        <input
                          type="email"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          placeholder="Enter email address"
                          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          onKeyDown={(e) => e.key === 'Enter' && sendEmailReport()}
                        />
                        <button
                          onClick={sendEmailReport}
                          disabled={sendingEmail || !emailAddress.trim()}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center space-x-2"
                        >
                          {sendingEmail ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Mail size={16} />
                          )}
                          <span>{sendingEmail ? 'Sending...' : 'Send'}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Search size={48} className="text-gray-500" />
                  <div className="text-white font-medium">No analysis yet</div>
                  <div className="text-gray-400 text-sm">Run an analysis to see your SEO & GEO scores</div>
                  <button
                    onClick={runAnalysis}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors"
                  >
                    Run First Analysis
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Strategy Tab */
            <>
              {generatingStrategy ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 size={48} className="animate-spin text-orange-500" />
                  <div className="text-white font-medium">Generating content strategy...</div>
                  <div className="text-gray-400 text-sm">Analyzing your performance data and website</div>
                </div>
              ) : contentStrategy ? (
                <div className="space-y-6">
                  {/* Strategy Overview */}
                  <div className="p-4 bg-gray-700 rounded-lg">
                    <h3 className="text-white font-medium mb-2">Content Strategy</h3>
                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{contentStrategy.strategy}</p>
                  </div>

                  {/* Content Pillars */}
                  {contentStrategy.content_pillars.length > 0 && (
                    <div>
                      <h3 className="text-white font-medium mb-3">Content Pillars</h3>
                      <div className="flex flex-wrap gap-2">
                        {contentStrategy.content_pillars.map((pillar, i) => (
                          <span key={i} className="px-3 py-1 bg-orange-600/30 border border-orange-600/50 text-orange-300 rounded-full text-sm">
                            {pillar}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Topics to Cover */}
                  {contentStrategy.topics_to_cover.length > 0 && (
                    <div>
                      <h3 className="text-white font-medium mb-3">Topics to Cover</h3>
                      <ul className="space-y-2">
                        {contentStrategy.topics_to_cover.map((topic, i) => (
                          <li key={i} className="flex items-start space-x-2 text-gray-300 text-sm">
                            <CheckCircle size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                            <span>{topic}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Format Recommendations */}
                  {contentStrategy.format_recommendations.length > 0 && (
                    <div>
                      <h3 className="text-white font-medium mb-3">Format Recommendations</h3>
                      <ul className="space-y-2">
                        {contentStrategy.format_recommendations.map((format, i) => (
                          <li key={i} className="flex items-start space-x-2 text-gray-300 text-sm">
                            <Sparkles size={16} className="text-orange-400 mt-0.5 flex-shrink-0" />
                            <span>{format}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Regenerate Button */}
                  <button
                    onClick={generateStrategy}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-medium"
                  >
                    <RefreshCw size={16} />
                    <span>Regenerate Strategy</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <BookOpen size={48} className="text-gray-500" />
                  <div className="text-white font-medium">No content strategy yet</div>
                  <div className="text-gray-400 text-sm text-center">
                    Generate a content strategy based on your website analysis<br />
                    and performance from outreach & commenting
                  </div>
                  <button
                    onClick={generateStrategy}
                    disabled={!latestAnalysis}
                    className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                  >
                    {latestAnalysis ? 'Generate Strategy' : 'Run Analysis First'}
                  </button>
                </div>
              )}
            </>
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
          {config && activeTab === 'setup' && (
            <button
              onClick={handleSaveSettings}
              disabled={saving || loading}
              className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          )}
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
