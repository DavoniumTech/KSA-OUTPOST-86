$ErrorActionPreference = 'Stop'

function Invoke-NativeCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Executable,
        [Parameter(Mandatory = $true)][string[]]$Arguments,
        [int[]]$AllowedExitCodes = @(0)
    )
    $oldEap = $ErrorActionPreference
    $nativePreference = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    $hasNativePreference = $null -ne $nativePreference
    if ($hasNativePreference) {
        $oldNativePreference = $nativePreference.Value
        Set-Variable -Name PSNativeCommandUseErrorActionPreference -Value $false -Scope Local
    }
    try {
        $ErrorActionPreference = 'Continue'
        $lines = @(& $Executable @Arguments 2>&1 | ForEach-Object { $_.ToString() })
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $oldEap
        if ($hasNativePreference) {
            Set-Variable -Name PSNativeCommandUseErrorActionPreference -Value $oldNativePreference -Scope Local
        }
    }
    if ($AllowedExitCodes -notcontains $exitCode) {
        throw "$Executable failed (exit $exitCode): $($Arguments -join ' ')`n$($lines -join "`n")"
    }
    return [PSCustomObject]@{ Output = $lines; ExitCode = $exitCode }
}

$repoUrl = 'https://github.com/DavoniumTech/KSA-OUTPOST-86.git'
$repoRoot = Join-Path $HOME 'KSA-OUTPOST-86'
$zip = Join-Path $HOME 'Downloads\KSA-OUTPOST-86-UI-GUIDE-UPDATE-v2.3.1.zip'
$temp = Join-Path $env:TEMP ('KSA-OUTPOST-86-v231-' + [guid]::NewGuid().ToString('N'))

if (-not (Test-Path -LiteralPath $zip -PathType Leaf)) {
    throw "Update ZIP not found in Downloads: $zip"
}

try {
    if (Test-Path -LiteralPath $repoRoot) {
        if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) {
            $backup = Join-Path $HOME ('KSA-OUTPOST-86-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
            Write-Host "Preserving the non-Git folder at: $backup" -ForegroundColor Yellow
            Move-Item -LiteralPath $repoRoot -Destination $backup
        }
    }

    if (-not (Test-Path -LiteralPath $repoRoot)) {
        Write-Host 'Cloning the existing DavoniumTech repository...' -ForegroundColor Cyan
        $clone = Invoke-NativeCommand -Executable 'git' -Arguments @('clone', '--branch', 'main', '--single-branch', $repoUrl, $repoRoot)
        $clone.Output | ForEach-Object { Write-Host $_ }
    }

    if (-not (Test-Path -LiteralPath (Join-Path $repoRoot '.git'))) {
        throw "The repository clone is not valid: $repoRoot"
    }

    New-Item -ItemType Directory -Path $temp -Force | Out-Null
    Write-Host 'Extracting the v2.3.1 update...' -ForegroundColor Cyan
    Expand-Archive -LiteralPath $zip -DestinationPath $temp -Force

    $packageFiles = @(Get-ChildItem -LiteralPath $temp -Filter 'package.json' -File -Recurse)
    $validPackage = @($packageFiles | Where-Object {
        (Test-Path -LiteralPath (Join-Path $_.DirectoryName 'src\main.ts')) -and
        (Test-Path -LiteralPath (Join-Path $_.DirectoryName 'scripts\Deploy-To-GitHubMain.ps1'))
    })

    if ($validPackage.Count -ne 1) {
        throw "Expected exactly one application root in the ZIP; found $($validPackage.Count)."
    }

    $packageRoot = $validPackage[0].DirectoryName
    $deployScript = Join-Path $packageRoot 'scripts\Deploy-To-GitHubMain.ps1'

    Write-Host 'Applying the update and pushing directly to main...' -ForegroundColor Cyan
    & $deployScript -PackageRoot $packageRoot -RepoRoot $repoRoot

    if (-not $?) {
        throw 'The deployment helper did not complete successfully.'
    }

    Write-Host ''
    Write-Host 'KSA OUTPOST 86 v2.3.1 update completed.' -ForegroundColor Green
    Write-Host "Repository: $repoUrl"
    Write-Host 'Branch: main'
    Write-Host 'No pull request or force-push was used.'
}
finally {
    if (Test-Path -LiteralPath $temp) {
        Remove-Item -LiteralPath $temp -Recurse -Force
    }
}
