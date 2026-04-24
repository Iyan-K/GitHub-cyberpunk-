# NEON_PR_DASH — Cyberpunk PR Dashboard

A real-time pull-request and CI dashboard for GitHub, dressed in retrowave / cyberpunk
neon. Built with **Angular 18** standalone components and a 2D canvas-rendered
retrowave background — pinks, cyans, scanlines, glowing text, the works.

> Looks like a productivity dashboard from your manager's POV. Looks like an 80s
> hacker movie from the dev's POV.

## Features

- 🔌 **Connect to GitHub** with a Personal Access Token — no backend required, all
  requests go directly from your browser to `api.github.com`. The token is stored
  only in your browser's `localStorage`.
- 📋 **Multi-repo PR board** — list as many `owner/repo` entries as you want.
- ✅ **Live build status** for each PR, aggregated from GitHub Check Runs on the
  PR's head commit (success / failure / pending / unknown).
- ⏱️ **Auto-refresh** at a configurable interval (default 60 s) plus a manual
  sync button.
- 🎛️ **Filter & sort** — show all / failing only, sort by recent activity, oldest,
  or failures-first.
- 🚨 **Critical Alert mode** — when any tracked PR has a failing build the entire
  screen turns red, the retrowave grid recolours, a flashing banner drops in, and
  a subtle Web-Audio synth-wave alarm starts pulsing. Mute it any time.
- 🌈 **Cyberpunk vibe** — animated horizon/sun, perspective grid, scanline
  overlay, neon glow on every chrome.

## Quick start

```bash
cd cyberpunk-dashboard
npm install
npm start
```

Open <http://localhost:4200>. You'll be prompted to **JACK_IN** with:

1. **A GitHub Personal Access Token.** Create one at
   <https://github.com/settings/tokens?type=beta> with read access to
   `Pull requests`, `Checks`, and `Metadata` for the repos you want to follow.
   A classic PAT with the `repo` scope works too.
2. **One or more repositories**, formatted as `owner/repo`, one per line.
3. **A refresh interval** in seconds (minimum 15).

The dashboard validates the token by calling `GET /user` before saving.

## Production build

```bash
npm run build
```

Static output lands in `dist/cyberpunk-dashboard/`. Deploy that folder to any
static host (GitHub Pages, Netlify, S3, nginx, etc.).

> ⚠️ Because the app calls `api.github.com` directly from the browser, the token
> lives in `localStorage`. Use a fine-grained token scoped only to the repos and
> permissions you actually need.

## Project layout

```
cyberpunk-dashboard/
└── src/
    ├── app/
    │   ├── app.component.*          # Shell: retrowave grid + scanlines + view switch
    │   ├── core/
    │   │   ├── github.service.ts    # Talks to api.github.com (PRs + check runs)
    │   │   ├── settings.service.ts  # Token + repo list (localStorage)
    │   │   ├── alarm.service.ts     # Web Audio synth-wave alarm
    │   │   ├── alert-state.service.ts
    │   │   └── models.ts
    │   └── components/
    │       ├── settings/            # JACK_IN screen
    │       ├── dashboard/           # Main board
    │       ├── pr-card/             # Single PR card with check chips
    │       ├── retro-grid/          # Animated canvas background
    │       └── critical-alert/      # Red flashing overlay + banner
    └── styles/_cyberpunk.scss       # Shared neon design tokens
```

## Critical Alert — how it triggers

Whenever **any** PR currently displayed has at least one Check Run with a
`failure`, `timed_out`, `startup_failure` or `action_required` conclusion, the
dashboard enters Critical Alert mode:

- The retrowave grid recolours to red.
- A `CRITICAL ALERT` banner drops down with a flicker animation.
- The Web Audio API synthesises a slow, pulsing detuned-sawtooth siren.
- The state clears the moment all builds are green again.

Click **🔊 ALARM / 🔇 MUTED** in the toolbar to toggle the audio without leaving
alert mode visually. Browsers require a user gesture before audio can play, so
the first click on the page also primes the audio context.

## License

Provided as-is for the retro-future of your sprint.
