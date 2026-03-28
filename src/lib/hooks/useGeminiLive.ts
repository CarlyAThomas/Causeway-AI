'use client';

import { useState, useCallback, useRef, useEffect } from "react";
import { GeminiLiveClient, GeminiLiveStatus } from "../gemini/geminiLiveClient";
import { floatTo16BitPCM, arrayBufferToBase64 } from "../audio/pcm-utils";
import { PCMPlayer } from "../audio/audio-manager";
import { playSuccessDing } from "../audio/audio-utils";
import { MediaRequest } from "@/types";
import { TaskPlan, INITIAL_PLAN } from "@/types/workflow";

/**
 * findVideoUri
 * Recursive helper to find any 'uri' key in the deeply nested Gemini LRO response.
 */
function findVideoUri(obj: any): string | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    if (obj.uri && typeof obj.uri === 'string' && (obj.uri.includes('googleapis.com') || obj.uri.includes('http'))) {
        return obj.uri;
    }
    for (const key in obj) {
        const result = findVideoUri(obj[key]);
        if (result) return result;
    }
    return undefined;
}

/**
 * useGeminiLive
 * Real-time multimodal hook to connect vision and voice to Gemini Live.
 */
export function useGeminiLive(getActiveVideo: () => HTMLVideoElement | null, onSelectMedia?: (id: string) => void) {
  const [messages, setMessages] = useState<any[]>([]);
  const [status, setStatus] = useState<GeminiLiveStatus>('idle');
  const statusRef = useRef<GeminiLiveStatus>(status); // [STABILITY REF]: Unblock stale closures in audio/vision
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mediaQueue, setMediaQueue] = useState<MediaRequest[]>([]);
  const [taskPlan, setTaskPlan] = useState<TaskPlan>(INITIAL_PLAN);
  
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const isMutedRef = useRef(isMuted);
  const isAiTurnLockedRef = useRef(true);
  const isWaitingForModelResponseRef = useRef(false); // [STABILITY LOCK]: Pause all background sends during Tool Execution
  const audioContextRef = useRef<AudioContext | null>(null);
  const pcmPlayerRef = useRef<PCMPlayer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const recognitionRef = useRef<any>(null);
  const mediaQueueRef = useRef<MediaRequest[]>([]);
  const activeToolCallIdRef = useRef<string | null>(null); // [STATE SYNC]: Track callId for success handoff
  
  // Keep refs sync'd with state for tool call and closure access
  useEffect(() => {
    mediaQueueRef.current = mediaQueue;
    statusRef.current = status;
  }, [mediaQueue, status]);

  const sendSystemEvent = useCallback((text: string, turnComplete: boolean = false) => {
      if (isWaitingForModelResponseRef.current) {
          console.warn("🟠 [LOCK]: Dropping SystemEvent during active Tool Execution turn.");
          return;
      }

      // [STABILITY]: Mute media egress during System Event sync to prevent Code 1007 modality collisions.
      // We provide a 150ms 'Quiet Window' for the sync packet to reach the server.
      isWaitingForModelResponseRef.current = true; 
      clientRef.current?.sendSystemEvent(text, turnComplete);
      
      setTimeout(() => {
          isWaitingForModelResponseRef.current = false;
      }, 150);
  }, []);

  const connect = useCallback(async () => {
    if (clientRef.current) return;
    
    // [STABILITY RESET]: Ensure every new session starts UNLOCKED and ready for media.
    isWaitingForModelResponseRef.current = false;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
    
    // Initialize Audio Context and PCM Player (16kHz context, 24kHz for AI Voice)
    const audioContext = new AudioContext({ sampleRate: 16000 });
    
    // [STABILITY]: Explicitly resume context to bypass browser auto-suspension on handshake.
    // Without this, the mic stream stays 'suspended' even during User Gestures.
    try { await audioContext.resume(); } catch (e) { console.error("Audio Resume Error:", e); }
    
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
            isWaitingForModelResponseRef.current = true; // LOCK: Stop vision/audio/text sends
            const toolCall = msg.toolCall || msg.tool_call;
            const functionCalls = toolCall.functionCalls || toolCall.function_calls;
            
            if (functionCalls) {
                for (const call of functionCalls) {
                    activeToolCallIdRef.current = call.id; // Store for final success handoff
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
                    
                    // [UX BRIDGE]: Capture the last frame from the camera to use as a Blurred Cover
                    // during the processing phase. No more blank screens.
                    let thumbBase64 = undefined;
                    const activeVid = getActiveVideo();
                    if (activeVid) {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = 480; // Low-res for bridge
                            canvas.height = 270;
                            const ctx = canvas.getContext('2d');
                            if (ctx) {
                                ctx.drawImage(activeVid, 0, 0, canvas.width, canvas.height);
                                thumbBase64 = canvas.toDataURL('image/jpeg', 0.5);
                            }
                        } catch (e) { console.warn("Thumbnail Capture Failed:", e); }
                    }

                    // Add to Media Queue
                    setMediaQueue(prev => [{
                        id: newRequestId,
                        type: 'video',
                        status: 'pending',
                        prompt: call.args.prompt || 'Visual Guide Request',
                        thumbnail: thumbBase64,
                        timestamp: Date.now()
                    }, ...prev]);
                    
                    fetch('/api/generate-video', { 
                        method: 'POST', 
                        body: JSON.stringify(call.args),
                        headers: { 'Content-Type': 'application/json' }
                    }).then(async (res) => {
                      const callId = call.id; // [STABILITY]: Closure capture callId to prevent race conditions during polling
                      if (res.ok) {
                         const data = await res.json();
                         if (data.operationName) {
                            console.log(`🚀 [STAGE]: Generation Started for ${newRequestId}. Status -> Generating.`);
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

                                     // [STABILITY GUARD]: Check for Google-side API Errors (Resource Exhausted / Demand)
                                     if (pollData.data?.error) {
                                         console.error("❌ Veo Generation Failed (Google Side):", pollData.data.error.message);
                                         setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { 
                                             ...m, 
                                             status: 'failed' 
                                         } : m));
                                         
                                         // Protocol Closure: Tell Gemini it failed
                                         clientRef.current?.sendToolResponse(
                                             callId, 
                                             call.name, 
                                             { status: "error", error: pollData.data.error.message }
                                         );
                                         return;
                                     }

                                     // [INDUSTRIAL URI HUNTER]: Robustly find the video link in the Google LRO response.
                                     // This ensures the VeoPlayer gets its source regardless of API nesting variations.
                                     const finalUri = findVideoUri(pollData.data);
                                     
                                     // --- [SAFE HANDOFF LIFECYCLE] ---
                                     
                                     // 1. Pause the Streams (Stop Ghost Mic poison pills during UI shift)
                                     clientRef.current?.setEgressMuted(true);

                                     // 2. Wait for UI / Buffer Stability
                                     await new Promise(r => setTimeout(r, 300));

                                     // 3. Send Success Tool Response (Protocol Closure)
                                     // [STABILITY]: Resolving the Tool Call is the EXCLUSIVE signal to Gemini.
                                     // Do NOT send overlapping Text/System events during this phase.
                                     console.log("🚀 [PROTOCOL]: Closing Tool Call with Success for", callId);
                                     clientRef.current?.sendToolResponse(
                                         callId, 
                                         call.name, 
                                         { 
                                             status: "success", 
                                             message: "Instructional video generated successfully.",
                                             details: "The Veo video is now on screen and has the user's focus." 
                                         }
                                     );

                                     // 4. Update UI State & Force Focus
                                     setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { 
                                         ...m, 
                                         status: 'completed', 
                                         url: finalUri 
                                     } : m));

                                     // [EXPLICIT FOCUS HANDOFF]: Tell the parent UI to lock onto this newly-completed guide.
                                     // This ensures the activeMedia pointer in page.tsx refreshes its 'completed' state.
                                     if (onSelectMedia && finalUri) {
                                         console.log("🚀 [HANDOFF]: Forcing Stage Focus for", newRequestId);
                                         onSelectMedia(newRequestId);
                                     }

                                     // 5. Safely Resume
                                     setTimeout(() => {
                                         clientRef.current?.setEgressMuted(false);
                                     }, 500);
                                  }
                               }
                               
                               if (attempts > 30) {
                                   clearInterval(pollInterval);
                                   setMediaQueue(prev => prev.map(m => m.id === newRequestId ? { ...m, status: 'failed' } : m));
                               }
                            }, 5000);
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

                    // [PROTOCOL]: We NO LONGER send an immediate response here.
                    // Gemini will wait for the final toolResponse from the pollInterval loop.
                    // This ensures the tool logic is strictly sequential and avoids Code 1007 collisions.
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

            let aiTextToAppend = "";
            const modelTurn = serverContent.modelTurn || serverContent.model_turn;
            if (modelTurn?.parts) {
                modelTurn.parts.forEach((p: any) => {
                    const transcript = p.text || p.transcript || p.interim_transcript || p.interimResult;
                    if (transcript) aiTextToAppend += transcript;

                    if (p.thought || p.thought_process) {
                        setMessages(prev => [...prev.slice(-15), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: `[THINKING]: ${p.thought || p.thought_process}`, 
                            agent: 'Gemini (Thinking)' 
                        }]);
                    }

                    const audioData = p.inlineData?.data || p.inline_data?.data;
                    if (audioData && pcmPlayerRef.current) {
                        pcmPlayerRef.current.feed(audioData);
                        setIsSpeaking(true);
                        setTimeout(() => setIsSpeaking(false), 2000);
                    }
                });
            }

            const transcription = serverContent.outputTranscription || serverContent.output_transcription;
            if (transcription?.text && aiTextToAppend === "") {
                aiTextToAppend = transcription.text;
            }

            if (aiTextToAppend) {
                setMessages(prev => {
                    const lastMsg = prev[prev.length - 1];
                    if (lastMsg && lastMsg.role === 'ai' && !lastMsg.isComplete) {
                        return [
                            ...prev.slice(0, -1),
                            { ...lastMsg, text: lastMsg.text + aiTextToAppend, timestamp: Date.now() }
                        ];
                    } else {
                        isAiTurnLockedRef.current = false;
                        return [...prev.slice(-50), { 
                            id: Math.random().toString(36), 
                            role: 'ai', 
                            text: aiTextToAppend, 
                            agent: 'Gemini Live',
                            isComplete: false,
                            timestamp: Date.now()
                        }];
                    }
                });
            }

            if (serverContent.turnComplete || serverContent.turn_complete) {
                isAiTurnLockedRef.current = true;
                isWaitingForModelResponseRef.current = false; // UNLOCK: Resume background sync
                setIsSpeaking(false);
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
        const Recognition = (window as any).webkitSpeechRecognition || (window as any).Recognition;
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            if (isMutedRef.current) return;
            
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                transcript += event.results[i][0].transcript;
            }
            
            isAiTurnLockedRef.current = true;
            const isFinal = event.results[event.results.length - 1].isFinal;

            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                const now = Date.now();
                
                // Merge logic: If last message was user and within 4 seconds, merge it.
                const isRecentUserMessage = lastMsg && lastMsg.role === 'user' && (now - (lastMsg.timestamp || 0) < 4000);

                if (isRecentUserMessage) {
                    const isInterim = lastMsg.id.startsWith('user-interim-');
                    const newText = isInterim ? transcript : (lastMsg.text + " " + transcript);
                    
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMsg, text: newText, timestamp: now }
                    ];
                } else {
                    return [...prev.slice(-50), { 
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

        recognition.onend = () => {
            // Self-repair: Restart if it ends unexpectedly while not muted
            if (!isMutedRef.current && clientRef.current) {
                try { recognition.start(); } catch(e) {}
            }
        };

        recognition.onerror = (err: any) => {
            // STT errors like 'no-speech' or 'audio-capture' are typical in noisy environments
            console.warn("[STT EVENT] Speech Engine Detail:", err.error, err.message || "");
        };
        recognitionRef.current = recognition;
        recognition.start();
    }

    intervalRef.current = null;

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
            
            // [STABILITY GUARD]: Absolutely no audio chunks while thinking or waiting for tool responses.
            // Using statusRef.current here to avoid Staleness Gags in the one-shot connect closure.
            if (isWaitingForModelResponseRef.current || statusRef.current !== 'listening') return;

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
  }, [getActiveVideo, sendSystemEvent, onSelectMedia]);

  // [REACTIVE PERCEPTION]: Dynamically switch Gemini's vision source based on UI focus
  useEffect(() => {
    // [STRENGTHENED GUARD]: Vision sampling must strictly only occur during the 'listening' phase.
    // Transitioning into 'thinking' while vision frames are in-flight causes Code 1007 modality collisions.
    const isActive = status === 'listening';
    if (!isActive || !clientRef.current) return;

    // [STABILITY GRACE PERIOD]: Wait 300ms before starting vision sampling.
    // This allows focus-sync SystemEvents (from page.tsx) to clear the protocol buffer.
    const startTime = setTimeout(() => {
        console.log("🔍 Perception Loop: Starting vision sampling...");
        intervalRef.current = setInterval(() => {
            const activeVideo = getActiveVideo();
            // [STRENGTHENED GUARD]: Using statusRef here to prevent stale closure 'Video Leaks' during transitions.
            const isProtcolSafe = statusRef.current === 'listening' && !isWaitingForModelResponseRef.current;
            
            if (activeVideo && clientRef.current && isProtcolSafe) {
                clientRef.current.sendVideoFrame(activeVideo);
            }
        }, 500);
    }, 300);

    return () => {
        console.log("🔍 Perception Loop: Cleaning up...");
        clearTimeout(startTime);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [getActiveVideo, status]);

  const disconnect = useCallback(() => {
    if (clientRef.current) clientRef.current.disconnect();
    
    // [STABILITY RESET]: Clear all locks on disconnect to prevent 'Ghost Mic' gags on reconnection.
    isWaitingForModelResponseRef.current = false;
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

        // [STRICT SANITIZATION]: Strip data:image/jpeg;base64, prefix using robust regex
        const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, "");
        
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
        console.warn("Video import is currently limited to static snapshots. Please share an image for context.");
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
                recognitionRef.current.stop();
                setTimeout(() => {
                    try { recognitionRef.current.start(); } catch(e) {}
                }, 100);
            }
        } catch (err) {
            console.error("STT Sync Error:", err);
        }
    }
  }, [isMuted]);

  return { 
    messages, 
    status, 
    isSpeaking, 
    volume, 
    isMuted, 
    setIsMuted, 
    connect, 
    disconnect, 
    mediaQueue, 
    cancelMedia, 
    sendSystemEvent, 
    taskPlan, 
    uploadStaticContext,
    setEgressMuted: (muted: boolean) => clientRef.current?.setEgressMuted(muted)
  };
}
