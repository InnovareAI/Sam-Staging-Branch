'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, ChevronDown, ChevronUp, Plus, X, Info } from 'lucide-react';
import { createClient } from '@/app/lib/supabase';

interface CommentingAgentSettingsProps {
  workspaceId: string;
  onSaveSuccess?: () => void;
}

interface Settings {
  id?: string;
  // Section 1: Quick Settings
  tone: string;
  formality: string;
  comment_length: string;
  question_frequency: string;
  perspective_style: string;
  confidence_level: string;
  use_workspace_knowledge: boolean;

  // Section 2: Your Expertise
  what_you_do: string;
  what_youve_learned: string;
  pov_on_future: string;
  industry_talking_points: string;

  // Section 3: Brand Voice
  voice_reference: string;
  tone_of_voice: string;
  writing_style: string;
  dos_and_donts: string;

  // Section 4: Vibe Check
  okay_funny: boolean;
  okay_blunt: boolean;
  casual_openers: boolean;
  personal_experience: boolean;
  strictly_professional: boolean;

  // Section 5: Comment Framework
  framework_preset: string;
  custom_framework: string;
  max_characters: number;

  // Section 6: Example Comments
  example_comments: string[];
  admired_comments: string[];

  // Section 7: Relationship & Context
  default_relationship_tag: string;
  comment_scope: string;
  auto_skip_generic: boolean;
  post_age_awareness: boolean;
  recent_comment_memory: boolean;

  // Section 8: Guardrails
  competitors_never_mention: string[];
  end_with_cta: string;
  cta_style: string;

  // Section 9: Scheduling & Limits
  timezone: string;
  country_code: string;
  posting_start_time: string;
  posting_end_time: string;
  post_on_weekends: boolean;
  post_on_holidays: boolean;
  daily_comment_limit: number;
  min_days_between_profile_comments: number;
  max_days_between_profile_comments: number;

  // Profile scraping limits
  profile_scrape_interval_days: number;
  max_profile_scrapes_per_day: number;

  // Section 10: Advanced
  system_prompt: string;

  // Section 11: Engagement & Automation
  tag_post_authors: boolean;
  blacklisted_profiles: string[];
  monitor_comments: boolean;
  reply_to_high_engagement: boolean;
  auto_approve_enabled: boolean;
  auto_approve_start_time: string;
  auto_approve_end_time: string;

  // Section 12: Post Type Blocklist
  block_job_posts: boolean;
  block_event_posts: boolean;
  block_promotional_posts: boolean;
  block_repost_only: boolean;
  block_generic_motivation: boolean;
  block_self_promotion: boolean;
  custom_blocked_keywords: string[];

  // Section 13: Email Digest
  digest_email: string;
  digest_enabled: boolean;
  digest_timezone: string;

  // Section 14: Target Countries Filter
  target_countries: string[];

  // Section 15: VIP/Priority Profiles (Added Dec 30, 2025)
  priority_profiles: PriorityProfile[];

  // Section 16: Opportunity Digest (Added Dec 30, 2025)
  opportunity_digest_enabled: boolean;
  opportunity_digest_time: string;
}

interface PriorityProfile {
  profile_id: string;
  profile_url?: string;
  name: string;
  relationship: 'partner' | 'client' | 'friend' | 'prospect' | 'thought_leader';
  tone_override?: string;
  never_miss?: boolean;
  notes?: string;
}

const defaultSettings: Settings = {
  tone: 'professional',
  formality: 'semi_formal',
  comment_length: 'medium',
  question_frequency: 'sometimes',
  perspective_style: 'additive',
  confidence_level: 'balanced',
  use_workspace_knowledge: false,
  what_you_do: '',
  what_youve_learned: '',
  pov_on_future: '',
  industry_talking_points: '',
  voice_reference: '',
  tone_of_voice: '',
  writing_style: '',
  dos_and_donts: '',
  okay_funny: true,
  okay_blunt: true,
  casual_openers: true,
  personal_experience: true,
  strictly_professional: false,
  framework_preset: 'aca_i',
  custom_framework: '',
  max_characters: 300,
  example_comments: [],
  admired_comments: [],
  default_relationship_tag: 'unknown',
  comment_scope: 'my_expertise',
  auto_skip_generic: false,
  post_age_awareness: true,
  recent_comment_memory: true,
  competitors_never_mention: [],
  end_with_cta: 'never',
  cta_style: 'question_only',
  timezone: 'America/New_York',
  country_code: 'US',
  posting_start_time: '09:00',
  posting_end_time: '17:00',
  post_on_weekends: false,
  post_on_holidays: false,
  daily_comment_limit: 30,
  min_days_between_profile_comments: 1,
  max_days_between_profile_comments: 7,
  profile_scrape_interval_days: 1,
  max_profile_scrapes_per_day: 20,
  system_prompt: '',
  // Section 11: Engagement & Automation
  tag_post_authors: true,
  blacklisted_profiles: [],
  monitor_comments: false,
  reply_to_high_engagement: false,
  auto_approve_enabled: false,
  auto_approve_start_time: '09:00',
  auto_approve_end_time: '17:00',

  // Section 12: Post Type Blocklist
  block_job_posts: true,
  block_event_posts: false,
  block_promotional_posts: false,
  block_repost_only: false,
  block_generic_motivation: false,
  block_self_promotion: false,
  custom_blocked_keywords: [],

  // Section 13: Email Digest
  digest_email: '',
  digest_enabled: false,
  digest_timezone: 'America/New_York',

  // Section 14: Target Countries Filter
  target_countries: [],

  // Section 15: VIP/Priority Profiles
  priority_profiles: [],

  // Section 16: Opportunity Digest
  opportunity_digest_enabled: false,
  opportunity_digest_time: '07:00',
};

const frameworkDescriptions: Record<string, string> = {
  aca_i: "ACA+I: Acknowledge the poster's point → Add nuance or new angle → Share an I-statement from experience → Question (optional)",
  var: "VAR: Validate what resonated → Add your insight → Relate back to poster or audience",
  hook_value_bridge: "Hook-Value-Bridge: Grab attention → Deliver one insight → Bridge to continued conversation",
  custom: "Define your own comment structure",
};

