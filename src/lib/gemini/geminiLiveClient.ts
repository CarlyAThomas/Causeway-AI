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

    this.socket.onerror = (err) => {
      console.error("Gemini Live: WebSocket error:", err);
      this.onStatusChange('error');
    };

    this.socket.onclose = (event) => {
      console.warn(`Gemini Live: WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
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
            response_modalities: ["AUDIO"]
        },
        system_instruction: this.config.systemInstruction 
            ? { role: "system", parts: [{ text: this.config.systemInstruction }] }
            : { role: "system", parts: [{ text: "You are a helpful assistant." }] },
        tools: [
            {
              functionDeclarations: [
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
                }
              ]
            }
        ]
      }
    };

    console.log("Gemini Live: Sending Forensic Audit Setup...", setupMsg);
    this.socket.send(JSON.stringify(setupMsg));
  }

  public sendToolResponse(callId: string, name: string, responseStatus: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    
    // Use strict snake_case for tool_response (v1alpha Bidi Sync)
    const toolMsg = {
      tool_response: {
        function_responses: [{
          id: callId,
          name: name,
          response: { status: responseStatus }
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

    // Vision Debugging: Log exactly which element Gemini is 'seeing'
    const elementId = videoElement.id || videoElement.className || 'unknown';
    // Only log periodically to avoid spam
    if (Math.random() < 0.05) console.log(`🔍 Gemini Vision: Sampling from [${elementId}]`);

    const canvas = document.createElement('canvas');
    canvas.width = 640; 
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    
    const base64DataUrl = canvas.toDataURL('image/jpeg', 0.6);
    const base64Image = base64DataUrl.split(',')[1];
    
    if (!base64Image || base64Image.length < 10) {
        console.warn("Gemini Live: Skipping empty/invalid video frame");
        return;
    }

    // Using strict v1alpha structure: { realtime_input: { video: { mime_type, data } } }
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
   * Sends audio PCM data (16-bit, 16kHz or 24kHz)
   */
  public sendAudioChunk(base64Pcm: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;
    
    if (!base64Pcm || base64Pcm.length < 5) return;

    // Using strict v1alpha structure: { realtime_input: { audio: { mime_type, data } } }
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

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.onStatusChange('disconnected');
  }

  /**
   * Sends a silent text-based turn to Gemini to sync internal state.
   */
  public sendSystemEvent(text: string) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || !this.isReady) return;

    // Use strict snake_case for the client_content envelope (Required by v1alpha)
    const msg = {
      client_content: {
        turns: [{
          role: "user",
          parts: [{ text }]
        }],
        turn_complete: true
      }
    };
    
    console.log("🟠 OUTGOING [SystemEvent]:", text);
    this.socket.send(JSON.stringify(msg));
  }
}
