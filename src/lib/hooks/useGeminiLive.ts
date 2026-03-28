'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { GeminiLiveClient, GeminiLiveStatus } from "../gemini/geminiLiveClient";
import { floatTo16BitPCM, arrayBufferToBase64 } from "../audio/pcm-utils";
import { PCMPlayer } from "../audio/audio-manager";

import { MediaRequest } from "@/types";

/**
 * useGeminiLive
 * Real-time multimodal hook to connect vision and voice to Gemini Live.
 */
export function useGeminiLive(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mediaQueue, setMediaQueue] = useState<MediaRequest[]>([]);
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

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
        model: "gemini-3.1-flash-live-preview", // Must be this model for tools via web sockets!
        systemInstruction: `
          You are a professional task assistant. 
          Always respond in English.
          Use the provided camera frames and user audio to give precise, conversational instructions.
          Always prioritize clarity.
          When you use a video generation tool to demonstrate something, explicitly say 'I am generating a video for you now. It will appear on your screen shortly.' 
          Do NOT mention the Veo app or say you cannot send videos directly.
        `.trim()
      },
      (msg) => {
        // PINPOINT AUDIT: Printing the full raw packet to identify hidden transcripts
        console.log("Gemini Live: RAW_PACKET", JSON.stringify(msg, null, 2));
        
        // Handle tool calls
        if (msg.toolCall || msg.tool_call) {
            const toolCall = msg.toolCall || msg.tool_call;
            const functionCalls = toolCall.functionCalls || toolCall.function_calls;
            
            if (functionCalls) {
                for (const call of functionCalls) {
                    console.log(`🟡 TOOL TRIGGERED in Hook: ${call.name}`, call.args);
                    
                    const isVideo = call.name.includes('video');
                    const newRequestId = Math.random().toString(36).substring(7);
                    
                    setMediaQueue(prev => [{
                        id: newRequestId,
                        type: 'video', // Assume video for these specific Veo tools
                        status: 'pending',
                        prompt: call.args.prompt || 'Visual Guide Request',
                        timestamp: Date.now()
                    }, ...prev]);
                    
                    fetch('/api/generate-video', { 
                        method: 'POST', 
                        body: JSON.stringify(call.args),
                        headers: { 'Content-Type': 'application/json' }
                    }).then(async (res) => {
                      if (res.ok) {
                         const data = await res.json();
                         if (data.operationName) {
                            setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { ...m, status: 'generating' } : m));
                            
                            let attempts = 0;
                            const pollInterval = setInterval(async () => {
                              // Cancel check: if item is no longer generating (or removed), stop polling
                              let currentStatus = 'generating';
                              setMediaQueue(prev => {
                                const m = prev.find(item => item.id === newRequestId);
                                if (!m || m.status === 'cancelled') {
                                    currentStatus = 'cancelled';
                                }
                                return prev;
                              });

                              if (currentStatus === 'cancelled') {
                                  clearInterval(pollInterval);
                                  return;
                              }

                              attempts++;
                              const pollRes = await fetch('/api/poll-video', {
                                method: 'POST',
                                body: JSON.stringify({ operationName: data.operationName }),
                                headers: { 'Content-Type': 'application/json' }
                              });
                              
                              if (pollRes.ok) {
                                 const pollData = await pollRes.json();
                                 if (pollData.done) {
                                    clearInterval(pollInterval);
                                    
                                    const finalUri = pollData.data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || pollData.data?.response?.generatedVideo?.uri || pollData.data?.response?.videoUri;
                                    
                                    setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { 
                                        ...m, 
                                        status: 'completed', 
                                        url: finalUri 
                                    } : m));
                                 }
                              }
                              
                              if (attempts > 30) {
                                  clearInterval(pollInterval);
                                  setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { ...m, status: 'failed' } : m));
                              }
                            }, 30000); // 30 sec
                         } else {
                            setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { ...m, status: 'failed' } : m));
                         }
                      } else {
                         setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { ...m, status: 'failed' } : m));
                      }
                    }).catch(e => {
                        console.error(e);
                        setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { ...m, status: 'failed' } : m));
                    });

                    clientRef.current?.sendToolResponse(call.id, call.name, "video generation started, notify the user it will take a few minutes. It will appear in their media gallery.");
                }
            }
        }
        
        // Robust handling for both camelCase and snake_case response variants
        const serverContent = msg.serverContent || msg.server_content;
        
        if (serverContent) {
            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            if (modelTurn?.parts) {
                modelTurn.parts.forEach((p: any) => {
                    // DEEP AUDIT: Log all part types to find implicit transcripts
                    console.log("Gemini Live PART AUDIT:", p);

                    // Standard Text or Implicit Transcript Variants
                    const transcript = p.text || p.transcript || p.interim_transcript || p.interimResult;
                    if (transcript) {
                        setMessages(prev => [...prev.slice(-15), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: transcript, 
                            agent: 'Gemini (Audit)' 
                        }]);
                    }

                    // Thinking Capture (Implicit reasoning?)
                    if (p.thought || p.thought_process) {
                        setMessages(prev => [...prev.slice(-15), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: `[THINKING]: ${p.thought || p.thought_process}`, 
                            agent: 'Gemini (Thinking)' 
                        }]);
                    }

                    // Handle Audio Responses
                    const audioData = p.inlineData?.data || p.inline_data?.data;
                    if (audioData && pcmPlayerRef.current) {
                        pcmPlayerRef.current.feed(audioData);
                        setIsSpeaking(true);
                        setTimeout(() => setIsSpeaking(false), 500);
                    }
                });
            }

            // Search Grounding Metadata
            if (serverContent.groundingMetadata || serverContent.grounding_metadata) {
                console.log("Gemini Live GROUNDING AUDIT:", serverContent.groundingMetadata || serverContent.grounding_metadata);
            }

            // [FIXED] Capture Gemini 3.1 Real-time Transcription (Appending instead of new blocks)
            const transcription = serverContent.outputTranscription || serverContent.output_transcription;
            if (transcription?.text) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'ai' && lastMsg.agent === 'Gemini Live') {
                        // Append to the existing AI message block
                        return [
                            ...prev.slice(0, -1),
                            { ...lastMsg, text: lastMsg.text + transcription.text }
                        ];
                    } else {
                        // Create a new AI message block
                        return [...prev.slice(-15), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: transcription.text, 
                            agent: 'Gemini Live' 
                        } ];
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

    // Initialize Local Speech Recognition (for User Speech-to-Text in Sidebar)
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const Recognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
                .map((result: any) => result[0])
                .map((result: any) => result.transcript)
                .join('');
            
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'user') {
                    // Update the existing interim user message
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, text: transcript }
                    ];
                } else {
                    // Create a new user message block
                    return [...prev.slice(-15), { 
                        id: Math.random().toString(36), 
                        role: 'user', 
                        text: transcript, 
                        agent: 'You' 
                    }];
                }
            });

            // If it's final, we can give it a unique ID to "lock" it
            if (event.results[0].isFinal) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.id === 'user-interim') {
                        return [
                            ...prev.slice(0, -1),
                            { ...lastMsg, id: Math.random().toString(36) }
                        ];
                    }
                    return prev;
                });
            }
        };

        recognition.onerror = (err: any) => console.error("Speech Recognition Error:", err);
        recognitionRef.current = recognition;
        recognition.start();
    }

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

  }, [videoRef]);

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
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    setVolume(0);
    setStatus('idle');
  }, []);

  const cancelMedia = useCallback((id: string) => {
      setMediaQueue(prev => prev.filter(m => m.id !== id));
  }, []);

  return { messages, status, isSpeaking, volume, connect, disconnect, mediaQueue, cancelMedia };
}
