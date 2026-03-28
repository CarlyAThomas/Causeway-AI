'use client';

export default function VeoPlayer() {
  return (
    <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-accent/20 group cursor-pointer transition-all duration-500">
      {/* Background Gradient / Mesh Effect (Placeholder for actual video) */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-surface to-black" />
      
      {/* Central Play Indicator */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 group-hover:bg-black/40 backdrop-blur-sm transition-all">
        <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center mb-4 transition-all group-hover:scale-110 group-hover:bg-white/20">
          <svg className="w-6 h-6 text-white fill-current ml-1" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <div className="space-y-1 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Instructional Sequence</p>
            <h3 className="text-sm font-medium text-white/90">Visual Guide: Step 01</h3>
        </div>
      </div>
      
      {/* HUD Overlays */}
      <div className="absolute top-6 left-6 flex items-center gap-3">
        <div className="px-3 py-1 rounded bg-indigo-500/10 backdrop-blur-md border border-indigo-500/20 text-[9px] font-bold text-indigo-300 uppercase tracking-widest flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
          Veo-Integrated
        </div>
        <div className="px-3 py-1 rounded bg-white/5 backdrop-blur-md border border-white/10 text-[9px] font-bold text-white/60 uppercase tracking-widest">
          Nano-Banana v.2
        </div>
      </div>

      {/* Progress Bar (Static Placeholder) */}
      <div className="absolute bottom-6 left-6 right-6 h-1 bg-white/10 rounded-full overflow-hidden">
        <div className="w-1/3 h-full bg-white/40 rounded-full" />
      </div>
    </div>
  );
}
