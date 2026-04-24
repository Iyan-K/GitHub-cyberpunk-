import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, from, of } from 'rxjs';
import { catchError, map, mergeMap, switchMap, toArray } from 'rxjs/operators';
import {
  AggregatedBuildState,
  CheckRunSummary,
  PullRequestSummary,
  RepoRef
} from './models';
import { SettingsService } from './settings.service';

const API_BASE = 'https://api.github.com';

interface GhUser {
  login: string;
  avatar_url: string;
}

interface GhPullRequestListItem {
  id: number;
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  user: GhUser | null;
  created_at: string;
  updated_at: string;
  head: { ref: string; sha: string };
  base: { ref: string };
  comments?: number;
  review_comments?: number;
}

interface GhPullRequestDetail extends GhPullRequestListItem {
  additions: number;
  deletions: number;
  changed_files: number;
  comments: number;
  review_comments: number;
  mergeable: boolean | null;
}

interface GhCheckRun {
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'pending' | 'waiting';
  conclusion:
    | 'success'
    | 'failure'
    | 'neutral'
    | 'cancelled'
    | 'skipped'
    | 'timed_out'
    | 'action_required'
    | 'stale'
    | 'startup_failure'
    | null;
  html_url: string;
}

interface GhCheckRunsResponse {
  total_count: number;
  check_runs: GhCheckRun[];
}

@Injectable({ providedIn: 'root' })
export class GithubService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  /**
   * Fetch the authenticated user — used to validate the personal access token.
   */
  validateToken(token: string): Observable<{ login: string; avatarUrl: string }> {
    return this.http
      .get<GhUser>(`${API_BASE}/user`, { headers: this.buildHeaders(token) })
      .pipe(map((u) => ({ login: u.login, avatarUrl: u.avatar_url })));
  }

  /**
   * Fetch all open PRs from every configured repo, enriched with check runs.
   */
  fetchAllPullRequests(): Observable<PullRequestSummary[]> {
    const { token, repos } = this.settings.settings();
    if (!token || repos.length === 0) {
      return of([]);
    }
    const headers = this.buildHeaders(token);

    return forkJoin(
      repos.map((repo) =>
        this.fetchRepoPullRequests(repo, headers).pipe(
          catchError((err: HttpErrorResponse) => {
            console.error(`[github] Failed to fetch PRs for ${repo.owner}/${repo.repo}`, err);
            return of<PullRequestSummary[]>([]);
          })
        )
      )
    ).pipe(map((groups) => groups.flat().sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))));
  }

  private fetchRepoPullRequests(
    repo: RepoRef,
    headers: HttpHeaders
  ): Observable<PullRequestSummary[]> {
    const url = `${API_BASE}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.repo
    )}/pulls?state=open&per_page=50&sort=updated&direction=desc`;

    return this.http.get<GhPullRequestListItem[]>(url, { headers }).pipe(
      switchMap((list) => {
        if (list.length === 0) {
          return of<PullRequestSummary[]>([]);
        }
        // Limit concurrent enrichment requests to avoid hammering the API.
        return from(list).pipe(
          mergeMap((pr) => this.enrichPullRequest(repo, pr, headers), 4),
          toArray()
        );
      })
    );
  }

  private enrichPullRequest(
    repo: RepoRef,
    pr: GhPullRequestListItem,
    headers: HttpHeaders
  ): Observable<PullRequestSummary> {
    const detailUrl = `${API_BASE}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.repo
    )}/pulls/${pr.number}`;
    const checksUrl = `${API_BASE}/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(
      repo.repo
    )}/commits/${pr.head.sha}/check-runs?per_page=50`;

    const detail$ = this.http
      .get<GhPullRequestDetail>(detailUrl, { headers })
      .pipe(catchError(() => of<GhPullRequestDetail | null>(null)));

    const checks$ = this.http
      .get<GhCheckRunsResponse>(checksUrl, {
        headers: headers.set('Accept', 'application/vnd.github.v3+json')
      })
      .pipe(
        map((res) => res.check_runs ?? []),
        catchError(() => of<GhCheckRun[]>([]))
      );

    return forkJoin({ detail: detail$, checks: checks$ }).pipe(
      map(({ detail, checks }) => this.toSummary(repo, pr, detail, checks))
    );
  }

  private toSummary(
    repo: RepoRef,
    pr: GhPullRequestListItem,
    detail: GhPullRequestDetail | null,
    checks: GhCheckRun[]
  ): PullRequestSummary {
    const checkSummaries: CheckRunSummary[] = checks.map((c) => ({
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      htmlUrl: c.html_url
    }));

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      htmlUrl: pr.html_url,
      state: pr.state,
      draft: pr.draft,
      authorLogin: pr.user?.login ?? 'unknown',
      authorAvatar: pr.user?.avatar_url ?? '',
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      baseRef: pr.base.ref,
      repo,
      additions: detail?.additions ?? null,
      deletions: detail?.deletions ?? null,
      changedFiles: detail?.changed_files ?? null,
      comments: detail?.comments ?? pr.comments ?? 0,
      reviewComments: detail?.review_comments ?? pr.review_comments ?? 0,
      mergeable: detail?.mergeable ?? null,
      checks: checkSummaries,
      buildState: aggregateBuildState(checkSummaries)
    };
  }

  private buildHeaders(token: string): HttpHeaders {
    return new HttpHeaders({
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28'
    });
  }
}

export function aggregateBuildState(checks: CheckRunSummary[]): AggregatedBuildState {
  if (checks.length === 0) {
    return 'unknown';
  }
  const failureConclusions = new Set(['failure', 'timed_out', 'startup_failure', 'action_required']);
  if (checks.some((c) => c.conclusion && failureConclusions.has(c.conclusion))) {
    return 'failure';
  }
  if (checks.some((c) => c.status !== 'completed')) {
    return 'pending';
  }
  if (checks.every((c) => c.conclusion === 'success' || c.conclusion === 'skipped' || c.conclusion === 'neutral')) {
    return 'success';
  }
  return 'unknown';
}
