'use client';

import { motion } from "framer-motion";
import { WorldState } from "@/types/task";

interface WorldStateHUDProps {
  state: WorldState;
}

export default function WorldStateHUD({ state }: WorldStateHUDProps) {
  const { tools_detected, object_states, current_step, progress_pct } = state;

  return (
    <div className="space-y-4 mb-6">
      {/* Task Progress Section */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">
              {current_step || "Analyzing Scene..."}
            </span>
          </div>
          <span className="text-[10px] font-mono text-indigo-400">
            {Math.round(progress_pct * 100)}%
          </span>
        </div>
        
        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress_pct * 100}%` }}
            transition={{ type: "spring", stiffness: 50, damping: 20 }}
            className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500"
          />
        </div>
      </div>

      {/* Detection Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Tools Detected */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <p className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-2">Tools Detected</p>
          <div className="flex flex-wrap gap-1.5">
            {tools_detected.length > 0 ? (
              tools_detected.map((tool, i) => (
                <motion.span 
                  key={tool}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 rounded-md text-[9px] font-medium text-indigo-200"
                >
                  {tool}
                </motion.span>
              ))
            ) : (
              <span className="text-[9px] text-white/10 italic">Scanning...</span>
            )}
          </div>
        </div>

        {/* Object States */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-3">
          <p className="text-[8px] font-bold uppercase tracking-widest text-white/30 mb-2">Object States</p>
          <div className="space-y-1">
            {Object.keys(object_states).length > 0 ? (
              Object.entries(object_states).map(([obj, status]) => (
                <div key={obj} className="flex items-center justify-between text-[9px]">
                  <span className="text-white/40 capitalize">{obj}</span>
                  <span className="text-emerald-400 font-bold">{status}</span>
                </div>
              ))
            ) : (
              <span className="text-[9px] text-white/10 italic">No states logged</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
