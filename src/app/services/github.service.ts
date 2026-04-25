import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, interval, switchMap, startWith, catchError, of } from 'rxjs';
import { PullRequest, WorkflowRun, GithubConfig } from '../models/github.models';

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
    );
  }

  getWorkflowRuns(owner: string, repo: string): Observable<{ workflow_runs: WorkflowRun[] }> {
    return this.http.get<{ workflow_runs: WorkflowRun[] }>(
      `${this.apiBase}/repos/${owner}/${repo}/actions/runs?per_page=10`,
      { headers: this.getHeaders() }
    );
  }

  validateConnection(owner: string, repo: string): Observable<{ valid: boolean; error?: string }> {
    return this.http.get(
      `${this.apiBase}/repos/${owner}/${repo}`,
      { headers: this.getHeaders() }
    ).pipe(
      switchMap(() => of({ valid: true })),
      catchError((err: HttpErrorResponse) => of({ valid: false, error: this.formatApiError(err) }))
    );
  }

  formatApiError(err: HttpErrorResponse): string {
    if (err.status === 401) {
      return 'Invalid or expired token. Please check your GitHub token.';
    }
    if (err.status === 403) {
      return 'Access denied (403). If this is an organization repo, ensure your token has been granted access to the organization. For classic tokens, authorize SSO if the org requires it. For fine-grained tokens, select the organization as the resource owner when creating the token.';
    }
    if (err.status === 404) {
      return 'Repository not found (404). Check the owner/repo name, or ensure your token has access to this private repository. For organization repos, the token must be authorized for that organization.';
    }
    if (err.status === 0) {
      return 'Network error. Check your internet connection.';
    }
    return `GitHub API error (${err.status}): ${err.message || 'Unknown error'}`;
  }

  pollPullRequests(owner: string, repo: string, intervalMs = 30000): Observable<PullRequest[] | { error: string }> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getPullRequests(owner, repo).pipe(
        catchError((err: HttpErrorResponse) => of({ error: this.formatApiError(err) } as { error: string }))
      ))
    );
  }

  pollWorkflowRuns(owner: string, repo: string, intervalMs = 30000): Observable<{ workflow_runs: WorkflowRun[] } | { error: string }> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.getWorkflowRuns(owner, repo).pipe(
        catchError((err: HttpErrorResponse) => of({ error: this.formatApiError(err) } as { error: string }))
      ))
    );
  }
}
