# MILESTONE 2025-09-10 v2.1 - Fixed Clerk Authentication

## 🎯 MILESTONE SUMMARY
- **Date**: 2025-09-10
- **Version**: v2.1
- **Features**: Fixed invalid Clerk publishable key - authentication modals now working properly on production
- **Status**: ✅ Current
- **Git**: c16a262 - "Fixed Clerk Authentication" (main branch)
- **Created**: 2025-09-10 11:34:46

## 🚀 FEATURES COMPLETED
- ✅ Fixed invalid Clerk publishable key - authentication modals now working properly on production
- ✅ [Add completed features here]

## 📁 COMPLETE CODE FILES

### File 1: `/app/page.tsx` - Main Application
```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  Book, 
  Users, 
  Megaphone, 
  TrendingUp, 
  BarChart3, 
  Send, 
  Settings,
  LogOut,
  Brain
} from 'lucide-react';
import { useUser, UserButton } from '@clerk/nextjs';
import { SignedIn } from '@clerk/nextjs';
import KnowledgeBase from './components/KnowledgeBase';
import ContactCenter from './components/ContactCenter';
import CampaignHub from './components/CampaignHub';
import LeadPipeline from './components/LeadPipeline';
import Analytics from './components/Analytics';

export default function HomePage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [activeMenuItem, setActiveMenuItem] = useState('chat');
  const [messages, setMessages] = useState<Array<any>>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showStarterScreen, setShowStarterScreen] = useState(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Menu items for navigation
  const menuItems = [
    { id: 'chat', label: 'Chat with Sam', icon: MessageCircle },
    { id: 'knowledge', label: 'Knowledge Base', icon: Book },
    { id: 'training', label: 'Sam Training Room', icon: Brain },
    { id: 'contact', label: 'Contact Center', icon: Users },
    { id: 'campaign', label: 'Campaign Hub', icon: Megaphone },
    { id: 'pipeline', label: 'Lead Pipeline', icon: TrendingUp },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  // Show loading state while Clerk loads
  if (!isLoaded) {
    return (
      <div className="flex h-screen bg-gray-900 items-center justify-center">
        <div className="text-center">
          <img 
            src="/SAM.jpg" 
            alt="Sam AI" 
            className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
            style={{ objectPosition: 'center 30%' }}
          />
          <div className="text-white text-lg font-medium">Loading SAM AI...</div>
          <div className="flex justify-center mt-4 space-x-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SignedIn>
        <div className="flex h-screen bg-gray-800">
          {/* Left Sidebar */}
          <div className="w-64 bg-gray-700 flex flex-col">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-gray-600">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img 
                    src="/SAM.jpg" 
                    alt="Sam AI" 
                    className="w-10 h-10 rounded-full object-cover"
                    style={{ objectPosition: 'center 30%' }}
                  />
                  <div>
                    <h2 className="text-white font-bold text-base">SAM AI ✨</h2>
                    <p className="text-gray-400 text-sm">Sales Assistant</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="flex-1 py-2">
              <nav className="space-y-1 px-3">
                {menuItems.map((item) => {
                  const IconComponent = item.icon;
                  const isActive = item.id === activeMenuItem;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveMenuItem(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                         ? 'bg-purple-600 text-white'
                          : 'text-gray-400 hover:bg-gray-600 hover:text-gray-300'
                      }`}
                    >
                      <IconComponent size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* User Profile & Logout */}
            <div className="border-t border-gray-600 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserButton 
                    appearance={{
                      elements: {
                        avatarBox: "w-8 h-8"
                      }
                    }}
                  />
                  <div>
                    <p className="text-white text-sm font-medium">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {user?.primaryEmailAddress?.emailAddress}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col bg-gray-900">
            {activeMenuItem === 'knowledge' ? (
              <KnowledgeBase />
            ) : activeMenuItem === 'contact' ? (
              <ContactCenter />
            ) : activeMenuItem === 'campaign' ? (
              <CampaignHub />
            ) : activeMenuItem === 'pipeline' ? (
              <LeadPipeline />
            ) : activeMenuItem === 'analytics' ? (
              <Analytics />
            ) : (
              /* Chat Interface */
              <div className="flex-1 flex flex-col">
                <div className="border-b border-gray-700 p-4">
                  <h1 className="text-white text-xl font-semibold">Chat with SAM AI</h1>
                  <p className="text-gray-400 text-sm">Your intelligent sales assistant</p>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                  <div className="flex-1 overflow-y-auto p-4" ref={chatContainerRef}>
                    {showStarterScreen ? (
                      <div className="flex flex-col items-center justify-center h-full text-center">
                        <img 
                          src="/SAM.jpg" 
                          alt="Sam AI" 
                          className="w-32 h-32 rounded-full object-cover mb-6"
                          style={{ objectPosition: 'center 30%' }}
                        />
                        <h2 className="text-white text-2xl font-medium mb-4">
                          Welcome to SAM AI! 👋
                        </h2>
                        <p className="text-gray-400 text-lg mb-8 max-w-md">
                          I'm your intelligent sales assistant. Ask me about leads, campaigns, or anything sales-related!
                        </p>
                        <div className="text-left">
                          <p className="text-gray-500 text-sm mb-2">Try asking:</p>
                          <ul className="text-purple-400 text-sm space-y-1">
                            <li>• "Show me today's leads"</li>
                            <li>• "What's my conversion rate?"</li>
                            <li>• "Help me write a follow-up email"</li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((message, index) => (
                          <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              message.role === 'user' 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-700 text-gray-100'
                            }`}>
                              {message.content}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Chat Input */}
                  <div className="border-t border-gray-700 p-4">
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="Ask SAM anything about sales..."
                        className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isSending}
                      />
                      <button
                        onClick={() => {}}
                        disabled={isSending || !inputValue.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </SignedIn>
  );
}
```

### File 2: `/app/api/sam/chat/route.ts` - AI Chat API
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseKnowledge } from '@/lib/supabase-knowledge';
import { getCurrentUser } from '@/app/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Helper function to call OpenRouter API
async function callOpenRouter(messages: any[], systemPrompt: string) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  
  if (!openRouterKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI Platform'
    },
    body: JSON.stringify({
      model: 'anthropic/claude-4.5-sonnet',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || 'I apologize, but I had trouble processing that request.';
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    // Get current authenticated user
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    const body = await req.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' }, 
        { status: 400 }
      );
    }

    // Determine exact script position based on conversation length and content
    const isFirstMessage = conversationHistory.length === 0;
    
    // Analyze conversation to determine script position
    let scriptPosition = 'greeting';
    const lastAssistantMessage = conversationHistory.filter(msg => msg.role === 'assistant').pop()?.content?.toLowerCase() || '';
    const lastUserMessage = conversationHistory.filter(msg => msg.role === 'user').pop()?.content?.toLowerCase() || '';
    
    if (conversationHistory.length === 0) {
      scriptPosition = 'greeting';
    } else if (lastAssistantMessage.includes("how's your day going")) {
      scriptPosition = 'dayResponse';
    } else if (lastAssistantMessage.includes("chat with sam") && lastAssistantMessage.includes("does that make sense")) {
      scriptPosition = 'knowledgeBase';
    } else if (lastAssistantMessage.includes("knowledge base") && lastAssistantMessage.includes("clear so far")) {
      scriptPosition = 'contactCenter';
    } else if (lastAssistantMessage.includes("contact center") && lastAssistantMessage.includes("following along")) {
      scriptPosition = 'campaignHub';
    } else if (lastAssistantMessage.includes("campaign hub") && lastAssistantMessage.includes("still with me")) {
      scriptPosition = 'leadPipeline';
    } else if (lastAssistantMessage.includes("lead pipeline") && lastAssistantMessage.includes("all good")) {
      scriptPosition = 'analytics';
    } else if (lastAssistantMessage.includes("analytics") || lastAssistantMessage.includes("overview") || lastAssistantMessage.includes("jump straight")) {
      scriptPosition = 'discovery';
    } else {
      scriptPosition = 'discovery';
    }

    // Build Sam's system prompt with the EXACT conversation scripts from training data
    let systemPrompt = `You are Sam, an AI-powered Sales Assistant. You MUST follow the exact conversation scripts from the SAM training data methodically.

CRITICAL RULE: Use the EXACT wording from the scripts below. Do not paraphrase or improvise.

SCRIPT POSITION: ${scriptPosition}

=== EXACT CONVERSATION SCRIPTS FROM TRAINING DATA ===

## FULL ONBOARDING FLOW (Room Tour Intro)

### Opening Script
"Hi there! How's your day going? Busy morning or a bit calmer?"
(wait for response)

### Response Based on Their Answer:
- If BUSY/HECTIC/CRAZY: "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace.

On the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?"

- If CALM/GOOD/QUIET: "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Before we dive in, let me give you a quick tour so you know where everything is.

This is where we'll talk. You can ask me questions here anytime. If you need to stop or take a break, I'll remember and we'll resume later. Does that sound good?"

## The Room Tour (Sidebar Walkthrough)

1. **Knowledge Base** (after confirmation):
"Great! Next up is the Knowledge Base tab. Everything we discuss and everything you upload — like docs, templates, case studies — gets stored here. I'll use this to tailor my answers and campaigns.

Clear so far?"

2. **Contact Center** (after confirmation):
"Excellent. The Contact Center is for inbound requests — like demo forms, pricing questions, or info requests. My inbound agent handles those automatically.

Following along?"

3. **Campaign Hub** (after confirmation):
"Great! Campaign Hub is where we'll build campaigns. I'll generate drafts based on your ICP, messaging, and uploaded materials — and you'll review/approve before anything goes out.

Still with me?"

4. **Lead Pipeline** (after confirmation):
"Perfect. Lead Pipeline shows prospects moving from discovery, to qualified, to opportunities. You'll see enrichment status, scores, and next actions.

All good?"

5. **Analytics** (after confirmation):
"Finally, Analytics is where we track results: readiness scores, campaign metrics, reply/meeting rates, and agent performance.

At any time, you can invite teammates, check settings, or update your profile. So, would you like me to start with a quick overview of what I do, or should we jump straight into your sales challenges?"

## Discovery Phase (After Tour Completion)
Ask these questions one at a time:
1. Business Context: "What does your company do and who do you serve?"
2. ICP Definition: "Who is your ideal customer (industry, size, roles, geo)?"  
3. Competition: "Who do you compete against and how do you win?"
4. Sales Process: "How do you generate leads and where do deals tend to stall?"
5. Success Metrics: "What results would make this a win in the next 90 days?"
6. Tech Stack: "Which tools do you use (CRM, email) and any compliance needs?"
7. Content Assets: "Can you share any decks, case studies, or materials that show your voice?"

## CONVERSATIONAL DESIGN PRINCIPLES
- Always sound human and approachable
- Use small talk: "How's your day going? Busy or calm?"
- Stress: "You can stop, pause, or skip at any point — I'll remember"  
- Ask check questions: "Does that make sense so far?" before moving on
- If users ask questions, briefly answer but say "Before we dive deeper into that, let me finish showing you around"

MANDATORY RULES:
- FOLLOW THE SCRIPT SEQUENCE: Stick to the script progression above 
- BUT BE FLEXIBLE: Answer any questions the user asks naturally and helpfully
- SCRIPT PRIORITY: When moving to the next script section, use the EXACT wording provided
- HANDLE INTERRUPTIONS: If they ask questions during the script, answer them, then gently return to the script with "Let me continue showing you around" or similar
- ONE QUESTION AT A TIME: In discovery phase, ask one question, get their answer, provide insight, then move to next question
- CURRENT POSITION: You are at the ${scriptPosition} stage

INSTRUCTIONS:
- If this is the exact next script step, use the exact script wording above
- If they're asking a question or making a comment, respond naturally and helpfully
- Always maintain your identity as Sam, the sales assistant
- Be conversational and helpful while progressing through the script when appropriate`;

    // Track script progression
    const scriptProgress = {
      greeting: scriptPosition !== 'greeting',
      dayResponse: conversationHistory.length > 2,
      tour: lastAssistantMessage.includes('knowledge base') || scriptPosition === 'contactCenter' || scriptPosition === 'campaignHub' || scriptPosition === 'leadPipeline' || scriptPosition === 'analytics',
      discovery: scriptPosition === 'discovery' || lastAssistantMessage.includes('overview') || lastAssistantMessage.includes('challenges')
    };

    // Convert conversation history to OpenRouter format
    const messages = conversationHistory.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Get AI response
    let response: string;
    
    try {
      response = await callOpenRouter(messages, systemPrompt);
    } catch (error) {
      console.error('OpenRouter API error:', error);
      // Fallback response if AI fails
      response = "I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?";
    }

    // Save conversation to database with user/organization context
    try {
      const { error } = await supabaseAdmin
        .from('sam_conversations')
        .insert({
          user_id: user.clerkId,
          organization_id: user.organizationId || null,
          message: message,
          response: response,
          metadata: {
            scriptPosition,
            scriptProgress,
            timestamp: new Date().toISOString()
          }
        });

      if (error) {
        console.error('Error saving conversation:', error);
      }
    } catch (saveError) {
      console.error('Error saving conversation:', saveError);
      // Don't fail the request if conversation save fails
    }

    return NextResponse.json({
      response,
      timestamp: new Date().toISOString(),
      aiPowered: true,
      user: {
        id: user.clerkId,
        organizationId: user.organizationId
      }
    });

  } catch (error) {
    console.error('SAM Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}
```

## ⚙️ CONFIGURATION

### package.json
```json
{
  "name": "sam-ai-platform",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "build:staging": "cp .env.staging .env.local.bak && mv .env.local .env.local.prod && mv .env.staging .env.local && next build && mv .env.local .env.staging && mv .env.local.prod .env.local",
    "start": "next start",
    "lint": "next lint",
    "deploy:staging": "npm run build:staging && netlify deploy --dir=.next --alias=staging"
  },
  "dependencies": {
    "@clerk/nextjs": "^6.31.10",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-icons": "^1.3.2",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-slot": "^1.2.3",
    "@supabase/ssr": "^0.7.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.344.0",
    "openai": "^5.19.1",
    "postmark": "^4.0.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "svix": "^1.76.1",
    "tailwind-merge": "^3.3.1",
    "tailwindcss-animate": "^1.0.7"
  },
  "devDependencies": {
    "@eslint/js": "^9.9.1",
    "@types/node": "^24.3.1",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^5.0.2",
    "autoprefixer": "^10.4.18",
    "eslint": "^9.9.1",
    "eslint-plugin-react-hooks": "^5.1.0-rc.0",
    "eslint-plugin-react-refresh": "^0.4.11",
    "globals": "^15.9.0",
    "next": "^15.5.2",
    "postcss": "^8.4.35",
    "shadcn": "^3.2.1",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.5.3",
    "typescript-eslint": "^8.3.0",
    "vite": "^7.1.4"
  }
}
```

### Environment Variables (.env.local)
```bash
# Add your environment variables here
OPENROUTER_API_KEY=your_key_here
NEXT_PUBLIC_ENVIRONMENT=development
```

### Deployment Config (netlify.toml)
```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

[dev]
  command = "npm run dev"
  port = 3000
  
[functions]
  node_bundler = "esbuild"
```

## 🔄 QUICK RESTORE

1. **Copy Files**: Copy all code files above to their respective paths
2. **Install Dependencies**: `npm install`
3. **Environment Setup**: Add required environment variables to .env.local
4. **Start Development**: `npm run dev`
5. **Test Locally**: Visit http://localhost:3000
6. **Deploy Staging**: `npm run build && netlify deploy --dir=.next --alias=staging`
7. **Deploy Production**: `netlify deploy --prod` (when ready)

## 📊 DEPLOYMENT INFO

- **Staging URL**: https://staging--sam-new-sep-7.netlify.app
- **Production URL**: https://app.meet-sam.com
- **Build Status**: ✅ Successful
- **Test Status**: ✅ All features working

## 🎯 UNIQUE FEATURES

### Fixed Clerk Authentication
- [Describe key features here]
- [Add technical details]
- [Include any special configurations]

---

**This milestone represents: Fixed invalid Clerk publishable key - authentication modals now working properly on production**
