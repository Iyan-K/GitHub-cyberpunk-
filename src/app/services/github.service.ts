import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { PullRequest, WorkflowRun, GithubConfig } from '../models/github.models';

@Injectable({ providedIn: 'root' })
export class GithubService {
  private apiBase = 'https://api.github.com';
  private config = signal<GithubConfig | null>(null);

  constructor(private http: HttpClient) {}

  setConfig(config: GithubConfig) {
    this.config.set(config);
  }

  getConfig() {
    return this.config();
  }

  private getHeaders(): HttpHeaders {
    const cfg = this.config();
    if (cfg?.token) {
      return new HttpHeaders({ 'Authorization': `token ${cfg.token}` });
    }
    return new HttpHeaders();
  }

  getPullRequests(owner: string, repo: string): Observable<PullRequest[]> {
    return this.http.get<PullRequest[]>(
      `${this.apiBase}/repos/${owner}/${repo}/pulls?state=all&per_page=20&sort=updated`,
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
}
