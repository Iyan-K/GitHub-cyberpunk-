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
  head_commit: { message: string; author: { name: string } };
}

export interface GithubConfig {
  token: string;
  owner: string;
  repo: string;
}
