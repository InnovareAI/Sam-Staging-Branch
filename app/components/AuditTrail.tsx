'use client';

import React from 'react';
import { FileText, Clock, Settings } from 'lucide-react';

const AuditTrail: React.FC = () => {
  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="h-8 w-8 text-blue-400" />
          <h1 className="text-2xl font-bold">Audit Trail</h1>
        </div>
        <p className="text-gray-400">
          Track all user activities and system events across your workspace
        </p>
      </div>

      {/* Coming Soon Content */}
      <div className="flex items-center justify-center h-96">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 bg-gray-800 rounded-full flex items-center justify-center">
            <FileText className="h-12 w-12 text-gray-400" />
          </div>
          
          <h2 className="text-xl font-semibold text-white mb-4">Audit Trail Coming Soon</h2>
          
          <p className="text-gray-400 mb-6 leading-relaxed">
            We're building a comprehensive audit trail system to track all user activities, 
            system events, and changes across your workspace. This will help you maintain 
            security, compliance, and transparency.
          </p>
          
          <div className="grid grid-cols-1 gap-4 text-sm">
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <Clock className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-gray-300">Real-time activity tracking</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <Settings className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-gray-300">Compliance reporting</span>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <FileText className="h-4 w-4 text-blue-400 flex-shrink-0" />
              <span className="text-gray-300">Detailed activity logs</span>
            </div>
          </div>
          
          <div className="mt-8 p-4 bg-blue-900/20 border border-blue-800 rounded-lg">
            <p className="text-blue-200 text-sm">
              <strong>Note:</strong> This feature is currently in development and will be available in a future update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditTrail;