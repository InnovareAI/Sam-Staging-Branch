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

// ICP Configuration Component - approved profiles only
function ICPConfiguration() {
  const [selectedICP, setSelectedICP] = useState('enterprise');
  
  const icpProfiles = {
    enterprise: {
      name: 'Enterprise Tech (Primary)',
      criteria: {
        headcount: '200 - 5,000',
        revenue: '$20M - $500M',
        growth: '≥10% (last 12 months)',
        type: 'Private, Public'
      },
      industries: ['Software Development', 'IT Services', 'Cybersecurity'],
      technologies: 'AWS, Azure, Salesforce, HubSpot',
      leads: {
        seniority: 'VP, Director, C-Level',
        function: 'IT, Engineering, Security',
        experience: '5+ years',
        geography: 'North America, Europe'
      },
      signals: [
        'Changed Jobs (last 90 days)',
        'Posted on LinkedIn (recent activity)',
        'Job Opportunities posted',
        'Department Growth ≥15%'
      ]
    },
    smb: {
      name: 'SMB SaaS (Secondary)',
      criteria: {
        headcount: '25 - 200',
        revenue: '$1M - $20M',
        growth: '≥15% (last 12 months)',
        type: 'Private'
      },
      industries: ['SaaS', 'Tech Startups', 'Digital Agencies'],
      technologies: 'Google Workspace, Slack, Notion, Stripe',
      leads: {
        seniority: 'Founder, VP, Director',
        function: 'Product, Engineering, Growth',
        experience: '3+ years',
        geography: 'North America'
      },
      signals: [
        'Funding Announcements',
        'Product Launches',
        'Team Expansion',
        'New Market Entry'
      ]
    },
    healthcare: {
      name: 'Healthcare Startups',
      criteria: {
        headcount: '50 - 1,000',
        revenue: '$5M - $100M',
        growth: '≥20% (last 12 months)',
        type: 'Private, Public'
      },
      industries: ['HealthTech', 'MedTech', 'Digital Health'],
      technologies: 'Epic, Cerner, AWS Health, HIPAA compliance tools',
      leads: {
        seniority: 'CTO, VP Engineering, Director',
        function: 'Technology, Product, Compliance',
        experience: '5+ years healthcare',
        geography: 'North America, Europe'
      },
      signals: [
        'Regulatory Approvals',
        'Clinical Trial Updates',
        'Partnership Announcements',
        'Compliance Initiatives'
      ]
    }
  };

  const currentICP = icpProfiles[selectedICP as keyof typeof icpProfiles];

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <h2 className="text-2xl font-semibold text-white mb-6 flex items-center">
        <Target className="mr-2" size={24} />
        ICP Configuration
      </h2>

      {/* ICP Profile Selector */}
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

      {/* Current ICP Details */}
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
              <span className="text-white">{currentICP.criteria.headcount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Revenue:</span>
              <span className="text-white">{currentICP.criteria.revenue}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Growth:</span>
              <span className="text-white">{currentICP.criteria.growth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Type:</span>
              <span className="text-white">{currentICP.criteria.type}</span>
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
              {currentICP.industries.map((industry, index) => (
                <span key={index} className="bg-gray-600 text-white px-2 py-1 rounded-full text-xs">
                  {industry}
                </span>
              ))}
            </div>
            <div className="text-gray-300 text-xs">
              <strong>Technologies:</strong> {currentICP.technologies}
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
              <span className="text-white">{currentICP.leads.seniority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Function:</span>
              <span className="text-white">{currentICP.leads.function}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Experience:</span>
              <span className="text-white">{currentICP.leads.experience}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-300">Geography:</span>
              <span className="text-white">{currentICP.leads.geography}</span>
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
            {currentICP.signals.map((signal, index) => (
              <div key={index} className="text-gray-300">• {signal}</div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-3 pt-4">
          <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Edit ICP Profile
          </button>
          <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Add New ICP
          </button>
          <button className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm transition-colors">
            Export Configuration
          </button>
        </div>
      </div>
    </div>
  );
}

// Vector Test Component from VisualMock v1
function VectorTest() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ score: number; text: string; labels: string[] }>>([]);

  const run = () => {
    // mock results
    setResults([
      { score: 0.89, text: 'Our ICP are B2B SaaS startups…', labels: ['icp', 'saas'] },
      { score: 0.74, text: 'Competitors include HubSpot and Apollo…', labels: ['competitive'] },
      { score: 0.66, text: 'Success metrics: reply %, meetings/mo, ROI…', labels: ['metrics'] },
    ]);
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
        />
        <button 
          className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors" 
          onClick={run}
        >
          Run
        </button>
      </div>
      <div className="space-y-2 mt-3 max-h-72 overflow-auto">
        {results.map((r, i) => (
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
        ))}
      </div>
    </div>
  );
}

// Documents Table Component from VisualMock v1
type Doc = { name: string; status: 'Ready' | 'Processing' | 'Error'; uploaded: string; labels: string[] };
const MOCK_DOCS: Doc[] = [
  { name: 'ICP_SaaS.pdf', status: 'Ready', uploaded: '10m ago', labels: ['icp', 'saas'] },
  { name: 'Competitors_2025.md', status: 'Processing', uploaded: '2m ago', labels: ['competitive'] },
  { name: 'CaseStudy_Acme.pdf', status: 'Error', uploaded: '1h ago', labels: [] },
];

function DocumentsTable() {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 font-semibold text-white">Documents</div>
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
          {MOCK_DOCS.map((d) => (
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
    </div>
  );
}

// Chunk Drawer Component from VisualMock v1
const MOCK_CHUNKS = [
  { text: 'Our ICP: B2B SaaS, 50–200 employees, NA/EU, VP Sales/CRO…', labels: ['icp', 'saas', 'vp_sales'], confidence: 0.92 },
  { text: 'Competitors: HubSpot, Apollo; we win on personalization at scale…', labels: ['competitive'], confidence: 0.81 },
];

function ChunkDrawer() {
  const [open, setOpen] = useState(false);
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg">
      <div className="px-4 py-3 border-b border-gray-700 flex items-center justify-between">
        <div className="font-semibold text-white">Chunks</div>
        <button 
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors" 
          onClick={() => setOpen(!open)}
        >
          {open ? 'Close' : 'Open'}
        </button>
      </div>
      {open && (
        <div className="p-4 space-y-3 max-h-72 overflow-auto">
          {MOCK_CHUNKS.map((c, i) => (
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
          ))}
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Product Suite Overview 2024.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 2 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Service Capabilities Matrix.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 5 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Pricing Guide Q4 2024.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 week ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">HubSpot vs Our Platform Battlecard.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 3 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Market Analysis Q4 2024.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 week ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Win-Loss Analysis Report.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 2 weeks ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Cold Email Templates - High Response.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 day ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">LinkedIn Outreach Sequences.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 4 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Objection Handling Scripts.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 6 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Brand Voice & Style Guide 2024.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 3 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">C-Level Communication Framework.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 week ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Technical vs Business Language Guide.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 2 weeks ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
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
                  <div className="space-y-2">
                    <div className="bg-gray-600 border border-gray-500 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm">Sent Email Archive Q4 2024.txt</div>
                        <div className="text-gray-300 text-xs">142 emails analyzed • Tone: Professional, direct</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400 text-xs">✓ Analyzed</span>
                        <button className="text-gray-400 hover:text-white">
                          <FileText size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-600 border border-gray-500 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm">LinkedIn Articles Export.pdf</div>
                        <div className="text-gray-300 text-xs">8 articles analyzed • Tone: Thought leadership, analytical</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-green-400 text-xs">✓ Analyzed</span>
                        <button className="text-gray-400 hover:text-white">
                          <FileText size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="bg-gray-600 border border-gray-500 rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <div className="text-white text-sm">Newsletter Archive 2024.txt</div>
                        <div className="text-gray-300 text-xs">24 newsletters analyzed • Tone: Conversational, expert</div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-400 text-xs">⏳ Processing</span>
                        <button className="text-gray-400 hover:text-white">
                          <FileText size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Style Analysis Results */}
              <div className="mt-6 bg-gray-600 border border-gray-500 rounded-lg p-4">
                <h4 className="text-white font-medium mb-3 flex items-center">
                  <TrendingUp className="mr-2" size={16} />
                  Detected Writing Style
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="text-center">
                    <div className="text-white font-medium">Formality</div>
                    <div className="text-gray-300">Professional</div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                      <div className="bg-blue-500 h-2 rounded-full" style={{width: '75%'}}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium">Directness</div>
                    <div className="text-gray-300">High</div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                      <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium">Warmth</div>
                    <div className="text-gray-300">Moderate</div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                      <div className="bg-yellow-500 h-2 rounded-full" style={{width: '60%'}}></div>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-medium">Technical</div>
                    <div className="text-gray-300">High</div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                      <div className="bg-purple-500 h-2 rounded-full" style={{width: '80%'}}></div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-500">
                  <h5 className="text-white text-sm font-medium mb-2">Key Phrases & Patterns</h5>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">"Let's discuss"</span>
                    <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">"Quick question"</span>
                    <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">"I'd like to explore"</span>
                    <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">"Happy to connect"</span>
                    <span className="bg-gray-700 text-gray-200 px-2 py-1 rounded text-xs">"Best regards"</span>
                  </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Company Overview & Mission 2024.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 day ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Leadership Team Profiles.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 4 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Partnership Ecosystem Guide.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 week ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Fortune 500 Implementation Case Study.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 2 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">SaaS Startup 300% Growth Story.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 5 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Customer Testimonials Q4 2024.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 week ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Enterprise Buying Journey Map.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 day ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Stakeholder Decision Matrix.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 3 days ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Procurement Process Guide.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 1 week ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Budget Approval Workflows by Company Size.pdf</div>
                      <div className="text-gray-400 text-xs">Uploaded 2 weeks ago • Processed ✓</div>
                    </div>
                    <button className="text-gray-400 hover:text-white">
                      <FileText size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mt-4">
                  <h4 className="text-white font-medium mb-3">Quick Decision Framework</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-300">Awareness → Interest:</span>
                      <span className="text-white">2-4 weeks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Evaluation → Decision:</span>
                      <span className="text-white">4-8 weeks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Approval → Purchase:</span>
                      <span className="text-white">2-6 weeks</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-300">Key Stakeholders:</span>
                      <span className="text-white">3-7 people</span>
                    </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">GDPR Compliance Guidelines.pdf</div>
                      <div className="text-gray-400 text-xs">EU data protection rules • Processed ✓</div>
                    </div>
                    <span className="text-red-400 text-xs">Critical</span>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">HIPAA Healthcare Restrictions.pdf</div>
                      <div className="text-gray-400 text-xs">Healthcare industry rules • Processed ✓</div>
                    </div>
                    <span className="text-red-400 text-xs">Critical</span>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-white text-sm">Financial Services SEC Guidelines.pdf</div>
                      <div className="text-gray-400 text-xs">Finance industry compliance • Processed ✓</div>
                    </div>
                    <span className="text-yellow-400 text-xs">Important</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">HITL Checkpoints</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    <span className="text-gray-300">Financial claims or promises</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
                    <span className="text-gray-300">Healthcare/medical references</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    <span className="text-gray-300">Competitor mentions</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                    <span className="text-gray-300">Pricing discussions</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-gray-300">General outreach</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-gray-300">Follow-up messages</span>
                  </div>
                </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">"We already use Apollo/HubSpot"</div>
                    <div className="text-gray-400 text-xs">Tool comparison rebuttals • 89% success rate</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">"We'll just hire more SDRs"</div>
                    <div className="text-gray-400 text-xs">Cost/efficiency comparison • 76% success rate</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">"Not interested right now"</div>
                    <div className="text-gray-400 text-xs">Timing and value reframe • 82% success rate</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3 flex items-center">
                <TrendingUp className="mr-2" size={16} />
                Top Objection Categories
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Budget/Cost Concerns</span>
                    <span className="text-white">34%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Existing Tool Satisfaction</span>
                    <span className="text-white">28%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Timing/Priority Issues</span>
                    <span className="text-white">22%</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Decision Authority</span>
                    <span className="text-white">16%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Technical Concerns</span>
                    <span className="text-white">12%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-300">Previous Bad Experience</span>
                    <span className="text-white">8%</span>
                  </div>
                </div>
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
                <div className="space-y-2">
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">SAM AI Pricing Tiers 2024.pdf</div>
                    <div className="text-gray-400 text-xs">Startup/SME/Enterprise packages • Processed ✓</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">ROI vs SDR Cost Comparison.pdf</div>
                    <div className="text-gray-400 text-xs">Cost justification calculator • Processed ✓</div>
                  </div>
                  <div className="bg-gray-700 border border-gray-600 rounded-lg p-3">
                    <div className="text-white text-sm font-medium">Add-on Services Menu.pdf</div>
                    <div className="text-gray-400 text-xs">Data enrichment, custom builds • Processed ✓</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Startup Package</h4>
                <div className="text-2xl font-bold text-green-400 mb-2">$99/mo</div>
                <div className="space-y-1 text-sm text-gray-300">
                  <div>• 2K contacts</div>
                  <div>• Basic AI features</div>
                  <div>• Email integration</div>
                  <div>• Standard support</div>
                </div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">SME Package</h4>
                <div className="text-2xl font-bold text-blue-400 mb-2">$399/mo</div>
                <div className="space-y-1 text-sm text-gray-300">
                  <div>• 10K contacts</div>
                  <div>• Advanced AI features</div>
                  <div>• LinkedIn + Email</div>
                  <div>• Priority support</div>
                </div>
              </div>
              <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                <h4 className="text-white font-medium mb-2">Enterprise Package</h4>
                <div className="text-2xl font-bold text-purple-400 mb-2">$899/mo</div>
                <div className="space-y-1 text-sm text-gray-300">
                  <div>• 30K contacts</div>
                  <div>• Complete platform</div>
                  <div>• All integrations</div>
                  <div>• Dedicated support</div>
                </div>
              </div>
            </div>

            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
              <h4 className="text-white font-medium mb-3">ROI Comparison vs Traditional SDR</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-300 mb-2">Traditional SDR Costs (Annual)</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Salary + Benefits:</span>
                      <span className="text-white">$65,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tools & Software:</span>
                      <span className="text-white">$12,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Training & Onboarding:</span>
                      <span className="text-white">$8,000</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-300">Total:</span>
                      <span className="text-red-400">$85,000</span>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-gray-300 mb-2">SAM AI (Annual)</div>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Platform Subscription:</span>
                      <span className="text-white">$10,800</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Setup & Training:</span>
                      <span className="text-white">$2,000</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Ongoing Support:</span>
                      <span className="text-white">$1,200</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span className="text-gray-300">Total:</span>
                      <span className="text-green-400">$14,000</span>
                    </div>
                  </div>
                </div>
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