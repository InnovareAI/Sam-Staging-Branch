'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Mic, Sparkles, Smile, Copy, Volume2, VolumeX, MessageSquare, AudioLines, FileText, X, Archive, Plus, Search as SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSamThreadedChat, SamThreadMessage } from '@/lib/hooks/useSamThreadedChat';
import { useSamContext } from './SamContextProvider';
import { RichMessageRenderer } from './RichMessageRenderer';

export function ChatInterface() {
    const {
        currentThread,
        messages,
        sendMessage,
        isLoading,
        isSending,
        createThread,
        archiveThread,
        switchToThread
    } = useSamThreadedChat();

    const { refreshContext, setActiveTab, isContextOpen, setIsContextOpen, processContext } = useSamContext();

    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activityStatus, setActivityStatus] = useState('thinking');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [copied, setCopied] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [savedToKb, setSavedToKb] = useState<string | null>(null);

    // Save conversation snippet to Knowledge Base
    const saveToKnowledgeBase = async (message: SamThreadMessage) => {
        try {
            setSavedToKb(message.id);
            const response = await fetch('/api/knowledge-base/documents', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `Conversation Snippet - ${new Date().toLocaleDateString()}`,
                    content: message.content,
                    category: 'conversation-snippets',
                    source: 'chat',
                    workspace_id: currentThread?.workspace_id,
                }),
            });

            if (!response.ok) throw new Error('Failed to save to KB');

            setTimeout(() => setSavedToKb(null), 2000);
        } catch (error) {
            console.error('Error saving to KB:', error);
            setSavedToKb(null);
        }
    };

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Start/stop voice recording
    const toggleRecording = async () => {
        if (isRecording) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                let mimeType = 'audio/webm';
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4';
                }

                const mediaRecorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    await transcribeAudio(audioBlob);
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                setIsRecording(true);
            } catch (err) {
                console.error("[Voice] Error starting recording:", err);
            }
        }
    };

    const transcribeAudio = async (audioBlob: Blob) => {
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.webm');

            const response = await fetch('/api/sam/transcribe', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();
            if (data.text) {
                setInput(prev => prev + (prev ? ' ' : '') + data.text);
            }
        } catch (err) {
            console.error("[Voice] Transcription error:", err);
        } finally {
            setIsTranscribing(false);
        }
    };

    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
    const [audioMode, setAudioMode] = useState(false);

    const speakText = async (text: string, messageId: string) => {
        if (speakingMessageId === messageId) {
            window.speechSynthesis.cancel();
            setSpeakingMessageId(null);
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => setSpeakingMessageId(null);
        setSpeakingMessageId(messageId);
        window.speechSynthesis.speak(utterance);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setIsUploading(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const formData = new FormData();
                formData.append('file', file);
                formData.append('workspaceId', currentThread?.workspace_id || '');

                const response = await fetch('/api/sam/upload', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const data = await response.json();
                    setPendingAttachments(prev => [...prev, data.file]);
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isSending) return;
        const messageText = input;
        const attachments = pendingAttachments;
        setInput('');
        setPendingAttachments([]);

        await sendMessage(messageText, attachments);
        refreshContext();
    };

    const quickEmojis = ['👍', '👎', '😄', '🤔', '🚀', '🎯', '📚'];

    const activityMessages = [
        { status: 'thinking', text: 'Sam is thinking...' },
        { status: 'searching', text: 'Searching knowledge base...' },
        { status: 'analyzing', text: 'Analyzing prospect data...' },
        { status: 'generating', text: 'Drafting response...' }
    ];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isSending]);

    return (
        <div className="flex flex-row h-full bg-background relative overflow-hidden">

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-w-0 relative">
                {/* Chat Header */}
                <div className="h-16 border-b border-white/5 px-6 flex items-center justify-between bg-background/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                            <MessageSquare size={18} />
                        </div>
                        <div className="flex flex-col">
                            <h2 className="text-sm font-semibold truncate max-w-[300px]">
                                {currentThread?.title || "New Chat"}
                            </h2>
                            {currentThread?.prospect_name && (
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
                                    {currentThread.prospect_name} @ {currentThread.prospect_company}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                                createThread({ title: 'New Chat', thread_type: 'general' });
                            }}
                            className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/20 gap-2 px-4 shadow-lg shadow-primary/10"
                        >
                            <Plus size={16} />
                            <span className="font-bold">New Chat</span>
                        </Button>

                        {currentThread && (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => archiveThread(currentThread.id)}
                                            className="text-slate-500 hover:text-white"
                                        >
                                            <Archive size={18} />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>Archive this chat</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsContextOpen(!isContextOpen)}
                            className={cn(
                                "transition-colors",
                                isContextOpen ? "text-primary bg-primary/10" : "text-muted-foreground"
                            )}
                        >
                            <Sparkles size={18} />
                        </Button>
                    </div>
                </div>

                {/* Messages Area */}
                <ScrollArea className="flex-1 px-4 py-0">
                    <div className="max-w-3xl mx-auto space-y-6 py-8">
                        {/* Welcome State if no messages */}
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent overflow-hidden shadow-2xl ring-4 ring-primary/10">
                                    <img src="/SAM.jpg" alt="Sam" className="w-full h-full object-cover" />
                                </div>
                                <div className="space-y-1">
                                    <h1 className="text-2xl font-bold text-white tracking-tight">Meet Sam — Your Orchestration Agent</h1>
                                    <p className="text-slate-400 max-w-sm mx-auto">What do you want to tackle today? I'm ready to help with research, campaigns, or strategy.</p>
                                </div>
                            </div>
                        )}

                        {messages.map((msg, index) => (
                            <div
                                key={msg.id || index}
                                className={cn(
                                    "flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300",
                                    msg.role === 'user' ? "justify-end" : "justify-start"
                                )}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 mt-1 shadow-md ring-2 ring-white/5">
                                        <img src="/SAM.jpg" alt="Sam" className="w-10 h-10 object-cover" style={{ objectPosition: 'center 30%' }} />
                                    </div>
                                )}

                                <div className={cn(
                                    "max-w-[85%] group relative",
                                    msg.role === 'user' ? "text-right" : "text-left"
                                )}>
                                    <div className={cn(
                                        "px-4 py-3 rounded-2xl shadow-sm border",
                                        msg.role === 'user'
                                            ? "bg-primary text-white border-primary/20 rounded-tr-none"
                                            : "bg-surface-highlight border-border/40 text-foreground rounded-tl-none"
                                    )}>
                                        <RichMessageRenderer content={msg.content} />
                                    </div>

                                    {/* Message Metadata/Actions */}
                                    <div className={cn(
                                        "mt-2 flex items-center gap-3 text-[10px] font-medium text-muted-foreground/60 transition-opacity",
                                        msg.role === 'user' ? "justify-end" : "justify-start"
                                    )}>
                                        <span>{new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        {msg.role === 'assistant' && (
                                            <>
                                                <button onClick={() => saveToKnowledgeBase(msg)} className="hover:text-primary flex items-center gap-1">
                                                    {savedToKb === msg.id ? <><Sparkles size={10} /> Saved!</> : <><Plus size={10} /> Save to KB</>}
                                                </button>
                                                <button onClick={() => speakText(msg.content, msg.id || index.toString())} className="hover:text-primary">
                                                    {speakingMessageId === (msg.id || index.toString()) ? "Stop" : "Listen"}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {msg.role === 'user' && (
                                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-1 border border-primary/30">
                                        <span className="text-xs font-bold text-primary">YOU</span>
                                    </div>
                                )}
                            </div>
                        ))}

                        {isSending && (
                            <div className="flex justify-start gap-3">
                                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 mt-1">
                                    <img src="/SAM.jpg" alt="Sam" className="w-10 h-10 object-cover" style={{ objectPosition: 'center 30%' }} />
                                </div>
                                <div className="bg-surface-highlight border border-border/40 rounded-2xl rounded-bl-none p-4 flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2.5 h-2.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                    <span className="text-base text-muted-foreground animate-pulse">
                                        {activityMessages.find(m => m.status === activityStatus)?.text || 'Sam is thinking...'}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>

                {/* Floating Composer */}
                <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pb-6">
                    {messages.length === 0 && (
                        <div className="max-w-3xl mx-auto mb-3 flex flex-wrap gap-2 justify-center">
                            {[
                                { emoji: '🚀', label: 'Continue Onboarding', prompt: 'Help me continue the onboarding process' },
                                { emoji: '📚', label: 'Add to Knowledgebase', prompt: 'I want to add information to my knowledgebase: ' },
                                { emoji: '🎯', label: 'Find leads on LinkedIn', prompt: 'Help me find leads on LinkedIn matching my ICP: ' },
                                { emoji: '📊', label: 'Analyze pipeline', prompt: 'Analyze my current sales pipeline and suggest priorities' }
                            ].map((action) => (
                                <button
                                    key={action.label}
                                    onClick={() => setInput(action.prompt)}
                                    className="px-4 py-2.5 text-sm rounded-xl bg-surface-highlight/50 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-surface-highlight hover:border-primary/30 transition-all font-medium"
                                >
                                    {action.emoji} {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="max-w-3xl mx-auto">
                        <div className="bg-surface-muted/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
                            {pendingAttachments.length > 0 && (
                                <div className="px-4 pt-4 flex flex-wrap gap-2 border-b border-border/20 pb-2">
                                    {pendingAttachments.map((file) => (
                                        <div key={file.id} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary group">
                                            <FileText size={14} />
                                            <span className="max-w-[120px] truncate">{file.file_name}</span>
                                            <button onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== file.id))} className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-500">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    {isUploading && <div className="animate-pulse text-xs text-muted-foreground">Uploading...</div>}
                                </div>
                            )}

                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={currentThread ? `Reply to ${currentThread.title}...` : "Ask Sam anything..."}
                                className="w-full bg-transparent border-0 resize-none p-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none min-h-[80px] max-h-[200px]"
                                disabled={isSending}
                                maxLength={2000}
                                rows={3}
                            />

                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />

                            <div className="flex items-center justify-between px-3 py-3 border-t border-border/30 bg-surface/30">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => fileInputRef.current?.click()} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-white/10">
                                        <Paperclip size={18} />
                                    </button>
                                    <button onClick={toggleRecording} className={cn("w-10 h-10 rounded-full flex items-center justify-center transition-all", isRecording ? "bg-red-500/20 text-red-500" : "bg-white/5 text-muted-foreground hover:bg-white/10")}>
                                        <Mic size={18} />
                                    </button>
                                    <div className="relative">
                                        <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-white/10">
                                            <Smile size={18} />
                                        </button>
                                        {showEmojiPicker && (
                                            <div className="absolute bottom-12 left-0 bg-surface border border-border rounded-xl p-2 shadow-2xl flex gap-1 z-50">
                                                {quickEmojis.map(emoji => <button key={emoji} onClick={() => { setInput(p => p + emoji); setShowEmojiPicker(false); }} className="hover:bg-white/10 p-1 rounded">{emoji}</button>)}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => currentThread && archiveThread(currentThread.id)} disabled={!currentThread} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-muted-foreground hover:bg-white/10 disabled:opacity-30">
                                        <Archive size={18} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] text-muted-foreground/50">{input.length > 0 && `${input.length}/2000`}</span>
                                    <button onClick={handleSend} disabled={!input.trim() || isSending} className={cn("h-10 px-5 rounded-full flex items-center gap-2 font-medium transition-all", input.trim() ? "bg-primary text-white shadow-lg shadow-primary/20" : "bg-white/5 text-muted-foreground")}>
                                        <Send size={16} />
                                        <span>Send</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 text-center text-[10px] text-muted-foreground/30">Sam Orchestration v4.5 • ⇧⏎ new line</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
