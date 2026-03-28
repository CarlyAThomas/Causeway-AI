'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { GeminiLiveClient, GeminiLiveStatus } from "../gemini/geminiLiveClient";
import { floatTo16BitPCM, arrayBufferToBase64 } from "../audio/pcm-utils";
import { PCMPlayer } from "../audio/audio-manager";

/**
 * useGeminiLive
 * Real-time multimodal hook to connect vision and voice to Gemini Live.
 */
export function useGeminiLive(videoRef: React.RefObject<HTMLVideoElement | null>, onGuideRequested?: (guideId: string) => void) {
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(async () => {
    if (clientRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    
    // Initialize Audio Context and PCM Player (24kHz for AI Voice)
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    pcmPlayerRef.current = new PCMPlayer(audioContext, 24000);

    clientRef.current = new GeminiLiveClient(
      { 
        apiKey, 
        model: "gemini-3.1-flash-live-preview", 
        systemInstruction: `
          You are a professional task assistant. 
          Use the provided camera frames and user audio to give precise, conversational instructions.
          Always prioritize clarity.
          If you determine a visual guide (video) is needed, explicitly include "[TRIGGER_GUIDE: guide_id]" in your text response.
        `.trim()
      },
      (msg) => {
        console.log("Gemini Live Raw DATA:", msg);
        
        // Robust handling for both camelCase and snake_case response variants
        const serverContent = msg.serverContent || msg.server_content;
        
        if (serverContent) {
            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            if (modelTurn?.parts) {
                modelTurn.parts.forEach((p: any) => {
                    // Handle Text Transcripts
                    if (p.text) {
                        console.log("Gemini Live TEXT RECEIVED:", p.text);
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

                    // Handle Audio Responses (from AI speaking)
                    const audioData = p.inlineData?.data || p.inline_data?.data;
                    if (audioData && pcmPlayerRef.current) {
                        pcmPlayerRef.current.feed(audioData);
                        setIsSpeaking(true);
                        // Briefly pulse visualizer for AI voice activity
                        setTimeout(() => setIsSpeaking(false), 500);
                    }
                });
            }

            // Handle turn complete signals
            if (serverContent.turnComplete || serverContent.turn_complete) {
                console.log("Gemini Live TURN COMPLETE");
                setStatus('listening');
            }
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

    // Start Real-time Mic Capture (Modern AudioWorklet)
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        
        // Initialize the AudioWorklet module
        await audioContext.audioWorklet.addModule('/worklets/pcm-processor.js');
        
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
        
        // Handle audio data from the worklet thread
        workletNode.port.onmessage = (event) => {
            const inputData = event.data;
            
            // Calculate RMS Volume for the visualizer
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);
            // Amplify and smooth the volume (normalized 0.0 - 1.0)
            setVolume(prev => prev * 0.7 + Math.min(1, rms * 10) * 0.3);

            const pcmBuffer = floatTo16BitPCM(inputData);
            const base64Pcm = arrayBufferToBase64(pcmBuffer);
            
            if (clientRef.current) {
                clientRef.current.sendAudioChunk(base64Pcm);
            }
        };
    } catch (err) {
        console.error("Critical: Could not access microphone or load worklet:", err);
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
    if (pcmPlayerRef.current) {
        pcmPlayerRef.current.stop();
        pcmPlayerRef.current = null;
    }
    setVolume(0);
    setStatus('idle');
  }, []);

  return { messages, status, isSpeaking, volume, connect, disconnect };
}
