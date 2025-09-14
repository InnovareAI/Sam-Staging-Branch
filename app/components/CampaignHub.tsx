'use client';

import { useState } from 'react';
import { Plus, Play, Pause, BarChart3, Users, Mail } from 'lucide-react';

// Campaign List Component from v1
const MOCK_CAMPAIGNS = [
  { id: 'c1', name: 'VP Sales (SaaS, NA)', status: 'draft' as const, sent: 0, opened: 0, replied: 0 },
  { id: 'c2', name: 'Founders (Consulting, EU)', status: 'active' as const, sent: 47, opened: 23, replied: 5 },
  { id: 'c3', name: 'CTOs (Fintech, Global)', status: 'paused' as const, sent: 132, opened: 61, replied: 12 }
];

function CampaignList() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-900/20';
      case 'paused': return 'text-yellow-400 bg-yellow-900/20';
      case 'draft': return 'text-muted-foreground bg-muted/20';
      default: return 'text-muted-foreground bg-muted/20';
    }
  };

  return (
    <div className="space-y-3">
      {MOCK_CAMPAIGNS.map(c => (
        <div key={c.id} className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="text-white font-medium">{c.name}</h3>
              <span className={`text-xs uppercase px-2 py-1 rounded ${getStatusColor(c.status)}`}>
                {c.status}
              </span>
            </div>
            <div className="flex gap-2">
              {c.status === 'active' ? (
                <button className="p-2 text-yellow-400 hover:bg-gray-700 rounded">
                  <Pause size={16} />
                </button>
              ) : (
                <button className="p-2 text-green-400 hover:bg-gray-700 rounded">
                  <Play size={16} />
                </button>
              )}
              <button className="p-2 text-blue-400 hover:bg-gray-700 rounded">
                <BarChart3 size={16} />
              </button>
            </div>
          </div>
          
          {c.status !== 'draft' && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="text-center">
                <div className="text-white font-medium">{c.sent}</div>
                <div className="text-gray-400">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-white font-medium">{c.opened}</div>
                <div className="text-gray-400">Opened</div>
              </div>
              <div className="text-center">
                <div className="text-white font-medium">{c.replied}</div>
                <div className="text-gray-400">Replied</div>
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
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg space-y-4">
      <h3 className="font-semibold text-white">New Campaign</h3>
      <input 
        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none" 
        value={name} 
        onChange={e => setName(e.target.value)} 
        placeholder="Campaign name..."
      />
      <button 
        onClick={submit} 
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
      >
        Create Draft
      </button>
    </div>
  );
}

const CampaignHub: React.FC = () => {
  const [showBuilder, setShowBuilder] = useState(false);

  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Campaign Hub</h1>
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

      <div className="max-w-4xl space-y-6">
        {/* Campaign Builder */}
        {showBuilder && (
          <div className="mb-6">
            <CampaignBuilder />
          </div>
        )}

        {/* Campaign List */}
        <div>
          <h2 className="text-xl font-semibold text-white mb-4">Active Campaigns</h2>
          <CampaignList />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail size={24} className="text-blue-400" />
              <div>
                <div className="text-2xl font-bold text-white">179</div>
                <div className="text-gray-400 text-sm">Total Sent</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <BarChart3 size={24} className="text-green-400" />
              <div>
                <div className="text-2xl font-bold text-white">84</div>
                <div className="text-gray-400 text-sm">Opened</div>
              </div>
            </div>
          </div>
          <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg">
            <div className="flex items-center gap-3">
              <Users size={24} className="text-purple-400" />
              <div>
                <div className="text-2xl font-bold text-white">17</div>
                <div className="text-gray-400 text-sm">Replies</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignHub;