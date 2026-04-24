import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { GithubService } from '../../core/github.service';
import { SettingsService } from '../../core/settings.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss'
})
export class SettingsComponent {
  private readonly settings = inject(SettingsService);
  private readonly github = inject(GithubService);

  @Output() saved = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly canCancel = signal(this.settings.isConfigured);

  readonly token = signal(this.settings.settings().token);
  readonly reposText = signal(SettingsService.formatRepoList(this.settings.settings().repos));
  readonly refreshSeconds = signal(this.settings.settings().refreshIntervalSeconds);

  readonly status = signal<'idle' | 'validating' | 'success' | 'error'>('idle');
  readonly errorMessage = signal('');
  readonly authenticatedAs = signal<string | null>(null);

  async save(): Promise<void> {
    const token = this.token().trim();
    const repos = SettingsService.parseRepoList(this.reposText());

    if (!token) {
      this.status.set('error');
      this.errorMessage.set('A GitHub Personal Access Token is required.');
      return;
    }
    if (repos.length === 0) {
      this.status.set('error');
      this.errorMessage.set('Add at least one repository in "owner/repo" format.');
      return;
    }

    this.status.set('validating');
    this.errorMessage.set('');

    try {
      const user = await firstValueFrom(this.github.validateToken(token));
      this.authenticatedAs.set(user.login);
      this.settings.update({
        token,
        repos,
        refreshIntervalSeconds: Math.max(15, Number(this.refreshSeconds()) || 60)
      });
      this.status.set('success');
      this.saved.emit();
    } catch (err: unknown) {
      this.status.set('error');
      const status = (err as { status?: number }).status;
      if (status === 401) {
        this.errorMessage.set('Authentication failed. Check that your token is valid and has the "repo" scope.');
      } else if (status === 0) {
        this.errorMessage.set('Network error reaching api.github.com.');
      } else {
        this.errorMessage.set(`GitHub API error (status ${status ?? 'unknown'}).`);
      }
    }
  }

  cancel(): void {
    this.cancelled.emit();
  }

  clearAll(): void {
    if (typeof window !== 'undefined' && !window.confirm('Clear stored token and repositories?')) {
      return;
    }
    this.settings.clear();
    this.token.set('');
    this.reposText.set('');
    this.refreshSeconds.set(60);
    this.canCancel.set(false);
    this.status.set('idle');
    this.errorMessage.set('');
    this.authenticatedAs.set(null);
  }
}
