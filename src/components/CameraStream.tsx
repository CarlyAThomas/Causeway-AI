'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import VisionOverlay from './VisionOverlay';
import SpatialHighlightOverlay from './SpatialHighlightOverlay';

const CameraStream = forwardRef<HTMLVideoElement, { 
  id?: string;
  isMinimized?: boolean;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isCameraOff?: boolean;
  onToggleCamera?: () => void;
  tools?: any[];
  highlight?: { x: number, y: number, label: string } | null;
  isFrozen?: boolean;
  frozenFrame?: string | null;
  isMirrored?: boolean; // NEW: Support mirroring logic for Spatial Drift fix
  debugFrame?: string | null; // NEW: "Truth-Box" Diagnostic
}>(({ id, isMinimized = false, isMuted = false, onToggleMute, isCameraOff = false, onToggleCamera, tools = [], highlight = null, isFrozen = false, frozenFrame = null, isMirrored: propMirrored = false, debugFrame = null }, ref) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [intrinsicSize, setIntrinsicSize] = useState({ width: 1280, height: 720 });
  const [isMirrored, setIsMirrored] = useState(propMirrored);

  // Sync mirroring with track capabilities (Auto-Detect Selfie Mode)
  useEffect(() => {
    if (localVideoRef.current?.srcObject) {
        const stream = localVideoRef.current.srcObject as MediaStream;
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        
        // If front-facing, mirror it!
        if (settings.facingMode === 'user') {
            setIsMirrored(true);
        } else {
            setIsMirrored(propMirrored);
        }
    }
  }, [propMirrored, isCameraOff]);

  const handleLoadedMetadata = () => {
    if (localVideoRef.current) {
        setIntrinsicSize({
            width: localVideoRef.current.videoWidth,
            height: localVideoRef.current.videoHeight
        });
    }
  };

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
            id={id}
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={handleLoadedMetadata}
            className={`w-full h-full object-cover transition-opacity duration-500 ${(isCameraOff || isFrozen) ? 'opacity-0' : 'opacity-100'}`}
            style={{ 
                transform: isMirrored ? 'scaleX(-1)' : 'none',
                filter: isFrozen ? 'grayscale(0.5) contrast(1.2)' : 'none'
            }}
          />

          {/* Frozen Analysis Frame (Snapshot Overlay) */}
          {isFrozen && frozenFrame && (
            <div className="absolute inset-0 z-10 animate-pulse-slow">
                <img 
                    src={frozenFrame} 
                    className="w-full h-full object-cover"
                    alt="Frozen Snapshot"
                    style={{ transform: isMirrored ? 'scaleX(-1)' : 'none' }}
                />
                
                {/* Scanning HUD Indicators */}
                <div className="absolute inset-0 border-2 border-rose-500/30 glow-rose-sm pointer-events-none" />
                
                <div className="absolute top-12 left-6 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[10px] font-black tracking-[0.4em] text-rose-500 uppercase">
                        Scanning Intelligence...
                    </span>
                </div>

                <div className="absolute top-12 right-6">
                    <span className="text-[10px] font-mono text-rose-500/60 uppercase">
                        Frame-Lock Active
                    </span>
                </div>
            </div>
          )}
          
          
          {/* "Truth-Box" Diagnostic Overlay (Tech Lead Request) */}
          {!isCameraOff && debugFrame && (
            <div className="absolute top-4 left-4 z-[60] w-32 md:w-48 aspect-video border-2 border-red-500 shadow-2xl rounded-sm overflow-hidden bg-black">
                <div className="absolute top-0 left-0 bg-red-500 text-white text-[8px] font-black px-1 uppercase tracking-tighter shadow-sm z-[70]">
                    Gemini Vision (Cropped)
                </div>
                <img 
                    src={debugFrame} 
                    className="w-full h-full object-cover" 
                    alt="Current AI Context"
                />
            </div>
          )}

          {/* Vision Perception Highlights */}
          {!isCameraOff && (
            <VisionOverlay 
                tools={tools} 
                isMirrored={isMirrored}
                videoWidth={intrinsicSize.width}
                videoHeight={intrinsicSize.height}
            />
          )}

          {!isCameraOff && (
            <SpatialHighlightOverlay 
                highlight={highlight} 
                isMirrored={isMirrored}
                videoWidth={intrinsicSize.width}
                videoHeight={intrinsicSize.height}
            />
          )}
          
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
                className={`flex-1 h-9 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md flex items-center justify-center gap-2.5 ${
                    isCameraOff 
                    ? 'bg-red-500/30 border-red-500/50 text-red-100 glow-red shadow-lg' 
                    : 'bg-black/60 border-white/20 text-white hover:bg-black/80 shadow-2xl'
                }`}
              >
                <div className={`w-2 h-2 rounded-full shadow-sm ${isCameraOff ? 'bg-red-400' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'}`} />
                {isCameraOff ? 'Camera Off' : 'Camera On'}
              </button>
              
              <button 
                onClick={onToggleMute}
                className={`flex-1 h-9 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md flex items-center justify-center gap-2.5 ${
                    isMuted 
                    ? 'bg-red-500/30 border-red-500/50 text-red-100 glow-red shadow-lg' 
                    : 'bg-black/60 border-white/20 text-white hover:bg-black/80 shadow-2xl'
                }`}
              >
                <div className={`w-2 h-2 rounded-full shadow-sm ${isMuted ? 'bg-red-400' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]'}`} />
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
