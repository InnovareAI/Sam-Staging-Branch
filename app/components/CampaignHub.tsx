'use client';

import { useState } from 'react';
import { Plus, Play, Pause, BarChart3, Users, Mail, Megaphone, Target, TrendingUp, Calendar, Settings, Eye, MessageSquare, Zap, FileText, Edit, Copy, Send, Clock, CheckCircle, XCircle } from 'lucide-react';

// Campaign List Component from v1
const MOCK_CAMPAIGNS = [
  { id: 'c1', name: 'VP Sales (SaaS, NA)', status: 'draft' as const, sent: 0, opened: 0, replied: 0 },
  { id: 'c2', name: 'Founders (Consulting, EU)', status: 'active' as const, sent: 47, opened: 23, replied: 5 },
  { id: 'c3', name: 'CTOs (Fintech, Global)', status: 'paused' as const, sent: 132, opened: 61, replied: 12 }
];

function CampaignList() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-900/20 border-green-500';
      case 'paused': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500';
      case 'draft': return 'text-gray-400 bg-gray-900/20 border-gray-500';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle size={14} className="text-green-400" />;
      case 'paused': return <Clock size={14} className="text-yellow-400" />;
      case 'draft': return <FileText size={14} className="text-gray-400" />;
      default: return <FileText size={14} className="text-gray-400" />;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {MOCK_CAMPAIGNS.map(c => (
        <div key={c.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-white font-semibold text-lg group-hover:text-white mb-2">{c.name}</h3>
              <div className={`inline-flex items-center gap-2 text-xs uppercase px-3 py-1 rounded-full border ${getStatusColor(c.status)}`}>
                {getStatusIcon(c.status)}
                {c.status}
              </div>
            </div>
            <div className="flex gap-2 ml-4">
              {c.status === 'active' ? (
                <button className="p-2 text-yellow-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors">
                  <Pause size={16} />
                </button>
              ) : (
                <button className="p-2 text-green-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors">
                  <Play size={16} />
                </button>
              )}
              <button className="p-2 text-blue-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors">
                <BarChart3 size={16} />
              </button>
              <button className="p-2 text-purple-400 hover:bg-gray-700 group-hover:bg-purple-500 group-hover:text-white rounded-lg transition-colors">
                <Edit size={16} />
              </button>
            </div>
          </div>
          
          {c.status !== 'draft' && (
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-700 group-hover:border-purple-400">
              <div className="text-center">
                <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.sent}</div>
                <div className="text-gray-400 group-hover:text-purple-100 text-xs">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.opened}</div>
                <div className="text-gray-400 group-hover:text-purple-100 text-xs">Opened</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-white group-hover:text-white mb-1">{c.replied}</div>
                <div className="text-gray-400 group-hover:text-purple-100 text-xs">Replied</div>
              </div>
            </div>
          )}
          
          {c.status === 'draft' && (
            <div className="pt-4 border-t border-gray-700 group-hover:border-purple-400">
              <div className="text-center text-gray-400 group-hover:text-purple-100 text-sm">
                Ready to configure and launch
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// Campaign Builder Component from v1
function CampaignBuilder() {
  const [name, setName] = useState('Outbound – VP Sales (SaaS, NA)');
  
  const submit = async () => {
    alert(`Created draft campaign: ${name}`);
  };
  
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group">
      <div className="flex items-center mb-4">
        <Plus className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
        <h3 className="text-lg font-semibold text-white group-hover:text-white">New Campaign</h3>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 group-hover:text-purple-100 mb-2">
            Campaign Name
          </label>
          <input 
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none group-hover:bg-purple-500 group-hover:border-purple-400 transition-colors" 
            value={name} 
            onChange={e => setName(e.target.value)} 
            placeholder="Enter campaign name..."
          />
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={submit} 
            className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 group-hover:bg-purple-500 text-white rounded-lg transition-colors font-medium"
          >
            Create Draft Campaign
          </button>
          <button 
            className="px-4 py-3 bg-gray-700 hover:bg-gray-600 group-hover:bg-purple-500 text-gray-300 group-hover:text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const CampaignHub: React.FC = () => {
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
            <Megaphone className="mr-3" size={32} />
            Campaign Hub
          </h1>
          <p className="text-gray-400">Design, approve, and launch marketing campaigns</p>
        </div>
        <button
          onClick={() => setShowBuilder(!showBuilder)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          New Campaign
        </button>
      </div>

      <div className="max-w-6xl space-y-8">
        {/* Campaign Builder */}
        {showBuilder && (
          <div className="mb-6">
            <CampaignBuilder />
          </div>
        )}

        {/* Campaign Management Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center mb-4">
              <Edit className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
              <h3 className="text-lg font-semibold text-white group-hover:text-white">Template Library</h3>
            </div>
            <p className="text-gray-400 group-hover:text-purple-100 mb-4">Browse and customize proven email and LinkedIn message templates</p>
            <div className="text-xs text-purple-300 group-hover:text-purple-200">15 templates available</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center mb-4">
              <Copy className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
              <h3 className="text-lg font-semibold text-white group-hover:text-white">Campaign Cloning</h3>
            </div>
            <p className="text-gray-400 group-hover:text-purple-100 mb-4">Duplicate successful campaigns with new target audiences</p>
            <div className="text-xs text-purple-300 group-hover:text-purple-200">Clone with variations</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center mb-4">
              <Send className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
              <h3 className="text-lg font-semibold text-white group-hover:text-white">Campaign Messaging Approval</h3>
            </div>
            <p className="text-gray-400 group-hover:text-purple-100 mb-4">Review and approve campaign messaging before launch</p>
            <div className="text-xs text-purple-300 group-hover:text-purple-200">Message approval workflow</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center mb-4">
              <Clock className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
              <h3 className="text-lg font-semibold text-white group-hover:text-white">Scheduled Campaigns</h3>
            </div>
            <p className="text-gray-400 group-hover:text-purple-100 mb-4">Schedule campaigns for optimal timing and frequency</p>
            <div className="text-xs text-purple-300 group-hover:text-purple-200">Smart timing optimization</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center mb-4">
              <Target className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
              <h3 className="text-lg font-semibold text-white group-hover:text-white">A/B Testing Hub</h3>
            </div>
            <p className="text-gray-400 group-hover:text-purple-100 mb-4">Test subject lines, messaging, and timing for optimization</p>
            <div className="text-xs text-purple-300 group-hover:text-purple-200">Split test management</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center mb-4">
              <Settings className="text-blue-400 mr-3 group-hover:scale-110 transition-transform" size={24} />
              <h3 className="text-lg font-semibold text-white group-hover:text-white">Campaign Settings</h3>
            </div>
            <p className="text-gray-400 group-hover:text-purple-100 mb-4">Configure global campaign preferences and defaults</p>
            <div className="text-xs text-purple-300 group-hover:text-purple-200">Global configuration</div>
          </div>
        </div>

        {/* Campaign List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Active Campaigns</h2>
          <CampaignList />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Mail className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <CheckCircle className="text-green-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">179</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Total Messages Sent</div>
            <div className="text-xs text-green-300">↑ 12% from last week</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <Eye className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <TrendingUp className="text-orange-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">84</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Messages Opened</div>
            <div className="text-xs text-orange-300">47% open rate</div>
          </div>
          
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-left transition-all duration-300 hover:scale-105 hover:shadow-xl hover:bg-purple-600 hover:border-purple-500 hover:shadow-purple-500/20 group cursor-pointer">
            <div className="flex items-center justify-between mb-4">
              <MessageSquare className="text-blue-400 group-hover:scale-110 transition-transform" size={24} />
              <Users className="text-purple-400" size={16} />
            </div>
            <div className="text-3xl font-bold text-white mb-2">17</div>
            <div className="text-gray-400 group-hover:text-purple-100 text-sm mb-1">Positive Replies</div>
            <div className="text-xs text-purple-300">9.5% reply rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignHub;