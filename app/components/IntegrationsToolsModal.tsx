'use client';

import React, { useState } from 'react';
import { X, Linkedin, Mail, Send, Zap, Hash, Calendar, Link } from 'lucide-react';
import dynamic from 'next/dynamic';

const UnipileModal = dynamic(() => import('@/components/integrations/UnipileModal').then(mod => ({ default: mod.UnipileModal })), { ssr: false });
const EmailProvidersModal = dynamic(() => import('@/app/components/EmailProvidersModal'), { ssr: false });
const ReachInboxModal = dynamic(() => import('@/app/components/ReachInboxModal'), { ssr: false });
const SlackModal = dynamic(() => import('@/app/components/SlackModal'), { ssr: false });
const GoogleCalendarModal = dynamic(() => import('@/app/components/GoogleCalendarModal'), { ssr: false });
const OutlookCalendarModal = dynamic(() => import('@/app/components/OutlookCalendarModal'), { ssr: false });
const CalendlyModal = dynamic(() => import('@/app/components/CalendlyModal'), { ssr: false });
const CalComModal = dynamic(() => import('@/app/components/CalComModal'), { ssr: false });

interface IntegrationsToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export function IntegrationsToolsModal({ isOpen, onClose, workspaceId }: IntegrationsToolsModalProps) {
  const [showUnipileModal, setShowUnipileModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showReachInboxModal, setShowReachInboxModal] = useState(false);
  const [showSlackModal, setShowSlackModal] = useState(false);
  const [showGoogleCalendarModal, setShowGoogleCalendarModal] = useState(false);
  const [showOutlookCalendarModal, setShowOutlookCalendarModal] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [showCalComModal, setShowCalComModal] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                <Zap className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Integrations & Tools</h2>
                <p className="text-xs text-muted-foreground">Connect your accounts</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
          </div>

          <div className="p-4 space-y-3">
            <button onClick={() => setShowUnipileModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center"><Linkedin className="h-5 w-5 text-blue-400" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">LinkedIn Premium</div>
                  <div className="text-xs text-muted-foreground">Connect LinkedIn for outreach</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowEmailModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center"><Mail className="h-5 w-5 text-green-400" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Email Providers</div>
                  <div className="text-xs text-muted-foreground">SMTP, Gmail, Outlook</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowReachInboxModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-600/20 rounded-lg flex items-center justify-center"><Send className="h-5 w-5 text-pink-400" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">ReachInbox</div>
                  <div className="text-xs text-muted-foreground">Email deliverability & warmup</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowSlackModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center"><Hash className="h-5 w-5 text-purple-400" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Slack</div>
                  <div className="text-xs text-muted-foreground">Get notifications in Slack</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowGoogleCalendarModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-600/20 rounded-lg flex items-center justify-center"><Calendar className="h-5 w-5 text-red-400" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Google Calendar</div>
                  <div className="text-xs text-muted-foreground">Connect for meeting scheduling</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowOutlookCalendarModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center"><Calendar className="h-5 w-5 text-blue-400" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Outlook Calendar</div>
                  <div className="text-xs text-muted-foreground">Microsoft 365 calendar sync</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowCalendlyModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center"><Link className="h-5 w-5 text-blue-500" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Calendly</div>
                  <div className="text-xs text-muted-foreground">Booking & scheduling automation</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>

            <button onClick={() => setShowCalComModal(true)} className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center"><Link className="h-5 w-5 text-orange-500" /></div>
                <div className="text-left">
                  <div className="font-semibold text-sm">Cal.com</div>
                  <div className="text-xs text-muted-foreground">Open-source scheduling platform</div>
                </div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div className="p-4 border-t border-border">
            <button onClick={onClose} className="w-full bg-secondary hover:bg-secondary/80 font-medium py-2 px-4 rounded-lg text-sm">Close</button>
          </div>
        </div>
      </div>

      <UnipileModal isOpen={showUnipileModal} onClose={() => setShowUnipileModal(false)} workspaceId={workspaceId} />
      <EmailProvidersModal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} workspaceId={workspaceId} />
      <ReachInboxModal isOpen={showReachInboxModal} onClose={() => setShowReachInboxModal(false)} workspaceId={workspaceId} />
      <SlackModal isOpen={showSlackModal} onClose={() => setShowSlackModal(false)} workspaceId={workspaceId} />
      <GoogleCalendarModal isOpen={showGoogleCalendarModal} onClose={() => setShowGoogleCalendarModal(false)} workspaceId={workspaceId} />
      <OutlookCalendarModal isOpen={showOutlookCalendarModal} onClose={() => setShowOutlookCalendarModal(false)} workspaceId={workspaceId} />
      <CalendlyModal isOpen={showCalendlyModal} onClose={() => setShowCalendlyModal(false)} workspaceId={workspaceId} />
      <CalComModal isOpen={showCalComModal} onClose={() => setShowCalComModal(false)} workspaceId={workspaceId} />
    </>
  );
}
