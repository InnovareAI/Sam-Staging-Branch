'use client';

import React, { useState } from 'react';
import { Brain, CheckSquare, Target, Users, Building2, TrendingUp, Plus, Settings, Upload, FileText, Search, Package, Award, MessageSquare, Cpu, Clock, AlertCircle, Mic, Briefcase, Trophy, GitBranch, Mail, Shield, UserCheck, MessageCircle, DollarSign, Zap, BarChart, UserPlus, Bot, HelpCircle, Globe, ArrowLeft, X } from 'lucide-react';
import SAMOnboarding from './SAMOnboarding';
import InquiryResponses from './InquiryResponses';

// Document Upload Component
function DocumentUpload({ section }: { section: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  
  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    // Simulate upload and processing
    setTimeout(() => setStatus('processing'), 1000);
    setTimeout(() => setStatus('done'), 3000);
  };
  
  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
      <div className="border-2 border-dashed border-gray-500 rounded p-4 text-center">
        <Upload className="mx-auto mb-2 text-gray-400" size={24} />
        <input 
          type="file" 
          accept=".pdf,.txt,.md"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} 
          className="text-gray-300 text-sm w-full"
        />
        <p className="text-xs text-gray-400 mt-2">Supported: PDF, TXT, MD files only</p>
      </div>
      {file && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-300">{file.name}</span>
            <button
              onClick={handleUpload}
              disabled={status !== 'idle'}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded transition-colors disabled:opacity-50"
            >
              {status === 'idle' && 'Upload & Process'}
              {status === 'uploading' && 'Uploading...'}
              {status === 'processing' && 'Processing with LLM...'}
              {status === 'done' && 'Processed ✓'}
            </button>
          </div>
          {status === 'processing' && (
            <p className="text-xs text-yellow-400">🤖 SAM is analyzing and tagging this document...</p>
          )}
          {status === 'done' && (
            <p className="text-xs text-green-400">✅ Document processed and ready for SAM conversations</p>
          )}
        </div>
      )}
    </div>
  );
}

