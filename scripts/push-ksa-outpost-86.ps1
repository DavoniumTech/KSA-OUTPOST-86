$ErrorActionPreference = 'Stop'
$ExpectedRemote = 'https://github.com/DavoniumTech/KSA-OUTPOST-86.git'
$ExpectedSshRemote = 'git@github.com:DavoniumTech/KSA-OUTPOST-86.git'
$ExpectedBranch = 'main'

function Stop-WithMessage([string]$Message) {
    Write-Host ''
    Write-Host $Message -ForegroundColor Yellow
    throw 'Stopped safely. No push was performed.'
}

function Invoke-Checked([string]$Command, [string[]]$Arguments, [string]$WorkingDirectory = '') {
    if ($WorkingDirectory) {
        Push-Location $WorkingDirectory
        try { & $Command @Arguments; $code = $LASTEXITCODE }
        finally { Pop-Location }
    } else {
        & $Command @Arguments
        $code = $LASTEXITCODE
    }
    if ($code -ne 0) {
        Stop-WithMessage "Command failed (exit $code): $Command $($Arguments -join ' ')"
    }
}

Write-Host 'KSA OUTPOST 86 — safe GitHub push helper' -ForegroundColor Cyan
Write-Host 'This script never force-pushes and never deletes your repository.'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Stop-WithMessage 'Git was not found. Install Git for Windows, reopen PowerShell and run this script again.'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Stop-WithMessage 'Node.js was not found. Install Node.js 22.16 LTS or later, reopen PowerShell and run this script again.'
}
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Stop-WithMessage 'npm was not found. Reinstall Node.js with npm enabled, reopen PowerShell and try again.'
}
$NodeVersionText = (& node -p 'process.versions.node').Trim()
try { $NodeVersion = [version]$NodeVersionText } catch { Stop-WithMessage "Could not understand the installed Node.js version: $NodeVersionText" }
if ($NodeVersion.Major -lt 22 -or ($NodeVersion.Major -eq 22 -and $NodeVersion -lt [version]'22.16.0')) {
    Stop-WithMessage "Node.js 22.16.0 or newer is required. Detected $NodeVersionText. Upgrade Node.js and try again."
}

$ZipInput = Read-Host 'Enter the full path to the downloaded KSA-OUTPOST-86.zip'
if ([string]::IsNullOrWhiteSpace($ZipInput)) { Stop-WithMessage 'A ZIP path is required.' }
$ZipPath = (Resolve-Path -LiteralPath $ZipInput -ErrorAction SilentlyContinue).Path
if (-not $ZipPath -or -not (Test-Path -LiteralPath $ZipPath -PathType Leaf)) {
    Stop-WithMessage 'The ZIP file was not found. Check the path and try again.'
}
if ([IO.Path]::GetExtension($ZipPath) -ne '.zip') { Stop-WithMessage 'The selected file does not have a .zip extension.' }

$WorkspaceInput = Read-Host 'Enter a safe workspace folder (press Enter for Documents\KSA-OUTPOST-86-workspace)'
if ([string]::IsNullOrWhiteSpace($WorkspaceInput)) {
    $WorkspaceInput = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'KSA-OUTPOST-86-workspace'
}
$Workspace = [IO.Path]::GetFullPath($WorkspaceInput)
if (-not (Test-Path -LiteralPath $Workspace)) {
    New-Item -ItemType Directory -Path $Workspace | Out-Null
}
if (-not (Test-Path -LiteralPath $Workspace -PathType Container)) { Stop-WithMessage 'The workspace path is not a folder.' }

$ExtractPath = Join-Path $Workspace ('source-' + [guid]::NewGuid().ToString('N'))
$RepoPath = Join-Path $Workspace 'KSA-OUTPOST-86-repository'
New-Item -ItemType Directory -Path $ExtractPath | Out-Null

