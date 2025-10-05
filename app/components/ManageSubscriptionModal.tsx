'use client';

import React from 'react';
import { X, CreditCard, FileText, ExternalLink } from 'lucide-react';

interface ManageSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

export function ManageSubscriptionModal({ isOpen, onClose, workspaceId, workspaceName }: ManageSubscriptionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Manage Subscription</h2>
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
            View your subscription details, update payment methods, and access billing history. Manage your plan and invoices.
          </p>

          {/* Subscription Information */}
          <div className="bg-gray-700 rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-3">Subscription Information</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Plan:</span>
                <span className="text-white font-medium">Enterprise Plan</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="text-green-400 font-medium">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Billing Cycle:</span>
                <span className="text-white">Monthly</span>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            {/* Stripe Customer Portal */}
            <a
              href={`/api/stripe/create-portal-session?workspace_id=${workspaceId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <CreditCard className="text-blue-400 group-hover:text-blue-300" size={20} />
                <div>
                  <div className="text-white font-medium">Stripe Customer Portal</div>
                  <div className="text-gray-400 text-sm">Manage payment methods and subscription</div>
                </div>
              </div>
              <ExternalLink className="text-gray-400 group-hover:text-gray-300" size={16} />
            </a>

            {/* View Invoices */}
            <a
              href={`/workspace/${workspaceId}/invoices`}
              className="flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors group"
            >
              <div className="flex items-center space-x-3">
                <FileText className="text-purple-400 group-hover:text-purple-300" size={20} />
                <div>
                  <div className="text-white font-medium">View Invoices</div>
                  <div className="text-gray-400 text-sm">Access your billing history and invoices</div>
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
