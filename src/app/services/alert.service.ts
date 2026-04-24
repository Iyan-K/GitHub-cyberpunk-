import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AlertService {
  criticalAlert = signal(false);
  private audioCtx: AudioContext | null = null;
  private alarmInterval: ReturnType<typeof setInterval> | null = null;

  triggerCriticalAlert() {
    this.criticalAlert.set(true);
    this.playAlarm();
  }

  clearCriticalAlert() {
    this.criticalAlert.set(false);
    this.stopAlarm();
  }

  private getAudioContext(): AudioContext {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioCtx;
  }

  private playAlarm() {
    if (this.alarmInterval) return;
    this.playAlarmSound();
    this.alarmInterval = setInterval(() => this.playAlarmSound(), 2000);
  }

  private stopAlarm() {
    if (this.alarmInterval) {
      clearInterval(this.alarmInterval);
      this.alarmInterval = null;
    }
  }

  private playAlarmSound() {
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const notes = [220, 277, 330, 220];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);
        gainNode.gain.setValueAtTime(0, now + i * 0.15);
        gainNode.gain.linearRampToValueAtTime(0.08, now + i * 0.15 + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, now + i * 0.15 + 0.14);
        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.15);
      });
    } catch (e) {
      // Audio not supported
    }
  }
}
