'use client';

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CameraStream from "@/components/CameraStream";
import VeoPlayer from "@/components/VeoPlayer";

export default function Home() {
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);
  const [showVeo, setShowVeo] = useState(false);
  const constraintsRef = useRef(null);

  const requestVisualGuide = () => {
    setIsCameraMinimized(true);
    setShowVeo(true);
  };

  const recenterCamera = () => {
    setIsCameraMinimized(false);
    setShowVeo(false);
  };

  return (
    <div ref={constraintsRef} className="min-h-screen bg-background font-sans text-white p-6 md:p-12 lg:p-16 transition-colors duration-500 overflow-hidden relative">
      <main className="max-w-7xl mx-auto space-y-12">
        {/* Top Grid: Main Focus Area and Status Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Central Media Area (75% width) */}
          <div className="lg:col-span-9 relative min-h-[400px] lg:min-h-[500px]">
            <div className="relative w-full h-full">
              {/* Primary Content: Either Camera or Veo */}
              <div className={`transition-all duration-700 ease-in-out ${isCameraMinimized ? 'opacity-100 scale-100' : 'opacity-100 scale-100'}`}>
                {showVeo ? (
                  <VeoPlayer />
                ) : (
                  <div className={`${isCameraMinimized ? 'hidden' : 'block'}`}>
                    <CameraStream />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Status Panel (25% width) */}
          <div className="lg:col-span-3 bg-surface rounded-3xl border border-accent/10 min-h-[400px] lg:min-h-[500px] p-6 shadow-xl hidden lg:block">
            <div className="space-y-6">
                <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">System Status</p>
                    <div className="h-0.5 w-12 bg-accent/40 rounded-full" />
                </div>
                <div className="space-y-4">
                    <div className="bg-accent/20 h-4 rounded-full w-3/4 animate-pulse" />
                    <div className="bg-accent/20 h-4 rounded-full w-1/2 animate-pulse" />
                </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Activity Pills */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={recenterCamera}
            className="bg-accent h-14 rounded-full border border-white/5 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all active:scale-95"
          >
            Live Feed
          </button>
          <button className="bg-accent h-14 rounded-full border border-white/5 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all active:scale-95">
            Toggle Mic
          </button>
          <button className="bg-red-900/30 text-red-200 h-14 rounded-full border border-red-500/10 text-[11px] font-bold uppercase tracking-widest hover:bg-red-900/50 transition-all active:scale-95">
            End Session
          </button>
          <button 
            onClick={requestVisualGuide}
            className="bg-indigo-600/20 text-indigo-200 h-14 rounded-full border border-indigo-500/20 text-[11px] font-bold uppercase tracking-widest hover:bg-indigo-600/40 transition-all active:scale-95 shadow-[0_0_20px_rgba(79,70,229,0.1)]"
          >
            Request Visual Guide
          </button>
        </div>
      </main>

      {/* Minimized PIP Camera Overlay (Draggable & GPU Accelerated) */}
      <motion.div 
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.05}
        dragMomentum={false}
        initial={false}
        animate={isCameraMinimized ? {
          scale: 1,
          opacity: 1,
          y: 0,
          pointerEvents: 'auto'
        } : {
          scale: 0.5,
          opacity: 0,
          y: 100,
          pointerEvents: 'none'
        }}
        transition={{ 
          type: "spring", 
          stiffness: 260, 
          damping: 25 
        }}
        whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
        className="fixed top-8 right-8 w-64 md:w-80 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border-2 border-white/10 rounded-3xl overflow-hidden group/pip z-[100] cursor-grab will-change-transform translate-z-0 bg-black"
      >
        <div className="relative">
          <CameraStream isMinimized={true} />
          {/* Recentering Overlay */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/pip:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[3px] gap-3">
            <button 
              onClick={recenterCamera}
              className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-[10px] font-bold uppercase tracking-[0.2em] text-white hover:bg-white/20 transition-colors"
            >
              Recenter Feed
            </button>
            <p className="text-[9px] text-white/40 uppercase tracking-widest font-medium">Drag to move</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
