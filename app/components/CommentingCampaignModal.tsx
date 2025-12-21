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
  myContentMode?: boolean;
}

type TargetingMode = 'hashtag' | 'keyword' | 'profile';
type TargetTab = 'profiles' | 'companies' | 'hashtags' | 'my-content';

export default function CommentingCampaignModal({ isOpen, onClose, workspaceId, editMode = false, existingMonitor, myContentMode = false }: CommentingCampaignModalProps) {
  const [campaignName, setCampaignName] = useState('');
  const [targetingMode] = useState<TargetingMode>('profile'); // Only profile targeting supported
  const [activeTab, setActiveTab] = useState<TargetTab>(myContentMode ? 'my-content' : 'profiles');
  const [profileTargets, setProfileTargets] = useState<string[]>(['']);
  const [companyTargets, setCompanyTargets] = useState<string[]>(['']);
  const [hashtagTargets, setHashtagTargets] = useState<string[]>(['']);

  // My Content mode states
  const [myContentChoice, setMyContentChoice] = useState<'profile-companies' | 'posts'>('profile-companies');
  const [myProfile, setMyProfile] = useState('');
  const [myCompanies, setMyCompanies] = useState<string[]>(['']);

  // Lead Capture options
  const [autoConnect, setAutoConnect] = useState(false);
  const [autoDM, setAutoDM] = useState(false);
  const [autoNurture, setAutoNurture] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);

  const [saving, setSaving] = useState(false);
  const [existingMonitors, setExistingMonitors] = useState<Monitor[]>([]);
  const [loadingMonitors, setLoadingMonitors] = useState(false);

  // Load existing monitor data in edit mode
  // Load existing monitor data
  useEffect(() => {
    loadExistingMonitors();
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
  }, [editMode, existingMonitor, workspaceId]);

  const loadExistingMonitors = async () => {
    setLoadingMonitors(true);
    try {
      const res = await fetch(`/api/linkedin-commenting/monitors?workspace_id=${workspaceId}`);
      if (res.ok) {
        const data = await res.json();
        setExistingMonitors(data.monitors || []);
      }
    } catch (err) {
      console.error('Failed to load existing monitors:', err);
    } finally {
      setLoadingMonitors(false);
    }
  };

  const handleRemoveExisting = async (monitorId: string) => {
    if (!confirm('Are you sure you want to stop monitoring this profile?')) return;
    try {
      const res = await fetch(`/api/linkedin-commenting/monitors/${monitorId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setExistingMonitors(prev => prev.filter(m => m.id !== monitorId));
      }
    } catch (err) {
      console.error('Failed to remove monitor:', err);
    }
  };

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
      // Get all targets from all tabs
      const allProfileTargets = profileTargets.filter(t => t.trim());
      const allCompanyTargets = companyTargets.filter(t => t.trim());
      const allHashtagTargets = hashtagTargets.filter(t => t.trim());

      const hashtags: string[] = [];

      // Add My Content targets if in My Content mode
      if (myContentMode) {
        if (myContentChoice === 'profile-companies') {
          // Profile
          let vanityName = myProfile.trim();
          if (vanityName) {
            if (vanityName.includes('linkedin.com/in/')) {
              const match = vanityName.match(/linkedin\.com\/in\/([^\/\?#]+)/);
              if (match) vanityName = match[1];
            }
            hashtags.push(`PROFILE:${vanityName}`);
          }

          // Companies
          for (const company of myCompanies) {
            let companySlug = company.trim();
            if (companySlug) {
              if (companySlug.includes('linkedin.com/company/')) {
                const match = companySlug.match(/linkedin\.com\/company\/([^\/\?#]+)/);
                if (match) companySlug = match[1];
              }
              hashtags.push(`COMPANY:${companySlug}`);
            }
          }
        }
      } else {
        // Standard Campaign Monitor Logic
        // Add profiles
        for (const target of allProfileTargets) {
          let vanityName = target.trim();
          if (vanityName.includes('linkedin.com/in/')) {
            const match = vanityName.match(/linkedin\.com\/in\/([^\/\?#]+)/);
            if (match) vanityName = match[1];
          }
          hashtags.push(`PROFILE:${vanityName}`);
        }

        // Add companies
        for (const target of allCompanyTargets) {
          let companySlug = target.trim();
          if (companySlug.includes('linkedin.com/company/')) {
            const match = companySlug.match(/linkedin\.com\/company\/([^\/\?#]+)/);
            if (match) companySlug = match[1];
          }
          hashtags.push(`COMPANY:${companySlug}`);
        }

        // Add hashtags
        for (const target of allHashtagTargets) {
          let keyword = target.trim().replace(/^#/, '');
          if (keyword) {
            hashtags.push(`HASHTAG:${keyword}`);
          }
        }
      }

      if (hashtags.length === 0) {
        throw new Error('No targets selected. Please add at least one profile, company, or hashtag.');
      }

      const monitor: any = {
        name: campaignName || `Comment Campaign - ${new Date().toLocaleDateString()}`,
        hashtags: hashtags,
        keywords: [],
        status: 'active'
      };

      console.log('📤 Creating grouped monitor:', monitor);

      const url = editMode && existingMonitor
        ? `/api/linkedin-commenting/monitors/${existingMonitor.id}`
        : '/api/linkedin-commenting/monitors';

      const response = await fetch(url, {
        method: editMode ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(monitor),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Server error: ${response.status}`);
      }

      console.log(`✅ Campaign ${editMode ? 'updated' : 'created'} successfully`);
      onClose();
      window.location.reload();
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert(error instanceof Error ? error.message : 'An unexpected error occurred');
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
          {/* Tab Switcher / My Content Mode */}
          {myContentMode ? (
            <div className="space-y-6">
              {/* Content Type Selection */}
              <div className="flex gap-2 p-1 bg-gray-700/50 rounded-lg">
                <button
                  onClick={() => setMyContentChoice('profile-companies')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${myContentChoice === 'profile-companies'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                >
                  <User size={18} />
                  <span className="font-medium">My Profile & Companies</span>
                </button>
                <button
                  onClick={() => setMyContentChoice('posts')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${myContentChoice === 'posts'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                >
                  <Target size={18} />
                  <span className="font-medium">My Posts</span>
                </button>
              </div>

              {myContentChoice === 'profile-companies' ? (
                <>
                  {/* My Profile Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      My LinkedIn Profile URL
                    </label>
                    <p className="text-sm text-gray-400 mb-3">
                      Enter your LinkedIn profile URL to capture leads from people who engage with your profile
                    </p>
                    <input
                      type="text"
                      value={myProfile}
                      onChange={(e) => setMyProfile(e.target.value)}
                      placeholder="e.g., linkedin.com/in/yourname or just yourname"
                      className="w-full px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                  </div>

                  {/* My Company Pages Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      My Company Pages (Optional)
                    </label>
                    <p className="text-sm text-gray-400 mb-3">
                      Add company pages you manage to capture leads from engagement
                    </p>
                    {myCompanies.map((company, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => {
                            const newCompanies = [...myCompanies];
                            newCompanies[index] = e.target.value;
                            setMyCompanies(newCompanies);
                          }}
                          placeholder="e.g., linkedin.com/company/yourcompany"
                          className="flex-1 px-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                        {myCompanies.length > 1 && (
                          <button
                            onClick={() => setMyCompanies(myCompanies.filter((_, i) => i !== index))}
                            className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-all"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => setMyCompanies([...myCompanies, ''])}
                      className="text-sm text-green-400 hover:text-green-300 font-medium mt-2"
                    >
                      + Add another company page
                    </button>
                  </div>

                  {/* Lead Capture Options */}
                  <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <Target size={18} className="text-green-400" />
                      Lead Capture Options
                    </h4>
                    <p className="text-sm text-gray-400 mb-4">
                      Automatically capture and nurture leads who engage with your profile or company pages
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-green-900/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={autoConnect}
                          onChange={(e) => setAutoConnect(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-gray-200 font-medium">Auto-send connection request</div>
                          <div className="text-xs text-gray-400">Automatically connect with engaged users</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-green-900/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={autoDM}
                          onChange={(e) => setAutoDM(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-gray-200 font-medium">Auto-send direct message</div>
                          <div className="text-xs text-gray-400">Send a personalized DM after connection</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-green-900/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={autoNurture}
                          onChange={(e) => setAutoNurture(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-gray-200 font-medium">Auto-run multi-step nurturing sequence</div>
                          <div className="text-xs text-gray-400">Follow up with automated nurture sequence</div>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-green-900/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={autoApprove}
                          onChange={(e) => setAutoApprove(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <div>
                          <div className="text-gray-200 font-medium">Auto-approve all replies</div>
                          <div className="text-xs text-gray-400">Skip manual approval for responses</div>
                        </div>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <Target size={48} className="text-green-500 mx-auto mb-4" />
                  <h3 className="text-white font-semibold mb-2">Monitor Your Posts</h3>
                  <p className="text-gray-400 text-sm mb-4">
                    We'll automatically detect and monitor comments on your LinkedIn posts
                  </p>
                  <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 text-left">
                    <p className="text-sm text-gray-300">
                      This feature will fetch your recent posts and let you auto-reply to comments from your audience.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2 p-1 bg-gray-700/50 rounded-lg">
                <button
                  onClick={() => setActiveTab('profiles')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'profiles'
                    ? 'bg-pink-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                >
                  <User size={18} />
                  <span className="font-medium">Personal Profiles</span>
                </button>
                <button
                  onClick={() => setActiveTab('companies')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'companies'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-600'
                    }`}
                >
                  <Building2 size={18} />
                  <span className="font-medium">Company Pages</span>
                </button>
                <button
                  onClick={() => setActiveTab('hashtags')}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'hashtags'
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

                {/* Currently Following Section */}
                <div className="mt-8">
                  <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    Currently Following
                  </h3>
                  {loadingMonitors ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm italic">
                      <Clock size={14} className="animate-spin" />
                      Loading followed {activeTab}...
                    </div>
                  ) : existingMonitors.filter(m => {
                    if (activeTab === 'profiles') return m.hashtags.some(h => h.startsWith('PROFILE:'));
                    if (activeTab === 'companies') return m.hashtags.some(h => h.startsWith('COMPANY:'));
                    return m.hashtags.some(h => h.startsWith('HASHTAG:'));
                  }).length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No {activeTab} followed yet</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {existingMonitors.filter(m => {
                        if (activeTab === 'profiles') return m.hashtags.some(h => h.startsWith('PROFILE:'));
                        if (activeTab === 'companies') return m.hashtags.some(h => h.startsWith('COMPANY:'));
                        return m.hashtags.some(h => h.startsWith('HASHTAG:'));
                      }).map(monitor => {
                        const tag = monitor.hashtags[0] || '';
                        let displayName = monitor.name || tag;
                        if (tag.startsWith('PROFILE:')) displayName = tag.replace('PROFILE:', '');
                        if (tag.startsWith('COMPANY:')) displayName = tag.replace('COMPANY:', '');
                        if (tag.startsWith('HASHTAG:')) displayName = '#' + tag.replace('HASHTAG:', '');

                        return (
                          <div key={monitor.id} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg border border-gray-700">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activeTab === 'profiles' ? 'bg-pink-600/20 text-pink-400' :
                                activeTab === 'companies' ? 'bg-blue-600/20 text-blue-400' :
                                  'bg-green-600/20 text-green-400'
                                }`}>
                                {activeTab === 'profiles' ? <User size={14} /> :
                                  activeTab === 'companies' ? <Building2 size={14} /> :
                                    <Hash size={14} />}
                              </div>
                              <span className="text-sm text-white font-medium truncate">{displayName}</span>
                            </div>
                            <button
                              onClick={() => handleRemoveExisting(monitor.id)}
                              className="p-1.5 text-gray-500 hover:text-red-400 bg-gray-600/20 hover:bg-red-900/20 rounded transition-colors"
                              title="Delete Monitor"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

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
              disabled={saving || (
                myContentMode
                  ? (!myProfile && myContentChoice === 'profile-companies' && myCompanies.every(c => !c.trim()))
                  : (profileTargets.filter(t => t.trim()).length === 0 && companyTargets.filter(t => t.trim()).length === 0 && hashtagTargets.filter(t => t.trim()).length === 0)
              )}
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
