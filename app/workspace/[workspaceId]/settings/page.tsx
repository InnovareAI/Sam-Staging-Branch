'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { SimpleTileCard } from '@/components/TileCard'
import {
    Mail,
    Send,
    User,
    Globe,
    Ban,
    Calendar,
    CreditCard,
    Settings,
    Database,
    Zap,
    Shield,
    BarChart3,
    Linkedin
} from 'lucide-react'

// Import modals
import EmailProvidersModal from '@/app/components/EmailProvidersModal'
import ReachInboxModal from '@/app/components/ReachInboxModal'
import BlacklistModal from '@/app/components/BlacklistModal'
import { WorkspaceSettingsModal } from '@/app/components/WorkspaceSettingsModal'
import { CRMIntegrationModal } from '@/app/components/CRMIntegrationModal'
import { IntegrationsToolsModal } from '@/app/components/IntegrationsToolsModal'
import CalendarIntegrationModal from '@/app/components/CalendarIntegrationModal'
import { ManageSubscriptionModal } from '@/app/components/ManageSubscriptionModal'

/**
 * Settings Page - Workspace Architecture
 * Configure integrations, channels, and account settings
 */
export default function WorkspaceSettingsPage() {
    const params = useParams()
    const workspaceId = params.workspaceId as string

    // Modal states
    const [showLinkedInSettingsModal, setShowLinkedInSettingsModal] = useState(false)
    const [showEmailIntegrationModal, setShowEmailIntegrationModal] = useState(false)
    const [showReachInboxModal, setShowReachInboxModal] = useState(false)
    const [showUserProfileModal, setShowUserProfileModal] = useState(false)
    const [showProxyCountryModal, setShowProxyCountryModal] = useState(false)
    const [showBlacklistModal, setShowBlacklistModal] = useState(false)
    const [showCalendarIntegrationModal, setShowCalendarIntegrationModal] = useState(false)
    const [showManageSubscriptionModal, setShowManageSubscriptionModal] = useState(false)
    const [showWorkspaceSettingsModal, setShowWorkspaceSettingsModal] = useState(false)
    const [showCrmIntegrationModal, setShowCrmIntegrationModal] = useState(false)
    const [showIntegrationsToolsModal, setShowIntegrationsToolsModal] = useState(false)
    const [showSecurityComplianceModal, setShowSecurityComplianceModal] = useState(false)
    const [showAnalyticsReportingModal, setShowAnalyticsReportingModal] = useState(false)

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="w-full">
                {/* Page Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                        <Settings className="text-primary" size={28} />
                        Settings & Profile
                    </h1>
                    <p className="text-gray-400 mt-1">Configure integrations, channels, and account settings</p>
                </div>

                {/* Settings Tiles Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                    {/* LinkedIn Integration */}
                    <SimpleTileCard
                        title="LinkedIn Settings"
                        description="Configure LinkedIn account connections, automation settings, and personalization preferences."
                        icon={Linkedin}
                        color="blue"
                        onClick={() => setShowLinkedInSettingsModal(true)}
                    />

                    {/* Email Integration */}
                    <SimpleTileCard
                        title="Email Integration"
                        description="Connect Google, Microsoft, or SMTP email accounts for automated campaigns."
                        icon={Mail}
                        color="green"
                        onClick={() => setShowEmailIntegrationModal(true)}
                    />

                    {/* ReachInbox */}
                    <SimpleTileCard
                        title="ReachInbox"
                        description="Configure ReachInbox API integration for email campaigns."
                        icon={Send}
                        color="pink"
                        onClick={() => setShowReachInboxModal(true)}
                    />

                    {/* User Profile */}
                    <SimpleTileCard
                        title="User Profile"
                        description="Manage your account details, profile country, and personal preferences."
                        icon={User}
                        color="blue"
                        onClick={() => setShowUserProfileModal(true)}
                    />

                    {/* Proxy Management */}
                    <SimpleTileCard
                        title="LinkedIn Proxy Management"
                        description="Advanced proxy configuration for LinkedIn accounts."
                        icon={Globe}
                        color="purple"
                        onClick={() => setShowProxyCountryModal(true)}
                    />

                    {/* Blacklists */}
                    <SimpleTileCard
                        title="Blacklists"
                        description="Block companies, people, or profiles from outreach."
                        icon={Ban}
                        color="red"
                        onClick={() => setShowBlacklistModal(true)}
                    />

                    {/* Calendar Integration */}
                    <SimpleTileCard
                        title="Calendar Integration"
                        description="Connect Google Calendar, Outlook, or Calendly for meeting scheduling."
                        icon={Calendar}
                        color="cyan"
                        onClick={() => setShowCalendarIntegrationModal(true)}
                    />

                    {/* Subscription */}
                    <SimpleTileCard
                        title="Manage Subscription"
                        description="View subscription details, update payment methods, and access billing."
                        icon={CreditCard}
                        color="green"
                        onClick={() => setShowManageSubscriptionModal(true)}
                    />

                    {/* Workspace Settings */}
                    <SimpleTileCard
                        title="Workspace Settings"
                        description="Configure workspace name, branding, and general settings."
                        icon={Settings}
                        color="blue"
                        onClick={() => setShowWorkspaceSettingsModal(true)}
                    />

                    {/* CRM Integration */}
                    <SimpleTileCard
                        title="CRM Integration"
                        description="Connect Salesforce, HubSpot, Pipedrive, and other CRMs."
                        icon={Database}
                        color="cyan"
                        onClick={() => setShowCrmIntegrationModal(true)}
                    />

                    {/* Integrations & Tools */}
                    <SimpleTileCard
                        title="Integrations & Tools"
                        description="Manage LinkedIn Premium, email providers, and third-party tools."
                        icon={Zap}
                        color="yellow"
                        onClick={() => setShowIntegrationsToolsModal(true)}
                    />

                    {/* Security */}
                    <SimpleTileCard
                        title="Security & Compliance"
                        description="Configure security settings, compliance, and data protection."
                        icon={Shield}
                        color="pink"
                        onClick={() => setShowSecurityComplianceModal(true)}
                    />

                </div>
            </div>

            {/* Modals */}
            {showEmailIntegrationModal && (
                <EmailProvidersModal
                    isOpen={showEmailIntegrationModal}
                    onClose={() => setShowEmailIntegrationModal(false)}
                />
            )}

            {showReachInboxModal && (
                <ReachInboxModal
                    isOpen={showReachInboxModal}
                    onClose={() => setShowReachInboxModal(false)}
                    workspaceId={workspaceId}
                />
            )}

            {showBlacklistModal && (
                <BlacklistModal
                    isOpen={showBlacklistModal}
                    onClose={() => setShowBlacklistModal(false)}
                    workspaceId={workspaceId}
                />
            )}

            {showWorkspaceSettingsModal && (
                <WorkspaceSettingsModal
                    isOpen={showWorkspaceSettingsModal}
                    onClose={() => setShowWorkspaceSettingsModal(false)}
                    workspaceId={workspaceId}
                />
            )}

            {showCrmIntegrationModal && (
                <CRMIntegrationModal
                    isOpen={showCrmIntegrationModal}
                    onClose={() => setShowCrmIntegrationModal(false)}
                    workspaceId={workspaceId}
                />
            )}

            {showIntegrationsToolsModal && (
                <IntegrationsToolsModal
                    isOpen={showIntegrationsToolsModal}
                    onClose={() => setShowIntegrationsToolsModal(false)}
                />
            )}

            {showCalendarIntegrationModal && (
                <CalendarIntegrationModal
                    isOpen={showCalendarIntegrationModal}
                    onClose={() => setShowCalendarIntegrationModal(false)}
                />
            )}

            {showManageSubscriptionModal && (
                <ManageSubscriptionModal
                    isOpen={showManageSubscriptionModal}
                    onClose={() => setShowManageSubscriptionModal(false)}
                />
            )}
        </div>
    )
}
