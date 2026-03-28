'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

const CameraStream = forwardRef<HTMLVideoElement, { isMinimized?: boolean }>(({ isMinimized = false }, ref) => {
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
            className="w-full h-full object-cover"
          />
          <div className="absolute top-3 right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 tracking-wider">
            <span className="w-1 h-1 bg-white rounded-full"></span>
            LIVE
          </div>
          {!isMinimized && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 w-full max-w-[240px] px-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <button className="flex-1 bg-accent/60 backdrop-blur-lg h-9 rounded-full border border-white/5 text-[10px] font-bold uppercase tracking-tighter text-white hover:bg-accent/80 transition-all">
                Camera
              </button>
              <button className="flex-1 bg-accent/60 backdrop-blur-lg h-9 rounded-full border border-white/5 text-[10px] font-bold uppercase tracking-tighter text-white hover:bg-accent/80 transition-all">
                Mic
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
