'use client'

import SignupFlow from '@/components/signup/SignupFlow'

/**
 * InnovareAI Signup Page
 *
 * Standalone signup page for InnovareAI customers (self-service/SME tier)
 * Can be embedded in WordPress/Elementor via iframe or opened as modal overlay
 *
 * Flow: Email signup → Plan selection → Stripe payment → Redirect to workspace
 *
 * Embedding in WordPress/Elementor:
 *
 * Option 1: Iframe embed
 * <iframe
 *   src="https://app.meet-sam.com/signup/innovareai"
 *   style="width: 100%; height: 800px; border: none;"
 *   title="SAM AI Signup"
 * />
 *
 * Option 2: Modal overlay (recommended for better conversion)
 * Add this script to your WordPress page:
 * <script src="https://app.meet-sam.com/signup/embed.js"></script>
 * <button onclick="SAMSignup.open()">Start Free Trial</button>
 */
export default function InnovareAISignupPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <SignupFlow />
    </div>
  )
}
