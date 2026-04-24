import { Injectable, signal } from '@angular/core';
import { DashboardSettings, RepoRef } from './models';

const STORAGE_KEY = 'cyberpunk-dashboard.settings.v1';

const DEFAULT_SETTINGS: DashboardSettings = {
  token: '',
  repos: [],
  refreshIntervalSeconds: 60
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly _settings = signal<DashboardSettings>(this.load());
  readonly settings = this._settings.asReadonly();

  get isConfigured(): boolean {
    const s = this._settings();
    return s.token.trim().length > 0 && s.repos.length > 0;
  }

  update(partial: Partial<DashboardSettings>): void {
    const next: DashboardSettings = { ...this._settings(), ...partial };
    this._settings.set(next);
    this.persist(next);
  }

  setRepos(repos: RepoRef[]): void {
    this.update({ repos });
  }

  clear(): void {
    this._settings.set({ ...DEFAULT_SETTINGS });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  /**
   * Parse a textarea-style list of "owner/repo" entries (one per line, or comma-separated).
   * Invalid lines are silently dropped.
   */
  static parseRepoList(raw: string): RepoRef[] {
    return raw
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => {
        const match = /^([^/\s]+)\/([^/\s]+?)(?:\.git)?$/.exec(line);
        if (!match) {
          return null;
        }
        return { owner: match[1], repo: match[2] } satisfies RepoRef;
      })
      .filter((value): value is RepoRef => value !== null);
  }

  static formatRepoList(repos: RepoRef[]): string {
    return repos.map((r) => `${r.owner}/${r.repo}`).join('\n');
  }

  private load(): DashboardSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { ...DEFAULT_SETTINGS };
      }
      const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
      return {
        token: typeof parsed.token === 'string' ? parsed.token : '',
        repos: Array.isArray(parsed.repos) ? parsed.repos.filter((r) => r && r.owner && r.repo) : [],
        refreshIntervalSeconds:
          typeof parsed.refreshIntervalSeconds === 'number' && parsed.refreshIntervalSeconds >= 15
            ? parsed.refreshIntervalSeconds
            : DEFAULT_SETTINGS.refreshIntervalSeconds
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private persist(settings: DashboardSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore quota/SSR errors
    }
  }
}
