/**
 * PCM Audio Processor Worklet
 * Runs in a separate thread to capture raw microphone data without blocking the UI.
 * [ACCUMULATOR]: Buffers tiny 128-sample blocks into stable 4096-sample chunks to prevent protocol disconnects.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // ~256ms @ 16kHz
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferOffset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      
      // Accumulate 128-sample blocks into our larger buffer
      for (let i = 0; i < channelData.length; i++) {
        this.buffer[this.bufferOffset] = channelData[i];
        this.bufferOffset++;

        // When buffer is full, flush to main thread
        if (this.bufferOffset >= this.bufferSize) {
          // Send a COPY of the buffer to the main thread for conversion
          this.port.postMessage(new Float32Array(this.buffer));
          this.bufferOffset = 0;
        }
      }
    }
    // Keep the processor alive
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
