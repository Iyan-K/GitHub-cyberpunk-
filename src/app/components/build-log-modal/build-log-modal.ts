import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GithubService } from '../../services/github.service';
import { GithubConfig, WorkflowJob, WorkflowRun } from '../../models/github.models';

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

  jobs = signal<WorkflowJob[]>([]);
  loading = signal(false);
  error = signal('');

  ngOnChanges(changes: SimpleChanges) {
    if ('run' in changes) {
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