export default function CommentingAgentSettings({ workspaceId, onSaveSuccess }: CommentingAgentSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [settings, setSettings] = useState<Settings>(defaultSettings);

  // Collapsible sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    quick: true,
    expertise: false,
    voice: false,
    vibe: false,
    framework: false,
    examples: false,
    context: false,
    guardrails: false,
    scheduling: false,
    automation: false,
    blocklist: false,
    countries: false,
    digest: false,
    priority_profiles: false,
    opportunity_digest: false,
    advanced: false,
  });

  // Temp inputs for array fields
  const [newExampleComment, setNewExampleComment] = useState('');
  const [newAdmiredComment, setNewAdmiredComment] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');
  const [newBlacklistedProfile, setNewBlacklistedProfile] = useState('');
  const [newBlockedKeyword, setNewBlockedKeyword] = useState('');

  // Priority profile form state (Added Dec 30, 2025)
  const [newPriorityProfile, setNewPriorityProfile] = useState<Partial<PriorityProfile>>({
    name: '',
    profile_id: '',
    profile_url: '',
    relationship: 'partner',
    tone_override: '',
    notes: '',
    never_miss: false,
  });

  useEffect(() => {
    loadSettings();
  }, [workspaceId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('linkedin_brand_guidelines')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true)
        .maybeSingle();

      if (data) {
        setSettings({
          id: data.id,
          tone: data.tone || defaultSettings.tone,
          formality: data.formality || defaultSettings.formality,
          comment_length: data.comment_length || defaultSettings.comment_length,
          question_frequency: data.question_frequency || defaultSettings.question_frequency,
          perspective_style: data.perspective_style || defaultSettings.perspective_style,
          confidence_level: data.confidence_level || defaultSettings.confidence_level,
          use_workspace_knowledge: data.use_workspace_knowledge ?? defaultSettings.use_workspace_knowledge,
          what_you_do: data.what_you_do || '',
          what_youve_learned: data.what_youve_learned || '',
          pov_on_future: data.pov_on_future || '',
          industry_talking_points: data.industry_talking_points || '',
          voice_reference: data.voice_reference || '',
          tone_of_voice: data.tone_of_voice || '',
          writing_style: data.writing_style || '',
          dos_and_donts: data.dos_and_donts || '',
          okay_funny: data.okay_funny ?? defaultSettings.okay_funny,
          okay_blunt: data.okay_blunt ?? defaultSettings.okay_blunt,
          casual_openers: data.casual_openers ?? defaultSettings.casual_openers,
          personal_experience: data.personal_experience ?? defaultSettings.personal_experience,
          strictly_professional: data.strictly_professional ?? defaultSettings.strictly_professional,
          framework_preset: data.framework_preset || defaultSettings.framework_preset,
          custom_framework: data.custom_framework || '',
          max_characters: data.max_characters || defaultSettings.max_characters,
          example_comments: data.example_comments || [],
          admired_comments: data.admired_comments || [],
          default_relationship_tag: data.default_relationship_tag || defaultSettings.default_relationship_tag,
          comment_scope: data.comment_scope || defaultSettings.comment_scope,
          auto_skip_generic: data.auto_skip_generic ?? defaultSettings.auto_skip_generic,
          post_age_awareness: data.post_age_awareness ?? defaultSettings.post_age_awareness,
          recent_comment_memory: data.recent_comment_memory ?? defaultSettings.recent_comment_memory,
          competitors_never_mention: data.competitors_never_mention || [],
          end_with_cta: data.end_with_cta || defaultSettings.end_with_cta,
          cta_style: data.cta_style || defaultSettings.cta_style,
          timezone: data.timezone || defaultSettings.timezone,
          country_code: data.country_code || defaultSettings.country_code,
          posting_start_time: data.posting_start_time || defaultSettings.posting_start_time,
          posting_end_time: data.posting_end_time || defaultSettings.posting_end_time,
          post_on_weekends: data.post_on_weekends ?? defaultSettings.post_on_weekends,
          post_on_holidays: data.post_on_holidays ?? defaultSettings.post_on_holidays,
          daily_comment_limit: data.daily_comment_limit ?? defaultSettings.daily_comment_limit,
          min_days_between_profile_comments: data.min_days_between_profile_comments ?? defaultSettings.min_days_between_profile_comments,
          max_days_between_profile_comments: data.max_days_between_profile_comments ?? defaultSettings.max_days_between_profile_comments,
          profile_scrape_interval_days: data.profile_scrape_interval_days ?? defaultSettings.profile_scrape_interval_days,
          max_profile_scrapes_per_day: data.max_profile_scrapes_per_day ?? defaultSettings.max_profile_scrapes_per_day,
          system_prompt: data.system_prompt || '',
          // Section 11: Engagement & Automation
          tag_post_authors: data.tag_post_authors ?? defaultSettings.tag_post_authors,
          blacklisted_profiles: data.blacklisted_profiles || [],
          monitor_comments: data.monitor_comments ?? defaultSettings.monitor_comments,
          reply_to_high_engagement: data.reply_to_high_engagement ?? defaultSettings.reply_to_high_engagement,
          auto_approve_enabled: data.auto_approve_enabled ?? defaultSettings.auto_approve_enabled,
          auto_approve_start_time: data.auto_approve_start_time || defaultSettings.auto_approve_start_time,
          auto_approve_end_time: data.auto_approve_end_time || defaultSettings.auto_approve_end_time,
          // Section 12: Post Type Blocklist
          block_job_posts: data.block_job_posts ?? defaultSettings.block_job_posts,
          block_event_posts: data.block_event_posts ?? defaultSettings.block_event_posts,
          block_promotional_posts: data.block_promotional_posts ?? defaultSettings.block_promotional_posts,
          block_repost_only: data.block_repost_only ?? defaultSettings.block_repost_only,
          block_generic_motivation: data.block_generic_motivation ?? defaultSettings.block_generic_motivation,
          block_self_promotion: data.block_self_promotion ?? defaultSettings.block_self_promotion,
          custom_blocked_keywords: data.custom_blocked_keywords || [],
          // Section 13: Email Digest
          digest_email: data.digest_email || '',
          digest_enabled: data.digest_enabled ?? false,
          digest_timezone: data.digest_timezone || defaultSettings.digest_timezone,
          // Section 14: Target Countries Filter
          target_countries: data.target_countries || [],
          // Section 15: VIP/Priority Profiles (Added Dec 30, 2025)
          priority_profiles: data.priority_profiles || [],
          // Section 16: Opportunity Digest (Added Dec 30, 2025)
          opportunity_digest_enabled: data.opportunity_digest_enabled ?? false,
          opportunity_digest_time: data.opportunity_digest_time || defaultSettings.opportunity_digest_time,
        });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      // Validate required field
      if (!settings.tone_of_voice.trim()) {
        setSaveMessage('Please fill in "Tone of Voice" in the Brand Voice section');
        setSaving(false);
        return;
      }

      const settingsData = {
        workspace_id: workspaceId,
        tone: settings.tone,
        formality: settings.formality,
        comment_length: settings.comment_length,
        question_frequency: settings.question_frequency,
        perspective_style: settings.perspective_style,
        confidence_level: settings.confidence_level,
        use_workspace_knowledge: settings.use_workspace_knowledge,
        what_you_do: settings.what_you_do || null,
        what_youve_learned: settings.what_youve_learned || null,
        pov_on_future: settings.pov_on_future || null,
        industry_talking_points: settings.industry_talking_points || null,
        voice_reference: settings.voice_reference || null,
        tone_of_voice: settings.tone_of_voice,
        writing_style: settings.writing_style || null,
        dos_and_donts: settings.dos_and_donts || null,
        okay_funny: settings.okay_funny,
        okay_blunt: settings.okay_blunt,
        casual_openers: settings.casual_openers,
        personal_experience: settings.personal_experience,
        strictly_professional: settings.strictly_professional,
        framework_preset: settings.framework_preset,
        custom_framework: settings.custom_framework || null,
        max_characters: settings.max_characters,
        example_comments: settings.example_comments.length > 0 ? settings.example_comments : null,
        admired_comments: settings.admired_comments.length > 0 ? settings.admired_comments : null,
        default_relationship_tag: settings.default_relationship_tag,
        comment_scope: settings.comment_scope,
        auto_skip_generic: settings.auto_skip_generic,
        post_age_awareness: settings.post_age_awareness,
        recent_comment_memory: settings.recent_comment_memory,
        competitors_never_mention: settings.competitors_never_mention.length > 0 ? settings.competitors_never_mention : null,
        end_with_cta: settings.end_with_cta,
        cta_style: settings.cta_style,
        timezone: settings.timezone,
        country_code: settings.country_code,
        posting_start_time: settings.posting_start_time,
        posting_end_time: settings.posting_end_time,
        post_on_weekends: settings.post_on_weekends,
        post_on_holidays: settings.post_on_holidays,
        daily_comment_limit: settings.daily_comment_limit,
        min_days_between_profile_comments: settings.min_days_between_profile_comments,
        max_days_between_profile_comments: settings.max_days_between_profile_comments,
        profile_scrape_interval_days: settings.profile_scrape_interval_days,
        max_profile_scrapes_per_day: settings.max_profile_scrapes_per_day,
        system_prompt: settings.system_prompt || null,
        // Section 11: Engagement & Automation
        tag_post_authors: settings.tag_post_authors,
        blacklisted_profiles: settings.blacklisted_profiles.length > 0 ? settings.blacklisted_profiles : null,
        monitor_comments: settings.monitor_comments,
        reply_to_high_engagement: settings.reply_to_high_engagement,
        auto_approve_enabled: settings.auto_approve_enabled,
        auto_approve_start_time: settings.auto_approve_start_time,
        auto_approve_end_time: settings.auto_approve_end_time,
        // Section 12: Post Type Blocklist
        block_job_posts: settings.block_job_posts,
        block_event_posts: settings.block_event_posts,
        block_promotional_posts: settings.block_promotional_posts,
        block_repost_only: settings.block_repost_only,
        block_generic_motivation: settings.block_generic_motivation,
        block_self_promotion: settings.block_self_promotion,
        custom_blocked_keywords: settings.custom_blocked_keywords.length > 0 ? settings.custom_blocked_keywords : null,
        // Section 13: Email Digest
        digest_email: settings.digest_email || null,
        digest_enabled: settings.digest_enabled,
        digest_timezone: settings.digest_timezone,
        // Section 14: Target Countries Filter
        target_countries: settings.target_countries.length > 0 ? settings.target_countries : null,
        // Section 15: VIP/Priority Profiles (Added Dec 30, 2025)
        priority_profiles: settings.priority_profiles.length > 0 ? settings.priority_profiles : null,
        // Section 16: Opportunity Digest (Added Dec 30, 2025)
        opportunity_digest_enabled: settings.opportunity_digest_enabled,
        opportunity_digest_time: settings.opportunity_digest_time,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (settings.id) {
        const { error } = await supabase
          .from('linkedin_brand_guidelines')
          .update(settingsData)
          .eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('linkedin_brand_guidelines')
          .insert(settingsData)
          .select()
          .single();
        if (error) throw error;
        if (data) setSettings({ ...settings, id: data.id });
      }

      setSaveMessage('Settings saved successfully!');
      setTimeout(() => setSaveMessage(''), 3000);
      onSaveSuccess?.();
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const ButtonGroup = ({
    options,
    value,
    onChange,
    size = 'normal'
  }: {
    options: { value: string; label: string }[];
    value: string;
    onChange: (v: string) => void;
    size?: 'normal' | 'small';
  }) => (
    <div className={`grid gap-2 ${options.length <= 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            value === opt.value
              ? 'bg-pink-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          } ${size === 'small' ? 'text-xs py-1.5' : ''}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const Toggle = ({
    checked,
    onChange,
    label,
    description
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
    label: string;
    description?: string;
  }) => (
    <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
      <div>
        <div className="text-white text-sm font-medium">{label}</div>
        {description && <div className="text-gray-400 text-xs">{description}</div>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
      </label>
    </div>
  );

  const SectionHeader = ({
    title,
    section,
    description
  }: {
    title: string;
    section: string;
    description?: string;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gray-700 hover:bg-gray-600 transition-colors rounded-t-lg"
    >
      <div className="text-left">
        <span className="text-white font-medium block">{title}</span>
        {description && <span className="text-gray-400 text-xs">{description}</span>}
      </div>
      {expandedSections[section] ? (
        <ChevronUp size={20} className="text-gray-400" />
      ) : (
        <ChevronDown size={20} className="text-gray-400" />
      )}
    </button>
  );

  const addArrayItem = (field: 'example_comments' | 'admired_comments' | 'competitors_never_mention' | 'blacklisted_profiles' | 'custom_blocked_keywords' | 'target_countries', value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setSettings(prev => ({
        ...prev,
        [field]: [...(prev[field] || []), value.trim()]
      }));
      setter('');
    }
  };

  const removeArrayItem = (field: 'example_comments' | 'admired_comments' | 'competitors_never_mention' | 'blacklisted_profiles' | 'custom_blocked_keywords' | 'target_countries', index: number) => {
    setSettings(prev => ({
      ...prev,
      [field]: (prev[field] || []).filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={32} className="animate-spin text-pink-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section 1: Quick Settings */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Quick Settings" section="quick" description="Basic tone and style preferences" />
        {expandedSections.quick && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tone</label>
              <ButtonGroup
                options={[
                  { value: 'professional', label: 'Professional' },
                  { value: 'friendly', label: 'Friendly' },
                  { value: 'casual', label: 'Casual' },
                  { value: 'passionate', label: 'Passionate' },
                ]}
                value={settings.tone}
                onChange={(v) => setSettings({ ...settings, tone: v })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Formality</label>
              <ButtonGroup
                options={[
                  { value: 'formal', label: 'Formal' },
                  { value: 'semi_formal', label: 'Semi-Formal' },
                  { value: 'informal', label: 'Informal' },
                ]}
                value={settings.formality}
                onChange={(v) => setSettings({ ...settings, formality: v })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Comment Length</label>
              <ButtonGroup
                options={[
                  { value: 'short', label: 'Short (<150)' },
                  { value: 'medium', label: 'Medium (150-300)' },
                  { value: 'long', label: 'Long (300-500)' },
                ]}
                value={settings.comment_length}
                onChange={(v) => setSettings({ ...settings, comment_length: v })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Question Frequency</label>
              <ButtonGroup
                options={[
                  { value: 'frequently', label: 'Frequently' },
                  { value: 'sometimes', label: 'Sometimes' },
                  { value: 'rarely', label: 'Rarely' },
                  { value: 'never', label: 'Never' },
                ]}
                value={settings.question_frequency}
                onChange={(v) => setSettings({ ...settings, question_frequency: v })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Perspective Style</label>
              <ButtonGroup
                options={[
                  { value: 'supportive', label: 'Supportive' },
                  { value: 'additive', label: 'Additive' },
                  { value: 'thought_provoking', label: 'Thought-provoking' },
                ]}
                value={settings.perspective_style}
                onChange={(v) => setSettings({ ...settings, perspective_style: v })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Confidence Level</label>
              <ButtonGroup
                options={[
                  { value: 'assertive', label: 'Assertive' },
                  { value: 'balanced', label: 'Balanced' },
                  { value: 'humble', label: 'Humble' },
                ]}
                value={settings.confidence_level}
                onChange={(v) => setSettings({ ...settings, confidence_level: v })}
              />
            </div>

            <Toggle
              checked={settings.use_workspace_knowledge}
              onChange={(v) => setSettings({ ...settings, use_workspace_knowledge: v })}
              label="Use Workspace Knowledge"
              description="Include company context in comments"
            />
          </div>
        )}
      </div>

      {/* Section 2: Your Expertise */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Your Expertise" section="expertise" description="What makes you credible" />
        {expandedSections.expertise && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">What You Do</label>
              <p className="text-xs text-gray-400 mb-2">Your day-to-day expertise. What do clients pay you for? Be specific—frameworks, tools, industries, deal sizes.</p>
              <textarea
                value={settings.what_you_do}
                onChange={(e) => setSettings({ ...settings, what_you_do: e.target.value })}
                placeholder="I help B2B SaaS companies build outbound sales engines. Specialize in $20-100K ACV deals, multi-threaded enterprise sales, and building SDR teams from scratch."
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">What You've Learned</label>
              <p className="text-xs text-gray-400 mb-2">Hard-won lessons. What do you know now that you didn't 3 years ago? What mistakes have you made that others are still making?</p>
              <textarea
                value={settings.what_youve_learned}
                onChange={(e) => setSettings({ ...settings, what_youve_learned: e.target.value })}
                placeholder="Outbound at scale doesn't work without a tight ICP. Most companies spray and pray. Also learned that the best SDRs don't come from 'sales backgrounds'—they come from customer success."
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Your POV on the Future</label>
              <p className="text-xs text-gray-400 mb-2">Where is your space heading? What do most people get wrong? What are you betting on?</p>
              <textarea
                value={settings.pov_on_future}
                onChange={(e) => setSettings({ ...settings, pov_on_future: e.target.value })}
                placeholder="AI will make bad outbound worse and good outbound better. The winners will be the ones who use AI for research and personalization, not mass automation."
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Industry Talking Points</label>
              <p className="text-xs text-gray-400 mb-2">Specific angles by vertical. e.g., 'Pharma: compliance is a moat. SaaS: PLG is overrated for complex sales.'</p>
              <textarea
                value={settings.industry_talking_points}
                onChange={(e) => setSettings({ ...settings, industry_talking_points: e.target.value })}
                placeholder="FinTech: Regulatory moats are real. Healthcare: Long sales cycles mean you need champions. Manufacturing: Still underserved by modern sales tools."
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 3: Brand Voice */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Brand Voice" section="voice" description="How you sound when you write" />
        {expandedSections.voice && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Voice Reference</label>
              <p className="text-xs text-gray-400 mb-2">Name someone whose style you admire. e.g., 'Naval but warmer' or 'Eli Schwartz style'</p>
              <input
                type="text"
                value={settings.voice_reference}
                onChange={(e) => setSettings({ ...settings, voice_reference: e.target.value })}
                placeholder="Chris Walker but less aggressive, more curious"
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Tone of Voice <span className="text-pink-400">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-2">How should your comments sound? e.g., 'Confident but curious, direct but never dismissive'</p>
              <textarea
                value={settings.tone_of_voice}
                onChange={(e) => setSettings({ ...settings, tone_of_voice: e.target.value })}
                placeholder="Confident but curious. Direct but never dismissive. I have opinions but I'm genuinely interested in being wrong."
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Writing Style</label>
              <p className="text-xs text-gray-400 mb-2">Sentence structure, vocabulary, quirks. e.g., 'Short punchy sentences. No jargon. Occasional dry humor.'</p>
              <textarea
                value={settings.writing_style}
                onChange={(e) => setSettings({ ...settings, writing_style: e.target.value })}
                placeholder="Short sentences. Fragments okay. No corporate speak. Occasional dry humor. I ask questions that make people think."
                rows={3}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Do's and Don'ts</label>
              <p className="text-xs text-gray-400 mb-2">Hard rules. e.g., 'Never use emojis. Always acknowledge the poster's point. No exclamation points.'</p>
              <textarea
                value={settings.dos_and_donts}
                onChange={(e) => setSettings({ ...settings, dos_and_donts: e.target.value })}
                placeholder={`DO: Reference specific points from the post, ask thoughtful questions
DON'T: Use "Great post!", emojis, exclamation points, or buzzwords like "leverage"`}
                rows={4}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Vibe Check */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Vibe Check" section="vibe" description="What's okay in your comments" />
        {expandedSections.vibe && (
          <div className="p-4 bg-gray-800 space-y-3">
            <Toggle
              checked={settings.okay_funny}
              onChange={(v) => setSettings({ ...settings, okay_funny: v })}
              label="Okay to be funny"
              description="Dry humor, self-deprecation, unexpected callbacks"
            />
            <Toggle
              checked={settings.okay_blunt}
              onChange={(v) => setSettings({ ...settings, okay_blunt: v })}
              label="Okay to be blunt"
              description="Direct opinions, challenging assumptions"
            />
            <Toggle
              checked={settings.casual_openers}
              onChange={(v) => setSettings({ ...settings, casual_openers: v })}
              label="Okay to use casual openers"
              description='Starting with "Ha," "Look," "Man," etc.'
            />
            <Toggle
              checked={settings.personal_experience}
              onChange={(v) => setSettings({ ...settings, personal_experience: v })}
              label="Okay to reference personal experience"
              description="Share relevant stories and lessons"
            />
            <Toggle
              checked={settings.strictly_professional}
              onChange={(v) => setSettings({ ...settings, strictly_professional: v })}
              label="Keep it strictly professional"
              description="Disables humor and casual elements"
            />
          </div>
        )}
      </div>

      {/* Section 5: Comment Framework */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Comment Framework" section="framework" description="Structure for your comments" />
        {expandedSections.framework && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Framework Preset</label>
              <select
                value={settings.framework_preset}
                onChange={(e) => setSettings({ ...settings, framework_preset: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              >
                <option value="aca_i">ACA+I (Acknowledge, Add, I-statement, Question)</option>
                <option value="var">VAR (Validate, Add, Relate)</option>
                <option value="hook_value_bridge">Hook-Value-Bridge</option>
                <option value="custom">Custom</option>
              </select>
              <p className="text-xs text-gray-400 mt-2">
                {frameworkDescriptions[settings.framework_preset]}
              </p>
            </div>

            {settings.framework_preset === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Custom Framework</label>
                <textarea
                  value={settings.custom_framework}
                  onChange={(e) => setSettings({ ...settings, custom_framework: e.target.value })}
                  placeholder="Describe your comment structure..."
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Max Characters</label>
              <input
                type="number"
                value={settings.max_characters}
                onChange={(e) => setSettings({ ...settings, max_characters: parseInt(e.target.value) || 300 })}
                min={100}
                max={500}
                className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              />
              <span className="text-gray-400 text-xs ml-2">Range: 100-500</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 6: Example Comments */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Example Comments" section="examples" description="Comments that represent your voice" />
        {expandedSections.examples && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Your Best Comments</label>
              <p className="text-xs text-gray-400 mb-2">Paste 3-5 comments you've written that represent your voice</p>
              <div className="space-y-2 mb-2">
                {(settings.example_comments || []).map((comment, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-300 flex-1">"{comment}"</p>
                    <button
                      onClick={() => removeArrayItem('example_comments', idx)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newExampleComment}
                  onChange={(e) => setNewExampleComment(e.target.value)}
                  placeholder="Paste a comment you've written..."
                  rows={2}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                />
                <button
                  onClick={() => addArrayItem('example_comments', newExampleComment, setNewExampleComment)}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Comments You Admire</label>
              <p className="text-xs text-gray-400 mb-2">Paste comments from others that have the vibe you want</p>
              <div className="space-y-2 mb-2">
                {(settings.admired_comments || []).map((comment, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 bg-gray-700 rounded-lg">
                    <p className="text-sm text-gray-300 flex-1">"{comment}"</p>
                    <button
                      onClick={() => removeArrayItem('admired_comments', idx)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <textarea
                  value={newAdmiredComment}
                  onChange={(e) => setNewAdmiredComment(e.target.value)}
                  placeholder="Paste a comment you admire..."
                  rows={2}
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm"
                />
                <button
                  onClick={() => addArrayItem('admired_comments', newAdmiredComment, setNewAdmiredComment)}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section 7: Relationship & Context */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Relationship & Context" section="context" description="How to adjust based on who you're engaging with" />
        {expandedSections.context && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Default Relationship Tag</label>
              <select
                value={settings.default_relationship_tag}
                onChange={(e) => setSettings({ ...settings, default_relationship_tag: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="prospect">Prospect</option>
                <option value="client">Client</option>
                <option value="peer">Peer</option>
                <option value="thought_leader">Thought Leader</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Comment Scope</label>
              <select
                value={settings.comment_scope}
                onChange={(e) => setSettings({ ...settings, comment_scope: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              >
                <option value="my_expertise">Only my expertise</option>
                <option value="expertise_adjacent">My expertise + adjacent topics</option>
                <option value="anything_relevant">Anything relevant</option>
              </select>
            </div>

            <Toggle
              checked={settings.auto_skip_generic}
              onChange={(v) => setSettings({ ...settings, auto_skip_generic: v })}
              label="Auto-skip generic motivation posts"
              description="Skip 'Your network is your net worth' type posts"
            />
            <Toggle
              checked={settings.post_age_awareness}
              onChange={(v) => setSettings({ ...settings, post_age_awareness: v })}
              label="Post Age Awareness"
              description="Adjust tone for older posts (>24h)"
            />
            <Toggle
              checked={settings.recent_comment_memory}
              onChange={(v) => setSettings({ ...settings, recent_comment_memory: v })}
              label="Recent Comment Memory"
              description="Avoid repeating patterns from recent comments"
            />
          </div>
        )}
      </div>

      {/* Section 8: Guardrails */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Guardrails" section="guardrails" description="Hard limits and restrictions" />
        {expandedSections.guardrails && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Competitors to Never Mention</label>
              <p className="text-xs text-gray-400 mb-2">Names you never want referenced</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(settings.competitors_never_mention || []).map((comp, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-full text-sm text-gray-300">
                    {comp}
                    <button
                      onClick={() => removeArrayItem('competitors_never_mention', idx)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCompetitor}
                  onChange={(e) => setNewCompetitor(e.target.value)}
                  placeholder="Add competitor name..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addArrayItem('competitors_never_mention', newCompetitor, setNewCompetitor);
                    }
                  }}
                />
                <button
                  onClick={() => addArrayItem('competitors_never_mention', newCompetitor, setNewCompetitor)}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">End with CTA</label>
              <ButtonGroup
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'occasionally', label: 'Occasionally' },
                  { value: 'when_relevant', label: 'When Relevant' },
                ]}
                value={settings.end_with_cta}
                onChange={(v) => setSettings({ ...settings, end_with_cta: v })}
              />
            </div>

            {settings.end_with_cta !== 'never' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">CTA Style</label>
                <ButtonGroup
                  options={[
                    { value: 'question_only', label: 'Question Only' },
                    { value: 'soft_invitation', label: 'Soft Invitation' },
                    { value: 'direct_ask', label: 'Direct Ask' },
                  ]}
                  value={settings.cta_style}
                  onChange={(v) => setSettings({ ...settings, cta_style: v })}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 9: Scheduling & Limits */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Scheduling & Limits" section="scheduling" description="When and how often to post comments" />
        {expandedSections.scheduling && (
          <div className="p-4 bg-gray-800 space-y-5">
            {/* Rate Limits */}
            <div className="p-4 bg-red-900/20 rounded-lg border border-red-700/50">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Daily Comment Limit (Hard Limit)
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Comments Per Day</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={settings.daily_comment_limit}
                      onChange={(e) => setSettings({ ...settings, daily_comment_limit: Math.min(30, Math.max(1, parseInt(e.target.value) || 1)) })}
                      min={1}
                      max={30}
                      className="w-24 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                    />
                    <span className="text-gray-400 text-sm">/ day (max 30 enforced)</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Hard limit to protect your account. We recommend 20-30 comments per day.</p>
                </div>
              </div>
            </div>

            {/* Commenting Cadence */}
            <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                Commenting Cadence Per Profile
              </h4>
              <p className="text-xs text-gray-400 mb-4">How often to comment on posts from the same monitored profile</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Days Between</label>
                  <input
                    type="number"
                    value={settings.min_days_between_profile_comments}
                    onChange={(e) => setSettings({ ...settings, min_days_between_profile_comments: Math.max(0, parseInt(e.target.value) || 0) })}
                    min={0}
                    max={30}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Wait at least this many days</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Days Between</label>
                  <input
                    type="number"
                    value={settings.max_days_between_profile_comments}
                    onChange={(e) => setSettings({ ...settings, max_days_between_profile_comments: Math.max(settings.min_days_between_profile_comments, parseInt(e.target.value) || 1) })}
                    min={settings.min_days_between_profile_comments}
                    max={30}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Don't wait longer than this</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Example: {settings.min_days_between_profile_comments}-{settings.max_days_between_profile_comments} days means you'll comment on the same profile every {settings.min_days_between_profile_comments === settings.max_days_between_profile_comments ? `${settings.min_days_between_profile_comments} days` : `${settings.min_days_between_profile_comments} to ${settings.max_days_between_profile_comments} days`}.
              </p>
            </div>

            {/* Profile Scraping Limits */}
            <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/50">
              <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                Profile Scraping Limits
              </h4>
              <p className="text-xs text-gray-400 mb-4">Control how often we check monitored profiles for new posts</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Days Between Profile Scrapes</label>
                  <input
                    type="number"
                    value={settings.profile_scrape_interval_days}
                    onChange={(e) => setSettings({ ...settings, profile_scrape_interval_days: Math.min(30, Math.max(1, parseInt(e.target.value) || 1)) })}
                    min={1}
                    max={30}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">1 = daily, 7 = weekly, 30 = monthly</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Max Profile Scrapes Per Day</label>
                  <input
                    type="number"
                    value={settings.max_profile_scrapes_per_day}
                    onChange={(e) => setSettings({ ...settings, max_profile_scrapes_per_day: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)) })}
                    min={1}
                    max={20}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Max 20 profiles per day</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                With {settings.profile_scrape_interval_days} day interval and {settings.max_profile_scrapes_per_day} max per day, you can monitor up to ~{Math.floor(settings.max_profile_scrapes_per_day * settings.profile_scrape_interval_days)} profiles.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Target Country</label>
                <select
                  value={settings.country_code}
                  onChange={(e) => {
                    const country = e.target.value;
                    // Auto-set timezone based on country
                    const timezones: Record<string, string> = {
                      US: 'America/New_York',
                      CA: 'America/Toronto',
                      GB: 'Europe/London',
                      DE: 'Europe/Berlin',
                      FR: 'Europe/Paris',
                      NL: 'Europe/Amsterdam',
                      BE: 'Europe/Brussels',
                      CH: 'Europe/Zurich',
                      AT: 'Europe/Vienna',
                      IT: 'Europe/Rome',
                      ES: 'Europe/Madrid',
                      PT: 'Europe/Lisbon',
                      IE: 'Europe/Dublin',
                      ZA: 'Africa/Johannesburg',
                      AU: 'Australia/Sydney',
                      NZ: 'Pacific/Auckland',
                      JP: 'Asia/Tokyo',
                      SG: 'Asia/Singapore',
                      AE: 'Asia/Dubai',
                      SA: 'Asia/Riyadh',
                    };
                    setSettings({
                      ...settings,
                      country_code: country,
                      timezone: timezones[country] || settings.timezone
                    });
                  }}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                >
                  <optgroup label="Americas">
                    <option value="US">🇺🇸 United States</option>
                    <option value="CA">🇨🇦 Canada</option>
                  </optgroup>
                  <optgroup label="Europe">
                    <option value="GB">🇬🇧 United Kingdom</option>
                    <option value="DE">🇩🇪 Germany</option>
                    <option value="FR">🇫🇷 France</option>
                    <option value="NL">🇳🇱 Netherlands</option>
                    <option value="BE">🇧🇪 Belgium</option>
                    <option value="CH">🇨🇭 Switzerland</option>
                    <option value="AT">🇦🇹 Austria</option>
                    <option value="IT">🇮🇹 Italy</option>
                    <option value="ES">🇪🇸 Spain</option>
                    <option value="PT">🇵🇹 Portugal</option>
                    <option value="IE">🇮🇪 Ireland</option>
                  </optgroup>
                  <optgroup label="Africa">
                    <option value="ZA">🇿🇦 South Africa</option>
                  </optgroup>
                  <optgroup label="Asia-Pacific">
                    <option value="AU">🇦🇺 Australia</option>
                    <option value="NZ">🇳🇿 New Zealand</option>
                    <option value="JP">🇯🇵 Japan</option>
                    <option value="SG">🇸🇬 Singapore</option>
                  </optgroup>
                  <optgroup label="Middle East">
                    <option value="AE">🇦🇪 UAE</option>
                    <option value="SA">🇸🇦 Saudi Arabia</option>
                  </optgroup>
                </select>
                <p className="text-xs text-gray-500 mt-1">Used for holidays & weekend schedules</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Time Zone</label>
                <select
                  value={settings.timezone}
                  onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                >
                  <optgroup label="Americas">
                    <option value="America/New_York">Eastern Time (ET)</option>
                    <option value="America/Chicago">Central Time (CT)</option>
                    <option value="America/Denver">Mountain Time (MT)</option>
                    <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    <option value="America/Toronto">Toronto (ET)</option>
                  </optgroup>
                  <optgroup label="Europe">
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Europe/Berlin">Berlin (CET)</option>
                    <option value="Europe/Paris">Paris (CET)</option>
                    <option value="Europe/Amsterdam">Amsterdam (CET)</option>
                    <option value="Europe/Brussels">Brussels (CET)</option>
                    <option value="Europe/Zurich">Zurich (CET)</option>
                    <option value="Europe/Vienna">Vienna (CET)</option>
                    <option value="Europe/Rome">Rome (CET)</option>
                    <option value="Europe/Madrid">Madrid (CET)</option>
                    <option value="Europe/Lisbon">Lisbon (WET)</option>
                    <option value="Europe/Dublin">Dublin (GMT/IST)</option>
                  </optgroup>
                  <optgroup label="Africa">
                    <option value="Africa/Johannesburg">Johannesburg (SAST)</option>
                  </optgroup>
                  <optgroup label="Asia-Pacific">
                    <option value="Australia/Sydney">Sydney (AEST)</option>
                    <option value="Pacific/Auckland">Auckland (NZST)</option>
                    <option value="Asia/Tokyo">Tokyo (JST)</option>
                    <option value="Asia/Singapore">Singapore (SGT)</option>
                  </optgroup>
                  <optgroup label="Middle East">
                    <option value="Asia/Dubai">Dubai (GST)</option>
                    <option value="Asia/Riyadh">Riyadh (AST)</option>
                  </optgroup>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Start Posting Time</label>
                <input
                  type="time"
                  value={settings.posting_start_time}
                  onChange={(e) => setSettings({ ...settings, posting_start_time: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Stop Posting Time</label>
                <input
                  type="time"
                  value={settings.posting_end_time}
                  onChange={(e) => setSettings({ ...settings, posting_end_time: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                />
              </div>
            </div>

            <Toggle
              checked={settings.post_on_weekends}
              onChange={(v) => setSettings({ ...settings, post_on_weekends: v })}
              label="Post on Weekends"
              description="Allow comments on Saturdays and Sundays"
            />
            <Toggle
              checked={settings.post_on_holidays}
              onChange={(v) => setSettings({ ...settings, post_on_holidays: v })}
              label="Post on Holidays"
              description={`Allow comments on ${settings.country_code === 'US' ? 'US' : settings.country_code} public holidays`}
            />
          </div>
        )}
      </div>

      {/* Section 10: Engagement & Automation */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Engagement & Automation" section="automation" description="Auto-posting, blacklists, and reply settings" />
        {expandedSections.automation && (
          <div className="p-4 bg-gray-800 space-y-5">
            {/* Tag Post Authors */}
            <Toggle
              checked={settings.tag_post_authors}
              onChange={(v) => setSettings({ ...settings, tag_post_authors: v })}
              label="Tag Post Authors"
              description="Mention authors in comments with @username"
            />

            {/* Monitor Comments */}
            <Toggle
              checked={settings.monitor_comments}
              onChange={(v) => setSettings({ ...settings, monitor_comments: v })}
              label="Monitor Comments on Posts"
              description="Track comments to find reply opportunities"
            />

            {/* Reply to High-Engagement Comments */}
            <Toggle
              checked={settings.reply_to_high_engagement}
              onChange={(v) => setSettings({ ...settings, reply_to_high_engagement: v })}
              label="Reply to High-Engagement Comments"
              description="Generate replies to popular comments on posts"
            />

            {/* Blacklisted Profiles */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Blacklisted Profiles</label>
              <p className="text-xs text-gray-400 mb-2">LinkedIn profiles you never want to engage with</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(settings.blacklisted_profiles || []).map((profile, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 rounded-full text-sm text-gray-300">
                    {profile}
                    <button
                      onClick={() => removeArrayItem('blacklisted_profiles', idx)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBlacklistedProfile}
                  onChange={(e) => setNewBlacklistedProfile(e.target.value)}
                  placeholder="linkedin.com/in/username or vanity name..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addArrayItem('blacklisted_profiles', newBlacklistedProfile, setNewBlacklistedProfile);
                    }
                  }}
                />
                <button
                  onClick={() => addArrayItem('blacklisted_profiles', newBlacklistedProfile, setNewBlacklistedProfile)}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Auto-Approval Window */}
            <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-white font-medium text-sm">Auto-Approve Comments</div>
                  <div className="text-gray-400 text-xs">Automatically post comments without manual review</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auto_approve_enabled}
                    onChange={(e) => setSettings({ ...settings, auto_approve_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {settings.auto_approve_enabled && (
                <>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Auto-Approve Start Time</label>
                      <input
                        type="time"
                        value={settings.auto_approve_start_time}
                        onChange={(e) => setSettings({ ...settings, auto_approve_start_time: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-300 mb-1">Auto-Approve End Time</label>
                      <input
                        type="time"
                        value={settings.auto_approve_end_time}
                        onChange={(e) => setSettings({ ...settings, auto_approve_end_time: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Comments generated between {settings.auto_approve_start_time} - {settings.auto_approve_end_time} will be auto-approved and posted.
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Section 12: Post Type Blocklist */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Post Type Blocklist" section="blocklist" description="Filter out certain types of posts" />
        {expandedSections.blocklist && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
              <p className="text-blue-200 text-xs">Block certain types of posts from being discovered and shown in your approval queue. These filters are applied during post discovery.</p>
            </div>

            <Toggle
              checked={settings.block_job_posts}
              onChange={(v) => setSettings({ ...settings, block_job_posts: v })}
              label="Block Job Postings"
              description="Filter out hiring announcements, job listings, and recruitment posts"
            />

            <Toggle
              checked={settings.block_event_posts}
              onChange={(v) => setSettings({ ...settings, block_event_posts: v })}
              label="Block Event Promotions"
              description="Filter out webinar invites, conference announcements, and event promotions"
            />

            <Toggle
              checked={settings.block_promotional_posts}
              onChange={(v) => setSettings({ ...settings, block_promotional_posts: v })}
              label="Block Promotional/Sales Posts"
              description="Filter out product launches, sales pitches, and promotional content"
            />

            <Toggle
              checked={settings.block_repost_only}
              onChange={(v) => setSettings({ ...settings, block_repost_only: v })}
              label="Block Reposts Without Commentary"
              description="Filter out shared posts without original commentary"
            />

            <Toggle
              checked={settings.block_generic_motivation}
              onChange={(v) => setSettings({ ...settings, block_generic_motivation: v })}
              label="Block Generic Motivation Posts"
              description="Filter out 'hustle culture' and generic motivational content"
            />

            <Toggle
              checked={settings.block_self_promotion}
              onChange={(v) => setSettings({ ...settings, block_self_promotion: v })}
              label="Block Self-Promotion Posts"
              description="Filter out 'I'm thrilled to announce' and braggy achievement posts"
            />

            {/* Custom Blocked Keywords */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Custom Blocked Keywords</label>
              <p className="text-xs text-gray-400 mb-2">Posts containing these words/phrases will be filtered out</p>
              <div className="flex flex-wrap gap-2 mb-2">
                {(settings.custom_blocked_keywords || []).map((keyword, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-red-900/30 border border-red-700/50 rounded-full text-sm text-red-200">
                    {keyword}
                    <button
                      onClick={() => removeArrayItem('custom_blocked_keywords', idx)}
                      className="text-red-300 hover:text-red-100"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBlockedKeyword}
                  onChange={(e) => setNewBlockedKeyword(e.target.value)}
                  placeholder="Add keyword or phrase to block..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addArrayItem('custom_blocked_keywords', newBlockedKeyword, setNewBlockedKeyword);
                    }
                  }}
                />
                <button
                  onClick={() => addArrayItem('custom_blocked_keywords', newBlockedKeyword, setNewBlockedKeyword)}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-700 text-white rounded-lg"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section: Target Countries Filter */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Target Countries" section="countries" description="Filter posts by author's country/region" />
        {expandedSections.countries && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div className="p-3 bg-green-900/20 border border-green-700/50 rounded-lg mb-4">
              <p className="text-green-200 text-xs">Only discover posts from authors located in these countries. Leave empty to discover posts from all countries.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Selected Countries</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {(settings.target_countries || []).map((country, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-900/30 border border-green-700/50 rounded-full text-sm text-green-200">
                    {country}
                    <button
                      onClick={() => removeArrayItem('target_countries', idx)}
                      className="text-green-300 hover:text-green-100 ml-1"
                    >
                      <X size={14} />
                    </button>
                  </span>
                ))}
                {(settings.target_countries || []).length === 0 && (
                  <span className="text-gray-500 text-sm italic">No countries selected - posts from all countries will be discovered</span>
                )}
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-2">Add Countries</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {[
                  { code: 'United States', label: '🇺🇸 United States' },
                  { code: 'Canada', label: '🇨🇦 Canada' },
                  { code: 'United Kingdom', label: '🇬🇧 United Kingdom' },
                  { code: 'Germany', label: '🇩🇪 Germany' },
                  { code: 'France', label: '🇫🇷 France' },
                  { code: 'Netherlands', label: '🇳🇱 Netherlands' },
                  { code: 'Australia', label: '🇦🇺 Australia' },
                  { code: 'Singapore', label: '🇸🇬 Singapore' },
                  { code: 'India', label: '🇮🇳 India' },
                  { code: 'Ireland', label: '🇮🇪 Ireland' },
                  { code: 'Switzerland', label: '🇨🇭 Switzerland' },
                  { code: 'Spain', label: '🇪🇸 Spain' },
                  { code: 'Italy', label: '🇮🇹 Italy' },
                  { code: 'Sweden', label: '🇸🇪 Sweden' },
                  { code: 'Norway', label: '🇳🇴 Norway' },
                  { code: 'Denmark', label: '🇩🇰 Denmark' },
                  { code: 'Belgium', label: '🇧🇪 Belgium' },
                  { code: 'Austria', label: '🇦🇹 Austria' },
                  { code: 'New Zealand', label: '🇳🇿 New Zealand' },
                  { code: 'Japan', label: '🇯🇵 Japan' },
                  { code: 'South Africa', label: '🇿🇦 South Africa' },
                  { code: 'United Arab Emirates', label: '🇦🇪 UAE' },
                  { code: 'Israel', label: '🇮🇱 Israel' },
                  { code: 'Brazil', label: '🇧🇷 Brazil' },
                ].map((country) => {
                  const isSelected = (settings.target_countries || []).includes(country.code);
                  return (
                    <button
                      key={country.code}
                      onClick={() => {
                        if (isSelected) {
                          const idx = settings.target_countries.indexOf(country.code);
                          if (idx > -1) removeArrayItem('target_countries', idx);
                        } else {
                          setSettings(prev => ({
                            ...prev,
                            target_countries: [...(prev.target_countries || []), country.code]
                          }));
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-green-600 text-white border border-green-500'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                      }`}
                    >
                      {country.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-3">Click countries to add or remove them from your filter. Country matching is based on the author's LinkedIn location.</p>
            </div>
          </div>
        )}
      </div>

      {/* Section 13: Email Digest */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Email Digest" section="digest" description="Daily email with pending comments for approval" />
        {expandedSections.digest && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div className="p-3 bg-pink-900/20 border border-pink-700/50 rounded-lg mb-4">
              <p className="text-pink-200 text-xs">Receive a daily email with AI-generated comments waiting for your approval. Click Approve or Reject directly from your inbox.</p>
            </div>

            <Toggle
              checked={settings.digest_enabled}
              onChange={(v) => setSettings({ ...settings, digest_enabled: v })}
              label="Enable Email Digest"
              description="Receive daily email with pending comments"
            />

            {settings.digest_enabled && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                  <input
                    type="email"
                    value={settings.digest_email}
                    onChange={(e) => setSettings({ ...settings, digest_email: e.target.value })}
                    placeholder="your@email.com"
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Where to send the daily digest</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Digest Timezone</label>
                  <select
                    value={settings.digest_timezone}
                    onChange={(e) => setSettings({ ...settings, digest_timezone: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
                  >
                    <optgroup label="Americas">
                      <option value="America/New_York">Eastern Time (ET)</option>
                      <option value="America/Chicago">Central Time (CT)</option>
                      <option value="America/Denver">Mountain Time (MT)</option>
                      <option value="America/Los_Angeles">Pacific Time (PT)</option>
                    </optgroup>
                    <optgroup label="Europe">
                      <option value="Europe/London">London (GMT/BST)</option>
                      <option value="Europe/Berlin">Berlin (CET)</option>
                      <option value="Europe/Paris">Paris (CET)</option>
                    </optgroup>
                    <optgroup label="Asia-Pacific">
                      <option value="Australia/Sydney">Sydney (AEST)</option>
                      <option value="Asia/Tokyo">Tokyo (JST)</option>
                      <option value="Asia/Singapore">Singapore (SGT)</option>
                    </optgroup>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Digest is sent at 8:00 AM in your timezone</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Section 15: VIP/Priority Profiles (Added Dec 30, 2025) */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="VIP/Priority Profiles" section="priority_profiles" description="Special treatment for important contacts" />
        {expandedSections.priority_profiles && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div className="p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg mb-4">
              <p className="text-yellow-200 text-xs">Add profiles of partners, clients, or important contacts. Sam will use a warmer, more personalized tone when commenting on their posts.</p>
            </div>

            {/* Existing Priority Profiles */}
            {settings.priority_profiles.length > 0 && (
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-300">Current VIP Profiles</label>
                {settings.priority_profiles.map((profile, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg border border-gray-600">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{profile.name}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          profile.relationship === 'partner' ? 'bg-purple-900/50 text-purple-300' :
                          profile.relationship === 'client' ? 'bg-blue-900/50 text-blue-300' :
                          profile.relationship === 'friend' ? 'bg-green-900/50 text-green-300' :
                          profile.relationship === 'prospect' ? 'bg-orange-900/50 text-orange-300' :
                          'bg-pink-900/50 text-pink-300'
                        }`}>
                          {profile.relationship}
                        </span>
                        {profile.never_miss && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300">Never Miss</span>
                        )}
                      </div>
                      {profile.tone_override && (
                        <p className="text-gray-400 text-xs mt-1">Tone: {profile.tone_override}</p>
                      )}
                      {profile.notes && (
                        <p className="text-gray-500 text-xs mt-1">Notes: {profile.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSettings(prev => ({
                          ...prev,
                          priority_profiles: prev.priority_profiles.filter((_, i) => i !== idx)
                        }));
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add New Profile Form */}
            <div className="p-4 bg-gray-700/50 rounded-lg border border-gray-600 space-y-4">
              <label className="block text-sm font-medium text-gray-300">Add New VIP Profile</label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Name *</label>
                  <input
                    type="text"
                    value={newPriorityProfile.name || ''}
                    onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., John Smith"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">LinkedIn Profile ID *</label>
                  <input
                    type="text"
                    value={newPriorityProfile.profile_id || ''}
                    onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, profile_id: e.target.value }))}
                    placeholder="e.g., john-smith-123abc"
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Relationship Type *</label>
                  <select
                    value={newPriorityProfile.relationship || 'partner'}
                    onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, relationship: e.target.value as PriorityProfile['relationship'] }))}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="partner">Partner/Associate</option>
                    <option value="client">Client/Customer</option>
                    <option value="friend">Friend/Close Connection</option>
                    <option value="prospect">High-Priority Prospect</option>
                    <option value="thought_leader">Thought Leader</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Profile URL (optional)</label>
                  <input
                    type="text"
                    value={newPriorityProfile.profile_url || ''}
                    onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, profile_url: e.target.value }))}
                    placeholder="https://linkedin.com/in/..."
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Custom Tone Override (optional)</label>
                <input
                  type="text"
                  value={newPriorityProfile.tone_override || ''}
                  onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, tone_override: e.target.value }))}
                  placeholder="e.g., warm and personal, like talking to a close colleague"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes for AI (optional)</label>
                <input
                  type="text"
                  value={newPriorityProfile.notes || ''}
                  onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="e.g., Met at conference, interested in AI topics"
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="never_miss"
                  checked={newPriorityProfile.never_miss || false}
                  onChange={(e) => setNewPriorityProfile(prev => ({ ...prev, never_miss: e.target.checked }))}
                  className="w-4 h-4 text-pink-600 bg-gray-700 border-gray-600 rounded focus:ring-pink-500"
                />
                <label htmlFor="never_miss" className="text-sm text-gray-300">Never Miss - Always prioritize their posts</label>
              </div>

              <button
                onClick={() => {
                  if (newPriorityProfile.name && newPriorityProfile.profile_id && newPriorityProfile.relationship) {
                    setSettings(prev => ({
                      ...prev,
                      priority_profiles: [...prev.priority_profiles, newPriorityProfile as PriorityProfile]
                    }));
                    setNewPriorityProfile({
                      name: '',
                      profile_id: '',
                      profile_url: '',
                      relationship: 'partner',
                      tone_override: '',
                      notes: '',
                      never_miss: false,
                    });
                  }
                }}
                disabled={!newPriorityProfile.name || !newPriorityProfile.profile_id}
                className="w-full px-4 py-2 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Add VIP Profile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section 16: Opportunity Digest (Added Dec 30, 2025) */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Opportunity Digest" section="opportunity_digest" description="Daily email with trending posts to engage with" />
        {expandedSections.opportunity_digest && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg mb-4">
              <p className="text-blue-200 text-xs">Get a daily email highlighting high-engagement posts from your monitors that are opportunities for meaningful engagement.</p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="opportunity_digest_enabled"
                checked={settings.opportunity_digest_enabled}
                onChange={(e) => setSettings({ ...settings, opportunity_digest_enabled: e.target.checked })}
                className="w-4 h-4 text-pink-600 bg-gray-700 border-gray-600 rounded focus:ring-pink-500"
              />
              <label htmlFor="opportunity_digest_enabled" className="text-sm text-gray-300">Enable Opportunity Digest</label>
            </div>

            {settings.opportunity_digest_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Digest Time</label>
                <input
                  type="time"
                  value={settings.opportunity_digest_time}
                  onChange={(e) => setSettings({ ...settings, opportunity_digest_time: e.target.value })}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
                <p className="text-xs text-gray-500 mt-1">Time in your workspace timezone ({settings.timezone})</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 17: Advanced */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Advanced" section="advanced" description="System prompt override (experts only)" />
        {expandedSections.advanced && (
          <div className="p-4 bg-gray-800">
            <div className="flex items-start gap-2 p-3 bg-yellow-900/30 border border-yellow-700/50 rounded-lg mb-4">
              <Info size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
              <p className="text-yellow-200 text-xs">Only modify if you know what you're doing. The system prompt is auto-generated from your settings above.</p>
            </div>
            <textarea
              value={settings.system_prompt}
              onChange={(e) => setSettings({ ...settings, system_prompt: e.target.value })}
              placeholder="Leave empty to use auto-generated prompt based on your settings..."
              rows={8}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none text-sm font-mono"
            />
          </div>
        )}
      </div>

      {/* Save Button */}
      {saveMessage && (
        <div className={`p-3 rounded-lg text-sm ${
          saveMessage.includes('success')
            ? 'bg-green-900/30 border border-green-700/50 text-green-200'
            : 'bg-red-900/30 border border-red-700/50 text-red-200'
        }`}>
          {saveMessage}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 font-medium"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          Save All Settings
        </button>
      </div>
    </div>
  );
}
