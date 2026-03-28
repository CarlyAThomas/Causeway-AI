'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { GeminiLiveClient, GeminiLiveStatus } from "../gemini/geminiLiveClient";
import { floatTo16BitPCM, arrayBufferToBase64 } from "../audio/pcm-utils";

/**
 * useGeminiLive
 * Real-time multimodal hook to connect vision and voice to Gemini Live.
 */
export function useGeminiLive(videoRef: React.RefObject<HTMLVideoElement | null>, onGuideRequested?: (guideId: string) => void) {
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (clientRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    
    clientRef.current = new GeminiLiveClient(
      { 
        apiKey, 
        model: "gemini-2.0-flash-exp", 
        systemInstruction: `
          You are a professional task assistant. 
          Use the provided camera frames and user audio to give precise, conversational instructions.
          Always prioritize clarity.
          If you determine a visual guide (video) is needed, explicitly include "[TRIGGER_GUIDE: guide_id]" in your text response.
        `.trim()
      },
      (msg) => {
        // Handle incoming model content (text or markers)
        if (msg.serverContent?.modelTurn?.parts) {
            const parts = msg.serverContent.modelTurn.parts;
            parts.forEach((p: any) => {
                if (p.text) {
                    setMessages(prev => [...prev.slice(-10), { 
                        id: Math.random().toString(36), 
                        role: 'ai', 
                        text: p.text, 
                        agent: 'Gemini Live' 
                    }]);
                    
                    // Logic to detect visual guide triggers
                    const match = p.text.match(/\[TRIGGER_GUIDE: (.*?)\]/);
                    if (match && onGuideRequested) onGuideRequested(match[1]);
                }
            });
        }

        // Handle audio output (pulsing the waveform)
        if (msg.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData)) {
            setIsSpeaking(true);
            // Note: In a full production app, we would play back the base64 PCM data through the AudioContext.
            // For now, we pulse the waveform for visual synergy.
            setTimeout(() => setIsSpeaking(false), 2000);
        }

        // Handle turn complete
        if (msg.serverContent?.turnComplete) {
            setStatus('listening');
        }
      },
      (newStatus) => {
        if (newStatus === 'connected') setStatus('listening');
        else if (newStatus === 'connecting') setStatus('thinking');
        else setStatus(newStatus);
      }
    );

    clientRef.current.connect();

    // Start Vision Sampling (Sample frame every 500ms)
    intervalRef.current = setInterval(() => {
        if (videoRef.current && clientRef.current) {
            clientRef.current.sendVideoFrame(videoRef.current);
        }
    }, 500);

    // Start Real-time Mic Capture
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        // Use 16kHz for best compatibility with Gemini Live's current spec
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(stream);
        
        // Create an audio processor to extract PCM chunks
        const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1);
        source.connect(processor);
        processor.connect(audioContextRef.current.destination);
        
        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBuffer = floatTo16BitPCM(inputData);
            const base64Pcm = arrayBufferToBase64(pcmBuffer);
            
            if (clientRef.current) {
                clientRef.current.sendAudioChunk(base64Pcm);
            }
        };
    } catch (err) {
        console.error("Critical: Could not access microphone:", err);
        setStatus('error');
    }

  }, [videoRef, onGuideRequested]);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
        clientRef.current.disconnect();
        clientRef.current = null;
    }
    if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (audioContextRef.current) {
        audioContextRef.current.close().catch(console.error);
        audioContextRef.current = null;
    }
    setStatus('idle');
  }, []);

  return { messages, status, isSpeaking, connect, disconnect };
}