// Comprehensive ICP Configuration Component
function ICPConfiguration({ onBack }: { onBack?: () => void }) {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('overview');
  const [icpProfiles, setIcpProfiles] = useState<{[key: string]: any}>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  const currentICP = selectedICP && icpProfiles[selectedICP] ? icpProfiles[selectedICP] : null;

  // Fetch ICP profiles on component mount
  React.useEffect(() => {
    const fetchICPProfiles = async () => {
      try {
        const response = await fetch('/api/knowledge-base/icp-profiles');
        if (response.ok) {
          const profiles = await response.json();
          setIcpProfiles(profiles || {});
          
          // Auto-select first profile if none selected
          if (!selectedICP && Object.keys(profiles || {}).length > 0) {
            setSelectedICP(Object.keys(profiles)[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch ICP profiles:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchICPProfiles();
  }, []);

  const handleCreateICP = () => {
    setShowCreateForm(true);
  };

  const handleCreateICPSubmit = async (icpName: string) => {
    try {
      const response = await fetch('/api/knowledge-base/icp-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: icpName,
          overview: {},
          target_profile: {},
          decision_makers: {},
          pain_points: {},
          buying_process: {},
          messaging: {},
          success_metrics: {},
          advanced: {}
        })
      });
      
      if (response.ok) {
        const newProfile = await response.json();
        setIcpProfiles(prev => ({ ...prev, [newProfile.id]: newProfile }));
        setSelectedICP(newProfile.id);
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
              title="Back to Knowledge Base"
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

      {/* Remove the old no-profiles section since we moved it above */}
      {false && (
        <div className="text-center py-12">
          <Target size={64} className="mx-auto text-gray-500 mb-4" />
          <h3 className="text-xl font-medium text-gray-300 mb-2">No ICP Profiles Configured</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            Create comprehensive Ideal Customer Profiles with detailed targeting criteria, decision maker analysis, 
            and strategic messaging frameworks to help SAM identify and engage your best prospects.
          </p>
          <div className="space-y-3">
            <button 
              onClick={handleCreateICP}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center mx-auto"
            >
              <Plus className="mr-2" size={16} />
              Create Your First ICP Profile
            </button>
            <div className="flex justify-center space-x-4 text-sm">
              <button className="text-gray-400 hover:text-gray-300 flex items-center">
                <Upload className="mr-1" size={14} />
                Import from Template
              </button>
              <button className="text-gray-400 hover:text-gray-300 flex items-center">
                <Search className="mr-1" size={14} />
                Browse Examples
              </button>
            </div>
          </div>
        </div>
      )}

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
      <h3 className="font-semibold mb-2 text-white">Test Knowledge Retrieval</h3>
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
  const [documents, setDocuments] = useState<Doc[]>([]);

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
            Upload your first document to start building your knowledge base. Supported formats: PDF, TXT, MD
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
  const [chunks, setChunks] = useState<Chunk[]>([]);
  
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

  const sections = [
    { id: 'sam_onboarding', label: 'SAM Onboarding', icon: Bot },
    { id: 'inquiry_responses', label: 'Inquiry Responses', icon: HelpCircle },
    { id: 'overview', label: 'Overview', icon: Brain },
    { id: 'icp', label: 'ICP Config', icon: Target },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'competition', label: 'Competition', icon: TrendingUp },
    { id: 'messaging', label: 'Messaging', icon: MessageSquare },
    { id: 'tone', label: 'Tone of Voice', icon: Mic },
    { id: 'company', label: 'Company Info', icon: Briefcase },
    { id: 'success', label: 'Success Stories', icon: Trophy },
    { id: 'buying', label: 'Buying Process', icon: GitBranch },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'personas', label: 'Personas & Roles', icon: UserCheck },
    { id: 'objections', label: 'Objections', icon: MessageCircle },
    { id: 'pricing', label: 'Pricing', icon: DollarSign },
    { id: 'metrics', label: 'Success Metrics', icon: BarChart },
    { id: 'documents', label: 'Documents', icon: FileText }
  ];

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
          <Brain className="mr-3" size={32} />
          Knowledge Base
        </h1>
        <p className="text-gray-400">Centralized intelligence hub for SAM's conversational AI</p>
      </div>


      {/* Main Content */}
      <div className="max-w-7xl">
        {activeSection === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sections.slice(1).map((section) => {
              const IconComponent = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer"
                >
                  <div className="flex items-center mb-4">
                    <IconComponent className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
                    <h2 className="text-xl font-semibold text-white">{section.label}</h2>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    {section.id === 'icp' && 'Define your ideal customer profiles with detailed targeting criteria, industry specifics, and qualification frameworks to help SAM identify the best prospects.'}
                    {section.id === 'products' && 'Upload comprehensive product documentation, feature sheets, pricing guides, and technical specifications to help SAM articulate your value proposition effectively.'}
                    {section.id === 'competition' && 'Store competitive battlecards, market positioning documents, win/loss analysis, and differentiation strategies to help SAM handle competitive conversations.'}
                    {section.id === 'messaging' && 'Build a library of proven email templates, LinkedIn message sequences, objection handling scripts, and conversation frameworks for consistent outreach.'}
                    {section.id === 'tone' && 'Establish your brand voice guidelines, communication style preferences, and approved messaging frameworks to ensure SAM maintains your authentic voice.'}
                    {section.id === 'company' && 'Centralize company background, team member bios, partnership information, and corporate messaging for accurate representation in conversations.'}
                    {section.id === 'success' && 'Compile customer success stories, case studies, testimonials, and ROI data to provide SAM with social proof for prospect conversations.'}
                    {section.id === 'buying' && 'Document typical buying processes, decision-maker hierarchies, procurement workflows, and stakeholder analysis frameworks for strategic engagement.'}
                    {section.id === 'compliance' && 'Manage industry-specific compliance requirements, regulatory guidelines, approved language, and human-in-the-loop review checkpoints.'}
                    {section.id === 'personas' && 'Create detailed buyer personas with role-specific pain points, motivations, preferred communication styles, and decision-making criteria.'}
                    {section.id === 'objections' && 'Develop comprehensive objection handling playbooks with common pushbacks, proven rebuttals, and conversation redirection strategies.'}
                    {section.id === 'pricing' && 'Structure pricing information, package comparisons, ROI calculators, and cost justification materials for effective pricing conversations.'}
                    {section.id === 'metrics' && 'Define success benchmarks, performance indicators, industry improvement metrics, and example timelines for goal-setting conversations.'}
                    {section.id === 'setup' && 'Configure CRM integration settings, field mapping configurations, automation rules, and workflow triggers for seamless data management.'}
                    {section.id === 'documents' && 'Access general document processing tools, search functionality, and file management utilities for organizing your knowledge assets.'}
                  </p>
                  <div className="mt-4 flex items-center text-gray-400 text-xs">
                    <span>Click to manage • Upload documents • Configure settings</span>
                    <svg className="ml-2 group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        
        {activeSection === 'icp' && <ICPConfiguration onBack={() => setActiveSection('overview')} />}
        
        {activeSection === 'products' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledge Base"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <Package className="mr-2" size={24} />
                  Products & Services
                </h2>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Upload Documents</h3>
                <DocumentUpload section="products" />
                <p className="text-sm text-gray-400 mt-3">
                  📄 Product sheets, service descriptions, feature specs, pricing guides, demo scripts
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Documents</h3>
                <div className="text-center py-8">
                  <FileText size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No product documents uploaded</div>
                  <div className="text-gray-500 text-sm">Upload product sheets, feature specs, and pricing guides to get started</div>
                </div>
              </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="competition" />
                <p className="text-sm text-gray-400 mt-3">
                  🎯 Competitor analysis, battlecards, win/loss reports, market research, SWOT analysis
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Documents</h3>
                <div className="text-center py-8">
                  <TrendingUp size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No competitive analysis documents uploaded</div>
                  <div className="text-gray-500 text-sm">Upload battlecards, market research, and win/loss reports</div>
                </div>
              </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="messaging" />
                <p className="text-sm text-gray-400 mt-3">
                  💬 Email templates, LinkedIn messages, objection handlers, value propositions, case studies
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Templates</h3>
                <div className="text-center py-8">
                  <MessageSquare size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No messaging templates uploaded</div>
                  <div className="text-gray-500 text-sm">Upload email templates, LinkedIn sequences, and objection handlers</div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="tone-of-voice" />
                <p className="text-sm text-gray-400 mt-3">
                  🎭 Brand voice guidelines, writing style guides, communication frameworks, persona-based messaging
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Guidelines</h3>
                <div className="text-center py-8">
                  <Mic size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No tone of voice guidelines uploaded</div>
                  <div className="text-gray-500 text-sm">Upload brand voice guides and communication frameworks</div>
                </div>
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
                  <DocumentUpload section="sender-emails" />
                  <p className="text-xs text-gray-400 mt-2">
                    📧 Email exports (.txt, .eml), blog posts, LinkedIn articles, newsletters, published content
                  </p>
                </div>
                
                <div className="space-y-3">
                  <h4 className="text-white font-medium mb-3">Analyzed Content</h4>
                  <div className="text-center py-8">
                    <Mail size={48} className="mx-auto text-gray-500 mb-4" />
                    <div className="text-gray-400 mb-2">No content analyzed yet</div>
                    <div className="text-gray-500 text-sm">Upload email exports or published content to analyze your writing style</div>
                  </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="company-info" />
                <p className="text-sm text-gray-400 mt-3">
                  🏢 Company overview, team bios, achievements, partnerships, brand guidelines
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Documents</h3>
                <div className="text-center py-8">
                  <Briefcase size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No company documents uploaded</div>
                  <div className="text-gray-500 text-sm">Upload company overview, team profiles, and brand guidelines</div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="success-stories" />
                <p className="text-sm text-gray-400 mt-3">
                  🏆 Case studies, customer testimonials, reference stories, ROI data, success metrics
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Stories</h3>
                <div className="text-center py-8">
                  <Trophy size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No success stories uploaded</div>
                  <div className="text-gray-500 text-sm">Upload case studies, testimonials, and customer success stories</div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="buying-process" />
                <p className="text-sm text-gray-400 mt-3">
                  🔄 Buying journey maps, decision criteria, approval processes, stakeholder analysis, procurement guides
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Current Frameworks</h3>
                <div className="text-center py-8">
                  <GitBranch size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No buying process documents uploaded</div>
                  <div className="text-gray-500 text-sm">Upload buying journey maps, decision frameworks, and procurement guides</div>
                </div>
                
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="compliance" />
                <p className="text-sm text-gray-400 mt-3">
                  🛡️ Industry regulations, compliance guidelines, approved/restricted phrases, HITL checkpoints
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Compliance Rules</h3>
                <div className="text-center py-8">
                  <Shield size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No compliance documents uploaded</div>
                  <div className="text-gray-500 text-sm">Upload industry regulations and compliance guidelines</div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="personas" />
                <p className="text-sm text-gray-400 mt-3">
                  👥 Role profiles, pain points, motivations, communication preferences, decision-making patterns
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Persona Library</h3>
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">Founder/Co-Founder Persona.pdf</div>
                    <div className="text-gray-400 text-xs">Vision-driven, time-pressed • ROI focused</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">VP Sales/Revenue Persona.pdf</div>
                    <div className="text-gray-400 text-xs">Performance-driven, competitive • Metrics focused</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">Agency Owner Persona.pdf</div>
                    <div className="text-gray-400 text-xs">Client-focused, efficiency-driven • Scaling challenges</div>
                  </div>
                </div>
              </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="objections" />
                <p className="text-sm text-gray-400 mt-3">
                  💬 Common objections, proven rebuttals, redirect strategies, conversation frameworks
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Objection Handlers</h3>
                <div className="text-center py-8">
                  <MessageCircle size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No objection handling scripts uploaded</div>
                  <div className="text-gray-500 text-sm">Upload common objections and proven rebuttals</div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="pricing" />
                <p className="text-sm text-gray-400 mt-3">
                  💰 Pricing tiers, package details, ROI calculators, cost justification materials
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Pricing Materials</h3>
                <div className="text-center py-8">
                  <DollarSign size={48} className="mx-auto text-gray-500 mb-4" />
                  <div className="text-gray-400 mb-2">No pricing documents uploaded</div>
                  <div className="text-gray-500 text-sm">Upload pricing tiers, ROI calculators, and cost justification materials</div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="metrics" />
                <p className="text-sm text-gray-400 mt-3">
                  📊 Success benchmarks, industry improvements, ROI studies, timeline examples
                </p>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">Success Studies</h3>
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">Industry Benchmark Report 2024.pdf</div>
                    <div className="text-gray-400 text-xs">Cross-industry success metrics • 500+ companies</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">90-Day Success Timeline.pdf</div>
                    <div className="text-gray-400 text-xs">Typical implementation milestones • ROI progression</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">ROI Case Studies Collection.pdf</div>
                    <div className="text-gray-400 text-xs">10x ROI examples in 3 months • Detailed analysis</div>
                  </div>
                </div>
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
                  title="Back to Knowledge Base"
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
                <DocumentUpload section="crm-setup" />
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
                  title="Back to Knowledge Base"
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

        {activeSection === 'inquiry_responses' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledge Base"
                >
                  <ArrowLeft size={20} />
                </button>
                <h2 className="text-2xl font-semibold text-white flex items-center">
                  <HelpCircle className="mr-2" size={24} />
                  Industry-Specific Inquiry Responses
                </h2>
              </div>
            </div>
            <p className="text-gray-400 mb-6">Role-based FAQ and objection handling for different industries and decision makers</p>
            <InquiryResponses />
          </div>
        )}

        {activeSection === 'documents' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setActiveSection('overview')}
                  className="mr-4 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                  title="Back to Knowledge Base"
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
              <DocumentUpload section="general" />
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