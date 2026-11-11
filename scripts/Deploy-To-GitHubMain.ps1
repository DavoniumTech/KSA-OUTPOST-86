[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackageRoot,
    [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Invoke-Native {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [int[]]$AllowedExitCodes = @(0)
    )

    # Git writes ordinary progress messages to stderr. Keep native stderr from
    # becoming a terminating PowerShell error; validate the real exit code.
    $previousEap = $ErrorActionPreference
    $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $hasNativePreference = $null -ne $nativePreference
    if ($hasNativePreference) {
        $previousNativePreference = $nativePreference.Value
        Set-Variable -Name PSNativeCommandUseErrorActionPreference -Value $false -Scope Local
    }

    try {
        $ErrorActionPreference = 'Continue'
        $lines = @(& $Executable @Arguments 2>&1 | ForEach-Object { $_.ToString() })
        $code = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousEap
        if ($hasNativePreference) {
            Set-Variable -Name PSNativeCommandUseErrorActionPreference -Value $previousNativePreference -Scope Local
        }
    }

    if ($AllowedExitCodes -notcontains $code) {
        throw "$Executable failed (exit $code): $($Arguments -join ' ')`n$($lines -join "`n")"
    }

    return [PSCustomObject]@{ Output = $lines; ExitCode = $code }
}

function Invoke-Git {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    return (Invoke-Native -Executable 'git' -Arguments $Arguments).Output
}

function Test-GitClean {
    $status = Invoke-Git -Arguments @('status', '--porcelain', '--untracked-files=all')
    return (($status -join '').Trim().Length -eq 0)
}

$resolvedPackage = (Resolve-Path -LiteralPath $PackageRoot).Path
$resolvedRepo = (Resolve-Path -LiteralPath $RepoRoot).Path
if (-not (Test-Path -LiteralPath (Join-Path $resolvedPackage 'package.json'))) {
    throw "Package root does not contain package.json: $resolvedPackage"
}
if (-not (Test-Path -LiteralPath (Join-Path $resolvedPackage 'src/main.ts'))) {
    throw "Package root does not contain src/main.ts: $resolvedPackage"
}

$gitRootResult = Invoke-Native -Executable 'git' -Arguments @('-C', $resolvedRepo, 'rev-parse', '--show-toplevel')
$resolvedRepo = (Resolve-Path -LiteralPath (($gitRootResult.Output | Select-Object -First 1).Trim())).Path

Push-Location $resolvedRepo
try {
    $remote = (Invoke-Git -Arguments @('remote', 'get-url', 'origin') | Select-Object -First 1).Trim()
    if ($remote -notmatch '(?i)(github\.com[:/]DavoniumTech/KSA-OUTPOST-86(?:\.git)?)$') {
        throw "The origin remote is not the expected repository. Found: $remote"
    }

    $branch = (Invoke-Git -Arguments @('branch', '--show-current') | Select-Object -First 1).Trim()
    if ($branch -ne 'main') {
        throw "The current branch is '$branch'. Switch to the existing main branch before deployment. No branch was created."
    }

    if (-not (Test-GitClean)) {
        throw 'The repository has local modifications or untracked files. Commit or safely stash them before deployment; nothing was overwritten.'
    }

    Invoke-Git -Arguments @('ls-remote', '--exit-code', '--heads', 'origin', 'main') | Out-Null
    Invoke-Git -Arguments @('fetch', 'origin', 'main') | Out-Null
    Invoke-Git -Arguments @('pull', '--ff-only', 'origin', 'main') | Out-Null

    if (-not (Test-GitClean)) {
        throw 'The repository is not clean after fast-forward synchronization. Stop and inspect before overlaying the package.'
    }

    $protectedNames = @('.git', 'node_modules', 'dist', '.github', '.wrangler')
    $protectedFiles = @('wrangler.jsonc', 'wrangler.toml', '.env', '.dev.vars')
    $secretPatterns = @('^\.env($|\.)', '^\.dev\.vars($|\.)')

    foreach ($item in Get-ChildItem -LiteralPath $resolvedPackage -Force) {
        $name = $item.Name
        if ($protectedNames -contains $name -or $protectedFiles -contains $name) { continue }
        if (@($secretPatterns | Where-Object { $name -match $_ }).Count -gt 0) { continue }

        $destination = Join-Path $resolvedRepo $name
        if ($item.PSIsContainer) {
            if (-not (Test-Path -LiteralPath $destination)) {
                New-Item -ItemType Directory -Path $destination -Force | Out-Null
            }
            $copyResult = Invoke-Native -Executable 'robocopy.exe' -Arguments @(
                $item.FullName, $destination, '/E', '/COPY:DAT', '/DCOPY:DAT',
                '/R:2', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP',
                '/XD', '.git', 'node_modules', 'dist', '.github', '.wrangler',
                '/XF', '.env*', '.dev.vars*', 'wrangler.jsonc', 'wrangler.toml'
            ) -AllowedExitCodes @(0,1,2,3,4,5,6,7)
            if ($copyResult.ExitCode -ge 8) { throw "Robocopy failed for '$name'." }
        }
        else {
            Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
        }
    }

    # The PlayCanvas world entry was replaced by the Babylon.js renderer.
    $obsoleteRenderer = Join-Path $resolvedRepo 'src/engine/createWorld.ts'
    if (Test-Path -LiteralPath $obsoleteRenderer -PathType Leaf) {
        Remove-Item -LiteralPath $obsoleteRenderer -Force
    }

    Invoke-Git -Arguments @('add', '-A', '--', '.') | Out-Null
    $diff = Invoke-Native -Executable 'git' -Arguments @('diff', '--cached', '--quiet') -AllowedExitCodes @(0,1)
    if ($diff.ExitCode -eq 0) {
        Write-Host 'The package matches main; there are no changes to commit.' -ForegroundColor Yellow
        return
    }

    # Guard against accidentally staging secrets.
    $staged = Invoke-Git -Arguments @('diff', '--cached', '--name-only')
    $secretFiles = @($staged | Where-Object { $_ -match '(?i)(^|/)(\.env(?:\..*)?|\.dev\.vars(?:\..*)?|[^/]+\.(pem|key|p12|pfx))$' })
    if ($secretFiles.Count -gt 0) {
        throw "Potential secret files are staged. Deployment stopped: $($secretFiles -join ', ')"
    }

    Invoke-Git -Arguments @('commit', '-m', 'fix: improve KSA Outpost 86 onboarding and navigation') | Out-Null
    Invoke-Git -Arguments @('push', 'origin', 'main') | Out-Null

    $localHead = (Invoke-Git -Arguments @('rev-parse', 'HEAD') | Select-Object -First 1).Trim()
    $remoteLine = Invoke-Git -Arguments @('ls-remote', 'origin', 'refs/heads/main') | Select-Object -First 1
    $remoteHead = ($remoteLine -split '\s+')[0].Trim()
    if (-not $remoteHead -or $localHead -ne $remoteHead) {
        throw 'Push returned, but remote main SHA does not match local HEAD. Verify GitHub before considering deployment successful.'
    }

    Write-Host 'SUCCESS: application changes were pushed directly to origin/main.' -ForegroundColor Green
    Write-Host "Commit: $localHead"
    Write-Host 'No pull request or force-push was used.'
    Write-Host 'Cloudflare deployment is not claimed; verify the configured production integration separately.' -ForegroundColor Cyan
}
finally {
    Pop-Location
}
