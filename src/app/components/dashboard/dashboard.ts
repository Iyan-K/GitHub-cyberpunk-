import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { GithubService } from '../../services/github.service';
import { AlertService } from '../../services/alert.service';
import { SquadService } from '../../services/squad.service';
import { PullRequest, WorkflowRun, GithubConfig } from '../../models/github.models';
import { P5CanvasComponent } from '../p5-canvas/p5-canvas';
import { PrCardComponent } from '../pr-card/pr-card';
import { BuildCardComponent } from '../build-card/build-card';
import { ConfigModalComponent } from '../config-modal/config-modal';
import { BuildLogModalComponent } from '../build-log-modal/build-log-modal';
import { SquadModalComponent } from '../squad-modal/squad-modal';
import { OverheatGaugeComponent } from '../overheat-gauge/overheat-gauge';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    P5CanvasComponent, PrCardComponent, BuildCardComponent,
    ConfigModalComponent, BuildLogModalComponent, SquadModalComponent,
    OverheatGaugeComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  private githubService = inject(GithubService);
  private alertService = inject(AlertService);
  private squadService = inject(SquadService);

  static readonly FILTER_ME = '__me__';
  static readonly FILTER_ALL = '__all__';

  pullRequests = signal<PullRequest[]>([]);
  workflowRuns = signal<WorkflowRun[]>([]);
  loading = signal(false);
  error = signal('');
  showConfig = signal(false);
  showSquad = signal(false);
  inspectedRun = signal<WorkflowRun | null>(null);
  lastUpdated = signal<Date | null>(null);
  config = signal<GithubConfig | null>(null);
  authenticatedUser = signal<string | null>(null);
  selectedAuthor = signal<string>(DashboardComponent.FILTER_ME);

  criticalAlert = this.alertService.criticalAlert;
  soundMode = this.squadService.soundMode;
  audioEnabled = this.squadService.audioEnabled;

  filteredPRs = computed(() => {
    const prs = this.pullRequests();
    const author = this.selectedAuthor();
    const me = this.authenticatedUser();

    if (author === DashboardComponent.FILTER_ALL) return prs;
    if (author === DashboardComponent.FILTER_ME && me) return prs.filter(pr => pr.user.login === me);
    if (author === DashboardComponent.FILTER_ME && !me) return prs;
    return prs.filter(pr => pr.user.login === author);
  });

  uniqueAuthors = computed(() => {
    const authors = new Set(this.pullRequests().map(pr => pr.user.login));
    return Array.from(authors).sort((a, b) => a.localeCompare(b));
  });

  openPRs = computed(() => this.filteredPRs().filter(pr => pr.state === 'open' && !pr.draft));
  draftPRs = computed(() => this.filteredPRs().filter(pr => pr.draft));
  closedPRs = computed(() => this.filteredPRs().filter(pr => pr.state === 'closed'));
  failedBuilds = computed(() => this.workflowRuns().filter(r => r.conclusion === 'failure'));
  successBuilds = computed(() => this.workflowRuns().filter(r => r.conclusion === 'success'));
  runningBuilds = computed(() => this.workflowRuns().filter(r => r.status === 'in_progress'));

  private subs: Subscription[] = [];

  currentTime = signal(new Date());
  private clockInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.clockInterval = setInterval(() => this.currentTime.set(new Date()), 1000);

    const saved = this.githubService.loadSavedConfig();
    if (saved) {
      this.config.set(saved);
      this.githubService.setConfig(saved);
      this.showConfig.set(false);
      this.fetchAuthenticatedUser();
      this.startPolling(saved.owner, saved.repo);
    } else {
      this.showConfig.set(true);
    }
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
    this.fetchAuthenticatedUser();
    this.startPolling(cfg.owner, cfg.repo);
  }

  logout() {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.githubService.clearConfig();
    this.config.set(null);
    this.pullRequests.set([]);
    this.workflowRuns.set([]);
    this.loading.set(false);
    this.error.set('');
    this.authenticatedUser.set(null);
    this.selectedAuthor.set(DashboardComponent.FILTER_ME);
    this.lastUpdated.set(null);
    this.alertService.clearCriticalAlert();
    this.showConfig.set(false);
    this.inspectedRun.set(null);
    this.knownFailureIds.clear();
    this.lastFailureState = false;
  }

  onConfigCancelled() {
    if (this.config()) {
      this.showConfig.set(false);
    }
  }

  openConfig() {
    this.showConfig.set(true);
  }

  openSquadSettings() {
    this.showSquad.set(true);
  }

  closeSquadSettings() {
    this.showSquad.set(false);
  }

  inspectBuild(run: WorkflowRun) {
    this.inspectedRun.set(run);
  }

  closeInspect() {
    this.inspectedRun.set(null);
  }

  dismissAlert() {
    this.alertService.clearCriticalAlert();
  }

  onAuthorFilterChange(value: string) {
    this.selectedAuthor.set(value);
  }

  soundModeLabel(): string {
    switch (this.soundMode()) {
      case 'solo':  return 'SOLO';
      case 'squad': return 'SQUAD';
      case 'chaos': return 'CHAOS';
    }
  }

  private fetchAuthenticatedUser() {
    this.githubService.getAuthenticatedUser().subscribe(user => {
      if (user?.login) {
        this.authenticatedUser.set(user.login);
      } else {
        this.authenticatedUser.set(null);
        if (this.selectedAuthor() === DashboardComponent.FILTER_ME) {
          this.selectedAuthor.set(DashboardComponent.FILTER_ALL);
        }
      }
    });
  }

  private startPolling(owner: string, repo: string) {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.knownFailureIds.clear();
    this.lastFailureState = false;
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
  /**
   * Tracks failure run-ids we've already evaluated, so the alarm only fires
   * the first time a particular failure is observed (i.e. when a *new* failure
   * arrives) rather than on every poll while it remains red.
   */
  private knownFailureIds = new Set<number>();

  private checkForFailures(runs: WorkflowRun[]) {
    const failures = runs.filter(r => r.conclusion === 'failure');
    const hasFailure = failures.length > 0;

    // Always keep the visual "critical" state in sync with whether the repo
    // currently has any failed runs — regardless of who triggered them.
    if (hasFailure !== this.lastFailureState) {
      this.lastFailureState = hasFailure;
      if (!hasFailure) {
        this.alertService.clearCriticalAlert();
        this.knownFailureIds.clear();
        return;
      }
    }

    if (!hasFailure) return;

    // Determine if any *newly-observed* failure should trigger the audio alarm
    // based on the user's Comms Filter mode.
    const me = this.authenticatedUser();
    let triggerAudio = false;
    let visualOnly = false;
    for (const run of failures) {
      if (this.knownFailureIds.has(run.id)) continue;
      this.knownFailureIds.add(run.id);
      const actor = run.actor?.login || run.triggering_actor?.login || null;
      if (this.squadService.shouldTriggerSound(actor, me)) {
        triggerAudio = true;
      } else {
        visualOnly = true;
      }
    }

    if (triggerAudio) {
      this.alertService.triggerCriticalAlert();
    } else if (visualOnly) {
      this.alertService.showVisualAlert();
    }
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }
}
