'use client';

import { forwardRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const VeoPlayer = forwardRef<HTMLVideoElement, { id?: string, videoUrl?: string | null, isLoading?: boolean, thumbnail?: string }>(({ id, videoUrl, isLoading, thumbnail }, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  
  // Reset playback state when the video URL changes (e.g., selecting a new guide)
  useEffect(() => {
    setIsPlaying(false);
  }, [videoUrl]);

  // DERIVE SYSTEM STATE
  let viewState: 'idle' | 'processing' | 'ready' | 'playing' = 'idle';
  if (isPlaying && videoUrl) viewState = 'playing';
  else if (videoUrl) viewState = 'ready';
  else if (isLoading) viewState = 'processing';

  return (
    <div className="relative w-full h-full bg-black rounded-[2rem] overflow-hidden shadow-2xl border border-white/10 group cursor-pointer transition-all duration-500">
      
      {/* 1. LAYER: THE COVER IMAGE (Blurred Bridge) */}
      <AnimatePresence>
        {(viewState === 'processing' || viewState === 'ready') && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20"
            >
                {thumbnail ? (
                    <img 
                        src={thumbnail} 
                        className="w-full h-full object-cover blur-2xl scale-110 opacity-60 grayscale brightness-50"
                        alt="Perception Bridge"
                    />
                ) : (
                    <div className="w-full h-full bg-gradient-to-br from-indigo-950/40 via-surface to-black" />
                )}
                
                {/* Overlay for Processing */}
                {viewState === 'processing' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="relative">
                            <span className="w-12 h-12 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin flex items-center justify-center" />
                            <div className="absolute inset-0 w-12 h-12 rounded-full border border-white/10 animate-pulse" />
                        </div>
                        <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300 animate-pulse">Generating Guide... (1-3 min)</p>
                    </div>
                )}

                {/* Overlay for Ready (Manual Play Trigger) */}
                {viewState === 'ready' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-950/20 hover:bg-black/40 transition-colors"
                        onClick={() => setIsPlaying(true)}
                    >
                        <div className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-2xl border border-white/20 flex items-center justify-center mb-4 transition-all hover:scale-110 hover:bg-white/20 shadow-[0_0_32px_rgba(255,255,255,0.1)]">
                            <svg className="w-8 h-8 text-white fill-current ml-1" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                        <div className="space-y-1 text-center">
                            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white/40">Instructional Sequence</p>
                            <h3 className="text-sm font-bold text-white tracking-wide">Play Interaction Guide</h3>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        )}
      </AnimatePresence>

      {/* 2. LAYER: THE VIDEO CONTENT */}
      {videoUrl && (
        <video 
            id={id}
            ref={ref}
            key={videoUrl}
            autoPlay={true}
            loop 
            muted={false}
            playsInline 
            controls 
            crossOrigin="anonymous"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${viewState === 'playing' ? 'opacity-100 z-30' : 'opacity-0 z-10'}`}
        >
            <source 
                src={videoUrl.includes('key=') 
                    ? videoUrl 
                    : videoUrl.includes('?') 
                        ? `${videoUrl}&key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}` 
                        : `${videoUrl}?key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`
                } 
                type="video/mp4" 
                onError={(e) => console.error("❌ Veo Video Source Error:", e)}
            />
        </video>
      )}

      {/* 3. LAYER: EMPTY STATE (Idle) */}
      {viewState === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 group-hover:bg-black/40 backdrop-blur-sm transition-all z-0">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-4 transition-all group-hover:scale-110 group-hover:bg-white/20">
            <svg className="w-6 h-6 text-white/30 fill-current ml-1" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="space-y-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Industrial Assistant</p>
              <h3 className="text-sm font-medium text-white/40">Ask Gemini for a Guide</h3>
          </div>
        </div>
      )}
      
      {/* 4. LAYER: HUD Overlays (Labels) */}
      <div className="absolute top-8 left-8 flex items-center gap-3 z-40 pointer-events-none">
        <div className="px-3 py-1.5 rounded-full bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 text-[9px] font-bold text-indigo-300 uppercase tracking-[0.2em] flex items-center gap-2 shadow-lg">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
          Veo Engine
        </div>
        <div className="px-3 py-1.5 rounded-full bg-white/5 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white/40 uppercase tracking-[0.2em] shadow-lg">
          Nano-Banana v.3
        </div>
      </div>
    </div>
  );
});

VeoPlayer.displayName = 'VeoPlayer';

export default VeoPlayer;
