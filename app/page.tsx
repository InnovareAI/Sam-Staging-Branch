'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * Root Page - Redirects to Workspace Architecture
 * 
 * This page detects the user's workspace and redirects them to the modern
 * workspace-based architecture at /workspace/[workspaceId]/commenting-agent
 * 
 * Legacy monolithic SPA archived at: /app/page.tsx.legacy
 */
export default function HomePage() {
    const router = useRouter()

    useEffect(() => {
        const redirectToWorkspace = async () => {
            try {
                const supabase = createClient()

                // Get authenticated user
                const { data: { user } } = await supabase.auth.getUser()

                if (!user) {
                    router.push('/login')
                    return
                }

                // Get user's first workspace
                const { data: memberships, error } = await supabase
                    .from('workspace_members')
                    .select('workspace_id')
                    .eq('user_id', user.id)
                    .order('joined_at', { ascending: true })
                    .limit(1)

                if (error) {
                    console.error('Error fetching workspace:', error)
                    // Force sign out to prevent infinite redirect loop between / and /login
                    await supabase.auth.signOut()
                    router.push('/login')
                    return
                }

                if (memberships && memberships.length > 0) {
                    const workspaceId = memberships[0].workspace_id
                    // Redirect to commenting agent as default landing page
                    router.push(`/workspace/${workspaceId}/commenting-agent`)
                } else {
                    // No workspace - redirect to login or onboarding
                    console.warn('No workspace found for user')
                    router.push('/login')
                }
            } catch (error) {
                console.error('Error during redirect:', error)
                router.push('/login')
            }
        }

        redirectToWorkspace()
    }, [router])

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 size={32} className="animate-spin text-pink-500" />
                <p className="text-gray-400">Loading workspace...</p>
            </div>
        </div>
    )
}
