'use client';

import React, { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Edit,
    MessageSquare,
    Plus,
    Trash2,
    Info,
    FlaskConical,
    Sparkles,
    Wand2,
    ClipboardPaste,
    Loader2,
    Send,
    User,
    Building,
    Briefcase,
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toastSuccess, toastError, toastWarning } from "@/lib/toast";

// Types
import type { Campaign } from "@/types/campaign";

interface CampaignEditModalProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    campaign: Campaign;
    onSave: (data: any) => Promise<void>;
}

export function CampaignEditModal({
    isOpen,
    onOpenChange,
    campaign,
    onSave
}: CampaignEditModalProps) {
    const [formData, setFormData] = useState<any>(null);
    const [isSaving, setIsSaving] = useState(false);

    // AI Features State
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const [showSamModal, setShowSamModal] = useState(false);
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [samMessages, setSamMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const [samInput, setSamInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [pastedText, setPastedText] = useState('');
    const [isParsing, setIsParsing] = useState(false);
    const [isImproving, setIsImproving] = useState<string | null>(null);
    const chatRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (campaign && isOpen) {
            // Messages can be in message_templates (newer) OR flow_settings.messages (older/runtime)
            const templates = campaign.message_templates || {};
            const flowMessages = (campaign as any).flow_settings?.messages || {};

            // Helper to extract follow-up messages from either location
            const getFollowUps = () => {
                // First try message_templates.follow_up_messages (array format)
                if (Array.isArray(templates.follow_up_messages) && templates.follow_up_messages.length > 0) {
                    return templates.follow_up_messages;
                }
                // Fallback to flow_settings.messages (individual follow_up_1, follow_up_2, etc.)
                const followUps = [];
                for (let i = 1; i <= 5; i++) {
                    const msg = flowMessages[`follow_up_${i}`];
                    if (msg) followUps.push({ message: msg, delay_days: 3 });
                }
                return followUps.length > 0 ? followUps : [];
            };

            setFormData({
                name: campaign.name || '',
                connection_message: templates.connection_request || flowMessages.connection_request || '',
                alternative_message: templates.alternative_message || flowMessages.alternative || '',
                email_body: templates.email_body || '',
                initial_subject: templates.initial_subject || (campaign as any).flow_settings?.subjects?.initial || '',
                follow_up_subjects: templates.follow_up_subjects || (campaign as any).flow_settings?.subjects?.follow_ups || [],
                use_threaded_replies: templates.use_threaded_replies || (campaign as any).flow_settings?.subjects?.use_threaded_replies || false,
                ab_testing_enabled: templates.ab_testing_enabled || false,
                connection_request_b: templates.connection_request_b || '',
                alternative_message_b: templates.alternative_message_b || '',
                email_body_b: templates.email_body_b || '',
                initial_subject_b: templates.initial_subject_b || '',
                follow_up_messages: getFollowUps()
            });
        }
    }, [campaign, isOpen]);

    if (!formData) return null;

    const isEmail = campaign.campaign_type === 'email';
    const isMessenger = campaign.campaign_type === 'messenger';
    const isConnector = !isEmail && !isMessenger;

    const handleAddFollowUp = () => {
        if (formData.follow_up_messages.length >= 15) return;
        setFormData({
            ...formData,
            follow_up_messages: [...formData.follow_up_messages, { message: '', delay_days: 2 }]
        });
    };

    const handleRemoveFollowUp = (index: number) => {
        const updated = [...formData.follow_up_messages];
        updated.splice(index, 1);
        setFormData({ ...formData, follow_up_messages: updated });
    };

    const handleFollowUpChange = (index: number, field: string, value: any) => {
        const updated = [...formData.follow_up_messages];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, follow_up_messages: updated });
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(formData);
            onOpenChange(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    // Placeholder insertion
    const insertPlaceholder = (placeholder: string) => {
        if (!focusedField) {
            toastWarning('Click on a message field first');
            return;
        }
        const currentValue = formData[focusedField] || '';
        setFormData({ ...formData, [focusedField]: currentValue + placeholder });
    };

    // SAM AI Generation
    const startSamGeneration = () => {
        const campaignTypeLabel = campaign.campaign_type === 'connector'
            ? 'connector campaign (2nd/3rd degree connections)'
            : campaign.campaign_type === 'messenger'
                ? 'messenger campaign (1st degree connections)'
                : 'email campaign';

        setShowSamModal(true);
        setSamMessages([{
            role: 'assistant',
            content: `Hi! I'm SAM, and I'll help you improve your messaging templates for the ${campaignTypeLabel} "${campaign.name}".\n\nTell me:\n1. What's your main goal with this campaign?\n2. What value can you offer prospects?\n3. Any specific tone you prefer?\n\nI'll generate compelling messages that get responses! 🎯`
        }]);
    };

    const sendSamMessage = async () => {
        if (!samInput.trim() || isGenerating) return;

        const userMessage = samInput.trim();
        setSamInput('');
        setSamMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsGenerating(true);

        try {
            const response = await fetch('/api/sam/generate-templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    campaign_name: campaign.name,
                    campaign_type: campaign.campaign_type,
                    user_input: userMessage,
                    conversation_history: samMessages
                })
            });

            const result = await response.json();

            setSamMessages(prev => [...prev, {
                role: 'assistant',
                content: result.response || 'Here are your templates!'
            }]);

            // Auto-apply templates if SAM provides them
            if (result.templates) {
                if (result.templates.connection_message && isConnector) {
                    setFormData((prev: any) => ({ ...prev, connection_message: result.templates.connection_message }));
                }
                if (result.templates.alternative_message) {
                    setFormData((prev: any) => ({ ...prev, alternative_message: result.templates.alternative_message }));
                }
                if (result.templates.follow_up_messages) {
                    setFormData((prev: any) => ({
                        ...prev,
                        follow_up_messages: result.templates.follow_up_messages.map((msg: string) => ({ message: msg, delay_days: 3 }))
                    }));
                }
                toastSuccess('Templates applied!');
            }
        } catch (error) {
            setSamMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I had trouble generating templates. Please try again or manually edit your messages.'
            }]);
        } finally {
            setIsGenerating(false);
        }
    };

    // Paste Template Parsing
    const handlePasteTemplate = async () => {
        if (!pastedText.trim()) {
            toastWarning('Please paste some template text first');
            return;
        }

        setIsParsing(true);
        try {
            const response = await fetch('/api/campaigns/parse-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pastedText, campaignType: campaign.campaign_type })
            });

            const result = await response.json();

            if (result.success && result.parsed) {
                if (result.parsed.connectionMessage && isConnector) {
                    setFormData((prev: any) => ({ ...prev, connection_message: result.parsed.connectionMessage }));
                }
                if (result.parsed.alternativeMessage) {
                    setFormData((prev: any) => ({ ...prev, alternative_message: result.parsed.alternativeMessage }));
                }
                if (result.parsed.followUpMessages?.length > 0) {
                    setFormData((prev: any) => ({
                        ...prev,
                        follow_up_messages: result.parsed.followUpMessages.map((msg: string) => ({ message: msg, delay_days: 3 }))
                    }));
                }
                toastSuccess('Template parsed and applied!');
                setShowPasteModal(false);
                setPastedText('');
            } else {
                toastError(result.error || 'Failed to parse template');
            }
        } catch (error) {
            toastError('Failed to parse template');
        } finally {
            setIsParsing(false);
        }
    };

    // Improve message with AI
    const improveMessage = async (field: string) => {
        const currentMessage = formData[field];
        if (!currentMessage?.trim()) {
            toastWarning('No message to improve. Write something first!');
            return;
        }

        setIsImproving(field);
        try {
            const response = await fetch('/api/campaigns/parse-template', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pastedText: currentMessage,
                    campaignType: campaign.campaign_type,
                    enhancePrompt: 'Improve this message to be more engaging and professional while keeping placeholders intact.'
                })
            });

            const result = await response.json();
            if (result.success && result.parsed?.connectionMessage) {
                setFormData((prev: any) => ({ ...prev, [field]: result.parsed.connectionMessage }));
                toastSuccess('Message improved!');
            } else if (result.parsed?.alternativeMessage) {
                setFormData((prev: any) => ({ ...prev, [field]: result.parsed.alternativeMessage }));
                toastSuccess('Message improved!');
            }
        } catch (error) {
            toastError('Failed to improve message');
        } finally {
            setIsImproving(null);
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden glass-effect shadow-2xl flex flex-col">
                    <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                                <Edit className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-semibold tracking-tight">Edit Messaging</DialogTitle>
                                <DialogDescription className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                                    Modify outreach templates and logic for <span className="text-foreground">{campaign.name}</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* AI & Placeholder Toolbar */}
                    <div className="px-6 py-3 border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 mr-3 flex-wrap">
                            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Insert:</span>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => insertPlaceholder('{first_name}')}>
                                <User className="w-3 h-3" /> First Name
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => insertPlaceholder('{last_name}')}>
                                Last Name
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => insertPlaceholder('{company}')}>
                                <Building className="w-3 h-3" /> Company
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => insertPlaceholder('{title}')}>
                                <Briefcase className="w-3 h-3" /> Title
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => insertPlaceholder('{headline}')}>
                                Headline
                            </Button>
                            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px] gap-1" onClick={() => insertPlaceholder('{location}')}>
                                Location
                            </Button>
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10" onClick={startSamGeneration}>
                                <Wand2 className="w-3.5 h-3.5" /> Generate with SAM
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs gap-1.5" onClick={() => setShowPasteModal(true)}>
                                <ClipboardPaste className="w-3.5 h-3.5" /> Paste Template
                            </Button>
                        </div>
                    </div>

                    <Tabs defaultValue="content" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b border-border/40 bg-muted/30 shrink-0">
                            <TabsList className="bg-transparent h-12 gap-6 p-0">
                                <TabsTrigger value="content" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 font-medium uppercase text-[10px] tracking-widest">
                                    Message Templates
                                </TabsTrigger>
                                <TabsTrigger value="sequences" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 font-medium uppercase text-[10px] tracking-widest">
                                    Follow-up Sequences
                                </TabsTrigger>
                                <TabsTrigger value="ab-testing" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary border-b-2 border-transparent data-[state=active]:border-primary rounded-none h-full px-0 font-medium uppercase text-[10px] tracking-widest">
                                    A/B Testing
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-6">
                                <TabsContent value="content" className="mt-0 space-y-6">
                                    {/* Campaign Name */}
                                    <div className="space-y-2">
                                        <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Campaign Identity</Label>
                                        <Input
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="bg-background/40 border-border/40 focus:border-primary/40 font-semibold"
                                            placeholder="e.g. Q4 Executive Outreach"
                                        />
                                    </div>

                                    {/* Step 1 Logic */}
                                    {isConnector && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-primary">Connection Message (Step 1)</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1 text-purple-400 hover:bg-purple-500/10" onClick={() => improveMessage('connection_message')} disabled={isImproving === 'connection_message'}>
                                                            {isImproving === 'connection_message' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Improve
                                                        </Button>
                                                        <span className="text-[10px] font-medium text-muted-foreground/40">{formData.connection_message.length}/300</span>
                                                    </div>
                                                </div>
                                                <Textarea
                                                    value={formData.connection_message}
                                                    onChange={(e) => setFormData({ ...formData, connection_message: e.target.value })}
                                                    onFocus={() => setFocusedField('connection_message')}
                                                    maxLength={300}
                                                    className="min-h-[120px] bg-background/40 border-border/40 focus:border-primary/40 leading-relaxed font-medium"
                                                    placeholder="Hi {{firstName}}, I noticed your work at {{company}}..."
                                                />
                                                <p className="text-[10px] text-muted-foreground/60 italic flex items-center gap-1.5 font-medium">
                                                    <span className="text-primary/60 font-black">★</span>
                                                    Pro-tip: Keep it under 200 characters for 15% higher acceptance rates.
                                                </p>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Alternative Message (Already Connected)</Label>
                                                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px] gap-1 text-purple-400 hover:bg-purple-500/10" onClick={() => improveMessage('alternative_message')} disabled={isImproving === 'alternative_message'}>
                                                        {isImproving === 'alternative_message' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Improve
                                                    </Button>
                                                </div>
                                                <Textarea
                                                    value={formData.alternative_message}
                                                    onChange={(e) => setFormData({ ...formData, alternative_message: e.target.value })}
                                                    onFocus={() => setFocusedField('alternative_message')}
                                                    className="min-h-[100px] bg-background/40 border-border/40 leading-relaxed"
                                                    placeholder="Hi {{firstName}}, great to be connected! I wanted to reach out regarding..."
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {isEmail && (
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-medium uppercase tracking-widest text-primary">Email Subject Line</Label>
                                                <Input
                                                    value={formData.initial_subject}
                                                    onChange={(e) => setFormData({ ...formData, initial_subject: e.target.value })}
                                                    className="bg-background/40 border-border/40 font-medium"
                                                    placeholder="e.g. Question about {{company}}'s strategy"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-medium uppercase tracking-widest text-primary">Email Body</Label>
                                                <Textarea
                                                    value={formData.email_body}
                                                    onChange={(e) => setFormData({ ...formData, email_body: e.target.value })}
                                                    className="min-h-[250px] bg-background/40 border-border/40 leading-relaxed font-medium"
                                                    placeholder="Hi {{firstName}}, I've been following..."
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {isMessenger && (
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-medium uppercase tracking-widest text-primary">Initial Message</Label>
                                            <Textarea
                                                value={formData.alternative_message}
                                                onChange={(e) => setFormData({ ...formData, alternative_message: e.target.value })}
                                                className="min-h-[150px] bg-background/40 border-border/40 leading-relaxed font-medium"
                                                placeholder="Hi {{firstName}}, I saw your profile..."
                                            />
                                        </div>
                                    )}
                                </TabsContent>

                                <TabsContent value="sequences" className="mt-0 space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <h4 className="text-sm font-semibold tracking-tight">Follow-up Sequence</h4>
                                            <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">Define your automated follow-up logic</p>
                                        </div>
                                        <Button size="sm" onClick={handleAddFollowUp} variant="outline" className="h-8 border-primary/20 hover:bg-primary/5 text-primary">
                                            <Plus className="w-3.5 h-3.5 mr-2" /> Add Step
                                        </Button>
                                    </div>

                                    <div className="space-y-4">
                                        {formData.follow_up_messages.map((msg: any, idx: number) => (
                                            <div key={idx} className="relative p-5 rounded-2xl bg-muted/40 border border-border/40 group overflow-hidden">
                                                <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary/60 transition-colors" />
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-semibold text-primary">
                                                            {idx + 1}
                                                        </span>
                                                        <div className="flex items-center gap-2">
                                                            <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Wait</Label>
                                                            <Input
                                                                type="number"
                                                                value={msg.delay_days || 2}
                                                                onChange={(e) => handleFollowUpChange(idx, 'delay_days', parseInt(e.target.value))}
                                                                className="w-16 h-7 text-xs bg-background/60 border-border/40 text-center font-medium"
                                                            />
                                                            <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">Days</span>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-7 w-7 text-muted-foreground/40 hover:text-rose-400 hover:bg-rose-400/10"
                                                        onClick={() => handleRemoveFollowUp(idx)}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                                <Textarea
                                                    value={msg.message || msg.content || ''}
                                                    onChange={(e) => handleFollowUpChange(idx, 'message', e.target.value)}
                                                    className="bg-background/20 border-border/20 text-sm leading-relaxed"
                                                    placeholder="Enter follow-up content..."
                                                />
                                            </div>
                                        ))}

                                        {formData.follow_up_messages.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-12 border border-dashed border-border/20 rounded-3xl bg-muted/10 opacity-60">
                                                <MessageSquare className="w-8 h-8 text-muted-foreground/20 mb-3" />
                                                <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/40">No follow-ups configured</p>
                                            </div>
                                        )}
                                    </div>
                                </TabsContent>

                                <TabsContent value="ab-testing" className="mt-0 space-y-6">
                                    <div className="p-6 rounded-3xl border border-orange-500/20 bg-orange-500/5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex gap-4 items-center">
                                                <div className="p-3 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                                                    <FlaskConical className="w-6 h-6 text-orange-400" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold tracking-tight">Variant Intelligence</h4>
                                                    <p className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-widest">A/B Testing for outreach optimization</p>
                                                </div>
                                            </div>
                                            <Switch
                                                checked={formData.ab_testing_enabled}
                                                onCheckedChange={(val) => setFormData({ ...formData, ab_testing_enabled: val })}
                                            />
                                        </div>

                                        {formData.ab_testing_enabled && (
                                            <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6 pt-4 border-t border-orange-500/10">
                                                {isConnector && (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-medium uppercase tracking-widest text-orange-400">Connection Request Variant B</Label>
                                                            <Textarea
                                                                value={formData.connection_request_b}
                                                                onChange={(e) => setFormData({ ...formData, connection_request_b: e.target.value })}
                                                                className="min-h-[100px] border-orange-500/20 bg-background/20"
                                                                placeholder="Try a different hook or value prop..."
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-medium uppercase tracking-widest text-orange-400">Alternative Message Variant B</Label>
                                                            <Textarea
                                                                value={formData.alternative_message_b}
                                                                onChange={(e) => setFormData({ ...formData, alternative_message_b: e.target.value })}
                                                                className="min-h-[100px] border-orange-500/20 bg-background/20"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {isEmail && (
                                                    <div className="space-y-4">
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-medium uppercase tracking-widest text-orange-400">Subject Variant B</Label>
                                                            <Input
                                                                value={formData.initial_subject_b}
                                                                onChange={(e) => setFormData({ ...formData, initial_subject_b: e.target.value })}
                                                                className="border-orange-500/20 bg-background/20"
                                                                placeholder="Alternative subject line..."
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-medium uppercase tracking-widest text-orange-400">Email Body Variant B</Label>
                                                            <Textarea
                                                                value={formData.email_body_b}
                                                                onChange={(e) => setFormData({ ...formData, email_body_b: e.target.value })}
                                                                className="min-h-[200px] border-orange-500/20 bg-background/20"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!formData.ab_testing_enabled && (
                                            <p className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-wider text-center py-8">
                                                Enable A/B testing to compare performance between two message variants.
                                            </p>
                                        )}
                                    </div>
                                </TabsContent>
                            </div>
                        </ScrollArea>
                    </Tabs>

                    <DialogFooter className="p-6 border-t border-border/40 bg-muted/20 shrink-0 flex items-center justify-between gap-4">
                        <div className="flex-1 flex gap-2 items-center text-[10px] font-medium text-muted-foreground/60 flex-wrap">
                            <Info className="w-3.5 h-3.5" />
                            <span className="uppercase tracking-widest">Variables:</span>
                            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{first_name}"}</code>
                            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{last_name}"}</code>
                            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{company}"}</code>
                            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{title}"}</code>
                            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{headline}"}</code>
                            <code className="text-foreground bg-muted px-1.5 py-0.5 rounded">{"{location}"}</code>
                        </div>
                        <div className="flex gap-3">
                            <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-medium uppercase tracking-widest text-[10px]">Cancel</Button>
                            <Button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-[140px] font-medium uppercase tracking-tight shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                            >
                                {isSaving ? "Safeguarding..." : "Save Campaign"}
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* SAM AI Generation Modal */}
            <Dialog open={showSamModal} onOpenChange={setShowSamModal}>
                <DialogContent className="max-w-xl max-h-[70vh] p-0 overflow-hidden glass-effect">
                    <DialogHeader className="p-4 border-b border-border/40 bg-gradient-to-r from-purple-500/10 to-transparent">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30">
                                <Wand2 className="w-5 h-5 text-purple-400" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold">Generate with SAM</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground/60">
                                    Chat with SAM to create compelling message templates
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <ScrollArea className="h-[300px] p-4" ref={chatRef}>
                        <div className="space-y-4">
                            {samMessages.map((msg, idx) => (
                                <div key={idx} className={cn(
                                    "p-3 rounded-xl text-sm whitespace-pre-wrap",
                                    msg.role === 'assistant'
                                        ? "bg-muted/50 border border-border/40"
                                        : "bg-primary/10 ml-8 border border-primary/20"
                                )}>
                                    {msg.content}
                                </div>
                            ))}
                            {isGenerating && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="text-sm">SAM is thinking...</span>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                    <div className="p-4 border-t border-border/40 bg-muted/20">
                        <div className="flex gap-2">
                            <Input
                                value={samInput}
                                onChange={(e) => setSamInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendSamMessage()}
                                placeholder="Describe your campaign goals..."
                                className="flex-1"
                                disabled={isGenerating}
                            />
                            <Button onClick={sendSamMessage} disabled={isGenerating || !samInput.trim()} className="gap-2">
                                <Send className="w-4 h-4" /> Send
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Paste Template Modal */}
            <Dialog open={showPasteModal} onOpenChange={setShowPasteModal}>
                <DialogContent className="max-w-xl p-0 overflow-hidden glass-effect">
                    <DialogHeader className="p-4 border-b border-border/40">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-muted border border-border/40">
                                <ClipboardPaste className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-semibold">Paste Template</DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground/60">
                                    Paste your existing message template and we'll parse it
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="p-4 space-y-4">
                        <Textarea
                            value={pastedText}
                            onChange={(e) => setPastedText(e.target.value)}
                            placeholder="Paste your template here...

Example:
CONNECTION REQUEST:
Hi {first_name}, I noticed your work at {company}...

FOLLOW-UP 1:
Thanks for connecting! I wanted to share..."
                            className="min-h-[200px] font-mono text-sm"
                        />
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setShowPasteModal(false)}>Cancel</Button>
                            <Button onClick={handlePasteTemplate} disabled={isParsing || !pastedText.trim()} className="gap-2">
                                {isParsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardPaste className="w-4 h-4" />}
                                {isParsing ? "Parsing..." : "Parse & Apply"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
