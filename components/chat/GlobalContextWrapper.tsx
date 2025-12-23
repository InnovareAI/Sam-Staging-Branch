'use client';

import React from 'react';
import { useSamContext } from "@/components/chat/SamContextProvider";
import { ContextPanel } from "@/components/chat/ContextPanel";
import { useSidebar } from "@/components/ui/sidebar";
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from "@/lib/utils";

export function GlobalContextWrapper() {
    const { isContextOpen, setIsContextOpen } = useSamContext();
    const { open: isSidebarOpen, setOpen: setSidebarOpen } = useSidebar();

    return (
        <>
            {/* Left Sidebar Toggle Flap */}
            <button
                onClick={() => setSidebarOpen(!isSidebarOpen)}
                className={cn(
                    "fixed top-1/2 -translate-y-1/2 z-[100] transition-all duration-300 ease-in-out",
                    "w-6 h-16 flex items-center justify-center",
                    "bg-[#0f172a]/80 backdrop-blur-md border border-white/10 rounded-r-xl shadow-[0_0_20px_rgba(0,0,0,0.3)]",
                    "text-slate-400 hover:text-white hover:bg-white/5 group",
                    isSidebarOpen ? "left-[16rem]" : "left-0"
                )}
                title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
            >
                <ChevronLeft
                    size={16}
                    className={cn(
                        "transition-transform duration-300",
                        !isSidebarOpen && "rotate-180"
                    )}
                />

                {/* Visual indicator line */}
                <div className="absolute left-0 top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Right Context Panel Toggle Flap */}
            <button
                onClick={() => setIsContextOpen(!isContextOpen)}
                className={cn(
                    "fixed top-1/2 -translate-y-1/2 z-[100] transition-all duration-300 ease-in-out",
                    "w-6 h-16 flex items-center justify-center",
                    "bg-[#0f172a]/80 backdrop-blur-md border border-white/10 rounded-l-xl shadow-[0_0_20px_rgba(0,0,0,0.3)]",
                    "text-slate-400 hover:text-white hover:bg-white/5 group",
                    isContextOpen ? "right-80" : "right-0"
                )}
                title={isContextOpen ? "Close context" : "Open context"}
            >
                <ChevronRight
                    size={16}
                    className={cn(
                        "transition-transform duration-300",
                        isContextOpen && "rotate-180"
                    )}
                />

                {/* Visual indicator line */}
                <div className="absolute right-0 top-1/4 bottom-1/4 w-[1px] bg-gradient-to-b from-transparent via-primary/50 to_transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>

            {/* Context Panel */}
            <div className={cn(
                "fixed right-0 top-0 h-full w-80 z-[90]",
                "bg-[#020617]/95 backdrop-blur-md border-l border-white/5 shadow-2xl",
                "transform transition-transform duration-300 ease-in-out",
                isContextOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <ContextPanel />
            </div>
        </>
    );
}
