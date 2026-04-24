import { Injectable, signal } from '@angular/core';

/**
 * Generates a subtle synth-wave alarm using the Web Audio API — no audio assets required.
 * The alarm is a slow, ominous detuned sawtooth pulse with a low-frequency oscillator.
 */
@Injectable({ providedIn: 'root' })
export class AlarmService {
  private ctx: AudioContext | null = null;
  private nodes: { stop: () => void } | null = null;
  private readonly _muted = signal<boolean>(this.loadMuted());
  readonly muted = this._muted.asReadonly();
  private readonly _playing = signal<boolean>(false);
  readonly playing = this._playing.asReadonly();

  toggleMuted(): void {
    const next = !this._muted();
    this._muted.set(next);
    try {
      localStorage.setItem('cyberpunk-dashboard.alarm.muted', String(next));
    } catch {
      // ignore
    }
    if (next && this._playing()) {
      this.stop();
    }
  }

  start(): void {
    if (this._playing() || this._muted()) {
      return;
    }
    try {
      const Ctor: typeof AudioContext | undefined =
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .AudioContext ??
        (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) {
        return;
      }
      if (!this.ctx) {
        this.ctx = new Ctor();
      }
      const ctx = this.ctx;
      // Some browsers start contexts in a suspended state until a user gesture.
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }

      const master = ctx.createGain();
      master.gain.value = 0.0;
      master.connect(ctx.destination);

      // Slow ramp-up so the alarm fades in subtly.
      master.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.6);

      // Two detuned saw oscillators for that 80s synth feel.
      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.value = 110; // A2
      const oscB = ctx.createOscillator();
      oscB.type = 'sawtooth';
      oscB.frequency.value = 110;
      oscB.detune.value = 12; // slight detune

      // LFO that swings frequency up and down — siren-like but slow.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.5; // 0.5 Hz — slow pulse
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 30; // ±30 cents
      lfo.connect(lfoGain);
      lfoGain.connect(oscA.detune);
      lfoGain.connect(oscB.detune);

      // Low-pass filter for that warm analog vibe.
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 900;
      filter.Q.value = 6;

      // Tremolo on the master to give a pulsing feel.
      const tremolo = ctx.createOscillator();
      tremolo.type = 'sine';
      tremolo.frequency.value = 2;
      const tremoloGain = ctx.createGain();
      tremoloGain.gain.value = 0.04;
      tremolo.connect(tremoloGain);
      tremoloGain.connect(master.gain);

      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(master);

      oscA.start();
      oscB.start();
      lfo.start();
      tremolo.start();

      this._playing.set(true);
      this.nodes = {
        stop: () => {
          try {
            master.gain.cancelScheduledValues(ctx.currentTime);
            master.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.4);
            const stopAt = ctx.currentTime + 0.5;
            oscA.stop(stopAt);
            oscB.stop(stopAt);
            lfo.stop(stopAt);
            tremolo.stop(stopAt);
          } catch {
            // ignore double stop
          }
        }
      };
    } catch (err) {
      console.warn('[alarm] Could not start audio', err);
    }
  }

  stop(): void {
    if (!this._playing()) {
      return;
    }
    this.nodes?.stop();
    this.nodes = null;
    this._playing.set(false);
  }

  private loadMuted(): boolean {
    try {
      return localStorage.getItem('cyberpunk-dashboard.alarm.muted') === 'true';
    } catch {
      return false;
    }
  }
}
