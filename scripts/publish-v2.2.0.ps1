[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ZipPath,

    [string]$RepositoryPath = (Join-Path $HOME 'KSA-OUTPOST-86-publish')
)

$ErrorActionPreference = 'Stop'
$ExpectedRemote = 'https://github.com/DavoniumTech/KSA-OUTPOST-86.git'
$ExpectedBranch = 'main'
$TemporaryRoot = Join-Path $env:TEMP ('ksa-outpost-86-' + [guid]::NewGuid().ToString('N'))

function Stop-Release([string]$Message) {
    Write-Host ''
    Write-Host $Message -ForegroundColor Yellow
    throw 'Release stopped safely. No force-push was attempted.'
}

function Invoke-Checked(
    [string]$CommandName,
    [string[]]$CommandArguments,
    [string]$WorkingDirectory
) {
    Push-Location $WorkingDirectory
    try {
        & $CommandName @CommandArguments
        $ExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }
    if ($ExitCode -ne 0) {
        Stop-Release "Command failed (exit $ExitCode): $CommandName $($CommandArguments -join ' ')"
    }
}

try {
    foreach ($ToolName in @('git', 'node', 'npm')) {
        if (-not (Get-Command $ToolName -ErrorAction SilentlyContinue)) {
            Stop-Release "$ToolName was not found. Install Git for Windows and Node.js 22.16+, then reopen PowerShell."
        }
    }

    $NodeVersionText = (& node -p 'process.versions.node').Trim()
    try { $NodeVersion = [version]$NodeVersionText }
    catch { Stop-Release "Could not read the Node.js version: $NodeVersionText" }
    if ($NodeVersion.Major -lt 22 -or ($NodeVersion.Major -eq 22 -and $NodeVersion -lt [version]'22.16.0')) {
        Stop-Release "Node.js 22.16.0 or later is required; detected $NodeVersionText."
    }

    $ResolvedZip = (Resolve-Path -LiteralPath $ZipPath -ErrorAction SilentlyContinue).Path
    if (-not $ResolvedZip -or -not (Test-Path -LiteralPath $ResolvedZip -PathType Leaf)) {
        Stop-Release "ZIP not found: $ZipPath"
    }
    if ([IO.Path]::GetExtension($ResolvedZip) -ne '.zip') {
        Stop-Release 'The supplied project archive must be a .zip file.'
    }

    $RepositoryPath = [IO.Path]::GetFullPath($RepositoryPath)
    $RepositoryParent = Split-Path -Parent $RepositoryPath
    if (-not (Test-Path -LiteralPath $RepositoryParent)) {
        New-Item -ItemType Directory -Path $RepositoryParent -Force | Out-Null
    }

    if (Test-Path -LiteralPath $RepositoryPath) {
        if (-not (Test-Path -LiteralPath (Join-Path $RepositoryPath '.git'))) {
            Stop-Release "RepositoryPath exists but is not a Git checkout: $RepositoryPath. Choose another path or inspect the folder manually."
        }
        $RemoteUrl = (& git -C $RepositoryPath remote get-url origin 2>$null)
        if ($LASTEXITCODE -ne 0 -or $RemoteUrl.Trim() -notin @($ExpectedRemote, 'https://github.com/DavoniumTech/KSA-OUTPOST-86', 'git@github.com:DavoniumTech/KSA-OUTPOST-86.git')) {
            Stop-Release "The checkout origin is not the expected KSA OUTPOST 86 repository: $RemoteUrl"
        }
        $DirtyState = @(& git -C $RepositoryPath status --porcelain)
        if ($LASTEXITCODE -ne 0) { Stop-Release 'Could not inspect the existing Git working tree.' }
        if ($DirtyState.Count -gt 0 -and -not [string]::IsNullOrWhiteSpace(($DirtyState -join ''))) {
            Stop-Release 'The existing checkout has uncommitted changes. Commit or back them up before publishing.'
        }
    }
    else {
        Write-Host 'Cloning the existing GitHub repository...' -ForegroundColor Cyan
        Push-Location $RepositoryParent
        try {
            & git clone $ExpectedRemote $RepositoryPath
            $CloneExit = $LASTEXITCODE
        }
        finally {
            Pop-Location
        }
        if ($CloneExit -ne 0) { Stop-Release 'Git clone failed. Check your network and GitHub authentication.' }
    }

    $CurrentBranch = (& git -C $RepositoryPath branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $CurrentBranch -ne $ExpectedBranch) {
        Stop-Release "The checkout must be on branch '$ExpectedBranch'; current branch: '$CurrentBranch'. No branch switch was made."
    }
    Invoke-Checked 'git' @('fetch', 'origin') $RepositoryPath
    Invoke-Checked 'git' @('pull', '--ff-only', 'origin', 'main') $RepositoryPath

    New-Item -ItemType Directory -Path $TemporaryRoot -Force | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [IO.Compression.ZipFile]::OpenRead($ResolvedZip)
    try {
        foreach ($Entry in $Archive.Entries) {
            $EntryName = $Entry.FullName.Replace('\', '/')
            if ($EntryName.StartsWith('/') -or $EntryName -match '^[A-Za-z]:' -or $EntryName -match '(^|/)\.\.(/|$)') {
                Stop-Release "Unsafe archive path detected: $($Entry.FullName)"
            }
        }
    }
    finally {
        $Archive.Dispose()
    }
    Expand-Archive -LiteralPath $ResolvedZip -DestinationPath $TemporaryRoot -Force

    $ProjectRoot = $null
    if ((Test-Path -LiteralPath (Join-Path $TemporaryRoot 'package.json')) -and
        (Test-Path -LiteralPath (Join-Path $TemporaryRoot 'index.html')) -and
        (Test-Path -LiteralPath (Join-Path $TemporaryRoot 'src'))) {
        $ProjectRoot = $TemporaryRoot
    }
    else {
        $Candidates = @(Get-ChildItem -LiteralPath $TemporaryRoot -Directory -Force | Where-Object {
            (Test-Path -LiteralPath (Join-Path $_.FullName 'package.json')) -and
            (Test-Path -LiteralPath (Join-Path $_.FullName 'index.html')) -and
            (Test-Path -LiteralPath (Join-Path $_.FullName 'src'))
        })
        if ($Candidates.Count -eq 1) { $ProjectRoot = $Candidates[0].FullName }
    }
    if (-not $ProjectRoot) {
        Stop-Release 'The ZIP must contain one unambiguous project root with package.json, index.html and src/.'
    }

    $ProjectMetadata = Get-Content -LiteralPath (Join-Path $ProjectRoot 'package.json') -Raw | ConvertFrom-Json
    if ($ProjectMetadata.version -ne '2.2.0') {
        Stop-Release "Expected project version 2.2.0; archive contains $($ProjectMetadata.version)."
    }

    $ExcludedDirectories = @('.git', 'node_modules', 'dist', 'coverage', '.vite', '.wrangler')
    $SourceFiles = @(Get-ChildItem -LiteralPath $ProjectRoot -Recurse -File -Force | Where-Object {
        $Relative = $_.FullName.Substring($ProjectRoot.Length).TrimStart([char[]]@('\', '/'))
        $Parts = $Relative -split '[\\/]'
        ($Parts[0] -notin $ExcludedDirectories) -and ($Relative -notmatch '(^|[\\/])\.env($|\.)')
    })

    $NewFiles = @()
    $ChangedFiles = @()
    $UnchangedFiles = 0
    foreach ($SourceFile in $SourceFiles) {
        $RelativePath = $SourceFile.FullName.Substring($ProjectRoot.Length).TrimStart([char[]]@('\', '/'))
        $Destination = Join-Path $RepositoryPath $RelativePath
        if (-not (Test-Path -LiteralPath $Destination -PathType Leaf)) {
            $NewFiles += $RelativePath
        }
        else {
            $SourceHash = (Get-FileHash -LiteralPath $SourceFile.FullName -Algorithm SHA256).Hash
            $DestinationHash = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash
            if ($SourceHash -ne $DestinationHash) { $ChangedFiles += $RelativePath }
            else { $UnchangedFiles += 1 }
        }
    }

    Write-Host ''
    Write-Host 'KSA OUTPOST 86 — v2.2.0 release preview' -ForegroundColor Cyan
    Write-Host "Repository: $RepositoryPath"
    Write-Host "Branch: $ExpectedBranch"
    Write-Host "Archive files: $($SourceFiles.Count)"
    Write-Host "New files: $($NewFiles.Count) | Changed files: $($ChangedFiles.Count) | Unchanged files: $UnchangedFiles"
    Write-Host 'GitHub-only files will be left in place; no remote files are deleted.'
    if ($NewFiles.Count -gt 0) {
        Write-Host "`nNew files:" -ForegroundColor Green
        $NewFiles | ForEach-Object { Write-Host "  + $_" }
    }
    if ($ChangedFiles.Count -gt 0) {
        Write-Host "`nChanged files:" -ForegroundColor Yellow
        $ChangedFiles | ForEach-Object { Write-Host "  * $_" }
    }

    $CopyApproval = Read-Host "Type COPY to add these v2.2.0 files to '$RepositoryPath'"
    if ($CopyApproval -cne 'COPY') { Stop-Release 'Copy was not approved. The GitHub checkout was not modified.' }

    foreach ($SourceFile in $SourceFiles) {
        $RelativePath = $SourceFile.FullName.Substring($ProjectRoot.Length).TrimStart([char[]]@('\', '/'))
        $Destination = Join-Path $RepositoryPath $RelativePath
        $DestinationFolder = Split-Path -Parent $Destination
        if (-not (Test-Path -LiteralPath $DestinationFolder)) {
            New-Item -ItemType Directory -Path $DestinationFolder -Force | Out-Null
        }
        Copy-Item -LiteralPath $SourceFile.FullName -Destination $Destination -Force
    }

    Write-Host "`nInstalling the exact lockfile dependency tree..." -ForegroundColor Cyan
    Invoke-Checked 'npm' @('ci') $RepositoryPath
    Write-Host "`nRunning TypeScript checks, unit tests and production build..." -ForegroundColor Cyan
    Invoke-Checked 'npm' @('run', 'build') $RepositoryPath

    Write-Host '`nReviewing changes...' -ForegroundColor Cyan
    Invoke-Checked 'git' @('diff', '--check') $RepositoryPath
    & git -C $RepositoryPath status --short
    if ($LASTEXITCODE -ne 0) { Stop-Release 'Could not display the final Git status.' }

    Invoke-Checked 'git' @('add', '-A') $RepositoryPath
    Invoke-Checked 'git' @('diff', '--cached', '--check') $RepositoryPath
    $StagedFiles = @(& git -C $RepositoryPath diff --cached --name-only)
    if ($LASTEXITCODE -ne 0 -or $StagedFiles.Count -eq 0) {
        Stop-Release 'No staged release changes were found. Nothing was committed or pushed.'
    }
    Write-Host "`nStaged files: $($StagedFiles.Count)" -ForegroundColor Cyan
    $StagedFiles | ForEach-Object { Write-Host "  $_" }

    $PushApproval = Read-Host "Type PUSH to commit and push v2.2.0 to origin/$ExpectedBranch"
    if ($PushApproval -cne 'PUSH') {
        Invoke-Checked 'git' @('reset') $RepositoryPath
        Stop-Release 'Push was not approved. The copied files remain in the local checkout, unstaged.'
    }

    Invoke-Checked 'git' @('commit', '-m', 'Release KSA OUTPOST 86 v2.2.0') $RepositoryPath
    Invoke-Checked 'git' @('push', 'origin', 'main') $RepositoryPath

    $LocalCommit = (& git -C $RepositoryPath rev-parse HEAD).Trim()
    $RemoteLine = & git -C $RepositoryPath ls-remote origin refs/heads/main
    if ($LASTEXITCODE -ne 0 -or -not $RemoteLine) {
        Stop-Release 'Push returned, but the remote main commit could not be verified.'
    }
    $RemoteCommit = ($RemoteLine -split '\s+')[0]
    if ($LocalCommit -ne $RemoteCommit) {
        Stop-Release "Remote main is $RemoteCommit while local HEAD is $LocalCommit. Inspect GitHub before retrying."
    }

    Write-Host ''
    Write-Host 'SUCCESS: origin/main matches the release commit.' -ForegroundColor Green
    Write-Host "Commit: $LocalCommit"
    Write-Host "Local checkout: $RepositoryPath"
    Write-Host 'No force-push was used. Remote-only files were not deleted.'
}
finally {
    if (Test-Path -LiteralPath $TemporaryRoot) {
        Remove-Item -LiteralPath $TemporaryRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
