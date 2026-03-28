'use client';

import { motion } from "framer-motion";
import { TaskPlan } from "@/types/workflow";

interface PlanningHUDProps {
  plan: TaskPlan;
}

export default function PlanningHUD({ plan }: PlanningHUDProps) {
  const { current_goal, next_step, safety_checks, estimated_effort, progress_pct, required_tools } = plan;

  return (
    <div className="space-y-4 mb-6 shrink-0">
      {/* Current Mission Goal */}
      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-2xl p-4 backdrop-blur-md relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-2 opacity-20">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
        </div>
        
        <div className="relative z-10">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-1">Current Mission</p>
            <h3 className="text-xs font-bold text-white leading-tight mb-2 uppercase">{current_goal}</h3>
            
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress_pct * 100}%` }}
                    transition={{ type: "spring", stiffness: 50, damping: 20 }}
                    className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                />
            </div>
        </div>
      </div>

      {/* Immediate Next Action */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/30 mb-2">Immediate Next Action</p>
        <div className="flex items-start gap-3">
            <div className="mt-0.5 shrink-0 w-4 h-4 rounded-full border border-emerald-500/30 flex items-center justify-center">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            </div>
            <p className="text-[11px] font-medium text-white/90 leading-snug">
                {next_step}
            </p>
        </div>
      </div>

      {/* Safety & Effort Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Safety Prerequisites */}
        <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-3">
          <p className="text-[8px] font-bold uppercase tracking-widest text-red-400/60 mb-2">Safety Checks</p>
          <ul className="space-y-1.5">
            {safety_checks.map((check, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <svg className="w-2.5 h-2.5 text-red-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-[9px] text-white/60 leading-tight">{check}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Effort / Complexity */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3 flex flex-col justify-between">
            <div>
                <p className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-1">Complexity</p>
                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                    estimated_effort === 'high' ? 'text-orange-400' :
                    estimated_effort === 'medium' ? 'text-yellow-400' :
                    'text-emerald-400'
                }`}>
                    {estimated_effort}
                </p>
            </div>
            <div className="flex gap-1">
                <div className={`h-1 flex-1 rounded-full ${estimated_effort === 'low' || estimated_effort === 'medium' || estimated_effort === 'high' ? 'bg-indigo-500' : 'bg-white/10'}`} />
                <div className={`h-1 flex-1 rounded-full ${estimated_effort === 'medium' || estimated_effort === 'high' ? 'bg-indigo-500' : 'bg-white/10'}`} />
                <div className={`h-1 flex-1 rounded-full ${estimated_effort === 'high' ? 'bg-indigo-500' : 'bg-white/10'}`} />
            </div>
        </div>
      </div>

      {/* Required Tools Checklist */}
      {required_tools.length > 0 && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-2xl p-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-blue-400 mb-3">Required Tools</p>
          <div className="space-y-2">
            {required_tools.map((tool, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${tool.detected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-white/10'}`} />
                  <span className={`text-[11px] font-medium ${tool.detected ? 'text-white' : 'text-white/40'}`}>
                    {tool.name}
                  </span>
                </div>
                {tool.detected && (
                  <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-400/80">Sighted</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
