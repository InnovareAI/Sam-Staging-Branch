'use client';

import React, { useState } from 'react';
import { Brain, CheckSquare, Target, Users, Building2, TrendingUp, Plus, Settings, Upload, FileText, Search, Package, Award, MessageSquare, Cpu, Clock, AlertCircle, Mic, Briefcase, Trophy, GitBranch, Mail, Shield, UserCheck, MessageCircle, DollarSign, Zap, BarChart, UserPlus, Bot, HelpCircle, X } from 'lucide-react';
import SAMOnboarding from './SAMOnboarding';
import InquiryResponses from './InquiryResponses';

// Document Upload Component
function DocumentUpload({ section }: { section: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done'>('idle');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    // Simulate upload and processing
    setTimeout(() => setStatus('processing'), 1000);
    setTimeout(() => setStatus('done'), 3000);
  };

  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile);
    setShowUploadModal(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && (droppedFile.type === 'application/pdf' || droppedFile.type === 'text/plain' || droppedFile.name.endsWith('.md'))) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  return (
    <>
      <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
        <div 
          className={`border-2 border-dashed rounded p-6 text-center transition-colors cursor-pointer ${
            isDragOver ? 'border-blue-400 bg-blue-50/5' : 'border-gray-500 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => setShowUploadModal(true)}
        >
          <Upload className={`mx-auto mb-3 transition-colors ${isDragOver ? 'text-blue-400' : 'text-gray-400'}`} size={32} />
          <p className={`text-lg font-medium transition-colors ${isDragOver ? 'text-blue-300' : 'text-gray-300'}`}>
            {isDragOver ? 'Drop your file here' : 'Upload Document'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Drag & drop or click to select • PDF, TXT, MD files
          </p>
        </div>
        
        {file && (
          <div className="mt-4 p-3 bg-gray-600 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <FileText size={20} className="text-blue-400" />
                <div>
                  <p className="text-sm font-medium text-gray-200">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setFile(null)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                  title="Remove file"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleUpload}
                  disabled={status !== 'idle'}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-500 text-white text-sm rounded-lg transition-colors disabled:opacity-50"
                >
                  {status === 'idle' && 'Upload & Process'}
                  {status === 'uploading' && 'Uploading...'}
                  {status === 'processing' && 'Processing...'}
                  {status === 'done' && 'Processed ✓'}
                </button>
              </div>
            </div>
            {status === 'processing' && (
              <p className="text-xs text-yellow-400 mt-2">🤖 SAM is analyzing and tagging this document...</p>
            )}
            {status === 'done' && (
              <p className="text-xs text-green-400 mt-2">✅ Document processed and ready for SAM conversations</p>
            )}
          </div>
        )}
      </div>

      {/* Custom Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-600 relative">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10"
            >
              <X size={24} />
            </button>
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white pr-8">Select Document</h3>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Choose a document to upload to the <span className="font-medium text-blue-400">{section}</span> section of your Knowledge Base.
              </p>
              
              {/* File Type Options */}
              <div className="grid grid-cols-1 gap-3">
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center p-4 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors">
                    <FileText className="text-red-400 mr-3" size={24} />
                    <div>
                      <p className="text-white font-medium">PDF Document</p>
                      <p className="text-gray-400 text-sm">Portable Document Format</p>
                    </div>
                  </div>
                </label>
                
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    accept=".txt"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center p-4 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors">
                    <FileText className="text-blue-400 mr-3" size={24} />
                    <div>
                      <p className="text-white font-medium">Text File</p>
                      <p className="text-gray-400 text-sm">Plain text document</p>
                    </div>
                  </div>
                </label>
                
                <label className="relative cursor-pointer">
                  <input
                    type="file"
                    accept=".md"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) handleFileSelect(selectedFile);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center p-4 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors">
                    <FileText className="text-green-400 mr-3" size={24} />
                    <div>
                      <p className="text-white font-medium">Markdown File</p>
                      <p className="text-gray-400 text-sm">Markdown document</p>
                    </div>
                  </div>
                </label>
              </div>
              
              <div className="text-center pt-4 border-t border-gray-600">
                <p className="text-gray-400 text-xs">
                  Maximum file size: 10MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ICP Configuration Component
function ICPConfiguration() {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [icpProfiles, setIcpProfiles] = useState<{[key: string]: any}>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Fetch ICP configurations on component mount
  React.useEffect(() => {
    async function fetchICPConfigurations() {
      try {
        setLoading(true);
        console.log('Fetching ICP configurations...');
        const response = await fetch('/api/sam/icp-configurations');
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.success && data.configurations) {
          // Transform API data to match the component's expected format
          const profiles: {[key: string]: any} = {};
          data.configurations.forEach((config: any) => {
            profiles[config.id] = {
              id: config.id,
              name: config.title,
              market_niche: config.market_niche,
              industry_vertical: config.industry_vertical,
              description: config.description,
              // Transform structured data to match the display format
              criteria: {
                headcount: config.structured_data.target_profile?.company_size || 'Not specified',
                revenue: config.structured_data.target_profile?.revenue_range || 'Not specified',
                growth: config.structured_data.target_profile?.growth_stage || 'Not specified',
                type: config.structured_data.target_profile?.business_model || 'Not specified'
              },
              industries: config.tags || [],
              technologies: config.structured_data.target_profile?.technology_focus || 'Not specified',
              leads: {
                seniority: config.structured_data.decision_makers?.primary?.join(', ') || 'Not specified',
                function: config.structured_data.decision_makers?.budget_authority || 'Not specified',
                experience: config.structured_data.decision_makers?.decision_timeline || 'Not specified',
                geography: 'Global' // Default since not specified in our data
              },
              signals: config.structured_data.pain_points?.main_triggers || []
            };
          });
          
          setIcpProfiles(profiles);
          
          // Auto-select the first ICP if none is selected
          if (!selectedICP && Object.keys(profiles).length > 0) {
            setSelectedICP(Object.keys(profiles)[0]);
          }
          console.log('Transformed profiles:', profiles);
        } else {
          console.log('API call succeeded but no configurations found:', data);
        }
      } catch (error) {
        console.error('Failed to fetch ICP configurations:', error);
        // For debugging: also show the error type
        if (error instanceof Error) {
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
      } finally {
        setLoading(false);
      }
    }
    
    fetchICPConfigurations();
  }, []);
  
  const currentICP = selectedICP && icpProfiles[selectedICP] ? icpProfiles[selectedICP] : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
        <Target className="mr-2" size={24} />
        ICP Configuration
      </h2>

      {/* Loading State */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Target size={48} className="mx-auto mb-4 opacity-50 animate-pulse" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">Loading ICP Configurations...</h3>
            <p className="text-sm max-w-md mx-auto">
              Fetching your 20 B2B market niche profiles from the knowledge base.
            </p>
          </div>
        </div>
      ) : Object.keys(icpProfiles).length > 0 ? (
        <div className="mb-6 bg-gray-700 rounded-lg p-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(icpProfiles).map(([key, profile]) => (
              <button
                key={key}
                onClick={() => setSelectedICP(key)}
                className={`py-2 px-3 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  selectedICP === key
                    ? 'text-white bg-gray-600'
                    : 'text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
                title={profile.description}
              >
                {profile.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Target size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No ICP Profiles Found</h3>
            <p className="text-sm max-w-md mx-auto">
              Unable to load the 20 B2B market niche ICP configurations. Check the browser console for debugging information.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )}

      {/* Current ICP Details */}
      {currentICP ? (
        <div className="space-y-4">
          {/* Company Criteria */}
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3 flex items-center">
              <Building2 className="mr-2" size={16} />
              Company Criteria
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Headcount:</span>
                <span className="text-white">{currentICP.criteria?.headcount || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Revenue:</span>
                <span className="text-white">{currentICP.criteria?.revenue || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Growth:</span>
                <span className="text-white">{currentICP.criteria?.growth || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Type:</span>
                <span className="text-white">{currentICP.criteria?.type || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Industry & Technology */}
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3 flex items-center">
              <Cpu className="mr-2" size={16} />
              Industry & Technology
            </h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 leading-relaxed">
                {currentICP.industries?.length > 0 ? (
                  currentICP.industries.map((industry: string, index: number) => (
                    <span key={index} className="bg-gray-600 text-white px-3 py-1.5 rounded-full text-xs whitespace-nowrap">
                      {industry}
                    </span>
                  ))
                ) : (
                  <span className="text-gray-400 text-xs">No industries specified</span>
                )}
              </div>
              <div className="text-gray-300 text-xs">
                <strong>Technologies:</strong> {currentICP.technologies || 'Not specified'}
              </div>
            </div>
          </div>

          {/* Lead Criteria */}
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3 flex items-center">
              <Users className="mr-2" size={16} />
              Lead Criteria
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-300">Seniority:</span>
                <span className="text-white">{currentICP.leads?.seniority || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Function:</span>
                <span className="text-white">{currentICP.leads?.function || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Experience:</span>
                <span className="text-white">{currentICP.leads?.experience || 'Not specified'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Geography:</span>
                <span className="text-white">{currentICP.leads?.geography || 'Not specified'}</span>
              </div>
            </div>
          </div>

          {/* Timing & Signals */}
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <h3 className="text-white font-medium mb-3 flex items-center">
              <Clock className="mr-2" size={16} />
              Timing & Signals
            </h3>
            <div className="space-y-1 text-sm">
              {currentICP.signals?.length > 0 ? (
                currentICP.signals.map((signal: string, index: number) => (
                  <div key={index} className="text-gray-300">• {signal}</div>
                ))
              ) : (
                <div className="text-gray-400">No signals configured</div>
              )}
            </div>
          </div>
        </div>
      ) : Object.keys(icpProfiles).length > 0 && (
        <div className="text-center py-8">
          <p className="text-gray-400">Select an ICP profile to view details</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4">
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Create New ICP Profile
        </button>
        {currentICP && (
          <>
            <button 
              onClick={() => setShowEditModal(true)}
              className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Edit Current Profile
            </button>
            <button 
              onClick={() => {
                // Create PDF content for current ICP
                const pdfContent = `
ICP Profile: ${currentICP.name}
Industry: ${currentICP.industry_vertical}
Description: ${currentICP.description}

Company Criteria:
- Size: ${currentICP.criteria?.headcount || 'Not specified'}
- Revenue: ${currentICP.criteria?.revenue || 'Not specified'}
- Type: ${currentICP.criteria?.type || 'Not specified'}

Decision Makers:
- Seniority: ${currentICP.leads?.seniority || 'Not specified'}
- Function: ${currentICP.leads?.function || 'Not specified'}

Generated on: ${new Date().toLocaleDateString()}
                `.trim();
                
                const blob = new Blob([pdfContent], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${currentICP.name.replace(/\s+/g, '_')}_ICP_Profile.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Download as PDF
            </button>
            <button 
              onClick={() => {
                alert(`Assign "${currentICP.name}" ICP Profile to Campaign\n\nThis would:\n- Open campaign selection modal\n- Apply ICP criteria to prospect targeting\n- Set messaging strategy for the campaign\n- Configure decision maker filters\n\nFeature coming soon!`);
              }}
              className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Assign to Campaign
            </button>
          </>
        )}
        {Object.keys(icpProfiles).length > 0 && (
          <button 
            onClick={() => {
              const configData = {
                timestamp: new Date().toISOString(),
                total_profiles: Object.keys(icpProfiles).length,
                profiles: icpProfiles
              };
              const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `icp-configurations-${new Date().toISOString().split('T')[0]}.json`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
            }}
            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Export All Configurations
          </button>
        )}
      </div>

      {/* Create ICP Profile Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Create New ICP Profile</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Profile Name</label>
                  <input
                    type="text"
                    placeholder="e.g., Custom Tech Startups"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Industry Vertical</label>
                  <input
                    type="text"
                    placeholder="e.g., Technology"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  rows={3}
                  placeholder="Brief description of this ICP profile..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Company Criteria */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Company Criteria</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Company Size</label>
                    <input
                      type="text"
                      placeholder="e.g., 50-500 employees"
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Revenue Range</label>
                    <input
                      type="text"
                      placeholder="e.g., $10M-$100M revenue"
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Decision Makers */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Decision Makers</h4>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Primary Decision Makers</label>
                  <input
                    type="text"
                    placeholder="e.g., CTO, VP Engineering, Technical Director"
                    className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Pain Points */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Key Pain Points</h4>
                <textarea
                  rows={3}
                  placeholder="Describe the main challenges this ICP faces..."
                  className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tags (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g., technology, startups, b2b, saas"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-600">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('ICP Profile creation functionality will be implemented to save to the database. This would create a new custom profile alongside the 20 pre-configured ones.');
                  setShowCreateModal(false);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Create Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit ICP Profile Modal */}
      {showEditModal && currentICP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-gray-600 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Edit ICP Profile: {currentICP.name}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Profile Name</label>
                  <input
                    type="text"
                    defaultValue={currentICP.name}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Industry Vertical</label>
                  <input
                    type="text"
                    defaultValue={currentICP.industry_vertical}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                <textarea
                  rows={3}
                  defaultValue={currentICP.description}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Company Criteria */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Company Criteria</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Company Size</label>
                    <input
                      type="text"
                      defaultValue={currentICP.criteria?.headcount || ''}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Revenue Range</label>
                    <input
                      type="text"
                      defaultValue={currentICP.criteria?.revenue || ''}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Decision Makers */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Decision Makers</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Seniority Level</label>
                    <input
                      type="text"
                      defaultValue={currentICP.leads?.seniority || ''}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Function</label>
                    <input
                      type="text"
                      defaultValue={currentICP.leads?.function || ''}
                      className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Technologies */}
              <div className="bg-gray-700 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3">Technologies & Stack</h4>
                <textarea
                  rows={2}
                  defaultValue={currentICP.technologies || ''}
                  placeholder="Technologies, tools, and platforms this ICP typically uses..."
                  className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Industries/Tags */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Industry Tags</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {currentICP.industries?.map((tag: string, index: number) => (
                    <span key={index} className="bg-gray-600 text-white px-2 py-1 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Add new tags (comma-separated)"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-600">
              <button
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert('ICP Profile editing functionality will be implemented to save changes to the database. This would update the selected profile with the new values.');
                  setShowEditModal(false);
                }}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
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
        
        {activeSection === 'icp' && <ICPConfiguration />}
        
        {activeSection === 'products' && (
          <KnowledgeBaseSection category="product" title="Products & Services" icon={Package} onClose={() => setActiveSection('overview')} />
        )}

        {activeSection === 'competition' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <TrendingUp className="mr-2" size={24} />
              Competition Analysis
            </h2>
            
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
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <MessageSquare className="mr-2" size={24} />
              Proven Messaging Templates
            </h2>
            
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
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Mic className="mr-2" size={24} />
              Tone of Voice Documents
            </h2>
            
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
          <KnowledgeBaseSection category="company" title="Company Information & Brand Guidelines" icon={Briefcase} onClose={() => setActiveSection('overview')} />
        )}

        {activeSection === 'success' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Trophy className="mr-2" size={24} />
              Customer Success Stories & Case Studies
            </h2>
            
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
          <KnowledgeBaseSection category="buying-process" title="Buying Process & Decision Framework" icon={GitBranch} onClose={() => setActiveSection('overview')} />
        )}

        {activeSection === 'compliance' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Shield className="mr-2" size={24} />
              Compliance & Restrictions
            </h2>
            
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
          <KnowledgeBaseSection category="personas" title="Personas & Roles" icon={UserCheck} onClose={() => setActiveSection('overview')} />
        )}

        {activeSection === 'objections' && (
          <KnowledgeBaseSection category="strategy" title="Objections & Responses" icon={MessageCircle} onClose={() => setActiveSection('overview')} />
        )}

        {activeSection === 'pricing' && (
          <KnowledgeBaseSection category="pricing" title="Pricing & Packages" icon={DollarSign} onClose={() => setActiveSection('overview')} />
        )}


        {activeSection === 'metrics' && (
          <KnowledgeBaseSection category="success-metrics" title="Success Metrics" icon={BarChart} onClose={() => setActiveSection('overview')} />
        )}

        {activeSection === 'setup' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Settings className="mr-2" size={24} />
              CRM Settings & Integration
            </h2>
            
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
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Bot className="mr-2" size={24} />
              SAM Onboarding Experience
            </h2>
            <p className="text-gray-400 mb-6">Interactive conversational onboarding to collect company data and build your knowledge base</p>
            <SAMOnboarding onComplete={(data) => console.log('Onboarding completed:', data)} />
          </div>
        )}

        {activeSection === 'inquiry_responses' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <HelpCircle className="mr-2" size={24} />
              Industry-Specific Inquiry Responses
            </h2>
            <p className="text-gray-400 mb-6">Role-based FAQ and objection handling for different industries and decision makers</p>
            <InquiryResponses />
          </div>
        )}

        {activeSection === 'documents' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <FileText className="mr-2" size={24} />
              Document Management
            </h2>
            
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

// KnowledgeBaseSection Component
interface KnowledgeBaseSectionProps {
  category: string;
  title: string;
  icon: React.ElementType;
  onClose?: () => void;
}

function KnowledgeBaseSection({ category, title, icon: Icon, onClose }: KnowledgeBaseSectionProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/knowledge-base/data?category=${category}`);
        if (!response.ok) {
          throw new Error('Failed to fetch knowledge base data');
        }
        const result = await response.json();
        setData(result.content || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [category]);

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white flex items-center">
            <Icon className="mr-2" size={24} />
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to overview"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-600 rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-gray-600 rounded w-1/2 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white flex items-center">
            <Icon className="mr-2" size={24} />
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to overview"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
          <div className="text-red-400 mb-2">Error loading {title.toLowerCase()}</div>
          <div className="text-gray-500 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-white flex items-center">
            <Icon className="mr-2" size={24} />
            {title}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Back to overview"
            >
              <X size={20} />
            </button>
          )}
        </div>
        <div className="text-center py-8">
          <Icon size={48} className="mx-auto text-gray-500 mb-4" />
          <div className="text-gray-400 mb-2">No {title.toLowerCase()} information available</div>
          <div className="text-gray-500 text-sm">Knowledge base entries for this category will appear here</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center">
          <Icon className="mr-2" size={24} />
          {title}
        </h2>
        {onClose && (
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-400 hover:text-white transition-colors"
              title="Back to overview"
            >
              ← Back
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
              title="Close and back to overview"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </div>
      
      <div className="space-y-6">
        {data.map((item) => (
          <div key={item.id} className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-medium text-white">{item.title}</h3>
              {item.subcategory && (
                <span className="px-2 py-1 bg-blue-600 text-blue-100 text-xs rounded-full">
                  {item.subcategory}
                </span>
              )}
            </div>
            
            <div className="text-gray-300 mb-4 whitespace-pre-wrap">
              {item.content}
            </div>
            
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.tags.map((tag: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-gray-600 text-gray-300 text-xs rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default KnowledgeBase;