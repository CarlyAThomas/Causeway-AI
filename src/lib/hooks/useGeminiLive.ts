'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { GeminiLiveClient, GeminiLiveStatus } from "../gemini/geminiLiveClient";
import { floatTo16BitPCM, arrayBufferToBase64 } from "../audio/pcm-utils";
import { PCMPlayer } from "../audio/audio-manager";
import { playSuccessDing } from "../audio/audio-utils";
import { MediaRequest } from "@/types";
import { TaskPlan, INITIAL_PLAN } from "@/types/workflow";

/**
 * useGeminiLive
 * Real-time multimodal hook to connect vision and voice to Gemini Live.
 */
export function useGeminiLive(videoRef: React.RefObject<HTMLVideoElement | null>, onSelectMedia?: (id: string) => void) {
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<string>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mediaQueue, setMediaQueue] = useState<MediaRequest[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskPlan>(INITIAL_PLAN);
  
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const isMutedRef = useRef(isMuted);
  const isAiTurnLockedRef = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaQueueRef = useRef<MediaRequest[]>([]);

  // Keep ref sync'd with state for tool call access
  useEffect(() => {
    mediaQueueRef.current = mediaQueue;
  }, [mediaQueue]);

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
          FOCUS LOCK: You MUST completely ignore any background noise, side conversations, or other people moving around in the camera frame. Exclusively pay attention to the primary user directly in front of the camera and the specific physical task they are actively working on.
          You are a professional hands-on AI Physical Task Assistant.
          Respond in English.
          Use the provided camera frames and user audio to give precise, step-by-step instructions.

          THE PLANNING LOOP:
          1. OBSERVE: Detect tools and object states in the video frame. 
          2. PLAN: Use 'propose_plan' BEFORE media generation to declare your strategy and safety steps.
          3. ACT: Trigger 'generate_text_to_video' or 'generate_image_to_video' to show the user what to do.
          4. VERIFY: Confirm completion before moving to the next goal.

          MEDIA HISTORY:
          - You can check what videos have been generated with the \`query_media_cache\` tool.
          - You can explicitly show a specific video from the gallery to the user using \`select_media_item(id)\`.
          - If the user asks to "see that again" or "go back to the previous step's video", query the cache first to find the ID.

          Safety is your TOP PRIORITY. Always check for prerequisites like 'parking brake' or 'stable jack' in your plan.
          When you use a video generation tool, explicitly say 'I am generating a video for you now. It will appear on your screen shortly.' 
          
          IMPORT CONTEXT:
          - If the user uploads an image or video frame for context (static snapshot), recognize it and analyze it as if it were a high-quality camera frame.
          - Acknowledge the shared context by saying something like 'I see the image you shared...'
          - Use this to give advice when the live camera cannot see the object.
          
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
                    if (call.name === 'propose_plan') {
                        console.log("📝 Plan Proposed:", call.args);
                        setTaskPlan({
                            current_goal: call.args.goal,
                            next_step: call.args.next_step,
                            safety_checks: call.args.safety_checks,
                            estimated_effort: call.args.effort,
                            progress_pct: call.args.progress,
                            required_tools: call.args.required_tools || []
                        });
                        clientRef.current?.sendToolResponse(call.id, call.name, "plan accepted, HUD updated.");
                        continue;
                    }

                    console.log(`🟡 TOOL TRIGGERED in Hook: ${call.name}`, call.args);
                    
                    if (call.name === 'query_media_cache') {
                        const history = mediaQueueRef.current.slice(0, 5).map(m => ({
                            id: m.id,
                            prompt: m.prompt,
                            status: m.status,
                            timestamp: m.timestamp
                        }));
                        clientRef.current?.sendToolResponse(call.id, call.name, { history });
                        continue;
                    }

                    if (call.name === 'select_media_item') {
                        const targetId = call.args.id;
                        if (onSelectMedia) onSelectMedia(targetId);
                        clientRef.current?.sendToolResponse(call.id, call.name, `Successfully selected item ${targetId}`);
                        continue;
                    }

                    if (call.name === 'update_perception') {
                        const updatedTools = call.args.tools || call.args.required_tools || [];
                        console.log("👁️ Perception Update Received:", updatedTools);
                        setTaskPlan(prev => {
                            let newlyDetected = false;
                            const nextTools = prev.required_tools.map(t => {
                                const update = updatedTools.find((ut: any) => ut.name.toLowerCase() === t.name.toLowerCase());
                                if (update) {
                                    const box = update.boundingBox || update.bounding_box;
                                    const typedBox = Array.isArray(box) && box.length === 4 
                                        ? box as [number, number, number, number] 
                                        : undefined;

                                    if (update.detected && !t.detected) newlyDetected = true;

                                    return { 
                                        ...t, 
                                        detected: update.detected === true, 
                                        boundingBox: typedBox 
                                    };
                                }
                                return t;
                            });

                            if (newlyDetected) {
                                console.log("🔔 Ding: Tool Identified!");
                                playSuccessDing();
                            }

                            return { ...prev, required_tools: nextTools };
                        });
                        clientRef.current?.sendToolResponse(call.id, call.name, "perception updated.");
                        continue;
                    }

                    const isVideo = call.name.includes('video');
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
            // Forensic Audit: Log structure to see where audio is hiding
            console.log("Gemini Live: ServerContent Keys:", Object.keys(serverContent));
            
            // Context Wake-up: Force resume to bypass browser auto-suspension
            if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
            }

            // [NEW] Broad Audio Hook: Check top-level fields (common in v1beta/v1alpha variants)
            const topLevelAudio = serverContent.audio || serverContent.audio_content || serverContent.audioContent;
            if (topLevelAudio?.data && pcmPlayerRef.current) {
                console.log("Gemini Live: FOUND TOP-LEVEL AUDIO DATA. Feeding to player.");
                pcmPlayerRef.current.feed(topLevelAudio.data);
                setIsSpeaking(true);
                setTimeout(() => setIsSpeaking(false), 500);
            }

            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            if (modelTurn?.parts) {
                modelTurn.parts.forEach((p: any) => {
                    // DEEP AUDIT: Log all part types to find implicit transcripts
                    console.log("Gemini Live PART AUDIT:", p);

                    // Standard Text or Implicit Transcript Variants
                    const transcript = p.text || p.transcript || p.interim_transcript || p.interimResult;
                    if (transcript) {
                        setMessages(prev => {
                            const lastMsg = prev[prev.length - 1];
                            if (lastMsg && lastMsg.role === 'ai' && !lastMsg.isComplete) {
                                // Append to the actively streaming AI message block
                                return [
                                    ...prev.slice(0, -1),
                                    { ...lastMsg, text: lastMsg.text + transcript }
                                ];
                            } else {
                                // Create a new AI message block
                                return [...prev.slice(-15), { 
                                    id: Math.random().toString(36), 
                                    role: 'ai', 
                                    text: transcript, 
                                    agent: 'Gemini',
                                    isComplete: false
                                }];
                            }
                        });
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

                    // Handle Audio Responses (fallback)
                    const audioData = p.inlineData?.data || p.inline_data?.data;
                    if (audioData && pcmPlayerRef.current) {
                        console.log("Gemini Live: Found audio in modelTurn parts.");
                        pcmPlayerRef.current.feed(audioData);
                        setIsSpeaking(true);
                        setTimeout(() => setIsSpeaking(false), 2000); // Longer speaking window for visualizer
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
                            { ...lastMsg, text: lastMsg.text + transcription.text, timestamp: Date.now() }
                        ];
                    } else {
                        isAiTurnLockedRef.current = false;
                        return [...prev.slice(-15), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: transcription.text, 
                            agent: 'Gemini Live',
                            timestamp: Date.now()
                        } ];
                    }
                });
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
                isAiTurnLockedRef.current = true;
                setStatus('listening');
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'ai') {
                        return [
                            ...prev.slice(0, -1),
                            { ...lastMsg, isComplete: true }
                        ];
                    }
                    return prev;
                });
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
                const now = Date.now();
                
                // Merge logic: If last message was user and within 4 seconds, merge it.
                const isRecentUserMessage = lastMsg && lastMsg.role === 'user' && (now - (lastMsg.timestamp || 0) < 4000);

                if (isRecentUserMessage) {
                    // Update/Merge with the existing user message
                    // If it was an interim message, we replace text. If it was finalized, we append with a space.
                    const isInterim = lastMsg.id.startsWith('user-interim-');
                    const newText = isInterim ? transcript : (lastMsg.text + " " + transcript);
                    
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, text: newText, timestamp: now }
                    ];
                } else {
                    // Create a new user message block
                    return [...prev.slice(-15), { 
                        id: `user-interim-${now}`, 
                        role: 'user', 
                        text: transcript, 
                        agent: 'You',
                        timestamp: now
                    }];
                }
            });

            if (isFinal) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.id.startsWith('user-interim-')) {
                        return [
                            ...prev.slice(0, -1),
                            { ...lastMsg, id: Math.random().toString(36), timestamp: Date.now() }
                        ];
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
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                noiseSuppression: true, 
                echoCancellation: true, 
                autoGainControl: true 
            } 
        });
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
  }, [videoRef, onSelectMedia]);

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
    setVolume(0);
    setStatus('idle');
  }, []);

  /**
   * uploadStaticContext
   * Converts a file (image/video) to Base64 and injects it into Gemini's vision buffer.
   */
  const uploadStaticContext = useCallback(async (file: File) => {
    if (!clientRef.current || status !== 'listening') return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        if (!base64) return;

        // Strip data:image/jpeg;base64, prefix
        const base64Data = base64.split(',')[1];
        
        // Inject frame if client is ready
        clientRef.current?.sendBase64Frame(base64Data);

        // Notify UI
        setMessages(prev => [...prev.slice(-15), {
            id: Math.random().toString(36),
            role: 'user',
            text: `[SHARED CONTEXT]: ${file.name}`,
            agent: 'You',
            timestamp: Date.now()
        }]);
    };

    if (file.type.startsWith('image/')) {
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        // Simple placeholder for video context (could extract first frame in future)
        console.warn("Video context upload: Extracting first frame would require a video element. Sending first valid chunk if possible.");
        // For now, treat as image if it's a small snapshot or just warn.
        alert("Video import is currently limited to static snapshots. Please share an image for context.");
    }
  }, [status]);

  const cancelMedia = useCallback((id: string) => {
      setMediaQueue(prev => prev.filter(m => m.id !== id));
  }, []);

  useEffect(() => {
    isMutedRef.current = isMuted;
    
    // Hardware Sync: Disable/Enable Mic Track
    if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
        });
    }

    // STT Sync: Restart Recognition on Unmute to ensure clean hardware buffer
    if (recognitionRef.current) {
        try {
            if (isMuted) {
                console.log("STT: Muted. Stopping recognition...");
                recognitionRef.current.stop();
            } else {
                console.log("STT: Unmuted. Restarting recognition...");
                // Note: stop() before start() ensures we don't have overlapping sessions
                recognitionRef.current.stop();
                setTimeout(() => {
                    try { recognitionRef.current.start(); } catch(e) { /* ignore already started */ }
                }, 100);
            }
        } catch (err) {
            console.error("STT Sync Error:", err);
        }
    }
  }, [isMuted]);

  return { messages, status, isSpeaking, volume, isMuted, setIsMuted, connect, disconnect, mediaQueue, cancelMedia, taskPlan, uploadStaticContext };
}
