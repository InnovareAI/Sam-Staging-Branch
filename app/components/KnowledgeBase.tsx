'use client';

import React, { useState } from 'react';
import { Brain, CheckSquare, Target, Users, Building2, TrendingUp, Plus, Settings, Upload, FileText, Search, Package, Award, MessageSquare, Cpu, Clock, AlertCircle, Mic, Briefcase, Trophy, GitBranch, Mail, Shield, UserCheck, MessageCircle, DollarSign, Zap, BarChart, UserPlus, Bot, HelpCircle } from 'lucide-react';
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

// ICP Configuration Component
function ICPConfiguration() {
  const [selectedICP, setSelectedICP] = useState<string | null>(null);
  const [icpProfiles, setIcpProfiles] = useState<{[key: string]: any}>({});
  
  const currentICP = selectedICP && icpProfiles[selectedICP] ? icpProfiles[selectedICP] : null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
        <Target className="mr-2" size={24} />
        ICP Configuration
      </h2>

      {/* ICP Profile Selector */}
      {Object.keys(icpProfiles).length > 0 ? (
        <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
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
              {profile.name}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Target size={48} className="mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-gray-300 mb-2">No ICP Profiles Configured</h3>
            <p className="text-sm max-w-md mx-auto">
              Create your first Ideal Customer Profile to help SAM understand your target market and ideal prospects.
            </p>
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
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {currentICP.industries?.length > 0 ? (
                  currentICP.industries.map((industry: string, index: number) => (
                    <span key={index} className="bg-gray-600 text-white px-2 py-1 rounded-full text-xs">
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
      <div className="flex space-x-3 pt-4">
        <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          Create New ICP Profile
        </button>
        {currentICP && (
          <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Edit Current Profile
          </button>
        )}
        {Object.keys(icpProfiles).length > 0 && (
          <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Export Configuration
          </button>
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
        
        {activeSection === 'icp' && <ICPConfiguration />}
        
        {activeSection === 'products' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Package className="mr-2" size={24} />
              Products & Services
            </h2>
            
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <Briefcase className="mr-2" size={24} />
              Company Information & Brand Guidelines
            </h2>
            
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <GitBranch className="mr-2" size={24} />
              Buying Process & Decision Framework
            </h2>
            
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <UserCheck className="mr-2" size={24} />
              Personas & Roles
            </h2>
            
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
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <MessageCircle className="mr-2" size={24} />
              Objections & Responses
            </h2>
            
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
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <DollarSign className="mr-2" size={24} />
              Pricing & Packages
            </h2>
            
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
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
              <BarChart className="mr-2" size={24} />
              Success Metrics
            </h2>
            
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

export default KnowledgeBase;