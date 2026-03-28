'use client';

import { useEffect, useRef, useState } from 'react';

export default function CameraStream() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } // Prefer back camera for physical tasks
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Could not access camera. Please ensure permissions are granted.");
      }
    }

    setupCamera();

    return () => {
      // Cleanup stream when component unmounts
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Live Task View</h2>
      {error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-md">{error}</div>
      ) : (
        <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border-2 border-slate-800 shadow-lg">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute top-4 right-4 bg-red-600 text-white text-xs px-2 py-1 rounded-full animate-pulse flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full"></span>
            LIVE
          </div>
        </div>
      )}
      <p className="text-sm text-slate-500 mt-4 text-center">
        This feed will be streamed to Gemini Live to analyze your progress and safety.
      </p>
    </div>
  );
}
