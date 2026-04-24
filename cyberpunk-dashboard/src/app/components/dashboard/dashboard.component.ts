import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  OnInit,
  Output,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Subject, Subscription, switchMap, timer } from 'rxjs';
import { GithubService } from '../../core/github.service';
import { SettingsService } from '../../core/settings.service';
import { AlarmService } from '../../core/alarm.service';
import { AlertStateService } from '../../core/alert-state.service';
import { PullRequestSummary } from '../../core/models';
import { PrCardComponent } from '../pr-card/pr-card.component';
import { CriticalAlertComponent } from '../critical-alert/critical-alert.component';

type SortMode = 'updated' | 'failures' | 'oldest';
type FilterMode = 'all' | 'failing' | 'mine';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, PrCardComponent, CriticalAlertComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  private readonly github = inject(GithubService);
  private readonly settingsSvc = inject(SettingsService);
  readonly alarm = inject(AlarmService);
  private readonly alertState = inject(AlertStateService);
  private readonly destroyRef = inject(DestroyRef);

  @Output() openSettings = new EventEmitter<void>();

  readonly pullRequests = signal<PullRequestSummary[]>([]);
  readonly loading = signal<boolean>(false);
  readonly lastUpdated = signal<Date | null>(null);
  readonly errorMessage = signal<string>('');

  readonly sortMode = signal<SortMode>('updated');
  readonly filterMode = signal<FilterMode>('all');

  readonly settings = this.settingsSvc.settings;

  readonly failingPrs = computed(() =>
    this.pullRequests().filter((pr) => pr.buildState === 'failure')
  );
  readonly criticalAlert = computed(() => this.failingPrs().length > 0);
  readonly visiblePrs = computed(() => {
    const filter = this.filterMode();
    let prs = this.pullRequests();
    if (filter === 'failing') {
      prs = prs.filter((pr) => pr.buildState === 'failure');
    }
    const sort = this.sortMode();
    const sorted = [...prs];
    if (sort === 'updated') {
      sorted.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    } else if (sort === 'oldest') {
      sorted.sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    } else if (sort === 'failures') {
      sorted.sort((a, b) => stateRank(b.buildState) - stateRank(a.buildState));
    }
    return sorted;
  });

  readonly summary = computed(() => {
    const prs = this.pullRequests();
    return {
      total: prs.length,
      failing: prs.filter((p) => p.buildState === 'failure').length,
      passing: prs.filter((p) => p.buildState === 'success').length,
      pending: prs.filter((p) => p.buildState === 'pending').length
    };
  });

  private readonly refreshTrigger = new Subject<void>();
  private pollSub?: Subscription;

  constructor() {
    // Drive the alarm service and shared alert state from the critical-alert signal.
    effect(() => {
      const failing = this.failingPrs().length;
      const active = failing > 0;
      this.alertState.set(active, failing);
      if (active) {
        this.alarm.start();
      } else {
        this.alarm.stop();
      }
    });
  }

  ngOnInit(): void {
    this.startPolling();
  }

  refreshNow(): void {
    this.refreshTrigger.next();
  }

  setSort(mode: SortMode): void {
    this.sortMode.set(mode);
  }

  setFilter(mode: FilterMode): void {
    this.filterMode.set(mode);
  }

  toggleMute(): void {
    this.alarm.toggleMuted();
    if (this.alarm.muted()) {
      this.alarm.stop();
    } else if (this.criticalAlert()) {
      this.alarm.start();
    }
  }

  trackPr = (_: number, pr: PullRequestSummary) => pr.id;

  private startPolling(): void {
    this.pollSub?.unsubscribe();
    const intervalMs = Math.max(15, this.settingsSvc.settings().refreshIntervalSeconds) * 1000;

    // Combine an interval timer with manual refresh triggers.
    const interval$ = timer(0, intervalMs);
    this.pollSub = interval$
      .pipe(
        switchMap(() => {
          this.loading.set(true);
          this.errorMessage.set('');
          return this.github.fetchAllPullRequests();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (prs) => {
          this.pullRequests.set(prs);
          this.lastUpdated.set(new Date());
          this.loading.set(false);
        },
        error: (err) => {
          console.error('[dashboard] polling error', err);
          this.errorMessage.set('Failed to fetch pull requests. Check token and network.');
          this.loading.set(false);
        }
      });

    this.refreshTrigger.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loading.set(true);
      this.github.fetchAllPullRequests().subscribe({
        next: (prs) => {
          this.pullRequests.set(prs);
          this.lastUpdated.set(new Date());
          this.loading.set(false);
        },
        error: () => this.loading.set(false)
      });
    });
  }
}

function stateRank(state: PullRequestSummary['buildState']): number {
  switch (state) {
    case 'failure':
      return 3;
    case 'pending':
      return 2;
    case 'unknown':
      return 1;
    case 'success':
    default:
      return 0;
  }
}
