export interface RepoRef {
  owner: string;
  repo: string;
}

export type CheckConclusion =
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

export type CheckStatus = 'queued' | 'in_progress' | 'completed' | 'pending' | 'waiting' | null;

export interface CheckRunSummary {
  name: string;
  status: CheckStatus;
  conclusion: CheckConclusion;
  htmlUrl: string;
}

export type AggregatedBuildState = 'success' | 'failure' | 'pending' | 'unknown';

export interface PullRequestSummary {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  state: 'open' | 'closed';
  draft: boolean;
  authorLogin: string;
  authorAvatar: string;
  createdAt: string;
  updatedAt: string;
  headRef: string;
  headSha: string;
  baseRef: string;
  repo: RepoRef;
  additions: number | null;
  deletions: number | null;
  changedFiles: number | null;
  comments: number;
  reviewComments: number;
  mergeable: boolean | null;
  checks: CheckRunSummary[];
  buildState: AggregatedBuildState;
}

export interface DashboardSettings {
  token: string;
  repos: RepoRef[];
  refreshIntervalSeconds: number;
}
