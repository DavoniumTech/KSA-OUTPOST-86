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

function Set-JsonProperty {
    param([object]$Object, [string]$Name, [object]$Value)
    if ($Object.PSObject.Properties.Name -contains $Name) {
        $Object.$Name = $Value
    }
    else {
        $Object | Add-Member -MemberType NoteProperty -Name $Name -Value $Value
    }
}

function Get-JsonPropertyValue {
    param([object]$Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Merge-WranglerConfig {
    param([string]$IncomingPath, [string]$ExistingPath)
    $incomingText = Get-Content -LiteralPath $IncomingPath -Raw
    $incoming = $incomingText | ConvertFrom-Json
    if (-not (Test-Path -LiteralPath $ExistingPath)) {
        Copy-Item -LiteralPath $IncomingPath -Destination $ExistingPath -Force
        return
    }

    # Preserve user-owned account_id, vars, routes, secrets references,
    # observability and other production settings while merging game services.
    $existing = (Get-Content -LiteralPath $ExistingPath -Raw) | ConvertFrom-Json
    foreach ($name in @('name', 'main', 'compatibility_date', 'workers_dev', 'assets')) {
        $value = Get-JsonPropertyValue $incoming $name
        if ($null -ne $value) { Set-JsonProperty $existing $name $value }
    }

    $incomingDurable = Get-JsonPropertyValue $incoming 'durable_objects'
    if ($null -ne $incomingDurable) {
        $incomingBindings = @(Get-JsonPropertyValue $incomingDurable 'bindings')
        $existingDurable = Get-JsonPropertyValue $existing 'durable_objects'
        $existingBindings = @()
        if ($null -ne $existingDurable) {
            $existingBindings = @(Get-JsonPropertyValue $existingDurable 'bindings')
        }
        foreach ($binding in $incomingBindings) {
            if ($null -eq $binding) { continue }
            $match = $existingBindings | Where-Object { $_.name -eq $binding.name } | Select-Object -First 1
            if ($match) { $match.class_name = $binding.class_name }
            else { $existingBindings += $binding }
        }
        if ($null -eq $existingDurable) {
            $existingDurable = [pscustomobject]@{ bindings = @() }
            Set-JsonProperty $existing 'durable_objects' $existingDurable
        }
        Set-JsonProperty $existingDurable 'bindings' @($existingBindings)
    }

    $incomingMigrations = Get-JsonPropertyValue $incoming 'migrations'
    if ($null -ne $incomingMigrations) {
        $migrations = @()
        $existingMigrations = Get-JsonPropertyValue $existing 'migrations'
        if ($null -ne $existingMigrations) { $migrations = @($existingMigrations) }
        foreach ($migration in @($incomingMigrations)) {
            $current = $migrations | Where-Object { $_.tag -eq $migration.tag } | Select-Object -First 1
            if (-not $current) { $migrations += $migration; continue }
            foreach ($propertyName in @('new_classes', 'new_sqlite_classes', 'deleted_classes', 'renamed_classes')) {
                $incomingValues = Get-JsonPropertyValue $migration $propertyName
                if ($null -ne $incomingValues) {
                    $oldValueResult = Get-JsonPropertyValue $current $propertyName
                    $oldValues = @()
                    if ($null -ne $oldValueResult) { $oldValues = @($oldValueResult) }
                    foreach ($value in @($incomingValues)) { if ($oldValues -notcontains $value) { $oldValues += $value } }
                    Set-JsonProperty $current $propertyName @($oldValues)
                }
            }
        }
        Set-JsonProperty $existing 'migrations' @($migrations)
    }

    $existingRoutes = Get-JsonPropertyValue $existing 'routes'
    $incomingRoutes = Get-JsonPropertyValue $incoming 'routes'
    if (($null -eq $existingRoutes -or @($existingRoutes).Count -eq 0) -and $null -ne $incomingRoutes) {
        Set-JsonProperty $existing 'routes' @($incomingRoutes)
    }
    $existingAssets = Get-JsonPropertyValue $existing 'assets'
    $incomingAssets = Get-JsonPropertyValue $incoming 'assets'
    if ($null -eq $existingAssets -and $null -ne $incomingAssets) {
        Set-JsonProperty $existing 'assets' $incomingAssets
    }

    $json = $existing | ConvertTo-Json -Depth 100
    # Emit UTF-8 without a BOM for Wrangler's JSONC parser and keep the file portable.
    $utf8NoBom = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList @($false)
    [System.IO.File]::WriteAllText($ExistingPath, $json, $utf8NoBom)
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

    # Update only the production workflow file; preserve other user workflows.
    $workflowSource = Join-Path $resolvedPackage '.github/workflows/deploy.yml'
    if (Test-Path -LiteralPath $workflowSource) {
        $workflowTarget = Join-Path $resolvedRepo '.github/workflows/deploy.yml'
        New-Item -ItemType Directory -Path (Split-Path -Parent $workflowTarget) -Force | Out-Null
        Copy-Item -LiteralPath $workflowSource -Destination $workflowTarget -Force
    }

    # Merge Cloudflare bindings/migrations while preserving account IDs and
    # existing user variables, routes, secrets references and observability.
    $wranglerSource = Join-Path $resolvedPackage 'wrangler.jsonc'
    if (Test-Path -LiteralPath $wranglerSource) {
        $wranglerTarget = Join-Path $resolvedRepo 'wrangler.jsonc'
        Merge-WranglerConfig -IncomingPath $wranglerSource -ExistingPath $wranglerTarget
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

    Invoke-Git -Arguments @('commit', '-m', 'feat: KSA Outpost 86 v3 Orbital Frontier game experience') | Out-Null
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
