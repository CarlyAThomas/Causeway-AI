'use client';

import { useEffect, useRef, useState } from 'react';
import { useGeminiLive } from '@/hooks/useGeminiLive';

export default function CameraStream({ isMinimized = false }: { isMinimized?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Bring in the Gemini Live hook
  const { isConnected, isSetupComplete, connect, disconnect, sendFrame, messages } = useGeminiLive();

  // 1. Setup User Camera
  useEffect(() => {
    async function setupCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' }
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
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 2. Continuous Video Frame Extraction (The "Eyes")
  useEffect(() => {
    // Only start sending frames AFTER the server has confirmed setup is complete
    if (!isConnected || !isSetupComplete) return;

    // Grab a frame every 1000ms (1 FPS is usually enough for task reasoning, saves bandwidth)
    const interval = setInterval(() => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        if (ctx && video.videoWidth > 0 && video.videoHeight > 0) {
          // Match canvas size to video aspect ratio, but downscale for faster transmission
          const scale = 0.5; // Send at 50% resolution to keep base64 string smaller
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;
          
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert to JPEG base64 (quality 0.5)
          const base64Jpeg = canvas.toDataURL('image/jpeg', 0.5);
          
          // Throw it over the WebSocket to Gemini
          sendFrame(base64Jpeg);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected, sendFrame]);

  // UI Handlers
  const handleToggleConnect = () => {
    if (isConnected) {
      disconnect();
    } else {
      // Use the environment variable; fallback check
      const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        alert("API key not found. Make sure NEXT_PUBLIC_GEMINI_API_KEY is embedded in your .env.local file.");
        return;
      }
      connect(apiKey);
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex w-full justify-between items-center mb-2">
        <h2 className="text-xl font-bold">Live Task View</h2>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleToggleConnect}
            className={`px-4 py-2 text-sm text-white font-medium rounded-md transition ${isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-900 hover:bg-slate-800'}`}
          >
            {isConnected ? 'Stop Agent' : 'Start Agent'}
          </button>
        </div>
      </div>
      
      {error ? (
        <div className="bg-red-100 w-full text-red-700 p-4 rounded-md">{error}</div>
      ) : (
        <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-accent/20">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {/* Hidden canvas used purely for frame extraction */}
          <canvas ref={canvasRef} className="hidden" />
          
          <div className="absolute top-3 right-3 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 tracking-wider">
            <span className="w-1 h-1 bg-white rounded-full"></span>
            LIVE
          </div>

          {isConnected && (
            <div className="absolute top-3 left-3 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full animate-pulse flex items-center gap-1 tracking-wider shadow-md">
              <span className="w-1 h-1 bg-white rounded-full"></span>
              AGENT CONNECTED
            </div>
          )}

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
        </div>
      )}

      {/* Diagnostics / Feed Box */}
      <div className="w-full h-48 bg-slate-100 rounded-md p-4 overflow-y-auto border border-slate-200">
        <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Agent Feed (Text Fallback)</h3>
        {messages.length === 0 ? (
          <p className="text-slate-400 text-sm">Waiting for connection...</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((msg, i) => (
              <li key={i} className={`text-sm ${msg.startsWith('System:') ? 'text-slate-500' : 'text-slate-800'}`}>
                {msg}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <p className="text-sm text-slate-500 text-center w-full">
        This feed will be streamed to Gemini Live to analyze your progress and safety.
      </p>
    </div>
  );
}
