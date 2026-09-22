/**
 * A short chime for timers and alarms, synthesised so there's no audio file to ship.
 * Browsers only allow sound after the page has been interacted with; pressing Start
 * counts, and if sound is blocked the timer still finishes silently.
 */
let context: AudioContext | null = null;

export function chime(times = 3) {
  try {
    context ??= new AudioContext();
    void context.resume();
    const start = context.currentTime + 0.02;
    for (let i = 0; i < times; i++) {
      const at = start + i * 0.32;
      const tone = context.createOscillator();
      const volume = context.createGain();
      tone.type = "sine";
      tone.frequency.setValueAtTime(i % 2 ? 660 : 880, at);
      volume.gain.setValueAtTime(0.0001, at);
      volume.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.26);
      tone.connect(volume).connect(context.destination);
      tone.start(at);
      tone.stop(at + 0.28);
    }
  } catch {
    // No audio available (or not allowed yet): the timer still finishes.
  }
}
