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

  constructor(config: GeminiLiveConfig, onMessage: (msg: any) => void, onStatusChange: (status: GeminiLiveStatus) => void) {
    this.config = config;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  public connect() {
    this.onStatusChange('connecting');

    const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BiDiGenerateContent?key=${this.config.apiKey}`;
    
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      this.onStatusChange('connected');
      this.sendSetup();
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.onMessage(data);
      } catch (err) {
        console.error("Error parsing Gemini message:", err);
      }
    };

    this.socket.onerror = (err) => {
      console.error("Gemini WebSocket error:", err);
      this.onStatusChange('error');
    };

    this.socket.onclose = () => {
      this.onStatusChange('disconnected');
    };
  }

  private sendSetup() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const setupMsg = {
      setup: {
        model: `models/${this.config.model}`,
        generation_config: {
            response_modalities: ["AUDIO"]
        },
        system_instruction: this.config.systemInstruction 
            ? { parts: [{ text: this.config.systemInstruction }] }
            : undefined
      }
    };

    this.socket.send(JSON.stringify(setupMsg));
  }

  public sendRealtimeInput(chunks: any[]) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;

    const msg = {
      realtime_input: {
        media_chunks: chunks
      }
    };

    this.socket.send(JSON.stringify(msg));
  }

  /**
   * Captures a frame from the video element and sends it as Base64 JPEG.
   */
  public sendVideoFrame(videoElement: HTMLVideoElement) {
    if (!videoElement || videoElement.readyState < 2) return;

    const canvas = document.createElement('canvas');
    canvas.width = 640; // Lower resolution for analysis
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const base64Image = canvas.toDataURL('image/jpeg', 0.6).replace(/^data:image\/jpeg;base64,/, '');

    this.sendRealtimeInput([{
        mime_type: 'image/jpeg',
        data: base64Image
    }]);
  }

  /**
   * Sends audio PCM data (16-bit, 16kHz or 24kHz)
   */
  public sendAudioChunk(base64Pcm: string) {
    this.sendRealtimeInput([{
        mime_type: 'audio/pcm;rate=16000',
        data: base64Pcm
    }]);
  }

  public disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.onStatusChange('disconnected');
  }
}
