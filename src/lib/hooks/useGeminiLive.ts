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
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mediaQueue, setMediaQueue] = useState<MediaRequest[]>([]);
  
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const isMutedRef = useRef(isMuted);
  const isAiTurnLockedRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);

  const connect = useCallback(async () => {
    if (clientRef.current) return;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    
    // Initialize Audio Context and PCM Player (16kHz context, 24kHz for AI Voice)
    const audioContext = new AudioContext({ sampleRate: 16000 });
    audioContextRef.current = audioContext;
    pcmPlayerRef.current = new PCMPlayer(audioContext, 24000);

    clientRef.current = new GeminiLiveClient(
      { 
        apiKey, 
        model: "gemini-3.1-flash-live-preview", 
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
        console.log("Gemini Live: RAW_PACKET", JSON.stringify(msg, null, 2));
        
        // Handle tool calls (Video Generation Requests)
        if (msg.toolCall || msg.tool_call) {
            const toolCall = msg.toolCall || msg.tool_call;
            const functionCalls = toolCall.functionCalls || toolCall.function_calls;
            
            if (functionCalls) {
                for (const call of functionCalls) {
                    console.log(`🟡 TOOL TRIGGERED in Hook: ${call.name}`, call.args);
                    
                    const newRequestId = Math.random().toString(36).substring(7);
                    
                    // Add to Media Queue
                    setMediaQueue(prev => [{
                        id: newRequestId,
                        type: 'video',
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
                               // Check if item was cancelled/removed before polling
                               let cancelled = false;
                               setMediaQueue(prev => {
                                 const m = prev.find(item => item.id === newRequestId);
                                 if (!m || m.status === 'cancelled') cancelled = true;
                                 return prev;
                               });

                               if (cancelled) {
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
                                     const finalUri = pollData.data?.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri || 
                                                     pollData.data?.response?.generatedVideo?.uri || 
                                                     pollData.data?.response?.videoUri;
                                     
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
                            }, 30000);
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

                    clientRef.current?.sendToolResponse(call.id, call.name, "video generation started, it will appear in the media gallery.");
                }
            }
        }
        
        const serverContent = msg.serverContent || msg.server_content;
        if (serverContent) {
            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            if (modelTurn?.parts) {
                modelTurn.parts.forEach((p: any) => {
                    // Handle Audio Responses
                    const audioData = p.inlineData?.data || p.inline_data?.data;
                    if (audioData && pcmPlayerRef.current) {
                        pcmPlayerRef.current.feed(audioData);
                        setIsSpeaking(true);
                        setTimeout(() => setIsSpeaking(false), 500);
                    }
                });
            }

            // Real-time AI Transcription (Turn-Locked for clarity)
            const transcription = serverContent.outputTranscription || serverContent.output_transcription;
            if (transcription?.text) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'ai' && !isAiTurnLockedRef.current) {
                        return [
                            ...prev.slice(0, -1),
                            { ...lastMsg, text: lastMsg.text + transcription.text }
                        ];
                    } else {
                        isAiTurnLockedRef.current = false;
                        return [...prev.slice(-15), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: transcription.text, 
                            agent: 'Gemini Live' 
                        } ];
                    }
                });
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
                isAiTurnLockedRef.current = true;
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

    // Local STT for Sidebar
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const Recognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            if (isMutedRef.current) return;
            isAiTurnLockedRef.current = true;
            const isFinal = event.results[event.results.length - 1].isFinal;

            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'user' && lastMsg.id === 'user-interim') {
                    return [...prev.slice(0, -1), { ...lastMsg, text: transcript }];
                } else {
                    return [...prev.slice(-15), { id: 'user-interim', role: 'user', text: transcript, agent: 'You' }];
                }
            });

            if (isFinal) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.id === 'user-interim') {
                        return [...prev.slice(0, -1), { ...lastMsg, id: Math.random().toString(36) }];
                    }
                    return prev;
                });
            }
        };

        recognition.onerror = (err: any) => console.error("STT Error:", err);
        recognitionRef.current = recognition;
        recognition.start();
    }

    intervalRef.current = setInterval(() => {
        if (videoRef.current && clientRef.current) {
            clientRef.current.sendVideoFrame(videoRef.current);
        }
    }, 500);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        await audioContext.audioWorklet.addModule('/worklets/pcm-processor.js');
        const source = audioContext.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
        source.connect(workletNode);
        workletNode.connect(audioContext.destination);
        
        workletNode.port.onmessage = (event) => {
            if (isMutedRef.current) return setVolume(0);
            const inputData = event.data;
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / inputData.length);
            setVolume(prev => prev * 0.7 + Math.min(1, rms * 10) * 0.3);
            const pcmBuffer = floatTo16BitPCM(inputData);
            const base64Pcm = arrayBufferToBase64(pcmBuffer);
            if (clientRef.current) clientRef.current.sendAudioChunk(base64Pcm);
        };
    } catch (err) {
        console.error("Mic Access Error:", err);
        setStatus('error');
    }
  }, [videoRef]);

  const disconnect = useCallback(() => {
    if (clientRef.current) clientRef.current.disconnect();
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close().catch(console.error);
    if (pcmPlayerRef.current) pcmPlayerRef.current.stop();
    if (recognitionRef.current) recognitionRef.current.stop();
    clientRef.current = null;
    intervalRef.current = null;
    streamRef.current = null;
    audioContextRef.current = null;
    pcmPlayerRef.current = null;
    recognitionRef.current = null;
    setVolume(0);
    setStatus('idle');
  }, []);

  const cancelMedia = useCallback((id: string) => {
      setMediaQueue(prev => prev.filter(m => m.id !== id));
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
    if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
    }
  }, [isMuted]);

  return { messages, status, isSpeaking, volume, isMuted, setIsMuted, connect, disconnect, mediaQueue, cancelMedia };
}