# Reject suspicious ZIP entry paths before extraction.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
    foreach ($Entry in $Archive.Entries) {
        $EntryName = $Entry.FullName.Replace('\', '/')
        if ($EntryName.StartsWith('/') -or $EntryName -match '^[A-Za-z]:' -or $EntryName -match '(^|/)\.\.(/|$)') {
            Stop-WithMessage "The ZIP contains an unsafe path: $($Entry.FullName)"
        }
    }
} finally {
    $Archive.Dispose()
}
Expand-Archive -LiteralPath $ZipPath -DestinationPath $ExtractPath -Force

$ProjectRoot = $ExtractPath
if (-not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'package.json')) -or
    -not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'index.html')) -or
    -not (Test-Path -LiteralPath (Join-Path $ProjectRoot 'src'))) {
    Stop-WithMessage 'The extracted ZIP does not have the expected project root (package.json, index.html and src). No files were copied.'
}

$RepoInput = Read-Host "Enter an existing local checkout path, or press Enter to use $RepoPath"
if (-not [string]::IsNullOrWhiteSpace($RepoInput)) {
    $RepoPath = [IO.Path]::GetFullPath($RepoInput)
}

if (Test-Path -LiteralPath $RepoPath) {
    if (-not (Test-Path -LiteralPath (Join-Path $RepoPath '.git'))) {
        Stop-WithMessage "The folder exists but is not a Git checkout: $RepoPath. Choose a different folder or inspect it manually."
    }
    $Remote = (git -C $RepoPath remote get-url origin 2>$null).Trim()
    if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'The existing checkout has no origin remote.' }
    if ($Remote -notin @($ExpectedRemote, $ExpectedSshRemote, 'https://github.com/DavoniumTech/KSA-OUTPOST-86')) {
        Stop-WithMessage "The existing checkout points to '$Remote', not the required KSA OUTPOST 86 repository. Nothing was changed."
    }
    $Status = git -C $RepoPath status --porcelain
    if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Could not inspect the existing Git working tree.' }
    if ($Status) {
        Stop-WithMessage 'The existing checkout has uncommitted changes. Commit or back them up yourself before running this script again.'
    }
    Invoke-Checked 'git' @('fetch', 'origin') $RepoPath
    $RemoteMain = git -C $RepoPath rev-parse --verify 'origin/main' 2>$null
    if ($LASTEXITCODE -eq 0) {
        $LocalBranch = (git -C $RepoPath branch --show-current).Trim()
        if ($LocalBranch -ne $ExpectedBranch) {
            Stop-WithMessage "The checkout is on '$LocalBranch', not 'main'. Switch and review the branch manually before continuing."
        }
        git -C $RepoPath merge-base --is-ancestor origin/main HEAD
        if ($LASTEXITCODE -ne 0) {
            Stop-WithMessage 'GitHub main contains commits that are not in the local checkout, or the histories have diverged. Review and reconcile the histories manually before copying or pushing; this script will not merge or force-push.'
        }
    } else {
        Stop-WithMessage 'The remote does not expose a main branch. Review the repository branches on GitHub before continuing.'
    }
} else {
    Write-Host 'Cloning the target repository...' -ForegroundColor Cyan
    Invoke-Checked 'git' @('clone', $ExpectedRemote, $RepoPath)
    $RemoteHeads = git -C $RepoPath ls-remote --heads origin
    if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Could not inspect the target remote branches. Check GitHub access and authentication.' }
    if ($RemoteHeads) {
        Stop-WithMessage 'The GitHub repository already has one or more branches/commits. The script cloned it but stopped before copying files. Review and reconcile the existing repository content manually, then run again with that clean checkout.'
    }
    Invoke-Checked 'git' @('checkout', '-b', 'main') $RepoPath
}

