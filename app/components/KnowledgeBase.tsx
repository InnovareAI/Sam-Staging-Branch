'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Target, Users, Building2, TrendingUp, Plus, Settings, Upload, FileText, Package, MessageSquare, Cpu, Clock, AlertCircle, Mic, Briefcase, Trophy, GitBranch, Mail, Shield, UserCheck, MessageCircle, DollarSign, Zap, BarChart, Bot, HelpCircle, Globe, ArrowLeft, Trash2 } from 'lucide-react';
import SAMOnboarding from './SAMOnboarding';

type KnowledgeDocument = {
  id: string;
  section: string;
  title: string;
  summary?: string;
  tags?: string[];
  vectorChunks?: number;
  updatedAt?: string | null;
  metadata?: Record<string, unknown>;
};

type ICPProfile = {
  id: string;
  name?: string;
  icp_name?: string;
  overview?: Record<string, unknown>;
  target_profile?: Record<string, unknown>;
  decision_makers?: {
    primary_contact?: {
      name?: string;
      role?: string;
      company?: string;
    };
    supporting_contacts?: Array<{ name?: string; role?: string }>;
  };
  pain_points?: Record<string, unknown>;
  buying_process?: Record<string, unknown>;
  messaging?: Record<string, unknown>;
  success_metrics?: Record<string, unknown>;
  advanced?: {
    company_culture?: string[];
    messaging_guidelines?: string[];
    must_not_mention?: string[];
    human_checkpoints?: string[];
  } & Record<string, unknown>;
  [key: string]: unknown;
};

type KnowledgeBaseProduct = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  pricing?: Record<string, unknown> | null;
  features?: string[] | null;
  benefits?: string[] | null;
  use_cases?: string[] | null;
  competitive_advantages?: string[] | null;
  target_segments?: string[] | null;
  created_at?: string;
  updated_at?: string;
};

