'use client';

import React, { useState } from 'react';
import { X, Calendar, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

const GoogleCalendarModal = dynamic(() => import('@/app/components/GoogleCalendarModal'), { ssr: false });
const OutlookCalendarModal = dynamic(() => import('@/app/components/OutlookCalendarModal'), { ssr: false });
const CalendlyModal = dynamic(() => import('@/app/components/CalendlyModal'), { ssr: false });
const CalComModal = dynamic(() => import('@/app/components/CalComModal'), { ssr: false });

interface CalendarIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
}

export default function CalendarIntegrationModal({ isOpen, onClose, workspaceId }: CalendarIntegrationModalProps) {
  const [showGoogleCalendarModal, setShowGoogleCalendarModal] = useState(false);
  const [showOutlookCalendarModal, setShowOutlookCalendarModal] = useState(false);
  const [showCalendlyModal, setShowCalendlyModal] = useState(false);
  const [showCalComModal, setShowCalComModal] = useState(false);

  if (!isOpen) return null;

  const calendarOptions = [
    {
      id: 'google',
      name: 'Google Calendar',
      description: 'Sync with Google Calendar for scheduling & availability',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
      ),
      bgColor: 'bg-white',
      onClick: () => setShowGoogleCalendarModal(true),
    },
    {
      id: 'outlook',
      name: 'Outlook Calendar',
      description: 'Connect Microsoft 365 for calendar sync',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <path fill="#0078D4" d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.152-.354.228-.588.228h-8.174v-6.09l.9.9c.158.151.354.227.588.227.234 0 .43-.076.588-.227l.9-.9V18.67h5.524V7.387H24zM8.174 18.67v-6.09l-.9.9c-.158.151-.354.227-.588.227-.234 0-.43-.076-.588-.227l-.9-.9V18.67H0V7.387h.5c.234 0 .43.076.588.227l7.086 7.087 7.086-7.087c.158-.151.354-.227.588-.227h.5v11.283h-8.174z"/>
          <path fill="#0078D4" d="M8.174 5.33c0-.994.356-1.847 1.067-2.558C9.952 2.061 10.805 1.705 11.8 1.705s1.847.356 2.558 1.067c.711.711 1.067 1.564 1.067 2.558v2.057H8.174V5.33z"/>
        </svg>
      ),
      bgColor: 'bg-[#0078D4]/10',
      onClick: () => setShowOutlookCalendarModal(true),
    },
    {
      id: 'calendly',
      name: 'Calendly',
      description: 'Booking links & automated scheduling',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" fill="#006BFF"/>
          <path fill="white" d="M12 6v6l4 2" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      ),
      bgColor: 'bg-[#006BFF]/10',
      onClick: () => setShowCalendlyModal(true),
    },
    {
      id: 'calcom',
      name: 'Cal.com',
      description: 'Open-source scheduling platform',
      icon: (
        <svg className="w-6 h-6" viewBox="0 0 24 24">
          <rect width="24" height="24" rx="4" fill="#292929"/>
          <path fill="white" d="M7 8h10v2H7zM7 12h10v2H7zM7 16h6v2H7z"/>
        </svg>
      ),
      bgColor: 'bg-[#292929]/10',
      onClick: () => setShowCalComModal(true),
    },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-xl max-w-md w-full overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Calendar Integration</h2>
                <p className="text-xs text-muted-foreground">Connect your calendar for scheduling</p>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {calendarOptions.map((option) => (
              <button
                key={option.id}
                onClick={option.onClick}
                className="w-full flex items-center justify-between p-4 bg-background hover:bg-accent border border-border rounded-xl transition-all hover:border-primary/50"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${option.bgColor} rounded-lg flex items-center justify-center`}>
                    {option.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-sm">{option.name}</div>
                    <div className="text-xs text-muted-foreground">{option.description}</div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            ))}
          </div>

          <div className="p-4 border-t border-border">
            <button
              onClick={onClose}
              className="w-full bg-secondary hover:bg-secondary/80 font-medium py-2 px-4 rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      <GoogleCalendarModal
        isOpen={showGoogleCalendarModal}
        onClose={() => setShowGoogleCalendarModal(false)}
        workspaceId={workspaceId}
      />
      <OutlookCalendarModal
        isOpen={showOutlookCalendarModal}
        onClose={() => setShowOutlookCalendarModal(false)}
        workspaceId={workspaceId}
      />
      <CalendlyModal
        isOpen={showCalendlyModal}
        onClose={() => setShowCalendlyModal(false)}
        workspaceId={workspaceId}
      />
      <CalComModal
        isOpen={showCalComModal}
        onClose={() => setShowCalComModal(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
