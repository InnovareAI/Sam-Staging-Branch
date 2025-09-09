'use client';

import React from 'react';
import { Megaphone, Plus, Calendar, Send, BarChart3 } from 'lucide-react';

const CampaignHub: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Campaign Hub</h1>
        <p className="text-gray-400">Design, approve, and launch marketing campaigns</p>
      </div>

      {/* Coming Soon Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <Megaphone size={64} className="mx-auto mb-6 text-purple-500 opacity-50" />
          <h2 className="text-2xl font-bold text-white mb-4">Campaign Hub</h2>
          <p className="text-gray-400 mb-8">
            Advanced campaign management tools will be available here. Create targeted outreach campaigns with AI-generated content and automated follow-ups.
          </p>
          
          {/* Preview Features */}
          <div className="grid grid-cols-1 gap-4 text-left">
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Plus size={20} className="text-purple-400" />
              <div>
                <h3 className="text-white font-medium">Campaign Builder</h3>
                <p className="text-gray-400 text-sm">Create multi-step campaigns with AI assistance</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Calendar size={20} className="text-blue-400" />
              <div>
                <h3 className="text-white font-medium">Schedule & Automate</h3>
                <p className="text-gray-400 text-sm">Set up automated sequences and timing</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <BarChart3 size={20} className="text-green-400" />
              <div>
                <h3 className="text-white font-medium">Performance Tracking</h3>
                <p className="text-gray-400 text-sm">Real-time metrics and optimization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignHub;