# Deployment — KSA OUTPOST 86 v3.6.0

## Production repository

- Repository: `https://github.com/DavoniumTech/KSA-OUTPOST-86.git`
- Production branch: `main`
- Vite output: `dist/`
- Existing GitHub Pages base: `/KSA-OUTPOST-86/`
- Cloudflare Worker root build: set `WORKERS_CI=1` before the Vite build.

The supplied GitHub Actions workflow deploys GitHub Pages. The repository also includes `wrangler.jsonc` and `worker/index.js`, but these files do not by themselves prove that a Cloudflare Worker is deployed or that the custom domain points to it.

## Build

Requires Node.js 22.16 or newer.

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

For a Cloudflare root-base static build:

```powershell
$env:WORKERS_CI = '1'
npm run build
```

## Direct-to-main package deployment

`scripts/Deploy-To-GitHubMain.ps1` accepts `-PackageRoot` and `-RepoRoot`. It verifies the expected origin, requires a clean working tree and `main`, fetches and fast-forwards safely, overlays package files while protecting `.git`, user secrets and production Cloudflare settings, commits the application update, pushes directly to `origin main` and checks that remote `main` matches the pushed commit.

It does not create a pull request, a feature branch or a force-push. The included ZIP is intended to be extracted and deployed into the existing clone. GitHub authentication and permission to push to `main` are required.

A successful Git push confirms GitHub accepted the commit. It does not, by itself, prove a Pages or Cloudflare deployment completed. Confirm the relevant GitHub Actions run and Cloudflare custom-domain/route settings separately.
