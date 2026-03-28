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
    <div className="flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto p-4 w-full h-full no-scrollbar">
       <AnimatePresence>
       {queue.map((item) => (
           <motion.div
               key={item.id}
               initial={{ opacity: 0, scale: 0.8 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.8 }}
               onClick={() => item.status === 'completed' ? onSelect(item) : undefined}
               className={`relative flex-shrink-0 w-32 h-24 lg:w-full lg:aspect-video rounded-xl border border-white/10 overflow-hidden cursor-pointer group transition-all
                  ${activeMediaId === item.id ? 'ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20' : ''}
                  ${item.status === 'completed' ? 'hover:scale-[1.02]' : 'opacity-70 cursor-not-allowed'}
               `}
           >
              {/* Background */}
              <div className="absolute inset-0 bg-surface/50 backdrop-blur-md" />
              
              {item.status === 'generating' || item.status === 'pending' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center z-10">
                     <span className="w-5 h-5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin mb-2" />
                     <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-300">
                         {item.status === 'pending' ? 'Queued' : 'Generating...'}
                     </p>
                     {onCancel && (
                         <button 
                             onClick={(e) => { e.stopPropagation(); onCancel(item.id); }}
                             className="mt-2 text-[8px] bg-red-500/20 text-red-300 px-2 py-1 rounded hover:bg-red-500/40"
                         >
                             CANCEL
                         </button>
                     )}
                  </div>
              ) : item.status === 'failed' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center bg-red-900/20 z-10">
                     <span className="text-red-400 mb-1">⚠️</span>
                     <p className="text-[9px] font-bold uppercase tracking-wider text-red-300">Failed</p>
                  </div>
              ) : (
                  <div className="absolute inset-0 z-10">
                     {item.url && item.type === 'video' ? (
                          <video 
                              src={`${item.url}&key=${process.env.NEXT_PUBLIC_GEMINI_API_KEY}`} 
                              className="w-full h-full object-cover" 
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
                         <div className="w-full h-full bg-indigo-900/30 flex items-center justify-center">
                             <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                             </svg>
                         </div>
                     )}
                     <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-4">
                        <p className="text-[8px] text-white/90 line-clamp-2 md:line-clamp-1">{item.prompt}</p>
                     </div>
                  </div>
              )}
           </motion.div>
       ))}
       </AnimatePresence>
    </div>
  );
}