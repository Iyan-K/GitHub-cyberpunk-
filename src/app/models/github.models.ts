export interface PullRequest {
  id: number;
  number: number;
  title: string;
  state: string;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  html_url: string;
  draft: boolean;
  labels: Array<{ name: string; color: string }>;
  requested_reviewers: Array<{ login: string }>;
  base: { ref: string };
  head: { ref: string };
}

export interface WorkflowRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  jobs_url?: string;
  head_commit: { message: string; author: { name: string } };
  actor?: { login: string; avatar_url?: string };
  triggering_actor?: { login: string; avatar_url?: string };
}

export interface WorkflowJobStep {
  name: string;
  status: string;
  conclusion: string | null;
  number: number;
}

export interface WorkflowJob {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  started_at: string;
  completed_at: string | null;
  steps?: WorkflowJobStep[];
}

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
}

export type SoundMode = 'solo' | 'squad' | 'chaos';

export interface SquadSettings {
  audioEnabled: boolean;
  soundMode: SoundMode;
  squadMembers: string[];
}