type KnowledgeBaseCompetitor = {
  id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  pricing_model?: string | null;
  key_features?: string[] | null;
  target_market?: string | null;
  competitive_positioning?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

type KnowledgeBasePersona = {
  id: string;
  name: string;
  icp_id?: string | null;
  job_title?: string | null;
  department?: string | null;
  seniority_level?: string | null;
  decision_making_role?: string | null;
  pain_points?: string[] | null;
  goals?: string[] | null;
  communication_preferences?: Record<string, unknown> | null;
  objections?: string[] | null;
  messaging_approach?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

const ensureRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const ensureArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .map((item) => (typeof item === 'string' ? item.trim() : String(item).trim()))
        .filter((item) => item.length > 0)
    : [];

const transformICPResponse = (icp: Record<string, unknown>): ICPProfile => {
  const industries = ensureArray(icp['industries']);
  const jobTitles = ensureArray(icp['job_titles']);
  const locations = ensureArray(icp['locations']);
  const technologies = ensureArray(icp['technologies']);
  const painPoints = ensureArray(icp['pain_points']);
  const companySizeMin = typeof icp['company_size_min'] === 'number' ? icp['company_size_min'] : null;
  const companySizeMax = typeof icp['company_size_max'] === 'number' ? icp['company_size_max'] : null;
  const idValue = icp['id'];

  const id = typeof idValue === 'string' && idValue.trim().length > 0
    ? idValue
    : String(idValue ?? `icp-${Date.now()}`);

  return {
    id,
    name: typeof icp['name'] === 'string' ? icp['name'] : typeof icp['icp_name'] === 'string' ? icp['icp_name'] : 'Untitled ICP',
    overview: {
      industries,
      job_titles: jobTitles,
      locations,
      technologies,
      company_size_min: companySizeMin,
      company_size_max: companySizeMax,
    },
    target_profile: {
      industries,
      job_titles: jobTitles,
      locations,
      technologies,
      company_size_range: [companySizeMin, companySizeMax].filter((value) => value !== null),
    },
    decision_makers: {},
    pain_points: {
      operational_challenges: painPoints,
      growth_pressures: [],
      emotional_drivers: [],
    },
    buying_process: ensureRecord(icp['qualification_criteria']),
    messaging: ensureRecord(icp['messaging_framework']),
    success_metrics: {},
    advanced: {},
  };
};

// Enhanced AI-Powered Document Upload Component
function DocumentUpload({ section, onComplete }: { section: string; onComplete?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'extracting' | 'tagging' | 'vectorizing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  
  const handleFileUpload = async () => {
    if (!file && !url) return;
    
    setStatus('uploading');
    setProgress(10);
    setError('');
    
    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      formData.append('section', section);
      formData.append('uploadMode', uploadMode);
      if (url) {
        formData.append('url', url);
      }
      
      // Step 1: Upload and extract content
      setStatus('extracting');
      setProgress(30);
      
      const uploadResponse = await fetch('/api/knowledge-base/upload-document', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }
      
      const uploadResult = await uploadResponse.json();
      setProgress(50);
      
      // Step 2: AI Processing and Tagging
      setStatus('tagging');
      setProgress(70);
      
      const processingResponse = await fetch('/api/knowledge-base/process-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: uploadResult.documentId,
          content: uploadResult.content,
          section: section,
          filename: file?.name || url
        })
      });
      
      if (!processingResponse.ok) {
        throw new Error('AI processing failed');
      }
      
      const processingResult = await processingResponse.json();
      setAiTags(processingResult.tags);
      setProgress(85);
      
      // Step 3: Vectorization and RAG Integration
      setStatus('vectorizing');
      setProgress(95);
      
      const vectorResponse = await fetch('/api/knowledge-base/vectorize-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: uploadResult.documentId,
          content: uploadResult.content,
          tags: processingResult.tags,
          section: section,
          metadata: processingResult.metadata
        })
      });
      
      if (!vectorResponse.ok) {
        throw new Error('Vectorization failed');
      }
      
      setProgress(100);
      setStatus('done');

      if (typeof onComplete === 'function') {
        onComplete();
      }
      
      // Reset form after success
      setTimeout(() => {
        setFile(null);
        setUrl('');
        setStatus('idle');
        setProgress(0);
        setAiTags([]);
      }, 3000);
      
    } catch (error) {
      console.error('Document processing error:', error);
      setError(error instanceof Error ? error.message : 'Processing failed');
      setStatus('error');
    }
  };
  
  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
      {/* Upload Mode Toggle */}
      <div className="flex mb-4 space-x-2">
        <button
          onClick={() => setUploadMode('file')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            uploadMode === 'file' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          📄 File Upload
        </button>
        <button
          onClick={() => setUploadMode('url')}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            uploadMode === 'url' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
          }`}
        >
          🔗 URL/Link
        </button>
      </div>
      
      {/* File Upload Mode */}
      {uploadMode === 'file' && (
        <div className="border-2 border-dashed border-gray-500 rounded p-4 text-center">
          <Upload className="mx-auto mb-2 text-gray-400" size={24} />
          <input 
            type="file" 
            accept=".pdf,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} 
            className="text-gray-300 text-sm w-full"
          />
          <p className="text-xs text-gray-400 mt-2">
            Supported: PDF, TXT, MD files (max 10MB)
          </p>
        </div>
      )}
      
      {/* URL Upload Mode */}
      {uploadMode === 'url' && (
        <div className="border-2 border-dashed border-gray-500 rounded p-4">
          <Globe className="mx-auto mb-2 text-gray-400" size={24} />
          <input 
            type="url" 
            value={url}
            onChange={(e) => setUrl(e.target.value)} 
            placeholder="https://example.com/document-or-page"
            className="w-full bg-gray-600 text-gray-300 text-sm rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            Web pages, Google Docs, presentations, PDFs, articles
          </p>
        </div>
      )}
      
      {/* Upload Status and Actions */}
      {(file || url) && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">
              {file ? file.name : url}
            </span>
            <button
              onClick={handleFileUpload}
              disabled={status !== 'idle' && status !== 'error'}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'idle' && '🚀 Process with AI'}
              {status === 'uploading' && '📤 Uploading...'}
              {status === 'extracting' && '📄 Extracting Content...'}
              {status === 'processing' && '🤖 AI Processing...'}
              {status === 'tagging' && '🏷️ AI Tagging...'}
              {status === 'vectorizing' && '🧠 Adding to Knowledgebase...'}
              {status === 'done' && '✅ Complete'}
              {status === 'error' && '🔄 Retry'}
            </button>
          </div>
          
          {/* Progress Bar */}
          {(status !== 'idle' && status !== 'error') && (
            <div className="w-full bg-gray-600 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          )}
          
          {/* Status Messages */}
          {status === 'extracting' && (
            <p className="text-xs text-blue-400">📄 Extracting text content and metadata...</p>
          )}
          {status === 'tagging' && (
            <p className="text-xs text-purple-400">🤖 AI analyzing content for smart categorization...</p>
          )}
          {status === 'vectorizing' && (
            <p className="text-xs text-green-400">🧠 Creating embeddings for SAM AI knowledge access...</p>
          )}
          {status === 'done' && (
            <div className="space-y-1">
              <p className="text-xs text-green-400">✅ Document processed and integrated into Knowledgebase</p>
              {aiTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {aiTags.slice(0, 4).map((tag, i) => (
                    <span key={i} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">
                      {tag}
                    </span>
                  ))}
                  {aiTags.length > 4 && (
                    <span className="text-xs text-gray-400">+{aiTags.length - 4} more</span>
                  )}
                </div>
              )}
            </div>
          )}
          {status === 'error' && error && (
            <p className="text-xs text-red-400">❌ {error}</p>
          )}
        </div>
      )}
    </div>
  );
}

// Comprehensive ICP Configuration Component
function ICPConfiguration({
  onBack,
  onProfilesUpdated,
  onRefresh
}: {
  onBack?: () => void;
  onProfilesUpdated?: (profiles: Record<string, ICPProfile>) => void;
  onRefresh?: () => void;
}) {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [icpProfiles, setIcpProfiles] = useState<Record<string, ICPProfile>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const currentICP = selectedICP && icpProfiles[selectedICP] ? icpProfiles[selectedICP] : null;

  // Fetch ICP profiles on component mount
  React.useEffect(() => {
    const fetchICPProfiles = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/knowledge-base/icps');
        if (response.ok) {
          const payload = await response.json();
          const entries = Array.isArray(payload?.icps) ? payload.icps : [];
          const mapped = entries.reduce((acc: Record<string, ICPProfile>, item: Record<string, unknown>) => {
            const profile = transformICPResponse(item);
            acc[profile.id] = profile;
            return acc;
          }, {});

          setIcpProfiles(mapped);
          onProfilesUpdated?.(mapped);
          onRefresh?.();

          if (!selectedICP && Object.keys(mapped).length > 0) {
            setSelectedICP(Object.keys(mapped)[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch ICP profiles:', error);
        setIcpProfiles({});
      } finally {
        setIsLoading(false);
      }
    };

    fetchICPProfiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreateICP = () => {
    setShowCreateForm(true);
  };

  const handleCreateICPSubmit = async (icpName: string) => {
    try {
      const response = await fetch('/api/knowledge-base/icps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: icpName
        })
      });
      
      if (response.ok) {
        const payload = await response.json();
        const createdRaw = (payload?.icp ?? {}) as Record<string, unknown>;
        const createdProfile = transformICPResponse(createdRaw);

        setIcpProfiles(prev => {
          const updated = { ...prev, [createdProfile.id]: createdProfile };
          onProfilesUpdated?.(updated);
          return updated;
        });
        onRefresh?.();
        setSelectedICP(createdProfile.id);
        setShowCreateForm(false);
      }
    } catch (error) {
      console.error('Failed to create ICP profile:', error);
    }
  };

  // Comprehensive ICP Categories
  const icpCategories = [
    { id: 'overview', label: 'Overview', icon: Target, description: 'ICP summary and key metrics' },
    { id: 'target_profile', label: 'Target Profile', icon: Building2, description: 'Company size, industry, geography, technology requirements' },
    { id: 'decision_makers', label: 'Decision Makers', icon: Users, description: 'Authority levels, influence patterns, stakeholder hierarchies' },
    { id: 'pain_points', label: 'Pain Points & Signals', icon: AlertCircle, description: 'Operational challenges, buying signals, growth pressures' },
    { id: 'buying_process', label: 'Buying Process', icon: GitBranch, description: 'Stakeholder analysis, approval workflows, evaluation stages' },
    { id: 'messaging', label: 'Messaging Strategy', icon: MessageSquare, description: 'Value propositions, competitive positioning, role-based communication' },
    { id: 'success_metrics', label: 'Success Metrics', icon: BarChart, description: 'Industry KPIs, ROI models, performance benchmarks' },
    { id: 'advanced', label: 'Advanced Classification', icon: Settings, description: 'Technology adoption, compliance, market trends, culture' }
  ];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to Knowledgebase"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h2 className="text-2xl font-semibold text-white flex items-center">
            <Target className="mr-2" size={24} />
            ICP Configuration
          </h2>
        </div>
        <div className="flex space-x-2">
          <button 
            onClick={handleCreateICP}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center"
          >
            <Plus className="mr-1" size={16} />
            New ICP
          </button>
          <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors flex items-center">
            <Upload className="mr-1" size={16} />
            Import
          </button>
        </div>
      </div>

      {/* Create ICP Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96">
            <h3 className="text-xl font-semibold text-white mb-4">Create New ICP Profile</h3>
            <input 
              type="text" 
              placeholder="Enter ICP profile name..."
              className="w-full bg-gray-700 border border-gray-600 px-3 py-2 rounded text-white placeholder-gray-400 mb-4"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleCreateICPSubmit(e.currentTarget.value.trim());
                }
              }}
              autoFocus
            />
            <div className="flex space-x-2">
              <button 
                onClick={() => {
                  const input = document.querySelector('input[placeholder="Enter ICP profile name..."]') as HTMLInputElement;
                  if (input?.value.trim()) {
                    handleCreateICPSubmit(input.value.trim());
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
              >
                Create
              </button>
              <button 
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Navigation - Always Show (Box Design) */}
      <div className="mb-6">
        {/* Loading indicator - small and non-blocking */}
        {isLoading && (
          <div className="text-center mb-4">
            <div className="text-gray-400 text-sm">Loading ICP profiles...</div>
          </div>
        )}
        
        {/* ICP Profile Selector - Only if profiles exist */}
        {Object.keys(icpProfiles).length > 0 && (
          <div className="flex space-x-1 mb-4 bg-gray-700 rounded-lg p-1">
            {Object.entries(icpProfiles).map(([key, profile]) => (
              <button
                key={key}
                onClick={() => setSelectedICP(key)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
                  selectedICP === key
                    ? 'text-white bg-gray-600'
                    : 'text-gray-300 hover:text-white'
                }`}
              >
                {profile?.name || profile?.icp_name || 'Unnamed Profile'}
              </button>
            ))}
          </div>
        )}
        
        {/* Category Navigation - Always Visible (Box Design) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
              {icpCategories.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`p-3 rounded-lg text-left transition-all ${
                      activeCategory === category.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <IconComponent size={16} className="mr-2" />
                      <span className="text-sm font-medium">{category.label}</span>
                    </div>
                    <p className="text-xs opacity-80">{category.description}</p>
                  </button>
                );
              })}
            </div>
            
            {/* No Profiles Message - Only if no profiles */}
            {Object.keys(icpProfiles).length === 0 && (
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6">
                <div className="text-center">
                  <Target size={32} className="mx-auto text-gray-500 mb-2" />
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No ICP Profiles Created Yet</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Create your first ICP profile to define your ideal customers. Use the categories below to see the fields you'll be able to configure once you create a profile.
                  </p>
                  <button 
                    onClick={handleCreateICP}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    <Plus className="mr-1 inline" size={16} />
                    Create Your First ICP Profile
                  </button>
                </div>
              </div>
            )}
          </div>

      {/* Category Content */}
      <div className="space-y-6">
        {/* Show content for current ICP if available, otherwise show structure */}
        {(currentICP || Object.keys(icpProfiles).length === 0) && (
          <>
            {activeCategory === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* ICP Performance Card */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 flex items-center">
                  <BarChart className="mr-2" size={16} />
                  Performance Metrics
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Response Rate:</span>
                    <span className="text-green-400 font-medium">8.5% ↗️</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Meeting Rate:</span>
                    <span className="text-blue-400 font-medium">3.2% ↗️</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Conversion:</span>
                    <span className="text-purple-400 font-medium">12% ↗️</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">ROI Score:</span>
                    <span className="text-yellow-400 font-medium">⭐⭐⭐⭐⭐</span>
                  </div>
                </div>
              </div>

              {/* Market Size Card */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 flex items-center">
                  <Target className="mr-2" size={16} />
                  Market Opportunity
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-300">TAM:</span>
                    <span className="text-white">~45,000 companies</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">SAM:</span>
                    <span className="text-white">~12,000 companies</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Confidence:</span>
                    <span className="text-green-400">92%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Last Updated:</span>
                    <span className="text-gray-400">2 days ago</span>
                  </div>
                </div>
              </div>

              {/* Quick Actions Card */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-3 flex items-center">
                  <Zap className="mr-2" size={16} />
                  Quick Actions
                </h3>
                <div className="space-y-2">
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded text-sm transition-colors">
                    Create Campaign
                  </button>
                  <button className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-3 rounded text-sm transition-colors">
                    Validate Prospects
                  </button>
                  <button className="w-full bg-gray-600 hover:bg-gray-500 text-white py-2 px-3 rounded text-sm transition-colors">
                    Export Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeCategory === 'target_profile' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Company Demographics */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Building2 className="mr-2" size={16} />
                  Company Demographics
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Employee Count</label>
                    <div className="flex flex-wrap gap-2">
                      {['50-100', '100-500', '500-1000', '1000+'].map(range => (
                        <span key={range} className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs">
                          {range}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Revenue Range</label>
                    <div className="flex flex-wrap gap-2">
                      {['$10M-$50M', '$50M-$100M'].map(range => (
                        <span key={range} className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs">
                          {range}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Growth Stage</label>
                    <div className="flex flex-wrap gap-2">
                      {['Series A', 'Series B', 'Growth'].map(stage => (
                        <span key={stage} className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">
                          {stage}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Geographic Focus */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Globe className="mr-2" size={16} />
                  Geographic Focus
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Primary Markets</label>
                    <div className="flex flex-wrap gap-2">
                      {['United States', 'Canada'].map(market => (
                        <span key={market} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs">
                          {market}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Regional Preferences</label>
                    <div className="flex flex-wrap gap-2">
                      {['East Coast', 'West Coast', 'Major Metro'].map(region => (
                        <span key={region} className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs">
                          {region}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Expansion Markets</label>
                    <div className="flex flex-wrap gap-2">
                      {['United Kingdom', 'Australia'].map(market => (
                        <span key={market} className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs">
                          {market}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Industry Segmentation */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Briefcase className="mr-2" size={16} />
                  Industry & Market Segmentation
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Primary Industries</label>
                    <div className="flex flex-wrap gap-2">
                      {['SaaS', 'FinTech', 'HealthTech'].map(industry => (
                        <span key={industry} className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">
                          {industry}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Secondary Industries</label>
                    <div className="flex flex-wrap gap-2">
                      {['MarTech', 'EdTech', 'PropTech'].map(industry => (
                        <span key={industry} className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs">
                          {industry}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Technology Requirements */}
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Cpu className="mr-2" size={16} />
                  Technology & Infrastructure
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Required Tech Stack</label>
                    <div className="flex flex-wrap gap-2">
                      {['Salesforce', 'HubSpot', 'AWS'].map(tech => (
                        <span key={tech} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Preferred Platforms</label>
                    <div className="flex flex-wrap gap-2">
                      {['Azure', 'React', 'API-First'].map(tech => (
                        <span key={tech} className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs">
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Security Requirements</label>
                    <div className="flex flex-wrap gap-2">
                      {['SOC2', 'GDPR', 'API Security'].map(req => (
                        <span key={req} className="bg-red-600 text-white px-3 py-1 rounded-full text-xs">
                          {req}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* DECISION MAKERS Category */}
          {activeCategory === 'decision_makers' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Users className="mr-2" size={16} />
                  Executive Level
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Identified Roles</label>
                    <div className="text-gray-400 text-sm border border-gray-600 rounded p-2 bg-gray-800">
                      {currentICP?.decision_makers?.identified_roles?.length > 0 ? 
                        currentICP.decision_makers.identified_roles.join(', ') : 
                        'e.g., CEO, CTO, Head of Sales, VP Marketing, Operations Director...'
                      }
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Authority Level</label>
                    <div className="text-gray-400 text-sm border border-gray-600 rounded p-2 bg-gray-800">
                      {currentICP?.decision_makers?.authority_level?.length > 0 ? 
                        currentICP.decision_makers.authority_level.join(', ') : 
                        'e.g., Final Decision Maker, Budget Approver, Technical Evaluator, Influencer...'
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <UserCheck className="mr-2" size={16} />
                  Primary Contact
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Contact Information</label>
                    <div className="text-gray-400 text-sm border border-gray-600 rounded p-2 bg-gray-800 space-y-1">
                      <div>Name: {currentICP?.decision_makers?.primary_contact?.name || 'e.g., John Smith'}</div>
                      <div>Company: {currentICP?.decision_makers?.primary_contact?.company || 'e.g., TechCorp Inc.'}</div>
                      <div>Engagement: {currentICP?.decision_makers?.primary_contact?.engagement_level || 'e.g., High interest, active evaluator'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Users className="mr-2" size={16} />
                  Stakeholder Subcategories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Executive Level</h4>
                    <div className="text-gray-400 text-sm">
                      Authority: {currentICP?.decision_makers?.subcategories?.executive_level?.authority || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Operational Level</h4>
                    <div className="text-gray-400 text-sm">
                      Influence: {currentICP?.decision_makers?.subcategories?.operational_level?.influence || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Technical Stakeholders</h4>
                    <div className="text-gray-400 text-sm">
                      Involvement: {currentICP?.decision_makers?.subcategories?.technical_stakeholders?.involvement || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Purchasing Authority</h4>
                    <div className="text-gray-400 text-sm">
                      Process: {currentICP?.decision_makers?.subcategories?.purchasing_authority?.approval_process || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PAIN POINTS & SIGNALS Category */}
          {activeCategory === 'pain_points' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <AlertCircle className="mr-2" size={16} />
                  Current Challenges
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Operational Challenges</label>
                    <div className="text-gray-400 text-sm max-h-32 overflow-y-auto border border-gray-600 rounded p-2 bg-gray-800">
                      {currentICP?.pain_points?.operational_challenges?.length > 0 ? 
                        currentICP.pain_points.operational_challenges.map((challenge: string, i: number) => (
                          <div key={i} className="mb-1">• {challenge}</div>
                        )) : 
                        <div className="space-y-1">
                          <div>• Manual processes eating up team time</div>
                          <div>• Difficulty scaling current systems</div>
                          <div>• Integration challenges between tools</div>
                          <div>• Data silos preventing insights</div>
                          <div>• Compliance and security concerns</div>
                        </div>
                      }
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Growth Pressures</label>
                    <div className="text-gray-400 text-sm border border-gray-600 rounded p-2 bg-gray-800">
                      {currentICP?.pain_points?.growth_pressures?.length > 0 ? 
                        currentICP.pain_points.growth_pressures.join(', ') : 
                        'e.g., Need to expand market share, Pressure to reduce costs, Requirements for faster time-to-market, Board demands for digital transformation'
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <TrendingUp className="mr-2" size={16} />
                  Buying Signals
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Detected Signals</label>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.pain_points?.buying_signals?.length > 0 ? 
                        currentICP.pain_points.buying_signals.join(', ') : 
                        'No buying signals detected yet'
                      }
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Urgency Indicators</label>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.pain_points?.urgency_indicators?.length > 0 ? 
                        currentICP.pain_points.urgency_indicators.join(', ') : 
                        'No urgency indicators identified'
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <AlertCircle className="mr-2" size={16} />
                  Pain Points Subcategories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Current Challenges</h4>
                    <div className="text-gray-400 text-sm space-y-1">
                      <div>Operational: {currentICP?.pain_points?.subcategories?.current_challenges?.operational?.length || 0}</div>
                      <div>Technical: {currentICP?.pain_points?.subcategories?.current_challenges?.technical?.length || 0}</div>
                      <div>Business: {currentICP?.pain_points?.subcategories?.current_challenges?.business?.length || 0}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Buying Indicators</h4>
                    <div className="text-gray-400 text-sm space-y-1">
                      <div>Budget: {currentICP?.pain_points?.subcategories?.buying_indicators?.budget ? '✓' : '✗'}</div>
                      <div>Timeline: {currentICP?.pain_points?.subcategories?.buying_indicators?.timeline ? '✓' : '✗'}</div>
                      <div>Authority: {currentICP?.pain_points?.subcategories?.buying_indicators?.authority ? '✓' : '✗'}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Competitive Pressures</h4>
                    <div className="text-gray-400 text-sm">
                      Urgency: {currentICP?.pain_points?.subcategories?.competitive_pressures?.urgency || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* BUYING PROCESS Category */}
          {activeCategory === 'buying_process' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <GitBranch className="mr-2" size={16} />
                  Evaluation Stages
                </h3>
                <div className="space-y-3">
                  {currentICP?.buying_process?.evaluation_stages?.length > 0 ? 
                    currentICP.buying_process.evaluation_stages.map((stage: string, i: number) => (
                      <div key={i} className="flex items-center text-gray-300">
                        <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs mr-3">
                          {i + 1}
                        </div>
                        {stage}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No evaluation stages identified yet</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Clock className="mr-2" size={16} />
                  Timeline & Stakeholders
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Timeline Indicators</label>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.buying_process?.timeline?.length > 0 ? 
                        currentICP.buying_process.timeline.join(', ') : 
                        'No timeline indicators identified'
                      }
                    </div>
                  </div>
                  <div>
                    <label className="text-gray-300 text-sm font-medium block mb-1">Stakeholder Involvement</label>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.buying_process?.stakeholder_involvement?.length > 0 ? 
                        currentICP.buying_process.stakeholder_involvement.join(', ') : 
                        'No stakeholder involvement mapped'
                      }
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <GitBranch className="mr-2" size={16} />
                  Buying Process Subcategories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Evaluation Framework</h4>
                    <div className="text-gray-400 text-sm">
                      Stages: {currentICP?.buying_process?.subcategories?.evaluation_framework?.stages?.length || 0}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Approval Workflow</h4>
                    <div className="text-gray-400 text-sm">
                      Steps: {currentICP?.buying_process?.subcategories?.approval_workflow?.steps?.length || 0}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Vendor Evaluation</h4>
                    <div className="text-gray-400 text-sm">
                      Process: {currentICP?.buying_process?.subcategories?.vendor_evaluation?.process || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Implementation Planning</h4>
                    <div className="text-gray-400 text-sm">
                      Timeline: {currentICP?.buying_process?.subcategories?.implementation_planning?.timeline || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGING STRATEGY Category */}
          {activeCategory === 'messaging' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <MessageSquare className="mr-2" size={16} />
                  Value Propositions
                </h3>
                <div className="space-y-2">
                  {currentICP?.messaging?.value_propositions?.length > 0 ? 
                    currentICP.messaging.value_propositions.map((prop: string, i: number) => (
                      <div key={i} className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">
                        {prop}
                      </div>
                    )) : 
                    <div className="border border-gray-600 rounded p-2 bg-gray-800 space-y-1">
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">Save 40% on operational costs</div>
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">Reduce time-to-market by 60%</div>
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">Enterprise-grade security & compliance</div>
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs">Seamless integration with existing tools</div>
                    </div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <MessageCircle className="mr-2" size={16} />
                  Communication Preferences
                </h3>
                <div className="space-y-2">
                  {currentICP?.messaging?.communication_preferences?.length > 0 ? 
                    currentICP.messaging.communication_preferences.map((pref: string, i: number) => (
                      <div key={i} className="bg-gray-600 text-white px-3 py-1 rounded-full text-xs">
                        {pref}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No communication preferences identified</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <TrendingUp className="mr-2" size={16} />
                  Competitive Mentions
                </h3>
                <div className="space-y-2">
                  {currentICP?.messaging?.competitive_mentions?.length > 0 ? 
                    currentICP.messaging.competitive_mentions.map((mention: string, i: number) => (
                      <div key={i} className="text-gray-300 text-sm p-2 bg-gray-600 rounded">
                        {mention}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No competitive mentions identified</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <MessageSquare className="mr-2" size={16} />
                  Messaging Subcategories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Communication Style</h4>
                    <div className="text-gray-400 text-sm">
                      Preference: {currentICP?.messaging?.subcategories?.communication_style?.preference || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Channel Preferences</h4>
                    <div className="text-gray-400 text-sm space-y-1">
                      <div>Email: {currentICP?.messaging?.subcategories?.channel_preferences?.email || 'Unknown'}</div>
                      <div>LinkedIn: {currentICP?.messaging?.subcategories?.channel_preferences?.linkedin || 'Unknown'}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SUCCESS METRICS Category */}
          {activeCategory === 'success_metrics' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <BarChart className="mr-2" size={16} />
                  Relevant KPIs
                </h3>
                <div className="space-y-2">
                  {currentICP?.success_metrics?.relevant_kpis?.length > 0 ? 
                    currentICP.success_metrics.relevant_kpis.map((kpi: string, i: number) => (
                      <div key={i} className="bg-green-600 text-white px-3 py-1 rounded-full text-xs">
                        {kpi}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No KPIs identified yet</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Trophy className="mr-2" size={16} />
                  Performance Benchmarks
                </h3>
                <div className="space-y-2">
                  {currentICP?.success_metrics?.performance_benchmarks?.length > 0 ? 
                    currentICP.success_metrics.performance_benchmarks.map((benchmark: string, i: number) => (
                      <div key={i} className="text-gray-300 text-sm">
                        • {benchmark}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No benchmarks identified yet</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Clock className="mr-2" size={16} />
                  Success Timeline & ROI
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Success Timeline</h4>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.success_metrics?.success_timeline?.length > 0 ? 
                        currentICP.success_metrics.success_timeline.join(', ') : 
                        'No timeline defined'
                      }
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">ROI Expectations</h4>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.success_metrics?.roi_expectations || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ADVANCED CLASSIFICATION Category */}
          {activeCategory === 'advanced' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Cpu className="mr-2" size={16} />
                  Technology Adoption
                </h3>
                <div className="space-y-2">
                  {currentICP?.advanced?.technology_adoption?.length > 0 ? 
                    currentICP.advanced.technology_adoption.map((adoption: string, i: number) => (
                      <div key={i} className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs">
                        {adoption}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No technology adoption patterns identified</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Shield className="mr-2" size={16} />
                  Compliance Requirements
                </h3>
                <div className="space-y-2">
                  {currentICP?.advanced?.compliance_requirements?.length > 0 ? 
                    currentICP.advanced.compliance_requirements.map((req: string, i: number) => (
                      <div key={i} className="bg-red-600 text-white px-3 py-1 rounded-full text-xs">
                        {req}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No compliance requirements identified</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <TrendingUp className="mr-2" size={16} />
                  Market Trends
                </h3>
                <div className="space-y-2">
                  {currentICP?.advanced?.market_trends?.length > 0 ? 
                    currentICP.advanced.market_trends.map((trend: string, i: number) => (
                      <div key={i} className="bg-yellow-600 text-white px-3 py-1 rounded-full text-xs">
                        {trend}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No market trends identified</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Users className="mr-2" size={16} />
                  Company Culture
                </h3>
                <div className="space-y-2">
                  {currentICP?.advanced?.company_culture?.length > 0 ? 
                    currentICP.advanced.company_culture.map((culture: string, i: number) => (
                      <div key={i} className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs">
                        {culture}
                      </div>
                    )) : 
                    <div className="text-gray-400 text-sm">No company culture insights identified</div>
                  }
                </div>
              </div>

              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 lg:col-span-2">
                <h3 className="text-white font-medium mb-4 flex items-center">
                  <Settings className="mr-2" size={16} />
                  Advanced Classification Subcategories
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Tech Maturity</h4>
                    <div className="text-gray-400 text-sm">
                      Stage: {currentICP?.advanced?.subcategories?.tech_maturity?.adoption_stage || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Innovation Readiness</h4>
                    <div className="text-gray-400 text-sm">
                      {currentICP?.advanced?.innovation_readiness || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Market Positioning</h4>
                    <div className="text-gray-400 text-sm">
                      Landscape: {currentICP?.advanced?.subcategories?.market_positioning?.competitive_landscape || 'Unknown'}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-gray-300 font-medium mb-2">Organizational Culture</h4>
                    <div className="text-gray-400 text-sm">
                      Style: {currentICP?.advanced?.subcategories?.organizational_culture?.decision_style || 'Unknown'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
}

// Vector Test Component
function VectorTest() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ score: number; text: string; labels: string[] }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  const run = async () => {
    if (!q.trim()) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement actual vector search API call
      // For now, show empty results since we removed mock data
      setResults([]);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="font-semibold mb-2 text-white">Test Knowledgebase Retrieval</h3>
      <div className="flex gap-2">
        <input 
          className="bg-gray-700 border border-gray-600 px-3 py-2 rounded text-white placeholder-gray-400 w-full focus:border-purple-500 focus:outline-none" 
          placeholder="Ask a question…" 
          value={q} 
          onChange={e => setQ(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && run()}
        />
        <button 
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50" 
          onClick={run}
          disabled={isLoading || !q.trim()}
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>
      </div>
      <div className="space-y-2 mt-3 max-h-72 overflow-auto">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-400">Searching knowledge base...</div>
          </div>
        ) : results.length > 0 ? (
          results.map((r, i) => (
            <div key={i} className="p-3 bg-gray-700 border border-gray-600 rounded">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 text-white text-[10px]">
                  {(r.score * 100).toFixed(0)}
                </span>
                <span>score</span>
              </div>
              <div className="text-sm mt-1 text-gray-300">{r.text}</div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {r.labels.map(l => (
                  <span key={l} className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-200">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))
        ) : q && !isLoading ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">No results found</div>
            <div className="text-gray-500 text-sm">Try uploading relevant documents to the knowledge base</div>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 text-sm">Enter a question to search the knowledge base</div>
          </div>
        )}
      </div>
    </div>
  );
}

// Documents Table Component
type Doc = { name: string; status: 'Ready' | 'Processing' | 'Error'; uploaded: string; labels: string[] };

function DocumentsTable() {
  const [documents] = useState<Doc[]>([]);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 font-semibold text-white">Documents</div>
      {documents.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-750 text-gray-400">
            <tr>
              <th className="text-left px-4 py-2">File Name</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Uploaded</th>
              <th className="text-left px-4 py-2">Labels</th>
              <th className="text-right px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((d) => (
              <tr key={d.name} className="border-t border-gray-700">
                <td className="px-4 py-2 text-gray-300">{d.name}</td>
                <td className="px-4 py-2">
                  {d.status === 'Ready' && (
                    <span className="inline-flex items-center gap-1 text-green-400">
                      <span className="w-2 h-2 rounded-full bg-green-500" />Ready
                    </span>
                  )}
                  {d.status === 'Processing' && (
                    <span className="inline-flex items-center gap-1 text-yellow-400">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />Processing
                    </span>
                  )}
                  {d.status === 'Error' && (
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <span className="w-2 h-2 rounded-full bg-red-500" />Error
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-400">{d.uploaded}</td>
                <td className="px-4 py-2">
                  <div className="flex gap-2 flex-wrap">
                    {d.labels.length ? (
                      d.labels.map(l => (
                        <span key={l} className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-200">
                          {l}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2 text-right">
                  <button className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors">
                    View Chunks
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto text-gray-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Documents Uploaded</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Upload your first document to start building your knowledge base. Supported formats: PDF, TXT, MD (max 10MB)
          </p>
        </div>
      )}
    </div>
  );
}

// Chunk Drawer Component
type Chunk = { text: string; labels: string[]; confidence: number };

function ChunkDrawer() {
  const [open, setOpen] = useState(false);
  const [chunks] = useState<Chunk[]>([]);
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="font-semibold text-white">Document Chunks</div>
        <button 
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors" 
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="p-4 space-y-3 max-h-72 overflow-auto">
          {chunks.length > 0 ? (
            chunks.map((c, i) => (
              <div key={i} className="p-3 bg-gray-700 border border-gray-600 rounded">
                <div className="text-sm text-gray-300">{c.text}</div>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {c.labels.map(l => (
                    <span key={l} className="px-2 py-0.5 text-xs rounded bg-gray-600 text-gray-200">
                      {l}
                    </span>
                  ))}
                  <span className="ml-auto text-xs text-gray-400">conf: {Math.round(c.confidence * 100)}%</span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">No chunks available</div>
              <div className="text-gray-500 text-sm">Upload and process documents to see text chunks</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const KnowledgeBase: React.FC = () => {
  const [activeSection, setActiveSection] = useState('overview');
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [icpCount, setIcpCount] = useState<number | null>(null);
  const [icpProfiles, setIcpProfiles] = useState<Record<string, ICPProfile>>({});
  const [products, setProducts] = useState<KnowledgeBaseProduct[]>([]);
  const [competitors, setCompetitors] = useState<KnowledgeBaseCompetitor[]>([]);
  const [personas, setPersonas] = useState<KnowledgeBasePersona[]>([]);
  const [kbFeedback, setKbFeedback] = useState<any>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const loadKBFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const response = await fetch('/api/sam/kb-feedback');
      if (response.ok) {
        const data = await response.json();
        setKbFeedback(data);
      }
    } catch (error) {
      console.error('Failed to load KB feedback:', error);
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      const response = await fetch('/api/knowledge-base/documents');
      if (!response.ok) {
        // Silently fail - API endpoint may not be available
        setDocuments([]);
        setDocumentsLoading(false);
        return;
      }
      const data = await response.json();
      setDocuments((data.documents || []) as KnowledgeDocument[]);
      // Load feedback after documents load
      loadKBFeedback();
    } catch (error) {
      // Silently handle error - this is not critical functionality
      setDocuments([]);
    } finally {
      setDocumentsLoading(false);
    }
  }, [loadKBFeedback]);

  const deleteDocument = useCallback(async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/knowledge-base/documents?id=${documentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to delete document: ${error.error || 'Unknown error'}`);
        return;
      }

      // Reload documents after successful deletion
      await loadDocuments();
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Failed to delete document. Please try again.');
    }
  }, [loadDocuments]);

  const loadIcpProfiles = useCallback(async () => {
    try {
      const response = await fetch('/api/knowledge-base/icps');
      if (!response.ok) {
        // Silently fail - API endpoint may not be available
        setIcpCount(0);
        setIcpProfiles({});
        return;
      }
      const payload = await response.json();
      const entries = Array.isArray(payload?.icps) ? payload.icps : [];
      const mapped = entries.reduce((acc: Record<string, ICPProfile>, icp: Record<string, unknown>) => {
        const profile = transformICPResponse(icp);
        acc[profile.id] = profile;
        return acc;
      }, {});
      setIcpProfiles(mapped);
      setIcpCount(Object.keys(mapped).length);
    } catch (error) {
      // Silently handle error - this is not critical functionality
      setIcpCount(0);
      setIcpProfiles({});
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/knowledge-base/products');
      if (!response.ok) {
        // Silently fail - API endpoint may not be available
        setProducts([]);
        return;
      }
      const payload = await response.json();
      setProducts(Array.isArray(payload?.products) ? payload.products : []);
    } catch (error) {
      // Silently handle error - this is not critical functionality
      setProducts([]);
    }
  }, []);

  const loadCompetitors = useCallback(async () => {
    try {
      const response = await fetch('/api/knowledge-base/competitors');
      if (!response.ok) {
        // Silently fail - API endpoint may not be available
        setCompetitors([]);
        return;
      }
      const payload = await response.json();
      setCompetitors(Array.isArray(payload?.competitors) ? payload.competitors : []);
    } catch (error) {
      // Silently handle error - this is not critical functionality
      setCompetitors([]);
    }
  }, []);

  const loadPersonas = useCallback(async () => {
    try {
      const response = await fetch('/api/knowledge-base/personas');
      if (!response.ok) {
        // Silently fail - API endpoint may not be available
        setPersonas([]);
        return;
      }
      const payload = await response.json();
      setPersonas(Array.isArray(payload?.personas) ? payload.personas : []);
    } catch (error) {
      // Silently handle error - this is not critical functionality
      setPersonas([]);
    }
  }, []);

  const handleQuickAddProduct = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Product name');
    if (!name || name.trim().length === 0) {
      return;
    }
    const description = window.prompt('Product description (optional)') ?? undefined;
    const category = window.prompt('Category (optional)') ?? undefined;

    try {
      const response = await fetch('/api/knowledge-base/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          category
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create product');
      }

      await loadProducts();
    } catch (error) {
      console.error('Failed to create product:', error);
    }
  }, [loadProducts]);

  const handleQuickAddCompetitor = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Competitor name');
    if (!name || name.trim().length === 0) {
      return;
    }
    const website = window.prompt('Website (optional)') ?? undefined;
    const description = window.prompt('Brief description (optional)') ?? undefined;

    try {
      const response = await fetch('/api/knowledge-base/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          website,
          description
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create competitor');
      }

      await loadCompetitors();
    } catch (error) {
      console.error('Failed to create competitor:', error);
    }
  }, [loadCompetitors]);

  const handleQuickAddPersona = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const name = window.prompt('Persona name');
    if (!name || name.trim().length === 0) {
      return;
    }
    const jobTitle = window.prompt('Job title (optional)') ?? undefined;
    const department = window.prompt('Department (optional)') ?? undefined;

    let icpId: string | undefined;
    const availableICPs = Object.values(icpProfiles);
    if (availableICPs.length > 0) {
      const selectionPrompt = availableICPs
        .map((profile, index) => `${index + 1}) ${profile.name || profile.icp_name || 'ICP'}`)
        .join('\n');
      const selectedIndex = window.prompt(
        `Assign to ICP (optional). Enter number or leave blank:\n${selectionPrompt}`
      );
      if (selectedIndex) {
        const parsed = Number(selectedIndex) - 1;
        if (!Number.isNaN(parsed) && availableICPs[parsed]) {
          icpId = availableICPs[parsed].id;
        }
      }
    }

    try {
      const response = await fetch('/api/knowledge-base/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          job_title: jobTitle,
          department,
          icp_id: icpId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create persona');
      }

      await loadPersonas();
    } catch (error) {
      console.error('Failed to create persona:', error);
    }
  }, [icpProfiles, loadPersonas]);

  useEffect(() => {
    loadDocuments();
    loadIcpProfiles();
    loadProducts();
    loadCompetitors();
    loadPersonas();
  }, [loadDocuments, loadIcpProfiles, loadProducts, loadCompetitors, loadPersonas]);

  const SECTION_ALIAS_MAP: Record<string, string[]> = {
    buying: ['process', 'buying-process'],
    company: ['company-info', 'company', 'about'],
    competition: ['competition', 'competitors'],
    compliance: ['compliance', 'regulatory'],
    documents: ['documents', 'general'],
    icp: ['icp'],
    inquiry_responses: ['inquiry-responses', 'faq', 'customer-questions'],
    messaging: ['messaging', 'templates'],
    metrics: ['metrics', 'success-metrics'],
    objections: ['objections'],
    personas: ['personas', 'buyer-personas', 'roles'],
    pricing: ['pricing', 'roi'],
    products: ['products', 'product'],
    sam_onboarding: ['sam-onboarding', 'sam_onboarding'],
    collateral: ['collateral', 'sales-collateral', 'battlecards', 'one-pagers', 'decks', 'email-templates', 'snippets', 'templates', 'inquiry-responses'],
    success: ['stories', 'success-stories', 'case-studies'],
    tone: ['tone', 'tone-of-voice', 'brand-voice']
  };

  const getSectionMatches = (sectionId: string) => {
    const matches = SECTION_ALIAS_MAP[sectionId];
    if (matches && matches.length > 0) {
      return matches;
    }
    return [sectionId];
  };

  const getDocumentsForSection = (sectionId: string) => {
    const normalizedMatches = getSectionMatches(sectionId).map((slug) => slug.toLowerCase());
    return documents.filter((doc) => {
      if (!doc.section) return false;
      return normalizedMatches.includes(doc.section.toLowerCase());
    });
  };

  // Meaningful KB Completeness Scoring System
  // Based on what SAM actually needs to function effectively in sales conversations

  const getSectionScore = (sectionId: string, icpCountOverride?: number): number => {
    if (sectionId === 'icp') {
      const count = icpCountOverride ?? icpCount ?? 0;
      if (count === 0) return 0;
      if (count === 1) return 40;
      if (count === 2) return 70;
      return 100;
    }

    const docCount = getDocumentsForSection(sectionId).length;
    if (docCount === 0) return 0;
    if (docCount === 1) return 40;
    if (docCount <= 3) return 70;
    return 100;
  };

  // Critical sections (60% total) - Required for SAM to function
  const criticalSections = [
    { id: 'products', weight: 15, label: 'Products/Services' },
    { id: 'icp', weight: 15, label: 'ICP/Target Profile' },
    { id: 'messaging', weight: 15, label: 'Messaging/Value Prop' },
    { id: 'pricing', weight: 15, label: 'Pricing' }
  ];

  // Important sections (30% total) - High value for effectiveness
  const importantSections = [
    { id: 'objections', weight: 10, label: 'Objection Handling' },
    { id: 'success', weight: 10, label: 'Success Stories' },
    { id: 'competition', weight: 10, label: 'Competitive Intel' }
  ];

  // Supporting sections (10% total) - Nice to have
  const supportingSections = [
    { id: 'company', weight: 2, label: 'Company Info' },
    { id: 'buying', weight: 2, label: 'Buying Process' },
    { id: 'personas', weight: 2, label: 'Buyer Personas' },
    { id: 'compliance', weight: 2, label: 'Compliance' },
    { id: 'tone', weight: 2, label: 'Brand Voice' }
  ];

  const calculateCategoryScore = (sections: typeof criticalSections) => {
    return sections.reduce((total, section) => {
      const sectionCompletion = getSectionScore(section.id);
      return total + (sectionCompletion * section.weight / 100);
    }, 0);
  };

  const criticalScore = calculateCategoryScore(criticalSections);
  const importantScore = calculateCategoryScore(importantSections);
  const supportingScore = calculateCategoryScore(supportingSections);

  const knowledgeCompletion = Math.round(criticalScore + importantScore + supportingScore);
  const isKnowledgeLoading = documentsLoading || icpCount === null;
  const completionDisplay = isKnowledgeLoading ? '—' : `${knowledgeCompletion}%`;
  const completionWidth = isKnowledgeLoading ? '0%' : `${knowledgeCompletion}%`;
  const latestDocuments = documents.slice(0, 4);

  const formatRelativeTime = (input?: string | null) => {
    if (!input) return 'Just now';
    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) return 'Just now';

    const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return parsed.toLocaleDateString();
  };

  const renderDocumentList = (sectionId: string, emptyIcon: React.ReactNode, emptyTitle: string, emptyDescription: string) => {
    if (documentsLoading) {
      return (
        <div className="text-center py-8">
          <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-gray-400 text-sm">Loading documents…</div>
        </div>
      );
    }

    if (documentsError) {
      return (
        <div className="text-center py-8">
          <div className="text-red-400 text-sm">{documentsError}</div>
        </div>
      );
    }

    const sectionDocs = getDocumentsForSection(sectionId);

    if (sectionDocs.length === 0) {
      return (
        <div className="text-center py-8">
          <div className="mx-auto mb-4 text-gray-500 text-4xl flex items-center justify-center">{emptyIcon}</div>
          <div className="text-gray-400 mb-2">{emptyTitle}</div>
          <div className="text-gray-500 text-sm">{emptyDescription}</div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sectionDocs.map((doc) => {
          const docFeedback = kbFeedback?.documentFeedback?.[doc.id] || [];
          const hasCritical = docFeedback.some((f: any) => f.type === 'critical');
          const hasWarning = docFeedback.some((f: any) => f.type === 'warning');
          const hasSuccess = docFeedback.some((f: any) => f.type === 'success');

          return (
            <div key={doc.id} className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold">{doc.title}</p>
                    {hasCritical && (
                      <span className="text-[10px] bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30" title="Critical issue">
                        ⚠️ Critical
                      </span>
                    )}
                    {!hasCritical && hasWarning && (
                      <span className="text-[10px] bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full border border-yellow-500/30" title="Needs attention">
                        ⚠️ Warning
                      </span>
                    )}
                    {!hasCritical && !hasWarning && hasSuccess && (
                      <span className="text-[10px] bg-green-500/20 text-green-300 px-2 py-0.5 rounded-full border border-green-500/30" title="Good">
                        ✓ Ready
                      </span>
                    )}
                  </div>
                  {doc.summary && <p className="text-gray-300 text-sm mt-2">{doc.summary}</p>}

                  {/* SAM's Feedback */}
                  {docFeedback.length > 0 && (
                    <div className="mt-3 p-3 bg-gray-800/50 rounded border border-gray-600">
                      <p className="text-[11px] text-gray-400 font-medium mb-2">💬 SAM's Feedback:</p>
                      <div className="space-y-1">
                        {docFeedback.map((feedback: any, idx: number) => (
                          <p key={idx} className={`text-xs ${
                            feedback.type === 'critical' ? 'text-red-300' :
                            feedback.type === 'warning' ? 'text-yellow-300' :
                            feedback.type === 'suggestion' ? 'text-blue-300' :
                            'text-green-300'
                          }`}>
                            • {feedback.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {doc.updatedAt && (
                    <span className="text-xs text-gray-400">
                      {formatRelativeTime(doc.updatedAt)}
                    </span>
                  )}
                  <button
                    onClick={() => deleteDocument(doc.id)}
                    className="text-gray-400 hover:text-red-400 transition-colors p-1"
                    title="Delete document"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {doc.tags && doc.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {doc.tags.slice(0, 6).map((tag: string) => (
                    <span key={`${doc.id}-${tag}`} className="text-[11px] bg-blue-500/10 text-blue-200 px-2 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                  {doc.tags.length > 6 && (
                    <span className="text-[11px] text-gray-400">+{doc.tags.length - 6} more</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const defaultActionDescriptions: Record<string, string> = {
    buying: 'Map customer journey',
    company: 'Update company info',
    competition: 'Update battlecards',
    compliance: 'Manage regulations',
    documents: 'Upload files',
    icp: 'Manage customer profiles',
    inquiry_responses: 'Handle questions',
    messaging: 'Update templates',
    metrics: 'Track success KPIs',
    objections: 'Handle concerns',
    personas: 'Define user roles',
    pricing: 'Manage pricing info',
    products: 'Add documentation',
    sam_onboarding: 'Train SAM AI',
    collateral: 'Upload battlecards, decks, email templates & snippets',
    success: 'Share case studies',
    tone: 'Set voice guidelines'
  };

  const getQuickActionDescription = (sectionId: string) => {
    const docs = getDocumentsForSection(sectionId);
    if (docs.length > 0) {
      return `Latest: ${docs[0].title}`;
    }
    if (sectionId === 'icp' && icpCount) {
      return `${icpCount} ICP profile${icpCount === 1 ? '' : 's'} configured`;
    }
    return defaultActionDescriptions[sectionId] || 'Open section';
  };

  const docScoreForSection = (sectionId: string) => {
    const docs = getDocumentsForSection(sectionId).length;
    if (docs === 0) return 20;
    if (docs === 1) return 55;
    if (docs === 2) return 75;
    return 95;
  };

  const healthMetrics = [
    {
      label: 'ICP Configuration',
      value: icpCount === null ? null : Math.min(95, 40 + (icpCount * 15)),
      description: icpCount && icpCount > 0 ? `${icpCount} ICP profile${icpCount === 1 ? '' : 's'}` : 'Add your target profile'
    },
    {
      label: 'Product Knowledgebase',
      value: documentsLoading ? null : docScoreForSection('products'),
      description: getDocumentsForSection('products').length > 0 ? 'Core product guide uploaded' : 'Upload product collateral'
    },
    {
      label: 'Messaging Templates',
      value: documentsLoading ? null : docScoreForSection('messaging'),
      description: getDocumentsForSection('messaging').length > 0 ? 'Messaging framework ready' : 'Add messaging playbook'
    },
    {
      label: 'Pricing & ROI Assets',
      value: documentsLoading ? null : docScoreForSection('pricing'),
      description: getDocumentsForSection('pricing').length > 0 ? 'Pricing cheat sheet loaded' : 'Upload pricing guide'
    }
  ];

  const getHealthColor = (value: number | null) => {
    if (value === null) return 'bg-gray-500';
    if (value >= 80) return 'bg-green-400';
    if (value >= 55) return 'bg-yellow-400';
    return 'bg-red-400';
  };

  const getHealthTextColor = (value: number | null) => {
    if (value === null) return 'text-gray-300';
    if (value >= 80) return 'text-green-400';
    if (value >= 55) return 'text-yellow-400';
    return 'text-red-400';
  };

  const sections = [
    { id: 'overview', label: 'Overview', icon: Brain },
    { id: 'buying', label: 'Buying Process', icon: GitBranch },
    { id: 'company', label: 'Company Info', icon: Briefcase },
    { id: 'competition', label: 'Competition', icon: TrendingUp },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'icp', label: 'ICP Config', icon: Target },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare },
    { id: 'metrics', label: 'Success Metrics', icon: BarChart },
    { id: 'objections', label: 'Objections', icon: MessageCircle },
    { id: 'personas', label: 'Personas & Roles', icon: UserCheck },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'sam_onboarding', label: 'SAM Onboarding', icon: Bot },
    { id: 'collateral', label: 'Sales Collateral', icon: Briefcase },
    { id: 'success', label: 'Success Stories', icon: Trophy },
    { id: 'tone', label: 'Tone of Voice', icon: Mic }
  ];

  const getSectionLabel = (sectionId: string) => {
    const directMatch = sections.find((section) => section.id === sectionId);
    if (directMatch) return directMatch.label;

    const aliasOwner = Object.entries(SECTION_ALIAS_MAP).find(([, aliases]) =>
      aliases.some((alias) => alias.toLowerCase() === sectionId?.toLowerCase())
    );

    if (aliasOwner) {
      const aliasMatch = sections.find((section) => section.id === aliasOwner[0]);
      if (aliasMatch) return aliasMatch.label;
    }

    return sectionId
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <Brain className="mr-3" size={32} />
              Knowledgebase
            </h1>
            <p className="text-gray-400">Centralized intelligence hub for SAM's conversational AI</p>
          </div>
          
          {/* Knowledgebase Completion Meter */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 min-w-[300px]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-sm font-medium">Knowledgebase Completeness</span>
              <span className="text-white text-lg font-bold">{completionDisplay}</span>
            </div>
            
            {/* Temperature-style completion bar */}
            <div className="relative">
              <div className="w-full bg-gray-600 rounded-full h-4 overflow-hidden">
                <div
                  className="h-4 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: completionWidth,
                    background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 50%, #F59E0B 75%, #EF4444 100%)'
                  }}
                ></div>
              </div>
              
              {/* Temperature markers */}
              <div className="absolute -bottom-5 w-full flex justify-between text-xs text-gray-400">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>
            
            <div className="mt-6 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                  <span className="text-gray-300">Basic</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                  <span className="text-gray-300">Good</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></div>
                  <span className="text-gray-300">Excellent</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                  <span className="text-gray-300">Expert</span>
                </div>
              </div>
            </div>
            
            {!isKnowledgeLoading && (
              <div className="text-xs text-gray-400 mt-3 space-y-1">
                <p className="font-medium text-gray-300">Score Breakdown:</p>
                <p>• Critical Sections: {Math.round(criticalScore)}/60% (Products, ICP, Messaging, Pricing)</p>
                <p>• Important Sections: {Math.round(importantScore)}/30% (Objections, Success Stories, Competition)</p>
                <p>• Supporting Sections: {Math.round(supportingScore)}/10% (Company, Personas, Compliance, etc.)</p>
              </div>
            )}
            {isKnowledgeLoading && (
              <p className="text-xs text-gray-400 mt-2">
                Calculating coverage based on critical sales enablement content...
              </p>
            )}
          </div>
        </div>
      </div>


      {/* Main Content */}
      <div className="max-w-7xl">
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Knowledgebase Status Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Documents */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">Total Documents</p>
                    <p className="text-white text-2xl font-bold">
                      {documentsLoading ? '—' : documents.length}
                    </p>
                  </div>
                  <FileText className="text-blue-400" size={24} />
                </div>
                <p className="text-green-400 text-xs mt-2">
                  {documentsLoading ? 'Loading documents…' : documentsError ? documentsError : `${documents.length} assets ready for RAG`}
                </p>
              </div>

              {/* ICP Profiles */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">ICP Profiles</p>
                    <p className="text-white text-2xl font-bold">
                      {icpCount === null ? '—' : icpCount}
                    </p>
                  </div>
                  <Target className="text-purple-400" size={24} />
                </div>
                <p className="text-blue-400 text-xs mt-2">
                  {icpCount === null ? 'Loading ICPs…' : icpCount > 0 ? 'Primary profile seeded for demo' : 'Add an ICP to unlock tailored outreach'}
                </p>
              </div>

              {/* Knowledgebase Completion */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">KB Completion</p>
                    <p className="text-white text-2xl font-bold">{completionDisplay}</p>
                  </div>
                  <BarChart className="text-green-400" size={24} />
                </div>
                <div className="text-xs mt-2 space-y-1">
                  {isKnowledgeLoading ? (
                    <p className="text-yellow-400">Calculating coverage…</p>
                  ) : (
                    <>
                      <p className="text-green-400">Critical: {Math.round(criticalScore)}% • Important: {Math.round(importantScore)}%</p>
                      <p className="text-gray-400">{documents.length} docs across {[...new Set(documents.map(d => d.section))].length} sections</p>
                    </>
                  )}
                </div>
              </div>

              {/* SAM Conversations */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">SAM Insights</p>
                    <p className="text-white text-2xl font-bold">156</p>
                  </div>
                  <Brain className="text-orange-400" size={24} />
                </div>
                <p className="text-green-400 text-xs mt-2">+23 today</p>
              </div>
            </div>

            {/* Recent SAM Insights from Conversations */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold flex items-center">
                  <Brain className="mr-2 text-orange-400" size={20} />
                  Recent SAM Insights
                </h3>
                <button className="text-blue-400 hover:text-blue-300 text-sm">View All</button>
              </div>
              <div className="space-y-3">
                {documentsLoading ? (
                  <div className="text-center py-8 text-gray-400 text-sm">Loading insights…</div>
                ) : documentsError ? (
                  <div className="text-center py-8 text-red-400 text-sm">{documentsError}</div>
                ) : latestDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-sm">
                    Upload knowledge assets so Sam can surface insights from your content library.
                  </div>
                ) : (
                  latestDocuments.map((doc) => (
                    <div key={`insight-${doc.id}`} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{doc.title}</p>
                          {doc.summary && (
                            <p className="text-gray-300 text-xs mt-1">{doc.summary}</p>
                          )}
                        </div>
                        <span className="text-blue-400 text-xs bg-blue-400/10 px-2 py-1 rounded">
                          {getSectionLabel(doc.section || 'documents')}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center text-gray-400 text-xs">
                        <Clock size={12} className="mr-1" />
                        {doc.updatedAt ? formatRelativeTime(doc.updatedAt) : 'Just now'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Actions & Navigation */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-white text-lg font-semibold mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {sections.slice(1, 17).map((section) => {
                  const IconComponent = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-left transition-all hover:bg-purple-600 hover:border-purple-500 group cursor-pointer"
                    >
                      <div className="flex items-center mb-2">
                        <IconComponent className="text-blue-400 mr-2 group-hover:scale-110 transition-transform" size={18} />
                        <span className="text-white text-sm font-medium">{section.label}</span>
                      </div>
                      <p className="text-gray-300 text-xs">
                        {getQuickActionDescription(section.id)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Knowledgebase Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-white text-lg font-semibold mb-4">Knowledgebase Health</h3>
                <div className="space-y-4">
                  {healthMetrics.map((metric) => (
                    <div key={metric.label}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-gray-300 text-sm font-medium">{metric.label}</p>
                          <p className="text-gray-500 text-xs">{metric.description}</p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-gray-700 rounded-full h-2 overflow-hidden">
                            <div
                              className={`${getHealthColor(metric.value)} h-2 rounded-full transition-all duration-500`}
                              style={{ width: metric.value === null ? '0%' : `${metric.value}%` }}
                            ></div>
                          </div>
                          <span className={`text-xs ${getHealthTextColor(metric.value)}`}>
                            {metric.value === null ? '—' : `${metric.value}%`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Latest Knowledge Assets */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold flex items-center">
                  <FileText className="mr-2 text-blue-400" size={20} />
                  Latest Knowledge Base Assets
                </h3>
                <button
                  onClick={() => loadDocuments()}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Refresh
                </button>
              </div>

              {documentsLoading ? (
                <div className="text-gray-400 text-sm">Loading documents…</div>
              ) : documentsError ? (
                <div className="text-red-400 text-sm">{documentsError}</div>
              ) : latestDocuments.length === 0 ? (
                <div className="text-gray-400 text-sm">
                  No documents uploaded yet. Drop your pitch deck, pricing sheet, or objection handlers to power SAM.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {latestDocuments.map((doc) => (
                    <div key={doc.id} className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="text-white text-sm font-semibold">{doc.title}</p>
                          <p className="text-gray-400 text-xs">Section: {doc.section}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-gray-300">
                            {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : ''}
                          </span>
                          <button
                            onClick={() => deleteDocument(doc.id)}
                            className="text-gray-400 hover:text-red-400 transition-colors p-1"
                            title="Delete document"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-gray-300 text-xs mb-3 line-clamp-3">{doc.summary || 'No summary available.'}</p>
                      <div className="flex flex-wrap gap-2">
                        {(doc.tags || []).slice(0, 4).map((tag: string) => (
                          <span key={tag} className="text-[11px] bg-blue-500/10 text-blue-200 px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                        {doc.tags && doc.tags.length > 4 && (
                          <span className="text-[11px] text-gray-400">+{doc.tags.length - 4} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeSection === 'icp' && (
          <ICPConfiguration
            onBack={() => setActiveSection('overview')}
            onProfilesUpdated={setIcpProfiles}
            onRefresh={loadIcpProfiles}
          />
        )}
        
        {activeSection === 'products' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white flex items-center">
                    <Package className="mr-2" size={24} />
                    Products & Services
                  </h2>
                  {kbFeedback?.sectionFeedback?.products && (
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      kbFeedback.sectionFeedback.products.status === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                      kbFeedback.sectionFeedback.products.status === 'needs-attention' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
                      kbFeedback.sectionFeedback.products.status === 'good' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' :
                      'bg-green-500/20 text-green-300 border border-green-500/40'
                    }`}>
                      {kbFeedback.sectionFeedback.products.message}
                    </span>
                  )}
                </div>
                {kbFeedback?.sectionFeedback?.products?.suggestion && (
                  <p className="text-sm text-gray-400 mt-2">
                    💬 SAM: {kbFeedback.sectionFeedback.products.suggestion}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="products" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  📄 Product sheets, service descriptions, feature specs, pricing guides, demo scripts
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Documents</h3>
                {renderDocumentList(
                  'products',
                  <FileText size={48} className="text-gray-500" />,
                  'No product documents uploaded',
                  'Upload product sheets, feature specs, and pricing guides to get started'
                )}
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Structured Product Library</h3>
                <button
                  onClick={handleQuickAddProduct}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center"
                >
                  <Plus className="mr-1" size={14} />
                  Add Product
                </button>
              </div>
              {products.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  No structured products captured yet. Add your offerings so SAM can reference positioning, benefits, and feature highlights in conversations.
                </p>
              ) : (
                <div className="space-y-3">
                  {products.map((product) => (
                    <div key={product.id} className="border border-gray-600 rounded-lg p-3 bg-gray-800">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{product.name}</p>
                          {product.description && (
                            <p className="text-gray-400 text-xs mt-1">{product.description}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {formatRelativeTime(product.updated_at || product.created_at || '')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {product.category && (
                          <span className="text-[11px] bg-blue-500/10 text-blue-200 px-2 py-0.5 rounded-full">
                            {product.category}
                          </span>
                        )}
                        {(product.features ?? []).slice(0, 3).map((feature) => (
                          <span key={feature} className="text-[11px] bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">
                            {feature}
                          </span>
                        ))}
                        {(product.use_cases ?? []).slice(0, 2).map((useCase) => (
                          <span key={useCase} className="text-[11px] bg-purple-500/10 text-purple-200 px-2 py-0.5 rounded-full">
                            {useCase}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'competition' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <TrendingUp className="mr-2" size={24} />
                  Competition Analysis
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="competition" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  🎯 Competitor analysis, battlecards, win/loss reports, market research, SWOT analysis
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Documents</h3>
                {renderDocumentList(
                  'competition',
                  <TrendingUp size={48} className="text-gray-500" />,
                  'No competitive analysis documents uploaded',
                  'Upload battlecards, market research, and win/loss reports'
                )}
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Competitive Intelligence</h3>
                <button
                  onClick={handleQuickAddCompetitor}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center"
                >
                  <Plus className="mr-1" size={14} />
                  Add Competitor
                </button>
              </div>
              {competitors.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  Capture competitor positioning, strengths, and weaknesses to give SAM fast access to battlecard insights during conversations.
                </p>
              ) : (
                <div className="space-y-3">
                  {competitors.map((competitor) => (
                    <div key={competitor.id} className="border border-gray-600 rounded-lg p-3 bg-gray-800">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white font-medium text-sm">{competitor.name}</p>
                          {competitor.website && (
                            <a
                              href={competitor.website}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 text-xs hover:underline"
                            >
                              {competitor.website}
                            </a>
                          )}
                          {competitor.description && (
                            <p className="text-gray-400 text-xs mt-1">{competitor.description}</p>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-500">
                          {formatRelativeTime(competitor.updated_at || competitor.created_at || '')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {(competitor.strengths ?? []).slice(0, 3).map((item) => (
                          <span key={item} className="text-[11px] bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">
                            {item}
                          </span>
                        ))}
                        {(competitor.weaknesses ?? []).slice(0, 2).map((item) => (
                          <span key={item} className="text-[11px] bg-red-500/10 text-red-200 px-2 py-0.5 rounded-full">
                            {item}
                          </span>
                        ))}
                        {competitor.pricing_model && (
                          <span className="text-[11px] bg-yellow-500/10 text-yellow-200 px-2 py-0.5 rounded-full">
                            {competitor.pricing_model}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeSection === 'messaging' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <MessageSquare className="mr-2" size={24} />
                  Proven Messaging Templates
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="messaging" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  💬 Email templates, LinkedIn messages, objection handlers, value propositions, case studies
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Templates</h3>
                {renderDocumentList(
                  'messaging',
                  <MessageSquare size={48} className="text-gray-500" />,
                  'No messaging templates uploaded',
                  'Upload email templates, LinkedIn sequences, and objection handlers'
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'tone' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Mic className="mr-2" size={24} />
                  Tone of Voice Documents
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="tone-of-voice" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  🎭 Brand voice guidelines, writing style guides, communication frameworks, persona-based messaging
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Guidelines</h3>
                {renderDocumentList(
                  'tone-of-voice',
                  <Mic size={48} className="text-gray-500" />,
                  'No tone of voice guidelines uploaded',
                  'Upload brand voice guides and communication frameworks'
                )}
              </div>
            </div>

            {/* Email & Publication Analysis Section */}
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                <Mail className="mr-2" size={20} />
                Email & Publication Analysis
              </h3>
              <p className="text-gray-300 text-sm mb-6">
                Upload your past emails or published content to help SAM learn your authentic writing style and communication patterns.
              </p>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-medium mb-3">Upload Content</h4>
                  <DocumentUpload section="sender-emails" onComplete={loadDocuments} />
                  <p className="text-xs text-gray-400 mt-2">
                    📧 Email exports (.txt, .eml), blog posts, LinkedIn articles, newsletters, published content
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-white font-medium mb-3">Analyzed Content</h4>
                  {renderDocumentList(
                    'sender-emails',
                    <Mail size={48} className="text-gray-500" />,
                    'No content analyzed yet',
                    'Upload email exports or published content to analyze your writing style'
                  )}
                </div>
              </div>

              {/* Style Analysis Results */}
              <div className="mt-6 bg-gray-600 border border-gray-500 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <TrendingUp className="mr-2" size={16} />
                  Writing Style Analysis
                </h4>
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-2">No style analysis available</div>
                  <div className="text-gray-500 text-sm">Upload and analyze content to see your writing patterns and tone</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'company' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Briefcase className="mr-2" size={24} />
                  Company Information & Brand Guidelines
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="company-info" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  🏢 Company overview, team bios, achievements, partnerships, brand guidelines
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Documents</h3>
                {renderDocumentList(
                  'company-info',
                  <Briefcase size={48} className="text-gray-500" />,
                  'No company documents uploaded',
                  'Upload company overview, team profiles, and brand guidelines'
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'success' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Trophy className="mr-2" size={24} />
                  Customer Success Stories & Case Studies
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="success-stories" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  🏆 Case studies, customer testimonials, reference stories, ROI data, success metrics
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Stories</h3>
                {renderDocumentList(
                  'success-stories',
                  <Trophy size={48} className="text-gray-500" />,
                  'No success stories uploaded',
                  'Upload case studies, testimonials, and customer success stories'
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'buying' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <GitBranch className="mr-2" size={24} />
                  Buying Process & Decision Framework
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="buying-process" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  🔄 Buying journey maps, decision criteria, approval processes, stakeholder analysis, procurement guides
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Frameworks</h3>
                {renderDocumentList(
                  'buying-process',
                  <GitBranch size={48} className="text-gray-500" />,
                  'No buying process documents uploaded',
                  'Upload buying journey maps, decision frameworks, and procurement guides'
                )}
                
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mt-4">
                  <h4 className="text-white font-medium mb-3">Decision Framework Summary</h4>
                  <div className="text-center py-4">
                    <div className="text-gray-400 text-sm">No decision framework data available</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'compliance' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Shield className="mr-2" size={24} />
                  Compliance & Restrictions
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="compliance" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  🛡️ Industry regulations, compliance guidelines, approved/restricted phrases, HITL checkpoints
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Compliance Rules</h3>
                {renderDocumentList(
                  'compliance',
                  <Shield size={48} className="text-gray-500" />,
                  'No compliance documents uploaded',
                  'Upload industry regulations and compliance guidelines'
                )}
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Human-in-the-Loop Checkpoints</h4>
              <div className="text-center py-4">
                <div className="text-gray-400 text-sm">No checkpoints configured</div>
                <div className="text-gray-500 text-xs mt-1">Define triggers that require human review before sending</div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'personas' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <UserCheck className="mr-2" size={24} />
                  Personas & Roles
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="personas" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  👥 Role profiles, pain points, motivations, communication preferences, decision-making patterns
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Persona Library</h3>
                {renderDocumentList(
                  'personas',
                  <UserCheck size={48} className="text-gray-500" />,
                  'No personas uploaded',
                  'Upload persona sheets with role insights, pains, and motivations'
                )}
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-white">Structured Personas</h3>
                <button
                  onClick={handleQuickAddPersona}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center"
                >
                  <Plus className="mr-1" size={14} />
                  Add Persona
                </button>
              </div>
              {personas.length === 0 ? (
                <p className="text-gray-400 text-sm">
                  Capture structured personas so SAM can tailor messaging, objections, and success stories to the contacts you work with most.
                </p>
              ) : (
                <div className="space-y-3">
                  {personas.map((persona) => {
                    const icp = persona.icp_id ? icpProfiles[persona.icp_id] : undefined;
                    return (
                      <div key={persona.id} className="border border-gray-600 rounded-lg p-3 bg-gray-800">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white font-medium text-sm">{persona.name}</p>
                            <p className="text-gray-400 text-xs">
                              {persona.job_title || 'Role not specified'}
                              {persona.department ? ` • ${persona.department}` : ''}
                            </p>
                            {icp && (
                              <p className="text-gray-500 text-[11px] mt-1">Aligned ICP: {icp.name || icp.icp_name || icp.id}</p>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-500">
                            {formatRelativeTime(persona.updated_at || persona.created_at || '')}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {(persona.pain_points ?? []).slice(0, 3).map((item) => (
                            <span key={item} className="text-[11px] bg-red-500/10 text-red-200 px-2 py-0.5 rounded-full">
                              Pain: {item}
                            </span>
                          ))}
                          {(persona.goals ?? []).slice(0, 2).map((item) => (
                            <span key={item} className="text-[11px] bg-green-500/10 text-green-200 px-2 py-0.5 rounded-full">
                              Goal: {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Leadership Roles</h4>
                <div className="space-y-1 text-sm text-gray-300">
                  <div>• Founder/Co-Founder</div>
                  <div>• CEO/C-Suite</div>
                  <div>• VP Sales/Revenue</div>
                  <div>• Head of Growth</div>
                </div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Operational Roles</h4>
                <div className="space-y-1 text-sm text-gray-300">
                  <div>• Sales Manager</div>
                  <div>• SDR/BDR Lead</div>
                  <div>• Marketing Director</div>
                  <div>• Operations Manager</div>
                </div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Service Providers</h4>
                <div className="space-y-1 text-sm text-gray-300">
                  <div>• Agency Owner</div>
                  <div>• Consultant</div>
                  <div>• Recruiter</div>
                  <div>• Financial Advisor</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'objections' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <MessageCircle className="mr-2" size={24} />
                  Objections & Responses
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="objections" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  💬 Common objections, proven rebuttals, redirect strategies, conversation frameworks
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Objection Handlers</h3>
                {renderDocumentList(
                  'objections',
                  <MessageCircle size={48} className="text-gray-500" />,
                  'No objection handling scripts uploaded',
                  'Upload common objections and proven rebuttals'
                )}
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center">
                <TrendingUp className="mr-2" size={16} />
                Objection Analysis
              </h4>
              <div className="text-center py-4">
                <div className="text-gray-400 text-sm">No objection data available</div>
                <div className="text-gray-500 text-xs mt-1">Upload objection handling documents to see category analysis</div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'pricing' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <DollarSign className="mr-2" size={24} />
                  Pricing & Packages
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="pricing" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  💰 Pricing tiers, package details, ROI calculators, cost justification materials
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Pricing Materials</h3>
                {renderDocumentList(
                  'pricing',
                  <DollarSign size={48} className="text-gray-500" />,
                  'No pricing documents uploaded',
                  'Upload pricing tiers, ROI calculators, and cost justification materials'
                )}
              </div>
            </div>

            <div className="text-center py-8 mb-6">
              <div className="text-gray-400 mb-2">No pricing packages configured</div>
              <div className="text-gray-500 text-sm">Upload pricing documentation to display package information</div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">ROI Analysis</h4>
              <div className="text-center py-4">
                <div className="text-gray-400 text-sm">No ROI data available</div>
                <div className="text-gray-500 text-xs mt-1">Upload cost comparison documents to display ROI analysis</div>
              </div>
            </div>
          </div>
        )}


        {activeSection === 'metrics' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <BarChart className="mr-2" size={24} />
                  Success Metrics
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="metrics" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  📊 Success benchmarks, industry improvements, ROI studies, timeline examples
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Success Studies</h3>
                {renderDocumentList(
                  'metrics',
                  <BarChart size={48} className="text-gray-500" />,
                  'No success metrics uploaded',
                  'Upload benchmark reports, ROI studies, and timeline examples'
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-400 mb-2">35%</div>
                <div className="text-white font-medium">Avg. Lead Engagement Increase</div>
                <div className="text-gray-400 text-sm">First 30 days</div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-400 mb-2">50%</div>
                <div className="text-white font-medium">Faster Outreach Cycle</div>
                <div className="text-gray-400 text-sm">vs Manual SDRs</div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-400 mb-2">10x</div>
                <div className="text-white font-medium">ROI Within 3 Months</div>
                <div className="text-gray-400 text-sm">Typical customer</div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6">
              <h4 className="text-white font-medium mb-3">Success Timeline</h4>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-4">30</div>
                  <div>
                    <div className="text-white font-medium">Days 1-30: Foundation</div>
                    <div className="text-gray-400 text-sm">Setup, training, initial campaigns • 15-25% improvement</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold mr-4">60</div>
                  <div>
                    <div className="text-white font-medium">Days 31-60: Optimization</div>
                    <div className="text-gray-400 text-sm">AI learning, message refinement • 35-45% improvement</div>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-4">90</div>
                  <div>
                    <div className="text-white font-medium">Days 61-90: Scale</div>
                    <div className="text-gray-400 text-sm">Full automation, team expansion • 50%+ improvement</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Benchmarks by Industry</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-300">SaaS/Tech:</span>
                    <span className="text-green-400">45% response improvement</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Professional Services:</span>
                    <span className="text-green-400">38% response improvement</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Financial Services:</span>
                    <span className="text-green-400">32% response improvement</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-300">Healthcare:</span>
                    <span className="text-green-400">29% response improvement</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Manufacturing:</span>
                    <span className="text-green-400">34% response improvement</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-300">Real Estate:</span>
                    <span className="text-green-400">41% response improvement</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'setup' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Settings className="mr-2" size={24} />
                  CRM Settings & Integration
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="crm-setup" onComplete={loadDocuments} />
                <p className="text-sm text-gray-400 mt-3">
                  ⚙️ CRM integration guides, field mapping templates, automation workflows, sync protocols
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">CRM Configuration</h3>
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">Salesforce Integration Guide.pdf</div>
                    <div className="text-gray-400 text-xs">Field mapping, lead routing • API configuration</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">HubSpot Sync Configuration.pdf</div>
                    <div className="text-gray-400 text-xs">Contact properties, deal stages • Workflow automation</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">Pipedrive Setup Template.pdf</div>
                    <div className="text-gray-400 text-xs">Pipeline configuration, activity tracking • Custom fields</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
                  Salesforce
                </h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div>• Lead → Contact conversion</div>
                  <div>• Opportunity creation rules</div>
                  <div>• Activity logging</div>
                  <div>• Custom field sync</div>
                </div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
                  HubSpot
                </h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div>• Contact property mapping</div>
                  <div>• Deal stage automation</div>
                  <div>• Email engagement tracking</div>
                  <div>• Workflow triggers</div>
                </div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
                  Pipedrive
                </h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div>• Person/Organization sync</div>
                  <div>• Deal creation automation</div>
                  <div>• Activity scheduling</div>
                  <div>• Pipeline management</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-6">
              <h4 className="text-white font-medium mb-3">Field Mapping Examples</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-300 mb-2 font-medium">Standard Contact Fields</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">SAM Field:</span>
                      <span className="text-white">CRM Field:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">contact_name</span>
                      <span className="text-white">→ First/Last Name</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">company_name</span>
                      <span className="text-white">→ Account/Company</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">job_title</span>
                      <span className="text-white">→ Title</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">email_address</span>
                      <span className="text-white">→ Email</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-gray-300 mb-2 font-medium">SAM Specific Fields</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">sam_campaign_id</span>
                      <span className="text-white">→ Custom Field</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">last_outreach_date</span>
                      <span className="text-white">→ Last Activity</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">response_status</span>
                      <span className="text-white">→ Lead Status</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">engagement_score</span>
                      <span className="text-white">→ Lead Score</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">Automation Rules Configuration</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-gray-300">Auto-create leads from SAM campaigns</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" defaultChecked />
                    <span className="text-gray-300">Sync response status updates</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-gray-300">Create tasks for follow-ups</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-gray-300">Update lead scores based on engagement</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-gray-300">Trigger workflows on replies</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-gray-300">Assign leads to sales reps</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-gray-300">Create opportunities for qualified leads</span>
                  </div>
                  <div className="flex items-center">
                    <input type="checkbox" className="mr-2" />
                    <span className="text-gray-300">Send notifications to team members</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'sam_onboarding' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Bot className="mr-2" size={24} />
                  SAM Onboarding Experience
                </h2>
              </div>
            </div>
            <p className="text-gray-400 mb-6">Interactive conversational onboarding to collect company data and build your knowledge base</p>
            <SAMOnboarding onComplete={(data) => console.log('Onboarding completed:', data)} />
          </div>
        )}

        {activeSection === 'documents' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledgebase"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <FileText className="mr-2" size={24} />
                  Document Management
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <DocumentUpload section="general" onComplete={loadDocuments} />
              <VectorTest />
            </div>

            <div className="mb-6">
              <DocumentsTable />
            </div>
            
            <ChunkDrawer />
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBase;
