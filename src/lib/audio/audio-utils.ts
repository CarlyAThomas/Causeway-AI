'use client';

/**
 * playSuccessDing
 * Generates a clean, synthetic "ding" sound using the Web Audio API.
 * This provides immediate satisfying feedback when a tool is identified.
 */
export function playSuccessDing() {
  if (typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Softer, bell-like tone
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 (high note)
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1); // Quick upward flick for "happy" sound

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);

    // Clean up context after sound finishes to save resources
    setTimeout(() => {
        ctx.close().catch(console.error);
    }, 600);
  } catch (err) {
    console.warn("Audio Context Ding Error:", err);
  }
}
