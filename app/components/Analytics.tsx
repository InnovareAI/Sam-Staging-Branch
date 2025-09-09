'use client';

import React from 'react';
import { BarChart3, TrendingUp, Users, Mail, Target, Clock } from 'lucide-react';

const Analytics: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-gray-400">Performance metrics, insights, and optimization recommendations</p>
      </div>

      {/* Coming Soon Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <BarChart3 size={64} className="mx-auto mb-6 text-purple-500 opacity-50" />
          <h2 className="text-2xl font-bold text-white mb-4">Analytics Dashboard</h2>
          <p className="text-gray-400 mb-8">
            Comprehensive analytics including readiness scores, campaign performance, reply rates, and agent performance metrics.
          </p>
          
          {/* Preview Analytics Cards */}
          <div className="grid grid-cols-2 gap-4 text-left">
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <TrendingUp size={24} className="text-green-400" />
              <div className="text-center">
                <h3 className="text-white font-medium">Conversion Rates</h3>
                <p className="text-gray-400 text-sm">Track lead-to-customer conversion</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Mail size={24} className="text-blue-400" />
              <div className="text-center">
                <h3 className="text-white font-medium">Email Performance</h3>
                <p className="text-gray-400 text-sm">Open rates, click-through, replies</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Target size={24} className="text-purple-400" />
              <div className="text-center">
                <h3 className="text-white font-medium">Lead Scoring</h3>
                <p className="text-gray-400 text-sm">Readiness and quality metrics</p>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-gray-800 rounded-lg border border-gray-700">
              <Clock size={24} className="text-orange-400" />
              <div className="text-center">
                <h3 className="text-white font-medium">Response Times</h3>
                <p className="text-gray-400 text-sm">Agent and automation speed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;