'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, ExternalLink, Settings, Loader2, AlertCircle } from 'lucide-react';

interface CRMIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

type CRMType = 'hubspot' | 'salesforce' | 'pipedrive' | 'zoho' | 'activecampaign' | 'keap' | 'close' | 'copper' | 'freshsales' | 'airtable' | 'google_sheets';

interface CRMOption {
  type: CRMType;
  name: string;
  logo: string;
  description: string;
  features: string[];
}

const CRM_OPTIONS: CRMOption[] = [
  {
    type: 'hubspot',
    name: 'HubSpot',
    logo: '🟠',
    description: 'Popular all-in-one CRM and marketing platform',
    features: ['Contacts & Companies', 'Deals & Pipelines', 'Custom Properties']
  },
  {
    type: 'salesforce',
    name: 'Salesforce',
    logo: '☁️',
    description: 'World\'s leading enterprise CRM solution',
    features: ['Accounts & Contacts', 'Opportunities', 'Custom Objects']
  },
  {
    type: 'pipedrive',
    name: 'Pipedrive',
    logo: '🔵',
    description: 'Sales-focused CRM built for teams',
    features: ['Persons & Organizations', 'Deals', 'Activities']
  },
  {
    type: 'zoho',
    name: 'Zoho CRM',
    logo: '🟡',
    description: 'Comprehensive business CRM suite',
    features: ['Contacts & Accounts', 'Deals', 'Custom Modules']
  },
  {
    type: 'activecampaign',
    name: 'ActiveCampaign',
    logo: '🔷',
    description: 'Marketing automation with CRM',
    features: ['Contacts', 'Deals & Pipelines', 'Automation']
  },
  {
    type: 'keap',
    name: 'Keap (Infusionsoft)',
    logo: '🟢',
    description: 'CRM and automation for small business',
    features: ['Contacts & Companies', 'Opportunities', 'Campaigns']
  },
  {
    type: 'close',
    name: 'Close',
    logo: '🔴',
    description: 'CRM built for inside sales teams',
    features: ['Leads & Contacts', 'Opportunities', 'Communication']
  },
  {
    type: 'copper',
    name: 'Copper',
    logo: '🟤',
    description: 'Google Workspace-native CRM',
    features: ['People & Companies', 'Opportunities', 'Gmail Integration']
  },
  {
    type: 'freshsales',
    name: 'Freshsales',
    logo: '🟣',
    description: 'AI-powered CRM from Freshworks',
    features: ['Contacts & Accounts', 'Deals', 'Freddy AI']
  },
  {
    type: 'airtable',
    name: 'Airtable',
    logo: '📊',
    description: 'Flexible database and project management',
    features: ['Custom Tables', 'Rich Fields', 'Automation']
  },
  {
    type: 'google_sheets',
    name: 'Google Sheets',
    logo: '📗',
    description: 'Simple spreadsheet-based lead tracking',
    features: ['Custom Columns', 'Real-time Sync', 'Easy Export']
  }
];

export function CRMIntegrationModal({ isOpen, onClose, workspaceId, workspaceName }: CRMIntegrationModalProps) {
  const [connectedCRMs, setConnectedCRMs] = useState<Set<CRMType>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCRM, setSelectedCRM] = useState<CRMType | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConnectedCRMs();
    }
  }, [isOpen, workspaceId]);

  async function fetchConnectedCRMs() {
    try {
      const response = await fetch(`/api/crm/connections?workspace_id=${workspaceId}`);
      if (response.ok) {
        const data = await response.json();
        setConnectedCRMs(new Set(data.connections.map((c: any) => c.crm_type)));
      }
    } catch (err) {
      console.error('Error fetching CRM connections:', err);
    }
  }

  async function initiateOAuth(crmType: CRMType) {
    setLoading(true);
    setError(null);
    setSelectedCRM(crmType);

    try {
      const response = await fetch('/api/crm/oauth/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          crm_type: crmType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const data = await response.json();

      // Redirect to OAuth provider
      window.location.href = data.auth_url;

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect CRM');
      setLoading(false);
      setSelectedCRM(null);
    }
  }

  async function disconnectCRM(crmType: CRMType) {
    if (!confirm(`Are you sure you want to disconnect ${CRM_OPTIONS.find(c => c.type === crmType)?.name}?`)) {
      return;
    }

    try {
      const response = await fetch('/api/crm/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          crm_type: crmType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect CRM');
      }

      setConnectedCRMs(prev => {
        const next = new Set(prev);
        next.delete(crmType);
        return next;
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect CRM');
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">CRM Integrations</h2>
            <p className="text-gray-400 text-sm mt-1">
              Connect your CRM to sync contacts, companies, and deals with SAM AI
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-6 mt-4 bg-red-900/20 border border-red-500/30 rounded-lg p-4 flex items-start">
            <AlertCircle className="text-red-400 mr-3 mt-0.5" size={20} />
            <div>
              <p className="text-red-300 font-medium">Connection Error</p>
              <p className="text-red-400/80 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* CRM Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CRM_OPTIONS.map((crm) => {
              const isConnected = connectedCRMs.has(crm.type);
              const isConnecting = loading && selectedCRM === crm.type;

              return (
                <div
                  key={crm.type}
                  className={`bg-gray-700 rounded-lg p-5 border-2 transition-all ${
                    isConnected
                      ? 'border-green-500/50 bg-green-900/10'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {/* CRM Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center">
                      <span className="text-3xl mr-3">{crm.logo}</span>
                      <div>
                        <h3 className="text-white font-semibold text-lg">{crm.name}</h3>
                        {isConnected && (
                          <div className="flex items-center text-green-400 text-sm mt-1">
                            <Check size={14} className="mr-1" />
                            Connected
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-400 text-sm mb-4">{crm.description}</p>

                  {/* Features */}
                  <div className="mb-4">
                    <p className="text-gray-500 text-xs font-medium mb-2">FEATURES</p>
                    <ul className="space-y-1">
                      {crm.features.map((feature, idx) => (
                        <li key={idx} className="text-gray-400 text-sm flex items-center">
                          <span className="text-blue-400 mr-2">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => window.open(`/workspace/${workspaceId}/crm/${crm.type}/settings`, '_blank')}
                          className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                        >
                          <Settings size={16} className="mr-2" />
                          Settings
                        </button>
                        <button
                          onClick={() => disconnectCRM(crm.type)}
                          className="px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-sm font-medium transition-colors"
                        >
                          Disconnect
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => initiateOAuth(crm.type)}
                        disabled={isConnecting}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                      >
                        {isConnecting ? (
                          <>
                            <Loader2 size={16} className="mr-2 animate-spin" />
                            Connecting...
                          </>
                        ) : (
                          <>
                            <ExternalLink size={16} className="mr-2" />
                            Connect
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 bg-gray-750">
          <div className="flex items-start">
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 flex-1">
              <p className="text-blue-300 text-sm">
                <strong>Note:</strong> After connecting, you can configure field mappings to match your CRM's
                custom fields with SAM's data structure. Click "Settings" on any connected CRM to customize.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
