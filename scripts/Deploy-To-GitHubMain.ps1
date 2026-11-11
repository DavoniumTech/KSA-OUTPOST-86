[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackageRoot,
    [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    $output = & git @GitArgs 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Git command failed (exit $exitCode): git $($GitArgs -join ' ')`n$($output -join "`n")"
    }
    return $output
}

function Test-GitClean {
    $status = & git status --porcelain --untracked-files=all
    if ($LASTEXITCODE -ne 0) { throw 'Unable to inspect Git working-tree status.' }
    return [string]::IsNullOrWhiteSpace(($status -join ''))
}

$resolvedPackage = (Resolve-Path -LiteralPath $PackageRoot).Path
$resolvedRepo = (Resolve-Path -LiteralPath $RepoRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $resolvedPackage 'package.json'))) {
    throw "Package root does not contain package.json: $resolvedPackage"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedPackage 'src/main.ts'))) {
    throw "Package root does not contain src/main.ts: $resolvedPackage"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedRepo '.git'))) {
    $gitRoot = (& git -C $resolvedRepo rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0) { throw "Not a Git repository: $resolvedRepo" }
    $resolvedRepo = (Resolve-Path -LiteralPath $gitRoot.Trim()).Path
}

Push-Location $resolvedRepo
try {
    $top = (Invoke-Git rev-parse --show-toplevel | Select-Object -First 1).Trim()
    if (([IO.Path]::GetFullPath($top)) -ne ([IO.Path]::GetFullPath($resolvedRepo))) {
        throw "Run deployment from the repository root. Detected root: $top"
    }

    $remote = (Invoke-Git remote get-url origin | Select-Object -First 1).Trim()
    if ($remote -notmatch '(?i)(github\.com[:/]DavoniumTech/KSA-OUTPOST-86(?:\.git)?)$') {
        throw "The origin remote is not the expected repository. Found: $remote"
    }

    if (-not (Test-GitClean)) {
        throw 'The repository has local modifications or untracked files. Commit or safely stash them before deployment; nothing was overwritten.'
    }

    $branch = (Invoke-Git branch --show-current | Select-Object -First 1).Trim()
    if ($branch -ne 'main') {
        throw "The current branch is '$branch'. Switch to the existing main branch before running this deployment. No branch was created."
    }

    Invoke-Git ls-remote --exit-code --heads origin main | Out-Null
    Invoke-Git fetch origin main | Out-Null
    Invoke-Git pull --ff-only origin main | Out-Null

    if (-not (Test-GitClean)) {
        throw 'The repository is not clean after fast-forward synchronization. Stop and inspect before overlaying the package.'
    }

    $protectedNames = @('.git', 'node_modules', 'dist', '.github')
    $protectedFiles = @('wrangler.jsonc', 'wrangler.toml', '.env', '.dev.vars')
    $secretPatterns = @('^.env($|\.)', '^\.dev\.vars($|\.)')

    Get-ChildItem -LiteralPath $resolvedPackage -Force | ForEach-Object {
        $name = $_.Name
        if ($protectedNames -contains $name -or $protectedFiles -contains $name) { return }
        if ($secretPatterns | Where-Object { $name -match $_ }) { return }

        $destination = Join-Path $resolvedRepo $name
        if ($_.PSIsContainer) {
            if (-not (Test-Path -LiteralPath $destination)) {
                New-Item -ItemType Directory -Path $destination -Force | Out-Null
            }
            & robocopy $_.FullName $destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:1 /XD .git node_modules dist .github /XF .env* .dev.vars* wrangler.jsonc wrangler.toml | Out-Null
            $rc = $LASTEXITCODE
            if ($rc -ge 8) { throw "Robocopy failed for '$name' with exit code $rc" }
        } else {
            Copy-Item -LiteralPath $_.FullName -Destination $destination -Force
        }
    }

    # The former PlayCanvas scene entry point was deliberately replaced by the Babylon renderer.
    $obsoleteRenderer = Join-Path $resolvedRepo 'src/engine/createWorld.ts'
    if (Test-Path -LiteralPath $obsoleteRenderer -PathType Leaf) {
        Remove-Item -LiteralPath $obsoleteRenderer -Force
        Write-Host 'Removed the superseded PlayCanvas renderer source.'
    }

    Invoke-Git add -A -- . | Out-Null
    $staged = & git diff --cached --quiet
    $diffExit = $LASTEXITCODE
    if ($diffExit -eq 0) {
        Write-Host 'The package matches the existing main branch; there are no changes to commit.' -ForegroundColor Yellow
        return
    }
    if ($diffExit -ne 1) { throw 'Unable to inspect staged changes.' }

    Invoke-Git commit -m 'feat: rebuild KSA Outpost 86 as Orbital Frontier' | Out-Null
    Invoke-Git push origin main | Out-Null

    $localHead = (Invoke-Git rev-parse HEAD | Select-Object -First 1).Trim()
    $remoteHead = (Invoke-Git ls-remote origin refs/heads/main | Select-Object -First 1).Split("`t")[0].Trim()
    if (-not $remoteHead -or $localHead -ne $remoteHead) {
        throw 'Push command returned, but the remote main SHA does not match the local commit. Verify the repository before considering deployment successful.'
    }

    Write-Host 'SUCCESS: application changes were pushed directly to origin/main.' -ForegroundColor Green
    Write-Host "Commit: $localHead"
    Write-Host 'No pull request or force-push was used.'
    Write-Host 'Cloudflare deployment is not claimed; confirm the repository integration or Worker deployment separately.' -ForegroundColor Cyan
}
finally {
    Pop-Location
}
