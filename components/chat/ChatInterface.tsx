'use client';

import { useState } from 'react';
import { Send, Paperclip, Mic, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils'; // Assuming you have a utils file for merging classes

export function ChatInterface() {
    const [messages, setMessages] = useState([
        { role: 'assistant', content: "Hello! I'm Sam. I've analyzed your new leads from HubSpot. Shall we review the top 5 high-value prospects?" },
        { role: 'user', content: "Yes, let's start with John Smith from Acme Inc." }
    ]);
    const [input, setInput] = useState('');

    return (
        <div className="flex flex-col h-full bg-background relative">
            {/* Messages Area */}
            <ScrollArea className="flex-1 p-4">
                <div className="max-w-3xl mx-auto space-y-6 py-4">
                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex w-full",
                                msg.role === 'user' ? "justify-end" : "justify-start"
                            )}
                        >
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl p-4 shadow-sm",
                                    msg.role === 'user'
                                        ? "bg-primary text-primary-foreground rounded-br-none"
                                        : "bg-surface-highlight text-foreground border border-border/40 rounded-bl-none"
                                )}
                            >
                                <div className="text-sm leading-relaxed">{msg.content}</div>
                            </div>
                        </div>
                    ))}

                    {/* MOCK: AI Thinking Indicator */}
                    <div className="flex justify-start">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
                            <Sparkles size={12} className="animate-pulse text-accent" />
                            Sam is analyzing John's LinkedIn profile...
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border/40 bg-background/80 backdrop-blur pb-8">
                <div className="max-w-3xl mx-auto relative flex items-center gap-2 bg-surface-muted/50 border border-border/40 rounded-full px-2 py-2 shadow-lg ring-1 ring-white/5 focus-within:ring-primary/50 transition-all">

                    <Button size="icon" variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground shrink-0 h-10 w-10">
                        <Paperclip size={20} />
                    </Button>

                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask Sam anything..."
                        className="flex-1 border-0 bg-transparent focus-visible:ring-0 px-2 h-10 shadow-none placeholder:text-muted-foreground/50"
                    />

                    <Button size="icon" variant="ghost" className="rounded-full text-muted-foreground hover:text-foreground shrink-0 h-10 w-10">
                        <Mic size={20} />
                    </Button>

                    <Button
                        size="icon"
                        className="rounded-full shrink-0 h-10 w-10 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
                    >
                        <Send size={18} className="ml-0.5" />
                    </Button>
                </div>
                <div className="text-center mt-2 text-[10px] text-muted-foreground/40 font-medium">
                    Sam Orchestration Agent v4.5 | Connected to 14 Tools
                </div>
            </div>
        </div>
    );
}
