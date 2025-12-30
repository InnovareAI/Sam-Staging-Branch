'use client';

import React, { useState } from 'react';
import {
  Check,
  Mail,
  MessageSquare,
  AlertTriangle,
  Users,
  Clock,
  Target,
  Zap,
  ChevronRight,
  ChevronLeft,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ChannelSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selection: ChannelSelection) => void;
  connectedAccounts: ConnectedAccount[];
}

interface ConnectedAccount {
  id: string;
  platform: 'gmail' | 'outlook' | 'smtp' | 'linkedin';
  email?: string;
  name: string;
  status: 'active' | 'expired' | 'error';
}

interface ChannelSelection {
  strategy: 'email_only' | 'linkedin_only' | 'email_first' | 'linkedin_first' | 'simultaneous';
  selectedAccounts: {
    email?: string[];
    linkedin?: string[];
  };
  preferences: {
    delayBetweenChannels: number; // hours
    maxDailyOutreach: number;
    followUpSequence: boolean;
    personalizeByChannel: boolean;
  };
}

const CHANNEL_STRATEGIES = [
  {
    id: 'email_only',
    name: 'Email Only',
    icon: Mail,
    description: 'Focus on email outreach with personalized sequences',
    pros: ['Higher volume capacity', 'Professional approach'],
    cons: ['Lower response rates'],
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    reachPotential: '800-1200 /mo',
    responseRate: '2-5%'
  },
  {
    id: 'linkedin_only',
    name: 'LinkedIn Only',
    icon: Users,
    description: 'Professional networking approach via LinkedIn',
    pros: ['Higher response rates', 'Professional context'],
    cons: ['Volume limitations'],
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    reachPotential: '200-400 /mo',
    responseRate: '8-15%'
  },
  {
    id: 'email_first',
    name: 'Email First',
    icon: MessageSquare,
    description: 'Start with email, follow up via LinkedIn',
    pros: ['Best of both worlds', 'High overall response'],
    cons: ['More complex setup'],
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    reachPotential: '600-800 /mo',
    responseRate: '6-12%'
  },
  {
    id: 'linkedin_first',
    name: 'LinkedIn First',
    icon: Target,
    description: 'Start with Connection, follow up via email',
    pros: ['Personal touch first', 'High-value approach'],
    cons: ['Slower start'],
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    reachPotential: '400-600 /mo',
    responseRate: '10-18%'
  },
  {
    id: 'simultaneous',
    name: 'Multi-Channel Bliss',
    icon: Zap,
    description: 'Simultaneous outreach across all available channels',
    pros: ['Maximum visibility', 'Fast results'],
    cons: ['Risk of seeming pushy'],
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    reachPotential: '300-500 /mo',
    responseRate: '12-20%'
  }
];

