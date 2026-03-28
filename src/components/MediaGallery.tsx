'use client';

import { MediaRequest } from "@/types";
import { motion, AnimatePresence } from "framer-motion";

interface MediaGalleryProps {
    queue: MediaRequest[];
    onSelect: (media: MediaRequest) => void;
    activeMediaId?: string | null;
    onCancel?: (id: string) => void;
}

export default function MediaGallery({ queue, onSelect, activeMediaId, onCancel }: MediaGalleryProps) {
  if (queue.length === 0) return null;

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4 w-full h-full no-scrollbar relative z-10">
       <div className="flex items-center justify-between mb-2 shrink-0">
           <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Visual History</p>
           <div className="flex gap-1">
               <div className="w-1 h-1 bg-white/20 rounded-full" />
               <div className="w-1 h-1 bg-white/20 rounded-full" />
           </div>
       </div>

       <AnimatePresence>
       {queue.map((item) => (
           <motion.div
               key={item.id}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               exit={{ opacity: 0, scale: 0.95 }}
               onClick={() => item.status === 'completed' ? onSelect(item) : undefined}
               className={`relative flex-shrink-0 w-full aspect-video rounded-2xl border transition-all duration-500 glass-card overflow-hidden group/item
                  ${activeMediaId === item.id ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'border-white/5'}
                  ${item.status === 'completed' ? 'cursor-pointer hover:bg-white/5 active:scale-[0.98]' : 'opacity-60 cursor-not-allowed'}
               `}
           >
              {/* Contextual Backdrop Blur */}
              <div className="absolute inset-0 bg-black/20 group-hover/item:bg-black/0 transition-colors" />
              
              {item.status === 'generating' || item.status === 'pending' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-black/40 backdrop-blur-sm">
                     <span className="w-6 h-6 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mb-3 shadow-lg" />
                     <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-300">
                         {item.status === 'pending' ? 'Queued' : 'Rendering...'}
                     </p>
                     {onCancel && (
                         <button 
                             onClick={(e) => { e.stopPropagation(); onCancel(item.id); }}
                             className="mt-3 text-[9px] font-bold bg-white/5 hover:bg-white/10 text-white/40 px-3 py-1.5 rounded-full border border-white/10 transition-colors"
                         >
                             CANCEL
                         </button>
                     )}
                  </div>
              ) : item.status === 'failed' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-red-900/40 backdrop-blur-sm z-10">
                     <span className="text-xl mb-2 grayscale opacity-50">⚠️</span>
                     <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Generation Failed</p>
                  </div>
              ) : (
                  <div className="absolute inset-0 z-10">
                     {item.url && item.type === 'video' ? (
                          <video 
                              src={`${item.url}&key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`} 
                               className="w-full h-full object-cover transition-transform duration-700 group-hover/item:scale-110" 
                              muted 
                              playsInline 
                              onMouseEnter={(e) => {
                                  try { e.currentTarget.play(); } catch(err) {}
                              }}
                              onMouseLeave={(e) => { 
                                  e.currentTarget.pause(); 
                                  e.currentTarget.currentTime = 0; 
                              }}
                          />
                     ) : (
                          <div className="w-full h-full bg-white/5 flex items-center justify-center">
                              <svg className="w-8 h-8 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              </svg>
                          </div>
                     )}
                     
                     {/* Overlay HUD */}
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-4 flex flex-col justify-end opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
                        <p className="text-[9px] text-white/90 font-bold leading-tight line-clamp-2 uppercase tracking-wide mb-3">{item.prompt}</p>
                        
                        <div className="flex items-center justify-between pointer-events-none">
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/40">VE-01 GUIDE</span>
                            <button 
                               onClick={(e) => {
                                   e.stopPropagation();
                                   const shareUrl = `${item.url}&key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`;
                                   navigator.clipboard.writeText(shareUrl);
                               }}
                               className="pointer-events-auto bg-white/10 hover:bg-white/20 p-2 rounded-full backdrop-blur-xl border border-white/10 transition-all active:scale-90"
                            >
                               <svg className="w-3.5 h-3.5 text-white/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                               </svg>
                            </button>
                        </div>
                     </div>
                     
                     {/* Selection Marker */}
                     {activeMediaId === item.id && (
                         <div className="absolute top-3 left-3 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(129,140,248,1)]" />
                     )}
                  </div>
              )}
           </motion.div>
       ))}
       </AnimatePresence>
    </div>
  );
}