import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { PullRequest, WorkflowRun, WorkflowJob, GithubConfig } from '../models/github.models';

@Injectable({ providedIn: 'root' })
export class GithubService {
  private apiBase = 'https://api.github.com';
  private config = signal<GithubConfig | null>(null);
  private static readonly STORAGE_KEY = 'cyberhub_config';

  constructor(private http: HttpClient) {}

  setConfig(config: GithubConfig) {
    this.config.set(config);
    this.saveConfigToStorage(config);
  }

  getConfig() {
    return this.config();
  }

  loadSavedConfig(): GithubConfig | null {
    try {
      const saved = localStorage.getItem(GithubService.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed === 'object' && parsed !== null &&
          typeof parsed.owner === 'string' && parsed.owner.length > 0 &&
          typeof parsed.repo === 'string' && parsed.repo.length > 0 &&
          (typeof parsed.token === 'string' || parsed.token === undefined)
        ) {
          const config: GithubConfig = {
            token: typeof parsed.token === 'string' ? parsed.token : '',
            owner: parsed.owner,
            repo: parsed.repo,
          };
          this.config.set(config);
          return config;
        }
      }
    } catch {
      // Ignore invalid stored data
    }
    return null;
  }

  clearConfig() {
    this.config.set(null);
    try {
      localStorage.removeItem(GithubService.STORAGE_KEY);
    } catch {
      // Storage not available
    }
  }

  private saveConfigToStorage(config: GithubConfig) {
    try {
      localStorage.setItem(GithubService.STORAGE_KEY, JSON.stringify(config));
    } catch {
      // Storage not available
    }
  }

  private getHeaders(): HttpHeaders {
    const cfg = this.config();
    if (cfg?.token) {
      return new HttpHeaders({ 'Authorization': `Bearer ${cfg.token}` });
    }
    return new HttpHeaders();
  }

  getAuthenticatedUser(): Observable<{ login: string } | null> {
    const cfg = this.config();
    if (!cfg?.token) {
      return of(null);
    }
    return this.http.get<{ login: string }>(
      `${this.apiBase}/user`,
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of(null)));
  }

  getPullRequests(owner: string, repo: string): Observable<PullRequest[]> {
    return this.http.get<PullRequest[]>(
      `${this.apiBase}/repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=updated`,
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of([])));
  }

  getWorkflowRuns(owner: string, repo: string): Observable<{ workflow_runs: WorkflowRun[] }> {
    return this.http.get<{ workflow_runs: WorkflowRun[] }>(
      `${this.apiBase}/repos/${owner}/${repo}/actions/runs?per_page=10`,
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of({ workflow_runs: [] })));
  }

  pollPullRequests(owner: string, repo: string, intervalMs = 30000): Observable<PullRequest[]> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getPullRequests(owner, repo))
    );
  }

  pollWorkflowRuns(owner: string, repo: string, intervalMs = 30000): Observable<{ workflow_runs: WorkflowRun[] }> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getWorkflowRuns(owner, repo))
    );
  }

  getWorkflowRunJobs(owner: string, repo: string, runId: number): Observable<{ jobs: WorkflowJob[] }> {
    return this.http.get<{ jobs: WorkflowJob[] }>(
      `${this.apiBase}/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`,
      { headers: this.getHeaders() }
    ).pipe(catchError(() => of({ jobs: [] })));
  }
}
