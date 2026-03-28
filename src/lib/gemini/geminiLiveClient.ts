/**
 * Gemini Multimodal Live API Client (WebSocket based)
 * Handles vision frames and real-time audio.
 */

export interface GeminiLiveConfig {
  apiKey: string;
  model: string;
  systemInstruction?: string;
}

export type GeminiLiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'idle' | 'thinking' | 'listening';

export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private onMessage: (message: any) => void;
  private onStatusChange: (status: GeminiLiveStatus) => void;
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private isReady: boolean = false;
  private lastSendTime: number = 0; 
  private isEgressMuted: boolean = false; // [STREAM GUARD]: Prevent ghost-mic poison pills during UI transitions
  private isEgressLocked: boolean = false; // [ATOMIC GUARD]: Prevent Code 1007 collisions during view-swaps

  constructor(config: GeminiLiveConfig, onMessage: (msg: any) => void, onStatusChange: (status: GeminiLiveStatus) => void) {
    this.config = config;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  /**
   * [STREAM GUARD]: Silences all outgoing traffic (except tool responses) to ensure stable handoffs.
   */
  public setEgressMuted(muted: boolean) {
    console.log(`[STREAM GUARD] Egress Muted: ${muted}`);
    this.isEgressMuted = muted;
  }

  /**
   * [FORENSIC EGRESS AUDIT]: Centralized sender that validates every packet.
   * [PACKET SPACING]: Enforces a 25ms delay between technical payloads.
   */
  private async safeSend(label: string, msg: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
        return;
    }

    // [STREAM GUARD]: Block background streams if muted, but ALLOW explicit Tool Responses/Setup
    // [STABILITY]: VideoFrame and AudioChunk are the primary causes of Code 1007 modality collisions.
    if (this.isEgressMuted && label !== 'ToolResponse' && label !== 'Setup') {
        console.warn(`[STREAM GUARD] Blocking ${label} while Egress is Muted (Modality Collision Prevented).`);
        return;
    }

    // [PACKET SPACING]: Ensure technical payloads don't collide.
    // Metadata (SystemEvent/ClientContent) needs more room than high-frequency media (Audio/Video).
    const now = Date.now();
    const elapsed = now - this.lastSendTime;
    const minSpacing = (label === 'SystemEvent' || label === 'ClientContent') ? 150 : 25;
    
    if (elapsed < minSpacing) {
        const delay = minSpacing - elapsed;
        await new Promise(resolve => setTimeout(resolve, delay));
    }
    this.lastSendTime = Date.now();

    try {
        const payload = JSON.stringify(msg);
        
        // --- POISON PILL GUARDS ---
        
        // [STRICT AUDIO FLOOR]: A healthy 100ms 16kHz PCM chunk is ~4200 chars. 
        // 417 chars (microscopic) is a corrupt buffer/interrupted mic and WILL CRASH the server (Code 1007).
        if (msg.realtimeInput?.audio?.data) {
            const audioLen = msg.realtimeInput.audio.data.length;
            if (audioLen < 1500) {
                console.error(`[GUARDED] Poison Pill Detected in ${label}: Microscopic Audio (${audioLen} chars). BLOCKING TO PREVENT CRASH.`);
                return;
            }
        }

        if (msg.realtimeInput?.video?.data === "") {
            console.error(`[GUARDED] Poison Pill Detected in ${label}: Empty Video. BLOCKING.`);
            return;
        }

        // Forensic Logging (Reveal Data Start to detect Data URI Traps)
        const keys = Object.keys(msg).join(', ');
        const length = payload.length;
        
        // Extract a snippet of the actual data for audit
        let dataPreview = "N/A";
        if (msg.realtimeInput?.video?.data) dataPreview = msg.realtimeInput.video.data.substring(0, 30);
        else if (msg.realtimeInput?.audio?.data) dataPreview = msg.realtimeInput.audio.data.substring(0, 30);
        
        console.log(`[SAFE SEND] ${label} | Keys: [${keys}] | Size: ${length} chars | Data Start: ${dataPreview}...`);

        this.socket.send(payload);
    } catch (err) {
        console.error(`[SAFE SEND] Critical error serializing ${label}:`, err);
    }
  }

  public connect() {
    this.isReady = false;
    this.isEgressMuted = false; // [STABILITY RESET]: Unmute on fresh connect to avoid gags.
    this.onStatusChange('connecting');

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.config.apiKey}`;
    
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log("Gemini Live: WebSocket connected");
      this.sendSetup();
    };

    this.socket.onmessage = async (event) => {
      try {
        let content = event.data;
        if (event.data instanceof Blob) {
          content = await event.data.text();
        }
        
        console.log("Gemini Live Raw Packet:", content);
        
        const data = JSON.parse(content);

        // Detect Setup Completion
        if (data.setup_complete || data.setupComplete) {
          console.log("Gemini Live: Setup Complete (Handshake Verified)");
          this.isReady = true;
          this.onStatusChange('connected');
          return;
        }

        this.onMessage(data);
      } catch (err) {
        console.error("Gemini Live: Error parsing message:", err);
      }
    };

    this.socket.onerror = (error) => {
      console.error("Gemini Live: WebSocket Error:", error);
      this.onStatusChange('error');
    };

    this.socket.onclose = (event) => {
      console.warn(`Gemini Live: WebSocket closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}`);
      if (event.code !== 1000) {
          console.error("Gemini Live: Connection closed unexpectedly. This may be due to an invalid JSON field or protocol mismatch.");
      }
      this.isReady = false;
      this.onStatusChange('disconnected');
    };
  }

  private sendSetup() {
    const setupMsg = {
      setup: {
        model: `models/${this.config.model}`,
        generation_config: {
            response_modalities: ["audio"]
        },
        system_instruction: {
            role: "system", 
            parts: [{ text: this.config.systemInstruction || "You are a helpful industrial assistant." }]
        },
        tools: [
            {
              function_declarations: [
                {
                  name: "generate_text_to_video",
                  description: "Use this when the user needs a visual demonstration of a concept, or asks how to do something, and you want to show them a generated video of the action.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      prompt: {
                        type: "STRING",
                        description: "A highly descriptive, visual-focused prompt instructing the video generation model exactly what to render. (e.g. 'Show a person turning a lug wrench counter-clockwise')."
                      }
                    },
                    required: ["prompt"]
                  }
                },
                {
                  name: "generate_image_to_video",
                  description: "Use this when the user asks what to do with a specific object currently shown on their camera. This generates a video showing an action contextually starting from their current real-world state.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      prompt: {
                        type: "STRING",
                        description: "A highly descriptive action prompt explaining what should happen to the object in the user's current camera frame."
                      }
                    },
                    required: ["prompt"]
                  }
                },
                {
                  name: "propose_plan",
                  description: "Use this before any media generation or major instruction to declare your current goal, the immediate next step, and any safety checks. This updates the user's Planning HUD.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      goal: {
                        type: "STRING",
                        description: "The overall mission or objective (e.g., 'Raise the vehicle safely')."
                      },
                      next_step: {
                        type: "STRING",
                        description: "The immediate physical action the user should take."
                      },
                      safety_checks: {
                        type: "ARRAY",
                        items: { type: "string" },
                        description: "A list of critical safety verifications for this plan."
                      },
                      effort: {
                        type: "STRING",
                        enum: ["low", "medium", "high"],
                        description: "How much physical effort or complexity this step involves."
                      },
                      progress: {
                        type: "NUMBER",
                        description: "Overall task progress (0.0 to 1.0)."
                      },
                      required_tools: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            name: { type: "STRING" }
                          }
                        },
                        description: "List of specific tools needed for this task."
                      }
                    },
                    required: ["goal", "next_step", "safety_checks", "effort", "progress", "required_tools"]
                  }
                },
                {
                  name: "update_perception",
                  description: "Use this to report the current status and spatial location (bounding box) of required tools.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      tools: {
                        type: "ARRAY",
                        items: {
                          type: "OBJECT",
                          properties: {
                            name: { type: "STRING" },
                            detected: { type: "BOOLEAN" },
                            boundingBox: {
                              type: "ARRAY",
                              items: { type: "NUMBER" },
                              description: "[ymin, xmin, ymax, xmax] (0-1000)"
                            }
                          }
                        }
                      }
                    },
                    required: ["tools"]
                  }
                },
                {
                  name: "query_media_cache",
                  description: "Get a list of the user's recently generated media items (videos/images) and their status.",
                  parameters: {
                    type: "OBJECT",
                    properties: {}
                  }
                },
                {
                  name: "select_media_item",
                  description: "Switch the user's primary focus to a specific media item from their gallery by its ID.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      id: {
                        type: "STRING",
                        description: "The unique ID of the media item to select."
                      }
                    },
                    required: ["id"]
                  }
                }
              ]
            }
        ]
      }
    };

    console.log("Gemini Live: Sending Forensic Audit Setup...", setupMsg);
    this.safeSend('Setup', setupMsg);
  }

  public sendToolResponse(callId: string, name: string, response: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    // [PROTOCOL]: Switching to snake_case (tool_response, function_responses)
    const toolMsg = {
      tool_response: {
        function_responses: [{
          id: callId,
          name: name,
          response: typeof response === 'string' ? { status: response } : response
        }]
      }
    };
    
    this.safeSend('ToolResponse', toolMsg);
  }

  /**
   * Captures a frame from the video element and sends it as Base64 JPEG.
   */
  public sendVideoFrame(videoElement: HTMLVideoElement) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
    if (!videoElement || videoElement.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640; 
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    try {
        const base64DataUrl = canvas.toDataURL('image/jpeg', 0.6);
        
        // [STRICT SANITIZATION]: Strip data:image/jpeg;base64, prefix using robust regex
        const base64Image = base64DataUrl.replace(/^data:image\/[a-z]+;base64,/, "");
        
        if (!base64Image || base64Image.length < 10) {
            return;
        }

        // [ATOMIC LOCK]: Strictly forbid video frames during a context sync (SystemEvent)
        // to prevent Code 1007 modality collisions.
        if (this.isEgressLocked) return;

        const msg = {
          realtime_input: {
            video: {
              mime_type: 'image/jpeg',
              data: base64Image
            }
          }
        };

        this.safeSend('VideoFrame', msg);
    } catch (err) {
        // [STABILITY]: If canvas is tainted (CORS) or drawing fails, skip frame rather than crashing the session.
        console.warn("Gemini Live: Critical Vision Capture Failure (CORS/Tainted Canvas?):", err);
    }
  }

  /**
   * Explicitly sends a static base64-encoded JPEG frame to Gemini.
   */
  public sendBase64Frame(base64Image: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
    if (!base64Image || base64Image.length < 10) return;

    const msg = {
      realtime_input: {
        video: {
          mime_type: 'image/jpeg',
          data: base64Image
        }
      }
    };

    console.log("📤 OUTGOING [StaticContext]: Frame Injected");
    this.safeSend('StaticContext', msg);
  }

  /**
   * Sends audio PCM data (16-bit, 16kHz or 24kHz)
   */
  public sendAudioChunk(base64Pcm: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
    
    if (!base64Pcm || base64Pcm.length < 5) return;

    // [ATOMIC LOCK]: Strictly forbid audio chunks during a context sync (SystemEvent)
    if (this.isEgressLocked) return;

    const msg = {
      realtime_input: {
        audio: {
          mime_type: 'audio/pcm;rate=16000',
          data: base64Pcm
        }
      }
    };

    this.safeSend('AudioChunk', msg);
  }
  
  /**
   * Sends generic client content
   */
  public sendClientContent(parts: any[], turnComplete: boolean = true) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
      
      // [ATOMIC HANDSHAKE]: Lock the egress for 150ms to ensure clientContent reaches the server
      // without being interleaved/interrupted by high-frequency media binary data.
      this.isEgressLocked = true;
      
      const msg = {
          client_content: {
              turns: [{
                  role: 'user',
                  parts: parts
              }],
              turn_complete: turnComplete
          }
      };
      
      this.safeSend('ClientContent', msg);

      setTimeout(() => {
          this.isEgressLocked = false;
      }, 150);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.onStatusChange('disconnected');
  }

  /**
   * Sends a silent text-based turn to Gemini.
   */
  public sendSystemEvent(text: string, turnComplete: boolean = false) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;

    // [ATOMIC HANDSHAKE]: Lock the egress for 150ms to ensure SystemEvent reaches the server
    this.isEgressLocked = true;

    const msg = {
      client_content: {
        turns: [{
          role: "user",
          parts: [{ text }]
        }],
        turn_complete: turnComplete
      }
    };
    
    this.safeSend('SystemEvent', msg);

    setTimeout(() => {
        this.isEgressLocked = false;
    }, 150);
  }
}
