# Deployment notes — v2.3.0

## Existing production configuration

This project retains its Vite `dist` output and existing base-path behaviour:

- GitHub Pages uses `/KSA-OUTPOST-86/`.
- A Cloudflare Workers asset build can use root base `/` when `WORKERS_CI=1`.
- `wrangler.jsonc` remains the existing static-assets configuration.
- `.github/workflows/deploy.yml` remains untouched; in the supplied baseline it deploys GitHub Pages, not Cloudflare.

Do not infer a Cloudflare Git integration from the presence of `wrangler.jsonc`. Verify the real Cloudflare account/project settings before claiming an automatic production deployment.

## Build commands

```powershell
npm ci
npm run build
```

For the Workers root-path build:

```powershell
$env:WORKERS_CI = '1'
npm run build
```

## Safe GitHub main deployment

`scripts/Deploy-To-GitHubMain.ps1` accepts `-PackageRoot` and `-RepoRoot`. It checks the expected repository remote, requires a clean working tree and the currently checked-out `main` branch, verifies remote `main`, fast-forwards, overlays the package while preserving `.git`, `.github`, Cloudflare configuration and secrets, commits changes and pushes directly to `origin main`. It does not create a PR, branch or force-push.

A successful push confirms GitHub accepted the commit. It does not, by itself, prove that a Cloudflare deployment completed.
