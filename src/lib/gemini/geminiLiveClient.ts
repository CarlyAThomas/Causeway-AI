/**
 * Gemini Multimodal Live API Client (WebSocket based)
 * Handles vision frames and real-time audio.
 */

export interface GeminiLiveConfig {
  apiKey: string;
  model: string;
  systemInstruction?: string;
}

export type GeminiLiveStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export class GeminiLiveClient {
  private socket: WebSocket | null = null;
  private config: GeminiLiveConfig;
  private onMessage: (message: any) => void;
  private onStatusChange: (status: GeminiLiveStatus) => void;
  private audioContext: AudioContext | null = null;
  private audioWorklet: AudioWorkletNode | null = null;
  private isReady: boolean = false;

  constructor(config: GeminiLiveConfig, onMessage: (msg: any) => void, onStatusChange: (status: GeminiLiveStatus) => void) {
    this.config = config;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  public connect() {
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

        // Detect Setup Completion (Handshake Guard)
        if (data.setupComplete || data.setup_complete) {
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
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    // STABILITY LOCK (RECOVERY): Reverting to AUDIO-only modality to prevent the persistent 1011 crash.
    const setupMsg = {
      setup: {
        model: `models/${this.config.model}`,
        generation_config: {
            response_modalities: ["audio"]
        },
        system_instruction: {
            parts: [{ text: this.config.systemInstruction || "You are a professional task assistant." }]
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
    this.socket.send(JSON.stringify(setupMsg));
  }

  public sendToolResponse(callId: string, name: string, response: any) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    // In Gemini Live API, tool responses are sent via the root level `tool_response` key.
    const toolMsg = {
      tool_response: {
        function_responses: [{
          id: callId,
          name: name,
          response: typeof response === 'string' ? { status: response } : response
        }]
      }
    };
    
    console.log("🟢 OUTGOING [ToolResponse]:", toolMsg);
    this.socket.send(JSON.stringify(toolMsg));
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
    
    // Safety Guard: Ensure image/jpeg and handle empty data (Suspect 2 Fix)
    const base64DataUrl = canvas.toDataURL('image/jpeg', 0.6);
    const base64Image = base64DataUrl.split(',')[1];
    
    if (!base64Image || base64Image.length < 10) {
        console.warn("Gemini Live: Skipping empty/invalid video frame");
        return;
    }

    const msg = {
      realtime_input: {
        video: {
          mime_type: 'image/jpeg',
          data: base64Image
        }
      }
    };

    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Explicitly sends a static base64-encoded JPEG frame to Gemini.
   * Useful for "Importing Context" via file uploads.
   */
  public sendBase64Frame(base64Image: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
    if (!base64Image || base64Image.length < 10) return;

    const msg = {
      realtimeInput: {
        video: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      }
    };

    console.log("📤 OUTGOING [StaticContext]: Frame Injected");
    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Sends audio PCM data (16-bit, 16kHz or 24kHz)
   */
  public sendAudioChunk(base64Pcm: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
    
    // Safety Guard: Prevent sending empty audio buffers
    if (!base64Pcm || base64Pcm.length < 5) return;

    const msg = {
      realtime_input: {
        audio: {
          mime_type: 'audio/pcm;rate=16000',
          data: base64Pcm
        }
      }
    };

    this.socket.send(JSON.stringify(msg));
  }
  
  /**
   * Sends generic client content (e.g. text for State Sync)
   */
  public sendClientContent(parts: any[], turnComplete: boolean = true) {
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
      
      const msg = {
          client_content: {
              turns: [{
                  role: 'user',
                  parts: parts
              }],
              turn_complete: turnComplete
          }
      };
      
      console.log("🔵 OUTGOING [ClientContent]:", JSON.stringify(msg));
      this.socket.send(JSON.stringify(msg));
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.onStatusChange('disconnected');
  }
}
