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
  const lastSyncStateRef = useRef<string>("");

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
    uploadStaticContext
  } = useGeminiLive(useCallback(() => {
      if (mainView === 'veo') return veoVideoRef.current;
      if (mainView === 'camera') {
          return isCameraMinimized ? pipVideoRef.current : mainVideoRef.current;
      }
      return null;
  }, [mainView, isCameraMinimized]), (id) => {
      setActiveMediaId(id);
      setIsCameraMinimized(true);
      setMainView('veo');
  });

  const activeMedia = mediaQueue.find(m => m.id === activeMediaId);

  // [STATE SYNC]: Notify Gemini when the user's attention focus shifts (Deduplicated)
  useEffect(() => {
      const isLive = status === 'listening' || status === 'thinking';
      if (!isLive) return;

      const syncKey = `${mainView}:${activeMediaId}`;
      if (syncKey === lastSyncStateRef.current) return;

      if (mainView === 'camera') {
          sendSystemEvent("SYSTEM: User is now focusing on the LIVE CAMERA feed. Please provide instructions based on their physical surroundings.");
          lastSyncStateRef.current = syncKey;
      } else if (mainView === 'veo') {
          const media = mediaQueue.find(m => m.id === activeMediaId);
          if (media && media.prompt) {
              sendSystemEvent(`SYSTEM: User is now focusing on the AI GENERATED VIDEO for: "${media.prompt}". Gemini should shift vision focus to the video player and answer any questions about this specific guide.`);
              lastSyncStateRef.current = syncKey;
          }
      }
  }, [mainView, activeMediaId, status, sendSystemEvent, mediaQueue]);

  // Auto-activate a new media item if we don't have one active and a new one arrives
  useEffect(() => {
    if (mediaQueue.length > 0) {
      if (mediaQueue[0].status === 'pending') {
          userManuallyPausedMedia.current = false;
          setActiveMediaId(mediaQueue[0].id);
          setIsCameraMinimized(true);
          setMainView('veo');
      } else if (!activeMediaId && !userManuallyPausedMedia.current) {
          setActiveMediaId(mediaQueue[0].id);
          setIsCameraMinimized(true);
          setMainView('veo');
      }
    }
  }, [mediaQueue.length, activeMediaId]);

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
    <div ref={constraintsRef} className="min-h-screen bg-background font-sans text-white p-6 md:p-12 lg:p-16 transition-colors duration-500 overflow-hidden relative">
      <main className="max-w-7xl mx-auto space-y-12">
        {/* Top Grid: Main Media Focus and AI Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Central Media Area (66% width) */}
          <div className="lg:col-span-8 relative h-auto md:h-[720px] flex flex-col md:flex-row gap-6">
            
            {/* Gallery (shows up on the left side or top depending on screen size) */}
            <AnimatePresence>
              {mediaQueue.length > 0 && (
                <motion.div 
                   initial={{ opacity: 0, width: 0 }}
                   animate={{ opacity: 1, width: 'auto' }}
                   exit={{ opacity: 0, width: 0 }}
                   className="w-full md:w-56 h-auto md:h-full flex-shrink-0"
                >
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Player */}
            <div className="relative w-full h-[300px] md:h-full flex-grow">
              <div className="w-full h-full">
                {mainView === 'veo' ? (
                  <VeoPlayer 
                    id="veo-player-feed"
                    ref={veoVideoRef}
                    videoUrl={activeMedia?.url} 
                    isLoading={!!activeMedia && activeMedia.status !== 'completed'} 
                  />
                ) : (
                  <div className={`w-full h-full ${isCameraMinimized ? 'hidden' : 'block'}`}>
                    <CameraStream 
                        id="main-camera-feed"
                        ref={mainVideoRef} 
                        isMuted={isMuted} 
                        onToggleMute={() => setIsMuted(!isMuted)} 
                        isCameraOff={isCameraOff} 
                        onToggleCamera={() => setIsCameraOff(!isCameraOff)} 
                        tools={taskPlan.required_tools}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right AI Streaming Sidebar (33% width) */}
          <div className="lg:col-span-4 bg-surface/30 rounded-3xl border border-white/5 h-[720px] p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
             <AIStreamSidebar 
                messages={messages} 
                isSpeaking={isSpeaking} 
                status={status as any} 
                volume={volume}
                taskPlan={taskPlan}
             />
          </div>
        </div>

        {/* Bottom Action Controls */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button 
            onClick={recenterCamera}
            className="group relative bg-accent h-14 rounded-full border border-white/5 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all active:scale-95 overflow-hidden"
          >
            <span className="relative z-10">Live Feed</span>
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
          </button>
          
          <button 
            onClick={showVisualGuide}
            className="group relative bg-accent h-14 rounded-full border border-white/5 text-[11px] font-bold uppercase tracking-widest hover:bg-accent/80 transition-all active:scale-95 overflow-hidden"
          >
            <span className="relative z-10">Visual Guide</span>
          </button>
          
          <button 
            onClick={endSession}
            className="bg-red-900/10 text-red-400 h-14 rounded-full border border-red-500/10 text-[11px] font-bold uppercase tracking-widest hover:bg-red-900/30 transition-all active:scale-95"
          >
            End Session
          </button>
          
          <button 
            onClick={requestVisualGuide}
            disabled={status !== 'idle' && status !== 'disconnected' && status !== 'error'}
            className={`h-14 rounded-full border text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
                (status !== 'idle' && status !== 'disconnected' && status !== 'error')
                ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400/50 cursor-not-allowed'
                : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-100 hover:bg-indigo-600/40 hover:shadow-indigo-500/10'
            }`}
          >
            {status === 'idle' || status === 'disconnected' || status === 'error' 
                ? 'Start Analysis' 
                : status === 'thinking' ? 'Connecting...' : 'Active Session'}
          </button>

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            accept="image/*,video/*" 
            className="hidden" 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={status === 'idle' && status === 'disconnected'}
            className={`h-14 rounded-full border border-white/5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 ${
                (status === 'idle' || status === 'disconnected')
                ? 'opacity-20 cursor-not-allowed' 
                : 'bg-white/5 hover:bg-white/10 text-white/60'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            Import Context
          </button>
        </div>
      </main>

      {/* Draggable PIP Camera Overlay */}
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
        transition={{ type: "spring", stiffness: 260, damping: 25 }}
        whileDrag={{ cursor: 'grabbing', scale: 1.02 }}
        className="fixed top-8 right-8 w-64 md:w-80 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)] border-2 border-white/10 rounded-3xl overflow-hidden group/pip z-[100] cursor-grab will-change-transform translate-z-0 bg-black"
      >
        <div className="relative">
          <CameraStream 
            id="pip-camera-feed"
            ref={pipVideoRef}
            isMinimized={true} 
            isMuted={isMuted} 
            onToggleMute={() => setIsMuted(!isMuted)} 
            isCameraOff={isCameraOff} 
            onToggleCamera={() => setIsCameraOff(!isCameraOff)} 
            tools={taskPlan.required_tools}
          />
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
