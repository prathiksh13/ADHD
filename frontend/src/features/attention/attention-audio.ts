/** Soft two-tone cue, created/resumed only from a user gesture. */
export class AttentionChime {
  private context: AudioContext | null = null;
  private voices = new Set<OscillatorNode>();
  get ready() { return this.context?.state === "running"; }
  async prime() {
    if (typeof AudioContext === "undefined") return;
    this.context ??= new AudioContext({ latencyHint: "interactive" });
    if (this.context.state === "suspended") await this.context.resume();
  }
  async play() {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running") return;
    this.stop();
    for (const [frequency, offset] of [[440, 0], [554, .23]]) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      const start = ctx.currentTime + offset;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(.06, start + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .25);
      oscillator.connect(gain); gain.connect(ctx.destination);
      this.voices.add(oscillator);
      oscillator.onended = () => { this.voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + .27);
    }
  }
  stop() {
    for (const voice of this.voices) { try { voice.stop(); } catch { /* already ended */ } }
    this.voices.clear();
  }
  async close() {
    this.stop(); const context = this.context; this.context = null;
    if (context && context.state !== "closed") await context.close();
  }
}
