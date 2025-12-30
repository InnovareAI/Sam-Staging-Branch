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
            setFormData({
                name: campaign.name || '',
                connection_message: campaign.message_templates?.connection_request || '',
                alternative_message: campaign.message_templates?.alternative_message || '',
                email_body: campaign.message_templates?.email_body || '',
                initial_subject: campaign.message_templates?.initial_subject || '',
                follow_up_subjects: campaign.message_templates?.follow_up_subjects || [],
                use_threaded_replies: campaign.message_templates?.use_threaded_replies || false,
                ab_testing_enabled: campaign.message_templates?.ab_testing_enabled || false,
                connection_request_b: campaign.message_templates?.connection_request_b || '',
                alternative_message_b: campaign.message_templates?.alternative_message_b || '',
                email_body_b: campaign.message_templates?.email_body_b || '',
                initial_subject_b: campaign.message_templates?.initial_subject_b || '',
                follow_up_messages: Array.isArray(campaign.message_templates?.follow_up_messages)
                    ? [...campaign.message_templates.follow_up_messages]
                    : []
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

    <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden glass-effect shadow-2xl flex flex-col">
            <DialogHeader className="p-6 pb-2 border-b border-border/40 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                        <Edit className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <DialogTitle className="text-xl font-semibold tracking-tight">Edit Campaign Settings</DialogTitle>
                        <DialogDescription className="text-xs font-medium text-muted-foreground/60 uppercase tracking-widest mt-0.5">
                            Modify outreach templates and logic for <span className="text-foreground">{campaign.name}</span>
                        </DialogDescription>
                    </div>
                </div>
            </DialogHeader>

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
                                            <span className="text-[10px] font-medium text-muted-foreground/40">{formData.connection_message.length}/300</span>
                                        </div>
                                        <Textarea
                                            value={formData.connection_message}
                                            onChange={(e) => setFormData({ ...formData, connection_message: e.target.value })}
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
                                        <Label className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/80">Alternative Message (Already Connected)</Label>
                                        <Textarea
                                            value={formData.alternative_message}
                                            onChange={(e) => setFormData({ ...formData, alternative_message: e.target.value })}
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
                <div className="flex-1 flex gap-2 items-center text-[10px] font-medium text-muted-foreground/60 uppercase tracking-widest">
                    <Info className="w-3.5 h-3.5" />
                    Variables:
                    <code className="text-foreground bg-muted p-1 rounded-md">{"{{firstName}}"}</code>
                    <code className="text-foreground bg-muted p-1 rounded-md">{"{{company}}"}</code>
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
    );
}