$TrackedFiles = git -C $RepoPath ls-tree -r --name-only HEAD 2>$null
if ($LASTEXITCODE -eq 0 -and $TrackedFiles) {
    $ConflictList = @()
    foreach ($Relative in $TrackedFiles) {
        if (Test-Path -LiteralPath (Join-Path $ProjectRoot $Relative)) { $ConflictList += $Relative }
    }
    if ($ConflictList.Count -gt 0) {
        Write-Host 'The repository already tracks files that have same-path files in the project ZIP:' -ForegroundColor Yellow
        $ConflictList | ForEach-Object { Write-Host "  - $_" }
        Stop-WithMessage 'Resolve these file conflicts manually so existing repository content is not overwritten.'
    }
}

Write-Host ''
Write-Host "Destination repository: $RepoPath" -ForegroundColor Cyan
Write-Host 'The copy will preserve the .git folder and omit node_modules, dist, coverage and temporary folders.'
$ConfirmCopy = Read-Host 'Type COPY to copy the extracted project files into this repository'
if ($ConfirmCopy -cne 'COPY') { Stop-WithMessage 'Copy was not approved.' }

$ExcludedNames = @('.git', 'node_modules', 'dist', 'coverage', '.vite', '.next')
Get-ChildItem -LiteralPath $ProjectRoot -Force | Where-Object { $_.Name -notin $ExcludedNames } | ForEach-Object {
    Copy-Item -LiteralPath $_.FullName -Destination $RepoPath -Recurse -Force
}

if (Test-Path -LiteralPath (Join-Path $RepoPath 'package-lock.json')) {
    Write-Host 'Installing dependencies from package-lock.json...' -ForegroundColor Cyan
    Invoke-Checked 'npm' @('ci') $RepoPath
} else {
    Write-Host 'No package-lock.json exists yet. Running npm install to resolve pinned versions and create the lockfile...' -ForegroundColor Yellow
    Invoke-Checked 'npm' @('install') $RepoPath
}
Write-Host 'Running type checking...' -ForegroundColor Cyan
Invoke-Checked 'npm' @('run', 'typecheck') $RepoPath
Write-Host 'Running unit tests...' -ForegroundColor Cyan
Invoke-Checked 'npm' @('test') $RepoPath
Write-Host 'Running production build...' -ForegroundColor Cyan
Invoke-Checked 'npm' @('run', 'build') $RepoPath

Write-Host ''
Write-Host 'Git status before commit:' -ForegroundColor Cyan
Invoke-Checked 'git' @('status', '--short') $RepoPath
$ConfirmPush = Read-Host 'Type PUSH to stage, commit and push to origin/main'
if ($ConfirmPush -cne 'PUSH') { Stop-WithMessage 'Push was not approved. The local copied files are still available for review.' }

Invoke-Checked 'git' @('add', '-A') $RepoPath
$Staged = git -C $RepoPath diff --cached --name-only
if ($LASTEXITCODE -ne 0) { Stop-WithMessage 'Could not inspect staged changes.' }
if (-not $Staged) { Stop-WithMessage 'There are no staged changes to commit.' }
Invoke-Checked 'git' @('commit', '-m', 'Build KSA OUTPOST 86 training mission') $RepoPath
Invoke-Checked 'git' @('push', '-u', 'origin', 'main') $RepoPath

$LocalCommit = (git -C $RepoPath rev-parse HEAD).Trim()
$RemoteCommitLine = git -C $RepoPath ls-remote origin refs/heads/main
if ($LASTEXITCODE -ne 0 -or -not $RemoteCommitLine) { Stop-WithMessage 'Push command returned, but the remote main branch could not be verified.' }
$RemoteCommit = ($RemoteCommitLine -split '\s+')[0]
if ($LocalCommit -ne $RemoteCommit) {
    Stop-WithMessage "The remote main commit ($RemoteCommit) does not match local HEAD ($LocalCommit). Check GitHub before retrying."
}

Write-Host ''
Write-Host 'Verified: origin/main now points to the local commit.' -ForegroundColor Green
Write-Host "Commit: $LocalCommit"
Write-Host 'Next: connect DavoniumTech/KSA-OUTPOST-86 to Cloudflare Pages using the settings in docs/DEPLOYMENT.md.'
Write-Host "Extracted source retained at: $ExtractPath"
