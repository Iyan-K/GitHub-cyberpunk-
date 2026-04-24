import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PullRequestSummary } from '../../core/models';

@Component({
  selector: 'app-pr-card',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pr-card.component.html',
  styleUrl: './pr-card.component.scss'
})
export class PrCardComponent {
  private readonly _pr = signal<PullRequestSummary | null>(null);

  @Input({ required: true })
  set pr(value: PullRequestSummary) {
    this._pr.set(value);
  }
  get pr(): PullRequestSummary {
    return this._pr() as PullRequestSummary;
  }

  readonly buildLabel = computed(() => {
    const state = this._pr()?.buildState;
    switch (state) {
      case 'success':
        return 'BUILD OK';
      case 'failure':
        return 'BUILD FAIL';
      case 'pending':
        return 'BUILD…';
      default:
        return 'NO CHECKS';
    }
  });

  readonly age = computed(() => {
    const pr = this._pr();
    if (!pr) {
      return '';
    }
    return formatRelative(new Date(pr.updatedAt));
  });

  trackCheck = (_: number, c: { name: string }) => c.name;
}

function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) {
    return `${sec}s ago`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  const days = Math.floor(hr / 24);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
