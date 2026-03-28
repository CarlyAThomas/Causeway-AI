/**
 * PCMPlayer
 * A real-time audio playback engine that handles raw PCM data chunks.
 * Designed for low-latency streaming and seamless buffer queuing.
 */
export class PCMPlayer {
  private audioContext: AudioContext;
  private nextStartTime: number = 0;
  private sampleRate: number;

  constructor(audioContext: AudioContext, sampleRate: number = 24000) {
    this.audioContext = audioContext;
    this.sampleRate = sampleRate;
    // Initialize start time to current context time
    this.nextStartTime = this.audioContext.currentTime;
  }

  /**
   * Feeds a base64 encoded PCM chunk into the playback queue.
   */
  public feed(base64Data: string) {
    try {
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit PCM (Int16) to Float32 for Web Audio API
      const int16Array = new Int16Array(bytes.buffer);
      const float32Array = new Float32Array(int16Array.length);
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      const audioBuffer = this.audioContext.createBuffer(1, float32Array.length, this.sampleRate);
      audioBuffer.getChannelData(0).set(float32Array);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);

      // Calculate the start time for this chunk to ensure seamless playback
      const startTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
      source.start(startTime);

      // Advance the next start time by the duration of this chunk
      this.nextStartTime = startTime + audioBuffer.duration;
    } catch (err) {
      console.error("PCMPlayer: Error decoding or playing chunk:", err);
    }
  }

  public stop() {
    this.nextStartTime = this.audioContext.currentTime;
  }
}
