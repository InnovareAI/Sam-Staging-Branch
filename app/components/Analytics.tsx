'use client';

import React from 'react';

// KPI Grid Component from v1
function KPIGrid() {
  const cards = [
    { label: 'Readiness', value: '82%' },
    { label: 'Reply Rate', value: '9.8%' },
    { label: 'Meetings / Mo', value: '34' },
    { label: 'ROI (90d)', value: '9.6x' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="p-6 bg-gray-800 border border-gray-700 rounded-lg">
          <div className="text-xs uppercase text-gray-400 mb-2">{c.label}</div>
          <div className="text-3xl font-semibold text-white">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

const Analytics: React.FC = () => {
  return (
    <div className="flex-1 bg-gray-900 p-6 overflow-y-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics</h1>
        <p className="text-gray-400">Performance metrics, insights, and optimization recommendations</p>
      </div>

      {/* KPI Grid */}
      <div className="max-w-6xl">
        <KPIGrid />
      </div>
    </div>
  );
};

export default Analytics;