export function ChannelSelectionModal({
  isOpen,
  onClose,
  onConfirm,
  connectedAccounts
}: ChannelSelectionModalProps) {
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [selectedAccounts, setSelectedAccounts] = useState<{ email: string[], linkedin: string[] }>({
    email: [],
    linkedin: []
  });
  const [preferences, setPreferences] = useState({
    delayBetweenChannels: 24,
    maxDailyOutreach: 50,
    followUpSequence: true,
    personalizeByChannel: true
  });
  const [currentStep, setCurrentStep] = useState<'strategy' | 'accounts' | 'preferences' | 'review'>('strategy');

  const emailAccounts = connectedAccounts.filter(acc => ['gmail', 'outlook', 'smtp'].includes(acc.platform));
  const linkedinAccounts = connectedAccounts.filter(acc => acc.platform === 'linkedin');

  const isStrategyAvailable = (strategyId: string) => {
    switch (strategyId) {
      case 'email_only': return emailAccounts.length > 0;
      case 'linkedin_only': return linkedinAccounts.length > 0;
      case 'email_first':
      case 'linkedin_first':
      case 'simultaneous': return emailAccounts.length > 0 && linkedinAccounts.length > 0;
      default: return false;
    }
  };

  const handleConfirm = () => {
    if (!selectedStrategy) return;
    onConfirm({
      strategy: selectedStrategy as ChannelSelection['strategy'],
      selectedAccounts,
      preferences
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
      <div className="glass-effect rounded-[2.5rem] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-border/40 flex flex-col">
        {/* Header */}
        <div className="p-8 pb-6 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-4 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <Target className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tighter text-foreground uppercase italic">Outreach Strategy</h2>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Architect your multi-channel conversion engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-8 pt-4">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-4 mb-10">
            {['strategy', 'accounts', 'preferences', 'review'].map((step, index) => (
              <React.Fragment key={step}>
                <div
                  onClick={() => {
                    const steps = ['strategy', 'accounts', 'preferences', 'review'];
                    if (steps.indexOf(currentStep) > index) setCurrentStep(step as any);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-2 transition-all group",
                    currentStep === step ? "opacity-100" : "opacity-40 hover:opacity-100 cursor-pointer"
                  )}>
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-black transition-all border-2",
                    currentStep === step
                      ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]"
                      : ['strategy', 'accounts', 'preferences', 'review'].indexOf(currentStep) > index
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "bg-muted border-border text-muted-foreground"
                  )}>
                    {['strategy', 'accounts', 'preferences', 'review'].indexOf(currentStep) > index ? <Check className="h-5 w-5" /> : index + 1}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest">{step}</span>
                </div>
                {index < 3 && (
                  <div className={cn(
                    "w-12 h-[2px] mb-6 rounded-full",
                    ['strategy', 'accounts', 'preferences', 'review'].indexOf(currentStep) > index ? "bg-emerald-500" : "bg-muted"
                  )} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Steps Content */}
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {currentStep === 'strategy' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {CHANNEL_STRATEGIES.map((strategy) => {
                  const isAvailable = isStrategyAvailable(strategy.id);
                  const Icon = strategy.icon;

                  return (
                    <div
                      key={strategy.id}
                      onClick={() => isAvailable && setSelectedStrategy(strategy.id)}
                      className={cn(
                        "relative group p-6 rounded-3xl border-2 transition-all duration-300",
                        !isAvailable
                          ? 'opacity-40 grayscale cursor-not-allowed border-muted bg-muted/20'
                          : selectedStrategy === strategy.id
                            ? 'border-primary bg-primary/5 shadow-xl shadow-primary/10'
                            : 'border-border/40 bg-card/10 hover:border-primary/40 hover:bg-card/20 cursor-pointer'
                      )}
                    >
                      <div className={cn("inline-flex p-3 rounded-2xl mb-4", strategy.bg, strategy.border)}>
                        <Icon className={cn("w-6 h-6", strategy.color)} />
                      </div>
                      <h4 className="font-black text-sm uppercase tracking-tight mb-2 flex items-center justify-between">
                        {strategy.name}
                        {selectedStrategy === strategy.id && <CheckCircle2 className="w-4 h-4 text-primary" />}
                      </h4>
                      <p className="text-[11px] text-muted-foreground/80 leading-relaxed font-medium mb-4">
                        {strategy.description}
                      </p>

                      <div className="flex gap-4 border-t border-border/20 pt-4 mt-auto">
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Reach</span>
                          <span className="text-[10px] font-semibold">{strategy.reachPotential}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-widest">Growth</span>
                          <span className="text-[10px] font-semibold text-emerald-400">{strategy.responseRate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {currentStep === 'accounts' && (
              <div className="max-w-xl mx-auto space-y-8">
                {['email', 'linkedin'].filter(ch => {
                  if (selectedStrategy === 'email_only') return ch === 'email';
                  if (selectedStrategy === 'linkedin_only') return ch === 'linkedin';
                  return true;
                }).map(channel => (
                  <div key={channel} className="space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                      {channel === 'email' ? <Mail className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      {channel} Accounts
                    </h4>
                    <div className="grid gap-3">
                      {(channel === 'email' ? emailAccounts : linkedinAccounts).map(account => (
                        <div
                          key={account.id}
                          onClick={() => {
                            const key = channel as 'email' | 'linkedin';
                            const current = selectedAccounts[key] || [];
                            const next = current.includes(account.id)
                              ? current.filter(id => id !== account.id)
                              : [...current, account.id];
                            setSelectedAccounts(prev => ({ ...prev, [key]: next }));
                          }}
                          className={cn(
                            "p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group",
                            selectedAccounts[channel as 'email' | 'linkedin']?.includes(account.id)
                              ? "border-primary bg-primary/5"
                              : "border-border/40 bg-muted/10 hover:border-primary/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-4 h-4 rounded border-2 transition-all flex items-center justify-center",
                              selectedAccounts[channel as 'email' | 'linkedin']?.includes(account.id)
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/20 group-hover:border-primary/40"
                            )}>
                              {selectedAccounts[channel as 'email' | 'linkedin']?.includes(account.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div>
                              <div className="text-sm font-semibold">{account.name}</div>
                              <div className="text-[10px] text-muted-foreground font-medium">{account.email}</div>
                            </div>
                          </div>
                          <Badge variant="outline" className={cn(
                            "text-[9px] uppercase font-black",
                            account.status === 'active' ? "text-emerald-400 border-emerald-400/20" : "text-rose-400 border-rose-400/20"
                          )}>
                            {account.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {currentStep === 'preferences' && (
              <div className="max-w-md mx-auto space-y-6">
                <div className="space-y-4">
                  <div className="p-6 rounded-3xl bg-muted/20 border border-border/40 space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Clock className="w-3 h-3" /> Multi-Channel Delay (Hours)
                      </label>
                      <input
                        type="number"
                        value={preferences.delayBetweenChannels}
                        onChange={(e) => setPreferences(prev => ({ ...prev, delayBetweenChannels: parseInt(e.target.value) }))}
                        className="w-full bg-background/40 border border-border/40 h-12 rounded-xl px-4 font-black"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 flex items-center gap-2">
                        <Zap className="w-3 h-3" /> Daily Prospect Limit
                      </label>
                      <input
                        type="number"
                        value={preferences.maxDailyOutreach}
                        onChange={(e) => setPreferences(prev => ({ ...prev, maxDailyOutreach: parseInt(e.target.value) }))}
                        className="w-full bg-background/40 border border-border/40 h-12 rounded-xl px-4 font-black"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentStep === 'review' && (
              <div className="max-w-lg mx-auto space-y-4">
                <div className="p-8 rounded-[2rem] bg-primary/5 border border-primary/20 space-y-6">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Strategy</span>
                    <Badge className="bg-primary text-primary-foreground font-black px-4 py-1">
                      {CHANNEL_STRATEGIES.find(s => s.id === selectedStrategy)?.name}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Accounts</span>
                    <div className="flex gap-2">
                      {selectedAccounts.email.length > 0 && <Badge variant="secondary" className="font-semibold">{selectedAccounts.email.length} Email</Badge>}
                      {selectedAccounts.linkedin.length > 0 && <Badge variant="secondary" className="font-semibold">{selectedAccounts.linkedin.length} LI</Badge>}
                    </div>
                  </div>
                  <div className="pt-6 border-t border-primary/20 flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Daily Volume</span>
                    <span className="text-xl font-black italic">{preferences.maxDailyOutreach} / day</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 border-t border-border/20 bg-muted/20 shrink-0 flex justify-between gap-4">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-14 px-8 font-black uppercase tracking-widest text-[10px]"
          >
            Cancel
          </Button>

          <div className="flex gap-3">
            {currentStep !== 'strategy' && (
              <Button
                variant="outline"
                onClick={() => {
                  const steps = ['strategy', 'accounts', 'preferences', 'review'];
                  setCurrentStep(steps[steps.indexOf(currentStep) - 1] as any);
                }}
                className="h-14 px-8 border-border/40 font-black uppercase tracking-widest text-[11px] rounded-2xl"
              >
                <ChevronLeft className="w-4 h-4 mr-2" /> Back
              </Button>
            )}

            <Button
              disabled={(currentStep === 'strategy' && !selectedStrategy) || (currentStep === 'accounts' && selectedAccounts.email.length === 0 && selectedAccounts.linkedin.length === 0)}
              onClick={() => {
                if (currentStep === 'review') handleConfirm();
                else {
                  const steps = ['strategy', 'accounts', 'preferences', 'review'];
                  setCurrentStep(steps[steps.indexOf(currentStep) + 1] as any);
                }
              }}
              className="h-14 px-10 bg-primary text-primary-foreground font-black uppercase tracking-tighter rounded-2xl shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all min-w-[180px]"
            >
              {currentStep === 'review' ? "Finalize Strategy" : "Next Step"}
              {currentStep !== 'review' && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}