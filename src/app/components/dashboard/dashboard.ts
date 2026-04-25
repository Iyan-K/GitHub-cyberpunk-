import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { GithubService } from '../../services/github.service';
import { AlertService } from '../../services/alert.service';
import { PullRequest, WorkflowRun, GithubConfig } from '../../models/github.models';
import { P5CanvasComponent } from '../p5-canvas/p5-canvas';
import { PrCardComponent } from '../pr-card/pr-card';
import { BuildCardComponent } from '../build-card/build-card';
import { ConfigModalComponent } from '../config-modal/config-modal';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, P5CanvasComponent, PrCardComponent, BuildCardComponent, ConfigModalComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private githubService = inject(GithubService);
  private alertService = inject(AlertService);

  pullRequests = signal<PullRequest[]>([]);
  workflowRuns = signal<WorkflowRun[]>([]);
  loading = signal(false);
  error = signal('');
  showConfig = signal(false);
  lastUpdated = signal<Date | null>(null);
  config = signal<GithubConfig | null>(null);

  criticalAlert = this.alertService.criticalAlert;

  openPRs = computed(() => this.pullRequests().filter(pr => pr.state === 'open' && !pr.draft));
  draftPRs = computed(() => this.pullRequests().filter(pr => pr.draft));
  closedPRs = computed(() => this.pullRequests().filter(pr => pr.state === 'closed'));
  failedBuilds = computed(() => this.workflowRuns().filter(r => r.conclusion === 'failure'));
  successBuilds = computed(() => this.workflowRuns().filter(r => r.conclusion === 'success'));
  runningBuilds = computed(() => this.workflowRuns().filter(r => r.status === 'in_progress'));

  private subs: Subscription[] = [];

  currentTime = signal(new Date());
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.clockInterval = setInterval(() => this.currentTime.set(new Date()), 1000);
    this.showConfig.set(true);
  }

  ngOnDestroy() {
    this.subs.forEach(s => s.unsubscribe());
    if (this.clockInterval) clearInterval(this.clockInterval);
    this.alertService.clearCriticalAlert();
  }

  onConfigSaved(cfg: GithubConfig) {
    this.config.set(cfg);
    this.githubService.setConfig(cfg);
    this.showConfig.set(false);
    this.startPolling(cfg.owner, cfg.repo);
  }

  onConfigCancelled() {
    if (this.config()) {
      this.showConfig.set(false);
    }
  }

  openConfig() {
    this.showConfig.set(true);
  }

  dismissAlert() {
    this.alertService.clearCriticalAlert();
  }

  private startPolling(owner: string, repo: string) {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.loading.set(true);
    this.error.set('');

    const prSub = this.githubService.pollPullRequests(owner, repo, 30000).subscribe({
      next: prs => {
        this.pullRequests.set(prs);
        this.lastUpdated.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to fetch pull requests');
        this.loading.set(false);
      }
    });

    const buildSub = this.githubService.pollWorkflowRuns(owner, repo, 30000).subscribe({
      next: data => {
        this.workflowRuns.set(data.workflow_runs || []);
        this.lastUpdated.set(new Date());
        this.loading.set(false);
        this.checkForFailures(data.workflow_runs || []);
      },
      error: () => {
        this.error.set('Failed to fetch workflow runs');
        this.loading.set(false);
      }
    });

    this.subs.push(prSub, buildSub);
  }

  private lastFailureState = false;

  private checkForFailures(runs: WorkflowRun[]) {
    const hasFailure = runs.some(r => r.conclusion === 'failure');
    if (hasFailure === this.lastFailureState) return;
    this.lastFailureState = hasFailure;
    if (hasFailure) {
      this.alertService.triggerCriticalAlert();
    } else {
      this.alertService.clearCriticalAlert();
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }
}
