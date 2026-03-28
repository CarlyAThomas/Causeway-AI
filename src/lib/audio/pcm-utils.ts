/**
 * PCM Audio Utilities for Gemini Live
 * Converts browser-side Float32 audio to 16-bit Int PCM (required by Gemini)
 */

export function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return buffer;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Normalizes audio levels for better microphone input sensitivity.
 */
export function normalizeAudio(float32Array: Float32Array): Float32Array {
  const max = Math.max(...float32Array.map(Math.abs));
  if (max === 0) return float32Array;
  
  const factor = 0.8 / max; // Target 80% peak
  return float32Array.map(v => v * factor);
}
