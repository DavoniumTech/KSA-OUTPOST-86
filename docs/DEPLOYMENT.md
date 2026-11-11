# Deployment Guide — Windows, GitHub Pages and Cloudflare

## 1. Extract and run locally

Install Node.js 22.16 or later and Git for Windows. In PowerShell, use the folder where you saved the ZIP:

```powershell
$Project = Join-Path $HOME 'Downloads\KSA-OUTPOST-86'
New-Item -ItemType Directory -Force -Path $Project | Out-Null
Expand-Archive -LiteralPath (Join-Path $HOME 'Downloads\KSA-OUTPOST-86-2.1.0.zip') -DestinationPath $Project -Force
Set-Location $Project
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). Keep PowerShell open while testing. To test on an Android phone on the same Wi-Fi network, open the LAN URL printed by Vite.

Before deploying, run:

```powershell
npm run typecheck
npm test
npm run build
```

Do not proceed to deployment unless all three commands finish successfully. The current working environment did not complete `npm ci`, so the production build has not been independently verified in this update.

## 2. GitHub Pages

The repository includes `.github/workflows/deploy.yml`. After the project source is pushed to the `main` branch:

1. Open the GitHub repository's **Settings → Pages**.
2. Set the build/deployment source to **GitHub Actions**.
3. Confirm the repository's Actions workflow is enabled.
4. Push a reviewed commit to `main`, or run **Deploy KSA OUTPOST 86** through the Actions tab.
5. Wait for the workflow to finish successfully, then open the published Pages URL.
6. Test the menu, mission entry, assistant, interactions and save/continue on the hosted site.

The Vite configuration uses `/KSA-OUTPOST-86/` as the production base path for the GitHub Pages project URL. If the repository is renamed or hosted at a custom root domain, revisit `vite.config.ts` before rebuilding.

## 3. Cloudflare Pages

The application can also be built for a root-hosted static site. In the Cloudflare Pages project settings, set `WORKERS_CI` to `1` as a **build environment variable** so Vite uses `/` as its base path.

| Setting | Value |
|---|---|
| Framework preset | Vite (or Other) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `/` |
| Build environment variable | `WORKERS_CI=1` |
| Runtime secrets | None required |

Connect the intended GitHub repository and choose `main` as the production branch. Deploy only after the GitHub repository and workflow state have been checked. After the first successful Pages deployment, open the generated `*.pages.dev` URL and validate it before attaching a custom domain.

## 4. Cloudflare Worker static assets

The archive includes `wrangler.jsonc`, which serves the `dist/` directory as Worker static assets. With Wrangler installed and authenticated, build with `WORKERS_CI=1` and deploy using Wrangler:

```powershell
$env:WORKERS_CI = '1'
npm run build
npx wrangler deploy
Remove-Item Env:WORKERS_CI
```

This is a separate deployment target from Cloudflare Pages. It has not been deployed or validated from this environment. Confirm the target Cloudflare account and Worker name in the dashboard before deployment; do not assume it is the same service as Pages.

## 5. Safe GitHub push helper

`scripts/push-ksa-outpost-86.ps1` is a guarded convenience script. It does not force-push, but it can create a commit and push after you explicitly type `COPY` and `PUSH`. Read the script before executing it. It stops if the remote contains existing commits or the local history diverges. If it stops, compare and reconcile the repository histories manually; do not delete remote files or force-push to make the script continue.

The ZIP does not include `.git` metadata. GitHub's actual branch history must therefore be checked from an authenticated local checkout immediately before any write. The archive itself is not evidence of the remote's current state.
