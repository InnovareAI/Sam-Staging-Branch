'use client';

import React, { useState } from 'react';
import { X, Target, Hash, Search, User, MessageSquare, Shield, Clock, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface CommentingCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

type TargetingMode = 'hashtag' | 'keyword' | 'profile';
type Tone = 'professional' | 'friendly' | 'casual' | 'passionate';
type Formality = 'formal' | 'semi-formal' | 'informal';
type CommentLength = 'short' | 'medium' | 'long';
type QuestionFrequency = 'frequently' | 'sometimes' | 'rarely' | 'never';

export default function CommentingCampaignModal({ isOpen, onClose, workspaceId }: CommentingCampaignModalProps) {
  const [campaignName, setCampaignName] = useState('');
  const [targetingMode, setTargetingMode] = useState<TargetingMode>('hashtag');
  const [targets, setTargets] = useState<string[]>(['']);

  // Prompt Builder Settings
  const [tone, setTone] = useState<Tone>('professional');
  const [formality, setFormality] = useState<Formality>('semi-formal');
  const [commentLength, setCommentLength] = useState<CommentLength>('medium');
  const [questionFrequency, setQuestionFrequency] = useState<QuestionFrequency>('sometimes');
  const [customInstructions, setCustomInstructions] = useState('');
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(true);

  // Anti-bot Detection Settings
  const [minExistingComments, setMinExistingComments] = useState(2);
  const [minPostReactions, setMinPostReactions] = useState(5);
  const [minPostAgeMinutes, setMinPostAgeMinutes] = useState(30);
  const [maxPostAgeHours, setMaxPostAgeHours] = useState(24);
  const [dailyLimit, setDailyLimit] = useState(30);
  const [minDelayMinutes, setMinDelayMinutes] = useState(20);

  // Advanced Settings
  const [tagAuthors, setTagAuthors] = useState(true);
  const [blacklistedProfiles, setBlacklistedProfiles] = useState('');
  const [monitorComments, setMonitorComments] = useState(false);
  const [replyToComments, setReplyToComments] = useState(false);
  const [timezone, setTimezone] = useState('America/New_York');

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAddTarget = () => {
    setTargets([...targets, '']);
  };

  const handleTargetChange = (index: number, value: string) => {
    const newTargets = [...targets];
    newTargets[index] = value;
    setTargets(newTargets);
  };

  const handleRemoveTarget = (index: number) => {
    if (targets.length > 1) {
      setTargets(targets.filter((_, i) => i !== index));
    }
  };

  const handleCreate = async () => {
    setSaving(true);

    try {
      const validTargets = targets.filter(t => t.trim());

      // Create a monitor for each target
      const monitorPromises = validTargets.map(async (target) => {
        const monitor: any = {
          workspace_id: workspaceId,
          monitor_type: targetingMode,
          target_value: target.trim(),
          target_metadata: {
            campaign_name: campaignName,
            prompt_config: {
              tone,
              formality,
              commentLength,
              questionFrequency,
              customInstructions,
              useKnowledgeBase,
            },
            anti_bot_detection: {
              min_existing_comments: minExistingComments,
              min_post_reactions: minPostReactions,
              min_post_age_minutes: minPostAgeMinutes,
              max_post_age_hours: maxPostAgeHours,
              daily_limit: dailyLimit,
              min_delay_minutes: minDelayMinutes,
            },
            tag_authors: tagAuthors,
            blacklisted_profiles: blacklistedProfiles.split(',').map(p => p.trim()).filter(Boolean),
            // Store these in metadata until migration is run
            monitor_comments: monitorComments,
            reply_to_comments: replyToComments,
            timezone: timezone,
          },
          is_active: true,
          priority: 1,
          check_frequency_minutes: 30,
          min_engagement_threshold: minPostReactions,
        };

        // Add new columns if migration has been run (they'll be ignored if columns don't exist)
        // This allows backward compatibility
        if (monitorComments !== undefined) {
          monitor.monitor_comments = monitorComments;
        }
        if (replyToComments !== undefined) {
          monitor.reply_to_comments = replyToComments;
        }
        if (timezone) {
          monitor.timezone = timezone;
        }

        console.log('📤 Creating monitor:', monitor);

        const response = await fetch('/api/linkedin-commenting/monitors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(monitor),
        });

        if (!response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create monitor');
          } else {
            const text = await response.text();
            console.error('Non-JSON error response:', text);
            throw new Error(`Server error: ${response.status} ${response.statusText}`);
          }
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return response.json();
        } else {
          console.warn('Response is not JSON, returning empty object');
          return {};
        }
      });

      await Promise.all(monitorPromises);

      console.log('✅ Campaign created successfully with', validTargets.length, 'monitors');
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

  const targetingModes = [
    { id: 'hashtag' as TargetingMode, label: 'Hashtags', icon: Hash, description: 'Target posts with specific hashtags', placeholder: '#SaaS' },
    { id: 'keyword' as TargetingMode, label: 'Keywords', icon: Search, description: 'Find posts containing keywords', placeholder: 'sales automation' },
    { id: 'profile' as TargetingMode, label: 'Profiles', icon: User, description: 'Comment on specific users\' posts', placeholder: 'https://linkedin.com/in/username' },
  ];

  const selectedMode = targetingModes.find(m => m.id === targetingMode)!;

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
              <h2 className="text-xl font-semibold text-white">Create Commenting Campaign</h2>
              <p className="text-gray-400 text-sm">Set up automated LinkedIn engagement</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-300 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Campaign Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Campaign Name</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="e.g., SaaS Founders Engagement"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          {/* Targeting Mode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Targeting Mode</label>
            <div className="grid grid-cols-3 gap-3">
              {targetingModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setTargetingMode(mode.id)}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    targetingMode === mode.id
                      ? 'border-pink-500 bg-pink-900/30'
                      : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                  }`}
                >
                  <mode.icon size={24} className={targetingMode === mode.id ? 'text-pink-400' : 'text-gray-400'} />
                  <div className="mt-2 text-sm font-medium text-white">{mode.label}</div>
                  <div className="text-xs text-gray-400 mt-1">{mode.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Targets */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              {selectedMode.label} (0/{targetingMode === 'hashtag' || targetingMode === 'keyword' ? '4' : '30'})
            </label>
            {targets.map((target, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={target}
                  onChange={(e) => handleTargetChange(index, e.target.value)}
                  placeholder={selectedMode.placeholder}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                {targets.length > 1 && (
                  <button
                    onClick={() => handleRemoveTarget(index)}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-400 rounded-lg transition-colors"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddTarget}
              className="text-sm text-pink-400 hover:text-pink-300 transition-colors"
            >
              + Add another {targetingMode === 'profile' ? 'profile' : targetingMode}
            </button>
          </div>

          {/* Prompt Builder */}
          <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-purple-400" />
              <h3 className="text-lg font-semibold text-white">Prompt Builder</h3>
            </div>

            <div className="space-y-4">
              {/* Tone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Tone</label>
                <div className="grid grid-cols-4 gap-2">
                  {['professional', 'friendly', 'casual', 'passionate'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTone(t as Tone)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        tone === t
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Formality */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Formality Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {['formal', 'semi-formal', 'informal'].map((f) => (
                    <button
                      key={f}
                      onClick={() => setFormality(f as Formality)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        formality === f
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {f.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment Length */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Comment Length</label>
                <div className="grid grid-cols-3 gap-2">
                  {['short', 'medium', 'long'].map((l) => (
                    <button
                      key={l}
                      onClick={() => setCommentLength(l as CommentLength)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        commentLength === l
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ask Questions</label>
                <div className="grid grid-cols-4 gap-2">
                  {['frequently', 'sometimes', 'rarely', 'never'].map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuestionFrequency(q as QuestionFrequency)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        questionFrequency === q
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                    >
                      {q.charAt(0).toUpperCase() + q.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Use Knowledge Base */}
              <div className="flex items-center justify-between p-3 bg-gray-600 rounded-lg">
                <div>
                  <div className="text-white font-medium text-sm">Use Workspace Knowledge</div>
                  <div className="text-gray-400 text-xs">Include your company context in comments</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useKnowledgeBase}
                    onChange={(e) => setUseKnowledgeBase(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Custom Instructions */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Custom Instructions (Optional)</label>
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value)}
                  placeholder="Add specific guidelines for comment generation..."
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>
            </div>
          </div>

          {/* Anti-bot Detection */}
          <div className="p-4 bg-green-900/20 rounded-lg border border-green-700/50">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={20} className="text-green-400" />
              <h3 className="text-lg font-semibold text-white">Anti-Bot Detection</h3>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Existing Comments</label>
                <input
                  type="number"
                  value={minExistingComments}
                  onChange={(e) => setMinExistingComments(parseInt(e.target.value))}
                  min="0"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Never be first to comment</p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Post Reactions</label>
                <input
                  type="number"
                  value={minPostReactions}
                  onChange={(e) => setMinPostReactions(parseInt(e.target.value))}
                  min="0"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Wait for organic engagement</p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Post Age (minutes)</label>
                <input
                  type="number"
                  value={minPostAgeMinutes}
                  onChange={(e) => setMinPostAgeMinutes(parseInt(e.target.value))}
                  min="0"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Avoid fresh posts</p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Max Post Age (hours)</label>
                <input
                  type="number"
                  value={maxPostAgeHours}
                  onChange={(e) => setMaxPostAgeHours(parseInt(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Skip old posts</p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Daily Comment Limit</label>
                <input
                  type="number"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                  min="1"
                  max="50"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Max 30-50 recommended</p>
              </div>

              <div>
                <label className="block text-sm text-gray-300 mb-1">Min Delay (minutes)</label>
                <input
                  type="number"
                  value={minDelayMinutes}
                  onChange={(e) => setMinDelayMinutes(parseInt(e.target.value))}
                  min="5"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">Gap between comments</p>
              </div>
            </div>
          </div>

          {/* Advanced Settings (Collapsible) */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              <span className="text-white font-medium">Advanced Settings</span>
              {showAdvanced ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
            </button>

            {showAdvanced && (
              <div className="mt-3 p-4 bg-gray-700/50 rounded-lg border border-gray-600 space-y-4">
                {/* Tag Authors */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium text-sm">Tag Post Authors</div>
                    <div className="text-gray-400 text-xs">Mention authors in comments (@username)</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tagAuthors}
                      onChange={(e) => setTagAuthors(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {/* Blacklisted Profiles */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Blacklisted Profiles (comma-separated)</label>
                  <textarea
                    value={blacklistedProfiles}
                    onChange={(e) => setBlacklistedProfiles(e.target.value)}
                    placeholder="https://linkedin.com/in/user1, https://linkedin.com/in/user2"
                    rows={2}
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                  />
                </div>

                {/* Monitor Comments */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium text-sm">Monitor Comments on Posts</div>
                    <div className="text-gray-400 text-xs">Track individual comments to find reply opportunities</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={monitorComments}
                      onChange={(e) => setMonitorComments(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {/* Reply to Comments */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium text-sm">Reply to High-Engagement Comments</div>
                    <div className="text-gray-400 text-xs">Generate replies to comments on posts (requires monitoring)</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replyToComments}
                      onChange={(e) => setReplyToComments(e.target.checked)}
                      disabled={!monitorComments}
                      className="sr-only peer"
                    />
                    <div className={`w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600 ${!monitorComments ? 'opacity-50 cursor-not-allowed' : ''}`}></div>
                  </label>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Timezone for Scheduling</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="Europe/London">London (GMT)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Shanghai">Shanghai (CST)</option>
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Australia/Sydney">Sydney (AEDT)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Campaign will start discovering posts after creation
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
              disabled={saving || !campaignName.trim() || targets.filter(t => t.trim()).length === 0}
              className="px-6 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Clock size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Target size={16} />
                  Create Campaign
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
