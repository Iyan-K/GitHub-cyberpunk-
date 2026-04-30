import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkflowRun } from '../../models/github.models';

@Component({
  selector: 'app-build-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './build-card.html',
  styleUrl: './build-card.scss'
})
export class BuildCardComponent {
  @Input() run!: WorkflowRun;
  @Output() inspect = new EventEmitter<WorkflowRun>();

  getStatusClass(): string {
    if (this.run.status === 'in_progress' || this.run.status === 'queued') return 'running';
    if (this.run.conclusion === 'success') return 'success';
    if (this.run.conclusion === 'failure') return 'failure';
    if (this.run.conclusion === 'cancelled') return 'cancelled';
    return 'unknown';
  }

  getStatusIcon(): string {
    const s = this.getStatusClass();
    if (s === 'success') return '✓';
    if (s === 'failure') return '✗';
    if (s === 'running') return '⟳';
    if (s === 'cancelled') return '⊘';
    return '?';
  }

  getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (days > 0) return `${days}d ago`;
    if (hrs > 0) return `${hrs}h ago`;
    return `${mins}m ago`;
  }

  /**
   * For failed runs, intercept the click to open the in-app diagnostics modal.
   * Modifier-click (ctrl/cmd/middle-button/shift) keeps the native anchor
   * behavior so the user can still jump straight to GitHub when they want.
   */
  onClick(event: MouseEvent) {
    const isFailure = this.getStatusClass() === 'failure';
    if (!isFailure) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (event.button !== 0) return;
    event.preventDefault();
    this.inspect.emit(this.run);
  }
}
