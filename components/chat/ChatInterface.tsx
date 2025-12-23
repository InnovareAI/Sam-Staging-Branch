'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Mic, Sparkles, Smile, Copy, Volume2, VolumeX, MessageSquare, AudioLines, FileText, X, Archive, BookmarkPlus } from 'lucide-react';
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
        archiveThread
    } = useSamThreadedChat();

    const { refreshContext, setActiveTab, setIsContextOpen, processContext } = useSamContext();

    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activityStatus, setActivityStatus] = useState('thinking');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [copied, setCopied] = useState(false);
    const [pendingAttachments, setPendingAttachments] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [savedToKb, setSavedToKb] = useState<string | null>(null); // Track which message was saved

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
            // Stop recording
            if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        } else {
            // Start recording
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                // Detect supported mimeType
                let mimeType = 'audio/webm';
                if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                    mimeType = 'audio/webm;codecs=opus';
                } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                    mimeType = 'audio/mp4'; // Safari
                }

                console.log(`[Voice] Starting recording with mimeType: ${mimeType}`);

                const mediaRecorder = new MediaRecorder(stream, { mimeType });
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                        console.log(`[Voice] Data chunk received: ${event.data.size} bytes`);
                    }
                };

                mediaRecorder.onstop = async () => {
                    // Stop all tracks
                    stream.getTracks().forEach(track => track.stop());

                    // Create audio blob and transcribe
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    console.log(`[Voice] Recording stopped. Final blob size: ${audioBlob.size} bytes, type: ${audioBlob.type}`);

                    if (audioBlob.size > 0) {
                        await transcribeAudio(audioBlob, mimeType);
                    } else {
                        console.warn('[Voice] Audio blob is empty, skipping transcription');
                        setIsRecording(false);
                    }
                };

                mediaRecorder.start();
                setIsRecording(true);
            } catch (error) {
                console.error('Error accessing microphone:', error);
                alert('Could not access microphone. Please check permissions.');
                setIsRecording(false);
            }
        }
    };

    // Transcribe audio using Whisper API
    const transcribeAudio = async (audioBlob: Blob, mimeType: string) => {
        setIsTranscribing(true);
        try {
            const formData = new FormData();
            // Append file with correct extension based on mimeType
            const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
            formData.append('audio', audioBlob, `recording.${extension}`);

            console.log(`[Voice] Sending to API...`);

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            if (data.success && data.text) {
                console.log(`[Voice] Transcription success: "${data.text}"`);
                setInput(prev => prev + (prev ? ' ' : '') + data.text);
            } else {
                console.error('Transcription failed result:', data);
            }
        } catch (error) {
            console.error('Error transcribing audio:', error);
        } finally {
            setIsTranscribing(false);
        }
    };

    // Text-to-Speech state
    const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
    const [audioMode, setAudioMode] = useState(false); // Toggle: text vs audio mode
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Speak text using OpenAI TTS
    const speakText = async (text: string, messageId: string) => {
        // If already playing this message, stop it
        if (speakingMessageId === messageId) {
            audioRef.current?.pause();
            audioRef.current = null;
            setSpeakingMessageId(null);
            return;
        }

        // Stop any currently playing audio
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }

        try {
            setSpeakingMessageId(messageId);

            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, voice: 'echo' }),
            });

            if (!response.ok) throw new Error('TTS request failed');

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onended = () => {
                setSpeakingMessageId(null);
                URL.revokeObjectURL(audioUrl);
            };

            audio.onerror = () => {
                setSpeakingMessageId(null);
                console.error('Audio playback error');
            };

            await audio.play();
        } catch (error) {
            console.error('TTS error:', error);
            setSpeakingMessageId(null);
        }
    };

    // Refresh context when thread changes
    useEffect(() => {
        if (currentThread?.id) {
            refreshContext(currentThread.id);
        }
    }, [currentThread?.id]);

    // Auto-speak new messages when in audio mode
    useEffect(() => {
        if (audioMode && messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'assistant' && !isSending) {
                // Small delay to ensure message is fully rendered
                const timer = setTimeout(() => {
                    speakText(lastMessage.content, lastMessage.id);
                }, 500);
                return () => clearTimeout(timer);
            }
        }
    }, [messages, audioMode, isSending]);

    // Essential reaction emojis
    const quickEmojis = ['👍', '👎', '😊'];

    // Activity status messages that cycle while Sam is processing
    const activityMessages = [
        { status: 'thinking', text: 'Sam is thinking...' },
        { status: 'researching', text: 'Sam is researching...' },
        { status: 'analyzing', text: 'Sam is analyzing...' },
        { status: 'crafting', text: 'Sam is crafting a response...' }
    ];

    // Cycle through activity statuses while sending
    useEffect(() => {
        if (!isSending) {
            setActivityStatus('thinking');
            return;
        }

        let index = 0;
        const interval = setInterval(() => {
            index = (index + 1) % activityMessages.length;
            setActivityStatus(activityMessages[index].status);
        }, 2500);

        return () => clearInterval(interval);
    }, [isSending]);

    // Auto-scroll to bottom of messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isSending]);

    // Handle file upload
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !currentThread) return;

        setIsUploading(true);
        try {
            const uploadedAttachments = [];
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('threadId', currentThread.id);
                if (currentThread.workspace_id) {
                    formData.append('workspaceId', currentThread.workspace_id);
                }

                const response = await fetch('/api/sam/attachments', {
                    method: 'POST',
                    body: formData,
                });

                const data = await response.json();
                if (data.success && data.attachment) {
                    uploadedAttachments.push(data.attachment);
                } else {
                    console.error('Upload failed:', data.error);
                }
            }
            setPendingAttachments(prev => [...prev, ...uploadedAttachments]);
        } catch (error) {
            console.error('Error uploading files:', error);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSend = async () => {
        if (!input.trim() && pendingAttachments.length === 0) return;

        const currentInput = input;
        const attachmentIds = pendingAttachments.map(a => a.id);

        setInput('');
        setPendingAttachments([]);

        await sendMessage(currentInput, undefined, attachmentIds);

        // Feed message into AI Context Processor
        processContext(currentInput, currentThread?.thread_type || 'general');

        // Refresh context after sending to catch any updates (e.g. lead score)
        if (currentThread?.id) {
            refreshContext(currentThread.id);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="max-w-3xl mx-auto space-y-6 py-4">

                    {/* Welcome State if no messages */}
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
                            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/10 to-transparent overflow-hidden shadow-2xl ring-4 ring-primary/10">
                                <img
                                    src="/SAM.jpg"
                                    alt="Sam AI"
                                    className="w-full h-full rounded-2xl object-cover"
                                    style={{ objectPosition: 'center 30%' }}
                                />
                            </div>
                            <h3 className="text-2xl font-medium text-foreground">Meet Sam — Your Orchestration Agent</h3>
                            <p className="text-lg text-foreground font-medium">What do you want to tackle today?</p>
                            <p className="max-w-sm text-base text-muted-foreground">
                                Ready to help with prospect research, campaign management, or strategic analysis.
                            </p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={cn(
                                "flex w-full gap-3",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 mt-1">
                                    <img
                                        src="/SAM.jpg"
                                        alt="Sam"
                                        className="w-10 h-10 object-cover"
                                        style={{ objectPosition: 'center 30%' }}
                                    />
                                </div>
                            )}
                            <div
                                className={cn(
                                    "max-w-[75%] rounded-2xl p-4 shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                        : "bg-surface-highlight text-foreground border border-border/40 rounded-bl-none"
                                )}
                            >
                                {msg.role === 'assistant' ? (
                                    <RichMessageRenderer content={msg.content} />
                                ) : (
                                    <div className="text-base leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                )}

                                {/* Attachments */}
                                {msg.attachments && msg.attachments.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {msg.attachments.map((file) => (
                                            <div
                                                key={file.id}
                                                className={cn(
                                                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border",
                                                    msg.role === 'user'
                                                        ? "bg-white/10 border-white/20 text-foreground"
                                                        : "bg-surface border-border text-foreground"
                                                )}
                                            >
                                                <FileText size={14} className="opacity-70" />
                                                <span className="max-w-[150px] truncate">{file.file_name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {/* Speaker button for assistant messages */}
                                {msg.role === 'assistant' && (
                                    <button
                                        onClick={() => speakText(msg.content, msg.id)}
                                        className={cn(
                                            "mt-2 flex items-center gap-1.5 text-xs transition-all",
                                            speakingMessageId === msg.id
                                                ? "text-primary"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                        title={speakingMessageId === msg.id ? "Stop" : "Listen"}
                                    >
                                        {speakingMessageId === msg.id ? (
                                            <><VolumeX size={14} /> Stop</>
                                        ) : (
                                            <><Volume2 size={14} /> Listen</>
                                        )}
                                    </button>
                                )}
                            </div>
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
                {/* Quick Action Chips */}
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

                {/* Floating Card Composer */}
                <div className="max-w-3xl mx-auto">
                    <div className="bg-surface-muted/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl ring-1 ring-white/10 overflow-hidden">
                        {/* Pending Attachments List */}
                        {pendingAttachments.length > 0 && (
                            <div className="px-4 pt-4 flex flex-wrap gap-2 border-b border-border/20 pb-2">
                                {pendingAttachments.map((file) => (
                                    <div key={file.id} className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-lg text-sm text-primary group">
                                        <FileText size={14} />
                                        <span className="max-w-[120px] truncate">{file.file_name}</span>
                                        <button
                                            onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== file.id))}
                                            className="ml-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                                {isUploading && (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-highlight border border-border/40 rounded-lg text-sm text-muted-foreground animate-pulse">
                                        <div className="w-3 h-3 border-2 border-primary/50 border-t-transparent rounded-full animate-spin" />
                                        Uploading...
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Textarea */}
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
                            className="w-full bg-transparent border-0 resize-none p-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0 min-h-[80px] max-h-[200px]"
                            disabled={isSending}
                            maxLength={2000}
                            rows={3}
                        />

                        {/* Hidden File Input */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            multiple
                            onChange={handleFileUpload}
                        />

                        {/* Bottom Action Bar - Subtle Tinted Style */}
                        <div className="flex items-center justify-between px-3 py-3 border-t border-border/30 bg-surface/30">
                            <div className="flex items-center gap-2">
                                {/* Hidden File Input */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className={cn(
                                        "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                                        isUploading
                                            ? "bg-[#8B5CF6]/10 text-[#A78BFA] animate-pulse"
                                            : "bg-[#8B5CF6]/15 text-[#A78BFA] hover:bg-[#8B5CF6]/25 hover:text-[#C4B5FD]"
                                    )}
                                    title="Attach file"
                                    disabled={isUploading}
                                >
                                    <Paperclip size={20} />
                                </button>
                                {/* Copy - Soft Teal Tint */}
                                <button
                                    onClick={async () => {
                                        if (input.trim()) {
                                            await navigator.clipboard.writeText(input);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }
                                    }}
                                    className={cn(
                                        "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                                        copied
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-[#14B8A6]/15 text-[#2DD4BF] hover:bg-[#14B8A6]/25 hover:text-[#5EEAD4]"
                                    )}
                                    title={copied ? "Copied!" : "Copy text"}
                                >
                                    <Copy size={20} />
                                </button>
                                {/* Mic - Soft Pink Tint (Voice Recording) */}
                                <button
                                    onClick={toggleRecording}
                                    disabled={isTranscribing}
                                    className={cn(
                                        "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                                        isRecording
                                            ? "bg-red-500/30 text-red-400 animate-pulse ring-2 ring-red-500/50"
                                            : isTranscribing
                                                ? "bg-[#EC4899]/25 text-[#F472B6] opacity-50 cursor-wait"
                                                : "bg-[#EC4899]/15 text-[#F472B6] hover:bg-[#EC4899]/25 hover:text-[#F9A8D4]"
                                    )}
                                    title={isRecording ? "Stop recording" : isTranscribing ? "Transcribing..." : "Voice input"}
                                >
                                    <Mic size={20} />
                                </button>
                                {/* Audio/Text Mode Toggle - Soft Blue Tint */}
                                <button
                                    onClick={() => setAudioMode(!audioMode)}
                                    className={cn(
                                        "w-11 h-11 rounded-full flex items-center justify-center transition-all",
                                        audioMode
                                            ? "bg-primary/25 text-primary ring-2 ring-primary/40"
                                            : "bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 hover:text-blue-300"
                                    )}
                                    title={audioMode ? "Switch to Text Mode" : "Switch to Audio Mode"}
                                >
                                    {audioMode ? <AudioLines size={20} /> : <MessageSquare size={20} />}
                                </button>
                                {/* Emoji Picker - Soft Gold Tint */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                        className={cn(
                                            "w-11 h-11 rounded-full bg-[#F59E0B]/15 flex items-center justify-center text-[#FBBF24] hover:bg-[#F59E0B]/25 hover:text-[#FCD34D] transition-all",
                                            showEmojiPicker && "ring-2 ring-[#FBBF24]/30"
                                        )}
                                    >
                                        <Smile size={20} />
                                    </button>
                                    {showEmojiPicker && (
                                        <div className="absolute bottom-10 left-0 bg-surface-highlight border border-border/40 rounded-xl p-2 shadow-lg z-20">
                                            <div className="flex gap-1">
                                                {quickEmojis.map((emoji) => (
                                                    <button
                                                        key={emoji}
                                                        onClick={() => {
                                                            setInput(prev => prev + emoji);
                                                            setShowEmojiPicker(false);
                                                        }}
                                                        className="w-9 h-9 flex items-center justify-center hover:bg-surface/50 rounded text-lg transition-colors"
                                                    >
                                                        {emoji}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {/* Archive Button - Orange Tint */}
                                <button
                                    onClick={async () => {
                                        if (currentThread) {
                                            await archiveThread(currentThread.id);
                                        }
                                    }}
                                    disabled={!currentThread}
                                    className={cn(
                                        "w-11 h-11 rounded-full flex items-center justify-center transition-all ring-2",
                                        !currentThread
                                            ? "opacity-30 cursor-not-allowed bg-orange-500/10 text-orange-300 ring-orange-400/20"
                                            : "bg-orange-500/20 text-orange-400 ring-orange-400/50 hover:bg-orange-500/30 hover:text-orange-300 hover:ring-orange-400/70"
                                    )}
                                    title={currentThread ? "Archive this chat" : "No active chat to archive"}
                                >
                                    <Archive size={20} />
                                </button>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Character Counter */}
                                <span className={cn(
                                    "text-xs transition-colors",
                                    input.length > 1800 ? "text-yellow-500" : "text-muted-foreground/50",
                                    input.length > 1950 ? "text-red-500" : ""
                                )}>
                                    {input.length > 0 && `${input.length}/2000`}
                                </span>

                                {/* Send Button - Purple/Magenta */}
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || isSending}
                                    className={cn(
                                        "h-11 px-5 rounded-full flex items-center justify-center gap-2 font-medium transition-all shadow-md",
                                        input.trim()
                                            ? "bg-gradient-to-br from-[#7C3AED] to-[#A855F7] text-white hover:shadow-lg hover:scale-105"
                                            : "bg-surface-highlight text-muted-foreground"
                                    )}
                                >
                                    <Send size={18} />
                                    <span>Send</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Footer Text */}
                    <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-muted-foreground/40 font-medium">
                        <span>Sam Orchestration v4.5</span>
                        <span>•</span>
                        <span>⇧⏎ new line</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
