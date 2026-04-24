# GitHub-cyberpunk-

A cyberpunk / retrowave **Pull Request dashboard** for GitHub, built with Angular
and a 2D canvas. Connects directly to the GitHub API using a Personal Access
Token to show your team's open PRs, CI build status, and a flashing red
"Critical Alert" mode (with a subtle synth-wave alarm) when any build fails.

The Angular application lives in [`cyberpunk-dashboard/`](./cyberpunk-dashboard/).

```bash
cd cyberpunk-dashboard
npm install
npm start
```

See [`cyberpunk-dashboard/README.md`](./cyberpunk-dashboard/README.md) for full
documentation, including how to configure your GitHub token and repos.
