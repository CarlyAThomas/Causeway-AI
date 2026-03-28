'use client';

import { forwardRef } from 'react';

const VeoPlayer = forwardRef<HTMLVideoElement, { id?: string, videoUrl?: string | null, isLoading?: boolean }>(({ id, videoUrl, isLoading }, ref) => {
  return (
    <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-accent/20 group cursor-pointer transition-all duration-500">
      {/* Background Gradient / Mesh Effect (Placeholder for actual video) */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-surface to-black" />
      
      {videoUrl ? (
        <video 
            id={id}
            ref={ref}
            key={videoUrl}
            autoPlay 
            loop 
            muted
            playsInline 
            controls 
            className="absolute inset-0 w-full h-full object-cover z-10"
        >
            {/* The URI returned by Veo requires passing the API key as a header, or appending it as a query param.
                Since video src tag can't add headers naturally, we append the API key. */}
            <source src={`${videoUrl}&key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`} type="video/mp4" />
        </video>
      ) : isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <span className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-300 animate-pulse">Generating Guide... (1-3 min)</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 group-hover:bg-black/40 backdrop-blur-sm transition-all z-0">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-4 transition-all group-hover:scale-110 group-hover:bg-white/20">
            <svg className="w-6 h-6 text-white fill-current ml-1" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <div className="space-y-1 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Interactive AI Demonstration</p>
              <h3 className="text-sm font-medium text-white/90">Ask Gemini for a Guide</h3>
          </div>
        </div>
      )}
      
      {/* HUD Overlays */}
      <div className="absolute top-6 left-6 flex items-center gap-3 z-20 pointer-events-none">
        <div className="px-3 py-1 rounded bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 text-[9px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
          Veo-Integrated
        </div>
        <div className="px-3 py-1 rounded bg-white/5 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white/60 uppercase tracking-widest">
          Nano-Banana v.2
        </div>
      </div>
    </div>
  );
});

VeoPlayer.displayName = 'VeoPlayer';

export default VeoPlayer;
