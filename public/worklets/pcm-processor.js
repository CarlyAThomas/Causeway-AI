/**
 * PCM Audio Processor Worklet
 * Runs in a separate thread to capture raw microphone data without blocking the UI.
 */
class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      // Send the raw Float32 audio chunk to the main thread for PCM conversion
      this.port.postMessage(channelData);
    }
    // Keep the processor alive
    return true;
  }
}

registerProcessor('pcm-processor', PcmProcessor);
