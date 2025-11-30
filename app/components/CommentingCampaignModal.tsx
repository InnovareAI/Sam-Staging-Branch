'use client';

import React, { useState, useEffect } from 'react';
import { X, Target, Clock, Settings, User, Building2, Hash } from 'lucide-react';

interface Monitor {
  id: string;
  name?: string;
  hashtags: string[];
  keywords: string[];
  status: string;
  timezone?: string;
  daily_start_time?: string;
  auto_approve_enabled?: boolean;
  auto_approve_start_time?: string;
  auto_approve_end_time?: string;
}

interface CommentingCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  editMode?: boolean;
  existingMonitor?: Monitor;
}

type TargetingMode = 'hashtag' | 'keyword' | 'profile';
type TargetTab = 'profiles' | 'companies' | 'hashtags';

export default function CommentingCampaignModal({ isOpen, onClose, workspaceId, editMode = false, existingMonitor }: CommentingCampaignModalProps) {
  const [campaignName, setCampaignName] = useState('');
  const [targetingMode] = useState<TargetingMode>('profile'); // Only profile targeting supported
  const [activeTab, setActiveTab] = useState<TargetTab>('profiles');
  const [profileTargets, setProfileTargets] = useState<string[]>(['']);
  const [companyTargets, setCompanyTargets] = useState<string[]>(['']);
  const [hashtagTargets, setHashtagTargets] = useState<string[]>(['']);

  const [saving, setSaving] = useState(false);

  // Load existing monitor data in edit mode
  useEffect(() => {
    if (editMode && existingMonitor) {
      // Load campaign name
      if (existingMonitor.name) {
        setCampaignName(existingMonitor.name);
      }

      // Extract profile URLs from hashtags array (format: "PROFILE:vanity_name")
      const profiles = existingMonitor.hashtags
        .filter(tag => tag.startsWith('PROFILE:'))
        .map(tag => `https://linkedin.com/in/${tag.replace('PROFILE:', '')}`);

      if (profiles.length > 0) {
        setProfileTargets(profiles);
        setActiveTab('profiles');
      }

      // Extract company URLs from hashtags array (format: "COMPANY:company_slug")
      const companies = existingMonitor.hashtags
        .filter(tag => tag.startsWith('COMPANY:'))
        .map(tag => `https://linkedin.com/company/${tag.replace('COMPANY:', '')}`);

      if (companies.length > 0) {
        setCompanyTargets(companies);
        setActiveTab('companies');
      }

      // Extract hashtags from hashtags array (format: "HASHTAG:keyword")
      const hashtags = existingMonitor.hashtags
        .filter(tag => tag.startsWith('HASHTAG:'))
        .map(tag => tag.replace('HASHTAG:', ''));

      if (hashtags.length > 0) {
        setHashtagTargets(hashtags);
        setActiveTab('hashtags');
      }
    }
  }, [editMode, existingMonitor]);

  const handleAddTarget = () => {
    if (activeTab === 'profiles') {
      setProfileTargets([...profileTargets, '']);
    } else if (activeTab === 'companies') {
      setCompanyTargets([...companyTargets, '']);
    } else {
      setHashtagTargets([...hashtagTargets, '']);
    }
  };

  const handleTargetChange = (index: number, value: string) => {
    if (activeTab === 'profiles') {
      const newTargets = [...profileTargets];
      newTargets[index] = value;
      setProfileTargets(newTargets);
    } else if (activeTab === 'companies') {
      const newTargets = [...companyTargets];
      newTargets[index] = value;
      setCompanyTargets(newTargets);
    } else {
      const newTargets = [...hashtagTargets];
      newTargets[index] = value;
      setHashtagTargets(newTargets);
    }
  };

  const handleRemoveTarget = (index: number) => {
    if (activeTab === 'profiles') {
      const newTargets = profileTargets.filter((_, i) => i !== index);
      setProfileTargets(newTargets.length > 0 ? newTargets : ['']);
    } else if (activeTab === 'companies') {
      const newTargets = companyTargets.filter((_, i) => i !== index);
      setCompanyTargets(newTargets.length > 0 ? newTargets : ['']);
    } else {
      const newTargets = hashtagTargets.filter((_, i) => i !== index);
      setHashtagTargets(newTargets.length > 0 ? newTargets : ['']);
    }
  };

  const handleCreate = async () => {
    setSaving(true);

    try {
      // Get all targets
      const allProfileTargets = profileTargets.filter(t => t.trim());
      const allCompanyTargets = companyTargets.filter(t => t.trim());
      const allHashtagTargets = hashtagTargets.filter(t => t.trim());
      const validTargets = [...allProfileTargets, ...allCompanyTargets];

      // For hashtag targeting mode, create ONE monitor with ALL hashtags
      if (targetingMode === 'hashtag') {
        const monitor: any = {
          name: campaignName || `Hashtag Monitor - ${new Date().toLocaleDateString()}`,
          hashtags: validTargets.map(t => t.replace(/^#/, '')), // Remove # prefix
          keywords: [],
          status: 'active',
        };

        console.log('📤 Creating hashtag monitor:', monitor);

        const response = await fetch('/api/linkedin-commenting/monitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(monitor),
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            console.error('❌ API Error Details:', error);
            const errorMsg = error.error || error.message || 'Failed to create monitor';
            const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
            const errorHint = error.hint ? `\n\nHint: ${error.hint}` : '';
            throw new Error(errorMsg + errorDetails + errorHint);
          } else {
            const text = await response.text();
            console.error('Non-JSON error response:', text);
            throw new Error(`Server error: ${response.status} ${response.statusText}\n\n${text}`);
          }
        }

        const data = await response.json();
        console.log('✅ Monitor created successfully:', data);
      } else if (targetingMode === 'keyword') {
        // For keyword targeting mode, create ONE monitor with ALL keywords
        const monitor: any = {
          name: campaignName || `Keyword Monitor - ${new Date().toLocaleDateString()}`,
          hashtags: [],
          keywords: validTargets,
          status: 'active',
        };

        console.log('📤 Creating keyword monitor:', monitor);

        const response = await fetch('/api/linkedin-commenting/monitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(monitor),
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            console.error('❌ API Error Details:', error);
            const errorMsg = error.error || error.message || 'Failed to create monitor';
            const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
            const errorHint = error.hint ? `\n\nHint: ${error.hint}` : '';
            throw new Error(errorMsg + errorDetails + errorHint);
          } else {
            const text = await response.text();
            console.error('Non-JSON error response:', text);
            throw new Error(`Server error: ${response.status} ${response.statusText}\n\n${text}`);
          }
        }

        const data = await response.json();
        console.log('✅ Monitor created successfully:', data);
      } else if (targetingMode === 'profile') {
        // For profile targeting mode, create ONE monitor per profile/company
        // Using hashtags array format to store profile/company names (compatible with existing schema)

        // Create monitors for profiles
        for (const target of allProfileTargets) {
          // Extract vanity name from LinkedIn URL or use as-is
          let vanityName = target.trim();
          if (vanityName.includes('linkedin.com/in/')) {
            const match = vanityName.match(/linkedin\.com\/in\/([^\/\?#]+)/);
            if (match) vanityName = match[1];
          }

          const monitor: any = {
            name: campaignName || `Profile Monitor - ${vanityName}`,
            // Store profile as special hashtag format: "PROFILE:vanity_name"
            hashtags: [`PROFILE:${vanityName}`],
            keywords: [],
            status: 'active'
          };

          console.log('📤 Creating profile monitor:', monitor);

          const response = await fetch('/api/linkedin-commenting/monitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(monitor),
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const error = await response.json();
              console.error('❌ API Error Details:', error);
              const errorMsg = error.error || error.message || 'Failed to create monitor';
              const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
              const errorHint = error.hint ? `\n\nHint: ${error.hint}` : '';
              throw new Error(errorMsg + errorDetails + errorHint);
            } else {
              const text = await response.text();
              console.error('Non-JSON error response:', text);
              throw new Error(`Server error: ${response.status} ${response.statusText}\n\n${text}`);
            }
          }

          const data = await response.json();
          console.log('✅ Profile monitor created successfully:', data);
        }

        // Create monitors for company pages
        for (const target of allCompanyTargets) {
          // Extract company slug from LinkedIn URL or use as-is
          let companySlug = target.trim();
          if (companySlug.includes('linkedin.com/company/')) {
            const match = companySlug.match(/linkedin\.com\/company\/([^\/\?#]+)/);
            if (match) companySlug = match[1];
          }

          const monitor: any = {
            name: campaignName || `Company Monitor - ${companySlug}`,
            // Store company as special hashtag format: "COMPANY:company_slug"
            hashtags: [`COMPANY:${companySlug}`],
            keywords: [],
            status: 'active'
          };

          console.log('📤 Creating company monitor:', monitor);

          const response = await fetch('/api/linkedin-commenting/monitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(monitor),
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const error = await response.json();
              console.error('❌ API Error Details:', error);
              const errorMsg = error.error || error.message || 'Failed to create monitor';
              const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
              const errorHint = error.hint ? `\n\nHint: ${error.hint}` : '';
              throw new Error(errorMsg + errorDetails + errorHint);
            } else {
              const text = await response.text();
              console.error('Non-JSON error response:', text);
              throw new Error(`Server error: ${response.status} ${response.statusText}\n\n${text}`);
            }
          }

          const data = await response.json();
          console.log('✅ Company monitor created successfully:', data);
        }

        // Create monitors for hashtags
        for (const target of allHashtagTargets) {
          // Clean up hashtag - remove # prefix if present
          let keyword = target.trim().replace(/^#/, '');
          if (!keyword) continue;

          const monitor: any = {
            name: campaignName || `Hashtag Monitor - #${keyword}`,
            // Store hashtag with special format: "HASHTAG:keyword"
            hashtags: [`HASHTAG:${keyword}`],
            keywords: [],
            status: 'active'
          };

          console.log('📤 Creating hashtag monitor:', monitor);

          const response = await fetch('/api/linkedin-commenting/monitors', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(monitor),
          });

          if (!response.ok) {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const error = await response.json();
              console.error('❌ API Error Details:', error);
              const errorMsg = error.error || error.message || 'Failed to create monitor';
              const errorDetails = error.details ? `\n\nDetails: ${error.details}` : '';
              const errorHint = error.hint ? `\n\nHint: ${error.hint}` : '';
              throw new Error(errorMsg + errorDetails + errorHint);
            } else {
              const text = await response.text();
              console.error('Non-JSON error response:', text);
              throw new Error(`Server error: ${response.status} ${response.statusText}\n\n${text}`);
            }
          }

          const data = await response.json();
          console.log('✅ Hashtag monitor created successfully:', data);
        }
      } else {
        throw new Error('Unknown targeting mode: ' + targetingMode);
      }

      console.log('✅ Campaign created successfully');
      onClose();

      // Refresh the page to show new campaigns
      window.location.reload();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center">
              <Target size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{editMode ? 'Edit Monitor' : 'Add Monitor'}</h2>
              <p className="text-gray-400 text-sm">Monitor LinkedIn profiles, company pages, or hashtags for commenting opportunities</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Tab Switcher */}
          <div className="flex gap-2 p-1 bg-gray-700/50 rounded-lg">
            <button
              onClick={() => setActiveTab('profiles')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                activeTab === 'profiles'
                  ? 'bg-pink-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              <User size={18} />
              <span className="font-medium">Personal Profiles</span>
            </button>
            <button
              onClick={() => setActiveTab('companies')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                activeTab === 'companies'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              <Building2 size={18} />
              <span className="font-medium">Company Pages</span>
            </button>
            <button
              onClick={() => setActiveTab('hashtags')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                activeTab === 'hashtags'
                  ? 'bg-green-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-600'
              }`}
            >
              <Hash size={18} />
              <span className="font-medium">Hashtags</span>
            </button>
          </div>

          {/* LinkedIn Targets to Monitor */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {activeTab === 'profiles'
                ? 'LinkedIn Profiles to Monitor (Max 30)'
                : activeTab === 'companies'
                ? 'LinkedIn Company Pages to Monitor (Max 30)'
                : 'Hashtags to Monitor (Max 10)'
              }
            </label>
            <p className="text-sm text-gray-400 mb-3">
              {activeTab === 'profiles'
                ? 'Enter LinkedIn profile vanity names (e.g., sama, andrewng, ylecun)'
                : activeTab === 'companies'
                ? 'Enter LinkedIn company page URLs or names (e.g., microsoft, google, linkedin.com/company/openai)'
                : 'Enter hashtags to search for posts (e.g., #genAI, #sales, #marketing)'
              }
            </p>
            {(activeTab === 'profiles' ? profileTargets : activeTab === 'companies' ? companyTargets : hashtagTargets).map((target, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={target}
                  onChange={(e) => handleTargetChange(index, e.target.value)}
                  placeholder={activeTab === 'profiles'
                    ? 'e.g., sama, andrewng, or linkedin.com/in/username'
                    : activeTab === 'companies'
                    ? 'e.g., microsoft, openai, or linkedin.com/company/google'
                    : 'e.g., genAI, sales, or #marketing'
                  }
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <button
                  onClick={() => handleRemoveTarget(index)}
                  className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 rounded-lg transition-colors flex items-center gap-1.5 text-sm"
                >
                  <X size={16} />
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={handleAddTarget}
              className="text-sm text-pink-400 hover:text-pink-300 transition-colors"
            >
              + Add another {activeTab === 'profiles' ? 'profile' : activeTab === 'companies' ? 'company page' : 'hashtag'}
            </button>
          </div>

          {/* AI Settings Note */}
          <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Settings size={20} className="text-purple-400" />
              <h3 className="text-sm font-semibold text-white">Comment Settings</h3>
            </div>
            <p className="text-sm text-gray-300">
              Comment tone, scheduling, auto-approval, and blacklists are configured at the workspace level.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Go to <span className="text-purple-400">Settings &rarr; AI Configuration &rarr; LinkedIn Commenting Agent</span> to customize these settings.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {activeTab === 'profiles' ? 'Profiles' : activeTab === 'companies' ? 'Company pages' : 'Hashtags'} will start being monitored after saving
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || (profileTargets.filter(t => t.trim()).length === 0 && companyTargets.filter(t => t.trim()).length === 0 && hashtagTargets.filter(t => t.trim()).length === 0)}
              className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Target size={16} />
                  {editMode ? 'Save Changes' : 'Add Monitor'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
