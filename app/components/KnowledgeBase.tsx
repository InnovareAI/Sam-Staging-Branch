'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Target, Users, Building2, TrendingUp, Plus, Settings, Upload, FileText, Package, MessageSquare, Cpu, Clock, AlertCircle, Mic, Briefcase, Trophy, GitBranch, Mail, Shield, UserCheck, MessageCircle, DollarSign, Zap, BarChart, Bot, HelpCircle, Globe, ArrowLeft, Trash2, Activity, CheckCircle, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import SAMOnboarding from './SAMOnboarding';
import KnowledgeBaseAnalytics from './KnowledgeBaseAnalytics';
import ICPConfigEditable from './ICPConfigEditable';

// shadcn components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';


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
function DocumentUpload({ section, onComplete, icpId }: { section: string; onComplete?: () => void; icpId?: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>('');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'extracting' | 'tagging' | 'vectorizing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [aiTags, setAiTags] = useState<string[]>([]);
  const [error, setError] = useState<string>('');

  const handleFileUpload = async () => {
    if (!file && !url) {
      setError('Please select a file or enter a URL');
      setStatus('error');
      return;
    }

    console.log('[KB Upload] Starting upload...', { section, uploadMode, file: file?.name, url });

    setStatus('uploading');
    setProgress(10);
    setError('');

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
        console.log('[KB Upload] File attached:', file.name, file.size, 'bytes');
      }
      formData.append('section', section);
      formData.append('uploadMode', uploadMode);
      if (url) {
        formData.append('url', url);
      }
      // Include ICP ID for ICP-specific content (null = global content)
      if (icpId) {
        formData.append('icp_id', icpId);
        console.log('[KB Upload] ICP assigned:', icpId);
      }

      // Step 1: Upload and extract content
      setStatus('extracting');
      setProgress(30);

      console.log('[KB Upload] Calling upload API...');
      const uploadResponse = await fetch('/api/knowledge-base/upload-document', {
        method: 'POST',
        body: formData
      });

      console.log('[KB Upload] Upload response status:', uploadResponse.status);

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json().catch(() => ({ error: 'Upload failed' }));
        console.error('[KB Upload] Upload failed:', errorData);
        throw new Error(errorData.error || `Upload failed with status ${uploadResponse.status}`);
      }

      const uploadResult = await uploadResponse.json();
      console.log('[KB Upload] Upload successful:', uploadResult.documentId);
      setProgress(50);

      // Step 2: AI Processing and Tagging
      setStatus('tagging');
      setProgress(70);

      console.log('[KB Upload] Starting AI processing...');
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

      console.log('[KB Upload] Processing response status:', processingResponse.status);

      if (!processingResponse.ok) {
        const errorData = await processingResponse.json().catch(() => ({ error: 'AI processing failed' }));
        console.error('[KB Upload] Processing failed:', errorData);
        throw new Error(errorData.error || 'AI processing failed');
      }

      const processingResult = await processingResponse.json();
      console.log('[KB Upload] Processing successful, tags:', processingResult.tags);
      setAiTags(processingResult.tags);
      setProgress(85);

      // Step 3: Vectorization and RAG Integration
      setStatus('vectorizing');
      setProgress(95);

      console.log('[KB Upload] Starting vectorization...');
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

      console.log('[KB Upload] Vectorization response status:', vectorResponse.status);

      if (!vectorResponse.ok) {
        const errorData = await vectorResponse.json().catch(() => ({ error: 'Vectorization failed' }));
        console.error('[KB Upload] Vectorization failed:', errorData);
        throw new Error(errorData.error || 'Vectorization failed');
      }

      console.log('[KB Upload] All steps completed successfully!');
      setProgress(100);
      setStatus('done');

      // Reset form after success
      setTimeout(() => {
        setFile(null);
        setUrl('');
        setStatus('idle');
        setProgress(0);
        setAiTags([]);
      }, 3000);

    } catch (error) {
      console.error('[KB Upload] ERROR:', error);
      const errorMessage = error instanceof Error ? error.message : 'Processing failed';
      console.error('[KB Upload] Error message:', errorMessage);
      setError(errorMessage);
      setStatus('error');
    } finally {
      console.log('[KB Upload] Refreshing document list...');
      // ALWAYS refresh the document list, even if there was an error
      // This ensures documents that were uploaded (step 1) show up even if processing failed
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }
  };

  return (
    <Card className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border backdrop-blur-sm">
      <CardContent className="p-5">
        {/* Upload Mode Toggle - using shadcn Tabs */}
        <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as 'file' | 'url')} className="mb-4">
          <TabsList className="grid w-full grid-cols-2 bg-muted/50">
            <TabsTrigger value="file" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700">
              <Upload size={16} className="mr-2" />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-purple-700">
              <Globe size={16} className="mr-2" />
              URL/Link
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* File Upload Mode */}
        {uploadMode === 'file' && (
          <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-6 text-center bg-gradient-to-br from-purple-900/10 to-purple-800/10 hover:border-purple-500/50 transition-colors">
            <Upload className="mx-auto mb-3 text-purple-400" size={32} />
            <input
              type="file"
              accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-gray-300 text-sm w-full file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-gray-400 mt-3">
              Supported: PDF, TXT, MD, PNG, JPG, GIF, WEBP (max 25MB)
            </p>
          </div>
        )}

        {/* URL Upload Mode */}
        {uploadMode === 'url' && (
          <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-6 bg-gradient-to-br from-purple-900/10 to-purple-800/10 hover:border-purple-500/50 transition-colors">
            <Globe className="mx-auto mb-3 text-purple-400" size={32} />
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/document-or-page"
              className="bg-muted text-gray-200 h-11 border placeholder:text-gray-500 focus-visible:ring-purple-500"
            />
            <p className="text-xs text-gray-400 mt-3">
              Web pages, Google Docs, presentations, PDFs, articles
            </p>
          </div>
        )}

        {/* Upload Status and Actions */}
        {(file || url) && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3 border border/50">
              <span className="text-sm text-gray-300 truncate mr-3">
                {file ? file.name : url}
              </span>
              <Button
                onClick={handleFileUpload}
                disabled={status !== 'idle' && status !== 'error'}
                className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30 text-white border-0"
              >
                {status === 'idle' && 'Process with AI'}
                {status === 'uploading' && 'Uploading...'}
                {status === 'extracting' && 'Extracting...'}
                {status === 'processing' && 'Processing...'}
                {status === 'tagging' && 'AI Tagging...'}
                {status === 'vectorizing' && 'Vectorizing...'}
                {status === 'done' && '✓ Complete'}
                {status === 'error' && 'Retry'}
              </Button>
            </div>

            {/* Progress Bar */}
            {(status !== 'idle' && status !== 'error') && (
              <Progress
                value={progress}
                className="h-2.5 bg-card [&>div]:bg-gradient-to-r [&>div]:from-purple-500 [&>div]:to-purple-600"
              />
            )}

            {/* Status Messages */}
            {status === 'extracting' && (
              <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-950/30 border border-blue-800/30 rounded-lg p-3">
                <FileText size={14} />
                <span>Extracting text content and metadata...</span>
              </div>
            )}
            {status === 'tagging' && (
              <div className="flex items-center gap-2 text-xs text-purple-400 bg-purple-950/30 border border-purple-800/30 rounded-lg p-3">
                <Brain size={14} />
                <span>AI analyzing content for smart categorization...</span>
              </div>
            )}
            {status === 'vectorizing' && (
              <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/30 border border-green-800/30 rounded-lg p-3">
                <Cpu size={14} />
                <span>Creating embeddings for SAM AI knowledge access...</span>
              </div>
            )}
            {status === 'done' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-green-400 bg-green-950/30 border border-green-800/30 rounded-lg p-3">
                  <Activity size={14} />
                  <span>Document processed and integrated into Knowledgebase</span>
                </div>
                {aiTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {aiTags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="text-xs bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 py-1.5 rounded-full font-medium shadow-sm">
                        {tag}
                      </span>
                    ))}
                    {aiTags.length > 4 && (
                      <span className="text-xs text-gray-400 bg-card px-3 py-1.5 rounded-full">+{aiTags.length - 4} more</span>
                    )}
                  </div>
                )}
              </div>
            )}
            {status === 'error' && error && (
              <Alert variant="destructive" className="bg-red-950/30 border-red-800/30 text-red-400">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
    <div className="bg-card rounded-xl p-6 border shadow">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          {onBack && (
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
      {/* Create ICP Form Modal */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="sm:max-w-[425px] bg-card border text-white">
          <DialogHeader>
            <DialogTitle>Create New ICP Profile</DialogTitle>
            <DialogDescription className="text-gray-400">
              Enter a name for your new Ideal Customer Profile.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              type="text"
              placeholder="Enter ICP profile name..."
              className="bg-muted border text-white placeholder:text-gray-400"
              onKeyPress={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  handleCreateICPSubmit(e.currentTarget.value.trim());
                }
              }}
              id="icp-name-input"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                const input = document.getElementById('icp-name-input') as HTMLInputElement;
                if (input?.value.trim()) {
                  handleCreateICPSubmit(input.value.trim());
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Create
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowCreateForm(false)}
              className="bg-gray-600 hover:bg-gray-500 text-white"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          <div className="flex space-x-1 mb-4 bg-muted rounded-lg p-1">
            {Object.entries(icpProfiles).map(([key, profile]) => (
              <button
                key={key}
                onClick={() => setSelectedICP(key)}
                className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${selectedICP === key
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
                className={`p-3 rounded-lg text-left transition-all ${activeCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-muted text-gray-300 hover:bg-gray-600 hover:text-white'
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
          <div className="bg-muted border border rounded-lg p-4 mb-6">
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
                <div className="bg-muted border border rounded-lg p-4">
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
                <div className="bg-muted border border rounded-lg p-4">
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

              </div>
            )}

            {activeCategory === 'target_profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Company Demographics */}
                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <Building2 className="mr-2" size={16} />
                    Company Demographics
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Employee Count</label>
                      <div className="flex flex-wrap gap-2">
                        {['50-100', '100-500', '500-1000', '1000+'].map(range => (
                          <Badge key={range} variant="secondary" className="px-3 py-1 text-xs">
                            {range}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Revenue Range</label>
                      <div className="flex flex-wrap gap-2">
                        {['$10M-$50M', '$50M-$100M'].map(range => (
                          <Badge key={range} variant="secondary" className="px-3 py-1 text-xs">
                            {range}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Growth Stage</label>
                      <div className="flex flex-wrap gap-2">
                        {['Series A', 'Series B', 'Growth'].map(stage => (
                          <Badge key={stage} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white">
                            {stage}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Geographic Focus */}
                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <Globe className="mr-2" size={16} />
                    Geographic Focus
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Primary Markets</label>
                      <div className="flex flex-wrap gap-2">
                        {['United States', 'Canada'].map(market => (
                          <Badge key={market} className="bg-green-600 hover:bg-green-700 px-3 py-1 text-xs text-white">
                            {market}
                          </Badge>
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
                          <Badge key={market} className="bg-yellow-600 hover:bg-yellow-700 px-3 py-1 text-xs text-white">
                            {market}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Industry Segmentation */}
                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <Briefcase className="mr-2" size={16} />
                    Industry & Market Segmentation
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Primary Industries</label>
                      <div className="flex flex-wrap gap-2">
                        {['SaaS', 'FinTech', 'HealthTech'].map(industry => (
                          <Badge key={industry} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Secondary Industries</label>
                      <div className="flex flex-wrap gap-2">
                        {['MarTech', 'EdTech', 'PropTech'].map(industry => (
                          <Badge key={industry} variant="secondary" className="px-3 py-1 text-xs">
                            {industry}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technology Requirements */}
                <div className="bg-muted border border rounded-lg p-4">
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
                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <Users className="mr-2" size={16} />
                    Executive Level
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Identified Roles</label>
                      <div className="text-gray-400 text-sm border rounded p-2 bg-muted">
                        {currentICP?.decision_makers?.identified_roles?.length > 0 ?
                          currentICP.decision_makers.identified_roles.join(', ') :
                          'e.g., CEO, CTO, Head of Sales, VP Marketing, Operations Director...'
                        }
                      </div>
                    </div>
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Authority Level</label>
                      <div className="text-gray-400 text-sm border rounded p-2 bg-muted">
                        {currentICP?.decision_makers?.authority_level?.length > 0 ?
                          currentICP.decision_makers.authority_level.join(', ') :
                          'e.g., Final Decision Maker, Budget Approver, Technical Evaluator, Influencer...'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <UserCheck className="mr-2" size={16} />
                    Primary Contact
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Contact Information</label>
                      <div className="text-gray-400 text-sm border rounded p-2 bg-muted space-y-1">
                        <div>Name: {currentICP?.decision_makers?.primary_contact?.name || 'e.g., John Smith'}</div>
                        <div>Company: {currentICP?.decision_makers?.primary_contact?.company || 'e.g., TechCorp Inc.'}</div>
                        <div>Engagement: {currentICP?.decision_makers?.primary_contact?.engagement_level || 'e.g., High interest, active evaluator'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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
                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <AlertCircle className="mr-2" size={16} />
                    Current Challenges
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-300 text-sm font-medium block mb-1">Operational Challenges</label>
                      <div className="text-gray-400 text-sm max-h-32 overflow-y-auto border rounded p-2 bg-muted">
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
                      <div className="text-gray-400 text-sm border rounded p-2 bg-muted">
                        {currentICP?.pain_points?.growth_pressures?.length > 0 ?
                          currentICP.pain_points.growth_pressures.join(', ') :
                          'e.g., Need to expand market share, Pressure to reduce costs, Requirements for faster time-to-market, Board demands for digital transformation'
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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
                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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
                <div className="bg-muted border border rounded-lg p-4">
                  <h3 className="text-white font-medium mb-4 flex items-center">
                    <MessageSquare className="mr-2" size={16} />
                    Value Propositions
                  </h3>
                  <div className="space-y-2">
                    {currentICP?.messaging?.value_propositions?.length > 0 ?
                      currentICP.messaging.value_propositions.map((prop: string, i: number) => (
                        <Badge key={i} className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white mb-1 mr-1">
                          {prop}
                        </Badge>
                      )) :
                      <div className="border rounded p-2 bg-muted space-y-1">
                        <Badge className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white">Save 40% on operational costs</Badge>
                        <Badge className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white">Reduce time-to-market by 60%</Badge>
                        <Badge className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white">Enterprise-grade security & compliance</Badge>
                        <Badge className="bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs text-white">Seamless integration with existing tools</Badge>
                      </div>
                    }
                  </div>
                </div>

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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
                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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
                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4">
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

                <div className="bg-muted border border rounded-lg p-4 lg:col-span-2">
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
    <div className="bg-card rounded-lg border shadow">
      <div className="p-6 border-b border">
        <h3 className="text-lg font-semibold text-white">Test Knowledgebase Retrieval</h3>
      </div>
      <div className="p-6">
        <div className="flex gap-2">
          <input
            className="bg-muted border border px-3 py-2 rounded text-white placeholder-gray-400 w-full focus:border-purple-500 focus:outline-none"
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
              <div key={i} className="p-3 bg-muted border border rounded">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-card text-white text-[10px]">
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
    </div>
  );
}

// Documents Table Component
type Doc = { name: string; status: 'Ready' | 'Processing' | 'Error'; uploaded: string; labels: string[] };

function DocumentsTable() {
  const [documents] = useState<Doc[]>([]);

  return (
    <div className="bg-card rounded-lg border shadow">
      <div className="p-6 border-b border">
        <h3 className="text-lg font-semibold text-white">Documents</h3>
      </div>
      <div>
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
                <tr key={d.name} className="border-t border">
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
                    <button className="px-3 py-1 bg-muted hover:bg-gray-600 text-gray-300 rounded transition-colors">
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
              Upload your first document to start building your knowledge base. Supported formats: PDF, TXT, MD, PNG, JPG, GIF, WEBP (max 25MB)
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Chunk Drawer Component
type Chunk = { text: string; labels: string[]; confidence: number };

function ChunkDrawer() {
  const [open, setOpen] = useState(false);
  const [chunks] = useState<Chunk[]>([]);

  return (
    <div className="bg-card rounded-lg border shadow">
      <div className="p-6 border-b border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Document Chunks</h3>
        <button
          className="px-3 py-1 bg-muted hover:bg-gray-600 text-gray-300 rounded transition-colors"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="p-6">
          <div className="p-4 space-y-3 max-h-72 overflow-auto">
            {chunks.length > 0 ? (
              chunks.map((c, i) => (
                <div key={i} className="p-3 bg-muted border border rounded">
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
  const [selectedIcpId, setSelectedIcpId] = useState<string | null>(null); // null = show all ICPs (global + all ICP-specific)
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

  const loadDocuments = useCallback(async (icpId?: string | null) => {
    console.log('[KB] Loading documents...', icpId ? `for ICP: ${icpId}` : 'all ICPs');
    setDocumentsLoading(true);
    setDocumentsError(null);
    try {
      // Build URL with optional ICP filter
      const url = icpId
        ? `/api/knowledge-base/documents?icp_id=${icpId}`
        : '/api/knowledge-base/documents';
      const response = await fetch(url);
      console.log('[KB] Documents API response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[KB] Documents API error:', response.status, errorText);
        setDocumentsError(`Failed to load documents (${response.status})`);
        // Don't clear documents on error - keep showing what we have
        setDocumentsLoading(false);
        return;
      }

      const data = await response.json();
      console.log('[KB] Documents loaded:', data.documents?.length || 0, 'documents');

      if (data.documents && Array.isArray(data.documents)) {
        setDocuments(data.documents as KnowledgeDocument[]);
        console.log('[KB] Documents state updated');
        // Load feedback after documents load
        loadKBFeedback();
      } else {
        console.error('[KB] Invalid documents data structure:', data);
        setDocumentsError('Invalid response format');
      }
    } catch (error) {
      console.error('[KB] Documents fetch error:', error);
      setDocumentsError(error instanceof Error ? error.message : 'Failed to fetch documents');
      // Don't clear documents on error - keep showing what we have
    } finally {
      setDocumentsLoading(false);
      console.log('[KB] Documents loading complete');
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
      await loadDocuments(selectedIcpId);
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
    loadDocuments(selectedIcpId);
    loadIcpProfiles();
    loadProducts();
    loadCompetitors();
    loadPersonas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadIcpProfiles, loadProducts, loadCompetitors, loadPersonas]);

  // Reload documents when selected ICP changes
  useEffect(() => {
    loadDocuments(selectedIcpId);
  }, [selectedIcpId, loadDocuments]);

  const SECTION_ALIAS_MAP: Record<string, string[]> = {
    buying: ['buying-process', 'process'],
    company: ['company-info', 'company', 'about'],
    competition: ['competition', 'competitors', 'competitive-intelligence'],
    compliance: ['compliance', 'regulatory'],
    documents: ['documents', 'general'],
    icp: ['icp', 'icp-intelligence'],
    inquiry_responses: ['inquiry-responses', 'faq', 'customer-questions'],
    messaging: ['messaging', 'templates', 'value-prop'],
    metrics: ['metrics', 'success-metrics'],
    objections: ['objections', 'objection-handling'],
    personas: ['personas', 'buyer-personas', 'roles'],
    pricing: ['pricing', 'roi'],
    products: ['products', 'product'],
    sam_onboarding: ['sam-onboarding', 'sam_onboarding'],
    collateral: ['collateral', 'sales-collateral', 'battlecards', 'one-pagers', 'decks', 'email-templates', 'snippets', 'templates', 'inquiry-responses'],
    success: ['success', 'stories', 'success-stories', 'case-studies'],
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
      if (!doc.category) return false;
      return normalizedMatches.includes(doc.category.toLowerCase());
    });
  };

  // Meaningful KB Completeness Scoring System
  // Based on what SAM actually needs to function effectively in sales conversations

  const getSectionScore = (sectionId: string, icpCountOverride?: number): number => {
    if (sectionId === 'icp') {
      // Count both structured ICPs and ICP documents
      const structuredICPs = icpCountOverride ?? icpCount ?? 0;
      const icpDocs = getDocumentsForSection(sectionId).length;
      const count = structuredICPs + icpDocs;
      if (count === 0) return 0;
      // ONE well-defined ICP is complete - many companies only have one target customer
      return 100;
    }

    const docCount = getDocumentsForSection(sectionId).length;
    if (docCount === 0) return 0;

    // Section-specific scoring - realistic for business reality
    // Some sections are complete with 1 doc, others benefit from variety
    const singleDocCompleteSections = [
      'products',    // Many companies have 1 core product
      'pricing',     // Most companies have 1 pricing model
      'competition', // Some markets have 1 main competitor
      'company',     // Only need 1 company overview
      'buying',      // 1 buying process description
      'compliance',  // 1 compliance doc covers requirements
      'tone'         // 1 brand voice guide is sufficient
    ];

    const varietyBenefitSections = [
      'messaging',   // Multiple value props help
      'objections',  // Different objections need coverage
      'success',     // Multiple case studies build credibility
      'personas'     // Different buyer personas
    ];

    if (singleDocCompleteSections.includes(sectionId)) {
      // 1 quality document = 100%
      return 100;
    }

    if (varietyBenefitSections.includes(sectionId)) {
      // 1 doc = 70%, 2+ docs = 100%
      return docCount >= 2 ? 100 : 70;
    }

    // Default fallback (shouldn't hit this)
    return docCount >= 2 ? 100 : 70;
  };

  // Foundation (50% total) - Core knowledge SAM needs to operate
  // Company, Product, Target Market, Value Proposition
  const foundationSections = [
    { id: 'company', weight: 12.5, label: 'Company Profile' },
    { id: 'products', weight: 12.5, label: 'Product/Service' },
    { id: 'icp', weight: 12.5, label: 'Target Market' },
    { id: 'messaging', weight: 12.5, label: 'Value Proposition' }
  ];

  // GTM Strategy (25% total) - How you go to market
  const gtmStrategySections = [
    { id: 'competition', weight: 8.33, label: 'Competitive Landscape' },
    { id: 'pricing', weight: 8.33, label: 'Pricing & Business Model' },
    { id: 'buying', weight: 8.34, label: 'GTM Channels' }
  ];

  // Customer Intelligence (15% total) - Understanding buyers
  const customerIntelSections = [
    { id: 'personas', weight: 5, label: 'Buyer Personas' },
    { id: 'objections', weight: 5, label: 'Pain Points & Triggers' },
    { id: 'success', weight: 5, label: 'Success Stories' }
  ];

  // Execution Assets (10% total) - Ready-to-use content
  const executionAssetsSections = [
    { id: 'tone', weight: 3.33, label: 'Brand Voice' },
    { id: 'collateral', weight: 3.34, label: 'Templates & Snippets' },
    { id: 'compliance', weight: 3.33, label: 'Compliance & Guidelines' }
  ];

  // Backwards compatibility aliases
  const criticalSections = foundationSections;
  const importantSections = gtmStrategySections;
  const supportingSections = [...customerIntelSections, ...executionAssetsSections];

  const calculateCategoryScore = (sections: typeof criticalSections) => {
    return sections.reduce((total, section) => {
      const sectionCompletion = getSectionScore(section.id);
      return total + (sectionCompletion * section.weight / 100);
    }, 0);
  };

  const criticalScore = calculateCategoryScore(criticalSections);
  const importantScore = calculateCategoryScore(importantSections);
  const supportingScore = calculateCategoryScore(supportingSections);

  // Bonus points for multiple ICPs (encourages depth)
  const icpTotal = (icpCount ?? 0) + getDocumentsForSection('icp').length;
  const icpBonus = icpTotal > 1 ? Math.min((icpTotal - 1) * 2, 4) : 0; // +2% per extra ICP, max +4%

  const knowledgeCompletion = Math.round(criticalScore + importantScore + supportingScore + icpBonus);
  const isKnowledgeLoading = documentsLoading || icpCount === null;
  const completionDisplay = isKnowledgeLoading ? '—' : `${knowledgeCompletion}%`;
  const completionWidth = isKnowledgeLoading ? '0%' : `${knowledgeCompletion}%`;
  const latestDocuments = documents.slice(0, 4);

  // Generate dynamic recommendations based on current state
  const getDocCountForSection = (sectionId: string): number => {
    if (sectionId === 'icp') {
      return (icpCount ?? 0) + getDocumentsForSection(sectionId).length;
    }
    return getDocumentsForSection(sectionId).length;
  };

  const getSamImpact = (sectionId: string): string => {
    const impacts: Record<string, string> = {
      // Foundation
      'company': 'SAM can introduce your business professionally',
      'products': 'SAM can explain your offering and value',
      'icp': 'SAM can qualify and personalize for your ideal customers',
      'messaging': 'SAM can articulate your value proposition clearly',
      // GTM Strategy
      'competition': 'SAM can differentiate you vs. alternatives',
      'pricing': 'SAM can discuss pricing, ROI, and business cases',
      'buying': 'SAM can guide based on your sales channels',
      // Customer Intelligence
      'personas': 'SAM can tailor conversations to buyer roles',
      'objections': 'SAM can address common concerns proactively',
      'success': 'SAM can share relevant proof points and cases',
      // Execution Assets
      'tone': 'SAM can match your brand voice and style',
      'collateral': 'SAM can use your templates and snippets',
      'compliance': 'SAM can follow your guidelines and policies'
    };
    return impacts[sectionId] || 'SAM can operate more effectively';
  };

  const generateRecommendations = () => {
    const allSections = [
      ...criticalSections.map(s => ({ ...s, category: 'critical' })),
      ...importantSections.map(s => ({ ...s, category: 'important' })),
      ...supportingSections.map(s => ({ ...s, category: 'supporting' }))
    ];

    return allSections.map(section => {
      const currentCount = getDocCountForSection(section.id);
      const currentScore = getSectionScore(section.id);
      const isICP = section.id === 'icp';

      // Determine next milestone
      let nextMilestone = 0;
      let docsNeeded = 0;
      let impactPercent = 0;

      if (currentScore === 0) {
        nextMilestone = 40;
        docsNeeded = 1 - currentCount;
        impactPercent = Math.round(section.weight * 0.4);
      } else if (currentScore === 40) {
        nextMilestone = 70;
        docsNeeded = 2 - currentCount;
        impactPercent = Math.round(section.weight * 0.3);
      } else if (currentScore === 70) {
        nextMilestone = 100;
        docsNeeded = isICP ? (3 - currentCount) : (4 - currentCount);
        impactPercent = Math.round(section.weight * 0.3);
      }

      return {
        ...section,
        currentCount,
        currentScore,
        nextMilestone,
        docsNeeded,
        impactPercent,
        samImpact: getSamImpact(section.id),
        isComplete: currentScore === 100
      };
    }).sort((a, b) => {
      // Sort by: incomplete first, then by impact, then by category priority
      if (a.isComplete !== b.isComplete) return a.isComplete ? 1 : -1;
      if (a.impactPercent !== b.impactPercent) return b.impactPercent - a.impactPercent;
      return a.weight - b.weight;
    });
  };

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
            <div key={doc.id} className="bg-muted border border rounded-lg p-4">
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
                    <div className="mt-3 p-3 bg-muted/50 rounded border border">
                      <p className="text-[11px] text-gray-400 font-medium mb-2">💬 SAM's Feedback:</p>
                      <div className="space-y-1">
                        {docFeedback.map((feedback: any, idx: number) => (
                          <p key={idx} className={`text-xs ${feedback.type === 'critical' ? 'text-red-300' :
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
    // Foundation
    company: 'Define your business profile',
    products: 'Document your offering',
    icp: 'Define your ideal customers',
    messaging: 'Craft your value proposition',
    // GTM Strategy
    competition: 'Map competitive landscape',
    pricing: 'Set pricing and business model',
    buying: 'Define your GTM channels',
    // Customer Intelligence
    personas: 'Define buyer roles',
    objections: 'Document pain points',
    success: 'Share proof points',
    // Execution Assets
    tone: 'Set brand voice',
    collateral: 'Upload templates & snippets',
    compliance: 'Set guidelines',
    // Other
    documents: 'Upload files',
    sam_onboarding: 'Train SAM',
    metrics: 'Track success KPIs'
  };

  const getQuickActionDescription = (sectionId: string) => {
    // Only show static default descriptions - no external content
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
    { id: 'analytics', label: 'Usage Analytics', icon: Activity },
    // Foundation
    { id: 'company', label: 'Company Profile', icon: Briefcase },
    { id: 'products', label: 'Product/Service', icon: Package },
    { id: 'icp', label: 'Target Market', icon: Target },
    { id: 'messaging', label: 'Value Proposition', icon: MessageSquare },
    // GTM Strategy
    { id: 'competition', label: 'Competitive Landscape', icon: TrendingUp },
    { id: 'pricing', label: 'Pricing & Model', icon: DollarSign },
    { id: 'buying', label: 'GTM Channels', icon: GitBranch },
    // Customer Intelligence
    { id: 'personas', label: 'Buyer Personas', icon: UserCheck },
    { id: 'objections', label: 'Pain Points', icon: MessageCircle },
    { id: 'success', label: 'Success Stories', icon: Trophy },
    // Execution Assets
    { id: 'tone', label: 'Brand Voice', icon: Mic },
    { id: 'collateral', label: 'Templates & Snippets', icon: Briefcase },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    // Other
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'sam_onboarding', label: 'SAM Onboarding', icon: Bot },
    { id: 'metrics', label: 'Success Metrics', icon: BarChart }
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
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        {/* Main Content */}
        <div>
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* ICP Selector - Multi-ICP Support */}
              {Object.keys(icpProfiles).length > 1 && (
                <div className="bg-card border shadow rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Target className="text-purple-400" size={20} />
                      <span className="text-white font-medium">View Knowledge Base for:</span>
                    </div>
                    <select
                      value={selectedIcpId || ''}
                      onChange={(e) => setSelectedIcpId(e.target.value || null)}
                      className="bg-muted border border text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">All ICPs (Global + Specific)</option>
                      {Object.values(icpProfiles).map((icp) => (
                        <option key={icp.id} value={icp.id}>
                          {icp.name || icp.icp_name || 'Unnamed ICP'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-gray-400 text-xs mt-2">
                    {selectedIcpId
                      ? `Showing content specific to this ICP plus global content`
                      : `Showing all knowledge base content across all ICPs`}
                  </p>
                </div>
              )}



              {/* KB Completeness and Health - First Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* KB Completeness Meter */}
                <div className="bg-card rounded-xl p-6 border shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white text-lg font-semibold">Knowledgebase Completeness</span>
                    <span className="text-white text-2xl font-bold">{completionDisplay}</span>
                  </div>

                  {/* Temperature-style completion bar */}
                  <div className="relative mb-6">
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
                      <p>• <span className="text-yellow-400 font-semibold">Essential Set: {Math.round(criticalScore)}/75%</span> (1 doc each: ICP, Product, Messaging, Pricing)</p>
                      <p>• <span className="text-blue-400">Bonus Content: {Math.round(importantScore + supportingScore)}/25%</span> (Objections, Case Studies, etc.)</p>
                      {icpBonus > 0 && <p className="text-green-400">• Extra ICPs: +{icpBonus}%</p>}
                    </div>
                  )}

                  {!isKnowledgeLoading && (
                    <details className="mt-4 text-xs text-gray-400 group">
                      <summary className="cursor-pointer font-bold text-base px-4 py-3 rounded-lg transition-all list-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white shadow-lg hover:shadow-xl">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2">
                            {knowledgeCompletion === 0
                              ? '📊 How to reach 100% (Perfect Score)'
                              : `🎯 Your Action Plan to ${knowledgeCompletion >= 100 ? 'Perfect' : 'Improve Your'} Score`}
                          </span>
                          <span className="text-xs opacity-75 group-open:rotate-180 transition-transform">▼</span>
                        </div>
                      </summary>
                      <div className="mt-3 space-y-3 pl-4 border-l-2 border">
                        {knowledgeCompletion === 0 ? (
                          // General guidance for completely empty KB
                          <>
                            <div className="bg-gradient-to-r from-yellow-900/20 to-yellow-800/10 border border-yellow-600/30 rounded-lg p-4 -ml-4 pl-6 mb-3">
                              <p className="font-bold text-yellow-400 mb-2">🎯 ONE Complete Set = 75%</p>
                              <p className="text-gray-300 text-sm mb-2">Upload these 4 essential documents to unlock full campaigns:</p>
                              <ul className="ml-3 space-y-1 text-gray-300">
                                <li>✓ 1 ICP Profile → <span className="text-white font-semibold">18.75%</span></li>
                                <li>✓ 1 Product/Service Doc → <span className="text-white font-semibold">18.75%</span></li>
                                <li>✓ 1 Messaging Template → <span className="text-white font-semibold">18.75%</span></li>
                                <li>✓ 1 Pricing Document → <span className="text-white font-semibold">18.75%</span></li>
                              </ul>
                              <p className="text-yellow-300 font-semibold mt-2">= 75% Total</p>
                            </div>

                            <div>
                              <p className="font-medium text-blue-400 mb-1">Bonus Content (25% to reach 100%):</p>
                              <p className="text-gray-400 text-xs mb-2">Everything else is bonus to maximize SAM's effectiveness:</p>
                              <ul className="ml-3 space-y-0.5 text-gray-400 text-xs">
                                <li>• Objections, Case Studies, Competitor Intel → 5% each</li>
                                <li>• Company, Buying Process, Personas, Compliance, Tone → 2% each</li>
                                <li>• Extra ICPs → +2% bonus each (max +4%)</li>
                                <li>• Additional messaging variants → Better A/B testing</li>
                              </ul>
                            </div>

                            <div className="pt-3 bg-green-900/20 -ml-4 pl-4 pr-2 py-3 rounded border border-green-700/30 mt-3">
                              <p className="font-medium text-green-400">💡 Quick Path to 75%:</p>
                              <p className="text-gray-300 mt-1 text-sm">Just upload 4 documents (ICP, Product, Messaging, Pricing) and you're ready to launch!</p>
                            </div>
                          </>
                        ) : (
                          // Dynamic personalized recommendations
                          <>
                            {(() => {
                              const recommendations = generateRecommendations();
                              const incomplete = recommendations.filter(r => !r.isComplete);
                              const complete = recommendations.filter(r => r.isComplete);

                              return (
                                <>
                                  {knowledgeCompletion >= 100 ? (
                                    <div className="pt-2 bg-green-900/20 -ml-4 pl-4 pr-2 py-2 rounded border border-green-700">
                                      <p className="font-medium text-green-400">🎉 Perfect Score Achieved!</p>
                                      <p className="text-gray-400 mt-1">Your knowledge base is fully optimized. SAM has everything needed for maximum effectiveness.</p>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <p className="font-medium text-gray-300 mb-1">Priority Actions (by impact):</p>
                                        <p className="text-gray-400 text-xs">Fill these gaps to improve SAM's knowledge:</p>
                                      </div>

                                      <div className="space-y-3">
                                        {incomplete.slice(0, 6).map(rec => {
                                          const categoryColor = rec.category === 'critical' ? 'text-yellow-400' :
                                            rec.category === 'important' ? 'text-orange-400' : 'text-blue-400';
                                          const icon = rec.currentScore === 0 ? '❌' : '⚠️';

                                          return (
                                            <div key={rec.id} className="flex items-start justify-between gap-2 pb-2 border-b border/50 last:border-0">
                                              <div className="flex-1">
                                                <p className={`font-medium ${categoryColor}`}>
                                                  {icon} {rec.label}
                                                </p>
                                                <p className="text-gray-400 text-xs mt-0.5">
                                                  {rec.currentCount > 0
                                                    ? `Has ${rec.currentCount}, add ${rec.docsNeeded} more → ${rec.nextMilestone}%`
                                                    : `Add ${rec.docsNeeded} document${rec.docsNeeded > 1 ? 's' : ''} to start`}
                                                </p>
                                                <p className="text-blue-300 text-xs mt-1 italic">
                                                  📞 {rec.samImpact}
                                                </p>
                                              </div>
                                              <div className="text-right ml-2 flex-shrink-0">
                                                <p className="text-green-400 font-medium">+{rec.impactPercent}%</p>
                                                <p className="text-gray-500 text-xs">impact</p>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>

                                      {incomplete.length > 6 && (
                                        <p className="text-gray-500 text-xs italic">
                                          +{incomplete.length - 6} more sections to optimize
                                        </p>
                                      )}

                                      {complete.length > 0 && (
                                        <div className="pt-2 border-t border">
                                          <p className="font-medium text-green-400 text-xs">
                                            ✅ Completed: {complete.map(c => c.label).join(', ')}
                                          </p>
                                        </div>
                                      )}

                                      <div className="pt-2 border-t border">
                                        <p className="font-medium text-gray-300 text-xs mb-2">How to Fill Knowledge Gaps:</p>
                                        <div className="space-y-1.5 text-xs text-gray-400">
                                          <div className="flex items-start gap-2">
                                            <span className="text-green-400">💬</span>
                                            <div>
                                              <span className="text-gray-300 font-medium">Complete SAM's Interview:</span> Answer targeted questions to fill specific sections quickly
                                            </div>
                                          </div>
                                          <div className="flex items-start gap-2">
                                            <span className="text-blue-400">📄</span>
                                            <div>
                                              <span className="text-gray-300 font-medium">Upload Documents:</span> Upload your existing sales collateral, playbooks, and guides
                                            </div>
                                          </div>
                                          <div className="flex items-start gap-2 opacity-60">
                                            <span className="text-purple-400">✅</span>
                                            <div>
                                              <span className="text-gray-300 font-medium">Website Content:</span> Already extracted during onboarding
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="pt-2 bg-gray-750 -ml-4 pl-4 pr-2 py-2 rounded">
                                        <p className="font-medium text-green-400">💡 Quick Win:</p>
                                        <p className="text-gray-400 mt-1">
                                          {incomplete.length > 0 && incomplete[0].impactPercent >= 6
                                            ? `Focus on ${incomplete[0].label} first for the biggest impact (+${incomplete[0].impactPercent}%).`
                                            : 'Focus on critical sections (Products, ICP, Messaging, Pricing) for maximum impact.'}
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </details>
                  )}

                  {isKnowledgeLoading && (
                    <p className="text-xs text-gray-400 mt-2">
                      Calculating coverage based on critical sales enablement content...
                    </p>
                  )}
                </div>

                {/* KB Health */}
                <div className="bg-card rounded-xl p-6 border shadow">
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
                            <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
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

              {/* Quick Actions & Navigation */}
              <div className="bg-card rounded-xl p-6 border shadow">
                <h3 className="text-white text-lg font-semibold mb-4">Quick Actions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {sections.slice(1).filter(s => s.id !== 'analytics').map((section) => {
                    const IconComponent = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className="bg-muted border border rounded-lg p-4 text-left transition-all hover:bg-purple-600 hover:border-purple-500 group cursor-pointer"
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

              {/* Stats Row - Total Documents, ICP Profiles, KB Completion, SAM Insights */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Documents */}
                <div className="bg-card border shadow rounded-lg p-4">
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
                <div className="bg-card border shadow rounded-lg p-4">
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

                {/* KB Completion Summary */}
                <div className="bg-card border shadow rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">KB Completion</p>
                      <p className="text-white text-2xl font-bold">{completionDisplay}</p>
                    </div>
                    <Activity className="text-green-400" size={24} />
                  </div>
                  <p className="text-green-400 text-xs mt-2">
                    {!isKnowledgeLoading ? `${Math.round(criticalScore)}% Critical coverage` : 'Calculating...'}
                  </p>
                </div>

                {/* SAM Insights */}
                <div className="bg-card border shadow rounded-lg p-4">
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
              <div className="bg-card rounded-xl p-6 border shadow">
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
                      <div key={`insight-${doc.id}`} className="bg-muted rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-white text-sm font-medium">{doc.title}</p>
                            {doc.summary && (
                              <p className="text-gray-300 text-xs mt-1">{doc.summary}</p>
                            )}
                          </div>
                          <span className="text-blue-400 text-xs bg-blue-400/10 px-2 py-1 rounded">
                            {getSectionLabel(doc.category || 'documents')}
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

              {/* Latest Knowledge Assets */}
              <div className="bg-card rounded-xl p-6 border shadow">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white text-lg font-semibold flex items-center">
                    <FileText className="mr-2 text-blue-400" size={20} />
                    Latest Knowledge Base Assets
                  </h3>
                  <button
                    onClick={() => loadDocuments(selectedIcpId)}
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
                      <div
                        key={doc.id}
                        className="bg-muted border border rounded-lg p-4 hover:bg-gray-650 hover:border-purple-500 transition-all cursor-pointer"
                        onClick={() => {
                          console.log('[KB] Document clicked:', doc);
                          // TODO: Implement document detail view or actions
                          alert(`Document: ${doc.title}\n\nCategory: ${doc.category}\n\nSummary: ${doc.summary || 'No summary'}\n\nTags: ${doc.tags?.join(', ') || 'None'}`);
                        }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-white text-sm font-semibold">{doc.title}</p>
                            <p className="text-gray-400 text-xs">Category: {doc.category}</p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            <span className="text-xs text-gray-300">
                              {doc.updatedAt ? new Date(doc.updatedAt).toLocaleDateString() : ''}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent card click when deleting
                                deleteDocument(doc.id);
                              }}
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

          {activeSection === 'analytics' && (
            <div>
              <button
                onClick={() => setActiveSection('overview')}
                className="mb-6 text-blue-400 hover:text-blue-300 flex items-center text-sm"
              >
                <ArrowLeft className="mr-2" size={16} />
                Back to Overview
              </button>
              <KnowledgeBaseAnalytics />
            </div>
          )}

          {activeSection === 'icp' && (
            <>
              {Object.keys(icpProfiles).length === 0 ? (
                <div className="bg-card border shadow rounded-lg p-12 text-center">
                  <Target size={48} className="mx-auto text-gray-500 mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">No ICP Profiles Yet</h3>
                  <p className="text-gray-400 mb-6">Create your first Ideal Customer Profile to get started</p>
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    <Plus className="inline mr-2" size={18} />
                    Go to Overview to Create ICP
                  </button>
                </div>
              ) : (
                <ICPConfigEditable
                  profile={Object.values(icpProfiles)[0]}
                  onUpdate={async (updates) => {
                    const icpId = Object.keys(icpProfiles)[0];
                    const response = await fetch(`/api/knowledge-base/icps/${icpId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(updates)
                    });
                    if (response.ok) {
                      await loadIcpProfiles();
                    }
                  }}
                  onBack={() => setActiveSection('overview')}
                />
              )}
            </>
          )}

          {activeSection === 'products' && (
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${kbFeedback.sectionFeedback.products.status === 'critical' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
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
                  <DocumentUpload section="products" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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

              <div className="bg-muted border border rounded-lg p-4 mt-6">
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
                      <div key={product.id} className="border rounded-lg p-3 bg-card">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="competition" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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

              <div className="bg-muted border border rounded-lg p-4 mt-6">
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
                      <div key={competitor.id} className="border rounded-lg p-3 bg-card">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="messaging" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="tone-of-voice" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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
              <div className="bg-muted border border rounded-lg p-6">
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
                    <DocumentUpload section="sender-emails" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="company-info" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="success-stories" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="buying-process" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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

                  <div className="bg-muted border border rounded-lg p-4 mt-4">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="compliance" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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

              <div className="bg-muted border border rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Human-in-the-Loop Checkpoints</h4>
                <div className="text-center py-4">
                  <div className="text-gray-400 text-sm">No checkpoints configured</div>
                  <div className="text-gray-500 text-xs mt-1">Define triggers that require human review before sending</div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'personas' && (
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                  <DocumentUpload section="personas" onComplete={() => loadDocuments(selectedIcpId)} icpId={selectedIcpId} />
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

              <div className="bg-muted border border rounded-lg p-4 mt-6">
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
                        <div key={persona.id} className="border rounded-lg p-3 bg-card">
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
                <div className="bg-muted border border rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Leadership Roles</h4>
                  <div className="space-y-1 text-sm text-gray-300">
                    <div>• Founder/Co-Founder</div>
                    <div>• CEO/C-Suite</div>
                    <div>• VP Sales/Revenue</div>
                    <div>• Head of Growth</div>
                  </div>
                </div>
                <div className="bg-muted border border rounded-lg p-4">
                  <h4 className="text-white font-medium mb-2">Operational Roles</h4>
                  <div className="space-y-1 text-sm text-gray-300">
                    <div>• Sales Manager</div>
                    <div>• SDR/BDR Lead</div>
                    <div>• Marketing Director</div>
                    <div>• Operations Manager</div>
                  </div>
                </div>
                <div className="bg-muted border border rounded-lg p-4">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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

              <div className="bg-muted border border rounded-lg p-4">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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

              <div className="bg-muted border border rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">ROI Analysis</h4>
                <div className="text-center py-4">
                  <div className="text-gray-400 text-sm">No ROI data available</div>
                  <div className="text-gray-500 text-xs mt-1">Upload cost comparison documents to display ROI analysis</div>
                </div>
              </div>
            </div>
          )}


          {activeSection === 'metrics' && (
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                <div className="bg-muted border border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-green-400 mb-2">35%</div>
                  <div className="text-white font-medium">Avg. Lead Engagement Increase</div>
                  <div className="text-gray-400 text-sm">First 30 days</div>
                </div>
                <div className="bg-muted border border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-blue-400 mb-2">50%</div>
                  <div className="text-white font-medium">Faster Outreach Cycle</div>
                  <div className="text-gray-400 text-sm">vs Manual SDRs</div>
                </div>
                <div className="bg-muted border border rounded-lg p-4 text-center">
                  <div className="text-3xl font-bold text-purple-400 mb-2">10x</div>
                  <div className="text-white font-medium">ROI Within 3 Months</div>
                  <div className="text-gray-400 text-sm">Typical customer</div>
                </div>
              </div>

              <div className="bg-muted border border rounded-lg p-4 mb-6">
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

              <div className="bg-muted border border rounded-lg p-4">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
                    <div className="bg-muted border border rounded-lg p-3">
                      <div className="text-white text-sm font-medium">Salesforce Integration Guide.pdf</div>
                      <div className="text-gray-400 text-xs">Field mapping, lead routing • API configuration</div>
                    </div>
                    <div className="bg-muted border border rounded-lg p-3">
                      <div className="text-white text-sm font-medium">HubSpot Sync Configuration.pdf</div>
                      <div className="text-gray-400 text-xs">Contact properties, deal stages • Workflow automation</div>
                    </div>
                    <div className="bg-muted border border rounded-lg p-3">
                      <div className="text-white text-sm font-medium">Pipedrive Setup Template.pdf</div>
                      <div className="text-gray-400 text-xs">Pipeline configuration, activity tracking • Custom fields</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-muted border border rounded-lg p-4">
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
                <div className="bg-muted border border rounded-lg p-4">
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
                <div className="bg-muted border border rounded-lg p-4">
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

              <div className="bg-muted border border rounded-lg p-4 mb-6">
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

              <div className="bg-muted border border rounded-lg p-4">
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
            <div className="bg-card rounded-xl p-6 border shadow">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setActiveSection('overview')}
                    className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-muted rounded-lg transition-colors"
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
    </div >
  );
};

export default KnowledgeBase;
