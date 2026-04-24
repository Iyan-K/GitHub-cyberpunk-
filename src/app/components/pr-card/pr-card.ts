import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PullRequest } from '../../models/github.models';

@Component({
  selector: 'app-pr-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pr-card.html',
  styleUrl: './pr-card.scss'
})
export class PrCardComponent {
  @Input() pr!: PullRequest;

  getStatusClass(): string {
    if (this.pr.draft) return 'draft';
    if (this.pr.state === 'closed') return 'closed';
    return 'open';
  }

  getStatusLabel(): string {
    if (this.pr.draft) return 'DRAFT';
    if (this.pr.state === 'closed') return 'CLOSED';
    return 'OPEN';
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
}
