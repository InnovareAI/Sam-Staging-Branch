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

  // Section 9: Scheduling
  timezone: string;
  posting_start_time: string;
  posting_end_time: string;
  post_on_weekends: boolean;
  post_on_holidays: boolean;

  // Section 10: Advanced
  system_prompt: string;
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
  posting_start_time: '09:00',
  posting_end_time: '17:00',
  post_on_weekends: false,
  post_on_holidays: false,
  system_prompt: '',
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
    advanced: false,
  });

  // Temp inputs for array fields
  const [newExampleComment, setNewExampleComment] = useState('');
  const [newAdmiredComment, setNewAdmiredComment] = useState('');
  const [newCompetitor, setNewCompetitor] = useState('');

  useEffect(() => {
    loadSettings();
  }, [workspaceId]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
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
          posting_start_time: data.posting_start_time || defaultSettings.posting_start_time,
          posting_end_time: data.posting_end_time || defaultSettings.posting_end_time,
          post_on_weekends: data.post_on_weekends ?? defaultSettings.post_on_weekends,
          post_on_holidays: data.post_on_holidays ?? defaultSettings.post_on_holidays,
          system_prompt: data.system_prompt || '',
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
      const supabase = createClient();

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
        posting_start_time: settings.posting_start_time,
        posting_end_time: settings.posting_end_time,
        post_on_weekends: settings.post_on_weekends,
        post_on_holidays: settings.post_on_holidays,
        system_prompt: settings.system_prompt || null,
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

  const addArrayItem = (field: 'example_comments' | 'admired_comments' | 'competitors_never_mention', value: string, setter: (v: string) => void) => {
    if (value.trim()) {
      setSettings(prev => ({
        ...prev,
        [field]: [...(prev[field] || []), value.trim()]
      }));
      setter('');
    }
  };

  const removeArrayItem = (field: 'example_comments' | 'admired_comments' | 'competitors_never_mention', index: number) => {
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

      {/* Section 9: Scheduling */}
      <div className="border border-gray-600 rounded-lg overflow-hidden">
        <SectionHeader title="Scheduling" section="scheduling" description="When to post comments" />
        {expandedSections.scheduling && (
          <div className="p-4 bg-gray-800 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Time Zone</label>
              <select
                value={settings.timezone}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-pink-500 text-sm"
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Phoenix">Arizona (No DST)</option>
                <option value="America/Anchorage">Alaska Time</option>
                <option value="Pacific/Honolulu">Hawaii Time</option>
                <option value="Europe/London">London (GMT/BST)</option>
                <option value="Europe/Paris">Central European (CET)</option>
                <option value="Europe/Berlin">Berlin (CET)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Asia/Tokyo">Tokyo (JST)</option>
                <option value="Australia/Sydney">Sydney (AEST)</option>
              </select>
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
              description="Allow comments on US public holidays"
            />
          </div>
        )}
      </div>

      {/* Section 10: Advanced */}
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
