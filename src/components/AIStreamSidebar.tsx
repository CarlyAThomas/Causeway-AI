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
    <div className="flex flex-col h-full overflow-hidden glass-surface rounded-[2rem] border border-white/10 p-6 lg:p-8 shadow-2xl relative">
      {/* Cinematic Background Grain / Blur Accents */}
      <div className="absolute inset-0 bg-black/40 pointer-events-none rounded-[2rem]" />
      
      {/* Header & Status Panel */}
      <div className="mb-8 space-y-6 shrink-0 relative z-10">
        <div className="flex items-center justify-between">
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">Intelligence Nexus</p>
                <div className="h-0.5 w-10 bg-indigo-500 rounded-full glow-indigo" />
            </div>
            <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-500 ${
                status === 'speaking' ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-200 glow-indigo' :
                status === 'listening' ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200 animate-pulse' :
                'bg-white/5 border-white/10 text-white/40'
            }`}>
                {status}
            </div>
        </div>

        {/* Integrated Animated Waveform (REACTIVE & GLOSSY) */}
        <div className="h-24 flex items-center justify-center gap-1.5 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/5 relative overflow-hidden group shadow-inner">
            <AnimatePresence mode="wait">
                {status === 'idle' ? (
                    <motion.p 
                        key="idle"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-[9px] text-white/20 uppercase tracking-[0.4em] font-black"
                    >
                        Nexus Standby
                    </motion.p>
                ) : (
                    <motion.div 
                        key="active"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-1.5 h-full px-10 w-full"
                    >
                        {[...Array(18)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ height: 4 }}
                                animate={{ 
                                    height: status === 'listening' 
                                        ? 4 + (volume * (10 + ((i * 7) % 50))) 
                                        : status === 'speaking' 
                                            ? [4, 16, 48, 24, 60, 12, 36][i % 7]
                                            : 4
                                }}
                                transition={{ 
                                    type: "spring",
                                    stiffness: 400,
                                    damping: 30,
                                    mass: 1
                                }}
                                className={`w-1 rounded-full transition-colors duration-700 ${
                                    status === 'listening' && volume > 0.05 ? 'bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]' :
                                    status === 'speaking' ? 'bg-indigo-400 shadow-[0_0_20px_rgba(129,140,248,0.5)]' : 'bg-white/10'
                                }`}
                            />
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
            
            {/* Visual HUD Corner Decoration */}
            <div className="absolute top-2 left-3 w-1.5 h-1.5 border-t border-l border-white/10" />
            <div className="absolute bottom-2 right-3 w-1.5 h-1.5 border-b border-r border-white/10" />
        </div>
      </div>

      {/* Structured Planning HUD */}
      <div className="relative z-10">
        <PlanningHUD plan={taskPlan} />
      </div>

      {/* Primary Message Stream */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-5 pr-3 custom-scrollbar scroll-smooth relative z-10"
      >
          <AnimatePresence initial={false}>
              {messages.map((msg) => (
                  <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, scale: 0.98, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      className={`relative group p-5 rounded-2xl transition-all duration-500 glass-card shadow-xl max-w-[90%] ${
                          msg.role === 'ai' 
                            ? 'border-indigo-400/50 bg-indigo-600/20 self-start mr-auto translate-x-1 outline outline-1 outline-indigo-500/10' 
                            : 'border-white/20 bg-black/40 self-end ml-auto -translate-x-1'
                      }`}
                  >
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                                msg.role === 'ai' 
                                    ? 'bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,1)]' 
                                    : 'bg-white/40'
                            }`} />
                            <p className={`text-[10px] font-black uppercase tracking-[0.2em] ${
                                msg.role === 'ai' ? 'text-indigo-300' : 'text-white/60'
                            }`}>
                                {msg.role === 'ai' ? (msg.agent || 'GEMINI LIVE') : 'YOU'}
                            </p>
                        </div>
                        
                        <p className={`text-[13px] leading-[1.6] font-bold whitespace-pre-wrap tracking-wide ${
                            msg.role === 'ai' ? 'text-white' : 'text-white/90'
                        }`}>
                            {msg.text}
                        </p>
                        
                        {/* Interactive UI Corners */}
                        <div className="absolute top-3 right-3 w-2 h-2 border-t border-r border-white/20 rounded-tr opacity-0 group-hover:opacity-100 transition-all duration-500" />
                  </motion.div>
              ))}
          </AnimatePresence>
          
          {status === 'thinking' && (
              <div className="flex items-center gap-4 p-5 opacity-40">
                  <div className="flex gap-1.5">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">Processing Multimodal Input</p>
              </div>
          )}
      </div>
      
      {/* Bottom Attribution / Version Decor */}
      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between opacity-20 pointer-events-none relative z-10">
          <p className="text-[8px] font-bold uppercase tracking-[0.4em]">Cau-Way OS v.2.4</p>
          <div className="flex gap-1">
              <div className="w-1 h-1 bg-white rounded-full" />
              <div className="w-1 h-1 bg-white rounded-full" />
          </div>
      </div>
    </div>
  );
}
