'use client';

import { Suspense, useState, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function EditReplyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const draftId = searchParams.get('id');
  const token = searchParams.get('token');

  // Draft State
  const [draft, setDraft] = useState<any>(null);
  const [editedText, setEditedText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (draftId && token) {
      fetchDraft();
    }
  }, [draftId, token]);

  useEffect(() => {
    // Scroll chat to bottom when messages change
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchDraft() {
    try {
      const res = await fetch(`/api/reply-agent/draft?id=${draftId}&token=${token}`);
      if (!res.ok) throw new Error('Failed to fetch draft');
      const data = await res.json();
      setDraft(data.draft);
      setEditedText(data.draft.draft_text);
      // Add initial welcome message from Sam
      setMessages([
        {
          role: 'assistant',
          content: "Hi! I'm Sam. I drafted this reply for you. Let me know if you want any changes, or ask for advice on the best approach!"
        }
      ]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAndSend() {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/reply-agent/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          action: 'approve',
          editedText: editedText,
        }),
      });
      if (!res.ok) throw new Error('Failed to send reply');
      setSuccess('Reply sent successfully!');
      setTimeout(() => router.push('/reply-agent-result?status=success'), 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleChatSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Optimistically add user message
    const newHistory = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newHistory);
    setIsChatting(true);

    try {
      const res = await fetch('/api/reply-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId,
          token,
          messages: newHistory,
          currentDraft: editedText
        }),
      });

      if (!res.ok) throw new Error('Failed to get response');
      const data = await res.json();

      // Check if the response contains a code block which usually indicates a rewrite
      const codeBlockMatch = data.response.match(/```(?:text|email)?\n([\s\S]*?)```/);

      setMessages([...newHistory, { role: 'assistant', content: data.response }]);

    } catch (err: any) {
      setMessages([...newHistory, { role: 'assistant', content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsChatting(false);
    }
  }

  // Helper to extract text from code blocks in chat to update draft
  const extractAndApplyDraft = (content: string) => {
    const codeBlockMatch = content.match(/```(?:text|email)?\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      setEditedText(codeBlockMatch[1].trim());
    } else {
      // If no code block, try to find the longest paragraph? 
      // Or just copy the whole thing? Safer to just copy whole thing if user explicitly clicks "Use this"
      setEditedText(content.replace(/^AI: /i, '').trim());
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white animate-pulse">Loading Sam...</div>
      </div>
    );
  }

  if (error && !draft) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full">
          <h1 className="text-xl font-bold text-red-600 mb-2">Unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#130d25] md:p-8 p-0 flex flex-col items-center justify-center font-sans">

      {/* Main Container Card */}
      <div className="bg-white md:rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl md:flex h-screen md:h-[85vh] flex-col md:flex-row">

        {/* LEFT PANE: Context & Editor (60%) */}
        <div className="w-full md:w-3/5 flex flex-col border-r border-gray-200">

          {/* Header */}
          <div className="bg-white border-b border-gray-100 p-6 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900">Reply to {draft?.prospect_name}</h1>
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">Draft</span>
              </div>
              {/* LinkedIn Link */}
              {draft?.prospect_linkedin_url && (
                <a
                  href={draft.prospect_linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                  View Profile
                </a>
              )}
            </div>
            <p className="text-gray-500 text-sm truncate">
              {draft?.prospect_title || 'Unknown Title'} • {draft?.prospect_company}
            </p>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">

            {/* Their Message Bubble */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Their Message</label>
              <div className="bg-white border-l-4 border-blue-500 rounded-r-lg shadow-sm p-4 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                {draft?.inbound_message_text}
              </div>
            </div>

            {/* Editor Area */}
            <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider ml-1">Your Reply</label>
                <span className="text-xs text-gray-400">{editedText.length} chars</span>
              </div>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full flex-1 p-5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-800 text-sm leading-relaxed font-mono shadow-inner bg-white"
                placeholder="Write your reply here..."
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-white border-t border-gray-100 flex gap-3">
            <button
              onClick={() => router.back()}
              className="px-6 py-3 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveAndSend}
              disabled={submitting || !editedText.trim()}
              className="flex-1 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>✉️ Send Reply Now</>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT PANE: Assistant Chat (40%) */}
        <div className="w-full md:w-2/5 bg-gray-900 border-l border-gray-800 flex flex-col h-[50vh] md:h-auto">

          {/* Chat Header */}
          <div className="p-4 border-b border-gray-800 bg-gray-900 flex justify-between items-center shadow-md z-10">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-700">
                <img
                  src="/SAM.jpg"
                  alt="Sam AI"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-100">Chat with Sam AI</h3>
                <p className="text-xs text-gray-500">Powered by Claude Opus 4.5</p>
              </div>
            </div>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900/50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`
                    max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gray-800 text-gray-200 rounded-bl-none border border-gray-700'}
                  `}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* If assistant message has code block, verify button */}
                  {msg.role === 'assistant' && (msg.content.includes('```') || msg.content.length > 50) && idx !== 0 && (
                    <button
                      onClick={() => extractAndApplyDraft(msg.content)}
                      className="mt-3 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded transition-colors flex items-center gap-1 w-full justify-center border border-gray-600"
                    >
                      ⬇️ Use this version
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isChatting && (
              <div className="flex justify-start">
                <div className="bg-gray-800 rounded-2xl rounded-bl-none px-4 py-3 border border-gray-700 flex gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Suggestion Chips */}
          <div className="px-4 pb-2 bg-gray-900 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <div className="flex gap-2">
              <button onClick={() => setChatInput("Research this prospect")} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 transition-colors">
                🔍 Research Prospect
              </button>
              <button onClick={() => setChatInput("Add a link to our demo video")} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 transition-colors">
                🔗 Add Link
              </button>
              <button onClick={() => setChatInput("Make it shorter and more casual")} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 transition-colors">
                ✨ Rewrite
              </button>
              <button onClick={() => setChatInput("Add context: We met at the Tech Summit")} className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white px-3 py-1.5 rounded-full border border-gray-700 transition-colors">
                📝 Add Context
              </button>
            </div>
          </div>

          {/* Chat Input */}
          <div className="p-4 bg-gray-900 border-t border-gray-800">
            <form onSubmit={handleChatSubmit} className="relative">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask Sam to changes (e.g. 'Make it shorter')"
                className="w-full bg-gray-800 text-white placeholder-gray-500 text-sm rounded-xl pl-4 pr-12 py-3.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 border border-gray-700 shadow-sm transition-all"
                disabled={isChatting}
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatting}
                className="absolute right-2 top-2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
            <p className="text-center text-xs text-gray-600 mt-2">
              Sam reads your draft and can make intelligent edits.
            </p>
          </div>

        </div>
      </div>

      {/* Success/Error Toasts */}
      {(success || error) && (
        <div className={`fixed top-4 right-4 px-6 py-4 rounded-lg shadow-xl text-white font-medium animate-slide-in z-50 ${success ? 'bg-green-600' : 'bg-red-600'}`}>
          {success || error}
        </div>
      )}
    </div>
  );
}

export default function EditReplyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <EditReplyContent />
    </Suspense>
  );
}
