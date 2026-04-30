import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GithubService } from '../../services/github.service';
import { LlmService } from '../../services/llm.service';
import { GithubConfig, WorkflowJob, WorkflowRun } from '../../models/github.models';

interface FixerBriefState {
  loading: boolean;
  brief: string;
  error: string;
}

@Component({
  selector: 'app-build-log-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './build-log-modal.html',
  styleUrl: './build-log-modal.scss'
})
export class BuildLogModalComponent implements OnChanges {
  @Input() run: WorkflowRun | null = null;
  @Input() config: GithubConfig | null = null;
  @Output() closed = new EventEmitter<void>();

  private githubService = inject(GithubService);
  private llmService = inject(LlmService);

  jobs = signal<WorkflowJob[]>([]);
  loading = signal(false);
  error = signal('');

  /**
   * Per-job state for the "Fixer's Brief" feature. Keyed by job id so each
   * failed job can be briefed independently and we can show separate
   * loading/error/result states.
   */
  briefs = signal<Record<number, FixerBriefState>>({});

  ngOnChanges(changes: SimpleChanges) {
    if ('run' in changes) {
      this.briefs.set({});
      this.fetchJobs();
    }
  }

  close() {
    this.closed.emit();
  }

  /**
   * Backdrop click closes; clicks on the panel itself do not.
   */
  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  /**
   * Steps that did not succeed — these are what we want to highlight as the
   * likely "where it broke" lines from the run.
   */
  failedSteps(job: WorkflowJob) {
    return (job.steps || []).filter(s =>
      s.conclusion &&
      s.conclusion !== 'success' &&
      s.conclusion !== 'skipped' &&
      s.conclusion !== 'neutral'
    );
  }

  isJobFailed(job: WorkflowJob): boolean {
    return job.conclusion === 'failure' || job.conclusion === 'cancelled' || job.conclusion === 'timed_out';
  }

  /** True when the user has supplied LLM credentials in CONFIG. */
  llmConfigured(): boolean {
    return this.llmService.isConfigured();
  }

  /** Read-only state for the per-job Fixer's Brief. */
  briefFor(jobId: number): FixerBriefState {
    return this.briefs()[jobId] || { loading: false, brief: '', error: '' };
  }

  /**
   * Fetch the job's logs from GitHub and pipe them into the LLM to produce
   * a cyberpunk-Fixer-style briefing on why the build flatlined.
   */
  requestBrief(job: WorkflowJob) {
    const cfg = this.config;
    if (!cfg) return;
    if (!this.llmService.isConfigured()) {
      this.setBrief(job.id, {
        loading: false,
        brief: '',
        error: 'NO LLM CREDS — JACK INTO CONFIG TO HIRE A FIXER',
      });
      return;
    }

    this.setBrief(job.id, { loading: true, brief: '', error: '' });

    this.githubService.getJobLogs(cfg.owner, cfg.repo, job.id).subscribe({
      next: (logs) => {
        // Fall back to a synthetic "log" built from step metadata when the
        // raw log endpoint is unreachable (e.g. token without `actions:read`).
        const errorText = logs && logs.length > 0
          ? logs
          : this.synthesiseLogFromSteps(job);

        if (!errorText.trim()) {
          this.setBrief(job.id, {
            loading: false,
            brief: '',
            error: 'NO LOG DATA — TOKEN MAY LACK actions:read SCOPE',
          });
          return;
        }

        this.llmService.generateFixerBrief(errorText).subscribe({
          next: (res) => this.setBrief(job.id, { loading: false, brief: res.summary, error: '' }),
          error: (err) => this.setBrief(job.id, {
            loading: false,
            brief: '',
            error: 'FIXER UNREACHABLE — ' + (err?.message || 'LLM CALL FAILED'),
          }),
        });
      },
      error: () => {
        this.setBrief(job.id, {
          loading: false,
          brief: '',
          error: 'SIGNAL LOST — UNABLE TO PULL LOGS',
        });
      },
    });
  }

  /** Clear an existing briefing so the user can request a fresh one. */
  clearBrief(jobId: number) {
    const next = { ...this.briefs() };
    delete next[jobId];
    this.briefs.set(next);
  }

  private setBrief(jobId: number, state: FixerBriefState) {
    this.briefs.set({ ...this.briefs(), [jobId]: state });
  }

  /**
   * When the raw logs endpoint is unavailable we still want to give the LLM
   * something useful to chew on, so we build a concise "log-like" summary
   * from the failed steps' names + conclusions.
   */
  private synthesiseLogFromSteps(job: WorkflowJob): string {
    const lines: string[] = [];
    lines.push(`Job: ${job.name}`);
    lines.push(`Status: ${job.status}`);
    lines.push(`Conclusion: ${job.conclusion ?? 'unknown'}`);
    lines.push('');
    lines.push('Steps:');
    for (const step of job.steps || []) {
      const tag = step.conclusion ?? step.status ?? 'unknown';
      lines.push(`  #${step.number} [${tag}] ${step.name}`);
    }
    return lines.join('\n');
  }

  private fetchJobs() {
    const run = this.run;
    const cfg = this.config;
    if (!run || !cfg) {
      this.jobs.set([]);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.jobs.set([]);
    this.githubService.getWorkflowRunJobs(cfg.owner, cfg.repo, run.id).subscribe({
      next: (data) => {
        this.jobs.set(data.jobs || []);
        this.loading.set(false);
        if (!data.jobs || data.jobs.length === 0) {
          this.error.set('NO JOB DATA AVAILABLE — CHECK TOKEN PERMISSIONS');
        }
      },
      error: () => {
        this.loading.set(false);
        this.error.set('SIGNAL LOST — UNABLE TO FETCH JOB DIAGNOSTICS');
      }
    });
  }
}
