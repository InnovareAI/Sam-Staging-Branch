'use client';

import { useState } from 'react';
import { TrendingUp } from 'lucide-react';

// Pipeline Board Component - Updated for SAM AI sales stages
const COLUMNS = ['Prospects', 'Positive Replies', 'Demos', 'Closed', 'Lost'] as const;
const MOCK_PIPELINE = {
  Prospects: [
    { id: 'p1', name: 'Acme Inc.', email: 'john@acme.com', status: 'Outbound sent' }, 
    { id: 'p2', name: 'Beta LLC', email: 'sarah@beta.com', status: 'Follow-up #2' },
    { id: 'p3', name: 'Gamma Corp', email: 'mike@gamma.com', status: 'Initial outreach' }
  ],
  'Positive Replies': [
    { id: 'pr1', name: 'CoreTech', email: 'david@coretech.com', status: 'Interested - scheduling' },
    { id: 'pr2', name: 'InnovateCo', email: 'lisa@innovate.com', status: 'Budget confirmed' }
  ],
  Demos: [
    { id: 'd1', name: 'DeltaWorks', email: 'alex@delta.com', status: 'Demo scheduled' },
    { id: 'd2', name: 'FutureTech', email: 'jane@future.com', status: 'Follow-up demo' }
  ],
  Closed: [
    { id: 'c1', name: 'Everest Solutions', email: 'tom@everest.com', status: 'Won - $50k' }
  ],
  Lost: [
    { id: 'l1', name: 'Phoenix Inc', email: 'emma@phoenix.com', status: 'Lost - no budget' },
    { id: 'l2', name: 'Alpha Corp', email: 'sam@alpha.com', status: 'Lost - competitor chosen' }
  ],
};

type PipelineCard = { id: string; name: string; email: string; status: string };
type PipelineData = Record<typeof COLUMNS[number], PipelineCard[]>;

function PipelineBoard() {
  const [cols, setCols] = useState<PipelineData>(MOCK_PIPELINE);
  
  const move = (from: string, to: string, idx: number) => {
    const item = cols[from as keyof PipelineData][idx];
    const newCols = { ...cols };
    newCols[from as keyof PipelineData] = newCols[from as keyof PipelineData].filter((_, i) => i !== idx);
    newCols[to as keyof PipelineData] = [...newCols[to as keyof PipelineData], item];
    setCols(newCols);
  };

  // Column color scheme: replies=orange, demos=blue, closed=green, lost=red
  const getColumnColor = (column: string) => {
    switch (column) {
      case 'Prospects':
        return 'border-gray-500 bg-gray-800';
      case 'Positive Replies':
        return 'border-orange-500 bg-orange-900/20';
      case 'Demos':
        return 'border-blue-500 bg-blue-900/20';
      case 'Closed':
        return 'border-green-500 bg-green-900/20';
      case 'Lost':
        return 'border-red-500 bg-red-900/20';
      default:
        return 'border-gray-500 bg-gray-800';
    }
  };

  const getColumnHeaderColor = (column: string) => {
    switch (column) {
      case 'Prospects':
        return 'text-gray-300';
      case 'Positive Replies':
        return 'text-orange-400';
      case 'Demos':
        return 'text-blue-400';
      case 'Closed':
        return 'text-green-400';
      case 'Lost':
        return 'text-red-400';
      default:
        return 'text-gray-300';
    }
  };
  
  return (
    <div className="grid grid-cols-5 gap-4">
      {COLUMNS.map(col => (
        <div key={col} className={`${getColumnColor(col)} border-2 rounded-lg p-4`}>
          <div className={`font-semibold mb-4 ${getColumnHeaderColor(col)} text-center`}>{col}</div>
          <div className="space-y-3">
            {cols[col]?.map((card: PipelineCard, i: number) => (
              <div key={card.id} className="p-4 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-650 transition-colors">
                <div className="text-sm text-white font-medium mb-1">{card.name}</div>
                <div className="text-xs text-gray-300 mb-2">{card.email}</div>
                <div className="text-xs text-purple-300 mb-3 font-medium">{card.status}</div>
                <div className="flex gap-1 flex-wrap">
                  {COLUMNS.filter(c => c !== col).map(target => (
                    <button 
                      key={target} 
                      onClick={() => move(col, target, i)} 
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs transition-colors"
                    >
                      {target === 'Positive Replies' ? 'Replies' : target}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const LeadPipeline: React.FC = () => {
  return (
    <div className="flex-1 bg-background p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
          <TrendingUp className="mr-3" size={32} />
          Lead Pipeline
        </h1>
        <p className="text-gray-400">Track prospects through outreach, replies, demos, and closure</p>
      </div>

      {/* Pipeline Board */}
      <div className="max-w-7xl">
        <PipelineBoard />
      </div>
    </div>
  );
};

export default LeadPipeline;