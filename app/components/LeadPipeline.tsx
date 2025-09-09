'use client';

import React from 'react';
import { TrendingUp, Users, Target, CheckCircle, Clock } from 'lucide-react';

const LeadPipeline: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Lead Pipeline</h1>
        <p className="text-gray-400">Track prospects from discovery to opportunities</p>
      </div>

      {/* Coming Soon Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <TrendingUp size={64} className="mx-auto mb-6 text-purple-500 opacity-50" />
          <h2 className="text-2xl font-bold text-white mb-4">Lead Pipeline</h2>
          <p className="text-gray-400 mb-8">
            Comprehensive pipeline management with enrichment status, lead scoring, and next action recommendations.
          </p>
          
          {/* Preview Pipeline Stages */}
          <div className="grid grid-cols-1 gap-4 text-left">
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Target size={20} className="text-blue-400" />
              <div>
                <h3 className="text-white font-medium">Discovery</h3>
                <p className="text-gray-400 text-sm">Lead identification and initial outreach</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Users size={20} className="text-yellow-400" />
              <div>
                <h3 className="text-white font-medium">Qualified</h3>
                <p className="text-gray-400 text-sm">Engaged prospects with confirmed interest</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Clock size={20} className="text-orange-400" />
              <div>
                <h3 className="text-white font-medium">Opportunity</h3>
                <p className="text-gray-400 text-sm">Active deals in negotiation</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <CheckCircle size={20} className="text-green-400" />
              <div>
                <h3 className="text-white font-medium">Closed Won</h3>
                <p className="text-gray-400 text-sm">Successfully converted customers</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadPipeline;