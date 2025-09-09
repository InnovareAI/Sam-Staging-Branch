'use client';

import { useState } from 'react';

// Pipeline Board Component from v1
const COLUMNS = ['Prospects', 'Qualified', 'Opportunities', 'Closed'] as const;
const MOCK_PIPELINE = {
  Prospects: [{ id: 'p1', name: 'Acme Inc.' }, { id: 'p2', name: 'Beta LLC' }],
  Qualified: [{ id: 'q1', name: 'CoreTech' }],
  Opportunities: [{ id: 'o1', name: 'DeltaWorks' }],
  Closed: [{ id: 'c1', name: 'Everest' }],
};

type PipelineCard = { id: string; name: string };
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
  
  return (
    <div className="grid grid-cols-4 gap-4">
      {COLUMNS.map(col => (
        <div key={col} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="font-semibold mb-4 text-white text-center">{col}</div>
          <div className="space-y-3">
            {cols[col]?.map((card: PipelineCard, i: number) => (
              <div key={card.id} className="p-3 bg-gray-700 border border-gray-600 rounded-lg">
                <div className="text-sm text-white font-medium mb-2">{card.name}</div>
                <div className="flex gap-1 flex-wrap">
                  {COLUMNS.filter(c => c !== col).map(target => (
                    <button 
                      key={target} 
                      onClick={() => move(col, target, i)} 
                      className="px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-200 rounded text-xs transition-colors"
                    >
                      {target}
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
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Lead Pipeline</h1>
        <p className="text-gray-400">Track prospects from discovery to opportunities</p>
      </div>

      {/* Pipeline Board */}
      <div className="max-w-7xl">
        <PipelineBoard />
      </div>
    </div>
  );
};

export default LeadPipeline;