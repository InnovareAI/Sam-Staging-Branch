'use client';

import React, { useState } from 'react';
import { X, Settings, CreditCard } from 'lucide-react';

interface WorkspaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export function WorkspaceSettingsModal({ isOpen, onClose, workspaceId, workspaceName }: WorkspaceSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Settings size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Workspace Settings</h2>
              <p className="text-gray-400 text-sm">{workspaceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-300 text-sm leading-relaxed mb-6">
            Configure workspace details, billing plans, and advanced settings. Manage your workspace name, branding, and subscription.
          </p>

          {/* Settings Options */}
          <div className="space-y-3">
            {/* General Settings */}
            <a
              href={`/workspace/${workspaceId}/settings?tab=general`}
              className="flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <Settings className="text-purple-400 group-hover:text-purple-300" size={20} />
                <div>
                  <div className="text-white font-medium">General Settings</div>
                  <div className="text-gray-400 text-sm">Configure workspace name and basic details</div>
                </div>
              </div>
              <svg className="text-gray-400 group-hover:translate-x-1 transition-transform" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6"/>
              </svg>
            </a>
          </div>

          {/* Close Button */}
          <div className="mt-6">
            <button
              onClick={onClose}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
