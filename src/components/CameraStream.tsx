'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import VisionOverlay from './VisionOverlay';
import { RequiredTool } from '@/types/workflow';

const CameraStream = forwardRef<HTMLVideoElement, { 
  isMinimized?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isCameraOff?: boolean;
  onToggleCamera?: () => void;
  tools?: RequiredTool[];
}>(({ isMinimized = false, isMuted = false, onToggleMute, isCameraOff = false, onToggleCamera, tools = [] }, ref) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Expose the internal video element to the parent ref
  useImperativeHandle(ref, () => localVideoRef.current as HTMLVideoElement);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment', // Prefer back camera for physical tasks
            width: { ideal: 1280 },
            height: { ideal: 720 }
          } 
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Could not access camera. Please ensure permissions are granted.");
      }
    }

    setupCamera();

    return () => {
      // Cleanup stream when component unmounts
      if (localVideoRef.current && localVideoRef.current.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Sync Camera Off State with MediaStream Tracks
  useEffect(() => {
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      const stream = localVideoRef.current.srcObject as MediaStream;
      stream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
    }
  }, [isCameraOff]);

  return (
    <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-accent/20">
      {error ? (
        <div className="flex items-center justify-center h-full bg-red-900/10 text-red-200 p-4">
          <p className="text-center text-xs opacity-80">{error}</p>
        </div>
      ) : (
        <>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover transition-opacity duration-500 ${isCameraOff ? 'opacity-0' : 'opacity-100'}`}
          />
          
          {/* Vision Perception Highlights */}
          {!isCameraOff && <VisionOverlay tools={tools} />}
          
          {isCameraOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/90 backdrop-blur-sm transition-all duration-500">
                <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth={2} />
                    </svg>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Camera Disabled</p>
            </div>
          )}

          {!isCameraOff && (
            <div className="absolute top-3 right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 tracking-wider">
                <span className="w-1 h-1 bg-white rounded-full"></span>
                LIVE
            </div>
          )}

          {!isMinimized && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full max-w-[280px] px-4 z-30">
              <button 
                onClick={onToggleCamera}
                className={`flex-1 h-9 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all backdrop-blur-md flex items-center justify-center gap-2 ${
                    isCameraOff 
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30' 
                    : 'bg-accent/60 border-white/5 text-white hover:bg-accent/80'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isCameraOff ? 'bg-red-400' : 'bg-emerald-400'}`} />
                {isCameraOff ? 'Camera Off' : 'Camera On'}
              </button>
              
              <button 
                onClick={onToggleMute}
                className={`flex-1 h-9 rounded-full border text-[10px] font-bold uppercase tracking-widest transition-all backdrop-blur-md flex items-center justify-center gap-2 ${
                    isMuted 
                    ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30' 
                    : 'bg-accent/60 border-white/5 text-white hover:bg-accent/80'
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isMuted ? 'bg-red-400' : 'bg-emerald-400'}`} />
                {isMuted ? 'Muted' : 'Mic On'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

CameraStream.displayName = 'CameraStream';

export default CameraStream;
