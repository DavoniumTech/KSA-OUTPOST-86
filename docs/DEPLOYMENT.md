# Deployment Guide — GitHub and Cloudflare Pages

## 1. Run locally first

Install Node.js and Git on Windows. Open PowerShell in the extracted project folder and run:

```powershell
npm install
npm run dev
```

The ZIP does not contain `package-lock.json` because the build environment could not contact the npm registry. The first `npm install` creates it; commit that generated lockfile. After that, use `npm ci` for reproducible clean installs. Confirm the game opens and the mission can be completed before pushing it.

## 2. Push to GitHub

The intended remote is:

`https://github.com/DavoniumTech/KSA-OUTPOST-86.git`

The production branch is `main`.

The script `scripts/push-ksa-outpost-86.ps1` is designed to:

- Ask for the source ZIP path.
- Extract into a temporary workspace.
- Check expected project files.
- Clone or verify a local checkout.
- Verify the remote URL and branch history.
- Stop when it detects a non-empty/divergent remote or local uncommitted changes that need human review.
- Run `npm install` on the first use if no lockfile exists (this creates a real `package-lock.json`); use `npm ci` once the lockfile is present. Then run type checking, tests and a production build.
- Ask before copying files and committing.
- Push without force-pushing.
- Compare the remote `main` commit with the local commit after the push.

Save the script as `push-ksa-outpost-86.ps1` or run it from the `scripts` folder. In PowerShell:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\push-ksa-outpost-86.ps1
```

Authenticate with the existing Git Credential Manager or GitHub CLI browser sign-in. Never paste a password or token into the script.

The public repository page was empty when checked on 10 November 2026. In that case, the script will create the initial local `main` branch and make the first commit after validation. If the repository has since gained files or commits, do not force-push. Review the remote files on GitHub, clone the repository separately, compare them with the ZIP, and reconcile the histories deliberately. The script is intentionally conservative.

## 3. Create Cloudflare Pages project

1. Sign in to the Cloudflare dashboard.
2. Open **Workers & Pages** and choose **Create application** / **Pages**.
3. Choose the Git connection option and connect GitHub.
4. Authorise access to `DavoniumTech/KSA-OUTPOST-86`.
5. Select the `main` production branch.
6. Use the following build settings.

| Setting | Value |
|---|---|
| Project name | `ksa-outpost-86` |
| Production branch | `main` |
| Root directory | `/` |
| Framework preset | `Vite` (or Other if Vite is not listed) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variables | None |

7. Start the first deployment and wait for the dashboard to report success.
8. Open the generated `*.pages.dev` address and test the complete mission.
9. After the project is verified, configure a custom domain through the Pages **Custom domains** section if required.

## 4. Future updates

After the GitHub connection is active, pushing a new commit to `main` triggers a new production build. Check the Pages deployment log if a build fails. The public URL should be considered live only after the first deployment reports success and the game has been opened and tested.

Official instructions:

- https://developers.cloudflare.com/pages/
- https://developers.cloudflare.com/pages/configuration/git-integration/
- https://developers.cloudflare.com/pages/configuration/build-configuration/
