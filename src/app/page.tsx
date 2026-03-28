'use client';

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CameraStream from "@/components/CameraStream";
import VeoPlayer from "@/components/VeoPlayer";
import AIStreamSidebar from "@/components/AIStreamSidebar";
import MediaGallery from "@/components/MediaGallery";
import { useGeminiLive } from "@/lib/hooks/useGeminiLive";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isCameraMinimized, setIsCameraMinimized] = useState(false);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [mainView, setMainView] = useState<'camera' | 'veo'>('camera');
  const userManuallyPausedMedia = useRef(false);
  const constraintsRef = useRef(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const veoVideoRef = useRef<HTMLVideoElement>(null);
  const pipVideoRef = useRef<HTMLVideoElement>(null);
  const lastSyncStateRef = useRef<string>("camera:null");

  const { 
    messages, 
    status, 
    isSpeaking, 
    volume, 
    isMuted, 
    setIsMuted, 
    connect, 
    disconnect, 
    mediaQueue, 
    cancelMedia,
    sendSystemEvent,
    taskPlan,
    uploadStaticContext,
    spatialHighlight,
    isStageFrozen,
    lastFrame,
    setEgressMuted
  } = useGeminiLive(useCallback(() => {
      if (mainView === 'veo') return veoVideoRef.current;
      if (mainView === 'camera') {
          return isCameraMinimized ? pipVideoRef.current : mainVideoRef.current;
      }
      return null;
  }, [mainView, isCameraMinimized]), (id) => {
      console.log("🔍 [MEDIA SELECTION]: Switching focus to ID:", id);
      setActiveMediaId(id);
      setIsCameraMinimized(true);
      setMainView('veo');
  });

  const activeMedia = mediaQueue.find(m => m.id === activeMediaId);

  // [STATE SYNC]: Notify Gemini when the user's attention focus shifts (Deduplicated)
  // [STABILITY GUARD]: Only sync during 'listening' phase to prevent Code 1007 modality collisions during active speech.
  useEffect(() => {
      const isListening = status === 'listening';
      if (!isListening || isSpeaking) return;

      const syncKey = `${mainView}:${activeMediaId}`;
      if (syncKey === lastSyncStateRef.current) return;

      // [STABILITY GAP CLOSURE]: Instantly gag the egress the millisecond a view-swap begins.
      // This closes the 400ms debounce window where VideoFrames could previously leak.
      setEgressMuted(true);

      // [STRICT SEQUENTIALITY DEBOUNCE]: Wait for UI state to settle before notifying Gemini.
      const timer = setTimeout(() => {
          if (mainView === 'camera') {
              sendSystemEvent("SYSTEM: User is now focusing on the LIVE CAMERA feed. Please provide instructions based on their physical surroundings.", false);
              lastSyncStateRef.current = syncKey;
          } else if (mainView === 'veo') {
              // Context bundled in ToolResponse in useGeminiLive.ts
              lastSyncStateRef.current = syncKey;
          }

          // [RESTORATION]: Wait for the SystemEvent's own 150ms 'Quiet Window' to pass before unmuting.
          setTimeout(() => {
              setEgressMuted(false);
          }, 200);
      }, 400);

      return () => {
          clearTimeout(timer);
          // Optional: ensure unmute on cleanup if needed, but the next effect will handle it.
      };
  }, [mainView, activeMediaId, status, isSpeaking, sendSystemEvent, setEgressMuted]);

  // Auto-activate a new media item if we don't have one active or when a pending/generating one arrives.
  // [REACTIVE FOCUS]: We depend on both the queue length AND the status of the head item to handle transitions.
  useEffect(() => {
    if (mediaQueue.length > 0) {
      const firstItem = mediaQueue[0];
      const shouldFocus = ['pending', 'generating', 'completed'].includes(firstItem.status);
      
      if (shouldFocus && (!activeMediaId || activeMediaId !== firstItem.id) && !userManuallyPausedMedia.current) {
          console.log(`🚀 [STAGE]: Auto-activating item ${firstItem.id} (Status: ${firstItem.status})`);
          userManuallyPausedMedia.current = false;
          setActiveMediaId(firstItem.id);
          setIsCameraMinimized(true);
          setMainView('veo');
      }
    }
  }, [mediaQueue.length, mediaQueue[0]?.status, activeMediaId]);

  const requestVisualGuide = () => {
    connect();
  };

  const endSession = () => {
    disconnect();
    setIsCameraMinimized(false);
    setActiveMediaId(null);
    setMainView('camera');
  };

  const recenterCamera = () => {
    setIsCameraMinimized(false);
    setActiveMediaId(null);
    setMainView('camera');
    userManuallyPausedMedia.current = true;
  };

  const showVisualGuide = () => {
    if (mediaQueue.length > 0 && !activeMediaId) {
        setActiveMediaId(mediaQueue[0].id);
    }
    setIsCameraMinimized(true);
    setMainView('veo');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadStaticContext) {
        uploadStaticContext(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (!mounted) return null;

  return (
    <div ref={constraintsRef} className="h-screen w-screen bg-background font-sans text-foreground p-4 md:p-6 lg:p-8 overflow-hidden relative flex flex-col">
      {/* Cinematic HUD Background Elements */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10 z-50 pointer-events-none" />
      
      <main className="flex-1 min-h-0 w-full max-w-screen-2xl mx-auto flex flex-col gap-6 relative z-10">
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Central Perception Stage (8 cols) - Flex Column to manage vertical space */}
          <div className="lg:col-span-8 flex flex-col gap-6 min-h-0">
            
            {/* The Unified Multimodal Stage - Takes 70% of available vertical stage space */}
            <div className="flex-[7] relative glass-surface rounded-[2rem] overflow-hidden group/stage shadow-[0_48px_80px_-16px_rgba(0,0,0,0.5)] border border-white/10">
              {/* AR Scanline Overlay */}
              <div className="ar-scanline opacity-20" />
              
              <AnimatePresence mode="wait">
                <motion.div 
                    key={mainView}
                    initial={{ opacity: 0, scale: 1.02 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="w-full h-full"
                >
                    {mainView === 'veo' ? (
                        <div className="w-full h-full bg-black/40">
                             <VeoPlayer 
                                id="veo-player-feed"
                                ref={veoVideoRef}
                                videoUrl={activeMedia?.status === 'completed' ? activeMedia.url : null} 
                                isLoading={activeMedia?.status === 'pending' || activeMedia?.status === 'generating'}
                                thumbnail={activeMedia?.thumbnail}
                            />
                        </div>
                    ) : (
                        <div className="w-full h-full relative">
                            {/* Camera Surface */}
                            <div className={`w-full h-full transition-opacity duration-700 ${isCameraMinimized ? 'opacity-0' : 'opacity-100'}`}>
                                <CameraStream 
                                    id="main-camera-feed"
                                    ref={mainVideoRef} 
                                    isMuted={isMuted} 
                                    onToggleMute={() => setIsMuted(!isMuted)} 
                                    isCameraOff={isCameraOff} 
                                    onToggleCamera={() => setIsCameraOff(!isCameraOff)} 
                                    tools={taskPlan.required_tools}
                                    highlight={spatialHighlight}
                                    isFrozen={isStageFrozen}
                                    frozenFrame={lastFrame}
                                />
                            </div>
                            
                            {/* Minimized Standby Overlay */}
                            {isCameraMinimized && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-md">
                                    <div className="w-12 h-12 rounded-full border border-white/10 animate-pulse flex items-center justify-center">
                                        <div className="w-3 h-3 bg-indigo-500 rounded-full glow-indigo" />
                                    </div>
                                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Intelligence Standby</p>
                                </div>
                            )}
                        </div>
                    )}
                </motion.div>
              </AnimatePresence>

              {/* Stage HUD Overlays */}
              <div className="absolute top-6 left-6 flex items-center gap-3">
                  <div className="px-3 py-1 glass-hud rounded-full flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/80">
                          {mainView === 'camera' ? 'Live Multimodal' : 'AI Visual Guide'}
                      </span>
                  </div>
                  {isCameraMinimized && (
                      <button 
                        onClick={recenterCamera}
                        className="px-3 py-1 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full border border-white/10 text-[9px] font-black uppercase tracking-widest text-white transition-all hover:scale-105 active:scale-95 shadow-xl"
                      >
                          Return Feed
                      </button>
                  )}
              </div>
            </div>

            {/* Stage Integrated Control Bar (3 cols) - Takes 30% of available vertical stage space */}
            <div className="flex-[3] grid grid-cols-1 md:grid-cols-4 gap-6 min-h-0">
                 {/* Integrated Media Hub - Scrollable Visual History */}
                <div className="md:col-span-1 glass-surface rounded-[2rem] overflow-hidden border border-white/5 shadow-inner min-h-0 flex flex-col">
                    <MediaGallery 
                        queue={mediaQueue} 
                        activeMediaId={activeMediaId} 
                        onSelect={(media) => {
                            setActiveMediaId(media.id);
                            setIsCameraMinimized(true);
                            setMainView('veo');
                        }}
                        onCancel={(id) => {
                            cancelMedia(id);
                            if (activeMediaId === id) {
                                setActiveMediaId(null);
                                setIsCameraMinimized(false);
                                setMainView('camera');
                            }
                        }}
                    />
                </div>

                {/* Quick Actions Panel */}
                <div className="md:col-span-3 glass-surface rounded-[2rem] p-6 lg:p-8 border border-white/5 flex flex-col justify-between group min-h-0 overflow-hidden">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">System Status</p>
                            <h2 className="text-sm font-black text-white/60 uppercase tracking-widest">Workbench v.1.0-A</h2>
                        </div>
                        <div className="flex gap-2">
                             <button 
                                onClick={recenterCamera}
                                className="w-10 h-10 glass-card rounded-xl flex items-center justify-center hover:bg-white/10 transition-colors group/btn shadow-lg"
                                title="Recenter Camera"
                            >
                                <svg className="w-4 h-4 text-white/40 group-hover/btn:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <button 
                            onClick={endSession}
                            className="h-12 glass-card rounded-xl border border-red-500/10 text-red-400 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-500/10 hover:text-red-300 transition-all active:scale-95"
                        >
                            End Session
                        </button>
                        
                        <button 
                            onClick={requestVisualGuide}
                            disabled={!['idle', 'disconnected', 'error'].includes(status)}
                            className={`h-12 rounded-xl border text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl ${
                                !['idle', 'disconnected', 'error'].includes(status)
                                ? 'bg-white/5 border-white/10 text-white/20 cursor-not-allowed'
                                : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                            }`}
                        >
                             {['idle', 'disconnected', 'error'].includes(status) 
                                ? 'Analyze' 
                                : status === 'thinking' ? 'Waiting' : 'Ready'}
                        </button>
                        
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={status === 'idle' || status === 'disconnected'}
                            className={`h-12 glass-card rounded-xl border border-white/5 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 ${
                                (status === 'idle' || status === 'disconnected')
                                ? 'opacity-20 cursor-not-allowed' 
                                : 'hover:bg-white/10 text-white/60 hover:text-white'
                            }`}
                        >
                            Import
                        </button>

                        <div className="h-12 glass-hud rounded-xl border border-white/10 flex items-center justify-center px-4">
                             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 animate-pulse">Online</p>
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Right AI Sidebar (4 cols) - Height locked to grid */}
          <div className="lg:col-span-4 min-h-0">
             <div className="h-full glass-surface rounded-[2rem] border border-white/10 overflow-hidden flex flex-col p-6 lg:p-8">
                <AIStreamSidebar 
                    messages={messages} 
                    isSpeaking={isSpeaking} 
                    status={status as any} 
                    volume={volume}
                    taskPlan={taskPlan}
                />
             </div>
          </div>
        </div>

        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*,video/*" 
            className="hidden" 
        />
      </main>

      {/* Cinematic PiP Overlay */}
      <AnimatePresence>
        {isCameraMinimized && mainView === 'veo' && (
            <motion.div 
                drag
                dragConstraints={constraintsRef}
                dragElastic={0.05}
                dragMomentum={false}
                initial={{ opacity: 0, scale: 0.9, y: 50 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 50 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="fixed bottom-10 right-10 w-64 md:w-80 glass-surface border border-white/20 rounded-[2rem] overflow-hidden group/pip z-[100] cursor-grab shadow-2xl"
            >
                <div className="relative aspect-video">
                    <CameraStream 
                        id="pip-camera-feed"
                        ref={pipVideoRef}
                        isMinimized={true} 
                        isMuted={isMuted} 
                        onToggleMute={() => setIsMuted(!isMuted)} 
                        isCameraOff={isCameraOff} 
                        onToggleCamera={() => setIsCameraOff(!isCameraOff)} 
                        tools={taskPlan.required_tools}
                        highlight={spatialHighlight}
                        isFrozen={isStageFrozen}
                        frozenFrame={lastFrame}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/pip:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-[4px]">
                        <button 
                            onClick={recenterCamera}
                            className="bg-white/10 backdrop-blur-md px-5 py-2 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-[0.3em] text-white hover:bg-white/20 transition-all"
                        >
                            Recenter
                        </button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
