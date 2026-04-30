import { Injectable, signal } from '@angular/core';
import { SoundMode, SquadSettings } from '../models/github.models';

/**
 * Stores the user's "Comms Filter" preferences:
 * - audio enabled flag (audio_enabled)
 * - sound trigger mode (sound_mode): solo / squad / chaos
 * - squad members list (squad_members) — manually maintained GitHub logins
 *
 * All data is persisted to localStorage under independent keys so users can
 * inspect / hand-edit them, as requested in the spec.
 */
@Injectable({ providedIn: 'root' })
export class SquadService {
  private static readonly KEY_AUDIO = 'audio_enabled';
  private static readonly KEY_MODE = 'sound_mode';
  private static readonly KEY_SQUAD = 'squad_members';

  private static readonly VALID_MODES: ReadonlyArray<SoundMode> = ['solo', 'squad', 'chaos'];

  audioEnabled = signal<boolean>(true);
  soundMode = signal<SoundMode>('chaos');
  squadMembers = signal<string[]>([]);

  constructor() {
    this.load();
  }

  getSettings(): SquadSettings {
    return {
      audioEnabled: this.audioEnabled(),
      soundMode: this.soundMode(),
      squadMembers: this.squadMembers(),
    };
  }

  setAudioEnabled(enabled: boolean) {
    this.audioEnabled.set(enabled);
    this.write(SquadService.KEY_AUDIO, JSON.stringify(enabled));
  }

  setSoundMode(mode: SoundMode) {
    if (!SquadService.VALID_MODES.includes(mode)) return;
    this.soundMode.set(mode);
    this.write(SquadService.KEY_MODE, mode);
  }

  setSquadMembers(members: string[]) {
    const cleaned = this.normalizeMembers(members);
    this.squadMembers.set(cleaned);
    this.write(SquadService.KEY_SQUAD, JSON.stringify(cleaned));
  }

  addSquadMember(login: string): boolean {
    const trimmed = (login || '').trim();
    if (!trimmed) return false;
    // GitHub usernames: alphanumeric with single hyphens, max 39 chars.
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(trimmed)) {
      return false;
    }
    const current = this.squadMembers();
    if (current.some(m => m.toLowerCase() === trimmed.toLowerCase())) return false;
    this.setSquadMembers([...current, trimmed]);
    return true;
  }

  removeSquadMember(login: string) {
    const target = (login || '').toLowerCase();
    this.setSquadMembers(this.squadMembers().filter(m => m.toLowerCase() !== target));
  }

  /**
   * Decide whether the alarm should fire given the failure's author/actor.
   * - solo:   only when the author equals `me`
   * - squad:  when author is `me` OR in the squad list
   * - chaos:  any failure triggers the alarm
   *
   * Returns false when audio is disabled regardless of mode.
   */
  shouldTriggerSound(failureActor: string | null | undefined, me: string | null | undefined): boolean {
    if (!this.audioEnabled()) return false;
    const mode = this.soundMode();
    if (mode === 'chaos') return true;
    const actor = (failureActor || '').toLowerCase();
    const meLower = (me || '').toLowerCase();
    if (!actor) return false;
    if (mode === 'solo') return !!meLower && actor === meLower;
    // squad
    if (meLower && actor === meLower) return true;
    return this.squadMembers().some(m => m.toLowerCase() === actor);
  }

  private load() {
    const audio = this.read(SquadService.KEY_AUDIO);
    if (audio !== null) {
      try {
        const v = JSON.parse(audio);
        if (typeof v === 'boolean') this.audioEnabled.set(v);
      } catch {
        // ignore malformed value
      }
    }
    const mode = this.read(SquadService.KEY_MODE);
    if (mode && SquadService.VALID_MODES.includes(mode as SoundMode)) {
      this.soundMode.set(mode as SoundMode);
    }
    const squad = this.read(SquadService.KEY_SQUAD);
    if (squad) {
      try {
        const parsed = JSON.parse(squad);
        if (Array.isArray(parsed)) {
          this.squadMembers.set(this.normalizeMembers(parsed));
        }
      } catch {
        // ignore malformed value
      }
    }
  }

  private normalizeMembers(members: unknown[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const m of members) {
      if (typeof m !== 'string') continue;
      const t = m.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  }

  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage not available
    }
  }
}
