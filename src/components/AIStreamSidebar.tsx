'use client';

import { motion, AnimatePresence } from "framer-motion";
import { useRef, useEffect } from "react";
import PlanningHUD from "./PlanningHUD";
import { TaskPlan } from "@/types/workflow";

interface Message {
  id: string;
  text: string;
  role: 'ai' | 'user' | 'system';
  agent?: string;
}

interface AIStreamSidebarProps {
  messages: Message[];
  isSpeaking: boolean;
  status: 'listening' | 'thinking' | 'speaking' | 'idle';
  volume?: number;
  taskPlan: TaskPlan;
}

export default function AIStreamSidebar({ messages, isSpeaking, status, volume = 0, taskPlan }: AIStreamSidebarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header & Status Panel */}
      <div className="mb-6 space-y-4 shrink-0">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Active Analysis</p>
                <div className="h-0.5 w-8 bg-indigo-500/50 rounded-full" />
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                status === 'speaking' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' :
                status === 'listening' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 animate-pulse' :
                'bg-white/5 border-white/10 text-white/40'
            }`}>
                {status}
            </div>
        </div>

        {/* Integrated Animated Waveform (NOW REACTIVE) */}
        <div className="h-20 flex items-center justify-center gap-1 bg-surface/50 backdrop-blur-md rounded-2xl border border-white/5 relative overflow-hidden group">
            <AnimatePresence mode="wait">
                {status === 'idle' ? (
                    <motion.p 
                        key="idle"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-bold"
                    >
                        Waiting for Input
                    </motion.p>
                ) : (
                    <motion.div 
                        key="active"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-1.5 h-full px-8 w-full"
                    >
                        {[...Array(16)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 4 }}
                                animate={{ 
                                    // Calculate height based on volume if listening, otherwise use mockup for AI speaking
                                    height: status === 'listening' 
                                        ? 4 + (volume * (10 + ((i * 7) % 40))) 
                                        : status === 'speaking' 
                                            ? [4, 12, 32, 16, 40, 8, 24][i % 7]
                                            : 4
                                }}
                                transition={{ 
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 30,
                                    mass: 1
                                }}
                                className={`w-1 rounded-full transition-colors duration-500 ${
                                    status === 'listening' && volume > 0.1 ? 'bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.4)]' :
                                    status === 'speaking' ? 'bg-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.4)]' : 'bg-white/10'
                                }`}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Visual HUD Corner */}
            <div className="absolute bottom-2 right-3 flex gap-1 items-center opacity-40">
                <div className="w-1 h-1 bg-white/20 rounded-full" />
                <div className="w-1 h-1 bg-white/20 rounded-full" />
            </div>
        </div>
      </div>

      {/* Structured Planning HUD */}
      <PlanningHUD plan={taskPlan} />

      {/* Primary Message Stream */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 pr-3 custom-scrollbar scroll-smooth"
      >
          <AnimatePresence initial={false}>
              {messages.map((msg) => (
                  <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`relative group p-4 rounded-2xl border transition-all duration-300 ${
                          msg.role === 'ai' 
                            ? 'bg-surface border-indigo-500/10 shadow-lg' 
                            : 'bg-white/5 border-white/5'
                      }`}
                  >
                        {msg.agent && (
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                                <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">{msg.agent}</p>
                            </div>
                        )}
                        <p className="text-[11px] leading-relaxed text-white/80 font-medium whitespace-pre-wrap">
                            {msg.text}
                        </p>
                        
                        {/* Interactive HUD Corner Lines */}
                        <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-white/10 rounded-tr opacity-0 group-hover:opacity-100 transition-opacity" />
                  </motion.div>
              ))}
          </AnimatePresence>
          
          {status === 'thinking' && (
              <div className="flex items-center gap-3 p-4 opacity-40">
                  <div className="flex gap-1">
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1 h-1 bg-white rounded-full animate-bounce" />
                  </div>
                  <p className="text-[9px] font-bold uppercase tracking-widest">Synthesizing Feedback</p>
              </div>
          )}
      </div>
    </div>
  );
}
